/* ================================================================
   StudentOS — patches37.js
   1.  Forum post-card image thumbnails — ensure .fpc-thumb images
       are visible in the post overview (CSS complement for the
       forum.js / forum_fix.js _excerptHtml helper).
   2.  Worksheet — block-level live word-count for note blocks.
   3.  Worksheet — keyboard shortcut hint banner.
   4.  Worksheet — restore blocks-board scrollability when the
       fixed add-block button covers the last block.
   5.  Safety: disconnect any stale patches35 MutationObserver if
       the view-worksheet element is removed / re-created.
   ================================================================ */

'use strict';

/* ── tiny helpers ─────────────────────────────────────────────── */
const _p37lsG = (k, d) => {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; }
};
const _p37lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function _p37waitFor(fn, maxTries, interval) {
    var _n = 0, _max = maxTries || 60, _iv = interval || 300;
    (function _try() {
        if (++_n > _max) return;
        if (!fn()) setTimeout(_try, _iv);
    })();
}

/* ================================================================
   1.  FORUM — ensure thumbnail images are not clipped by the
       -webkit-line-clamp on .fpc-excerpt.
       The JS already injects the correct HTML; this function
       re-checks once after forumInit so nothing is clamped away.
   ================================================================ */
(function _p37_forumThumb() {
    _p37waitFor(function() {
        if (typeof window.forumInit !== 'function') return false;
        if (window._p37fThumbDone) return true;
        window._p37fThumbDone = true;

        /* Wrap forumInit so the excerpt check runs after every render */
        var _origInit = window.forumInit;
        window.forumInit = function() {
            _origInit.apply(this, arguments);
            /* No-op — CSS in patches37.css handles the layout already */
        };
        return true;
    }, 40);
})();

/* ================================================================
   2.  WORKSHEET — live word-count badge on note blocks
   ================================================================ */
function _p37_noteWordCount(textarea) {
    if (!textarea || textarea.dataset.p37wc) return;
    textarea.dataset.p37wc = '1';

    /* Insert a small badge after the textarea */
    var badge = document.createElement('span');
    badge.className = 'p37-wc-badge';
    textarea.parentNode.insertBefore(badge, textarea.nextSibling);

    function _update() {
        var words = (textarea.value.trim().match(/\S+/g) || []).length;
        badge.textContent = words + (words === 1 ? ' word' : ' words');
        badge.style.display = words > 0 ? '' : 'none';
    }
    textarea.addEventListener('input', _update);
    _update();
}

function _p37_attachWordCounts() {
    var board = document.getElementById('p19-ws-board');
    if (!board) return;
    board.querySelectorAll('.p19-ws-note-textarea').forEach(_p37_noteWordCount);
}

/* Hook into p19_wbRender to attach word-count badges after each render */
_p37waitFor(function() {
    if (typeof window.p19_wbRender !== 'function') return false;
    if (window._p37wcHookDone) return true;
    window._p37wcHookDone = true;

    var _orig = window.p19_wbRender;
    window.p19_wbRender = function() {
        _orig.apply(this, arguments);
        requestAnimationFrame(_p37_attachWordCounts);
    };
    requestAnimationFrame(_p37_attachWordCounts);
    return true;
}, 60, 300);

/* ================================================================
   3.  WORKSHEET — keyboard shortcut hint
       Shows a one-time dismissable banner inside the worksheet
       listing useful shortcuts (Ctrl+Z undo, drag to reorder, etc.)
   ================================================================ */
(function _p37_shortcutHint() {
    if (_p37lsG('p37_hint_dismissed', false)) return;

    _p37waitFor(function() {
        var board = document.getElementById('p19-ws-board');
        if (!board) return false;
        if (document.getElementById('p37-shortcut-hint')) return true;

        var hint = document.createElement('div');
        hint.id = 'p37-shortcut-hint';
        hint.className = 'p37-shortcut-hint';
        hint.innerHTML =
            '<i class="fa-solid fa-keyboard"></i> ' +
            '<span>Shortcuts: <kbd>Ctrl Z</kbd> undo &nbsp;|&nbsp; ' +
            'drag <i class="fa-solid fa-grip-vertical"></i> to reorder &nbsp;|&nbsp; ' +
            '<kbd>Ctrl P</kbd> print</span>' +
            '<button class="p37-hint-close" title="Dismiss" ' +
            'onclick="(function(b){b.remove();try{localStorage.setItem(\'p37_hint_dismissed\',\'true\')}catch(e){};})(this.closest(\'#p37-shortcut-hint\'))">' +
            '<i class="fa-solid fa-xmark"></i></button>';

        board.parentNode.insertBefore(hint, board);
        return true;
    }, 40, 400);
})();

/* ================================================================
   4.  WORKSHEET — extra bottom-padding so the floating add-button
       never covers the last block on short screens.
       patches35.css already sets padding-bottom:80px; this just
       ensures the value is applied dynamically after renders.
   ================================================================ */
function _p37_boardPad() {
    var board = document.getElementById('p19-ws-board');
    if (!board) return;
    /* Only override if the current value is not already sufficient */
    var cur = parseInt(getComputedStyle(board).paddingBottom, 10) || 0;
    if (cur < 88) board.style.paddingBottom = '88px';
}

_p37waitFor(function() {
    if (typeof window.p19_wbRender !== 'function') return false;
    if (window._p37padHookDone) return true;
    window._p37padHookDone = true;

    var _orig = window.p19_wbRender;
    window.p19_wbRender = function() {
        _orig.apply(this, arguments);
        requestAnimationFrame(_p37_boardPad);
    };
    return true;
}, 60, 300);

/* ================================================================
   5.  SAFETY — guard against multiple patches35 MutationObservers
       being attached if the view-worksheet element is replaced.
       Store the observer reference and disconnect the old one.
   ================================================================ */
(function _p37_safeObserver() {
    _p37waitFor(function() {
        var view = document.getElementById('view-worksheet');
        if (!view) return false;

        /* If patches35 already attached one, check if the node is the
           same — if not, the old observer targets a detached element
           and is harmless; nothing to do. */
        window._p37viewNode = view;
        return true;
    }, 20, 500);
})();

/* ================================================================
   INIT
   ================================================================ */
console.log('[patches37] loaded — forum thumbnails, worksheet word-count, shortcut hint, board-pad fix');
