/* ================================================================
   StudentOS — patches63.js
   1.  Settings sync fixes — extend _p10syncSettingsValues to also
       restore the state of toggles and pickers that were previously
       left at their HTML default instead of the saved value:
       • Timer Sound toggle   (os_timer_sound)
       • Auto-break toggle    (os_pomo_autobreak)
       • Background tint picker (os_bg_color)
       • Student-name input   (os_name — read from DB, not DOM)
       • Focus duration       (os_pomo_times.focus — read from DB)
   2.  New settings rows injected into the tabbed p10 settings view:
       a.  Appearance → "Show Seconds on Clock" already exists; add
           "Focus Mode" toggle (p63_focus_mode) — dims nav during
           Pomodoro focus so you stay on task.
       b.  Focus & Timer → nothing new (already complete).
       c.  Data / General → "Startup Tab" select and
           "Show Completed Tasks" toggle exposed from patches46.
       d.  New "Tasks" section → highlight-overdue and default-sort
           rows from patches48, now visible in the p10 view.
       e.  New "Notes" section → notes sort order from patches48.
   3.  Focus-mode behaviour — adds / removes .p63-focus-mode on
       <body> when a Pomodoro focus session starts / ends so that
       patches63.css can dim the sidebar.
   ================================================================ */

(function _p63_init() {
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
        interval = interval || 100;
        maxWait  = maxWait  || 20000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ── p10 toggle builder ──────────────────────────────────── */
    function _toggle(storageKey, defaultVal, onChange) {
        var btn = document.createElement('div');
        btn.className = 'p10-toggle' + (_db(storageKey, defaultVal) ? ' on' : '');
        btn.addEventListener('click', function() {
            var next = !btn.classList.contains('on');
            btn.classList.toggle('on', next);
            _dbSet(storageKey, next);
            if (typeof onChange === 'function') onChange(next);
        });
        return btn;
    }

    /* ── p10 row builder ─────────────────────────────────────── */
    function _row(label, sub, control) {
        var row  = document.createElement('div');
        row.className = 'p10-row';
        var lhs  = document.createElement('div');
        var lbl  = document.createElement('div');
        lbl.className = 'p10-row-lbl';
        lbl.textContent = label;
        lhs.appendChild(lbl);
        if (sub) {
            var s = document.createElement('div');
            s.className = 'p10-row-sub';
            s.textContent = sub;
            lhs.appendChild(s);
        }
        row.appendChild(lhs);
        row.appendChild(control);
        return row;
    }

    /* ── p10 select builder ──────────────────────────────────── */
    function _select(storageKey, defaultVal, options, onChange) {
        var sel = document.createElement('select');
        sel.className = 'p10-select';
        var cur = _db(storageKey, defaultVal);
        options.forEach(function(o) {
            var opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            if (String(o.value) === String(cur)) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', function() {
            _dbSet(storageKey, sel.value);
            if (typeof onChange === 'function') onChange(sel.value);
        });
        return sel;
    }

    /* ── p10 section builder ─────────────────────────────────── */
    function _section(title) {
        var sec = document.createElement('div');
        sec.className = 'p10-section';
        var t = document.createElement('div');
        t.className = 'p10-section-title';
        t.textContent = title;
        sec.appendChild(t);
        return sec;
    }

    /* ================================================================
       1.  FIX _p10syncSettingsValues
           Wrap the existing function (once it exists) to also sync
           the controls that the original implementation missed.
       ================================================================ */
    _wait(function() {
        if (typeof window._p10syncSettingsValues !== 'function') return false;
        if (window._p63syncPatched) return true;
        window._p63syncPatched = true;

        var _orig = window._p10syncSettingsValues;
        window._p10syncSettingsValues = function() {
            _orig.apply(this, arguments);
            try {
                /* Timer Sound toggle */
                var ts = document.getElementById('p10-timer-sound-toggle');
                if (ts) ts.classList.toggle('on', !!_db('os_timer_sound', true));

                /* Auto-break toggle */
                var ab = document.getElementById('p10-autobreak-toggle');
                if (ab) ab.classList.toggle('on', !!_db('os_pomo_autobreak', false));

                /* Background tint picker */
                var bp = document.getElementById('p10-bg-color');
                if (bp) {
                    var bgVal = _db('os_bg_color', '');
                    if (bgVal) bp.value = bgVal;
                }

                /* Student-name input — read directly from DB so it
                   works even if profile-name-input hasn't been filled */
                var ni = document.getElementById('p10-name-input');
                if (ni) {
                    var nameVal = _db('os_name', '');
                    if (nameVal) ni.value = nameVal;
                }

                /* Pomo focus duration — use the global or DB directly */
                var pf = document.getElementById('p10-pomo-focus');
                if (pf) {
                    var times = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });
                    pf.value = (times && times.focus) ? times.focus : 25;
                }

                /* Startup tab select */
                var stSel = document.getElementById('p63-startup-tab');
                if (stSel) stSel.value = _db('os_startup_tab', 'dashboard');

                /* Show completed tasks toggle */
                var sct = document.getElementById('p63-show-done');
                if (sct) sct.classList.toggle('on', !!_db('os_task_show_done', true));

                /* Highlight overdue toggle */
                var hot = document.getElementById('p63-highlight-overdue');
                if (hot) hot.classList.toggle('on', !!_db('os_task_highlight_overdue', true));

                /* Task default sort */
                var tds = document.getElementById('p63-task-sort');
                if (tds) tds.value = _db('os_task_sort', 'created');

                /* Notes sort */
                var nso = document.getElementById('p63-notes-sort');
                if (nso) nso.value = _db('os_notes_sort', 'updated');

                /* Focus mode toggle */
                var fmt = document.getElementById('p63-focus-mode');
                if (fmt) fmt.classList.toggle('on', !!_db('p63_focus_mode', false));

            } catch (e) { console.warn('[p63] settings sync error:', e); }
        };
        return true;
    }, 100, 15000);

    /* ================================================================
       2.  INJECT NEW SETTINGS ROWS
       ================================================================ */

    /* ── 2a. Appearance page — Focus Mode toggle ─────────────── */
    function _injectFocusMode() {
        var appPage = document.getElementById('p10-page-appearance');
        if (!appPage) return false;
        if (document.getElementById('p63-focus-mode-row')) return true;

        /* Find the "Typography & Layout" section (last in page) and
           append the Focus Mode row to it */
        var sections = appPage.querySelectorAll('.p10-section');
        var targetSec = sections[sections.length - 1];
        if (!targetSec) return false;

        var fmToggle = _toggle('p63_focus_mode', false, function(on) {
            _applyFocusMode(on);
        });
        fmToggle.id = 'p63-focus-mode';

        var fmRow = _row('Focus Mode', 'Dim the navigation during Pomodoro focus', fmToggle);
        fmRow.id = 'p63-focus-mode-row';
        targetSec.appendChild(fmRow);
        return true;
    }

    /* ── 2b. Timer page — nothing new needed ─────────────────── */

    /* ── 2c. Data page — Startup Tab + Show Done Tasks ───────── */
    function _injectDataExtras() {
        var dataPage = document.getElementById('p10-page-data');
        if (!dataPage) return false;
        if (document.getElementById('p63-general-section')) return true;

        var TABS = [
            { value: 'dashboard',  label: 'Dashboard'   },
            { value: 'tasks',      label: 'Tasks'        },
            { value: 'calendar',   label: 'Calendar'     },
            { value: 'notes',      label: 'Notes'        },
            { value: 'whiteboard', label: 'Whiteboard'   },
            { value: 'cards',      label: 'Flashcards'   },
            { value: 'grades',     label: 'Grades'       },
            { value: 'calc',       label: 'Calculator'   },
            { value: 'focus',      label: 'Focus Timer'  },
            { value: 'forum',      label: 'Forum'        },
            { value: 'music',      label: 'Music'        },
            { value: 'formulas',   label: 'Formulas'     },
        ];
        var tabSel = _select('os_startup_tab', 'dashboard', TABS, function(val) {
            /* Nothing extra needed; initApp reads this key */
        });
        tabSel.id = 'p63-startup-tab';

        var doneTog = _toggle('os_task_show_done', true, function(on) {
            window._p46showDoneTasks = on;
            if (typeof window.renderTasks === 'function') window.renderTasks();
        });
        doneTog.id = 'p63-show-done';

        var sec = _section('General');
        sec.id = 'p63-general-section';
        sec.appendChild(_row('Startup Tab', 'Which tab to open on load', tabSel));
        sec.appendChild(_row('Show Completed Tasks', 'Display finished tasks in the list', doneTog));

        /* Insert before the first section in the Data page */
        var firstSection = dataPage.querySelector('.p10-section');
        if (firstSection) {
            dataPage.insertBefore(sec, firstSection);
        } else {
            dataPage.appendChild(sec);
        }
        return true;
    }

    /* ── 2d. Tasks section in p10 settings ───────────────────── */
    function _injectTasksSection() {
        var dataPage = document.getElementById('p10-page-data');
        if (!dataPage) return false;
        if (document.getElementById('p63-tasks-section')) return true;

        var overdueToggle = _toggle('os_task_highlight_overdue', true, function(on) {
            if (typeof window.renderTasks === 'function') window.renderTasks();
        });
        overdueToggle.id = 'p63-highlight-overdue';

        var sortSel = _select('os_task_sort', 'created', [
            { value: 'created',  label: 'Date Created'  },
            { value: 'due',      label: 'Due Date'       },
            { value: 'priority', label: 'Priority'       },
            { value: 'alpha',    label: 'Alphabetical'   },
        ], function() {
            if (typeof window.renderTasks === 'function') window.renderTasks();
        });
        sortSel.id = 'p63-task-sort';

        var sec = _section('Tasks');
        sec.id = 'p63-tasks-section';
        sec.appendChild(_row('Highlight Overdue', 'Mark tasks past their due date in red', overdueToggle));
        sec.appendChild(_row('Default Sort Order', '', sortSel));

        dataPage.appendChild(sec);
        return true;
    }

    /* ── 2e. Notes section in p10 settings ───────────────────── */
    function _injectNotesSection() {
        var dataPage = document.getElementById('p10-page-data');
        if (!dataPage) return false;
        if (document.getElementById('p63-notes-section')) return true;

        var sortSel = _select('os_notes_sort', 'updated', [
            { value: 'updated', label: 'Last Updated' },
            { value: 'created', label: 'Date Created' },
            { value: 'alpha',   label: 'Alphabetical' },
        ], function() {
            if (typeof window.renderNotes === 'function') window.renderNotes();
        });
        sortSel.id = 'p63-notes-sort';

        var sec = _section('Notes');
        sec.id = 'p63-notes-section';
        sec.appendChild(_row('Default Sort Order', '', sortSel));

        dataPage.appendChild(sec);
        return true;
    }

    /* Run injections once the p10 settings view exists */
    _wait(function() {
        var appPage  = document.getElementById('p10-page-appearance');
        var dataPage = document.getElementById('p10-page-data');
        if (!appPage || !dataPage) return false;
        if (document.getElementById('p63-general-section') &&
            document.getElementById('p63-tasks-section')   &&
            document.getElementById('p63-notes-section')   &&
            document.getElementById('p63-focus-mode-row')) return true;

        _injectFocusMode();
        _injectDataExtras();
        _injectTasksSection();
        _injectNotesSection();
        return true;
    }, 150, 20000);

    /* Re-inject on every settings open in case the view is rebuilt */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p63openModalHooked) return true;
        window._p63openModalHooked = true;
        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(function() {
                    _injectFocusMode();
                    _injectDataExtras();
                    _injectTasksSection();
                    _injectNotesSection();
                }, 80);
            }
        };
        return true;
    }, 150, 20000);

    /* ================================================================
       3.  FOCUS-MODE BEHAVIOUR
           • Adds .p63-focus-mode to <body> when a Pomodoro focus
             session is running (tRun === true and mode === 'focus').
           • Removes it during breaks or when the timer is stopped.
           • Only activates when the setting is enabled.
       ================================================================ */
    function _applyFocusMode(on) {
        document.body.classList.toggle('p63-focus-mode', !!on && _isFocusing());
    }

    function _isFocusing() {
        return (typeof window.tRun !== 'undefined' && window.tRun) &&
               (typeof window.pomodoroMode === 'undefined' || window.pomodoroMode === 'focus');
    }

    /* Patch the timer tick / start / stop to apply focus mode */
    _wait(function() {
        if (typeof window.startTimer !== 'function' && typeof window.toggleTimer !== 'function') return false;
        if (window._p63timerHooked) return true;
        window._p63timerHooked = true;

        function _check() {
            if (_db('p63_focus_mode', false)) {
                _applyFocusMode(true);
            } else {
                document.body.classList.remove('p63-focus-mode');
            }
        }

        /* Hook start/stop */
        ['startTimer', 'toggleTimer', 'resetTimer', 'startPomo', 'stopTimer'].forEach(function(fn) {
            if (typeof window[fn] === 'function') {
                var orig = window[fn];
                window[fn] = function() {
                    orig.apply(this, arguments);
                    setTimeout(_check, 50);
                };
            }
        });

        /* Also check on mode change */
        ['setMode', 'setPomodoroMode', 'switchPomoMode'].forEach(function(fn) {
            if (typeof window[fn] === 'function') {
                var orig = window[fn];
                window[fn] = function() {
                    orig.apply(this, arguments);
                    setTimeout(_check, 50);
                };
            }
        });

        return true;
    }, 200, 15000);

    /* Apply focus mode on initial load if it was left on */
    _wait(function() {
        if (!document.body) return false;
        if (_db('p63_focus_mode', false) && _isFocusing()) {
            document.body.classList.add('p63-focus-mode');
        }
        return true;
    }, 300, 5000);

    console.log('[patches63] loaded — settings sync fixes, new settings rows, formula block neutral colours, focus mode');
}());
