/* ================================================================
   StudentOS — patches51.js
   1.  Profile modal — inject a "Quick Preferences" section with
       accent colour, light/dark theme, and font scale.  These
       were buried in Settings > Appearance; surfacing them here
       makes the profile page a one-stop personalisation hub.
   2.  Settings — move the "Whiteboard" section (split off from
       "Widgets" by patches48) to appear after "Notes" so that
       the settings list reads logically rather than grouping
       Whiteboard next to dashboard-widget toggles.
   3.  Settings Identity — belt-and-braces guard: hide any
       residual avatar/emoji elements that may still be in the
       DOM (e.g. injected by older patches), now that the HTML
       has been cleaned up.
   ================================================================ */

(function _p51_init() {
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
    function _dbSet(key, val) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function')
                return DB.set(key, val);
            localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {}
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
       1.  PROFILE MODAL — QUICK PREFERENCES SECTION
       ================================================================ */

    var ACCENT_PRESETS = [
        { hex: '#3b82f6', cls: 'bg-blue-500'    },
        { hex: '#ef4444', cls: 'bg-red-500'      },
        { hex: '#10b981', cls: 'bg-emerald-500'  },
        { hex: '#8b5cf6', cls: 'bg-violet-500'   },
        { hex: '#f59e0b', cls: 'bg-amber-500'    },
        { hex: '#ec4899', cls: 'bg-pink-500'     },
        { hex: '#14b8a6', cls: 'bg-teal-500'     },
        { hex: '#f97316', cls: 'bg-orange-500'   },
    ];

    var FONT_SCALES = [
        { label: 'S', value: 0.85  },
        { label: 'M', value: 1     },
        { label: 'L', value: 1.12  },
    ];

    /**
     * Returns true if the app is currently in light mode.
     * Mirrors the logic used by the existing toggleTheme() implementation.
     */
    function _isLightMode() {
        return document.documentElement.classList.contains('light-mode') ||
               document.body.classList.contains('light-mode') ||
               _db('os_theme', 'dark') === 'light';
    }

    /**
     * Build and insert the Quick Preferences section into modal-profile.
     * Inserted just before the bottom action bar (Upload / Done).
     */
    function _buildProfilePrefs() {
        var modal = document.getElementById('modal-profile');
        if (!modal) return false;
        if (document.getElementById('p51-profile-prefs')) return true; /* already done */

        /* The bottom action bar is the last child div that contains the
           "Done" button. */
        var bottomBar = modal.querySelector('.px-6.py-4.flex.items-center.justify-between');
        if (!bottomBar) return false;

        var section = document.createElement('div');
        section.id = 'p51-profile-prefs';

        /* Section label */
        var lbl = document.createElement('div');
        lbl.className = 'p51-prefs-label';
        lbl.textContent = 'Quick Preferences';
        section.appendChild(lbl);

        /* ── Row 1: Light Mode toggle ──────────────────────────── */
        var themeRow = document.createElement('div');
        themeRow.className = 'p51-pref-row';

        var themeLeft = document.createElement('div');
        themeLeft.className = 'p51-pref-left';
        themeLeft.textContent = 'Light Mode';

        var themeToggle = document.createElement('button');
        themeToggle.type = 'button';
        themeToggle.className = 'p51-theme-toggle' + (_isLightMode() ? ' on' : '');
        themeToggle.id = 'p51-theme-toggle';
        var themeDot = document.createElement('div');
        themeDot.className = 'p51-theme-dot';
        themeToggle.appendChild(themeDot);
        themeToggle.addEventListener('click', function() {
            if (typeof window.toggleTheme === 'function') window.toggleTheme();
            /* The theme toggle in the settings panel is also updated by
               toggleTheme(), but sync ours visually as well. */
            setTimeout(function() {
                themeToggle.classList.toggle('on', _isLightMode());
            }, 50);
        });

        themeRow.appendChild(themeLeft);
        themeRow.appendChild(themeToggle);
        section.appendChild(themeRow);

        /* ── Row 2: Accent Colour ──────────────────────────────── */
        var accentRow = document.createElement('div');
        accentRow.className = 'p51-pref-row';

        var accentLeft = document.createElement('div');
        accentLeft.className = 'p51-pref-left';
        accentLeft.textContent = 'Accent Colour';

        var swatches = document.createElement('div');
        swatches.className = 'p51-accent-swatches';
        swatches.id = 'p51-accent-swatches';

        ACCENT_PRESETS.forEach(function(preset) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'p51-accent-swatch ' + preset.cls;
            btn.title = preset.hex;
            btn.dataset.hex = preset.hex;
            btn.addEventListener('click', function() {
                if (typeof window.setAccent === 'function') window.setAccent(preset.hex);
                _syncAccentSwatches(preset.hex);
            });
            swatches.appendChild(btn);
        });

        /* Custom colour picker */
        var customPicker = document.createElement('input');
        customPicker.type = 'color';
        customPicker.className = 'p51-accent-custom';
        customPicker.title = 'Custom accent colour';
        customPicker.value = _db('os_accent', '#3b82f6') || '#3b82f6';
        customPicker.addEventListener('change', function() {
            if (typeof window.setAccent === 'function') window.setAccent(customPicker.value);
            _syncAccentSwatches(customPicker.value);
        });
        swatches.appendChild(customPicker);

        accentRow.appendChild(accentLeft);
        accentRow.appendChild(swatches);
        section.appendChild(accentRow);

        /* ── Row 3: Font Scale ─────────────────────────────────── */
        var scaleRow = document.createElement('div');
        scaleRow.className = 'p51-pref-row';

        var scaleLeft = document.createElement('div');
        scaleLeft.className = 'p51-pref-left';
        scaleLeft.textContent = 'Text Size';
        var scaleSub = document.createElement('span');
        scaleSub.className = 'p51-pref-sub';
        scaleSub.textContent = 'App font scale';
        scaleLeft.appendChild(scaleSub);

        var scaleGroup = document.createElement('div');
        scaleGroup.className = 'p51-scale-group';
        var curScale = _db('os_font_scale', 1);

        FONT_SCALES.forEach(function(fs) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'p51-scale-btn' + (Math.abs(curScale - fs.value) < 0.01 ? ' active' : '');
            btn.textContent = fs.label;
            btn.dataset.scale = String(fs.value);
            btn.addEventListener('click', function() {
                if (typeof window.setFontScale === 'function') window.setFontScale(fs.value);
                scaleGroup.querySelectorAll('.p51-scale-btn').forEach(function(b) {
                    b.classList.toggle('active', b === btn);
                });
            });
            scaleGroup.appendChild(btn);
        });

        scaleRow.appendChild(scaleLeft);
        scaleRow.appendChild(scaleGroup);
        section.appendChild(scaleRow);

        /* Insert before the bottom bar */
        bottomBar.parentNode.insertBefore(section, bottomBar);
        return true;
    }

    /**
     * Highlight the swatch matching `hex` (or none if it's a custom value).
     */
    function _syncAccentSwatches(hex) {
        var container = document.getElementById('p51-accent-swatches');
        if (!container) return;
        var norm = (hex || '').toLowerCase();
        container.querySelectorAll('.p51-accent-swatch').forEach(function(btn) {
            btn.classList.toggle('active', (btn.dataset.hex || '').toLowerCase() === norm);
        });
    }

    /**
     * Sync the Quick Preferences section state when the profile modal opens.
     */
    function _syncProfilePrefs() {
        /* Theme toggle */
        var tt = document.getElementById('p51-theme-toggle');
        if (tt) tt.classList.toggle('on', _isLightMode());

        /* Accent swatches */
        _syncAccentSwatches(_db('os_accent', '#3b82f6'));

        /* Font scale buttons */
        var curScale = _db('os_font_scale', 1);
        document.querySelectorAll('.p51-scale-btn').forEach(function(btn) {
            var v = parseFloat(btn.dataset.scale || '1');
            btn.classList.toggle('active', Math.abs(curScale - v) < 0.01);
        });
    }

    /* Build as soon as the modal exists */
    _wait(function() {
        return _buildProfilePrefs();
    }, 100, 10000);

    /* Sync state every time the profile modal opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p51modalHooked) return true;
        window._p51modalHooked = true;

        var _origOpen = window.openModal;
        window.openModal = function(id) {
            _origOpen.apply(this, arguments);
            if (id === 'modal-profile') {
                /* Give patches42 time to finish its own injection */
                setTimeout(_buildProfilePrefs, 0);
                setTimeout(_syncProfilePrefs,  80);
            }
        };
        return true;
    });

    /* ================================================================
       2.  SETTINGS — MOVE WHITEBOARD SECTION AFTER NOTES
           patches48 places #p48-whiteboard-section immediately after
           #p46-widgets-section.  We relocate it to follow
           #p48-notes-section so the order reads:
               … Widgets → Tasks → Calendar → Notes → Whiteboard → …
       ================================================================ */

    function _relocateWhiteboard() {
        var wbSec   = document.getElementById('p48-whiteboard-section');
        var notesSec = document.getElementById('p48-notes-section');

        /* Both sections must exist before we can reorder */
        if (!wbSec || !notesSec) return false;
        if (wbSec.dataset.p51moved) return true; /* already relocated */

        /* Only move if Whiteboard is currently before Notes (i.e. the
           default patches48 ordering).  If another patch already moved
           it, leave it alone. */
        var scroll = wbSec.parentNode;
        if (!scroll || scroll !== notesSec.parentNode) return false;

        /* Insert whiteboard right after notes */
        var afterNotes = notesSec.nextSibling;
        if (afterNotes === wbSec) {
            /* Already in correct position — just mark done */
            wbSec.dataset.p51moved = '1';
            return true;
        }

        scroll.insertBefore(wbSec, afterNotes || null);
        wbSec.dataset.p51moved = '1';
        return true;
    }

    /* Run shortly after patches48 has had a chance to inject its sections */
    _wait(function() {
        return _relocateWhiteboard();
    }, 150, 12000);

    /* ================================================================
       3.  SETTINGS IDENTITY — RESIDUAL ELEMENT CLEANUP
           Hides any leftover avatar/emoji DOM nodes that may still
           be present (e.g. injected by older patches at runtime).
       ================================================================ */

    function _cleanIdentity() {
        /* p43-injected emoji/icon wrapper */
        var p43wrap = document.getElementById('p43-settings-profile-sections');
        if (p43wrap) p43wrap.style.display = 'none';

        /* Original emoji grid (removed from HTML but guard against
           any patch re-injecting it) */
        var emojiGrid = document.getElementById('settings-emoji-grid');
        if (emojiGrid) emojiGrid.style.display = 'none';

        /* Avatar preview circle */
        var avatar = document.getElementById('settings-avatar-preview');
        if (avatar) avatar.style.display = 'none';
    }

    _wait(function() {
        var scroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!scroll) return false;
        _cleanIdentity();
        return true;
    }, 100, 8000);

    /* Re-run on every settings modal open */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p51settingsHooked) return true;
        window._p51settingsHooked = true;

        /* openModal may already be wrapped by p51 for profile — reuse it */
        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_cleanIdentity, 0);
                setTimeout(_cleanIdentity, 300);
                /* Re-check whiteboard position each time (defensive) */
                setTimeout(_relocateWhiteboard, 400);
            }
        };
        return true;
    });

    console.log('[patches51] loaded — profile quick-prefs, whiteboard reorder, identity cleanup');
}());
