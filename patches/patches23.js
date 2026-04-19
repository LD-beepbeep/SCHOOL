/* ================================================================
   StudentOS — patches23.js
   FIXES & IMPROVEMENTS:
   1.  Tab bleed fix     — patch switchTab to hide dynamic views
   2.  Whiteboard        — sticky notes, keyboard shortcuts, pan
   3.  Worksheet         — image block, code block, autosave chip
   4.  QoL               — misc improvements
   ================================================================ */

'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const _p23lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p23lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p23dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p23lsG(k, d); } catch { return d; } };
const _p23dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p23lsS(k, v); } catch {} };
const _p23esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p23id  = () => Math.random().toString(36).slice(2, 10);
const _p23toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

/* ================================================================
   1.  TAB BLEED FIX
       patches16 dynamically creates view-worksheet, view-attendance
       and view-routine but never registers them in the global `tabs`
       array.  As a result, switchTab('tasks') for example will never
       add `class="hidden"` back to those views, so their content
       remains visible when the user scrolls on any other tab.
       Fix: wrap switchTab to also toggle these extra views.
   ================================================================ */
function _p23_tabBleedFix() {
    /* Extra view ids not in the original tabs array */
    const EXTRA = ['worksheet', 'attendance', 'routine'];

    function _patch() {
        if (typeof window.switchTab !== 'function' || window._p23tabPatchDone) {
            if (!window._p23tabPatchDone) setTimeout(_patch, 200);
            return;
        }
        window._p23tabPatchDone = true;

        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            EXTRA.forEach(id => {
                const el = document.getElementById('view-' + id);
                if (el) el.classList.toggle('hidden', id !== name);
            });
        };

        /* Ensure any currently un-hidden extra views are hidden now
           (covers the case where the page loaded with one visible) */
        const active = document.querySelector('[id^="view-"]:not(.hidden)');
        const activeName = active ? active.id.replace('view-', '') : null;
        EXTRA.forEach(id => {
            const el = document.getElementById('view-' + id);
            if (el && id !== activeName) el.classList.add('hidden');
        });
    }

    /* Also observe the DOM for when patches16 injects the views */
    function _observeDOM() {
        const main = document.getElementById('main-scroll');
        if (!main) { setTimeout(_observeDOM, 500); return; }

        const _hideNewExtras = () => {
            /* Newly injected extra views should start hidden.
               They'll be shown when switchTab(id) is called for them. */
            EXTRA.forEach(id => {
                const el = document.getElementById('view-' + id);
                if (!el) return;
                /* Only hide if no button for this view is currently active */
                const btnActive = document.getElementById('btn-' + id);
                if (!btnActive || !btnActive.classList.contains('active')) {
                    el.classList.add('hidden');
                }
            });
        };

        new MutationObserver(_hideNewExtras).observe(main, { childList: true });
    }

    _patch();
    _observeDOM();
}

/* ================================================================
   2.  WHITEBOARD IMPROVEMENTS
       2a.  Keyboard shortcuts — P/E/S/H/L/R/C/T for tools,
                                 Ctrl+Z/Y for undo/redo
       2b.  Sticky notes       — draggable coloured overlay notes
       2c.  Pan                — Space+drag to pan the canvas view
       2d.  Keyboard hint bar  — collapsible hint row under toolbar
   ================================================================ */
function _p23_whiteboardEnhancements() {

    /* ── 2a. Keyboard shortcuts ─────────────────────────────── */
    function _kbdShortcuts() {
        const MAP = { p:'pen', e:'eraser', s:'select', h:'highlighter',
                      l:'line', r:'rect',  c:'circle', t:'text' };

        window.addEventListener('keydown', ev => {
            /* Only fire when the whiteboard is the active view */
            const wbView = document.getElementById('view-whiteboard');
            if (!wbView || wbView.classList.contains('hidden')) return;

            /* Don't fire inside text inputs / content-editable */
            const tag = ev.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable) return;

            const key = ev.key.toLowerCase();

            if (!ev.ctrlKey && !ev.metaKey && MAP[key]) {
                ev.preventDefault();
                if (typeof window.wbSetTool === 'function') window.wbSetTool(MAP[key]);
                return;
            }
            if ((ev.ctrlKey || ev.metaKey) && key === 'z' && !ev.shiftKey) {
                ev.preventDefault();
                if (typeof window.wbUndo === 'function') window.wbUndo();
                return;
            }
            if ((ev.ctrlKey || ev.metaKey) && (key === 'y' || (key === 'z' && ev.shiftKey))) {
                ev.preventDefault();
                if (typeof window.wbRedo === 'function') window.wbRedo();
                return;
            }
            /* Delete selected area */
            if ((key === 'delete' || key === 'backspace') && !ev.target.value && !ev.target.textContent) {
                if (typeof window.wbDeleteSelection === 'function') window.wbDeleteSelection();
            }
        });
    }

    /* ── 2b. Sticky notes ───────────────────────────────────── */
    function _stickyNotes() {
        const COLORS = ['yellow','pink','blue','green','orange','purple'];
        const DOT_BG = { yellow:'#fef08a', pink:'#fbcfe8', blue:'#bfdbfe',
                         green:'#bbf7d0', orange:'#fed7aa', purple:'#e9d5ff' };

        let _activeStickyColor = 'yellow';

        function _load() { return _p23dbG('os_wb_stickies_' + _activeBoardId(), []); }
        function _save(arr) { _p23dbS('os_wb_stickies_' + _activeBoardId(), arr); }
        function _activeBoardId() { return window.wbActiveBoardId ?? 1; }

        /* Build/update the sticky layer inside #wb-container */
        function _ensureLayer() {
            const container = document.getElementById('wb-container');
            if (!container) return null;
            let layer = document.getElementById('wb-sticky-layer');
            if (!layer) {
                layer = document.createElement('div');
                layer.id = 'wb-sticky-layer';
                container.appendChild(layer);
            }
            return layer;
        }

        function _renderAll() {
            const layer = _ensureLayer(); if (!layer) return;
            layer.innerHTML = '';
            _load().forEach(note => _renderNote(layer, note));
        }

        function _renderNote(layer, note) {
            const el = document.createElement('div');
            el.className = 'wb-sticky';
            el.dataset.id = note.id;
            el.dataset.color = note.color || 'yellow';
            el.style.left = (note.x ?? 40) + 'px';
            el.style.top  = (note.y ?? 40) + 'px';
            el.style.width = (note.w ?? 160) + 'px';

            const hdr = document.createElement('div');
            hdr.className = 'wb-sticky-header';

            const del = document.createElement('button');
            del.className = 'wb-sticky-delete';
            del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            del.title = 'Delete note';
            del.addEventListener('click', e => {
                e.stopPropagation();
                const arr = _load().filter(n => n.id !== note.id);
                _save(arr);
                el.remove();
            });

            hdr.appendChild(del);
            el.appendChild(hdr);

            const body = document.createElement('textarea');
            body.className = 'wb-sticky-body';
            body.placeholder = 'Type your note\u2026';
            body.value = note.text || '';
            body.rows = 3;
            body.spellcheck = false;
            body.addEventListener('input', () => {
                const arr = _load();
                const n = arr.find(x => x.id === note.id);
                if (n) n.text = body.value;
                _save(arr);
            });
            /* Prevent canvas pointer events while editing note */
            body.addEventListener('pointerdown', e => e.stopPropagation());

            el.appendChild(body);

            /* Drag the note by header */
            let _dx = 0, _dy = 0, _dragging = false;
            hdr.addEventListener('pointerdown', e => {
                if (e.target === del || del.contains(e.target)) return;
                e.preventDefault();
                e.stopPropagation();
                _dragging = true;
                const rect = el.getBoundingClientRect();
                _dx = e.clientX - rect.left;
                _dy = e.clientY - rect.top;
                hdr.setPointerCapture(e.pointerId);
                el.style.zIndex = '20';
            });
            hdr.addEventListener('pointermove', e => {
                if (!_dragging) return;
                e.stopPropagation();
                const container = document.getElementById('wb-container');
                const cr = container.getBoundingClientRect();
                const newX = Math.max(0, Math.min(e.clientX - cr.left - _dx, cr.width  - el.offsetWidth));
                const newY = Math.max(0, Math.min(e.clientY - cr.top  - _dy, cr.height - el.offsetHeight));
                el.style.left = newX + 'px';
                el.style.top  = newY + 'px';
            });
            hdr.addEventListener('pointerup', e => {
                if (!_dragging) return;
                _dragging = false;
                el.style.zIndex = '';
                /* Persist position */
                const arr = _load();
                const n = arr.find(x => x.id === note.id);
                if (n) {
                    n.x = parseInt(el.style.left, 10);
                    n.y = parseInt(el.style.top,  10);
                }
                _save(arr);
            });

            layer.appendChild(el);
        }

        /* Inject the sticky note button into the whiteboard toolbar */
        function _injectButton() {
            const toolbar = document.querySelector('.wb-toolbar-row');
            if (!toolbar || toolbar.querySelector('#wb-sticky-btn-wrap')) return;

            /* Find the last divider and insert after it */
            const lastDivider = [...toolbar.querySelectorAll('.wb-divider')].pop();

            const wrap = document.createElement('div');
            wrap.id = 'wb-sticky-btn-wrap';

            const btn = document.createElement('button');
            btn.id = 'wb-tool-sticky';
            btn.className = 'wb-tool';
            btn.title = 'Add sticky note (N)';
            btn.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';

            /* Color picker popover */
            const picker = document.createElement('div');
            picker.id = 'wb-sticky-color-picker';
            COLORS.forEach(col => {
                const dot = document.createElement('button');
                dot.className = 'wb-stk-color-dot' + (col === _activeStickyColor ? ' active' : '');
                dot.style.background = DOT_BG[col];
                dot.title = col;
                dot.addEventListener('click', e => {
                    e.stopPropagation();
                    _activeStickyColor = col;
                    picker.querySelectorAll('.wb-stk-color-dot').forEach(d => d.classList.remove('active'));
                    dot.classList.add('active');
                });
                picker.appendChild(dot);
            });

            btn.addEventListener('click', e => {
                e.stopPropagation();
                picker.classList.toggle('open');
            });

            /* Place new note on click-dismiss */
            document.addEventListener('click', e => {
                if (!wrap.contains(e.target)) picker.classList.remove('open');
            });

            /* Keyboard shortcut N */
            window.addEventListener('keydown', ev => {
                const wbView = document.getElementById('view-whiteboard');
                if (!wbView || wbView.classList.contains('hidden')) return;
                const tag = ev.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable) return;
                if (ev.key.toLowerCase() === 'n' && !ev.ctrlKey && !ev.metaKey) {
                    ev.preventDefault();
                    _addNote();
                }
            });

            wrap.appendChild(btn);
            wrap.appendChild(picker);

            if (lastDivider) lastDivider.after(wrap);
            else toolbar.appendChild(wrap);
        }

        function _addNote() {
            const layer = _ensureLayer(); if (!layer) return;
            const container = document.getElementById('wb-container');
            const cr = container ? container.getBoundingClientRect() : { width: 600, height: 400 };
            const note = {
                id: _p23id(),
                color: _activeStickyColor,
                text: '',
                x: Math.round(cr.width  / 2 - 80 + (Math.random() - .5) * 80),
                y: Math.round(cr.height / 2 - 40 + (Math.random() - .5) * 60),
                w: 160,
            };
            const arr = _load();
            arr.push(note);
            _save(arr);
            _renderNote(layer, note);
            /* Focus the body of the new note */
            setTimeout(() => {
                const el = layer.querySelector(`[data-id="${note.id}"] .wb-sticky-body`);
                if (el) el.focus();
            }, 50);
        }

        /* Expose globally so toolbar button can call it */
        window._p23addStickyNote = _addNote;

        /* Watch for board switches and re-render stickies */
        function _watchBoard() {
            let _lastBoard = _activeBoardId();
            setInterval(() => {
                const cur = _activeBoardId();
                if (cur !== _lastBoard) {
                    _lastBoard = cur;
                    _renderAll();
                }
            }, 500);
        }

        function _init() {
            const container = document.getElementById('wb-container');
            if (!container) { setTimeout(_init, 800); return; }
            _ensureLayer();
            _renderAll();
            _injectButton();
            _watchBoard();
            _injectKbdHint();
        }

        _init();

        /* Patch wbSwitchBoard to re-render stickies on board change */
        function _patchSwitch() {
            if (typeof window.wbSwitchBoard !== 'function' || window._p23sbDone) {
                if (!window._p23sbDone) setTimeout(_patchSwitch, 600);
                return;
            }
            window._p23sbDone = true;
            const _orig = window.wbSwitchBoard;
            window.wbSwitchBoard = function(id) {
                _orig(id);
                setTimeout(_renderAll, 80);
            };
        }
        _patchSwitch();
    }

    /* ── 2c. Space+drag to pan (scroll) the canvas viewport ── */
    function _panSupport() {
        let _spaceDown = false;
        let _panning   = false;
        let _panStartX = 0, _panStartY = 0;
        let _scrollStartX = 0, _scrollStartY = 0;

        function _container() {
            return document.getElementById('wb-container');
        }

        window.addEventListener('keydown', e => {
            if (e.code !== 'Space') return;
            const wbView = document.getElementById('view-whiteboard');
            if (!wbView || wbView.classList.contains('hidden')) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
            e.preventDefault();
            _spaceDown = true;
            document.body.classList.add('wb-pan-cursor');
        }, { passive: false });

        window.addEventListener('keyup', e => {
            if (e.code !== 'Space') return;
            _spaceDown = false;
            _panning   = false;
            document.body.classList.remove('wb-pan-cursor', 'wb-panning');
        });

        /* Use pointer events on the canvas element */
        function _attachPan() {
            const canvas = document.getElementById('wb-canvas');
            if (!canvas || canvas.dataset.p23pan) return;
            canvas.dataset.p23pan = '1';

            canvas.addEventListener('pointerdown', e => {
                if (!_spaceDown) return;
                e.stopImmediatePropagation(); /* prevent drawing */
                e.preventDefault();
                _panning = true;
                _panStartX    = e.clientX;
                _panStartY    = e.clientY;
                const c = _container();
                _scrollStartX = c ? c.scrollLeft : 0;
                _scrollStartY = c ? c.scrollTop  : 0;
                document.body.classList.add('wb-panning');
                canvas.setPointerCapture(e.pointerId);
            }, true /* capture phase — runs before the script.js handler */);

            canvas.addEventListener('pointermove', e => {
                if (!_panning) return;
                e.stopImmediatePropagation();
                const c = _container(); if (!c) return;
                c.scrollLeft = _scrollStartX - (e.clientX - _panStartX);
                c.scrollTop  = _scrollStartY - (e.clientY - _panStartY);
            }, true);

            canvas.addEventListener('pointerup', e => {
                if (!_panning) return;
                e.stopImmediatePropagation();
                _panning = false;
                document.body.classList.remove('wb-panning');
            }, true);
        }

        function _waitCanvas() {
            const c = document.getElementById('wb-canvas');
            if (!c) { setTimeout(_waitCanvas, 700); return; }
            _attachPan();
        }
        _waitCanvas();
    }

    /* ── 2d. Keyboard hint bar ──────────────────────────────── */
    function _injectKbdHint() {
        const wbView = document.getElementById('view-whiteboard');
        if (!wbView || wbView.querySelector('#wb-kbd-hint')) return;

        const hint = document.createElement('div');
        hint.id = 'wb-kbd-hint';
        hint.innerHTML = `
            <span class="wb-kbd-key"><kbd>P</kbd> Pen</span>
            <span class="wb-kbd-key"><kbd>E</kbd> Eraser</span>
            <span class="wb-kbd-key"><kbd>S</kbd> Select</span>
            <span class="wb-kbd-key"><kbd>H</kbd> Highlight</span>
            <span class="wb-kbd-key"><kbd>L</kbd> Line</span>
            <span class="wb-kbd-key"><kbd>R</kbd> Rect</span>
            <span class="wb-kbd-key"><kbd>C</kbd> Circle</span>
            <span class="wb-kbd-key"><kbd>T</kbd> Text</span>
            <span class="wb-kbd-key"><kbd>N</kbd> Sticky</span>
            <span class="wb-kbd-key"><kbd>Space</kbd>+<kbd>drag</kbd> Pan</span>
            <span class="wb-kbd-key"><kbd>Ctrl</kbd><kbd>Z</kbd> Undo</span>
            <span class="wb-kbd-key"><kbd>Ctrl</kbd><kbd>Y</kbd> Redo</span>`;

        /* Insert before the mind-map status bar */
        const mmStatus = document.getElementById('mm-status');
        if (mmStatus) wbView.insertBefore(hint, mmStatus);
        else {
            const container = document.getElementById('wb-container');
            if (container) wbView.insertBefore(hint, container);
            else wbView.appendChild(hint);
        }

        /* Toggle hint visibility with a small button in the toolbar */
        const toolbar = document.querySelector('.wb-toolbar-row');
        if (toolbar && !toolbar.querySelector('#wb-kbd-hint-toggle')) {
            const btn = document.createElement('button');
            btn.id = 'wb-kbd-hint-toggle';
            btn.className = 'wb-tool';
            btn.title = 'Keyboard shortcuts';
            btn.innerHTML = '<i class="fa-solid fa-keyboard"></i>';
            btn.addEventListener('click', () => hint.classList.toggle('visible'));
            toolbar.appendChild(btn);
        }
    }

    /* ── Initialise whiteboard enhancements ─────────────────── */
    function _waitWb() {
        const wbView = document.getElementById('view-whiteboard');
        if (!wbView) { setTimeout(_waitWb, 700); return; }
        _kbdShortcuts();
        _stickyNotes();
        _panSupport();

        /* Inject hint bar once the toolbar is present */
        function _waitToolbar() {
            if (!document.querySelector('.wb-toolbar-row')) { setTimeout(_waitToolbar, 400); return; }
            _injectKbdHint();
        }
        _waitToolbar();
    }
    _waitWb();
}

/* ================================================================
   3.  WORKSHEET IMPROVEMENTS
       3a. Image block type
       3b. Code block type
       3c. Autosave status chip in toolbar
   ================================================================ */
function _p23_worksheetImprovements() {

    function _getData()   { return _p23dbG('os_worksheet', { blocks: [], savedValues: {} }); }
    function _saveData(d) { _p23dbS('os_worksheet', d); }
    function _migrate(ws) {
        if (Array.isArray(ws.blocks)) return ws;
        return { blocks: (ws.steps || []).map(s => ({ id: s.id || _p23id(), type: 'text', content: s.content || '' })),
                 savedValues: ws.savedValues || {} };
    }

    /* ── 3a. Image block ─────────────────────────────────────── */
    function _buildImageBlock(block) {
        const el = document.createElement('div');
        el.className = 'p19-ws-block image-block';
        el.dataset.bid = block.id;

        const actions = document.createElement('div');
        actions.className = 'p19-ws-block-actions';

        const del = document.createElement('button');
        del.className = 'p19-ws-block-btn del';
        del.dataset.p19action = 'del-block';
        del.dataset.bid = block.id;
        del.title = 'Delete block';
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        actions.appendChild(del);
        el.appendChild(actions);

        if (block.dataUrl) {
            const img = document.createElement('img');
            img.className = 'p23-ws-img-display';
            img.src = block.dataUrl;
            img.alt = block.caption || 'Image';
            el.appendChild(img);

            const cap = document.createElement('input');
            cap.className = 'p23-ws-img-caption';
            cap.placeholder = 'Caption\u2026';
            cap.value = block.caption || '';
            cap.addEventListener('input', () => {
                const ws = _migrate(_getData());
                const b  = (ws.blocks || []).find(x => x.id === block.id);
                if (b) b.caption = cap.value;
                _saveData(ws);
            });
            el.appendChild(cap);
        } else {
            const area = document.createElement('div');
            area.className = 'p23-ws-img-upload-area';
            area.innerHTML = '<i class="fa-solid fa-image"></i><span>Click to upload image</span>';
            area.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                        /* Compress image via canvas before storing */
                        const img = new Image();
                        img.onload = () => {
                            const MAX = 1200;
                            let w = img.width, h = img.height;
                            if (w > MAX || h > MAX) {
                                const ratio = Math.min(MAX / w, MAX / h);
                                w = Math.round(w * ratio);
                                h = Math.round(h * ratio);
                            }
                            const cvs = document.createElement('canvas');
                            cvs.width = w; cvs.height = h;
                            const cx = cvs.getContext('2d');
                            cx.drawImage(img, 0, 0, w, h);
                            const dataUrl = cvs.toDataURL('image/jpeg', 0.82);
                            const ws = _migrate(_getData());
                            const b  = (ws.blocks || []).find(x => x.id === block.id);
                            if (b) b.dataUrl = dataUrl;
                            _saveData(ws);
                            if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                });
                document.body.appendChild(fileInput);
                fileInput.click();
                fileInput.addEventListener('change', () => document.body.removeChild(fileInput), { once: true });
            });
            el.appendChild(area);
        }

        return el;
    }

    /* ── 3b. Code block ─────────────────────────────────────── */
    function _buildCodeBlock(block) {
        const el = document.createElement('div');
        el.className = 'p19-ws-block code-block';
        el.dataset.bid = block.id;

        const actions = document.createElement('div');
        actions.className = 'p19-ws-block-actions';
        const del = document.createElement('button');
        del.className = 'p19-ws-block-btn del';
        del.dataset.p19action = 'del-block';
        del.dataset.bid = block.id;
        del.title = 'Delete block';
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        actions.appendChild(del);
        el.appendChild(actions);

        const hdr = document.createElement('div');
        hdr.className = 'p23-ws-code-header';

        const langInput = document.createElement('input');
        langInput.className = 'p23-ws-code-lang';
        langInput.placeholder = 'language (e.g. python)';
        langInput.value = block.lang || '';
        langInput.addEventListener('input', () => {
            const ws = _migrate(_getData());
            const b  = (ws.blocks || []).find(x => x.id === block.id);
            if (b) b.lang = langInput.value;
            _saveData(ws);
        });

        hdr.appendChild(langInput);
        el.appendChild(hdr);

        const body = document.createElement('textarea');
        body.className = 'p23-ws-code-body';
        body.placeholder = '// paste or type your code here\u2026';
        body.value = block.code || '';
        body.spellcheck = false;
        body.addEventListener('input', () => {
            const ws = _migrate(_getData());
            const b  = (ws.blocks || []).find(x => x.id === block.id);
            if (b) b.code = body.value;
            _saveData(ws);
        });
        /* Tab key inserts spaces instead of shifting focus */
        body.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = body.selectionStart;
                const end   = body.selectionEnd;
                body.value = body.value.substring(0, start) + '    ' + body.value.substring(end);
                body.selectionStart = body.selectionEnd = start + 4;
            }
        });
        el.appendChild(body);

        return el;
    }

    /* ── Patch p19_wbRender to handle new block types ────────── */
    function _patchRender() {
        if (typeof window.p19_wbRender !== 'function' || window._p23wbRenderDone) {
            if (!window._p23wbRenderDone) setTimeout(_patchRender, 400);
            return;
        }
        window._p23wbRenderDone = true;

        const origRender = window.p19_wbRender;
        window.p19_wbRender = function() {
            origRender();
            const board = document.getElementById('p19-ws-board'); if (!board) return;
            const ws    = _migrate(_p23dbG('os_worksheet', { blocks: [], savedValues: {} }));

            (ws.blocks || []).forEach(block => {
                if (block.type !== 'image' && block.type !== 'code') return;
                if (board.querySelector(`[data-bid="${CSS.escape(block.id)}"]`)) return;

                const idx    = ws.blocks.indexOf(block);
                const allEls = [...board.querySelectorAll('[data-bid]')];
                const el     = block.type === 'image' ? _buildImageBlock(block) : _buildCodeBlock(block);

                if (idx === 0 || allEls.length === 0) {
                    board.insertBefore(el, board.firstChild);
                } else {
                    const prevBlock = ws.blocks[idx - 1];
                    const prevEl    = board.querySelector(`[data-bid="${CSS.escape(prevBlock?.id)}"]`);
                    if (prevEl) prevEl.after(el);
                    else board.insertBefore(el, board.querySelector('#p19-ws-add-btn-fixed') || null);
                }
            });

            /* Update autosave chip */
            _flashSaved();
        };
    }

    /* ── Patch p19_wbOpenPicker to add new block types ────────── */
    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function' || window._p23pickerDone) {
            if (!window._p23pickerDone) setTimeout(_patchPicker, 400);
            return;
        }
        window._p23pickerDone = true;

        const origOpen = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            origOpen();
            setTimeout(() => {
                const types = document.querySelector('.p19-picker-block-types');
                if (!types || types.querySelector('[data-p23img]')) return;

                /* Image block button */
                const imgBtn = document.createElement('button');
                imgBtn.className = 'p19-picker-type-btn';
                imgBtn.dataset.p23img = '1';
                imgBtn.innerHTML = '<i class="fa-solid fa-image"></i>Image';
                imgBtn.addEventListener('click', () => {
                    if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
                    const ws = _migrate(_getData());
                    ws.blocks = ws.blocks || [];
                    ws.blocks.push({ id: _p23id(), type: 'image', dataUrl: null, caption: '' });
                    _saveData(ws);
                    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                });

                /* Code block button */
                const codeBtn = document.createElement('button');
                codeBtn.className = 'p19-picker-type-btn';
                codeBtn.dataset.p23code = '1';
                codeBtn.innerHTML = '<i class="fa-solid fa-code"></i>Code';
                codeBtn.addEventListener('click', () => {
                    if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
                    const ws = _migrate(_getData());
                    ws.blocks = ws.blocks || [];
                    ws.blocks.push({ id: _p23id(), type: 'code', code: '', lang: '' });
                    _saveData(ws);
                    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                });

                types.appendChild(imgBtn);
                types.appendChild(codeBtn);
            }, 60);
        };
    }

    /* ── 3c. Autosave status chip ────────────────────────────── */
    let _saveTimer = null;
    function _flashSaved() {
        const chip = document.getElementById('p23-ws-autosave');
        if (!chip) return;
        chip.className = 'saved';
        chip.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saved';
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
            chip.className = '';
            chip.innerHTML = '<i class="fa-regular fa-clock"></i> Auto-save';
        }, 2200);
    }

    function _injectAutosaveChip() {
        function _try() {
            const toolbar = document.getElementById('p19-ws-toolbar');
            if (!toolbar) { setTimeout(_try, 800); return; }
            if (document.getElementById('p23-ws-autosave')) return;

            const chip = document.createElement('span');
            chip.id = 'p23-ws-autosave';
            chip.innerHTML = '<i class="fa-regular fa-clock"></i> Auto-save';

            /* Ctrl+S also triggers manual save flash */
            window.addEventListener('keydown', e => {
                const wsView = document.getElementById('view-worksheet');
                if (!wsView || wsView.classList.contains('hidden')) return;
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    _flashSaved();
                    _p23toast('Worksheet saved');
                }
            });

            toolbar.appendChild(chip);
        }
        _try();

        /* Re-inject after toolbar re-renders */
        function _watchToolbar() {
            const view = document.getElementById('view-worksheet');
            if (!view) { setTimeout(_watchToolbar, 1000); return; }
            new MutationObserver(() => {
                if (!document.getElementById('p23-ws-autosave')) _try();
            }).observe(view, { childList: true, subtree: true });
        }
        _watchToolbar();
    }

    _patchRender();
    _patchPicker();
    _injectAutosaveChip();
}

/* ================================================================
   4.  QoL IMPROVEMENTS
       4a. Smooth main-scroll reset when switching tabs so content
           from one view does not bleed through another
       4b. Ensure task drag-and-drop handles are visible
   ================================================================ */
function _p23_qol() {

    /* 4a — Scroll top on tab switch so worksheet blocks don't peek */
    function _scrollReset() {
        function _patch() {
            if (typeof window.switchTab !== 'function' || window._p23scrollPatchDone) {
                if (!window._p23scrollPatchDone) setTimeout(_patch, 300);
                return;
            }
            window._p23scrollPatchDone = true;
            const _orig = window.switchTab;
            window.switchTab = function(name) {
                _orig(name);
                const main = document.getElementById('main-scroll');
                if (main) main.scrollTop = 0;
            };
        }
        _patch();
    }

    /* 4b — Make sure drag handles have the right role / aria */
    function _a11yHandles() {
        function _stamp() {
            document.querySelectorAll('.task-drag-handle:not([aria-label])').forEach(h => {
                h.setAttribute('aria-label', 'Drag to reorder task');
                h.setAttribute('role', 'button');
                h.setAttribute('tabindex', '-1');
            });
        }
        const tl = document.getElementById('full-task-list');
        if (tl) {
            _stamp();
            new MutationObserver(_stamp).observe(tl, { childList: true, subtree: true });
        }
    }

    _scrollReset();
    setTimeout(_a11yHandles, 1500);
}

/* ================================================================
   INIT
   ================================================================ */
(function _p23_init() {
    _p23_tabBleedFix();
    _p23_whiteboardEnhancements();
    _p23_worksheetImprovements();
    _p23_qol();

    console.log('[patches23] loaded — tab-bleed fix, whiteboard stickies + kbd shortcuts + pan, worksheet image/code blocks + autosave, QoL');
})();
