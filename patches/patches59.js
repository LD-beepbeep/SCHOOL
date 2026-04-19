/* ================================================================
   StudentOS — patches59.js
   1.  Flashcard card list — prevent duplicate star buttons by
       removing the redundant .p58-card-star-btn buttons that
       patches58 injects, since patches56 already provides a
       working star-toggle button (.p56-star-btn) on each row.
   2.  Whiteboard settings section — belt-and-braces removal to
       ensure the section never shows, even on repeated modal opens.
   ================================================================ */

(function _p59_init() {
    'use strict';

    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 15000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  FLASHCARD CARD LIST — DEDUPLICATE STAR BUTTONS
           patches58 injects a second star button (.p58-card-star-btn)
           on every card row in addition to patches56's .p56-star-btn.
           Wrap renderCardList (outermost) to strip the p58 buttons
           so each row ends up with exactly one star toggle.
       ================================================================ */

    _wait(function() {
        if (typeof window.renderCardList !== 'function') return false;
        if (window._p59cardListHooked) return true;
        window._p59cardListHooked = true;

        var _orig = window.renderCardList;
        window.renderCardList = function() {
            _orig.apply(this, arguments);
            /* Remove the duplicate buttons added by patches58 */
            document.querySelectorAll('.p58-card-star-btn').forEach(function(btn) {
                btn.remove();
            });
        };
        return true;
    }, 200, 15000);

    /* ================================================================
       2.  WHITEBOARD SETTINGS SECTION — AGGRESSIVE REMOVAL
           Runs immediately on load and every time the settings modal
           opens, at multiple delays, to ensure no whiteboard section
           survives regardless of which patch created it.
       ================================================================ */

    function _nukeWbSection() {
        ['p48-whiteboard-section', 'p53-wb-appearance-section'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        /* Also remove the sub-label + siblings if patches48 didn't extract them */
        var widgetSec = document.getElementById('p46-widgets-section');
        if (widgetSec) {
            var subLabel = widgetSec.querySelector('.p46-sub-label');
            if (subLabel) {
                var toRemove = [];
                var node = subLabel;
                while (node) { toRemove.push(node); node = node.nextElementSibling; }
                toRemove.forEach(function(el) { el.remove(); });
            }
        }
    }

    /* Run once as soon as the widgets section has been built */
    _wait(function() {
        if (!document.getElementById('p46-widgets-section')) return false;
        _nukeWbSection();
        return true;
    }, 200, 15000);

    /* Re-run on every settings modal open at 200 ms, 500 ms, 1000 ms */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p59modalHooked) return true;
        window._p59modalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_nukeWbSection, 200);
                setTimeout(_nukeWbSection, 500);
                setTimeout(_nukeWbSection, 1000);
            }
        };
        return true;
    });

    console.log('[patches59] loaded — deduplicated card-star buttons, whiteboard section nuked');
}());
