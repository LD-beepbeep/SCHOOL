/* ================================================================
   StudentOS — patches32.js
   1.  Whiteboard: true browser Fullscreen API
   2.  Whiteboard: grid as CSS overlay (not baked into canvas)
   3.  Mind-map: edit nodes, right-click context menu, no emoji
   4.  Whiteboard: resizable inserted images via drag overlay
   5.  Notes: clickable colour icon in sidebar
   6.  Music: stop background audio when video panel is shown
   ================================================================ */

'use strict';

/* ── tiny helpers ─────────────────────────────────────────────── */
const _p32dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const _p32dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function _p32waitFor(fn, interval) {
    (function _try() { if (!fn()) setTimeout(_try, interval || 200); })();
}

/* ================================================================
   1.  WHITEBOARD — TRUE BROWSER FULLSCREEN
   ================================================================ */

(function _p32_fullscreen() {
    function _onFsChange() {
        var view = document.getElementById('view-whiteboard');
        var icon = document.getElementById('wb-fs-icon');
        var inFs = !!document.fullscreenElement;
        window.wbFull = inFs;
        if (icon) icon.className = inFs ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        if (!inFs && view) view.style.cssText = '';          /* clear fallback inline styles */
        setTimeout(window.wbResizeCanvas, 80);
    }

    document.addEventListener('fullscreenchange',       _onFsChange);
    document.addEventListener('webkitfullscreenchange', _onFsChange);
    document.addEventListener('mozfullscreenchange',    _onFsChange);

    _p32waitFor(function() {
        if (typeof window.wbToggleFullscreen !== 'function') return false;

        window.wbToggleFullscreen = function() {
            var view = document.getElementById('view-whiteboard');
            if (!view) return;

            if (!document.fullscreenElement) {
                /* ── Enter fullscreen ── */
                var req = view.requestFullscreen
                        || view.webkitRequestFullscreen
                        || view.mozRequestFullScreen;
                if (req) {
                    req.call(view).catch(function() {
                        /* Fallback: fixed positioning if Fullscreen API is blocked */
                        view.style.cssText = 'position:fixed;inset:0;z-index:200;padding:12px;background:var(--bg-color);max-width:100%;';
                        window.wbFull = true;
                        var icon = document.getElementById('wb-fs-icon');
                        if (icon) icon.className = 'fa-solid fa-compress';
                        setTimeout(window.wbResizeCanvas, 80);
                    });
                }
            } else {
                /* ── Exit fullscreen ── */
                var exit = document.exitFullscreen
                         || document.webkitExitFullscreen
                         || document.mozCancelFullScreen;
                if (exit) exit.call(document);
            }
        };
        return true;
    });
})();

/* ================================================================
   2.  WHITEBOARD — GRID AS CSS OVERLAY (not baked into canvas)
   ================================================================ */

(function _p32_grid() {
    /* Inject the overlay div inside wb-container */
    _p32waitFor(function() {
        var con = document.getElementById('wb-container');
        if (!con) return false;
        if (document.getElementById('wb-grid-overlay')) return true;
        var ov = document.createElement('div');
        ov.id = 'wb-grid-overlay';
        con.appendChild(ov);
        return true;
    });

    /* Replace wbToggleGrid to use CSS overlay, not canvas drawing */
    _p32waitFor(function() {
        if (typeof window.wbToggleGrid !== 'function') return false;

        window.wbToggleGrid = function() {
            window.wbGridOn = !window.wbGridOn;
            var btn = document.getElementById('wb-grid-btn');
            if (btn) btn.classList.toggle('active-tool', window.wbGridOn);
            var ov = document.getElementById('wb-grid-overlay');
            if (ov) ov.classList.toggle('active', window.wbGridOn);
        };
        return true;
    });

    /* Prevent wbFillBg from drawing the grid on the canvas so that grid
       lines are never baked into saved canvas data */
    _p32waitFor(function() {
        if (typeof window.wbFillBg !== 'function') return false;
        var _orig = window.wbFillBg;
        window.wbFillBg = function() {
            var wasOn = window.wbGridOn;
            window.wbGridOn = false;   /* suppress canvas grid drawing */
            _orig.call(this);
            window.wbGridOn = wasOn;
            /* sync the CSS overlay state */
            var ov = document.getElementById('wb-grid-overlay');
            if (ov) ov.classList.toggle('active', wasOn);
        };
        return true;
    });
})();

/* ================================================================
   3.  MIND MAP — IMPROVED INTERACTION
       • No emoji in status bar
       • Double-click → edit node (not delete)
       • Right-click → context menu (Edit / Add Child / Delete)
       • Context menu injected into DOM
       • Edit modal injected into DOM
   ================================================================ */

(function _p32_mindmap() {

    /* ── A. Remove emoji from status bar ── */
    _p32waitFor(function() {
        var status = document.getElementById('mm-status');
        if (!status) return false;
        var span = status.querySelector('span');
        if (span && span.innerHTML.includes('🗺')) {
            span.innerHTML = '<i class="fa-solid fa-diagram-project" style="margin-right:5px;"></i>'
                + '<strong>Mind Map Mode</strong>'
                + ' — Click empty area to add node &middot; Click to select &middot; Drag to move'
                + ' &middot; Double-click or right-click to edit';
        }
        return true;
    });

    /* ── B. Inject "Edit Node" modal ── */
    _p32waitFor(function() {
        if (document.getElementById('modal-mm-edit')) return true;
        var m = document.createElement('div');
        m.id = 'modal-mm-edit';
        m.className = 'hidden modal-panel min-card p-6 w-72 bg-[var(--bg-color)] border border-[var(--glass-border)]';
        m.innerHTML = [
            '<h3 class="text-sm font-bold mb-3">Edit Node</h3>',
            '<input type="text" id="mm-edit-text-input" class="bare-input w-full mb-2" placeholder="Node label\u2026" ',
            '       onkeypress="if(event.key===\'Enter\')window._p32confirmEditNode()">',
            '<div class="flex gap-2 mb-4 mt-2">',
            '  <button onclick="window._p32setEditColor(\'#3b82f6\')" class="w-6 h-6 rounded-full bg-blue-500 hover:scale-110 transition border-2 border-transparent" id="mm-edit-color-blue"></button>',
            '  <button onclick="window._p32setEditColor(\'#22c55e\')" class="w-6 h-6 rounded-full bg-green-500 hover:scale-110 transition border-2 border-transparent" id="mm-edit-color-green"></button>',
            '  <button onclick="window._p32setEditColor(\'#ef4444\')" class="w-6 h-6 rounded-full bg-red-500 hover:scale-110 transition border-2 border-transparent" id="mm-edit-color-red"></button>',
            '  <button onclick="window._p32setEditColor(\'#8b5cf6\')" class="w-6 h-6 rounded-full bg-violet-500 hover:scale-110 transition border-2 border-transparent" id="mm-edit-color-purple"></button>',
            '  <button onclick="window._p32setEditColor(\'#f59e0b\')" class="w-6 h-6 rounded-full bg-amber-500 hover:scale-110 transition border-2 border-transparent" id="mm-edit-color-amber"></button>',
            '</div>',
            '<div class="flex justify-between items-center gap-2">',
            '  <button onclick="window._p32deleteEditNode()" class="text-xs px-3 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition">',
            '    <i class="fa-solid fa-trash" style="margin-right:4px;"></i>Delete',
            '  </button>',
            '  <div class="flex gap-2">',
            '    <button onclick="closeModals()" class="text-xs text-[var(--text-muted)]">Cancel</button>',
            '    <button onclick="window._p32confirmEditNode()" class="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded">Save</button>',
            '  </div>',
            '</div>',
        ].join('');
        var overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.appendChild(m);
        else document.body.appendChild(m);
        return true;
    });

    /* ── C. Inject context menu ── */
    _p32waitFor(function() {
        if (document.getElementById('p32-mm-ctx')) return true;
        var menu = document.createElement('div');
        menu.id = 'p32-mm-ctx';
        menu.className = 'p32-mm-ctx';
        menu.innerHTML = [
            '<button class="p32-mm-ctx-item" id="p32-mm-ctx-edit">',
            '  <i class="fa-solid fa-pencil"></i> Edit Label',
            '</button>',
            '<button class="p32-mm-ctx-item" id="p32-mm-ctx-addchild">',
            '  <i class="fa-solid fa-plus"></i> Add Child',
            '</button>',
            '<div class="p32-mm-ctx-divider"></div>',
            '<button class="p32-mm-ctx-item p32-mm-ctx-danger" id="p32-mm-ctx-delete">',
            '  <i class="fa-solid fa-trash"></i> Delete',
            '</button>',
        ].join('');
        document.body.appendChild(menu);

        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) menu.classList.remove('visible');
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') menu.classList.remove('visible');
        });
        return true;
    });

    /* ── D. Edit-node state helpers ── */
    var _editNodeId  = null;
    var _editColor   = '#3b82f6';
    var _colorMap    = { '#3b82f6': 'blue', '#22c55e': 'green', '#ef4444': 'red', '#8b5cf6': 'purple', '#f59e0b': 'amber' };

    window._p32setEditColor = function(c) {
        _editColor = c;
        document.querySelectorAll('[id^="mm-edit-color-"]').forEach(function(b) {
            b.style.borderColor = 'transparent';
        });
        var name = _colorMap[c];
        if (name) {
            var btn = document.getElementById('mm-edit-color-' + name);
            if (btn) btn.style.borderColor = '#fff';
        }
    };

    window._p32openEditNode = function(nodeId) {
        var nodes = window.wbMindMapNodes;
        if (!Array.isArray(nodes)) return;
        var node = nodes.find(function(n) { return n.id === nodeId; });
        if (!node) return;
        _editNodeId = nodeId;
        _editColor  = node.color || '#3b82f6';
        var inp = document.getElementById('mm-edit-text-input');
        if (inp) inp.value = node.text || '';
        window._p32setEditColor(_editColor);
        if (typeof openModal === 'function') openModal('modal-mm-edit');
        setTimeout(function() { if (inp) inp.focus(); }, 60);
    };

    window._p32confirmEditNode = function() {
        var inp  = document.getElementById('mm-edit-text-input');
        var text = (inp ? inp.value.trim() : '');
        if (!text) return;
        var nodes = window.wbMindMapNodes;
        if (!Array.isArray(nodes)) return;
        var node = nodes.find(function(n) { return n.id === _editNodeId; });
        if (node) { node.text = text; node.color = _editColor; }
        if (typeof closeModals    === 'function') closeModals();
        if (typeof window.wbMmSave   === 'function') window.wbMmSave();
        if (typeof window.wbMmRender === 'function') window.wbMmRender();
    };

    window._p32deleteEditNode = function() {
        if (!_editNodeId) return;
        if (typeof closeModals === 'function') closeModals();
        if (typeof window.wbMmDeleteNode === 'function') window.wbMmDeleteNode(_editNodeId);
    };

    /* ── E. Context-menu show/hide ── */
    window._p32showMmCtx = function(nodeId, clientX, clientY) {
        var menu = document.getElementById('p32-mm-ctx');
        if (!menu) return;

        window.wbMindMapSelected = nodeId;
        if (typeof window.wbMmRender === 'function') window.wbMmRender();

        /* position so menu stays on screen */
        menu.style.left = clientX + 'px';
        menu.style.top  = clientY + 'px';
        menu.classList.add('visible');
        /* nudge if it overflows the viewport */
        requestAnimationFrame(function() {
            var r = menu.getBoundingClientRect();
            if (r.right  > window.innerWidth)  menu.style.left = (clientX - r.width)  + 'px';
            if (r.bottom > window.innerHeight)  menu.style.top  = (clientY - r.height) + 'px';
        });

        document.getElementById('p32-mm-ctx-edit').onclick = function() {
            menu.classList.remove('visible');
            window._p32openEditNode(nodeId);
        };
        document.getElementById('p32-mm-ctx-addchild').onclick = function() {
            menu.classList.remove('visible');
            window.wbMindMapSelected = nodeId;
            var nodes = window.wbMindMapNodes || [];
            var n = nodes.find(function(x) { return x.id === nodeId; });
            if (n && typeof window.wbMmAddNode === 'function') {
                window.wbMmAddNode(n.x + 130, n.y + 60);
            }
        };
        document.getElementById('p32-mm-ctx-delete').onclick = function() {
            menu.classList.remove('visible');
            if (typeof window.wbMmDeleteNode === 'function') window.wbMmDeleteNode(nodeId);
        };
    };

    /* ── F. Replace wbMmRender with improved version ──
       Changes vs original:
       • dblclick  → edit  (was: delete)
       • contextmenu → context-menu popup
       All other behaviour (drag, select, edge drawing) is preserved.
    ── */
    _p32waitFor(function() {
        if (typeof window.wbMmRender !== 'function') return false;

        window.wbMmRender = function() {
            var svg = document.getElementById('wb-mindmap-svg');
            if (!svg) return;
            svg.innerHTML = '';

            var con = document.getElementById('wb-container');
            if (con) {
                svg.setAttribute('width',  con.clientWidth);
                svg.setAttribute('height', con.clientHeight);
            }

            /* Draw edges */
            (window.wbMindMapEdges || []).forEach(function(edge) {
                var from = (window.wbMindMapNodes || []).find(function(n) { return n.id === edge.from; });
                var to   = (window.wbMindMapNodes || []).find(function(n) { return n.id === edge.to;   });
                if (!from || !to) return;
                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
                line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
                line.setAttribute('stroke', 'rgba(255,255,255,0.3)');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            });

            /* Draw nodes */
            (window.wbMindMapNodes || []).forEach(function(node) {
                var isSelected = (node.id === window.wbMindMapSelected);
                var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');
                g.style.cursor = 'pointer';

                var w    = Math.max(80, node.text.length * 8 + 20);
                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', -(w / 2)); rect.setAttribute('y', '-18');
                rect.setAttribute('width', w);    rect.setAttribute('height', '36');
                rect.setAttribute('rx', '10');
                rect.setAttribute('fill', node.color || '#3b82f6');
                rect.setAttribute('stroke', isSelected ? '#fff' : 'none');
                rect.setAttribute('stroke-width', isSelected ? '2' : '0');

                var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('text-anchor',        'middle');
                text.setAttribute('dominant-baseline',  'middle');
                text.setAttribute('fill',               '#fff');
                text.setAttribute('font-size',          '13');
                text.setAttribute('font-family',        'Inter, sans-serif');
                text.textContent = node.text;

                g.appendChild(rect);
                g.appendChild(text);

                (function(n) {
                    var _isDragging = false, _t0 = 0;
                    var _dsx = 0, _dsy = 0, _nsx = 0, _nsy = 0;

                    /* Click → select / deselect */
                    g.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (_isDragging) return;          /* ignore click fired after drag */
                        window.wbMindMapSelected = (window.wbMindMapSelected === n.id) ? null : n.id;
                        window.wbMmRender();
                    });

                    /* Double-click → edit label */
                    g.addEventListener('dblclick', function(e) {
                        e.stopPropagation();
                        window._p32openEditNode(n.id);
                    });

                    /* Right-click → context menu */
                    g.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window._p32showMmCtx(n.id, e.clientX, e.clientY);
                    });

                    /* Drag */
                    g.addEventListener('pointerdown', function(e) {
                        e.stopPropagation();
                        _isDragging = true;
                        _t0  = Date.now();
                        _dsx = e.clientX; _dsy = e.clientY;
                        _nsx = n.x;       _nsy = n.y;
                        g.setPointerCapture(e.pointerId);
                    });
                    g.addEventListener('pointermove', function(e) {
                        if (!_isDragging) return;
                        n.x = _nsx + (e.clientX - _dsx);
                        n.y = _nsy + (e.clientY - _dsy);
                        window.wbMmRender();
                    });
                    g.addEventListener('pointerup', function() {
                        if (_isDragging) {
                            _isDragging = false;
                            if (typeof window.wbMmSave === 'function') window.wbMmSave();
                        }
                    });
                })(node);

                svg.appendChild(g);
            });

            /* Click on empty SVG area → add node */
            svg.onclick = function(e) {
                if (e.target === svg) {
                    var r = svg.getBoundingClientRect();
                    if (typeof window.wbMmAddNode === 'function') {
                        window.wbMmAddNode(e.clientX - r.left, e.clientY - r.top);
                    }
                }
            };
        };
        return true;
    });
})();

/* ================================================================
   4.  WHITEBOARD — RESIZABLE INSERTED IMAGES
   ================================================================ */

(function _p32_imgOverlay() {
    var _pendingDataUrl = null;
    var _dragging       = false;
    var _resizing       = false;
    var _resizeDir      = '';
    var _dragStartX     = 0, _dragStartY     = 0;
    var _startLeft      = 0, _startTop       = 0;
    var _startW         = 0, _startH         = 0;

    /* Build the overlay once wb-container exists */
    _p32waitFor(function() {
        var con = document.getElementById('wb-container');
        if (!con) return false;
        if (document.getElementById('p32-img-overlay')) return true;

        var ov = document.createElement('div');
        ov.id = 'p32-img-overlay';
        con.appendChild(ov);

        ov.innerHTML = [
            '<img id="p32-img-preview" draggable="false">',
            '<div class="p32-img-handle p32-img-nw" data-dir="nw"></div>',
            '<div class="p32-img-handle p32-img-ne" data-dir="ne"></div>',
            '<div class="p32-img-handle p32-img-sw" data-dir="sw"></div>',
            '<div class="p32-img-handle p32-img-se" data-dir="se"></div>',
            '<div class="p32-img-toolbar">',
            '  <button class="p32-img-place-btn" id="p32-img-place">',
            '    <i class="fa-solid fa-check"></i> Place',
            '  </button>',
            '  <button class="p32-img-cancel-btn" id="p32-img-cancel">',
            '    <i class="fa-solid fa-xmark"></i>',
            '  </button>',
            '</div>',
        ].join('');

        /* Place button */
        ov.querySelector('#p32-img-place').addEventListener('click', function(e) {
            e.stopPropagation();
            _commitImage();
        });

        /* Cancel button */
        ov.querySelector('#p32-img-cancel').addEventListener('click', function(e) {
            e.stopPropagation();
            ov.classList.remove('active');
            ov.style.display = 'none';
        });

        /* Drag to move */
        ov.addEventListener('pointerdown', function(e) {
            if (e.target.classList.contains('p32-img-handle')) return;
            if (e.target.closest('button')) return;
            _dragging   = true;
            _dragStartX = e.clientX;
            _dragStartY = e.clientY;
            _startLeft  = ov.offsetLeft;
            _startTop   = ov.offsetTop;
            ov.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        ov.addEventListener('pointermove', function(e) {
            if (!_dragging) return;
            ov.style.left = (_startLeft + (e.clientX - _dragStartX)) + 'px';
            ov.style.top  = (_startTop  + (e.clientY - _dragStartY)) + 'px';
        });

        ov.addEventListener('pointerup', function() { _dragging = false; });

        /* Resize handles */
        ov.querySelectorAll('.p32-img-handle').forEach(function(h) {
            h.addEventListener('pointerdown', function(e) {
                e.stopPropagation();
                _resizing   = true;
                _resizeDir  = h.dataset.dir;
                _dragStartX = e.clientX;
                _dragStartY = e.clientY;
                _startW     = ov.offsetWidth;
                _startH     = ov.offsetHeight;
                _startLeft  = ov.offsetLeft;
                _startTop   = ov.offsetTop;
                ov.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            h.addEventListener('pointermove', function(e) {
                if (!_resizing) return;
                var dx = e.clientX - _dragStartX;
                var dy = e.clientY - _dragStartY;
                var newW = _startW, newH = _startH, newL = _startLeft, newT = _startTop;

                if (_resizeDir.includes('e')) newW = Math.max(40, _startW + dx);
                if (_resizeDir.includes('s')) newH = Math.max(40, _startH + dy);
                if (_resizeDir.includes('w')) { newW = Math.max(40, _startW - dx); newL = _startLeft + (_startW - newW); }
                if (_resizeDir.includes('n')) { newH = Math.max(40, _startH - dy); newT = _startTop  + (_startH - newH); }

                ov.style.width  = newW + 'px';
                ov.style.height = newH + 'px';
                ov.style.left   = newL + 'px';
                ov.style.top    = newT + 'px';
            });

            h.addEventListener('pointerup', function() { _resizing = false; });
        });

        return true;
    });

    /* Commit the overlaid image onto the canvas */
    function _commitImage() {
        var ov     = document.getElementById('p32-img-overlay');
        var canvas = document.getElementById('wb-canvas');
        if (!ov || !canvas || !_pendingDataUrl) return;

        /* coordinates inside wb-container = canvas drawing coords */
        var x = ov.offsetLeft;
        var y = ov.offsetTop;
        var w = ov.offsetWidth;
        var h = ov.offsetHeight;

        var img = new Image();
        img.onload = function() {
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, x, y, w, h);
            if (typeof window.wbPushHistory === 'function') window.wbPushHistory();
            if (typeof window.wbSaveBoard   === 'function') window.wbSaveBoard();
        };
        img.src = _pendingDataUrl;

        ov.classList.remove('active');
        ov.style.display = 'none';
    }

    /* Replace wbInsertImage with overlay version */
    _p32waitFor(function() {
        if (typeof window.wbInsertImage !== 'function') return false;

        window.wbInsertImage = function(inp) {
            var f = inp.files[0];
            if (!f) return;
            var r = new FileReader();
            r.onload = function(e) {
                _pendingDataUrl = e.target.result;

                var ov      = document.getElementById('p32-img-overlay');
                var preview = document.getElementById('p32-img-preview');
                var canvas  = document.getElementById('wb-canvas');
                if (!ov || !preview || !canvas) return;

                preview.src = _pendingDataUrl;

                /* Size proportionally to fit ~half the canvas */
                var tmpImg = new Image();
                tmpImg.onload = function() {
                    var maxW  = canvas.clientWidth  * 0.5;
                    var maxH  = canvas.clientHeight * 0.5;
                    var ratio = Math.min(maxW / tmpImg.width, maxH / tmpImg.height, 1);
                    ov.style.width   = Math.round(tmpImg.width  * ratio) + 'px';
                    ov.style.height  = Math.round(tmpImg.height * ratio) + 'px';
                    ov.style.left    = '20px';
                    ov.style.top     = '20px';
                    ov.style.display = 'block';
                    ov.classList.add('active');
                };
                tmpImg.src = _pendingDataUrl;
            };
            r.readAsDataURL(f);
            inp.value = '';
        };
        return true;
    });
})();

/* ================================================================
   5.  NOTES — CLICKABLE COLOUR ICON IN SIDEBAR
   ================================================================ */

(function _p32_noteColor() {
    var COLORS = [
        '#6b7280', '#3b82f6', '#22c55e', '#ef4444',
        '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
    ];

    /* Inject the colour-picker popup */
    _p32waitFor(function() {
        if (document.getElementById('p32-note-color-picker')) return true;
        var picker = document.createElement('div');
        picker.id = 'p32-note-color-picker';
        picker.innerHTML = COLORS.map(function(c) {
            return '<button class="p32-note-color-dot" data-color="' + c
                 + '" style="background:' + c + '" title="' + c + '"></button>';
        }).join('');
        document.body.appendChild(picker);

        picker.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-color]');
            if (!btn) return;
            var color  = btn.dataset.color;
            var noteId = parseInt(picker.dataset.noteId, 10);
            if (!noteId) return;

            /* Update in storage */
            var notes = _p32dbG('os_notes', []);
            var note  = notes.find(function(n) { return n.id === noteId; });
            if (note) {
                note.color = color;
                _p32dbS('os_notes', notes);
                /* Sync live array if available */
                if (Array.isArray(window.notes)) {
                    var wn = window.notes.find(function(n) { return n.id === noteId; });
                    if (wn) wn.color = color;
                }
                if (typeof window.renderNotes === 'function') window.renderNotes();
            }
            picker.classList.remove('visible');
        });

        /* Close on outside click */
        document.addEventListener('click', function(e) {
            var picker2 = document.getElementById('p32-note-color-picker');
            if (picker2 && !picker2.contains(e.target) && !e.target.classList.contains('p32-note-dot')) {
                picker2.classList.remove('visible');
            }
        });
        return true;
    });

    window._p32openNoteColorPicker = function(noteId, anchorEl) {
        var picker = document.getElementById('p32-note-color-picker');
        if (!picker) return;
        picker.dataset.noteId = noteId;
        var rect = anchorEl.getBoundingClientRect();
        /* Position below the anchor, keep on screen */
        var left = rect.left;
        var top  = rect.bottom + 4;
        if (left + 160 > window.innerWidth) left = window.innerWidth - 164;
        if (top  + 100 > window.innerHeight) top = rect.top - 104;
        picker.style.left = left + 'px';
        picker.style.top  = top  + 'px';
        picker.classList.add('visible');
    };

    /* Patch renderNotes to inject colour dots after it builds the sidebar */
    _p32waitFor(function() {
        if (typeof window.renderNotes !== 'function') return false;
        var _orig = window.renderNotes;

        window.renderNotes = function() {
            _orig.apply(this, arguments);
            _p32_injectNoteDots();
        };
        return true;
    });

    function _p32_injectNoteDots() {
        var sidebar = document.getElementById('notes-sidebar');
        if (!sidebar) return;
        var notes = Array.isArray(window.notes)
            ? window.notes
            : _p32dbG('os_notes', []);

        /* Find every "load note" button and add a dot to its parent row */
        sidebar.querySelectorAll('button[onclick]').forEach(function(btn) {
            var m = (btn.getAttribute('onclick') || '').match(/loadNote\((\d+)\)/);
            if (!m) return;
            var noteId = parseInt(m[1], 10);
            var row = btn.parentElement;
            if (!row || row.querySelector('.p32-note-dot')) return;

            var note  = notes.find(function(n) { return n.id === noteId; });
            var color = (note && note.color) ? note.color : '#6b7280';

            var dot = document.createElement('button');
            dot.className = 'p32-note-dot';
            dot.title     = 'Set note colour';
            dot.style.background = color;
            dot.addEventListener('click', function(e) {
                e.stopPropagation();
                window._p32openNoteColorPicker(noteId, dot);
            });
            /* Insert before the title button so dot is the first child */
            row.insertBefore(dot, btn);
        });
    }
})();

/* ================================================================
   6.  MUSIC — STOP BACKGROUND AUDIO WHEN VIDEO PANEL IS SHOWN
   ================================================================ */

(function _p32_musicVideoAudio() {
    var _savedSrc = null;

    function _applyPatch(btn) {
        if (!btn || btn.dataset.p32va) return;
        btn.dataset.p32va = '1';

        /* Run AFTER p6's onclick has toggled visibility and cloned the iframe,
           so the video clone already has the correct src before we silence
           the hidden audio-only frame. */
        btn.addEventListener('click', function() {
            setTimeout(function() {
                var wrap       = document.getElementById('p6-music-video-wrap');
                var audioFrame = document.getElementById('music-player-frame');
                var videoIsNowShowing = wrap && wrap.classList.contains('visible');

                if (videoIsNowShowing) {
                    /* Video just became visible — silence the audio-only frame */
                    if (audioFrame && audioFrame.src) {
                        _savedSrc      = audioFrame.src;
                        audioFrame.src = '';
                    }
                } else {
                    /* Video just became hidden — restore audio */
                    if (audioFrame && _savedSrc) {
                        audioFrame.src = _savedSrc;
                    }
                    _savedSrc = null;
                }
            }, 80); /* small delay so p6 onclick + cloning finishes first */
        });
    }

    function _tryPatch() {
        var btn = document.getElementById('p6-video-toggle');
        if (btn) { _applyPatch(btn); return; }
        setTimeout(_tryPatch, 600);
    }
    _tryPatch();

    /* Re-patch when switching to the music tab (button is injected dynamically) */
    _p32waitFor(function() {
        if (typeof window.switchTab !== 'function') return false;
        var _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            if (name === 'music') setTimeout(_tryPatch, 500);
        };
        return true;
    });
})();

console.log('[patches32] loaded — fullscreen API, CSS grid, mindmap edit/ctx, image overlay, note colour, music audio fix');
