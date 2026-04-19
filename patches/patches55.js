/* ================================================================
   StudentOS — patches55.js
   1.  Whiteboard settings section — remove from settings modal at
       runtime (belt-and-braces alongside the CSS hide).
   2.  Profile modal — make scrollable on small devices (JS guard
       to remove overflow-hidden Tailwind class at open-time).
   3.  More customisation rows in the Quick Preferences section of
       the profile modal:
       a.  Reduce Motion toggle  (os_reduce_motion → html.reduce-motion)
       b.  Compact Mode toggle   (os_compact_mode  → html.compact-mode)
       c.  Startup Tab select    (os_startup_tab   — quick shortcut)
   ================================================================ */

(function _p55_init() {
    'use strict';

    /* ── helpers ─────────────────────────────────────────────── */
    function _db(key, def) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.get === 'function')
                return DB.get(key, def);
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }

    function _dbSet(key, val) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function')
                return DB.set(key, val);
            localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {}
    }

    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 14000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ── toggle builder (reuses p51/p48 visual classes) ───────── */
    function _makeToggle(storageKey, defaultVal, onChange) {
        var btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'p51-theme-toggle' + (_db(storageKey, defaultVal) ? ' on' : '');
        var dot = document.createElement('div');
        dot.className = 'p51-theme-dot';
        btn.appendChild(dot);
        btn.addEventListener('click', function() {
            var next = !btn.classList.contains('on');
            btn.classList.toggle('on', next);
            _dbSet(storageKey, next);
            if (typeof onChange === 'function') onChange(next);
        });
        return btn;
    }

    /* ================================================================
       1.  WHITEBOARD SETTINGS SECTION — REMOVE AT RUNTIME
           CSS already hides it; this removes the DOM node so it
           doesn't take up space even before CSS loads.
       ================================================================ */

    function _removeWbSettingsSection() {
        var wbSec = document.getElementById('p48-whiteboard-section');
        if (wbSec) { wbSec.remove(); return true; }
        /* Section may not exist yet — keep waiting */
        return false;
    }

    /* Run once as soon as the section appears */
    _wait(function() {
        return _removeWbSettingsSection();
    }, 200, 15000);

    /* Also re-run whenever settings modal opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p55openModalHooked) return true;
        window._p55openModalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_removeWbSettingsSection, 600);
            }
            if (id === 'modal-profile') {
                /* ── 2. Remove overflow-hidden from profile modal ── */
                var modal = document.getElementById('modal-profile');
                if (modal) modal.classList.remove('overflow-hidden');
                /* ── 3. Build + sync extra customisation rows ── */
                setTimeout(_buildExtraRows, 100);
                setTimeout(_syncExtraRows,  200);
            }
        };
        return true;
    });

    /* ================================================================
       2.  PROFILE MODAL — REMOVE overflow-hidden ON FIRST LOAD
       ================================================================ */

    _wait(function() {
        var modal = document.getElementById('modal-profile');
        if (!modal) return false;
        modal.classList.remove('overflow-hidden');
        return true;
    }, 80, 8000);

    /* ================================================================
       3.  PROFILE MODAL — EXTRA CUSTOMISATION ROWS
       ================================================================ */

    /* Apply saved states on boot */
    (function _applyBootStates() {
        if (_db('os_reduce_motion', false)) {
            document.documentElement.classList.add('reduce-motion');
        }
        if (_db('os_compact_mode', false)) {
            document.documentElement.classList.add('compact-mode');
        }
    })();

    var STARTUP_TABS = [
        ['dashboard',  'Dashboard'],
        ['tasks',      'Tasks'],
        ['notes',      'Notes'],
        ['cards',      'Flashcards'],
        ['grades',     'Grades'],
        ['calendar',   'Calendar'],
        ['focus',      'Focus'],
        ['whiteboard', 'Whiteboard'],
        ['calc',       'Calculator'],
        ['formulas',   'Formula Sheets'],
        ['music',      'Music'],
        ['forum',      'Forum'],
    ];

    /**
     * Build and insert the extra customisation rows into the
     * Quick Preferences section (created by patches51).
     */
    function _buildExtraRows() {
        var prefs = document.getElementById('p51-profile-prefs');
        if (!prefs) return false;

        /* Don't add twice */
        if (document.getElementById('p55-extra-rows')) return true;

        var wrapper = document.createElement('div');
        wrapper.id = 'p55-extra-rows';

        /* ── Row A: Reduce Motion ──────────────────────────── */
        var motionRow = document.createElement('div');
        motionRow.className = 'p51-pref-row';

        var motionLeft = document.createElement('div');
        motionLeft.className = 'p51-pref-left';
        motionLeft.textContent = 'Reduce Motion';
        var motionSub = document.createElement('span');
        motionSub.className = 'p51-pref-sub';
        motionSub.textContent = 'Disable animations';
        motionLeft.appendChild(motionSub);

        var motionToggle = _makeToggle('os_reduce_motion', false, function(on) {
            document.documentElement.classList.toggle('reduce-motion', on);
        });
        motionToggle.id = 'p55-motion-toggle';

        motionRow.appendChild(motionLeft);
        motionRow.appendChild(motionToggle);
        wrapper.appendChild(motionRow);

        /* ── Row B: Compact Mode ───────────────────────────── */
        var compactRow = document.createElement('div');
        compactRow.className = 'p51-pref-row';

        var compactLeft = document.createElement('div');
        compactLeft.className = 'p51-pref-left';
        compactLeft.textContent = 'Compact Mode';
        var compactSub = document.createElement('span');
        compactSub.className = 'p51-pref-sub';
        compactSub.textContent = 'Denser layout';
        compactLeft.appendChild(compactSub);

        var compactToggle = _makeToggle('os_compact_mode', false, function(on) {
            document.documentElement.classList.toggle('compact-mode', on);
        });
        compactToggle.id = 'p55-compact-toggle';

        compactRow.appendChild(compactLeft);
        compactRow.appendChild(compactToggle);
        wrapper.appendChild(compactRow);

        /* ── Row C: Startup Tab ────────────────────────────── */
        var startRow = document.createElement('div');
        startRow.className = 'p51-pref-row';

        var startLeft = document.createElement('div');
        startLeft.className = 'p51-pref-left';
        startLeft.textContent = 'Startup Tab';
        var startSub = document.createElement('span');
        startSub.className = 'p51-pref-sub';
        startSub.textContent = 'Tab opened on load';
        startLeft.appendChild(startSub);

        var startSel = document.createElement('select');
        startSel.id        = 'p55-startup-select';
        startSel.className = 'p55-startup-select';

        var curTab = _db('os_startup_tab', 'dashboard');
        STARTUP_TABS.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value       = t[0];
            opt.textContent = t[1];
            if (t[0] === curTab) opt.selected = true;
            startSel.appendChild(opt);
        });

        startSel.addEventListener('change', function() {
            _dbSet('os_startup_tab', startSel.value);
            /* Sync the settings modal selector if it's open */
            var settingsSel = document.getElementById('p46-startup-tab-sel');
            if (settingsSel) settingsSel.value = startSel.value;
        });

        startRow.appendChild(startLeft);
        startRow.appendChild(startSel);
        wrapper.appendChild(startRow);

        /* Append wrapper to the Quick Preferences section */
        prefs.appendChild(wrapper);
        return true;
    }

    /**
     * Sync extra rows state when profile modal opens.
     */
    function _syncExtraRows() {
        /* Reduce Motion toggle */
        var motionToggle = document.getElementById('p55-motion-toggle');
        if (motionToggle) {
            motionToggle.classList.toggle('on', !!_db('os_reduce_motion', false));
        }

        /* Compact Mode toggle */
        var compactToggle = document.getElementById('p55-compact-toggle');
        if (compactToggle) {
            compactToggle.classList.toggle('on', !!_db('os_compact_mode', false));
        }

        /* Startup Tab select */
        var sel = document.getElementById('p55-startup-select');
        if (sel) sel.value = _db('os_startup_tab', 'dashboard') || 'dashboard';
    }

    /* Build as soon as p51 section exists */
    _wait(function() {
        return _buildExtraRows();
    }, 100, 14000);

    console.log('[patches55] loaded — whiteboard section hidden, profile modal scrollable, extra customisation rows');
}());
