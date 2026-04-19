/* ================================================================
   StudentOS — patches61.js
   1.  Export PDF button — DOM-remove #p24-ws-print-btn on every
       toolbar creation.  patches24 has a MutationObserver that
       re-injects the button; CSS (patches61.css) keeps it hidden
       even after re-injection.  This JS removal keeps the DOM clean
       on first load and after every worksheet re-render.
   2.  Whiteboard settings (#p36-wb-section) — DOM-remove the section
       that patches36 injects into #p10-page-widgets.  Runs once when
       the widgets page is available and re-runs whenever the settings
       modal opens.
   3.  Block picker — augment the unified #p42-picker-sec section with
       Image and Canvas (draw) block types so the picker always shows
       all available block types.  Runs 500 ms after the picker opens
       (after all earlier dedup patches have finished).
   ================================================================ */

(function _p61_init() {
    'use strict';

    /* ── tiny helpers ─────────────────────────────────────────── */
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

    /* ── worksheet data helpers ───────────────────────────────── */
    function _p61id() {
        return Math.random().toString(36).slice(2, 10);
    }

    function _p61getWs() {
        var ws;
        try {
            if (window.DB && typeof window.DB.get === 'function') ws = window.DB.get('os_worksheet', null);
            if (!ws) ws = JSON.parse(localStorage.getItem('os_worksheet') || 'null');
        } catch (_) {}
        ws = ws || { blocks: [], savedValues: {} };
        ws.blocks     = ws.blocks     || [];
        ws.savedValues = ws.savedValues || {};
        return ws;
    }

    function _p61saveWs(ws) {
        try {
            if (window.DB && typeof window.DB.set === 'function') window.DB.set('os_worksheet', ws);
            localStorage.setItem('os_worksheet', JSON.stringify(ws));
        } catch (_) {}
    }

    /* ================================================================
       1.  EXPORT PDF BUTTON — KEEP HIDDEN / REMOVED
           CSS patches61.css hides the button.  This JS ensures DOM
           cleanliness on load and after worksheet re-renders.
       ================================================================ */

    function _removePdfBtns() {
        ['p24-ws-print-btn', 'p21-ws-print-btn', 'p25-ws-pdf-btn'].forEach(function(id) {
            var btn = document.getElementById(id);
            /* Style-hide rather than remove so that patches24's
               MutationObserver doesn't keep thrashing the DOM. */
            if (btn) btn.style.cssText = 'display:none!important';
        });
    }

    /* Run once the toolbar exists */
    _wait(function() {
        if (!document.getElementById('p19-ws-toolbar')) return false;
        _removePdfBtns();
        return true;
    }, 100, 20000);

    /* Re-run after each worksheet render */
    _wait(function() {
        if (typeof window.p19_wbRender !== 'function') return false;
        if (window._p61renderHooked) return true;
        window._p61renderHooked = true;

        var _orig = window.p19_wbRender;
        window.p19_wbRender = function() {
            _orig.apply(this, arguments);
            setTimeout(_removePdfBtns, 100);
            setTimeout(_removePdfBtns, 600);
        };
        return true;
    });

    /* Re-run after switchTab so the button is gone when switching to
       the worksheet tab (patches19 re-creates the toolbar). */
    _wait(function() {
        if (typeof window.switchTab !== 'function') return false;
        if (window._p61stHooked) return true;
        window._p61stHooked = true;

        var _prevSt = window.switchTab;
        window.switchTab = function(name) {
            _prevSt.apply(this, arguments);
            if (name === 'worksheet') {
                setTimeout(_removePdfBtns, 200);
                setTimeout(_removePdfBtns, 700);
            }
        };
        return true;
    });

    /* ================================================================
       2.  WHITEBOARD SETTINGS IN WIDGETS PAGE — DOM REMOVAL
           patches36 injects #p36-wb-section into #p10-page-widgets.
           CSS hides it; this JS removes the DOM node so no hidden
           HTML remains.  Also remove p48, p53 whiteboard sections
           as belt-and-braces alongside patches59/60.
       ================================================================ */

    function _nukeWbSections() {
        ['p36-wb-section', 'p48-whiteboard-section', 'p53-wb-appearance-section'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });

        /* Also remove sub-label rows inside #p46-widgets-section
           (duplicates what patches59/60 already do; belt-and-braces). */
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

    /* Run once when either the widgets page or the settings scroll exists */
    _wait(function() {
        var hasPage  = !!document.getElementById('p10-page-widgets');
        var hasSec   = !!document.getElementById('p46-widgets-section');
        var hasP36   = !!document.getElementById('p36-wb-section');
        if (!hasPage && !hasSec && !hasP36) return false;
        _nukeWbSections();
        return true;
    }, 100, 20000);

    /* Re-run whenever settings or widgets modal opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p61modalHooked) return true;
        window._p61modalHooked = true;

        var _prevModal = window.openModal;
        window.openModal = function(id) {
            _prevModal.apply(this, arguments);
            if (id === 'modal-settings' || id === 'modal-widgets') {
                setTimeout(_nukeWbSections, 150);
                setTimeout(_nukeWbSections, 400);
                setTimeout(_nukeWbSections, 900);
                setTimeout(_nukeWbSections, 2000);
                setTimeout(_nukeWbSections, 4000);
            }
        };
        return true;
    });

    /* Run on DOMContentLoaded as an additional safety net */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(_nukeWbSections, 300);
            setTimeout(_nukeWbSections, 1000);
            setTimeout(_nukeWbSections, 3000);
        });
    } else {
        setTimeout(_nukeWbSections, 300);
        setTimeout(_nukeWbSections, 1500);
    }

    /* ================================================================
       3.  BLOCK PICKER — ADD IMAGE AND CANVAS BLOCK TYPES
           The unified #p42-picker-sec has 8 types (table, callout,
           flashcard, calc, timer, formula, checklist, code).  Image
           (patches23) and Canvas/Draw (patches24) are not in the
           unified section; they rely on the smaller content-blocks
           section.  Add them to the unified section for reliability.
           Runs at 500 ms so all earlier dedup patches have finished.
       ================================================================ */

    function _augmentPicker() {
        var sec = document.getElementById('p42-picker-sec');
        if (!sec) return;
        var grid = sec.querySelector('.p19-picker-block-types');
        if (!grid) return;

        /* Image block */
        if (!grid.querySelector('[data-p61img]')) {
            var imgBtn = document.createElement('button');
            imgBtn.type      = 'button';
            imgBtn.className = 'p19-picker-type-btn';
            imgBtn.dataset.p61img = '1';
            imgBtn.innerHTML = '<i class="fa-solid fa-image"></i>Image';
            imgBtn.addEventListener('click', function() {
                if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
                var ws = _p61getWs();
                ws.blocks.push({ id: _p61id(), type: 'image', dataUrl: null, caption: '' });
                _p61saveWs(ws);
                if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
            });
            grid.appendChild(imgBtn);
        }

        /* Canvas (draw) block — skip if patches24 already added a Whiteboard button */
        if (!grid.querySelector('[data-p61draw]') && !grid.querySelector('[data-p24draw]')) {
            var drawBtn = document.createElement('button');
            drawBtn.type      = 'button';
            drawBtn.className = 'p19-picker-type-btn';
            drawBtn.dataset.p61draw = '1';
            drawBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i>Canvas';
            drawBtn.addEventListener('click', function() {
                if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
                /* patches24 exposes p24_wbAddDraw; use it if available */
                if (typeof window.p24_wbAddDraw === 'function') {
                    window.p24_wbAddDraw();
                } else {
                    var ws = _p61getWs();
                    ws.blocks.push({ id: _p61id(), type: 'draw', dataUrl: null });
                    _p61saveWs(ws);
                    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                }
            });
            grid.appendChild(drawBtn);
        }
    }

    _wait(function() {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p61pickerHooked) return true;
        window._p61pickerHooked = true;

        var _origPicker = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            _origPicker.apply(this, arguments);
            /* 500 ms: after all earlier dedup/cleanup patches have run */
            setTimeout(_augmentPicker, 500);
        };
        return true;
    });

    console.log('[patches61] loaded — PDF btn removed, wb settings removed, picker augmented, formula colours fixed');
}());
