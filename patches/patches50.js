/* ================================================================
   StudentOS — patches50.js
   1.  Worksheet picker — hardened duplicate "Checklist" button fix.
       Patches22 injects a [data-p22cl] button into the picker; the
       earlier dedup in patches49 depends on a 400 ms timeout and a
       successful content-block merge.  This patch runs its own
       cleanup at 80 ms and 200 ms after the picker opens, searching
       the entire sheet for every Checklist button that is NOT inside
       #p42-picker-sec and removing it.
   2.  Worksheet toolbar — inject a visible "BETA" badge next to the
       "Worksheet" title, and update the sidebar nav-button tooltip.
   3.  Settings — belt-and-braces: if any of the avatar-related
       elements (p43 wrapper, emoji grid, avatar preview) are still
       visible when the settings modal opens, hide them.
   ================================================================ */

(function _p50_init() {
    'use strict';

    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 10000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  WORKSHEET PICKER — HARDENED CHECKLIST DEDUP
       ================================================================ */

    /**
     * Remove every "Checklist" picker button that is NOT inside
     * #p42-picker-sec.  Called at two short intervals after the
     * picker opens so it catches both patches22 (60 ms) and any
     * other late injector.
     */
    function _dedupeChecklist() {
        var sheet = document.getElementById('p19-ws-picker-sheet');
        if (!sheet) return;

        var p42sec = sheet.querySelector('#p42-picker-sec');

        /* Find every picker button that looks like a Checklist button */
        var allBtns = sheet.querySelectorAll('.p19-picker-type-btn');
        allBtns.forEach(function(btn) {
            /* Identify by data-p22cl OR by button label */
            var isChecklist =
                btn.dataset.p22cl ||
                btn.textContent.trim() === 'Checklist';

            if (!isChecklist) return;

            /* Keep only the one inside #p42-picker-sec */
            var insideP42 = p42sec && p42sec.contains(btn);
            if (!insideP42) btn.remove();
        });

        /* Also remove patches28's standalone section if still present */
        var p28sec = sheet.querySelector('#p28-new-types-sec');
        if (p28sec) p28sec.remove();
    }

    _wait(function() {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p50pickerDone) return true;
        window._p50pickerDone = true;

        var _orig = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            _orig.apply(this, arguments);
            /* Run dedup at two points: just after patches22 (60 ms)
               and again for safety (250 ms). */
            setTimeout(_dedupeChecklist, 80);
            setTimeout(_dedupeChecklist, 250);
        };
        return true;
    });

    /* ================================================================
       2.  WORKSHEET TOOLBAR — "BETA" BADGE + NAV TOOLTIP
       ================================================================ */

    /**
     * Inject a "BETA" badge next to the worksheet title in the toolbar.
     * patches19 creates #p19-ws-toolbar; we watch for it.
     */
    function _injectBetaBadge() {
        var toolbar = document.getElementById('p19-ws-toolbar');
        if (!toolbar) return false;
        if (toolbar.querySelector('.p50-beta-badge')) return true; /* already done */

        /* The title span contains "Worksheet" */
        var titleSpan = toolbar.querySelector('span');
        if (!titleSpan || titleSpan.textContent.trim() !== 'Worksheet') return false;

        var badge = document.createElement('span');
        badge.className = 'p50-beta-badge';
        badge.textContent = 'BETA';
        titleSpan.parentNode.insertBefore(badge, titleSpan.nextSibling);
        return true;
    }

    /* Try immediately and also watch for the toolbar being (re-)created. */
    _wait(_injectBetaBadge, 150, 15000);

    /* Hook switchTab so the badge is re-injected if the worksheet view
       is recreated (patches19 may rebuild the toolbar on tab switch). */
    _wait(function() {
        if (typeof window.switchTab !== 'function') return false;
        if (window._p50stHooked) return true;
        window._p50stHooked = true;

        var _origST = window.switchTab;
        window.switchTab = function(name) {
            _origST.apply(this, arguments);
            if (name === 'worksheet') {
                /* Give patches19 time to render the toolbar */
                setTimeout(_injectBetaBadge, 200);
            }
        };
        return true;
    });

    /* Update the sidebar nav-button tooltip */
    _wait(function() {
        var btn = document.getElementById('btn-worksheet');
        if (!btn) return false;
        if (btn.dataset.p50tip) return true;
        btn.dataset.p50tip = '1';
        btn.setAttribute('data-tooltip', 'Worksheet (Beta)');
        return true;
    });

    /* ================================================================
       3.  SETTINGS — BELT-AND-BRACES AVATAR/EMOJI SECTION CLEANUP
       ================================================================ */

    function _cleanSettingsIdentity() {
        /* Hide patches43's emoji/icon wrapper */
        var p43wrap = document.getElementById('p43-settings-profile-sections');
        if (p43wrap) p43wrap.style.display = 'none';

        /* Hide the original emoji grid */
        var emojiGrid = document.getElementById('settings-emoji-grid');
        if (emojiGrid) emojiGrid.style.display = 'none';

        /* Hide the avatar-preview inside the settings panel
           (CSS rule in patches50.css already does this, but JS
           ensures it works even before the stylesheet is applied). */
        var settingsAvatar = document.getElementById('settings-avatar-preview');
        if (settingsAvatar) settingsAvatar.style.display = 'none';
    }

    /* Run once the settings DOM exists */
    _wait(function() {
        var sec = document.querySelector('.p43-settings-profile');
        if (!sec) return false;
        _cleanSettingsIdentity();
        return true;
    }, 100, 8000);

    /* Re-run every time the settings modal opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p50modalHooked) return true;
        window._p50modalHooked = true;

        var _origOpen = window.openModal;
        window.openModal = function(id) {
            _origOpen.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_cleanSettingsIdentity, 0);
                setTimeout(_cleanSettingsIdentity, 300);
            }
        };
        return true;
    });

    console.log('[patches50] loaded — checklist dedup hardened, worksheet BETA badge, settings avatar cleanup');
}());
