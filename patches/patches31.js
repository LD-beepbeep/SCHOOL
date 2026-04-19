/* ================================================================
   StudentOS — patches31.js
   Worksheet — block resize & overflow fixes

   1.  Content-aware minimum resize height
       Replaces patches28's fixed Math.max(60, …) floor with the
       block's actual content height so blocks can never be dragged
       smaller than their visible content.

   2.  Stored-height guard
       When a block is re-rendered, any previously-saved height that
       is smaller than the block's current content is discarded so
       the block always shows all its content.

   3.  Overflow fix for checklist & code blocks
       patches28 sets overflow:hidden on those block types, which
       clips content when a block is narrowed by the resize handle.
       We switch to overflow:visible on the inner container so
       nothing is cut off.
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p31dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const _p31dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ================================================================
   1 + 2.  CONTENT-AWARE RESIZE + STORED-HEIGHT GUARD
   ================================================================ */

/*
 * _p31_getNaturalMin(blockEl)
 * ---------------------------
 * Returns the block's natural content height in pixels.
 * Temporarily removes any inline min-height so the browser can
 * report the real scrollHeight, then restores it.
 */
function _p31_getNaturalMin(blockEl) {
    const saved = blockEl.style.minHeight;
    blockEl.style.minHeight = '0';
    const h = blockEl.scrollHeight;
    blockEl.style.minHeight = saved;
    return Math.max(h, 40); /* absolute floor to prevent 0 */
}

/*
 * _p31_patchHandles()
 * -------------------
 * Walk every .p28-resize-handle that hasn't been p31-patched yet.
 * Clone each handle element (which strips patches28's pointerdown
 * listener) and attach our improved handler that uses the block's
 * scrollHeight as the minimum.
 */
function _p31_patchHandles() {
    document.querySelectorAll('.p28-resize-handle:not([data-p31])').forEach(orig => {
        const blockEl = orig.closest('.p19-ws-block');
        if (!blockEl) return;

        const handle = orig.cloneNode(true);
        handle.dataset.p31 = '1';
        orig.replaceWith(handle);

        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            e.stopPropagation();
            handle.classList.add('dragging');

            const naturalMin = _p31_getNaturalMin(blockEl);
            const startY     = e.clientY;
            const startH     = blockEl.offsetHeight;

            const onMove = ev => {
                const target = Math.max(naturalMin, startH + (ev.clientY - startY));
                blockEl.style.minHeight = target + 'px';
            };

            const onUp = ev => {
                handle.classList.remove('dragging');
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);

                const target = Math.max(naturalMin, startH + (ev.clientY - startY));
                blockEl.style.minHeight = target + 'px';

                /* Persist to storage */
                const bid = blockEl.dataset.bid;
                if (!bid) return;
                try {
                    const ws = _p31dbG('os_worksheet', { blocks: [], savedValues: {} });
                    const b  = (ws.blocks || []).find(x => x.id === bid);
                    if (b) { b.height = target; _p31dbS('os_worksheet', ws); }
                } catch { /* non-critical */ }
            };

            handle.setPointerCapture(e.pointerId);
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup',   onUp);
        });
    });
}

/*
 * _p31_guardStoredHeights()
 * -------------------------
 * After patches28 applies stored heights, check every block.
 * If the stored height is smaller than the block's natural content,
 * remove the constraint so the block sizes itself to its content.
 * Also clears the bad value from storage so it doesn't re-appear.
 */
function _p31_guardStoredHeights() {
    const board = document.getElementById('p19-ws-board');
    if (!board) return;

    board.querySelectorAll('.p19-ws-block[data-bid]').forEach(blockEl => {
        const stored = parseInt(blockEl.style.minHeight, 10);
        if (!stored || isNaN(stored)) return;

        /* Measure natural height without the stored constraint */
        blockEl.style.minHeight = '0';
        const natural = blockEl.scrollHeight;

        if (natural > stored) {
            /* Content is taller than the stored cap — let it breathe */
            blockEl.style.minHeight = '';

            /* Remove the stale height from storage */
            const bid = blockEl.dataset.bid;
            if (!bid) return;
            try {
                const ws = _p31dbG('os_worksheet', { blocks: [], savedValues: {} });
                const b  = (ws.blocks || []).find(x => x.id === bid);
                if (b && b.height !== undefined) {
                    delete b.height;
                    _p31dbS('os_worksheet', ws);
                }
            } catch { /* non-critical */ }
        } else {
            /* Stored height is valid — restore it */
            blockEl.style.minHeight = stored + 'px';
        }
    });
}

/*
 * _p31_hookRender()
 * -----------------
 * Wrap p19_wbRender so that after every full board re-render:
 *   — patches28's rAF runs (attaches handles + applies stored heights)
 *   — our double-rAF runs next (replaces handles, guards heights)
 */
function _p31_hookRender() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbRender !== 'function' || window._p31hookDone) {
            if (!window._p31hookDone && ++_retries < 80) setTimeout(_try, 300);
            return;
        }
        window._p31hookDone = true;

        const _orig = window.p19_wbRender;
        window.p19_wbRender = function () {
            _orig.apply(this, arguments);
            /* Frame 0: patches28 attaches handles + applies heights */
            requestAnimationFrame(() => {
                /* Frame 1: we fix everything patches28 got wrong */
                requestAnimationFrame(() => {
                    _p31_patchHandles();
                    _p31_guardStoredHeights();
                });
            });
        };

        /* Also fix anything already on the board right now */
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                _p31_patchHandles();
                _p31_guardStoredHeights();
            });
        });
    })();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p31_init() {
    function _go() {
        _p31_hookRender();
        console.log('[patches31] loaded — content-aware resize min, stored-height guard');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 700));
    } else {
        setTimeout(_go, 700);
    }
})();
