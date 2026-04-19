/* ================================================================
   StudentOS — patches57.js
   Definitive Whiteboard Mind-Map Overhaul.

   Root cause of all previous mindmap glitches:
     script.js is an ES-module, so its top-level `var` declarations
     (wbMindMapNodes, wbMindMapEdges, wbMindMapSelected, wbMmRender,
     wbMmSave, wbMmDeleteNode) were never accessible via `window.*`.
     Every patch since patches32 that waited for window.wbMmRender
     therefore polled forever and never activated.

   Fix applied in script.js alongside this file:
     • window.wbMmRender / wbMmSave / wbMmDeleteNode now exported.
     • Object.defineProperty getters+setters bridge window.*
       to the module-scoped variables for wbMindMapNodes,
       wbMindMapEdges, and wbMindMapSelected.
     • Internal wbMmRender() calls in wbMmLoad, wbSwitchBoard,
       confirmMmNode and wbMmDeleteNode now dispatch through
       (window.wbMmRender || wbMmRender) so patches can intercept.

   This patch (57) then installs the definitive renderer, with:
     1.  Left-click drag-and-drop — 5 px movement threshold
         distinguishes drag from click; _didDrag suppresses the
         subsequent click event after a real drag.
     2.  Double-click to edit OR delete — opens the patches32 edit
         modal (window._p32openEditNode) which has both Edit and
         Delete actions; falls back to an inline prompt if that
         modal is not available.
     3.  Right-click context menu (patches32's window._p32showMmCtx).
     4.  SVG-background single-click adds a node, suppressed when
         the click is the tail of a node drag.
   ================================================================ */

(function _p57_init() {
    'use strict';

    /* ── tiny wait helper ─────────────────────────────────────── */
    function _wait(fn, interval, maxWait) {
        interval = interval || 100;
        maxWait  = maxWait  || 16000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* Module-level flag: did ANY node drag happen in the last
       pointer cycle?  Guards the SVG-background click handler. */
    var _anyDrag = false;

    /* ================================================================
       DEFINITIVE wbMmRender
       Completely replaces window.wbMmRender.  All subsequent renders
       (triggered by node interactions or external code) go through
       this function, which uses window.wbMindMapNodes etc. — now
       live-synced to the module's own variables via getters/setters
       installed in script.js.
    ================================================================ */

    function _render() {
        var svg = document.getElementById('wb-mindmap-svg');
        if (!svg) return;

        /* Clear the canvas completely */
        svg.innerHTML = '';

        /* Size the SVG overlay to fit its container */
        var con = document.getElementById('wb-container');
        if (con && con.clientWidth > 0 && con.clientHeight > 0) {
            svg.setAttribute('width',  con.clientWidth);
            svg.setAttribute('height', con.clientHeight);
        }

        var nodes      = window.wbMindMapNodes  || [];
        var edges      = window.wbMindMapEdges  || [];
        var selectedId = window.wbMindMapSelected;

        /* ── Draw edges ─────────────────────────────────────── */
        edges.forEach(function(edge) {
            var from = nodes.find(function(n) { return n.id === edge.from; });
            var to   = nodes.find(function(n) { return n.id === edge.to;   });
            if (!from || !to) return;

            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
            line.setAttribute('stroke',       'rgba(255,255,255,0.3)');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        });

        /* ── Draw nodes ─────────────────────────────────────── */
        nodes.forEach(function(node) {
            var isSelected = (node.id === selectedId);

            var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform',
                'translate(' + node.x + ',' + node.y + ')');
            g.style.cursor = 'pointer';

            var w = Math.max(80, (node.text || '').length * 8 + 24);

            var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x',            -(w / 2));
            rect.setAttribute('y',            '-18');
            rect.setAttribute('width',         w);
            rect.setAttribute('height',       '36');
            rect.setAttribute('rx',           '10');
            rect.setAttribute('fill',          node.color || '#3b82f6');
            rect.setAttribute('stroke',        isSelected ? '#fff' : 'none');
            rect.setAttribute('stroke-width',  isSelected ? '2'   : '0');

            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('text-anchor',       'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill',              '#fff');
            text.setAttribute('font-size',         '13');
            text.setAttribute('font-family',       'Inter, sans-serif');
            text.textContent = node.text || '';

            g.appendChild(rect);
            g.appendChild(text);

            /* ── Per-node interaction (IIFE for closure) ─────── */
            (function(n) {
                var _isDown  = false;
                var _didDrag = false;  /* set only after ≥5 px of movement */
                var _dsx = 0, _dsy = 0;
                var _nsx = 0, _nsy = 0;

                /* ── Drag ──────────────────────────────────── */
                g.addEventListener('pointerdown', function(e) {
                    if (e.button !== 0) return;   /* left button only */
                    e.stopPropagation();
                    _isDown  = true;
                    _didDrag = false;
                    _dsx = e.clientX; _dsy = e.clientY;
                    _nsx = n.x;       _nsy = n.y;
                    g.setPointerCapture(e.pointerId);
                });

                g.addEventListener('pointermove', function(e) {
                    if (!_isDown) return;
                    var dx = e.clientX - _dsx;
                    var dy = e.clientY - _dsy;
                    /* Only count as drag after crossing the 5 px threshold;
                       this prevents micro-tremors from moving nodes. */
                    if (!_didDrag &&
                            (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                        _didDrag = true;
                        _anyDrag = true;
                    }
                    if (_didDrag) {
                        n.x = _nsx + dx;
                        n.y = _nsy + dy;
                        _render();
                    }
                });

                g.addEventListener('pointerup', function() {
                    if (!_isDown) return;
                    _isDown = false;
                    if (_didDrag &&
                            typeof window.wbMmSave === 'function') {
                        window.wbMmSave();
                    }
                    /* _didDrag intentionally NOT reset here —
                       the click event fires next and reads it. */
                });

                /* ── Single click: select / deselect ─────────── */
                g.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (_didDrag) {
                        _didDrag = false;   /* reset for next interaction */
                        return;
                    }
                    window.wbMindMapSelected =
                        (window.wbMindMapSelected === n.id) ? null : n.id;
                    _render();
                });

                /* ── Double-click: edit / delete ──────────────── */
                g.addEventListener('dblclick', function(e) {
                    e.stopPropagation();
                    if (typeof window._p32openEditNode === 'function') {
                        /* patches32 modal — has Edit label, change color,
                           and a Delete button in one place */
                        window._p32openEditNode(n.id);
                    } else {
                        /* Fallback: simple inline prompt */
                        var newText = window.prompt('Edit node label:', n.text);
                        if (newText !== null && newText.trim()) {
                            n.text = newText.trim();
                            if (typeof window.wbMmSave === 'function') {
                                window.wbMmSave();
                            }
                            _render();
                        }
                    }
                });

                /* ── Right-click: context menu ────────────────── */
                g.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window._p32showMmCtx === 'function') {
                        window._p32showMmCtx(n.id, e.clientX, e.clientY);
                    }
                });
            })(node);

            svg.appendChild(g);
        });

        /* ── SVG background: single-click adds a new node ────── */
        /* We use onclick (not addEventListener) so each render
           overwrites the previous handler — no accumulation. */
        svg.onclick = function(e) {
            if (e.target !== svg) return;
            /* Suppress the click that follows a drag-release */
            if (_anyDrag) { _anyDrag = false; return; }
            var r  = svg.getBoundingClientRect();
            var cx = e.clientX - r.left;
            var cy = e.clientY - r.top;
            if (typeof window.wbMmAddNode === 'function') {
                window.wbMmAddNode(cx, cy);
            }
        };
    }

    /* ================================================================
       INSTALL THE RENDERER
       Wait for window.wbMmRender to exist (now guaranteed by the
       script.js fix) then replace it with our definitive version.
    ================================================================ */

    function _installRenderer() {
        if (typeof window.wbMmRender !== 'function') return false;
        if (window._p57rendererInstalled) return true;
        window._p57rendererInstalled = true;
        window.wbMmRender = _render;
        return true;
    }

    _wait(_installRenderer, 120, 16000);

    /* ================================================================
       RE-RENDER AFTER EVERY STATE-CHANGING EVENT

       wbMmLoad, wbSwitchBoard, confirmMmNode, and wbMmDeleteNode
       all now call (window.wbMmRender || wbMmRender)() via the fix
       in script.js, so our _render is invoked automatically.

       The hooks below are belt-and-braces for older load paths and
       to ensure the renderer is re-installed if ever overwritten.
    ================================================================ */

    /* Hook wbToggleMindMap — ensures our render is active on toggle */
    _wait(function() {
        if (typeof window.wbToggleMindMap !== 'function') return false;
        if (window._p57toggleHooked) return true;
        window._p57toggleHooked = true;

        var _orig = window.wbToggleMindMap;
        window.wbToggleMindMap = function() {
            _orig.apply(this, arguments);
            /* Re-install our renderer in case another patch overwrote it */
            window._p57rendererInstalled = false;
            _installRenderer();
            /* If the mind-map was just turned ON, force a clean render */
            if (window.wbMindMapMode) {
                setTimeout(_render, 30);
            }
        };
        return true;
    }, 120, 16000);

    /* Hook wbSwitchBoard — ensures our render fires on board switch */
    _wait(function() {
        if (typeof window.wbSwitchBoard !== 'function') return false;
        if (window._p57switchHooked) return true;
        window._p57switchHooked = true;

        var _orig = window.wbSwitchBoard;
        window.wbSwitchBoard = function() {
            _orig.apply(this, arguments);
            if (window.wbMindMapMode) {
                setTimeout(_render, 30);
            }
        };
        return true;
    }, 120, 16000);

    /* Hook confirmMmNode — re-render with our handler after add */
    _wait(function() {
        if (typeof window.confirmMmNode !== 'function') return false;
        if (window._p57confirmHooked) return true;
        window._p57confirmHooked = true;

        var _orig = window.confirmMmNode;
        window.confirmMmNode = function() {
            _orig.apply(this, arguments);
            setTimeout(_render, 30);
        };
        return true;
    }, 120, 16000);

    console.log('[patches57] loaded — definitive mindmap renderer installed');
}());
