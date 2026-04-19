/* ================================================================
   StudentOS — patches53.js
   1.  Cloud Sync — ensure all settings and user preferences are
       saved to the cloud DB (Firestore) rather than localStorage
       only.  Specifically:
       a.  Wraps _p39setFaAvatar to also write to window.DB and
           update window.profileData so the correct icon is shown
           without a page refresh.
       b.  Extends _collectLocalStorage to include settings keys
           added by later patches (p46/p48) so any pre-migration
           localStorage data is synced to Firestore.
   2.  Settings Reorganisation — move the Whiteboard section away
       from the "Widgets" area and into "Personalise":
       a.  In the old-style settings modal (#modal-settings): move
           #p48-whiteboard-section to appear immediately after the
           Appearance section.
       b.  In the tabbed settings view (#p10-page-appearance):
           inject a "Whiteboard" settings section so the option is
           visible regardless of which settings path is active.
   3.  Profile picture icon — fix rendering on initial boot.
       patches45 wraps renderProfileDisplay but reads from
       localStorage for FA-icon detection.  After a Firestore
       migration localStorage is cleared, so the detection may fall
       through.  This patch adds a second layer that:
       a.  Reads from window.DB (cloud-backed) as well as from the
           global profileData for reliable FA-icon detection.
       b.  Auto-corrects emoji strings that look like FA class names
           (e.g. "fa-solid fa-crown") but are missing the __fa:
           prefix, preventing them from rendering as raw text.
   ================================================================ */

(function _p53_init() {
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
        maxWait  = maxWait  || 12000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    function _safeIconClass(raw) {
        return (raw || '').replace(/[^a-zA-Z0-9\- ]/g, '');
    }

    /* Returns true if a string looks like a bare FA icon class
       (e.g. "fa-solid fa-crown") that is missing the __fa: prefix. */
    function _looksLikeFaClass(s) {
        return typeof s === 'string' &&
            /^fa-(solid|regular|brands) fa-[a-z0-9\-]+/.test(s);
    }

    /* ================================================================
       1a.  CLOUD SYNC — WRAP _p39setFaAvatar
            patches39 uses localStorage-only helpers (_p39dbG / _p39dbS).
            After a Firestore migration localStorage is cleared, so the
            chosen FA icon is lost on the next page load.
            Fix: intercept _p39setFaAvatar after it registers, re-read
            the full profile from DB, merge the new emoji value, and
            persist through DB.set().  Also update window.profileData
            so the next renderProfileDisplay() call sees the new icon.
       ================================================================ */
    _wait(function() {
        if (typeof window._p39setFaAvatar !== 'function') return false;
        if (window._p53faAvatarHooked) return true;
        window._p53faAvatarHooked = true;

        var _orig = window._p39setFaAvatar;
        window._p39setFaAvatar = function(iconClass) {
            /* Run original (writes to localStorage + re-renders) */
            _orig.apply(this, arguments);

            /* Sync to cloud DB */
            var safe    = _safeIconClass(iconClass);
            var profile = _db('os_profile', {});
            profile.emoji = '__fa:' + safe;
            profile.type  = 'icon';
            _dbSet('os_profile', profile);

            /* Keep global profileData in sync so renderProfileDisplay
               works correctly immediately and after any reload. */
            if (typeof window.profileData !== 'undefined') {
                window.profileData.emoji = '__fa:' + safe;
                window.profileData.type  = 'icon';
            }
        };
        return true;
    });

    /* ================================================================
       1b.  CLOUD SYNC — EXTEND MIGRATION KEY LIST
            _collectLocalStorage in script.js may not include keys added
            by later patches (p46, p48).  Wrap the function so that a
            subsequent migration also picks up those values.
       ================================================================ */
    _wait(function() {
        if (typeof window._collectLocalStorage !== 'function') return false;
        if (window._p53migrateHooked) return true;
        window._p53migrateHooked = true;

        var EXTRA_KEYS = [
            'os_task_sort', 'os_task_overdue_highlight',
            'os_cal_week_start', 'os_cal_default_view',
            'os_notes_sort', 'os_notes_autosave',
            'os_grade_system', 'p9_grade_scale',
            'os_startup_tab', 'os_task_show_done',
            'os_wb_default_bg', 'os_wb_grid_default',
        ];

        var _origCollect = window._collectLocalStorage;
        window._collectLocalStorage = function() {
            var data = _origCollect.apply(this, arguments) || {};
            EXTRA_KEYS.forEach(function(k) {
                if (k in data) return; /* already present */
                var raw = localStorage.getItem(k);
                if (raw !== null) {
                    try { data[k] = JSON.parse(raw); } catch(e) { data[k] = raw; }
                }
            });
            return data;
        };
        return true;
    });

    /* ================================================================
       2a.  SETTINGS (OLD MODAL) — MOVE WHITEBOARD TO "PERSONALISE"
            patches51 placed #p48-whiteboard-section after the Notes
            section.  Move it to appear immediately after the Appearance
            section so it lives in the visual-customisation area rather
            than adjacent to the dashboard-widget toggles.
       ================================================================ */
    function _moveWhiteboardInModal() {
        var wbSec  = document.getElementById('p48-whiteboard-section');
        var scroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!wbSec || !scroll) return false;
        if (wbSec.dataset.p53placed) return true;

        /* Find Appearance section */
        var appearSec = null;
        scroll.querySelectorAll('.settings-section').forEach(function(s) {
            var h = s.querySelector('.text-xs.uppercase');
            if (h && h.textContent.trim() === 'Appearance') appearSec = s;
        });
        if (!appearSec) return false;

        var insertTarget = appearSec.nextSibling;
        if (insertTarget === wbSec) {
            wbSec.dataset.p53placed = '1';
            return true;
        }

        scroll.insertBefore(wbSec, insertTarget || null);
        wbSec.dataset.p53placed = '1';
        return true;
    }

    /* Run after patches48 + patches51 have injected/relocated sections */
    _wait(function() {
        return _moveWhiteboardInModal();
    }, 300, 14000);

    /* Re-check whenever settings opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p53modalHooked) return true;
        window._p53modalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_moveWhiteboardInModal, 600);
            }
        };
        return true;
    });

    /* ================================================================
       2b.  SETTINGS (TABBED VIEW) — INJECT WHITEBOARD IN APPEARANCE
            The tabbed settings (#view-settings created by patches10)
            exposes the Appearance page but has no Whiteboard settings.
            Inject a "Whiteboard" section at the bottom of the Appearance
            page so users can configure it from within the
            "Personalise / Appearance" context.
       ================================================================ */
    function _injectWhiteboardIntoAppearancePage() {
        var appPage = document.getElementById('p10-page-appearance');
        if (!appPage) return false;
        if (appPage.querySelector('#p53-wb-appearance-section')) return true;

        /* ── section container ──────────────────────────────── */
        var sec = document.createElement('div');
        sec.id = 'p53-wb-appearance-section';
        sec.className = 'p10-section';

        var title = document.createElement('div');
        title.className = 'p10-section-title';
        title.textContent = 'Whiteboard';
        sec.appendChild(title);

        /* ── default background row ─────────────────────────── */
        var bgSwatches = document.createElement('div');
        bgSwatches.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';

        var PRESETS = ['#1a1a1a', '#0f172a', '#ffffff', '#fef9ef', '#1e3a5f', '#14532d'];
        var bgPicker = document.createElement('input');
        bgPicker.type  = 'color';
        bgPicker.id    = 'p53-wb-bg-picker';
        bgPicker.value = _db('os_wb_default_bg', '#1a1a1a');
        bgPicker.title = 'Custom colour';
        bgPicker.style.cssText =
            'width:22px;height:22px;border-radius:50%;padding:0;cursor:pointer;' +
            'border:2px solid rgba(255,255,255,.2);';
        bgPicker.addEventListener('change', function() {
            _dbSet('os_wb_default_bg', bgPicker.value);
            /* Sync patches46 picker if present */
            var p46 = document.getElementById('p46-wb-default-bg');
            if (p46) p46.value = bgPicker.value;
            if (typeof window.wbSetBg === 'function') window.wbSetBg(bgPicker.value);
        });

        PRESETS.forEach(function(hex) {
            var btn = document.createElement('button');
            btn.type  = 'button';
            btn.title = hex;
            btn.style.cssText =
                'width:22px;height:22px;border-radius:50%;background:' + hex +
                ';border:2px solid rgba(255,255,255,.2);cursor:pointer;' +
                'flex-shrink:0;transition:transform .15s;';
            btn.addEventListener('mouseenter', function() { btn.style.transform = 'scale(1.15)'; });
            btn.addEventListener('mouseleave', function() { btn.style.transform = ''; });
            btn.addEventListener('click', function() {
                _dbSet('os_wb_default_bg', hex);
                bgPicker.value = hex;
                var p46 = document.getElementById('p46-wb-default-bg');
                if (p46) p46.value = hex;
                if (typeof window.wbSetBg === 'function') window.wbSetBg(hex);
            });
            bgSwatches.appendChild(btn);
        });
        bgSwatches.appendChild(bgPicker);

        var bgRow = document.createElement('div');
        bgRow.className = 'p10-row';
        var bgLeft = document.createElement('div');
        bgLeft.innerHTML =
            '<div class="p10-row-lbl">Default Background</div>' +
            '<div class="p10-row-sub">Colour for new boards</div>';
        bgRow.appendChild(bgLeft);
        bgRow.appendChild(bgSwatches);
        sec.appendChild(bgRow);

        /* ── grid-on-by-default toggle ──────────────────────── */
        var gridBtn = document.createElement('button');
        gridBtn.type      = 'button';
        gridBtn.id        = 'p53-wb-grid-toggle';
        gridBtn.className = 'p46-toggle' + (_db('os_wb_grid_default', false) ? ' on' : '');
        var dot = document.createElement('div');
        dot.className = 'p46-toggle-dot';
        gridBtn.appendChild(dot);
        gridBtn.addEventListener('click', function() {
            var next = !gridBtn.classList.contains('on');
            gridBtn.classList.toggle('on', next);
            _dbSet('os_wb_grid_default', next);
            /* Sync patches46 toggle if present */
            var p46 = document.getElementById('p46-wb-grid-toggle');
            if (p46) p46.classList.toggle('on', next);
            if (typeof window.wbGridOn !== 'undefined' &&
                window.wbGridOn !== next &&
                typeof window.wbToggleGrid === 'function') {
                window.wbToggleGrid();
            }
        });

        var gridRow = document.createElement('div');
        gridRow.className = 'p10-row';
        var gridLeft = document.createElement('div');
        gridLeft.innerHTML = '<div class="p10-row-lbl">Grid Lines by Default</div>';
        gridRow.appendChild(gridLeft);
        gridRow.appendChild(gridBtn);
        sec.appendChild(gridRow);

        appPage.appendChild(sec);
        return true;
    }

    _wait(function() {
        return _injectWhiteboardIntoAppearancePage();
    }, 200, 12000);

    /* ================================================================
       3.  PROFILE ICON — FIX RENDERING ON INITIAL BOOT
           Wrap renderProfileDisplay (after patches45 has wrapped it)
           so that FA-icon profiles are detected using window.DB (which
           is populated after initApp() runs) as well as via the global
           profileData variable.  Also auto-corrects emoji values that
           look like bare FA class names (e.g. "fa-solid fa-crown")
           but are missing the __fa: prefix, which would otherwise cause
           the class name to render as visible text.
       ================================================================ */
    function _renderFaInProfile(iconClass, bg) {
        var safe = _safeIconClass(iconClass);
        if (!safe) return;

        var pd = document.getElementById('profile-display');
        if (pd) {
            pd.innerHTML = '';
            var span = document.createElement('span');
            span.style.cssText =
                'width:100%;height:100%;display:flex;align-items:center;' +
                'justify-content:center;border-radius:14px;background:' + bg + ';';
            var i1 = document.createElement('i');
            i1.className = safe + ' text-xl text-white';
            i1.setAttribute('aria-hidden', 'true');
            span.appendChild(i1);
            pd.appendChild(span);
        }

        var ap = document.getElementById('avatar-preview');
        if (ap) {
            ap.innerHTML = '';
            var i2 = document.createElement('i');
            i2.className = safe + ' text-4xl text-white';
            i2.setAttribute('aria-hidden', 'true');
            ap.appendChild(i2);
            ap.style.background = bg;
            ap.style.fontSize   = '';
        }
    }

    _wait(function() {
        if (typeof window.renderProfileDisplay !== 'function') return false;
        if (window._p53profileFixed) return true;
        window._p53profileFixed = true;

        var _orig = window.renderProfileDisplay;

        window.renderProfileDisplay = function() {
            /* Read from DB (Firestore-backed), falling back to global profileData.
               patches45 reads from localStorage which may be empty after migration;
               this wrapper adds a reliable DB-based check. */
            var profile = _db('os_profile', null);

            /* If DB has no data yet (before initApp hydrates), fall back to global */
            if (!profile && typeof window.profileData !== 'undefined') {
                profile = window.profileData;
            }

            if (profile) {
                var emo = typeof profile.emoji === 'string' ? profile.emoji : '';
                var bg  = profile.bg || profile.avatarBg || '#3b82f6';

                /* Auto-correct: bare FA class name stored without __fa: prefix.
                   This prevents the class name from appearing as raw text. */
                if (!emo.startsWith('__fa:') && _looksLikeFaClass(emo)) {
                    emo = '__fa:' + emo;
                    profile.emoji = emo;
                    _dbSet('os_profile', profile);
                    if (typeof window.profileData !== 'undefined') {
                        window.profileData.emoji = emo;
                    }
                }

                if (emo.startsWith('__fa:')) {
                    _renderFaInProfile(emo.slice(5), bg);
                    return;
                }
            }

            /* Not an FA icon — delegate to original renderer */
            _orig.apply(this, arguments);
        };

        /* Apply immediately so the navbar icon is correct
           (mirrors the same pattern in patches45). */
        window.renderProfileDisplay();
        return true;
    });

    console.log('[patches53] loaded — cloud sync, whiteboard → personalise, profile icon fix');
}());
