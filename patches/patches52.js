/* ================================================================
   StudentOS — patches52.js
   1.  Settings — remove the "Profile" tab from the sidebar so the
       settings panel no longer shows a Profile page.  The first
       visible page (Appearance) becomes the default active page.
   2.  Profile modal — add a "Language" row to the Quick Preferences
       section so users can change their interface language directly
       from the sidebar profile modal.
   ================================================================ */

(function _p52_init() {
    'use strict';

    /* ── tiny helpers ─────────────────────────────────────────── */
    function _db(key, def) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.get === 'function')
                return DB.get(key, def);
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }

    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 12000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  SETTINGS — REMOVE PROFILE TAB
       ================================================================ */

    function _removeSettingsProfileTab() {
        /* Hide the Profile nav button in the settings sidebar */
        var profileBtn = document.querySelector('.p10-stab-nav-btn[data-page="profile"]');
        if (!profileBtn) return false;

        profileBtn.style.display = 'none';

        /* Hide the Profile content page */
        var profilePage = document.getElementById('p10-page-profile');
        if (profilePage) profilePage.style.display = 'none';

        /* If the profile page is currently active, switch to Appearance */
        if (profilePage && profilePage.classList.contains('active')) {
            if (typeof window._p10switchSettingsPage === 'function') {
                window._p10switchSettingsPage('appearance');
            } else {
                /* Fallback: manually activate the appearance page */
                document.querySelectorAll('.p10-s-page').forEach(function(p) {
                    p.classList.remove('active');
                });
                document.querySelectorAll('.p10-stab-nav-btn').forEach(function(b) {
                    b.classList.remove('active');
                });
                var appPage = document.getElementById('p10-page-appearance');
                if (appPage) appPage.classList.add('active');
                var appBtn = document.querySelector('.p10-stab-nav-btn[data-page="appearance"]');
                if (appBtn) appBtn.classList.add('active');
            }
        }

        return true;
    }

    /* Also ensure the profile tab stays hidden if settings is re-built */
    _wait(function() {
        return _removeSettingsProfileTab();
    }, 100, 10000);

    /* Re-apply on every settings modal open */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p52settingsHooked) return true;
        window._p52settingsHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_removeSettingsProfileTab, 50);
            }
        };
        return true;
    });

    /* ================================================================
       2.  PROFILE MODAL — ADD LANGUAGE ROW
       ================================================================ */

    function _buildLanguageRow() {
        /* Wait for the p51 Quick Preferences section to exist */
        var prefs = document.getElementById('p51-profile-prefs');
        if (!prefs) return false;

        /* Don't add twice */
        if (document.getElementById('p52-lang-row')) return true;

        var row = document.createElement('div');
        row.id        = 'p52-lang-row';
        row.className = 'p51-pref-row';

        var left = document.createElement('div');
        left.className   = 'p51-pref-left';
        left.textContent = 'Language';

        var sel = document.createElement('select');
        sel.id        = 'p52-lang-select';
        sel.className = 'p52-lang-select';

        var langs = [
            { value: 'en', label: '🇬🇧 English'    },
            { value: 'nl', label: '🇧🇪 Nederlands'  },
        ];
        langs.forEach(function(l) {
            var opt = document.createElement('option');
            opt.value       = l.value;
            opt.textContent = l.label;
            sel.appendChild(opt);
        });

        /* Set current value */
        sel.value = _db('os_lang', 'en') || 'en';

        sel.addEventListener('change', function() {
            if (typeof window.setLanguage === 'function') window.setLanguage(sel.value);
        });

        row.appendChild(left);
        row.appendChild(sel);

        /* Append as the last row inside the Quick Preferences section */
        prefs.appendChild(row);
        return true;
    }

    function _syncLangSelect() {
        var sel = document.getElementById('p52-lang-select');
        if (sel) sel.value = _db('os_lang', 'en') || 'en';
    }

    /* Build as soon as the p51 section exists */
    _wait(function() {
        return _buildLanguageRow();
    }, 100, 10000);

    /* Sync & build on every profile modal open */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p52profileHooked) return true;
        window._p52profileHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-profile') {
                setTimeout(_buildLanguageRow, 90);
                setTimeout(_syncLangSelect,  170);
            }
        };
        return true;
    });

    console.log('[patches52] loaded — settings profile tab removed, language moved to profile modal');
}());
