/* ================================================================
   StudentOS — patches60.js
   Whiteboard settings section — aggressive DOM removal.
   Runs on page load and every time the settings modal opens,
   removing every whiteboard-related node regardless of which
   earlier patch created it.
   ================================================================ */

(function _p60_init() {
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
       WHITEBOARD SETTINGS — REMOVE ALL NODES
       Targets:
         • #p48-whiteboard-section
         • #p53-wb-appearance-section
         • Any .p46-sub-label inside #p46-widgets-section, plus every
           element that follows it (the whiteboard rows appended by
           patches46.js when it couldn't extract them).
    ================================================================ */

    function _nukeWb() {
        ['p48-whiteboard-section', 'p53-wb-appearance-section'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });

        var widgetSec = document.getElementById('p46-widgets-section');
        if (!widgetSec) return;

        var subLabel = widgetSec.querySelector('.p46-sub-label');
        if (!subLabel) return;

        /* Collect the sub-label and every element sibling that follows */
        var toRemove = [];
        var node = subLabel;
        while (node) {
            toRemove.push(node);
            node = node.nextElementSibling;
        }
        toRemove.forEach(function(el) { el.remove(); });
    }

    /* Run once as soon as the widgets section exists */
    _wait(function() {
        if (!document.getElementById('p46-widgets-section')) return false;
        _nukeWb();
        return true;
    }, 100, 20000);

    /* Hook openModal so removal re-runs on every settings/widgets open */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p60modalHooked) return true;
        window._p60modalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings' || id === 'modal-widgets') {
                setTimeout(_nukeWb, 100);
                setTimeout(_nukeWb, 300);
                setTimeout(_nukeWb, 700);
                setTimeout(_nukeWb, 1500);
            }
        };
        return true;
    });

    /* Also run on DOMContentLoaded to catch nodes injected before openModal exists */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(_nukeWb, 200);
            setTimeout(_nukeWb, 600);
            setTimeout(_nukeWb, 1500);
        });
    } else {
        setTimeout(_nukeWb, 200);
    }

    console.log('[patches60] loaded — formula colours neutralised, whiteboard section removed');
}());
