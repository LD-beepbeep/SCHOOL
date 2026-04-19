/* ================================================================
   StudentOS — patches46.js
   1.  General section injected into Settings modal:
       • Startup tab preference  (os_startup_tab)
       • Show completed tasks    (os_task_show_done)
   2.  Focus Timer section expanded:
       • Short-break duration    (os_pomo_times.short)
       • Long-break duration     (os_pomo_times.long)
       • Auto-break toggle       (os_pomo_autobreak)
   3.  Widgets & Whiteboard section injected into Settings modal:
       • All widget visibility toggles (synced with modal-widgets)
       • Whiteboard default background (os_wb_default_bg)
       • Whiteboard grid on by default (os_wb_grid_default)
   4.  Startup-tab applied after initApp() completes.
   5.  wbNewBoard() hooked to apply default background.
   6.  All new settings use DB.get / DB.set for cloud sync.
   ================================================================ */

(function _p46_init() {
    'use strict';

    /* ── tiny helpers ─────────────────────────────────────────── */
    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 8000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    function _db(key, def) {
        return (typeof DB !== 'undefined' && DB && typeof DB.get === 'function')
            ? DB.get(key, def) : def;
    }

    function _dbSet(key, val) {
        if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function') {
            DB.set(key, val);
        } else {
            try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
        }
    }

    /* ── toggle helper ────────────────────────────────────────── */
    function _makeToggle(key, defaultOn, onToggle) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p46-toggle' + (_db(key, defaultOn) ? ' on' : '');
        var dot = document.createElement('div');
        dot.className = 'p46-toggle-dot';
        btn.appendChild(dot);
        btn.addEventListener('click', function() {
            var next = !btn.classList.contains('on');
            btn.classList.toggle('on', next);
            _dbSet(key, next);
            if (onToggle) onToggle(next);
        });
        return btn;
    }

    /* ── row builder ──────────────────────────────────────────── */
    function _row(label, desc, control) {
        var row = document.createElement('div');
        row.className = 'settings-row';
        var left = document.createElement('div');
        var span = document.createElement('span');
        span.className = 'text-sm';
        span.textContent = label;
        left.appendChild(span);
        if (desc) {
            var sub = document.createElement('span');
            sub.className = 'text-xs text-[var(--text-muted)]';
            sub.textContent = desc;
            left.appendChild(document.createElement('br'));
            left.appendChild(sub);
        }
        row.appendChild(left);
        row.appendChild(control);
        return row;
    }

    /* ── section builder ──────────────────────────────────────── */
    function _section(title) {
        var sec = document.createElement('div');
        sec.className = 'settings-section';
        var hdr = document.createElement('div');
        hdr.className = 'text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-3';
        hdr.textContent = title;
        sec.appendChild(hdr);
        return sec;
    }

    /* ================================================================
       1.  GENERAL SECTION
           Injected after Identity, before Appearance.
       ================================================================ */
    _wait(function() {
        var scroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!scroll) return false;
        if (document.getElementById('p46-general-section')) return true;

        /* Find the Appearance section */
        var appearanceSection = null;
        scroll.querySelectorAll('.settings-section').forEach(function(s) {
            var hdr = s.querySelector('.text-xs.uppercase');
            if (hdr && hdr.textContent.trim() === 'Appearance') appearanceSection = s;
        });
        if (!appearanceSection) return false;

        var sec = _section('General');
        sec.id  = 'p46-general-section';

        /* Startup tab */
        var tabs = [
            ['dashboard', 'Dashboard'], ['tasks', 'Tasks'], ['notes', 'Notes'],
            ['cards', 'Flashcards'], ['grades', 'Grades'], ['calendar', 'Calendar'],
            ['focus', 'Focus'], ['whiteboard', 'Whiteboard'], ['calc', 'Calculator'],
            ['formulas', 'Custom Formula'], ['music', 'Music'], ['forum', 'Forum'],
        ];
        var sel = document.createElement('select');
        sel.className = 'p46-select';
        sel.id = 'p46-startup-tab-sel';
        var cur = _db('os_startup_tab', 'dashboard');
        tabs.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t[0];
            opt.textContent = t[1];
            if (t[0] === cur) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', function() {
            _dbSet('os_startup_tab', sel.value);
        });
        sec.appendChild(_row('Startup Tab', 'Tab opened on load', sel));

        /* Show completed tasks */
        var doneToggle = _makeToggle('os_task_show_done', true, function(on) {
            if (typeof window.renderTasks === 'function') window.renderTasks();
        });
        doneToggle.id = 'p46-task-done-toggle';
        sec.appendChild(_row('Show Completed Tasks', null, doneToggle));

        scroll.insertBefore(sec, appearanceSection);
        return true;
    });

    /* ================================================================
       2.  FOCUS TIMER — expand with short break, long break, auto-break
       ================================================================ */
    _wait(function() {
        var scroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!scroll) return false;
        if (document.getElementById('p46-pomo-extras')) return true;

        /* Find Focus Timer section */
        var timerSection = null;
        scroll.querySelectorAll('.settings-section').forEach(function(s) {
            var hdr = s.querySelector('.text-xs.uppercase');
            if (hdr && hdr.textContent.trim() === 'Focus Timer') timerSection = s;
        });
        if (!timerSection) return false;

        var extras = document.createElement('div');
        extras.id = 'p46-pomo-extras';

        /* Short break */
        var shortInput = document.createElement('input');
        shortInput.type      = 'number';
        shortInput.min       = '1';
        shortInput.max       = '60';
        shortInput.className = 'p46-num bare-input';
        shortInput.id        = 'p46-pomo-short';
        var times = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });
        shortInput.value = times.short || 5;
        shortInput.addEventListener('change', function() {
            var t = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });
            t.short = parseInt(shortInput.value) || 5;
            if (typeof window.pomodoroTimes !== 'undefined') window.pomodoroTimes = t;
            _dbSet('os_pomo_times', t);
        });
        extras.appendChild(_row('Short Break', 'Minutes', shortInput));

        /* Long break */
        var longInput = document.createElement('input');
        longInput.type      = 'number';
        longInput.min       = '1';
        longInput.max       = '120';
        longInput.className = 'p46-num bare-input';
        longInput.id        = 'p46-pomo-long';
        longInput.value     = times.long || 15;
        longInput.addEventListener('change', function() {
            var t = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });
            t.long = parseInt(longInput.value) || 15;
            if (typeof window.pomodoroTimes !== 'undefined') window.pomodoroTimes = t;
            _dbSet('os_pomo_times', t);
        });
        extras.appendChild(_row('Long Break', 'Minutes', longInput));

        /* Auto-break */
        var autoBreakToggle = _makeToggle('os_pomo_autobreak', false, function(on) {
            if (typeof window.pomodoroAutoBreak !== 'undefined') window.pomodoroAutoBreak = on;
            /* Sync label in the focus view if present */
            var lbl = document.getElementById('pomo-autobreak-label');
            if (lbl) lbl.textContent = on ? 'On' : 'Off';
            var btn = document.getElementById('pomo-autobreak');
            if (btn) btn.classList.toggle('active-tool', on);
        });
        autoBreakToggle.id = 'p46-autobreak-toggle';
        extras.appendChild(_row('Auto-Break', 'Start breaks automatically', autoBreakToggle));

        timerSection.appendChild(extras);
        return true;
    });

    /* Keep p46 pomo inputs in sync when the focus view changes the same setting */
    _wait(function() {
        if (window._p46pomoSyncHooked) return true;
        window._p46pomoSyncHooked = true;

        /* Poll for changes every 2 s (lightweight; user rarely has both open) */
        setInterval(function() {
            var si = document.getElementById('p46-pomo-short');
            var li = document.getElementById('p46-pomo-long');
            var at = document.getElementById('p46-autobreak-toggle');
            if (!si || !li || !at) return;
            var t = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });
            /* Only update if input isn't focused (user not typing) */
            if (document.activeElement !== si) si.value = t.short || 5;
            if (document.activeElement !== li) li.value = t.long  || 15;
            var ab = _db('os_pomo_autobreak', false);
            at.classList.toggle('on', !!ab);
        }, 2000);
        return true;
    });

    /* ================================================================
       3.  WIDGETS & WHITEBOARD SECTION
           Injected before Notifications section.
       ================================================================ */
    _wait(function() {
        var scroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!scroll) return false;
        if (document.getElementById('p46-widgets-section')) return true;

        /* Find Notifications section */
        var notifSection = null;
        scroll.querySelectorAll('.settings-section').forEach(function(s) {
            var hdr = s.querySelector('.text-xs.uppercase');
            if (hdr && hdr.textContent.trim() === 'Notifications') notifSection = s;
        });
        if (!notifSection) return false;

        var sec = _section('Widgets & Whiteboard');
        sec.id  = 'p46-widgets-section';

        /* --- Widget visibility rows --------------------------------- */
        var widgetDefs = [
            { id: 'links',       label: 'Quick Links',    hasColor: true,  def: '#3b82f6' },
            { id: 'goals',       label: 'Daily Goals',    hasColor: true,  def: '#22c55e' },
            { id: 'upnext',      label: 'Up Next',        hasColor: true,  def: '#f59e0b' },
            { id: 'studystats',  label: 'Study Stats',    hasColor: false, def: null      },
            { id: 'grades',      label: 'Grades Overview',hasColor: false, def: null      },
            { id: 'minicalendar',label: 'Upcoming Events',hasColor: false, def: null      },
            { id: 'quicknote',   label: 'Quick Note',     hasColor: false, def: null      },
            { id: 'exams',       label: 'Exam Countdown', hasColor: false, def: null      },
            { id: 'music',       label: 'Music Player',   hasColor: false, def: null      },
            { id: 'forum',       label: 'Forum Quick Ask',hasColor: false, def: null      },
        ];

        widgetDefs.forEach(function(w) {
            var cfg = (typeof widgetConfig !== 'undefined' && widgetConfig)
                ? (widgetConfig[w.id] || {}) : {};
            var visible = (cfg.visible !== false);

            var row = document.createElement('div');
            row.className = 'p46-widget-row';

            var left = document.createElement('div');
            left.style.cssText = 'display:flex;align-items:center;gap:8px;';

            var cb = document.createElement('input');
            cb.type    = 'checkbox';
            cb.id      = 'p46-wv-' + w.id;
            cb.checked = visible;
            cb.addEventListener('change', function() {
                if (typeof window.setWidgetVisible === 'function') {
                    window.setWidgetVisible(w.id, cb.checked);
                }
                /* Also sync the modal-widgets checkboxes */
                var mwCb = document.getElementById('wv-' + w.id);
                if (mwCb) mwCb.checked = cb.checked;
            });

            var lbl = document.createElement('label');
            lbl.htmlFor     = 'p46-wv-' + w.id;
            lbl.textContent = w.label;
            left.appendChild(cb);
            left.appendChild(lbl);
            row.appendChild(left);

            if (w.hasColor) {
                var cp = document.createElement('input');
                cp.type  = 'color';
                cp.value = cfg.color || w.def;
                cp.title = 'Tint color';
                cp.style.cssText = 'width:22px;height:22px;border-radius:50%;padding:0;cursor:pointer;border:2px solid rgba(255,255,255,.2);';
                cp.addEventListener('change', function() {
                    if (typeof window.setWidgetColor === 'function') {
                        window.setWidgetColor(w.id, cp.value);
                    }
                    /* Sync modal-widgets color picker */
                    var mwCp = document.getElementById('wc-' + w.id);
                    if (mwCp) mwCp.value = cp.value;
                });
                row.appendChild(cp);
            }

            sec.appendChild(row);
        });

        /* Sync p46 widget checkboxes when modal-widgets checkboxes change */
        widgetDefs.forEach(function(w) {
            var mwCb = document.getElementById('wv-' + w.id);
            if (mwCb && !mwCb._p46synced) {
                mwCb._p46synced = true;
                mwCb.addEventListener('change', function() {
                    var p46cb = document.getElementById('p46-wv-' + w.id);
                    if (p46cb) p46cb.checked = mwCb.checked;
                });
            }
        });

        /* --- Whiteboard sub-section --------------------------------- */
        var wbLabel = document.createElement('div');
        wbLabel.className = 'p46-sub-label';
        wbLabel.textContent = 'Whiteboard Defaults';
        sec.appendChild(wbLabel);

        /* Default background color */
        var bgRight = document.createElement('div');
        bgRight.style.cssText = 'display:flex;align-items:center;gap:8px;';

        var presetBgs = ['#1a1a1a', '#0f172a', '#ffffff', '#fef9ef', '#1e3a5f', '#14532d'];
        presetBgs.forEach(function(hex) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.title = hex;
            btn.style.cssText = 'width:22px;height:22px;border-radius:50%;background:' + hex
                + ';border:2px solid rgba(255,255,255,.2);cursor:pointer;flex-shrink:0;transition:transform .15s;';
            btn.addEventListener('mouseenter', function() { btn.style.transform = 'scale(1.15)'; });
            btn.addEventListener('mouseleave', function() { btn.style.transform = ''; });
            btn.addEventListener('click', function() {
                _dbSet('os_wb_default_bg', hex);
                bgPicker.value = hex;
                /* If whiteboard is open, update current board's bg too */
                if (typeof window.wbSetBg === 'function') window.wbSetBg(hex);
            });
            bgRight.appendChild(btn);
        });

        var bgPicker = document.createElement('input');
        bgPicker.type  = 'color';
        bgPicker.id    = 'p46-wb-default-bg';
        bgPicker.value = _db('os_wb_default_bg', '#1a1a1a');
        bgPicker.title = 'Custom default background';
        bgPicker.style.cssText = 'width:22px;height:22px;border-radius:50%;padding:0;cursor:pointer;border:2px solid rgba(255,255,255,.2);';
        bgPicker.addEventListener('change', function() {
            _dbSet('os_wb_default_bg', bgPicker.value);
        });
        bgRight.appendChild(bgPicker);

        sec.appendChild(_row('Default Background', 'Color for new boards', bgRight));

        /* Grid on by default */
        var gridToggle = _makeToggle('os_wb_grid_default', false, function(on) {
            /* If whiteboard is active, toggle grid immediately */
            if (typeof window.wbGridOn !== 'undefined') {
                var currently = window.wbGridOn;
                if (currently !== on && typeof window.wbToggleGrid === 'function') {
                    window.wbToggleGrid();
                }
            }
        });
        gridToggle.id = 'p46-wb-grid-toggle';
        sec.appendChild(_row('Grid Lines by Default', null, gridToggle));

        scroll.insertBefore(sec, notifSection);
        return true;
    });

    /* ================================================================
       4.  APPLY STARTUP TAB AFTER initApp()
       ================================================================ */
    _wait(function() {
        if (typeof window.initApp !== 'function') return false;
        if (window._p46initHooked) return true;
        window._p46initHooked = true;

        var _origInit = window.initApp;
        window.initApp = function() {
            _origInit.apply(this, arguments);
            /* Apply startup tab preference after a short delay so all
               renders triggered by initApp have a chance to complete. */
            var tab = _db('os_startup_tab', 'dashboard');
            if (tab && tab !== 'dashboard') {
                setTimeout(function() {
                    if (typeof window.switchTab === 'function') window.switchTab(tab);
                }, 120);
            }
        };
        return true;
    });

    /* ================================================================
       5.  HOOK wbNewBoard() TO USE DEFAULT BACKGROUND
       ================================================================ */
    _wait(function() {
        if (typeof window.wbNewBoard !== 'function') return false;
        if (window._p46wbHooked) return true;
        window._p46wbHooked = true;

        var _origNew = window.wbNewBoard;
        window.wbNewBoard = function() {
            _origNew.apply(this, arguments);
            var defBg = _db('os_wb_default_bg', '');
            if (defBg && typeof window.wbSetBg === 'function') {
                window.wbSetBg(defBg);
            }
            /* Apply grid preference */
            var gridDef = _db('os_wb_grid_default', false);
            if (typeof window.wbGridOn !== 'undefined' && window.wbGridOn !== gridDef) {
                if (typeof window.wbToggleGrid === 'function') window.wbToggleGrid();
            }
        };
        return true;
    });

    /* ================================================================
       6.  POPULATE p46 CONTROLS WHEN SETTINGS MODAL OPENS
       ================================================================ */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p46modalHooked) return true;
        window._p46modalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id !== 'modal-settings') return;

            /* Refresh pomo inputs */
            var t  = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });
            var si = document.getElementById('p46-pomo-short');
            var li = document.getElementById('p46-pomo-long');
            if (si) si.value = t.short || 5;
            if (li) li.value = t.long  || 15;

            var at = document.getElementById('p46-autobreak-toggle');
            if (at) at.classList.toggle('on', !!_db('os_pomo_autobreak', false));

            /* Refresh startup tab */
            var tabSel = document.getElementById('p46-startup-tab-sel');
            if (tabSel) tabSel.value = _db('os_startup_tab', 'dashboard');

            /* Refresh task show-done */
            var doneT = document.getElementById('p46-task-done-toggle');
            if (doneT) doneT.classList.toggle('on', !!_db('os_task_show_done', true));

            /* Refresh wb default bg */
            var bgP = document.getElementById('p46-wb-default-bg');
            if (bgP) bgP.value = _db('os_wb_default_bg', '#1a1a1a');

            /* Refresh grid toggle */
            var gridT = document.getElementById('p46-wb-grid-toggle');
            if (gridT) gridT.classList.toggle('on', !!_db('os_wb_grid_default', false));

            /* Refresh widget checkboxes */
            var cfg = (typeof widgetConfig !== 'undefined' && widgetConfig) ? widgetConfig : {};
            ['links','goals','upnext','studystats','grades','minicalendar','quicknote','exams','music','forum']
                .forEach(function(id) {
                    var cb = document.getElementById('p46-wv-' + id);
                    if (cb) cb.checked = (cfg[id] || {}).visible !== false;
                });
        };
        return true;
    });

    /* ================================================================
       7.  APPLY os_task_show_done TO renderTasks IF SUPPORTED
       ================================================================ */
    _wait(function() {
        if (typeof window.renderTasks !== 'function') return false;
        if (window._p46tasksDoneHooked) return true;
        window._p46tasksDoneHooked = true;

        var _origRT = window.renderTasks;
        window.renderTasks = function() {
            /* Expose the preference on window so existing render logic
               can read it — do not alter original renderTasks internals */
            window._p46showDoneTasks = !!_db('os_task_show_done', true);
            _origRT.apply(this, arguments);
        };
        return true;
    });

    console.log('[patches46] loaded — General, expanded Focus Timer, Widgets & Whiteboard settings');
}());
