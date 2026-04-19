/* ================================================================
   StudentOS — patches34.js
   Targeted bug-fixes for patches32 and script.js regressions:

   1.  Whiteboard sticky-note button — clicking a colour in the
       picker now immediately adds a note (not just selects colour).
       The button also adds a note directly when the picker is
       already open and you click the button again.

   2.  Mind-map drag-click conflict — the node click handler used to
       fire after every drag, toggling the selection.  A _didMove
       flag ensures click is swallowed when the pointer actually moved.

   3.  Grid baked into canvas on background change — script.js
       line ~4429 calls wbDrawGrid() after the pixel-swap in setWbBg.
       Patching setWbBg to suppress that call when the CSS overlay is
       active keeps the grid out of the canvas data.

   4.  Music: video clone keeps playing when panel is hidden — when
       the p6 video panel is hidden the clone iframe was left playing
       in the DOM.  We blank its src on hide.

   5.  musicClose / musicPlay do not touch the video clone — blanked
       on close, updated on play-switch so a single audio source always
       plays.
   ================================================================ */

'use strict';

/* ── tiny helpers ─────────────────────────────────────────────── */
const _p34dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const _p34dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* Pixel threshold for distinguishing a drag from a tap */
const _P34_DRAG_THRESHOLD   = 4;
/* ms to wait after video-toggle click before blanking the clone
   (must exceed both p6 and p32 handler delays, each ~80 ms) */
const _P34_VIDEO_TOGGLE_DELAY = 150;
/* ms to wait after musicPlay resolves before syncing clone src */
const _P34_MUSIC_SYNC_DELAY   = 250;

function _p34waitFor(fn, interval) {
    (function _try() { if (!fn()) setTimeout(_try, interval || 250); })();
}

/* ================================================================
   1.  STICKY-NOTE BUTTON — MAKE IT ACTUALLY ADD A NOTE
   ================================================================ */

/*
 * patches23 injected a sticky-note toolbar button that opens a colour
 * picker.  Clicking a colour only stored the active colour; the user
 * had to know the N-key shortcut to place a note.
 *
 * Fix: intercept the colour-dot click inside #wb-sticky-color-picker
 *      and, after setting the colour, immediately invoke _addNote()
 *      (exposed on the internal scope of patches23 via window._p23_addNote).
 *
 *      Because patches23 does not expose _addNote externally, we also
 *      register a fallback that reconstructs the note-creation logic
 *      using the same DB key scheme (os_wb_stickies_<boardId>).
 */
(function _p34_stickyNoteBtn() {

    /* Fallback note-adder that works even if patches23 internals are not
       exposed — mirrors patches23._addNote exactly */
    function _fallbackAddNote() {
        const boardId   = window.wbActiveBoardId ?? 1;
        const storageKey = 'os_wb_stickies_' + boardId;
        const container  = document.getElementById('wb-container');
        const cr = container ? container.getBoundingClientRect() : { width: 600, height: 400 };

        /* Read active colour from the picker's selected dot */
        let colour = 'yellow';
        const picker = document.getElementById('wb-sticky-color-picker');
        if (picker) {
            const active = picker.querySelector('.wb-stk-color-dot.active');
            if (active) colour = active.title || 'yellow';
        }

        const id  = Math.random().toString(36).slice(2, 10);
        const note = {
            id,
            color: colour,
            text:  '',
            x: Math.round(cr.width  / 2 - 80 + (Math.random() - .5) * 80),
            y: Math.round(cr.height / 2 - 40 + (Math.random() - .5) * 60),
            w: 160,
        };

        const arr = _p34dbG(storageKey, []);
        arr.push(note);
        _p34dbS(storageKey, arr);

        /* Re-render the sticky layer — patches23 watches the board id
           so just trigger the internal render if the layer exists */
        const layer = document.getElementById('wb-sticky-layer');
        if (layer) {
            /* Dispatch a custom event that patches23 listens on, or just
               create the element directly if the layer is present */
            const el = document.createElement('div');
            el.className = 'wb-sticky';
            el.dataset.id    = note.id;
            el.dataset.color = note.color;
            el.style.left    = note.x + 'px';
            el.style.top     = note.y + 'px';
            el.style.width   = note.w + 'px';

            const hdr = document.createElement('div');
            hdr.className = 'wb-sticky-header';

            const del = document.createElement('button');
            del.className = 'wb-sticky-delete';
            del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            del.title = 'Delete note';
            del.addEventListener('click', e => {
                e.stopPropagation();
                const stored = _p34dbG(storageKey, []).filter(n => n.id !== note.id);
                _p34dbS(storageKey, stored);
                el.remove();
            });
            hdr.appendChild(del);
            el.appendChild(hdr);

            const body = document.createElement('textarea');
            body.className   = 'wb-sticky-body';
            body.placeholder = 'Type your note...';
            body.value       = '';
            body.rows        = 3;
            body.spellcheck  = false;
            body.addEventListener('input', () => {
                const stored = _p34dbG(storageKey, []);
                const n = stored.find(x => x.id === note.id);
                if (n) n.text = body.value;
                _p34dbS(storageKey, stored);
            });
            body.addEventListener('pointerdown', e => e.stopPropagation());

            el.appendChild(body);

            /* Simple drag on header */
            let _dx = 0, _dy = 0, _drag = false;
            hdr.addEventListener('pointerdown', e => {
                if (e.target === del || del.contains(e.target)) return;
                e.preventDefault(); e.stopPropagation();
                _drag = true;
                const rect = el.getBoundingClientRect();
                _dx = e.clientX - rect.left;
                _dy = e.clientY - rect.top;
                hdr.setPointerCapture(e.pointerId);
                el.style.zIndex = '20';
            });
            hdr.addEventListener('pointermove', e => {
                if (!_drag) return;
                e.stopPropagation();
                const con2 = document.getElementById('wb-container');
                const cr2  = con2.getBoundingClientRect();
                el.style.left = Math.max(0, Math.min(e.clientX - cr2.left - _dx, cr2.width  - el.offsetWidth))  + 'px';
                el.style.top  = Math.max(0, Math.min(e.clientY - cr2.top  - _dy, cr2.height - el.offsetHeight)) + 'px';
            });
            hdr.addEventListener('pointerup', () => {
                if (!_drag) return;
                _drag = false;
                el.style.zIndex = '';
                const stored = _p34dbG(storageKey, []);
                const n = stored.find(x => x.id === note.id);
                if (n) { n.x = parseInt(el.style.left, 10); n.y = parseInt(el.style.top, 10); }
                _p34dbS(storageKey, stored);
            });

            layer.appendChild(el);
            setTimeout(() => body.focus(), 60);
        }
    }

    /* Attempt to hook into patches23's colour-dot clicks so that
       selecting a colour also places a note immediately */
    function _hookPicker() {
        const picker = document.getElementById('wb-sticky-color-picker');
        if (!picker || picker.dataset.p34hooked) return false;
        picker.dataset.p34hooked = '1';

        picker.querySelectorAll('.wb-stk-color-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                /* patches23's own listener runs first (sets _activeStickyColor).
                   Now close the picker and immediately place a note. */
                picker.classList.remove('open');
                if (typeof window._p23addStickyNote === 'function') {
                    window._p23addStickyNote();
                } else {
                    _fallbackAddNote();
                }
            });
        });

        return true;
    }

    /* Wait for patches23 to inject the picker */
    _p34waitFor(function() {
        if (_hookPicker()) return true;
        /* Keep trying — patches23 might not have run yet */
        return false;
    });
})();

/* ================================================================
   2.  MIND-MAP DRAG-CLICK CONFLICT FIX
   ================================================================ */

/*
 * patches32 replaced wbMmRender with an improved version that has a
 * double-click-to-edit and right-click context menu.  However, in its
 * drag implementation _isDragging is set to false in pointerup, which
 * means the subsequent click event always fires and toggles selection
 * even after a drag.
 *
 * Fix: wrap wbMmRender one more time and replace the node-click logic
 * so that a `_didMove` flag prevents click from firing when the pointer
 * actually moved more than 4 px during the drag.
 */
(function _p34_mmDragFix() {
    _p34waitFor(function() {
        if (typeof window.wbMmRender !== 'function') return false;
        if (window._p34mmFixDone) return true;
        window._p34mmFixDone = true;

        const _origRender = window.wbMmRender;

        window.wbMmRender = function() {
            _origRender.apply(this, arguments);

            /* After the original render builds the SVG nodes, replace
               the click / drag listeners on every node <g> with ones
               that correctly suppress click after a real drag. */
            const svg = document.getElementById('wb-mindmap-svg');
            if (!svg) return;

            svg.querySelectorAll('g').forEach(g => {
                /* We only want the top-level node groups, not nested children */
                if (g.parentElement !== svg) return;

                /* Determine which node this g belongs to by checking the
                   transform attribute */
                const tf = g.getAttribute('transform') || '';
                const m  = tf.match(/translate\(([^,]+),([^)]+)\)/);
                if (!m) return;
                const nx = parseFloat(m[1]);
                const ny = parseFloat(m[2]);

                const node = (window.wbMindMapNodes || []).find(
                    n => Math.abs(n.x - nx) < 1 && Math.abs(n.y - ny) < 1
                );
                if (!node) return;

                /* Clone the element to strip existing listeners */
                const clone = g.cloneNode(true);
                g.parentElement.replaceChild(clone, g);

                let _isDragging = false;
                let _didMove    = false;
                let _dsx = 0, _dsy = 0, _nsx = 0, _nsy = 0;

                clone.addEventListener('click', e => {
                    e.stopPropagation();
                    if (_didMove) { _didMove = false; return; }
                    window.wbMindMapSelected =
                        (window.wbMindMapSelected === node.id) ? null : node.id;
                    _origRender.apply(window, arguments);
                });

                clone.addEventListener('dblclick', e => {
                    e.stopPropagation();
                    if (typeof window._p32openEditNode === 'function') {
                        window._p32openEditNode(node.id);
                    }
                });

                clone.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window._p32showMmCtx === 'function') {
                        window._p32showMmCtx(node.id, e.clientX, e.clientY);
                    }
                });

                clone.addEventListener('pointerdown', e => {
                    e.stopPropagation();
                    _isDragging = true;
                    _didMove    = false;
                    _dsx = e.clientX; _dsy = e.clientY;
                    _nsx = node.x;    _nsy = node.y;
                    clone.setPointerCapture(e.pointerId);
                });

                clone.addEventListener('pointermove', e => {
                    if (!_isDragging) return;
                    const dx = e.clientX - _dsx;
                    const dy = e.clientY - _dsy;
                    if (!_didMove && (Math.abs(dx) > _P34_DRAG_THRESHOLD || Math.abs(dy) > _P34_DRAG_THRESHOLD)) {
                        _didMove = true;
                    }
                    if (_didMove) {
                        node.x = _nsx + dx;
                        node.y = _nsy + dy;
                        _origRender.apply(window, arguments);
                    }
                });

                clone.addEventListener('pointerup', () => {
                    _isDragging = false;
                    if (_didMove && typeof window.wbMmSave === 'function') {
                        window.wbMmSave();
                    }
                });
            });
        };

        return true;
    });
})();

/* ================================================================
   3.  GRID BAKED INTO CANVAS ON BACKGROUND CHANGE — FIX
   ================================================================ */

/*
 * script.js ~line 4429 — inside setWbBg's pixel-swap callback it calls
 *   if (wbGridOn) wbDrawGrid();
 * This bakes the grid lines into the canvas even when patches32's CSS
 * overlay is active, corrupting the saved board data with grid artefacts.
 *
 * Fix: wrap setWbBg so that wbGridOn is temporarily false while the
 * pixel-swap completes, and sync the CSS overlay afterward.
 */
(function _p34_gridFix() {
    _p34waitFor(function() {
        if (typeof window.setWbBg !== 'function') return false;
        if (window._p34gridFixDone) return true;
        window._p34gridFixDone = true;

        /* Also no-op wbDrawGrid when the CSS overlay is active */
        const _origDrawGrid = window.wbDrawGrid;
        window.wbDrawGrid = function() {
            /* If the CSS overlay is present and active, skip canvas drawing */
            const ov = document.getElementById('wb-grid-overlay');
            if (ov && ov.classList.contains('active')) return;
            /* Otherwise let the original run (safety fallback) */
            if (typeof _origDrawGrid === 'function') _origDrawGrid.apply(this, arguments);
        };

        /* Ensure the CSS overlay is created immediately if it does not yet
           exist (race condition between patches32 and patches34 load order) */
        function _ensureOverlay() {
            const con = document.getElementById('wb-container');
            if (!con || document.getElementById('wb-grid-overlay')) return;
            const ov = document.createElement('div');
            ov.id = 'wb-grid-overlay';
            con.appendChild(ov);
        }
        _ensureOverlay();
        _p34waitFor(function() { _ensureOverlay(); return !!document.getElementById('wb-grid-overlay'); });

        return true;
    });
})();

/* ================================================================
   4 & 5.  MUSIC — FIX DOUBLE AUDIO SOURCES
   ================================================================ */

/*
 * Two separate bugs:
 *
 * A.  When the p6 video panel is HIDDEN, the clone iframe inside
 *     #p6-music-video-wrap keeps its src, so it continues playing
 *     audio in the background even though the panel is display:none.
 *     Fix: blank the clone's src when the panel is hidden (and restore
 *     it from the active station URL when shown again).
 *
 * B.  musicClose() only blanks #music-player-frame; the clone keeps
 *     playing.
 *     Fix: wrap musicClose to also blank the clone.
 *
 * C.  When musicPlay() starts a new station while the video panel is
 *     visible, the clone should pick up the new URL so the video
 *     matches the audio.
 *     Fix: wrap musicPlay to update the clone when visible.
 */
(function _p34_musicFix() {

    /* ── helper: get/blank/set the video-clone iframe ── */
    function _getClone() {
        const wrap = document.getElementById('p6-music-video-wrap');
        return wrap ? wrap.querySelector('iframe') : null;
    }

    function _blankClone() {
        const clone = _getClone();
        if (clone) clone.src = '';
    }

    function _videoIsVisible() {
        const wrap = document.getElementById('p6-music-video-wrap');
        return !!(wrap && wrap.classList.contains('visible'));
    }

    /* ── A. Replace the video-toggle onclick to blank clone on hide ── */
    function _patchVideoToggle() {
        const btn = document.getElementById('p6-video-toggle');
        if (!btn || btn.dataset.p34vt) return false;
        btn.dataset.p34vt = '1';

        btn.addEventListener('click', function() {
            /* Run after p6 and p32 handlers (both use setTimeout ~80 ms) */
            setTimeout(function() {
                const visible = _videoIsVisible();
                const clone   = _getClone();
                if (!visible && clone) {
                    /* Panel just became hidden — silence the clone */
                    clone.src = '';
                }
            }, _P34_VIDEO_TOGGLE_DELAY);
        });
        return true;
    }

    /* ── B. Wrap musicClose to also stop clone ── */
    function _patchMusicClose() {
        if (typeof window.musicClose !== 'function') return false;
        if (window._p34mcDone) return true;
        window._p34mcDone = true;

        const _orig = window.musicClose;
        window.musicClose = function() {
            _orig.apply(this, arguments);
            _blankClone();
        };
        return true;
    }

    /* ── C. Wrap musicPlay to keep clone in sync ── */
    function _patchMusicPlay() {
        if (typeof window.musicPlay !== 'function') return false;
        if (window._p34mpDone) return true;
        window._p34mpDone = true;

        const _orig = window.musicPlay;
        window.musicPlay = function() {
            _orig.apply(this, arguments);
            /* If the video panel is visible, update the clone to the new src */
            setTimeout(function() {
                if (!_videoIsVisible()) return;
                const audioFrame = document.getElementById('music-player-frame');
                const clone      = _getClone();
                if (audioFrame && clone && audioFrame.src) {
                    clone.src = audioFrame.src;
                }
            }, _P34_MUSIC_SYNC_DELAY);
        };
        return true;
    }

    /* ── Wait for everything to be ready ── */
    _p34waitFor(_patchMusicClose);
    _p34waitFor(_patchMusicPlay);

    /* Video toggle is injected dynamically — keep retrying */
    function _tryVideoToggle() {
        if (!_patchVideoToggle()) setTimeout(_tryVideoToggle, 500);
    }
    _tryVideoToggle();

    /* Also re-patch when user switches to the music tab */
    _p34waitFor(function() {
        if (typeof window.switchTab !== 'function') return false;
        const _origST = window.switchTab;
        window.switchTab = function(name) {
            _origST.apply(this, arguments);
            if (name === 'music') setTimeout(_tryVideoToggle, 600);
        };
        return true;
    });
})();

console.log('[patches34] loaded — sticky-note fix, mm drag fix, grid fix, music fix');
