/* ================================================================
   StudentOS — patches20.js
   FIXES & IMPROVEMENTS:
   1.  Attendance widget  — fix broken data source bridge
                            (patches18 reads os_attendance but all
                             data lives in os_attend_courses + os_attend_log)
                            Overrides widget render + quick-log modal
   2.  Routine overhaul  — vertical timeline today view with
                            done-tracking, stats bar, improved
                            weekly grid with category icons
   3.  Sidebar section   — label rename + polished appearance
   4.  Re-render guard   — force attendance/routine re-render on tab visit
   ================================================================ */

'use strict';

/* ── helpers (same pattern as earlier patches) ─────────────────── */
const _p20lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p20lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p20dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p20lsG(k, d); } catch { return d; } };
const _p20dbS = (k, v) => { window.DB?.set ? window.DB.set(k, v) : _p20lsS(k, v); };
const _p20esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p20id  = () => Math.random().toString(36).slice(2, 10);
const _p20toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
const _p20date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
function _p20safeColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6'; }

/* ── category map (same as p17 so icons remain consistent) ────── */
const P20_CATS = [
    { key: 'study',    label: 'Study',    icon: 'fa-book'       },
    { key: 'break',    label: 'Break',    icon: 'fa-mug-hot'    },
    { key: 'exercise', label: 'Exercise', icon: 'fa-dumbbell'   },
    { key: 'personal', label: 'Personal', icon: 'fa-user'       },
    { key: 'work',     label: 'Work',     icon: 'fa-briefcase'  },
    { key: 'other',    label: 'Other',    icon: 'fa-circle-dot' },
];
function _p20cat(key) { return P20_CATS.find(c => c.key === key) || P20_CATS[P20_CATS.length - 1]; }

/* ── done tracking (same keys as patches18 so state is shared) ── */
const _p20_getDoneToday = () => _p20lsG('p18_routine_done_' + _p20date(), []);
const _p20_setDoneToday = ids => _p20lsS('p18_routine_done_' + _p20date(), ids);

/* ================================================================
   1.  ATTENDANCE WIDGET — fix broken data source
       The widget in patches18 was written to read from 'os_attendance'
       (a new format with embedded sessions arrays), but all actual data
       is stored in 'os_attend_courses' and 'os_attend_log' by patches16/17.
       Solution: override the widget renderer and the quick-log functions
       to always use the canonical keys.
   ================================================================ */
function _p20_fixAttendanceWidget() {

    /* ── Core widget renderer ─────────────────────────────────── */
    function _renderWidget() {
        const el = document.getElementById('p18-att-widget-body');
        if (!el) return;

        const courses = _p20dbG('os_attend_courses', []);
        const log     = _p20dbG('os_attend_log',     []);
        const today   = _p20date();

        if (!courses.length) {
            el.innerHTML = `
                <div style="font-size:.75rem;color:var(--text-muted);text-align:center;padding:8px 0;">
                    No courses tracked yet.
                    <br>
                    <button onclick="typeof switchTab==='function'&&switchTab('attendance')"
                        style="color:var(--accent);background:none;border:none;cursor:pointer;font-size:.75rem;text-decoration:underline;margin-top:4px;">
                        Set up in Attendance tab
                    </button>
                </div>`;
            return;
        }

        /* Compute overall stats */
        let totalAtt = 0, totalSess = 0;
        courses.forEach(c => {
            const cLog = log.filter(l => l.courseId === c.id);
            totalSess += cLog.length;
            totalAtt  += cLog.filter(l => l.status === 'attended').length;
        });
        const overallPct = totalSess > 0 ? Math.round(totalAtt / totalSess * 100) : 0;
        const pctColor   = overallPct >= 75 ? '#22c55e' : overallPct >= 60 ? '#f59e0b' : '#ef4444';

        /* Build DOM safely (no user data in innerHTML) */
        el.innerHTML = '';

        /* Overall row */
        const overallRow = document.createElement('div');
        overallRow.className = 'p20-att-overall-row';

        const leftDiv = document.createElement('div');
        const pctDiv  = document.createElement('div');
        pctDiv.className = 'p20-att-overall-pct';
        pctDiv.style.color = pctColor;
        pctDiv.textContent = overallPct + '%';
        const lblDiv = document.createElement('div');
        lblDiv.className = 'p20-att-overall-lbl';
        lblDiv.textContent = 'Overall';
        leftDiv.appendChild(pctDiv);
        leftDiv.appendChild(lblDiv);

        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'flex:1;padding-bottom:2px;';
        const barBg = document.createElement('div');
        barBg.className = 'p20-att-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'p20-att-bar-fill';
        barFill.style.cssText = `width:${overallPct}%;background:${pctColor};`;
        barBg.appendChild(barFill);
        const sessTxt = document.createElement('div');
        sessTxt.style.cssText = 'font-size:.6rem;color:var(--text-muted);margin-top:2px;';
        sessTxt.textContent = totalAtt + ' of ' + totalSess + ' classes';
        rightDiv.appendChild(barBg);
        rightDiv.appendChild(sessTxt);

        overallRow.appendChild(leftDiv);
        overallRow.appendChild(rightDiv);
        el.appendChild(overallRow);

        /* Individual course rows (top 5) */
        courses.slice(0, 5).forEach(c => {
            const cLog     = log.filter(l => l.courseId === c.id);
            const attended = cLog.filter(l => l.status === 'attended').length;
            const total    = cLog.length;
            const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
            const cColor   = _p20safeColor(c.color);
            const barColor = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
            const todayLog = cLog.find(l => l.date === today);

            const row = document.createElement('div');
            row.className = 'p20-att-course-row';

            const dot = document.createElement('div');
            dot.className = 'p20-att-dot';
            dot.style.background = cColor;

            const name = document.createElement('div');
            name.className = 'p20-att-name';
            name.textContent = c.name;

            const tdDot = document.createElement('div');
            tdDot.className = 'p20-att-today-dot' +
                (todayLog?.status === 'attended' ? ' attended' : todayLog?.status === 'missed' ? ' missed' : '');
            tdDot.title = todayLog ? 'Today: ' + todayLog.status : 'Not logged today';

            const pctEl = document.createElement('div');
            pctEl.className = 'p20-att-pct';
            pctEl.style.color = barColor;
            pctEl.textContent = pct + '%';

            row.appendChild(dot);
            row.appendChild(name);
            row.appendChild(tdDot);
            row.appendChild(pctEl);
            el.appendChild(row);
        });
    }

    /* ── Override quick-log modal opener ─────────────────────── */
    window._p18_openQuickAttModal = function() {
        const courses = _p20dbG('os_attend_courses', []);
        if (!courses.length) {
            _p20toast('No courses set up — go to the Attendance tab first.');
            if (typeof switchTab === 'function') switchTab('attendance');
            return;
        }
        _p20_injectQuickAttModal();
        _p20_renderQuickAttModal();
        if (typeof openModal === 'function') openModal('modal-p20-quick-att');
    };

    /* ── Override quick-log save ──────────────────────────────── */
    window._p18_quickLog = function(cid, status, btn) {
        const today = _p20date();
        let log = _p20dbG('os_attend_log', []).filter(l => !(l.courseId === cid && l.date === today));
        if (status !== 'remove') log.push({ courseId: cid, date: today, status });
        _p20dbS('os_attend_log', log);

        /* Update button states in modal */
        const card = btn.closest('.p20-qatt-course-card');
        if (card) {
            card.querySelectorAll('.p20-qatt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            /* Update percentage text */
            const allLog  = _p20dbG('os_attend_log', []).filter(l => l.courseId === cid);
            const att     = allLog.filter(l => l.status === 'attended').length;
            const tot     = allLog.length;
            const pct     = tot > 0 ? Math.round(att / tot * 100) : 0;
            const statEl  = card.querySelector('.p20-qatt-stat');
            if (statEl) {
                statEl.style.color = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
                statEl.textContent = pct + '%';
            }
        }

        /* Refresh widget */
        _renderWidget();
        /* Refresh attendance tab if visible */
        if (typeof window.p16_renderAttendance === 'function') {
            setTimeout(window.p16_renderAttendance, 40);
        }
    };

    /* ── Wire up the widget re-render ─────────────────────────── */
    function _waitForWidget() {
        const el = document.getElementById('p18-att-widget-body');
        if (!el) { setTimeout(_waitForWidget, 1500); return; }
        _renderWidget();
    }
    _waitForWidget();

    /* Expose so switchTab override can call it */
    window._p20_renderAttWidget = _renderWidget;
}

/* ── Quick-log modal DOM injection ───────────────────────────── */
function _p20_injectQuickAttModal() {
    if (document.getElementById('modal-p20-quick-att')) return;
    const ov = document.getElementById('modal-overlay'); if (!ov) return;
    const m = document.createElement('div');
    m.id        = 'modal-p20-quick-att';
    m.className = 'hidden modal-panel min-card p-0 bg-[var(--bg-color)] border border-[var(--glass-border)] overflow-hidden';
    m.style.width = '440px';
    m.innerHTML = `
        <div class="px-6 py-5 border-b border-[var(--glass-border)] flex items-center justify-between">
            <div>
                <h3 class="text-base font-semibold" id="p20-qatt-date"></h3>
                <div class="text-xs" style="color:var(--text-muted);">Log class attendance for today</div>
            </div>
            <button onclick="closeModals()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;" class="hover:opacity-70">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="px-5 py-4 space-y-2 max-h-[58vh] overflow-y-auto" id="p20-qatt-list"></div>
        <div class="px-6 py-4 border-t border-[var(--glass-border)]">
            <button onclick="closeModals()"
                class="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                style="background:var(--accent);">Done</button>
        </div>`;
    ov.appendChild(m);
}

function _p20_renderQuickAttModal() {
    const courses = _p20dbG('os_attend_courses', []);
    const log     = _p20dbG('os_attend_log',     []);
    const today   = _p20date();

    const dateEl = document.getElementById('p20-qatt-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric'
    });

    const list = document.getElementById('p20-qatt-list');
    if (!list) return;
    list.innerHTML = '';

    if (!courses.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:24px;color:var(--text-muted);font-size:.83rem;';
        empty.textContent = 'No courses set up yet.';
        list.appendChild(empty);
        return;
    }

    courses.forEach(c => {
        const cLog     = log.filter(l => l.courseId === c.id);
        const todayLog = cLog.find(l => l.date === today);
        const cColor   = _p20safeColor(c.color);
        const attended = cLog.filter(l => l.status === 'attended').length;
        const total    = cLog.length;
        const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
        const pctColor = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

        const card = document.createElement('div');
        card.className = 'p20-qatt-course-card';
        card.id = 'p20-qatt-card-' + c.id;

        /* Top row */
        const top = document.createElement('div');
        top.className = 'p20-qatt-top';

        const dot = document.createElement('div');
        dot.className = 'p20-qatt-dot';
        dot.style.background = cColor;

        const nm = document.createElement('div');
        nm.className = 'p20-qatt-name';
        nm.textContent = c.name;

        const stat = document.createElement('div');
        stat.className = 'p20-qatt-stat';
        stat.style.color = pctColor;
        stat.textContent = pct + '%';

        top.appendChild(dot);
        top.appendChild(nm);
        top.appendChild(stat);

        /* Buttons */
        const btns = document.createElement('div');
        btns.className = 'p20-qatt-btns';

        const attBtn = document.createElement('button');
        attBtn.className = 'p20-qatt-btn attend' + (todayLog?.status === 'attended' ? ' active' : '');
        attBtn.innerHTML = '<i class="fa-solid fa-check"></i> Attended';
        attBtn.addEventListener('click', function() { window._p18_quickLog(c.id, 'attended', attBtn); });

        const missBtn = document.createElement('button');
        missBtn.className = 'p20-qatt-btn miss' + (todayLog?.status === 'missed' ? ' active' : '');
        missBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Missed';
        missBtn.addEventListener('click', function() { window._p18_quickLog(c.id, 'missed', missBtn); });

        btns.appendChild(attBtn);
        btns.appendChild(missBtn);

        card.appendChild(top);
        card.appendChild(btns);
        list.appendChild(card);
    });
}

/* ================================================================
   2.  ROUTINE OVERHAUL
       Replaces p16_renderRoutine with a full vertical-timeline
       "Today" panel + improved weekly grid.
       All data stays in 'os_routine' for backward compatibility.
   ================================================================ */
function _p20_routineOverhaul() {
    /* ── Build and inject the new layout into view-routine ─────── */
    function _injectLayout() {
        const view = document.getElementById('view-routine'); if (!view) return;
        if (document.getElementById('p20-routine-wrap')) return;   /* already injected */

        /* Mark the view so CSS can hide the old grid */
        view.classList.add('p20-routine-active');

        /* Build wrapper */
        const wrap = document.createElement('div');
        wrap.id = 'p20-routine-wrap';

        /* Stats bar */
        wrap.innerHTML = `
            <div id="p20-routine-stats">
                <div class="p20-stat-card">
                    <div class="p20-stat-val" id="p20-stat-total">0</div>
                    <div class="p20-stat-lbl">Today total</div>
                </div>
                <div class="p20-stat-card">
                    <div class="p20-stat-val" id="p20-stat-mins">0 min</div>
                    <div class="p20-stat-lbl">Time planned</div>
                </div>
                <div class="p20-stat-card">
                    <div class="p20-stat-val" id="p20-stat-done">0 / 0</div>
                    <div class="p20-stat-lbl">Done today</div>
                </div>
            </div>

            <!-- Today timeline panel -->
            <div id="p20-today-panel">
                <div class="p20-today-hdr">
                    <div class="p20-today-hdr-left">
                        <i class="fa-solid fa-sun" style="color:var(--accent);font-size:.82rem;"></i>
                        <span class="p20-today-hdr-title">Today</span>
                        <span class="p20-today-hdr-date" id="p20-today-date"></span>
                    </div>
                    <div class="p20-today-progress-pill" id="p20-today-pill">0 / 0</div>
                </div>
                <div class="p20-today-progress-bar-wrap">
                    <div class="p20-today-progress-bar-fill" id="p20-today-bar" style="width:0%"></div>
                </div>
                <div class="p20-today-list" id="p20-today-list"></div>
            </div>

            <!-- Weekly grid wrapper -->
            <div id="p20-weekly-wrap">
                <div class="p20-week-hdr">
                    <span class="p20-week-hdr-title">Weekly Plan</span>
                </div>
                <div class="p20-week-grid" id="p20-week-grid"></div>
            </div>`;

        /* Append after the heading row (first child of view) */
        const heading = view.querySelector('.flex.items-center.justify-between');
        if (heading) heading.insertAdjacentElement('afterend', wrap);
        else view.appendChild(wrap);
    }

    /* ── Render the full routine view ─────────────────────────── */
    function _render() {
        _injectLayout();

        const items    = _p20dbG('os_routine', []);
        const now      = new Date();
        const dow      = now.getDay();
        const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][dow];
        const todayItems = items.filter(x =>
                                x.day === todayKey ||
                                (x.recurring && Array.isArray(x.recurDays) && x.recurDays.includes(todayKey))
                            ).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const doneToday  = _p20_getDoneToday();
        const totalMins  = todayItems.reduce((s, x) => s + (parseInt(x.duration, 10) || 0), 0);
        const doneCount  = todayItems.filter(x => doneToday.includes(x.id)).length;

        /* Stats */
        const statTotal = document.getElementById('p20-stat-total');
        const statMins  = document.getElementById('p20-stat-mins');
        const statDone  = document.getElementById('p20-stat-done');
        if (statTotal) statTotal.textContent = todayItems.length;
        if (statMins)  statMins.textContent  = totalMins + ' min';
        if (statDone)  statDone.textContent  = doneCount + ' / ' + todayItems.length;

        /* Today date label */
        const dateEl = document.getElementById('p20-today-date');
        if (dateEl) dateEl.textContent = now.toLocaleDateString(undefined, {
            weekday: 'long', month: 'short', day: 'numeric'
        });

        /* Today pill + bar */
        const pill = document.getElementById('p20-today-pill');
        const bar  = document.getElementById('p20-today-bar');
        const pct  = todayItems.length > 0 ? Math.round(doneCount / todayItems.length * 100) : 0;
        if (pill) pill.textContent = doneCount + ' / ' + todayItems.length + ' done';
        if (bar)  bar.style.width  = pct + '%';

        /* Today timeline */
        _renderTodayList(todayItems, doneToday);

        /* Weekly grid */
        _renderWeeklyGrid(items, todayKey, doneToday);
    }

    /* ── Today timeline list ─────────────────────────────────── */
    function _renderTodayList(todayItems, doneToday) {
        const list = document.getElementById('p20-today-list');
        if (!list) return;
        list.innerHTML = '';

        if (!todayItems.length) {
            const empty = document.createElement('div');
            empty.className = 'p20-today-empty';
            empty.innerHTML = '<i class="fa-solid fa-calendar-xmark"></i>Nothing scheduled for today.<br><button onclick="p16_openRoutineAdd(\'' + ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()] + '\')" style="margin-top:8px;color:var(--accent);background:none;border:none;cursor:pointer;font-size:.75rem;text-decoration:underline;">Add a block</button>';
            list.appendChild(empty);
            return;
        }

        todayItems.forEach(item => {
            const isDone = doneToday.includes(item.id);
            const catObj = _p20cat(item.cat);
            const sc     = _p20safeColor(item.color);

            const row = document.createElement('div');
            row.className = 'p20-timeline-row' + (isDone ? ' done' : '');
            row.dataset.rid = item.id;

            /* Time column */
            const timeCol = document.createElement('div');
            timeCol.className = 'p20-tl-time-col';
            const timeEl = document.createElement('div');
            timeEl.className = 'p20-tl-time';
            timeEl.textContent = item.time || '';
            const dotEl = document.createElement('div');
            dotEl.className = 'p20-tl-dot';
            timeCol.appendChild(timeEl);
            timeCol.appendChild(dotEl);

            /* Card */
            const card = document.createElement('div');
            card.className = 'p20-tl-card';
            card.style.borderLeftColor = sc;
            card.title = 'Edit block';

            const info = document.createElement('div');
            info.className = 'p20-tl-card-info';

            const label = document.createElement('div');
            label.className = 'p20-tl-label';
            label.textContent = item.label || '';

            const meta = document.createElement('div');
            meta.className = 'p20-tl-meta';

            const dur = document.createElement('div');
            dur.className = 'p20-tl-dur';
            dur.textContent = (parseInt(item.duration, 10) || 0) + ' min';

            const cat = document.createElement('div');
            cat.className = 'p20-tl-cat-badge';
            cat.innerHTML = '<i class="fa-solid ' + catObj.icon + '"></i>' + catObj.label;

            meta.appendChild(dur);
            meta.appendChild(cat);
            if (item.notes) {
                const noteEl = document.createElement('div');
                noteEl.style.cssText = 'font-size:.6rem;color:var(--text-muted);margin-left:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:120px;';
                noteEl.textContent = item.notes;
                meta.appendChild(noteEl);
            }

            info.appendChild(label);
            info.appendChild(meta);

            /* Done button */
            const doneBtn = document.createElement('button');
            doneBtn.className = 'p20-tl-done-btn';
            doneBtn.title = isDone ? 'Mark undone' : 'Mark done';
            if (isDone) doneBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            doneBtn.addEventListener('click', e => {
                e.stopPropagation();
                _p20_toggleDone(item.id, row, doneBtn);
            });

            card.appendChild(info);
            card.appendChild(doneBtn);
            card.addEventListener('click', () => {
                if (typeof window.p16_openRoutineEdit === 'function') window.p16_openRoutineEdit(item.id);
            });

            row.appendChild(timeCol);
            row.appendChild(card);
            list.appendChild(row);
        });
    }

    /* ── Toggle done state for a timeline block ─────────────── */
    function _p20_toggleDone(itemId, rowEl, btnEl) {
        let done = _p20_getDoneToday();
        const isDone = done.includes(itemId);
        if (isDone) done = done.filter(id => id !== itemId);
        else done.push(itemId);
        _p20_setDoneToday(done);

        rowEl.classList.toggle('done', !isDone);
        btnEl.title = !isDone ? 'Mark undone' : 'Mark done';
        btnEl.innerHTML = !isDone ? '<i class="fa-solid fa-check"></i>' : '';

        /* Update stats & bar */
        const doneToday = _p20_getDoneToday();
        const items     = _p20dbG('os_routine', []);
        const dow       = new Date().getDay();
        const todayKey  = ['sun','mon','tue','wed','thu','fri','sat'][dow];
        const todayItems = items.filter(x =>
                                x.day === todayKey ||
                                (x.recurring && Array.isArray(x.recurDays) && x.recurDays.includes(todayKey))
                            );
        const doneCount  = todayItems.filter(x => doneToday.includes(x.id)).length;
        const pct        = todayItems.length > 0 ? Math.round(doneCount / todayItems.length * 100) : 0;

        const pill = document.getElementById('p20-today-pill');
        const bar  = document.getElementById('p20-today-bar');
        const statDone = document.getElementById('p20-stat-done');
        if (pill) pill.textContent = doneCount + ' / ' + todayItems.length + ' done';
        if (bar)  bar.style.width  = pct + '%';
        if (statDone) statDone.textContent = doneCount + ' / ' + todayItems.length;

        /* Keep p18 progress bar in sync if present */
        const fill = document.getElementById('p18-rp-fill');
        const lbl  = document.getElementById('p18-rp-lbl');
        if (fill) fill.style.width = pct + '%';
        if (lbl)  lbl.textContent  = doneCount + ' / ' + todayItems.length + ' done today';
    }
    /* Export so inline onclick can reach it */
    window._p20_toggleDone = _p20_toggleDone;

    /* ── Weekly grid ─────────────────────────────────────────── */
    const P20_DAYS = [
        { key:'mon', label:'Mon' }, { key:'tue', label:'Tue' },
        { key:'wed', label:'Wed' }, { key:'thu', label:'Thu' },
        { key:'fri', label:'Fri' }, { key:'sat', label:'Sat' },
        { key:'sun', label:'Sun' },
    ];

    function _renderWeeklyGrid(items, todayKey, doneToday) {
        const grid = document.getElementById('p20-week-grid');
        if (!grid) return;
        grid.innerHTML = '';

        P20_DAYS.forEach(d => {
            const col = document.createElement('div');
            col.className = 'p20-day-col';

            const hdr = document.createElement('div');
            hdr.className = 'p20-day-hdr' + (d.key === todayKey ? ' today' : '');
            hdr.textContent = d.label;
            col.appendChild(hdr);

            const blocks = document.createElement('div');
            blocks.className = 'p20-day-blocks';

            const dayItems = items.filter(x =>
                                   x.day === d.key ||
                                   (x.recurring && Array.isArray(x.recurDays) && x.recurDays.includes(d.key))
                               ).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            dayItems.forEach(item => {
                const sc     = _p20safeColor(item.color);
                const catObj = _p20cat(item.cat);
                const isDone = doneToday.includes(item.id) && d.key === todayKey;

                const block = document.createElement('div');
                block.className = 'p20-rb' + (isDone ? ' done-today' : '');
                block.style.setProperty('--bcolor', sc);
                block.title = (item.time || '') + (item.duration ? ' · ' + item.duration + 'min' : '') + (item.notes ? '\n' + item.notes : '');
                block.addEventListener('click', () => {
                    if (typeof window.p16_openRoutineEdit === 'function') window.p16_openRoutineEdit(item.id);
                });

                const catIcon = document.createElement('div');
                catIcon.className = 'p20-rb-cat-icon';
                catIcon.innerHTML = '<i class="fa-solid ' + catObj.icon + '"></i>';

                const timeEl = document.createElement('div');
                timeEl.className = 'p20-rb-time';
                timeEl.textContent = item.time || '';

                const labelEl = document.createElement('div');
                labelEl.className = 'p20-rb-label';
                labelEl.textContent = item.label || '';

                const durEl = document.createElement('div');
                durEl.className = 'p20-rb-dur';
                durEl.textContent = (parseInt(item.duration, 10) || 0) + ' min';

                block.appendChild(catIcon);
                block.appendChild(timeEl);
                block.appendChild(labelEl);
                block.appendChild(durEl);
                blocks.appendChild(block);
            });

            /* Add button */
            const addBtn = document.createElement('button');
            addBtn.className = 'p20-day-add-btn';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            addBtn.title = 'Add block on ' + d.label;
            addBtn.addEventListener('click', () => {
                if (typeof window.p16_openRoutineAdd === 'function') window.p16_openRoutineAdd(d.key);
            });

            col.appendChild(blocks);
            col.appendChild(addBtn);
            grid.appendChild(col);
        });
    }

    /* ── Override p16_renderRoutine ───────────────────────────── */
    function _patchRenderRoutine() {
        if (typeof window.p16_renderRoutine !== 'function' || window._p20_rrDone) {
            setTimeout(_patchRenderRoutine, 500);
            return;
        }
        window._p20_rrDone = true;
        const _origRR = window.p16_renderRoutine;
        window.p16_renderRoutine = function() {
            /* Run p16's original render (keeps data changes applied) */
            _origRR();
            /* Then apply our improved display */
            setTimeout(_render, 40);
        };
        /* Initial render */
        _render();
    }

    /* ── Wait for the routine view to exist ──────────────────── */
    function _tryInit() {
        const view = document.getElementById('view-routine');
        if (!view) { setTimeout(_tryInit, 1200); return; }
        _patchRenderRoutine();
    }
    _tryInit();

    /* Expose for re-render on tab switch */
    window._p20_renderRoutine = _render;
}

/* ================================================================
   3.  SIDEBAR SETTINGS — rename section, improve styling
   ================================================================ */
function _p20_polishSidebarSettings() {
    function _try() {
        const sec = document.getElementById('p16-nav-settings-section');
        if (!sec) { setTimeout(_try, 1200); return; }

        /* Rename heading from "Navigation Items" to "Sidebar" */
        const hdr = sec.querySelector('.text-xs.text-\\[var\\(--text-muted\\)\\].uppercase');
        if (hdr && hdr.textContent.trim() === 'Navigation Items') {
            hdr.textContent = 'Sidebar';
        }
        /* Rename any heading elements with exact text */
        sec.querySelectorAll('div, p, span').forEach(el => {
            if (el.children.length === 0 && el.textContent.trim() === 'Navigation Items') {
                el.textContent = 'Sidebar';
            }
        });
    }
    _try();
}

/* ================================================================
   4.  RE-RENDER — attendance + routine on every tab visit
   ================================================================ */
function _p20_patchSwitchTab() {
    function _try() {
        if (typeof window.switchTab !== 'function' || window._p20_stDone) {
            setTimeout(_try, 500);
            return;
        }
        window._p20_stDone = true;
        const _origST = window.switchTab;
        window.switchTab = function(name) {
            _origST(name);
            if (name === 'dashboard') {
                setTimeout(() => { if (typeof window._p20_renderAttWidget === 'function') window._p20_renderAttWidget(); }, 120);
            }
            if (name === 'routine') {
                setTimeout(() => { if (typeof window._p20_renderRoutine === 'function') window._p20_renderRoutine(); }, 80);
            }
            if (name === 'attendance') {
                setTimeout(() => { if (typeof window.p16_renderAttendance === 'function') window.p16_renderAttendance(); }, 80);
            }
        };
    }
    _try();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p20init() {
    const go = () => {
        _p20_fixAttendanceWidget();
        _p20_routineOverhaul();
        _p20_polishSidebarSettings();
        _p20_patchSwitchTab();
        console.log('[patches20] loaded — attendance widget fix, routine overhaul, sidebar settings polish, re-render guard');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(go, 1500));
    } else {
        setTimeout(go, 1500);
    }
})();
