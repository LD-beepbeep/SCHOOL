/* ================================================================
   StudentOS — patches48.js
   1.  Worksheet picker — remove the duplicate "Checklist" (and
       "Code") section injected by patches28; patches42's unified
       "Utilities & Study Tools" section already contains both.
   2.  Settings reorganisation — splits the combined
       "Widgets & Whiteboard" section (patches46) into two
       separate sections: "Widgets" and "Whiteboard".
   3.  New settings sections:
       • Tasks   — default sort order, highlight overdue tasks
       • Calendar — month-view week-start day (Sun / Mon)
       • Notes    — sidebar sort order
   4.  Enhanced global search — overrides window._p11doSearch to
       also surface: calendar events, quick links, subjects/grades,
       goals, routine items, and individual flashcards.
   ================================================================ */

(function _p48_init() {
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
        maxWait  = maxWait  || 10000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    function _esc(s) {
        var d = document.createElement('div');
        d.textContent = String(s || '');
        return d.innerHTML;
    }

    /* Strip HTML tags for text-only search matching.
       Result is only used as a search corpus, never inserted into DOM.
       Entity decoding is intentionally omitted to avoid double-escaping. */
    function _stripHtml(html) {
        return String(html || '')
            .replace(/<[^>]*>/g, ' ')   /* remove complete tags */
            .replace(/<[^>]*/g, ' ')    /* remove any unclosed tag fragment */
            .replace(/\s+/g, ' ').trim();
    }

    /* ── toggle builder ──────────────────────────────────────── */
    function _makeToggle(key, defaultOn, onToggle) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p48-toggle' + (_db(key, defaultOn) ? ' on' : '');
        var dot = document.createElement('div');
        dot.className = 'p48-toggle-dot';
        btn.appendChild(dot);
        btn.addEventListener('click', function() {
            var next = !btn.classList.contains('on');
            btn.classList.toggle('on', next);
            _dbSet(key, next);
            if (onToggle) onToggle(next);
        });
        return btn;
    }

    /* ── row / section builders ──────────────────────────────── */
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

    function _section(title) {
        var sec = document.createElement('div');
        sec.className = 'settings-section';
        var hdr = document.createElement('div');
        hdr.className = 'text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-3';
        hdr.textContent = title;
        sec.appendChild(hdr);
        return sec;
    }

    function _select(key, defaultVal, options, onChange) {
        var sel = document.createElement('select');
        sel.className = 'p48-select';
        options.forEach(function(o) {
            var opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            if (String(o.value) === String(_db(key, defaultVal))) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', function() {
            _dbSet(key, sel.value);
            if (onChange) onChange(sel.value);
        });
        return sel;
    }

    /* ================================================================
       1.  WORKSHEET PICKER — REMOVE p28 DUPLICATE SECTION
           patches28 injects #p28-new-types-sec with Checklist + Code.
           patches42 already provides both in #p42-picker-sec, so
           the p28 section is redundant.
       ================================================================ */

    _wait(function() {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p48pickerDone) return true;
        window._p48pickerDone = true;

        var _origPicker = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            _origPicker.apply(this, arguments);
            setTimeout(function() {
                /* Remove patches28's standalone "Checklists & Code" section */
                var p28sec = document.querySelector('#p28-new-types-sec');
                if (p28sec) p28sec.remove();
            }, 300);
        };
        return true;
    });

    /* ================================================================
       2.  SETTINGS REORGANISATION
           a.  Rename "Widgets & Whiteboard" → "Widgets"
           b.  Extract whiteboard rows → new "Whiteboard" section
           c.  Inject Tasks, Calendar, Notes sections
       ================================================================ */

    function _reorganiseSettings() {
        var scroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!scroll) return false;
        if (scroll.dataset.p48done) return true;
        scroll.dataset.p48done = '1';

        /* ── 2a + 2b: split Widgets & Whiteboard ──────────────── */
        var widgetSec = document.getElementById('p46-widgets-section');
        if (widgetSec) {
            /* Rename header */
            var hdr = widgetSec.querySelector('.text-xs.uppercase');
            if (hdr) hdr.textContent = 'Widgets';

            /* Find the sub-label "Whiteboard Defaults" and everything after */
            var subLabel = widgetSec.querySelector('.p46-sub-label');
            if (subLabel) {
                /* Collect: sub-label + all following siblings inside widgetSec */
                var toMove = [];
                var node = subLabel;
                while (node) {
                    toMove.push(node);
                    node = node.nextElementSibling;
                }

                /* Build new Whiteboard section */
                var wbSec = _section('Whiteboard');
                wbSec.id = 'p48-whiteboard-section';
                /* Reuse the label text as a plain sub-label if desired */
                toMove.forEach(function(el) {
                    if (el.classList && el.classList.contains('p46-sub-label')) return; /* skip old sub-label */
                    wbSec.appendChild(el); /* moves the node */
                });

                /* Insert Whiteboard section right after widgetSec */
                if (widgetSec.nextSibling) {
                    scroll.insertBefore(wbSec, widgetSec.nextSibling);
                } else {
                    scroll.appendChild(wbSec);
                }

                /* Remove the now-empty sub-label from widgetSec */
                if (subLabel.parentNode === widgetSec) subLabel.remove();
            }
        }

        /* ── 2c: inject new settings sections ─────────────────── */
        _injectTasksSection(scroll);
        _injectCalendarSection(scroll);
        _injectNotesSection(scroll);

        return true;
    }

    /* ── Tasks section ───────────────────────────────────────── */
    function _injectTasksSection(scroll) {
        if (document.getElementById('p48-tasks-section')) return;

        var sec = _section('Tasks');
        sec.id  = 'p48-tasks-section';

        /* Default sort */
        var sortSel = _select('os_task_sort', 'priority',
            [
                { value: 'priority', label: 'Priority (default)' },
                { value: 'date',     label: 'Due date' },
                { value: 'name',     label: 'Name A–Z' },
                { value: 'added',    label: 'Recently added' },
            ],
            function() { if (typeof window.renderTasks === 'function') window.renderTasks(); }
        );
        sortSel.id = 'p48-task-sort-sel';
        sec.appendChild(_row('Default Sort', 'How tasks are ordered', sortSel));

        /* Highlight overdue tasks */
        var overdueToggle = _makeToggle('os_task_overdue_highlight', true, function() {
            _p48applyOverdueHighlight();
        });
        overdueToggle.id = 'p48-overdue-toggle';
        sec.appendChild(_row('Highlight Overdue', 'Red tint on past-due tasks', overdueToggle));

        /* Find General section (patches46) and insert Tasks after it */
        var generalSec = document.getElementById('p46-general-section');
        if (generalSec && generalSec.nextSibling) {
            scroll.insertBefore(sec, generalSec.nextSibling);
        } else {
            /* Fallback: insert before Appearance */
            var appearSec = null;
            scroll.querySelectorAll('.settings-section').forEach(function(s) {
                var h = s.querySelector('.text-xs.uppercase');
                if (h && h.textContent.trim() === 'Appearance') appearSec = s;
            });
            scroll.insertBefore(sec, appearSec || scroll.firstChild);
        }
    }

    /* ── Calendar section ────────────────────────────────────── */
    function _injectCalendarSection(scroll) {
        if (document.getElementById('p48-calendar-section')) return;

        var sec = _section('Calendar');
        sec.id  = 'p48-calendar-section';

        /* Week start day */
        var weekSel = _select('os_cal_week_start', '1',
            [
                { value: '1', label: 'Monday' },
                { value: '0', label: 'Sunday' },
            ],
            function() { if (typeof window.renderCalendar === 'function') window.renderCalendar(); }
        );
        weekSel.id = 'p48-cal-week-start-sel';
        sec.appendChild(_row('Week Starts On', 'First column in month view', weekSel));

        /* Default calendar view */
        var viewSel = _select('os_cal_default_view', 'month',
            [
                { value: 'month',  label: 'Month' },
                { value: 'week',   label: 'Week' },
                { value: 'agenda', label: 'Agenda' },
            ]
        );
        viewSel.id = 'p48-cal-view-sel';
        sec.appendChild(_row('Default View', 'View when opening Calendar', viewSel));

        /* Insert after Appearance section */
        var appearSec = null;
        scroll.querySelectorAll('.settings-section').forEach(function(s) {
            var h = s.querySelector('.text-xs.uppercase');
            if (h && h.textContent.trim() === 'Appearance') appearSec = s;
        });
        if (appearSec && appearSec.nextSibling) {
            scroll.insertBefore(sec, appearSec.nextSibling);
        } else {
            scroll.appendChild(sec);
        }
    }

    /* ── Notes section ───────────────────────────────────────── */
    function _injectNotesSection(scroll) {
        if (document.getElementById('p48-notes-section')) return;

        var sec = _section('Notes');
        sec.id  = 'p48-notes-section';

        /* Sidebar sort */
        var sortSel = _select('os_notes_sort', 'newest',
            [
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
                { value: 'alpha',  label: 'A–Z' },
            ],
            function() { if (typeof window.renderNotes === 'function') window.renderNotes(); }
        );
        sortSel.id = 'p48-notes-sort-sel';
        sec.appendChild(_row('Note Order', 'Sidebar sort for ungrouped notes', sortSel));

        /* Auto-save toggle */
        var asToggle = _makeToggle('os_notes_autosave', true);
        asToggle.id = 'p48-notes-autosave-toggle';
        sec.appendChild(_row('Auto-Save', 'Save while you type', asToggle));

        /* Insert after Calendar section (if injected) or after Appearance */
        var calSec = document.getElementById('p48-calendar-section');
        var insertBefore = calSec ? calSec.nextSibling : null;
        if (!insertBefore) {
            var appearSec = null;
            scroll.querySelectorAll('.settings-section').forEach(function(s) {
                var h = s.querySelector('.text-xs.uppercase');
                if (h && h.textContent.trim() === 'Appearance') appearSec = s;
            });
            insertBefore = appearSec ? appearSec.nextSibling : null;
        }
        if (insertBefore) scroll.insertBefore(sec, insertBefore);
        else scroll.appendChild(sec);
    }

    /* Hook openModal to run reorganisation when settings opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p48modalHooked) return true;
        window._p48modalHooked = true;

        var _prevOpenModal = window.openModal;
        window.openModal = function(id) {
            _prevOpenModal.apply(this, arguments);
            if (id !== 'modal-settings') return;
            /* Run after patches46 has had a chance to inject its sections */
            setTimeout(_reorganiseSettings, 60);
            /* Refresh our controls */
            setTimeout(_p48refreshSettings, 120);
        };
        return true;
    });

    function _p48refreshSettings() {
        var ts = document.getElementById('p48-task-sort-sel');
        if (ts) ts.value = _db('os_task_sort', 'priority');

        var ot = document.getElementById('p48-overdue-toggle');
        if (ot) ot.classList.toggle('on', !!_db('os_task_overdue_highlight', true));

        var ws = document.getElementById('p48-cal-week-start-sel');
        if (ws) ws.value = String(_db('os_cal_week_start', '1'));

        var cv = document.getElementById('p48-cal-view-sel');
        if (cv) cv.value = _db('os_cal_default_view', 'month');

        var ns = document.getElementById('p48-notes-sort-sel');
        if (ns) ns.value = _db('os_notes_sort', 'newest');

        var nat = document.getElementById('p48-notes-autosave-toggle');
        if (nat) nat.classList.toggle('on', !!_db('os_notes_autosave', true));
    }

    /* ── Apply default calendar view when switching to Calendar tab ── */
    _wait(function() {
        if (typeof window.switchTab !== 'function') return false;
        if (window._p48tabHooked) return true;
        window._p48tabHooked = true;

        var _origSwitch = window.switchTab;
        window.switchTab = function(name) {
            _origSwitch.apply(this, arguments);
            if (name === 'calendar') {
                var view = _db('os_cal_default_view', 'month');
                if (typeof window.switchCalView === 'function') {
                    setTimeout(function() { window.switchCalView(view); }, 60);
                }
            }
        };
        return true;
    });

    /* ── Hook renderMonthView for week-start preference ──────── */
    _wait(function() {
        if (typeof window.renderMonthView !== 'function') return false;
        if (window._p48monthHooked) return true;
        window._p48monthHooked = true;

        var _origMonth = window.renderMonthView;
        window.renderMonthView = function() {
            var startDay = parseInt(_db('os_cal_week_start', '1'), 10); /* 0=Sun, 1=Mon */
            /* Update the day-header labels if they exist */
            var hdr = document.getElementById('cal-day-headers');
            if (hdr) {
                var allDays = startDay === 0
                    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                var cells = hdr.children;
                for (var i = 0; i < cells.length && i < allDays.length; i++) {
                    cells[i].textContent = allDays[i];
                }
            }
            _origMonth.apply(this, arguments);
        };
        return true;
    });

    /* ── Hook renderTasks for sort preference ────────────────── */
    _wait(function() {
        if (typeof window.renderTasks !== 'function') return false;
        if (window._p48tasksHooked) return true;
        window._p48tasksHooked = true;

        var _origRT = window.renderTasks;
        window.renderTasks = function() {
            var sort = _db('os_task_sort', 'priority');

            if (sort !== 'priority') {
                /* Re-sort the global tasks array (as a temporary copy) so
                   the original renderTasks renders in the preferred order.
                   We swap it back immediately after to keep state intact. */
                var savedTasks = window.tasks ? window.tasks.slice() : null;
                if (window.tasks && savedTasks) {
                    window.tasks.sort(function(a, b) {
                        if (sort === 'date') {
                            var da = a.date || '9999-99-99';
                            var db_ = b.date || '9999-99-99';
                            return da < db_ ? -1 : da > db_ ? 1 : 0;
                        } else if (sort === 'name') {
                            var ta = (a.text || a.title || '').toLowerCase();
                            var tb = (b.text || b.title || '').toLowerCase();
                            return ta < tb ? -1 : ta > tb ? 1 : 0;
                        } else if (sort === 'added') {
                            return (a.id || 0) - (b.id || 0);
                        }
                        return 0;
                    });
                    _origRT.apply(this, arguments);
                    /* Restore original order */
                    window.tasks.length = 0;
                    savedTasks.forEach(function(t) { window.tasks.push(t); });
                } else {
                    _origRT.apply(this, arguments);
                }
            } else {
                _origRT.apply(this, arguments);
            }

            /* Apply overdue highlight after render */
            _p48applyOverdueHighlight();
        };
        return true;
    });

    /* ── Hook renderNotes for sort preference ────────────────── */
    _wait(function() {
        if (typeof window.renderNotes !== 'function') return false;
        if (window._p48notesHooked) return true;
        window._p48notesHooked = true;

        var _origRN = window.renderNotes;
        window.renderNotes = function() {
            var sort = _db('os_notes_sort', 'newest');
            if (sort !== 'newest' && window.notes && Array.isArray(window.notes)) {
                var savedNotes = window.notes.slice();
                window.notes.sort(function(a, b) {
                    if (sort === 'oldest') {
                        return (a.id || 0) - (b.id || 0);
                    } else if (sort === 'alpha') {
                        var ta = (a.title || '').toLowerCase();
                        var tb = (b.title || '').toLowerCase();
                        return ta < tb ? -1 : ta > tb ? 1 : 0;
                    }
                    return 0;
                });
                _origRN.apply(this, arguments);
                window.notes.length = 0;
                savedNotes.forEach(function(n) { window.notes.push(n); });
            } else {
                _origRN.apply(this, arguments);
            }
        };
        return true;
    });

    function _p48applyOverdueHighlight() {
        var on = _db('os_task_overdue_highlight', true);
        var today = new Date().toISOString().slice(0, 10);
        document.querySelectorAll('.task-row').forEach(function(row) {
            var dateEl = row.querySelector('.text-\\[10px\\].text-\\[var\\(--text-muted\\)\\]');
            if (!dateEl) return;
            var dateText = (dateEl.textContent || '').trim();
            /* Accept YYYY-MM-DD format */
            var isOverdue = on && dateText && dateText < today;
            row.classList.toggle('p48-overdue', isOverdue);
        });
    }

    /* ================================================================
       4.  ENHANCED GLOBAL SEARCH
           Overrides window._p11doSearch (patches11 checks this first
           via:  (window._p11doSearch || _p11doSearch)(input.value)
           ) with an extended version that adds:
           • Calendar events
           • Quick links
           • Subjects / grades
           • Goals
           • Routine items
           • Individual flashcards
       ================================================================ */

    _wait(function() {
        /* Wait until the search overlay has been built at least once,
           or until _p11openSearch is available. */
        if (typeof window._p11openSearch !== 'function') return false;
        if (window._p48searchDone) return true;
        window._p48searchDone = true;

        /* Update placeholder text */
        _wait(function() {
            var inp = document.getElementById('p11-search-input');
            if (!inp) return false;
            inp.placeholder = 'Search tasks, notes, events, links, formulas…';
            return true;
        });

        /* Build extended search items */
        function _collectExtended() {
            var items = [];

            /* Calendar events (os_events is keyed by date string) */
            try {
                var events = _db('os_events', {});
                Object.keys(events).forEach(function(dateKey) {
                    var dayEvs = events[dateKey];
                    if (!Array.isArray(dayEvs)) return;
                    dayEvs.forEach(function(ev) {
                        if (!ev || !ev.title) return;
                        items.push({
                            type: 'event',
                            title: ev.title,
                            sub: dateKey + (ev.time ? ' · ' + ev.time : ''),
                            icon: 'ph-calendar-blank',
                            color: ev.color || '#ec4899',
                            action: function() { if (typeof window.switchTab === 'function') window.switchTab('calendar'); }
                        });
                    });
                });
            } catch(_) {}

            /* Quick Links */
            try {
                var links = _db('os_links', []);
                links.forEach(function(l) {
                    if (!l || !l.name) return;
                    items.push({
                        type: 'link',
                        title: l.name,
                        sub: l.url || '',
                        icon: 'ph-link',
                        color: '#3b82f6',
                        action: function() {
                            if (l.url) {
                                var m = l.mode || 'newtab';
                                if (m === 'modal' && typeof window.openLinkModal === 'function') {
                                    window.openLinkModal(l.url);
                                } else {
                                    window.open(l.url, '_blank');
                                }
                            }
                        }
                    });
                });
            } catch(_) {}

            /* Subjects / Grades */
            try {
                var subjects = _db('os_subjects', []);
                subjects.forEach(function(s) {
                    if (!s || !s.name) return;
                    items.push({
                        type: 'subject',
                        title: s.name,
                        sub: s.grade != null ? 'Grade: ' + s.grade : '',
                        icon: 'ph-chart-bar',
                        color: '#14b8a6',
                        action: function() { if (typeof window.switchTab === 'function') window.switchTab('grades'); }
                    });
                });
            } catch(_) {}

            /* Goals */
            try {
                var goals = _db('os_goals', []);
                goals.forEach(function(g) {
                    if (!g || !g.text) return;
                    items.push({
                        type: 'goal',
                        title: g.text,
                        sub: g.done ? 'Completed' : 'Pending',
                        icon: 'ph-star',
                        color: '#22c55e',
                        action: function() { if (typeof window.switchTab === 'function') window.switchTab('dashboard'); }
                    });
                });
            } catch(_) {}

            /* Routine items */
            try {
                var routines = _db('os_routine', []);
                routines.forEach(function(r) {
                    if (!r || !r.title) return;
                    items.push({
                        type: 'routine',
                        title: r.title,
                        sub: (r.time || '') + (r.cat ? ' · ' + r.cat : ''),
                        icon: 'ph-calendar-check',
                        color: '#22c55e',
                        action: function() { if (typeof window.switchTab === 'function') window.switchTab('routine'); }
                    });
                });
            } catch(_) {}

            /* Individual flashcards */
            try {
                var decks = _db('os_decks', []);
                decks.forEach(function(d) {
                    if (!d || !Array.isArray(d.cards)) return;
                    d.cards.forEach(function(c) {
                        if (!c) return;
                        var front = _stripHtml(c.front || c.q || '');
                        var back  = _stripHtml(c.back  || c.a || '');
                        if (!front) return;
                        items.push({
                            type: 'card',
                            title: front.slice(0, 80),
                            sub: (d.name || 'Deck') + (back ? ' · ' + back.slice(0, 50) : ''),
                            icon: 'ph-cards',
                            color: '#ec4899',
                            deckId: d.id,
                            action: function() { if (typeof window.switchTab === 'function') window.switchTab('cards'); }
                        });
                    });
                });
            } catch(_) {}

            return items;
        }

        /* ── New _p11doSearch that merges original + extended items ── */
        window._p11doSearch = function(q) {
            var _selIdx = -1;
            var results = document.getElementById('p11-search-results');
            if (!results) return;

            /* --- Quick-navigation tabs (same as patches11) --- */
            var tabs = [
                { label:'Dashboard',   icon:'ph-squares-four',      color:'#3b82f6', action:function(){if(typeof window.switchTab==='function')window.switchTab('dashboard');} },
                { label:'Tasks',       icon:'ph-check-circle',      color:'#22c55e', action:function(){if(typeof window.switchTab==='function')window.switchTab('tasks');} },
                { label:'Calendar',    icon:'ph-calendar-blank',    color:'#ec4899', action:function(){if(typeof window.switchTab==='function')window.switchTab('calendar');} },
                { label:'Notes',       icon:'ph-notebook',          color:'#f59e0b', action:function(){if(typeof window.switchTab==='function')window.switchTab('notes');} },
                { label:'Whiteboard',  icon:'ph-pencil-simple',     color:'#8b5cf6', action:function(){if(typeof window.switchTab==='function')window.switchTab('whiteboard');} },
                { label:'Cards',       icon:'ph-cards',             color:'#ec4899', action:function(){if(typeof window.switchTab==='function')window.switchTab('cards');} },
                { label:'Grades',      icon:'ph-chart-bar',         color:'#14b8a6', action:function(){if(typeof window.switchTab==='function')window.switchTab('grades');} },
                { label:'Calculator',  icon:'ph-calculator',        color:'#6b7280', action:function(){if(typeof window.switchTab==='function')window.switchTab('calc');} },
                { label:'Focus Timer', icon:'ph-timer',             color:'#f97316', action:function(){if(typeof window.switchTab==='function')window.switchTab('focus');} },
                { label:'Music',       icon:'ph-music-note',        color:'#8b5cf6', action:function(){if(typeof window.switchTab==='function')window.switchTab('music');} },
                { label:'Formulas',    icon:'ph-math-operations',   color:'#8b5cf6', action:function(){if(typeof window.switchTab==='function')window.switchTab('formulas');} },
                { label:'Forum',       icon:'ph-chats-teardrop',    color:'#3b82f6', action:function(){if(typeof window.switchTab==='function')window.switchTab('forum');} },
                { label:'Routine',     icon:'ph-calendar-check',    color:'#22c55e', action:function(){if(typeof window.switchTab==='function')window.switchTab('routine');} },
                { label:'Attendance',  icon:'ph-user-check',        color:'#14b8a6', action:function(){if(typeof window.switchTab==='function')window.switchTab('attendance');} },
                { label:'Worksheet',   icon:'ph-stack',             color:'#f59e0b', action:function(){if(typeof window.switchTab==='function')window.switchTab('worksheet');} },
                { label:'Settings',    icon:'ph-gear',              color:'#6b7280', action:function(){if(typeof window.openModal==='function')window.openModal('modal-settings');} },
            ];

            var query = q.trim().toLowerCase();
            var matchTabs  = !query ? tabs : tabs.filter(function(t) { return t.label.toLowerCase().indexOf(query) !== -1; });

            /* --- Content items: base (patches11) + extended --- */
            var baseItems = [];
            try {
                /* Tasks */
                (_db('os_tasks', [])).forEach(function(t) {
                    baseItems.push({ type:'task', title:t.text||t.title||'Task', sub:t.date||'', icon:'ph-check-circle', color:'#22c55e', action:function(){if(typeof window.switchTab==='function')window.switchTab('tasks');} });
                });
                /* Notes */
                (_db('os_notes', [])).forEach(function(n) {
                    baseItems.push({ type:'note', title:n.title||'Untitled Note', sub:_stripHtml(n.body||'').slice(0,60), icon:'ph-notebook', color:'#f59e0b', id:n.id, action:function(){window.switchTab&&window.switchTab('notes');setTimeout(function(){if(typeof window.loadNote==='function')window.loadNote(n.id);},200);} });
                });
                /* Formulas */
                (_db('os_formulas', [])).forEach(function(f) {
                    baseItems.push({ type:'formula', title:f.title||'Formula', sub:f.formula||'', icon:'ph-math-operations', color:'#8b5cf6', action:function(){if(typeof window.switchTab==='function')window.switchTab('formulas');} });
                });
                /* Decks (by name) */
                (_db('os_decks', [])).forEach(function(d) {
                    baseItems.push({ type:'deck', title:d.name||'Deck', sub:(d.cards&&d.cards.length||0)+' cards', icon:'ph-cards', color:'#ec4899', action:function(){if(typeof window.switchTab==='function')window.switchTab('cards');} });
                });
            } catch(_) {}

            var extItems = _collectExtended();
            var allItems = baseItems.concat(extItems);

            var matchItems = !query ? [] : allItems.filter(function(it) {
                var combined = ((it.title||'') + ' ' + (it.sub||'')).toLowerCase();
                return combined.indexOf(query) !== -1;
            }).slice(0, 18);

            /* Empty states */
            if (!query && !matchTabs.length) {
                results.innerHTML = '<div class="p11-search-empty"><i class="ph ph-magnifying-glass"></i><span>Start typing to search…</span></div>';
                return;
            }
            if (query && !matchItems.length && !matchTabs.length) {
                results.innerHTML = '<div class="p11-search-empty"><i class="ph ph-smiley-sad"></i><span>No results for "<strong>' + _esc(q) + '</strong>"</span></div>';
                return;
            }

            /* Store tab actions for onclick */
            window._p48_tabActions = matchTabs.map(function(t) { return t.action; });

            function highlight(text, q) {
                if (!q) return _esc(text);
                var lo = (text||'').toLowerCase();
                var idx = lo.indexOf(q.toLowerCase());
                if (idx < 0) return _esc(text);
                return _esc(text.slice(0, idx))
                    + '<mark class="p11-result-mark">' + _esc(text.slice(idx, idx + q.length)) + '</mark>'
                    + _esc(text.slice(idx + q.length));
            }

            var html = '';

            if (matchTabs.length) {
                html += '<div class="p11-result-group-lbl">' + (query ? 'Pages' : 'Quick Navigation') + '</div>';
                html += matchTabs.map(function(t, i) {
                    return '<div class="p11-result-item" data-idx="' + i + '" onclick="if(window._p48_tabActions&&window._p48_tabActions[' + i + '])window._p48_tabActions[' + i + ']();if(typeof window._p11closeSearch===\'function\')window._p11closeSearch()">'
                        + '<div class="p11-result-icon" style="background:' + t.color + '22;color:' + t.color + '"><i class="ph ' + t.icon + '"></i></div>'
                        + '<div class="p11-result-text"><div class="p11-result-title">' + highlight(t.label, query) + '</div></div>'
                        + '<i class="ph ph-arrow-right p11-result-arrow"></i>'
                        + '</div>';
                }).join('');
            }

            if (matchItems.length) {
                var grouped = {};
                matchItems.forEach(function(it) {
                    if (!grouped[it.type]) grouped[it.type] = [];
                    grouped[it.type].push(it);
                });

                var typeLabels = {
                    task:'Tasks', note:'Notes', formula:'Formulas',
                    deck:'Flashcard Decks', card:'Flashcards',
                    event:'Calendar Events', link:'Quick Links',
                    subject:'Subjects', goal:'Goals',
                    routine:'Routine', card:'Flashcards'
                };

                /* Store item actions */
                window._p48_itemActions = [];
                var globalIdx = matchTabs.length;

                Object.keys(grouped).forEach(function(type) {
                    var grpItems = grouped[type];
                    html += '<div class="p11-result-group-lbl">' + (typeLabels[type] || type) + '</div>';
                    html += grpItems.map(function(it) {
                        var gi = globalIdx++;
                        window._p48_itemActions[gi] = it.action;
                        return '<div class="p11-result-item" data-idx="' + gi + '" onclick="if(window._p48_itemActions&&window._p48_itemActions[' + gi + '])window._p48_itemActions[' + gi + ']();if(typeof window._p11closeSearch===\'function\')window._p11closeSearch()">'
                            + '<div class="p11-result-icon" style="background:' + it.color + '22;color:' + it.color + '"><i class="ph ' + it.icon + '"></i></div>'
                            + '<div class="p11-result-text">'
                            + '<div class="p11-result-title">' + highlight(it.title, query) + '</div>'
                            + (it.sub ? '<div class="p11-result-sub">' + _esc(it.sub) + '</div>' : '')
                            + '</div>'
                            + '<i class="ph ph-arrow-right p11-result-arrow"></i>'
                            + '</div>';
                    }).join('');
                });
            }

            results.innerHTML = html;
        };

        return true;
    });

    console.log('[patches48] loaded — picker dedup, settings reorg, more settings, enhanced search');
}());
