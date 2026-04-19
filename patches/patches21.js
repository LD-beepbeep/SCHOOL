/* ================================================================
   StudentOS — patches21.js
   FIXES & IMPROVEMENTS:
   1.  Task DnD          — clean pointer-events impl for mouse + touch
   2.  Ambient glow      — simplified single soft glow
   3.  Attendance        — monthly calendar grid view per course
   4.  Habit widget      — 4-week contribution grid, FA icons
   5.  Sidebar tab       — "Sidebar" page in p10 settings panel
   6.  Routine done      — always-visible done-circle on today blocks
   7.  Worksheet PDF     — Export as PDF via browser print
   8.  Formula modal     — auto-detect vars, hide name field
   ================================================================ */

'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const _p21lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p21lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p21dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p21lsG(k, d); } catch { return d; } };
const _p21dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p21lsS(k, v); } catch {} };
const _p21esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p21id  = () => Math.random().toString(36).slice(2, 10);
const _p21toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
const _p21date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
function _p21safeColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6'; }

/* ================================================================
   1.  TASK DRAG-AND-DROP
       Full pointer-events implementation supporting mouse, touch
       and pen. Disables conflicting HTML5 dragstart events.
       Persists order to localStorage (p18_task_order) and DB.
   ================================================================ */
function _p21_taskDnD() {
    let _src  = null;
    let _moved = false;
    let _sx = 0, _sy = 0;

    function _list() { return document.getElementById('full-task-list'); }

    function _saveOrder() {
        const l = _list(); if (!l) return;
        const ids = [...l.querySelectorAll('.task-row')]
            .map(r => r.id?.replace('task-row-', '')).filter(Boolean);
        _p21lsS('p18_task_order', ids);
        /* Persist to DB so order survives across sessions */
        _p21dbS('os_task_order', ids);
    }

    function _attachPointer(row) {
        const handle = row.querySelector('.task-drag-handle');
        if (!handle || handle.dataset.p21) return;
        handle.dataset.p21 = '1';

        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            try { handle.setPointerCapture(e.pointerId); } catch {}
            _src   = row;
            _moved = false;
            _sx    = e.clientX;
            _sy    = e.clientY;
        });

        handle.addEventListener('pointermove', e => {
            if (!_src || _src !== row) return;
            if (!_moved) {
                if (Math.hypot(e.clientX - _sx, e.clientY - _sy) < 5) return;
                _moved = true;
                _src.dataset.dragstate = 'src';
            }
            const l = _list(); if (!l) return;
            const under  = document.elementFromPoint(e.clientX, e.clientY);
            const target = under?.closest('.task-row');
            l.querySelectorAll('.task-row').forEach(r => {
                r.dataset.dragstate = r === _src ? 'src' : '';
            });
            if (target && target !== _src && l.contains(target)) {
                target.dataset.dragstate = 'over';
            }
        });

        handle.addEventListener('pointerup', e => {
            const l = _list();
            if (_moved && _src && l) {
                const under  = document.elementFromPoint(e.clientX, e.clientY);
                const target = under?.closest('.task-row');
                if (target && target !== _src && l.contains(target)) {
                    const siblings = [...l.querySelectorAll('.task-row')];
                    if (siblings.indexOf(_src) < siblings.indexOf(target))
                        l.insertBefore(_src, target.nextSibling);
                    else
                        l.insertBefore(_src, target);
                    _saveOrder();
                }
                if (l) l.querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = ''; });
            }
            _src?.dataset && (_src.dataset.dragstate = '');
            _src   = null;
            _moved = false;
        });

        handle.addEventListener('pointercancel', () => {
            _list()?.querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = ''; });
            _src   = null;
            _moved = false;
        });
    }

    function _attachAll() {
        const l = _list(); if (!l) return;
        l.querySelectorAll('.task-row').forEach(row => _attachPointer(row));
    }

    /* Block HTML5 dragstart so it doesn't conflict */
    function _blockHTML5(l) {
        if (l.dataset.p21noDrag) return;
        l.dataset.p21noDrag = '1';
        l.addEventListener('dragstart', e => e.preventDefault(), true);
    }

    function _watch() {
        const l = _list();
        if (!l) { setTimeout(_watch, 600); return; }
        _blockHTML5(l);
        _attachAll();
        new MutationObserver(_attachAll).observe(l, { childList: true });
    }
    _watch();
}

/* ================================================================
   2.  AMBIENT GLOW — simplified single soft radial
       Replaces the 3-gradient version from patches19.
       A single elliptical glow at the top using the user's colour.
   ================================================================ */
function _p21_fixAmbientGlow() {
    function _patch() {
        if (typeof window.setBg !== 'function' || window._p21setBgDone) {
            if (!window._p21setBgDone) setTimeout(_patch, 400);
            return;
        }
        window._p21setBgDone = true;

        window.setBg = function(c) {
            const safe = _p21safeColor(c);
            /* Single soft glow at top-centre, no complex multi-layer */
            const glow = `radial-gradient(ellipse at 50% -5%, ${safe}55 0%, transparent 62%)`;

            document.documentElement.style.setProperty('--custom-bg', glow);
            const el = document.getElementById('ambient-bg');
            if (el) el.style.setProperty('background', glow, 'important');

            /* Persist */
            _p21dbS('os_bg_color', c);
        };

        /* Re-apply saved colour immediately */
        const saved = _p21dbG('os_bg_color', '');
        if (saved) window.setBg(saved);

        /* Sync colour pickers */
        setTimeout(() => {
            ['p9-bg-color', 'p10-bg-color'].forEach(id => {
                const el = document.getElementById(id);
                if (el && saved) el.value = saved;
            });
        }, 800);
    }
    _patch();
}

/* ================================================================
   3.  ATTENDANCE — monthly calendar grid
       Overrides p16_renderAttendance to show a 4-week calendar
       grid (green = attended, red = missed, empty = not logged)
       per course, instead of the old horizontal dot strip.
   ================================================================ */
function _p21_attendanceCalendar() {
    const DAY_KEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    /* Build array of last N calendar days ending today */
    function _calDays(n) {
        const days = [];
        const today = new Date();
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push({
                str:    _p21date(d),
                dow:    d.getDay(),
                label:  DAY_KEYS[d.getDay()].slice(0, 2),
                isToday: i === 0,
                isFuture: i < 0,
            });
        }
        return days;
    }

    function _renderCourseCard(course, log) {
        const today    = _p21date();
        const cLog     = log.filter(l => l.courseId === course.id);
        const attended = cLog.filter(l => l.status === 'attended').length;
        const total    = cLog.length;
        const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
        const goal     = Math.max(1, Math.min(100, parseInt(course.goal, 10) || 80));
        const pctColor = pct >= goal ? '#22c55e' : pct >= goal - 15 ? '#f59e0b' : '#ef4444';
        const cColor   = _p21safeColor(course.color);
        const todaySt  = cLog.find(l => l.date === today)?.status;

        /* Build log map for O(1) lookup */
        const logMap = {};
        cLog.forEach(l => { logMap[l.date] = l.status; });

        /* 28-day calendar */
        const days = _calDays(28);

        const card = document.createElement('div');
        card.className = 'p21-att-course-card';

        /* ── Header ── */
        const hdr = document.createElement('div');
        hdr.className = 'p21-att-course-hdr';

        const dot = document.createElement('div');
        dot.className = 'p21-att-cdot';
        dot.style.background = cColor;

        const name = document.createElement('div');
        name.className = 'p21-att-cname';
        name.textContent = course.name;

        if (course.schedule) {
            const sched = document.createElement('span');
            sched.className = 'p21-att-sched';
            sched.innerHTML = '<i class="fa-solid fa-clock" style="margin-right:3px;"></i>' + _p21esc(course.schedule);
            hdr.appendChild(dot);
            hdr.appendChild(name);
            hdr.appendChild(sched);
        } else {
            hdr.appendChild(dot);
            hdr.appendChild(name);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'p21-att-edit-btn';
        editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
        editBtn.title = 'Edit course';
        editBtn.addEventListener('click', () => {
            if (typeof window.p16_openCourseEdit === 'function') window.p16_openCourseEdit(course.id);
        });
        hdr.appendChild(editBtn);
        card.appendChild(hdr);

        /* ── Stats row ── */
        const statsRow = document.createElement('div');
        statsRow.className = 'p21-att-stats-row';

        const pctBig = document.createElement('div');
        pctBig.className = 'p21-att-pct-big';
        pctBig.style.color = pctColor;
        pctBig.textContent = pct + '%';

        const barWrap = document.createElement('div');
        barWrap.className = 'p21-att-bar-wrap';

        const barBg = document.createElement('div');
        barBg.className = 'p21-att-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'p21-att-bar-fill';
        barFill.style.cssText = `width:${pct}%;background:${pctColor};`;
        barBg.appendChild(barFill);

        const statTxt = document.createElement('div');
        statTxt.className = 'p21-att-stat-text';
        statTxt.textContent = attended + ' of ' + total + ' sessions attended';
        barWrap.appendChild(barBg);
        barWrap.appendChild(statTxt);

        const goalBadge = document.createElement('div');
        goalBadge.className = 'p21-att-goal-badge ' + (pct >= goal ? 'ok' : 'low');
        goalBadge.textContent = 'Goal ' + goal + '%';

        statsRow.appendChild(pctBig);
        statsRow.appendChild(barWrap);
        statsRow.appendChild(goalBadge);
        card.appendChild(statsRow);

        /* ── Calendar grid ── */
        const calWrap = document.createElement('div');
        calWrap.className = 'p21-att-cal-wrap';

        const calHdr = document.createElement('div');
        calHdr.className = 'p21-att-cal-hdr';
        calHdr.textContent = 'Last 4 weeks';
        calWrap.appendChild(calHdr);

        const grid = document.createElement('div');
        grid.className = 'p21-att-cal-grid';

        /* Build per-column (day of week) */
        const cols = Array.from({length: 7}, () => {
            const col = document.createElement('div');
            col.className = 'p21-att-day-col';
            return col;
        });

        /* Day-of-week labels */
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach((lbl, i) => {
            const lblEl = document.createElement('div');
            lblEl.className = 'p21-att-day-lbl';
            lblEl.textContent = lbl;
            cols[i].appendChild(lblEl);
        });

        /* Fill cells */
        days.forEach(day => {
            const cell = document.createElement('div');
            const status = logMap[day.str];
            cell.className = 'p21-att-cal-cell' +
                (status === 'attended' ? ' attended' : status === 'missed' ? ' missed' : '') +
                (day.isToday ? ' today' : '');
            cell.title = day.str + (status ? ': ' + status : ': not logged');
            cols[day.dow].appendChild(cell);
        });

        cols.forEach(col => grid.appendChild(col));
        calWrap.appendChild(grid);
        card.appendChild(calWrap);

        /* ── Action buttons ── */
        const actions = document.createElement('div');
        actions.className = 'p21-att-actions';

        const attBtn = document.createElement('button');
        attBtn.className = 'p21-att-btn attend' + (todaySt === 'attended' ? ' active' : '');
        attBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i>' + (todaySt === 'attended' ? 'Attended Today' : 'Mark Attended');
        attBtn.addEventListener('click', () => {
            if (typeof window.p16_logAttend === 'function') {
                window.p16_logAttend(course.id, todaySt === 'attended' ? 'remove' : 'attended');
            }
        });

        const missBtn = document.createElement('button');
        missBtn.className = 'p21-att-btn miss' + (todaySt === 'missed' ? ' active' : '');
        missBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>' + (todaySt === 'missed' ? 'Marked Missed' : 'Mark Missed');
        missBtn.addEventListener('click', () => {
            if (typeof window.p16_logAttend === 'function') {
                window.p16_logAttend(course.id, todaySt === 'missed' ? 'remove' : 'missed');
            }
        });

        actions.appendChild(attBtn);
        actions.appendChild(missBtn);
        card.appendChild(actions);

        return card;
    }

    function _render() {
        const courses = _p21dbG('os_attend_courses', []);
        const log     = _p21dbG('os_attend_log',     []);
        const el = document.getElementById('p16-att-courses');
        if (!el) return;

        if (!courses.length) {
            el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted);">
                <i class="fa-solid fa-user-check" style="font-size:2rem;display:block;margin-bottom:12px;opacity:.3;"></i>
                <div style="font-size:.88rem;">No courses yet. Add a course to start tracking attendance.</div>
            </div>`;
            return;
        }

        el.innerHTML = '';
        courses.forEach(course => {
            el.appendChild(_renderCourseCard(course, log));
        });
    }

    /* Override the render function once it exists */
    function _override() {
        if (typeof window.p16_renderAttendance !== 'function') {
            setTimeout(_override, 600);
            return;
        }
        window.p16_renderAttendance = _render;
    }
    _override();
}

/* ================================================================
   4.  HABIT WIDGET — 4-week contribution grid + FA icons
       Replaces patches15's _renderHabits with an improved version.
   ================================================================ */
function _p21_habitWidget() {
    function _localDate(d = new Date()) {
        return d.getFullYear() + '-'
            + String(d.getMonth()+1).padStart(2,'0') + '-'
            + String(d.getDate()).padStart(2,'0');
    }

    function _getHabits() {
        return _p21dbG('os_habit_log', null) || _p21lsG('p9_habits', []);
    }

    function _streak(data) {
        if (!data.length) return 0;
        let s = 0;
        const now = new Date();
        let check = _localDate(now);
        for (const d of [...data].sort().reverse()) {
            if (d === check) {
                s++;
                const dt = new Date(check + 'T12:00:00');
                dt.setDate(dt.getDate() - 1);
                check = _localDate(dt);
            } else if (d < check) break;
        }
        return s;
    }

    function _bestStreak(data) {
        if (!data.length) return 0;
        let best = 0, cur = 0;
        const sorted = [...data].sort();
        for (let i = 0; i < sorted.length; i++) {
            if (i === 0) { cur = 1; }
            else {
                const prev = new Date(sorted[i-1] + 'T12:00:00');
                const curr = new Date(sorted[i]   + 'T12:00:00');
                const diff = Math.round((curr - prev) / 86400000);
                cur = diff === 1 ? cur + 1 : 1;
            }
            if (cur > best) best = cur;
        }
        return best;
    }

    function _renderHabits(el) {
        if (!el) return;
        const data  = _getHabits();
        const today = _localDate();
        const done  = data.includes(today);
        const s     = _streak(data);
        const best  = _bestStreak(data);

        /* Build last 28 days (4 weeks, Mon-start) */
        const now = new Date();
        /* Roll back to last Monday */
        const dow = now.getDay(); // 0=Sun
        const daysBack = (dow + 6) % 7; // days since last Monday
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - daysBack - 21); // 4 weeks back from this Monday

        const cells = [];
        for (let i = 0; i < 28; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const ds = _localDate(d);
            cells.push({
                ds,
                isDone:   data.includes(ds),
                isToday:  ds === today,
                isFuture: d > now,
            });
        }

        /* Render */
        el.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'p21-habit-wrap';

        /* Stats */
        const stats = document.createElement('div');
        stats.className = 'p21-habit-stats';
        [
            [s,    'Streak'],
            [best, 'Best'],
            [data.length, 'Total'],
        ].forEach(([val, lbl]) => {
            const st = document.createElement('div');
            st.className = 'p21-habit-stat';
            st.innerHTML = `<div class="p21-habit-stat-val">${val}</div><div class="p21-habit-stat-lbl">${lbl}</div>`;
            stats.appendChild(st);
        });
        wrap.appendChild(stats);

        /* Grid */
        const gridWrap = document.createElement('div');
        gridWrap.className = 'p21-habit-grid-wrap';

        const dayLabels = document.createElement('div');
        dayLabels.className = 'p21-habit-day-labels';
        ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(lbl => {
            const l = document.createElement('div');
            l.className = 'p21-habit-day-lbl';
            l.textContent = lbl;
            dayLabels.appendChild(l);
        });

        const grid = document.createElement('div');
        grid.className = 'p21-habit-grid';
        cells.forEach(cell => {
            const c = document.createElement('div');
            c.className = 'p21-habit-cell' +
                (cell.isDone   ? ' done'   : '') +
                (cell.isToday  ? ' today'  : '') +
                (cell.isFuture ? ' future' : '');
            c.title = cell.ds + (cell.isDone ? ' — studied' : '');
            grid.appendChild(c);
        });

        gridWrap.appendChild(dayLabels);
        gridWrap.appendChild(grid);
        wrap.appendChild(gridWrap);

        /* Check button */
        const btn = document.createElement('button');
        btn.className = 'p21-habit-check-btn' + (done ? ' done' : '');
        btn.innerHTML = done
            ? '<i class="fa-solid fa-circle-check"></i> Studied today'
            : '<i class="fa-solid fa-circle-plus"></i> Log today as studied';
        if (!done) {
            btn.addEventListener('click', () => {
                const d2 = _getHabits();
                if (d2.includes(today)) return;
                d2.push(today);
                _p21lsS('p9_habits', d2);
                _p21dbS('os_habit_log', d2);
                _renderHabits(el);
                _p21toast('Day ' + _streak(d2) + ' streak — keep it up!');
            });
        }
        wrap.appendChild(btn);

        el.appendChild(wrap);
    }

    /* Override the global _renderHabits */
    window._renderHabits    = _renderHabits;
    /* Also override old p9HabitCheck since we rebuilt the button */
    window._p14hcheck = function(btn) {
        const today = _localDate(), data = _getHabits();
        if (data.includes(today)) return;
        data.push(today);
        _p21lsS('p9_habits', data);
        _p21dbS('os_habit_log', data);
        const inner = document.querySelector('#widget-habits .habit-inner');
        if (inner) _renderHabits(inner);
        _p21toast('Day ' + _streak(data) + ' streak — keep it up!');
    };
    window._p9HabitCheck = window._p14hcheck;

    /* Re-render on switch to dashboard */
    function _patchSwitch() {
        if (typeof window.switchTab !== 'function' || window._p21_stDone) {
            setTimeout(_patchSwitch, 400);
            return;
        }
        window._p21_stDone = true;
        const orig = window.switchTab;
        window.switchTab = function(name) {
            orig(name);
            if (name === 'dashboard') {
                setTimeout(() => {
                    const inner = document.querySelector('#widget-habits .habit-inner');
                    if (inner) _renderHabits(inner);
                }, 80);
            }
        };
    }
    _patchSwitch();

    /* Initial render — retry with increasing intervals up to 30 attempts */
    let _habitRetries = 0;
    function _tryInit() {
        const inner = document.querySelector('#widget-habits .habit-inner');
        if (!inner) {
            if (++_habitRetries < 30) {
                setTimeout(_tryInit, _habitRetries < 5 ? 300 : 800);
            }
            return;
        }
        _renderHabits(inner);
        /* Re-render after DB may have loaded data */
        setTimeout(() => {
            const inner2 = document.querySelector('#widget-habits .habit-inner');
            if (inner2) _renderHabits(inner2);
        }, 2000);
    }
    _tryInit();

    /* Sync old localStorage habits to Firebase once */
    setTimeout(() => {
        if (window.DB?.get && !window.DB.get('os_habit_log', null)) {
            const d = _p21lsG('p9_habits', []);
            if (d.length) window.DB.set('os_habit_log', d);
        }
        /* Re-render after sync in case data changed */
        const inner = document.querySelector('#widget-habits .habit-inner');
        if (inner) _renderHabits(inner);
    }, 3000);
}

/* ================================================================
   5.  SIDEBAR SETTINGS TAB
       Adds a "Sidebar" page to the p10 settings panel so users
       can show/hide nav items from within the new settings UI.
       Reads/writes the same p16_nav_hidden key as patches16.
   ================================================================ */
function _p21_sidebarSettingsTab() {
    /* Nav items mirrored from patches16 */
    const NAV_ITEMS = [
        { id:'tasks',      label:'Tasks',        icon:'fa-list-check'     },
        { id:'calendar',   label:'Calendar',     icon:'fa-calendar-days'  },
        { id:'notes',      label:'Notes',        icon:'fa-note-sticky'    },
        { id:'whiteboard', label:'Whiteboard',   icon:'fa-pen-ruler'      },
        { id:'cards',      label:'Flashcards',   icon:'fa-clone'          },
        { id:'grades',     label:'Grades',       icon:'fa-chart-bar'      },
        { id:'calc',       label:'Calculator',   icon:'fa-calculator'     },
        { id:'focus',      label:'Focus Timer',  icon:'fa-hourglass-half' },
        { id:'music',      label:'Music',        icon:'fa-music'          },
        { id:'formulas',   label:'Custom Formula', icon:'fa-square-root-variable' },
        { id:'forum',      label:'Forum',        icon:'fa-comments'       },
        { id:'routine',    label:'Routine',      icon:'fa-calendar-week'  },
        { id:'attendance', label:'Attendance',   icon:'fa-user-check'     },
        { id:'worksheet',  label:'Worksheet',    icon:'fa-layer-group'    },
    ];

    function _getHidden() { return _p21lsG('p16_nav_hidden', []); }
    function _setHidden(h) { _p21lsS('p16_nav_hidden', h); }

    function _applyHide(hidden) {
        NAV_ITEMS.forEach(item => {
            const btn = document.getElementById('btn-' + item.id);
            if (btn) btn.style.display = hidden.includes(item.id) ? 'none' : '';
        });
    }

    function _renderPage(page) {
        page.innerHTML = '';

        const title = document.createElement('div');
        title.className = 'p10-page-title';
        title.innerHTML = 'Sidebar <span>Items</span>';
        page.appendChild(title);

        const sub = document.createElement('p');
        sub.style.cssText = 'font-size:.8rem;color:var(--text-muted);margin-bottom:16px;line-height:1.5;';
        sub.textContent = 'Choose which tabs appear in the sidebar. Dashboard is always visible.';
        page.appendChild(sub);

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        const hidden = _getHidden();
        NAV_ITEMS.forEach(item => {
            const vis = !hidden.includes(item.id);
            const row = document.createElement('div');
            row.className = 'p21-sidebar-nav-row';

            const info = document.createElement('div');
            info.className = 'p21-sidebar-nav-info';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'p21-sidebar-nav-icon';
            iconWrap.innerHTML = `<i class="fa-solid ${item.icon}"></i>`;

            const lbl = document.createElement('span');
            lbl.className = 'p21-sidebar-nav-label';
            lbl.textContent = item.label;

            info.appendChild(iconWrap);
            info.appendChild(lbl);

            /* Toggle */
            const tog = document.createElement('button');
            tog.id = 'p21-ntog-' + item.id;
            tog.style.cssText = `width:44px;height:24px;border-radius:99px;position:relative;border:1px solid;cursor:pointer;transition:all .2s;flex-shrink:0;background:${vis ? 'var(--accent)' : 'var(--glass-hover)'};border-color:${vis ? 'transparent' : 'var(--glass-border)'};`;
            tog.innerHTML = `<div style="width:16px;height:16px;background:#fff;border-radius:50%;position:absolute;top:3px;transition:left .2s;left:${vis ? 'calc(100% - 19px)' : '3px'};"></div>`;
            tog.addEventListener('click', () => {
                const h = _getHidden();
                const idx = h.indexOf(item.id);
                if (idx >= 0) h.splice(idx, 1); else h.push(item.id);
                _setHidden(h);
                _applyHide(h);
                /* Also update patches16 toggle if active */
                if (typeof window.p16_toggleNav === 'function') {
                    /* Re-sync visual state without calling p16_toggleNav to avoid double toggle */
                    const p16Btn = document.getElementById('p16-ntog-' + item.id);
                    const nowVis = !h.includes(item.id);
                    if (p16Btn) {
                        p16Btn.style.background   = nowVis ? 'var(--accent)' : 'var(--glass-hover)';
                        p16Btn.style.borderColor  = nowVis ? 'transparent'   : 'var(--glass-border)';
                        const dot = p16Btn.querySelector('div');
                        if (dot) dot.style.left = nowVis ? 'calc(100% - 18px)' : '2px';
                    }
                    tog.style.background   = nowVis ? 'var(--accent)' : 'var(--glass-hover)';
                    tog.style.borderColor  = nowVis ? 'transparent'   : 'var(--glass-border)';
                    const td = tog.querySelector('div');
                    if (td) td.style.left = nowVis ? 'calc(100% - 19px)' : '3px';
                }
            });

            row.appendChild(info);
            row.appendChild(tog);
            list.appendChild(row);
        });
        page.appendChild(list);
    }

    function _inject() {
        const sidebar = document.getElementById('p10-stab-sidebar');
        const content = document.getElementById('p10-stab-content');
        if (!sidebar || !content || document.getElementById('p10-page-sidebar')) {
            if (!sidebar || !content) setTimeout(_inject, 800);
            return;
        }

        /* Add nav button — insert before sign-out button */
        const signOutWrap = sidebar.querySelector('[style*="border-top"]') || sidebar.lastElementChild;
        const navBtn = document.createElement('button');
        navBtn.className = 'p10-stab-nav-btn';
        navBtn.dataset.page = 'sidebar';
        navBtn.setAttribute('onclick', "_p10switchSettingsPage('sidebar')");
        navBtn.innerHTML = '<i class="fa-solid fa-bars"></i> Sidebar';
        if (signOutWrap) sidebar.insertBefore(navBtn, signOutWrap);
        else sidebar.appendChild(navBtn);

        /* Add "Tools" section label just before the new button if it's not there */
        /* (The existing section labels are plain divs) */

        /* Create the page */
        const page = document.createElement('div');
        page.className = 'p10-s-page';
        page.id = 'p10-page-sidebar';
        _renderPage(page);
        content.appendChild(page);

        /* Apply saved hide state on load */
        _applyHide(_getHidden());
    }
    _inject();
}

/* ================================================================
   6.  ROUTINE DONE BUTTONS
       Makes the done-circle always visible (not just on hover),
       showing a faint open circle when undone.
   ================================================================ */
function _p21_routineDoneVisible() {
    /* Patch _p20_toggleDone to also update the ::before pseudo-element
       trick we use for the empty state. The CSS in patches21.css
       handles the visual, we just ensure the icon is correct. */
    function _patchToggle() {
        if (typeof window._p20_toggleDone !== 'function' || window._p21_tdDone) {
            setTimeout(_patchToggle, 600);
            return;
        }
        window._p21_tdDone = true;
        const orig = window._p20_toggleDone;
        window._p20_toggleDone = function(itemId, rowEl, btnEl) {
            orig(itemId, rowEl, btnEl);
            /* Ensure the icon is always present for CSS ::before to not show */
            if (!rowEl.classList.contains('done')) {
                btnEl.innerHTML = ''; /* empty — CSS ::before shows open circle */
            }
        };
    }
    _patchToggle();
}

/* ================================================================
   7.  WORKSHEET PDF EXPORT
       Adds an "Export PDF" button to the p19 worksheet toolbar.
       Uses window.print() with print CSS in patches21.css.
   ================================================================ */
function _p21_worksheetPDF() {
    function _inject() {
        const toolbar = document.getElementById('p19-ws-toolbar');
        if (!toolbar) { setTimeout(_inject, 1200); return; }
        if (document.getElementById('p21-ws-print-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'p21-ws-print-btn';
        btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Export PDF';
        btn.title = 'Export worksheet as PDF';
        btn.addEventListener('click', () => {
            /* Ensure the worksheet is visible before printing */
            const view = document.getElementById('view-worksheet');
            if (view && view.classList.contains('hidden')) return;
            window.print();
        });

        /* Insert at start of toolbar */
        toolbar.insertBefore(btn, toolbar.firstChild);
    }

    function _watchWorksheet() {
        const view = document.getElementById('view-worksheet');
        if (!view) { setTimeout(_watchWorksheet, 1200); return; }
        _inject();
        /* Re-inject if toolbar is recreated */
        new MutationObserver(() => {
            if (!document.getElementById('p21-ws-print-btn')) _inject();
        }).observe(view, { childList: true, subtree: true });
    }
    _watchWorksheet();
}

/* ================================================================
   8.  FORMULA MODAL — auto-detect variables, simpler UI
       When user types in the formula text field, automatically
       detect single-letter variable symbols and refresh the
       variable rows (sym only, no name required).
       Also adds a hint label above the variables section.
   ================================================================ */
function _p21_formulaModalClean() {
    /* Extract variable symbols from a formula string.
       Considers single letters not preceded/followed by letters
       and not part of standard math function names. */
    const MATH_FNAMES = new Set(['sin','cos','tan','log','exp','abs','sqrt','pi','ln','asin','acos','atan','ceil','floor','round','max','min','pow']);

    function _extractVars(formula) {
        if (!formula) return [];
        const tokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        const seen = new Set();
        return tokens.filter(t => {
            if (MATH_FNAMES.has(t.toLowerCase())) return false;
            if (t.length > 3) return false; /* skip long tokens — likely function names */
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        });
    }

    /* Rebuild the variable rows given a list of symbols */
    function _syncVarRows(modal, syms) {
        const rowsEl = modal.querySelector('#p16-fv-rows');
        if (!rowsEl) return;

        /* Keep existing rows that still have matching symbols */
        const existing = {};
        rowsEl.querySelectorAll('.p16-fv-row').forEach(row => {
            const sym = row.dataset.sym || row.querySelector('.p16-fv-si')?.value?.trim();
            if (sym) existing[sym] = row;
        });

        rowsEl.innerHTML = '';
        syms.forEach(sym => {
            if (existing[sym]) {
                rowsEl.appendChild(existing[sym]);
            } else {
                /* Build a new minimal row: sym-input + delete */
                const row = document.createElement('div');
                row.className = 'p16-fv-row';
                row.dataset.sym = sym;
                row.innerHTML = `
                    <input type="text" class="p16-fv-si bare-input text-sm" value="${_p21esc(sym)}"
                        placeholder="Sym" maxlength="8" style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent);">
                    <button class="p16-fv-del" onclick="this.closest('.p16-fv-row').remove()" title="Remove">
                        <i class="fa-solid fa-xmark"></i>
                    </button>`;
                rowsEl.appendChild(row);
            }
        });
    }

    function _addHint(modal) {
        const rowsEl = modal.querySelector('#p16-fv-rows'); if (!rowsEl) return;
        if (modal.querySelector('#p21-formula-vars-hint')) return;
        const hint = document.createElement('div');
        hint.id = 'p21-formula-vars-hint';
        hint.innerHTML = '<i class="fa-solid fa-circle-info" style="font-size:.6rem;"></i> Variables are detected automatically from your formula.';
        rowsEl.parentElement?.insertBefore(hint, rowsEl);
    }

    function _patchModal(modal) {
        if (modal.dataset.p21clean) return;
        modal.dataset.p21clean = '1';

        const formulaInput = modal.querySelector('#formula-modal-formula');
        if (!formulaInput) return;

        _addHint(modal);

        /* Auto-sync vars whenever formula changes */
        let _debounce;
        formulaInput.addEventListener('input', () => {
            clearTimeout(_debounce);
            _debounce = setTimeout(() => {
                _syncVarRows(modal, _extractVars(formulaInput.value));
            }, 350);
        });

        /* Also hide the "Add Variable" button — keep clean */
        const addVarBtn = modal.querySelector('[onclick*="p16_addVar"], [onclick*="addVar"]');
        if (addVarBtn) addVarBtn.style.setProperty('display', 'none', 'important');
    }

    function _tryObserve() {
        const modal = document.getElementById('modal-formula');
        if (!modal) { setTimeout(_tryObserve, 1000); return; }

        /* Observe modal open/mutations */
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) _patchModal(modal);
        }).observe(modal, { attributes: true, attributeFilter: ['class'], childList: true });

        /* Also patch formulaOpenModal to auto-fill variables */
        function _patchOpen() {
            if (typeof window.formulaOpenModal !== 'function' || window._p21_foPatched) {
                setTimeout(_patchOpen, 400);
                return;
            }
            window._p21_foPatched = true;
            const orig = window.formulaOpenModal;
            window.formulaOpenModal = function(id) {
                orig(id);
                setTimeout(() => {
                    const fi = modal.querySelector('#formula-modal-formula');
                    if (fi && fi.value) {
                        _patchModal(modal);
                        _syncVarRows(modal, _extractVars(fi.value));
                    }
                }, 100);
            };
        }
        _patchOpen();
    }
    _tryObserve();
}

/* ================================================================
   INIT — run all improvements
   ================================================================ */
(function _p21_init() {
    _p21_taskDnD();
    _p21_fixAmbientGlow();
    _p21_attendanceCalendar();
    _p21_habitWidget();
    _p21_sidebarSettingsTab();
    _p21_routineDoneVisible();
    _p21_worksheetPDF();
    _p21_formulaModalClean();

    console.log('[patches21] loaded — task DnD fix, ambient glow, attendance calendar, habit grid, sidebar tab, routine done, worksheet PDF, formula cleanup');
})();
