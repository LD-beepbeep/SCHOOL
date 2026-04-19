/* ================================================================
   StudentOS — patches26.js
   1.  Attendance — full month calendar with prev/next navigation,
       replacing the 4-week rolling grid.  Each course card shows
       one calendar month; back-navigation goes as far as you like.
   2.  Worksheet picker — built-in formula library (70+ formulas,
       8 subjects) with live search and subject filter.  Formulas
       are added to the worksheet as custom blocks immediately —
       no saved library entry required.
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p26lsG   = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p26lsS   = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p26dbG   = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p26lsG(k, d); } catch { return d; } };
const _p26dbS   = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p26lsS(k, v); } catch {} };
const _p26esc   = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p26id    = () => Math.random().toString(36).slice(2, 10);
const _p26toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const _p26date  = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const _p26safeColor = c => /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : 'var(--accent)';

/* ================================================================
   1.  ATTENDANCE — MONTH CALENDAR
   ================================================================ */
function _p26_attendanceMonthCal() {

    /* Per-course month state: courseId -> { year, month } */
    const _monthState = {};

    function _getState(courseId) {
        if (!_monthState[courseId]) {
            const now = new Date();
            _monthState[courseId] = { year: now.getFullYear(), month: now.getMonth() };
        }
        return _monthState[courseId];
    }

    /* ── Day-log popup (reuse patches25 if present, else create own) ─── */
    let _popup = null;

    function _getPopup() {
        if (_popup) return _popup;
        /* Prefer patches25 popup DOM if it already exists */
        const existing = document.getElementById('p25-att-day-popup');
        if (existing) { _popup = existing; return _popup; }
        _popup = document.createElement('div');
        _popup.id        = 'p26-att-day-popup';
        _popup.className = 'p25-att-day-popup';      /* reuse p25 styles */
        document.body.appendChild(_popup);
        document.addEventListener('pointerdown', e => {
            if (_popup && !_popup.contains(e.target)) _popup.classList.remove('show');
        }, true);
        return _popup;
    }

    function _showDayPopup(courseId, dateStr, currentStatus, anchorEl) {
        const popup = _getPopup();
        popup.innerHTML = '';

        const dateLabel = document.createElement('div');
        dateLabel.className   = 'p25-att-popup-date';
        dateLabel.textContent = dateStr;
        popup.appendChild(dateLabel);

        const btns = document.createElement('div');
        btns.className = 'p25-att-popup-btns';

        const actions = [
            { label: 'Attended',   cls: 'att',  status: 'attended' },
            { label: 'Missed',     cls: 'miss', status: 'missed'   },
            { label: 'Remove log', cls: 'rem',  status: 'remove'   },
        ];
        actions.forEach(a => {
            if (a.status !== 'remove' && a.status === currentStatus) return;
            const b = document.createElement('button');
            b.className = 'p25-att-popup-btn ' + a.cls;
            b.type      = 'button';
            const icon  = a.status === 'attended' ? 'circle-check' : a.status === 'missed' ? 'circle-xmark' : 'trash';
            b.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${a.label}`;
            b.addEventListener('click', () => {
                popup.classList.remove('show');
                _logDate(courseId, dateStr, a.status);
            });
            btns.appendChild(b);
        });
        popup.appendChild(btns);

        popup.classList.add('show');
        const rect  = anchorEl.getBoundingClientRect();
        const pw    = popup.offsetWidth  || 160;
        const ph    = popup.offsetHeight || 100;
        let left    = rect.left + window.scrollX;
        let top     = rect.bottom + window.scrollY + 6;
        if (left + pw > window.innerWidth  - 12) left = window.innerWidth  - pw - 12;
        if (top  + ph > window.innerHeight + window.scrollY - 12) top = rect.top + window.scrollY - ph - 6;
        popup.style.left = left + 'px';
        popup.style.top  = top  + 'px';
    }

    /* ── Log a date ──────────────────────────────────────────── */
    function _logDate(courseId, dateStr, status) {
        let log = _p26dbG('os_attend_log', [])
                    .filter(l => !(l.courseId === courseId && l.date === dateStr));
        if (status !== 'remove') log.push({ courseId, date: dateStr, status });
        _p26dbS('os_attend_log', log);
        /* Keep today-only p16 bridge in sync */
        if (typeof window.p16_logAttend === 'function' && dateStr === _p26date()) {
            window.p16_logAttend(courseId, status);
        } else if (typeof window.p16_renderAttendance === 'function') {
            window.p16_renderAttendance();
        }
    }

    /* ── Build the month calendar widget ─────────────────────── */
    function _buildMonthCal(course, logMap, state) {
        const { year, month } = state;
        const today     = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr  = _p26date(today);
        const firstDay  = new Date(year, month, 1);
        const daysIn    = new Date(year, month + 1, 0).getDate();
        /* Mon-first offset: JS getDay() 0=Sun…6=Sat → we want 0=Mon…6=Sun */
        const firstDow  = (firstDay.getDay() + 6) % 7;
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

        const wrap = document.createElement('div');
        wrap.className = 'p26-att-month-cal';

        /* Navigation bar */
        const nav = document.createElement('div');
        nav.className = 'p26-att-month-nav';

        const prevBtn = document.createElement('button');
        prevBtn.type      = 'button';
        prevBtn.className = 'p26-att-month-nav-btn';
        prevBtn.title     = 'Previous month';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.addEventListener('click', e => {
            e.stopPropagation();
            let m = month - 1, y = year;
            if (m < 0) { m = 11; y--; }
            _monthState[course.id] = { year: y, month: m };
            _render();
        });

        const label = document.createElement('div');
        label.className   = 'p26-att-month-label';
        label.textContent = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const nextBtn = document.createElement('button');
        nextBtn.type      = 'button';
        nextBtn.className = 'p26-att-month-nav-btn';
        nextBtn.title     = 'Next month';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled  = isCurrentMonth;
        nextBtn.addEventListener('click', e => {
            e.stopPropagation();
            let m = month + 1, y = year;
            if (m > 11) { m = 0; y++; }
            _monthState[course.id] = { year: y, month: m };
            _render();
        });

        nav.appendChild(prevBtn);
        nav.appendChild(label);
        nav.appendChild(nextBtn);
        wrap.appendChild(nav);

        /* Day-of-week header */
        const dowRow = document.createElement('div');
        dowRow.className = 'p26-att-dow-row';
        ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(d => {
            const lbl = document.createElement('div');
            lbl.className   = 'p26-att-dow-lbl';
            lbl.textContent = d;
            dowRow.appendChild(lbl);
        });
        wrap.appendChild(dowRow);

        /* Calendar grid */
        const grid = document.createElement('div');
        grid.className = 'p26-att-month-grid';

        /* Leading empty cells */
        for (let i = 0; i < firstDow; i++) {
            const empty = document.createElement('div');
            empty.className = 'p26-att-day-cell empty';
            grid.appendChild(empty);
        }

        /* Day cells */
        for (let d = 1; d <= daysIn; d++) {
            const dateStr  = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const cellDate = new Date(year, month, d);
            cellDate.setHours(0, 0, 0, 0);
            const isFuture = cellDate > today;
            const isToday  = dateStr === todayStr;
            const status   = logMap[dateStr];

            const cell = document.createElement('div');
            cell.className = 'p26-att-day-cell' +
                (isToday  ? ' today'  : '') +
                (isFuture ? ' future' : '') +
                (status   ? ' ' + status : '');
            cell.title = dateStr + (status ? ' — ' + status : '');

            const num = document.createElement('span');
            num.textContent = String(d);
            cell.appendChild(num);

            if (!isFuture) {
                cell.addEventListener('click', ev => {
                    ev.stopPropagation();
                    _showDayPopup(course.id, dateStr, status, cell);
                });
            }
            grid.appendChild(cell);
        }

        wrap.appendChild(grid);
        return wrap;
    }

    /* ── Build one course card ────────────────────────────────── */
    function _buildCard(course, log) {
        const today    = _p26date();
        const cLog     = log.filter(l => l.courseId === course.id);
        const attended = cLog.filter(l => l.status === 'attended').length;
        const total    = cLog.length;
        const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
        const goal     = Math.max(1, Math.min(100, parseInt(course.goal, 10) || 80));
        const pctColor = pct >= goal ? '#22c55e' : pct >= goal - 15 ? '#f59e0b' : '#ef4444';
        const cColor   = _p26safeColor(course.color);
        const todaySt  = cLog.find(l => l.date === today)?.status;

        /* Build a dateStr → status map for the calendar */
        const logMap = {};
        cLog.forEach(l => { logMap[l.date] = l.status; });

        /* Card shell (reuses p25 card styles) */
        const card = document.createElement('div');
        card.className        = 'p25-att-card';
        card.dataset.courseId = course.id;
        card.style.setProperty('--p25c', cColor);

        /* Header */
        const hdr  = document.createElement('div');
        hdr.className = 'p25-att-hdr';

        const dot = document.createElement('div');
        dot.className        = 'p25-att-dot';
        dot.style.background = cColor;

        const name = document.createElement('div');
        name.className   = 'p25-att-name';
        name.textContent = course.name;
        name.title       = course.name;

        hdr.appendChild(dot);
        hdr.appendChild(name);

        if (course.schedule) {
            const sched = document.createElement('div');
            sched.className = 'p25-att-sched';
            sched.innerHTML = '<i class="fa-solid fa-clock"></i>' + _p26esc(course.schedule);
            hdr.appendChild(sched);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'p25-att-edit-btn';
        editBtn.title     = 'Edit course';
        editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
        editBtn.addEventListener('click', () => {
            if (typeof window.p16_openCourseEdit === 'function') window.p16_openCourseEdit(course.id);
        });
        hdr.appendChild(editBtn);
        card.appendChild(hdr);

        /* Stats row */
        const stats = document.createElement('div');
        stats.className = 'p25-att-stats';

        const pctEl = document.createElement('div');
        pctEl.className   = 'p25-att-pct';
        pctEl.style.color = pctColor;
        pctEl.textContent = pct + '%';

        const barCol  = document.createElement('div');
        barCol.className = 'p25-att-bar-col';
        const barBg   = document.createElement('div');
        barBg.className  = 'p25-att-bar-bg';
        const barFill = document.createElement('div');
        barFill.className    = 'p25-att-bar-fill';
        barFill.style.cssText = 'width:' + pct + '%;background:' + pctColor + ';';
        barBg.appendChild(barFill);
        const statTxt = document.createElement('div');
        statTxt.className   = 'p25-att-stat-txt';
        statTxt.textContent = attended + ' of ' + total + ' sessions attended';
        barCol.appendChild(barBg);
        barCol.appendChild(statTxt);

        const goalBadge = document.createElement('div');
        goalBadge.className   = 'p25-att-goal-badge ' + (pct >= goal ? 'ok' : 'low');
        goalBadge.textContent = 'Goal ' + goal + '%';

        stats.appendChild(pctEl);
        stats.appendChild(barCol);
        stats.appendChild(goalBadge);
        card.appendChild(stats);

        /* Month calendar */
        const state    = _getState(course.id);
        const monthCal = _buildMonthCal(course, logMap, state);
        card.appendChild(monthCal);

        /* Today quick-action buttons */
        const actions = document.createElement('div');
        actions.className = 'p25-att-actions';

        const attBtn = document.createElement('button');
        attBtn.type      = 'button';
        attBtn.className = 'p25-att-btn att' + (todaySt === 'attended' ? ' active' : '');
        attBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i>' +
                           (todaySt === 'attended' ? 'Attended Today' : 'Mark Attended');
        attBtn.addEventListener('click', () =>
            _logDate(course.id, today, todaySt === 'attended' ? 'remove' : 'attended'));

        const missBtn = document.createElement('button');
        missBtn.type      = 'button';
        missBtn.className = 'p25-att-btn miss' + (todaySt === 'missed' ? ' active' : '');
        missBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>' +
                            (todaySt === 'missed' ? 'Marked Missed' : 'Mark Missed');
        missBtn.addEventListener('click', () =>
            _logDate(course.id, today, todaySt === 'missed' ? 'remove' : 'missed'));

        actions.appendChild(attBtn);
        actions.appendChild(missBtn);
        card.appendChild(actions);

        return card;
    }

    /* ── Summary bar ──────────────────────────────────────────── */
    function _buildSummary(courses, log) {
        let allAtt = 0, allSess = 0;
        courses.forEach(c => {
            const cLog = log.filter(l => l.courseId === c.id);
            allSess += cLog.length;
            allAtt  += cLog.filter(l => l.status === 'attended').length;
        });
        const pct      = allSess > 0 ? Math.round(allAtt / allSess * 100) : 0;
        const pctColor = pct >= 80 ? '#22c55e' : pct >= 65 ? '#f59e0b' : '#ef4444';

        const bar = document.createElement('div');
        bar.id        = 'p26-att-summary-bar';
        /* reuse p25 summary bar styles */
        bar.style.cssText = [
            'display:flex', 'align-items:center', 'gap:16px', 'padding:12px 18px',
            'margin-bottom:14px', 'background:var(--glass-panel)',
            'border:1px solid var(--glass-border)', 'border-radius:14px',
            'flex-wrap:wrap', 'flex-shrink:0',
        ].join(';');

        [
            { val: courses.length, lbl: 'Courses' },
            null,
            { val: allSess,        lbl: 'Sessions' },
            null,
            { val: pct + '%',      lbl: 'Overall', color: pctColor },
        ].forEach(item => {
            if (!item) {
                const div = document.createElement('div');
                div.className = 'p25-att-sum-div';
                bar.appendChild(div);
                return;
            }
            const wrap  = document.createElement('div');
            wrap.className = 'p25-att-sum-item';
            const valEl = document.createElement('div');
            valEl.className   = 'p25-att-sum-val';
            valEl.textContent = String(item.val);
            if (item.color) valEl.style.color = item.color;
            const lblEl = document.createElement('div');
            lblEl.className   = 'p25-att-sum-lbl';
            lblEl.textContent = item.lbl;
            wrap.appendChild(valEl);
            wrap.appendChild(lblEl);
            bar.appendChild(wrap);
        });
        return bar;
    }

    /* ── Main render ──────────────────────────────────────────── */
    function _render() {
        const courses = _p26dbG('os_attend_courses', []);
        const log     = _p26dbG('os_attend_log',     []);
        const el      = document.getElementById('p16-att-courses');
        if (!el) return;

        /* Remove any old summary bars */
        document.getElementById('p24-att-summary')?.remove();
        document.getElementById('p25-att-summary-bar')?.remove();
        document.getElementById('p26-att-summary-bar')?.remove();

        /* Insert summary bar above the scroll area */
        const view      = document.getElementById('view-attendance');
        const scrollDiv = el.closest('.overflow-y-auto, [style*="overflow"]') || el.parentElement;
        if (courses.length && view) {
            const bar    = _buildSummary(courses, log);
            const target = scrollDiv && scrollDiv !== view ? scrollDiv : el;
            target.parentElement?.insertBefore(bar, target);
        }

        el.innerHTML = '';

        if (!courses.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;padding:48px 20px;color:var(--text-muted);';
            empty.innerHTML = `<i class="fa-solid fa-user-check" style="font-size:2rem;display:block;margin-bottom:12px;opacity:.3;"></i>
                <div style="font-size:.88rem;">No courses yet. Add a course to start tracking attendance.</div>`;
            el.appendChild(empty);
            return;
        }

        courses.forEach(course => el.appendChild(_buildCard(course, log)));
    }

    /* ── Wait for p16's render function, then override ─────────── */
    function _init() {
        if (typeof window.p16_renderAttendance !== 'function') {
            setTimeout(_init, 300);
            return;
        }
        window.p16_renderAttendance = _render;
        /* Mark done so patches25 doesn't re-override on a late load */
        window._p26attDone = true;

        setTimeout(() => {
            if (document.getElementById('p16-att-courses')) _render();
        }, 100);
    }

    _init();
}

/* ================================================================
   2.  WORKSHEET PICKER — BUILT-IN FORMULA LIBRARY
   ================================================================ */
function _p26_formulaLibrary() {

    /* ── Built-in formula catalog ──────────────────────────────── */
    const LIBRARY = [
        /* ── Algebra ── */
        { title: 'Quadratic Formula',       formula: 'x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)', subject: 'Algebra' },
        { title: 'Slope-Intercept',         formula: 'y = m*x + b',                           subject: 'Algebra' },
        { title: 'Point-Slope Form',        formula: 'y - y1 = m * (x - x1)',                 subject: 'Algebra' },
        { title: 'Slope',                   formula: 'm = (y2 - y1) / (x2 - x1)',             subject: 'Algebra' },
        { title: 'Distance (2D)',           formula: 'd = sqrt((x2-x1)^2 + (y2-y1)^2)',       subject: 'Algebra' },
        { title: 'Midpoint X',              formula: 'xm = (x1 + x2) / 2',                    subject: 'Algebra' },
        { title: 'Arithmetic Sequence',     formula: 'an = a1 + (n - 1) * d',                 subject: 'Algebra' },
        { title: 'Geometric Sequence',      formula: 'an = a1 * r^(n - 1)',                   subject: 'Algebra' },
        { title: 'Sum Arithmetic Series',   formula: 'S = n * (a1 + an) / 2',                 subject: 'Algebra' },
        { title: 'Sum Geometric Series',    formula: 'S = a1 * (1 - r^n) / (1 - r)',          subject: 'Algebra' },
        { title: 'Exponent Product Rule',   formula: 'result = a^m * a^n',                    subject: 'Algebra' },
        { title: 'Logarithm Change Base',   formula: 'logb_x = log(x) / log(b)',              subject: 'Algebra' },

        /* ── Geometry ── */
        { title: 'Circle Area',             formula: 'A = pi * r^2',                          subject: 'Geometry' },
        { title: 'Circle Circumference',    formula: 'C = 2 * pi * r',                        subject: 'Geometry' },
        { title: 'Pythagorean Theorem',     formula: 'c = sqrt(a^2 + b^2)',                   subject: 'Geometry' },
        { title: 'Rectangle Area',          formula: 'A = l * w',                             subject: 'Geometry' },
        { title: 'Rectangle Perimeter',     formula: 'P = 2 * (l + w)',                       subject: 'Geometry' },
        { title: 'Triangle Area',           formula: 'A = 0.5 * b * h',                       subject: 'Geometry' },
        { title: 'Trapezoid Area',          formula: 'A = 0.5 * (a + b) * h',                 subject: 'Geometry' },
        { title: 'Sphere Volume',           formula: 'V = (4/3) * pi * r^3',                  subject: 'Geometry' },
        { title: 'Sphere Surface Area',     formula: 'SA = 4 * pi * r^2',                     subject: 'Geometry' },
        { title: 'Cylinder Volume',         formula: 'V = pi * r^2 * h',                      subject: 'Geometry' },
        { title: 'Cone Volume',             formula: 'V = (1/3) * pi * r^2 * h',              subject: 'Geometry' },
        { title: 'Rectangular Prism Vol',   formula: 'V = l * w * h',                         subject: 'Geometry' },

        /* ── Trigonometry ── */
        { title: 'Sine (SOH)',              formula: 'sin_theta = opposite / hypotenuse',      subject: 'Trigonometry' },
        { title: 'Cosine (CAH)',            formula: 'cos_theta = adjacent / hypotenuse',      subject: 'Trigonometry' },
        { title: 'Tangent (TOA)',           formula: 'tan_theta = opposite / adjacent',        subject: 'Trigonometry' },
        { title: 'Law of Sines',            formula: 'a / sin(A) = b / sin(B)',                subject: 'Trigonometry' },
        { title: 'Law of Cosines',          formula: 'c^2 = a^2 + b^2 - 2*a*b*cos(C)',        subject: 'Trigonometry' },
        { title: 'Pythagorean Identity',    formula: 'sin(x)^2 + cos(x)^2 = 1',               subject: 'Trigonometry' },
        { title: 'Arc Length',              formula: 's = r * theta',                          subject: 'Trigonometry' },

        /* ── Statistics ── */
        { title: 'Mean',                    formula: 'mean = total / n',                       subject: 'Statistics' },
        { title: 'Z-Score',                 formula: 'z = (x - mu) / sigma',                  subject: 'Statistics' },
        { title: 'Combinations nCr',        formula: 'C = n! / (r! * (n - r)!)',               subject: 'Statistics' },
        { title: 'Probability',             formula: 'p = favorable / total',                  subject: 'Statistics' },
        { title: 'Expected Value',          formula: 'E = p * value',                          subject: 'Statistics' },
        { title: 'Margin of Error',         formula: 'me = z * sigma / sqrt(n)',               subject: 'Statistics' },
        { title: 'Coefficient of Var.',     formula: 'cv = sigma / mean * 100',                subject: 'Statistics' },

        /* ── Mechanics ── */
        { title: 'Kinetic Energy',          formula: 'KE = 0.5 * m * v^2',                    subject: 'Mechanics' },
        { title: 'Gravitational PE',        formula: 'PE = m * g * h',                        subject: 'Mechanics' },
        { title: "Newton's 2nd Law",        formula: 'F = m * a',                             subject: 'Mechanics' },
        { title: 'Work',                    formula: 'W = F * d',                             subject: 'Mechanics' },
        { title: 'Power',                   formula: 'P = W / t',                             subject: 'Mechanics' },
        { title: 'Momentum',                formula: 'p = m * v',                             subject: 'Mechanics' },
        { title: 'Velocity',                formula: 'v = d / t',                             subject: 'Mechanics' },
        { title: 'Acceleration',            formula: 'a = (v - u) / t',                       subject: 'Mechanics' },
        { title: 'Kinematic: s',            formula: 's = u*t + 0.5*a*t^2',                   subject: 'Mechanics' },
        { title: 'Kinematic: v²',           formula: 'v^2 = u^2 + 2*a*s',                    subject: 'Mechanics' },
        { title: 'Centripetal Force',       formula: 'Fc = m * v^2 / r',                      subject: 'Mechanics' },
        { title: 'Gravitational Force',     formula: 'Fg = G * m1 * m2 / r^2',               subject: 'Mechanics' },
        { title: 'Pressure',                formula: 'P = F / A',                             subject: 'Mechanics' },
        { title: 'Density',                 formula: 'rho = m / V',                           subject: 'Mechanics' },
        { title: 'Friction Force',          formula: 'Ff = mu * N',                           subject: 'Mechanics' },
        { title: 'Torque',                  formula: 'T = F * r',                             subject: 'Mechanics' },
        { title: 'Angular Velocity',        formula: 'omega = theta / t',                     subject: 'Mechanics' },

        /* ── Waves & Optics ── */
        { title: 'Wave Speed',              formula: 'v = f * lambda',                        subject: 'Waves' },
        { title: 'Period',                  formula: 'T = 1 / f',                             subject: 'Waves' },
        { title: 'Doppler Effect',          formula: 'f_obs = f * (v + vo) / (v - vs)',       subject: 'Waves' },
        { title: "Snell's Law",             formula: 'n1 * sin(theta1) = n2 * sin(theta2)',   subject: 'Waves' },

        /* ── Thermodynamics ── */
        { title: 'Heat Transfer',           formula: 'Q = m * c * deltaT',                    subject: 'Thermodynamics' },
        { title: 'Ideal Gas Law',           formula: 'P * V = n * R * T',                     subject: 'Thermodynamics' },
        { title: "Boyle's Law",             formula: 'P1 * V1 = P2 * V2',                     subject: 'Thermodynamics' },
        { title: "Charles's Law",           formula: 'V1 / T1 = V2 / T2',                     subject: 'Thermodynamics' },

        /* ── Electricity ── */
        { title: "Ohm's Law",               formula: 'V = I * R',                             subject: 'Electricity' },
        { title: 'Electric Power',          formula: 'P = I * V',                             subject: 'Electricity' },
        { title: "Coulomb's Law",           formula: 'F = k * q1 * q2 / r^2',                subject: 'Electricity' },
        { title: 'Capacitance',             formula: 'C = Q / V',                             subject: 'Electricity' },
        { title: 'Series Resistance',       formula: 'Rt = R1 + R2 + R3',                     subject: 'Electricity' },
        { title: 'Parallel Resistance',     formula: 'Rt = 1 / (1/R1 + 1/R2 + 1/R3)',        subject: 'Electricity' },
        { title: 'Electric Field',          formula: 'E = F / q',                             subject: 'Electricity' },

        /* ── Chemistry ── */
        { title: 'Moles from Mass',         formula: 'n = m / M',                             subject: 'Chemistry' },
        { title: 'Concentration',           formula: 'c = n / V',                             subject: 'Chemistry' },
        { title: 'pH',                      formula: 'pH = -log(H)',                           subject: 'Chemistry' },
        { title: 'Dilution',                formula: 'C1 * V1 = C2 * V2',                     subject: 'Chemistry' },
        { title: 'Percent Yield',           formula: 'yield = (actual / theoretical) * 100',  subject: 'Chemistry' },
        { title: 'Combined Gas Law',        formula: 'P1 * V1 / T1 = P2 * V2 / T2',          subject: 'Chemistry' },

        /* ── Finance ── */
        { title: 'Compound Interest',       formula: 'A = P * (1 + r/n)^(n*t)',               subject: 'Finance' },
        { title: 'Simple Interest',         formula: 'I = P * r * t',                         subject: 'Finance' },
        { title: 'Present Value',           formula: 'PV = FV / (1 + r)^n',                   subject: 'Finance' },
        { title: 'Future Value',            formula: 'FV = PV * (1 + r)^n',                   subject: 'Finance' },
        { title: 'ROI',                     formula: 'ROI = (gain - cost) / cost * 100',       subject: 'Finance' },
        { title: 'Break-Even Units',        formula: 'units = fixed / (price - variable)',     subject: 'Finance' },
    ];

    const SUBJECTS = [...new Set(LIBRARY.map(f => f.subject))];

    /* ── Helper: extract variable symbols ───────────────────── */
    const SKIP_WORDS = new Set([
        'sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh',
        'sqrt','cbrt','abs','log','log2','log10','exp','pow','ceil','floor',
        'round','sign','min','max','hypot','pi','e','inf','infinity','nan',
        'true','false','if','else','and','or','not',
    ]);

    function _extractVars(expr) {
        const tokens = (expr || '').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        const seen   = new Set();
        return tokens.filter(t => {
            if (SKIP_WORDS.has(t.toLowerCase())) return false;
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        });
    }

    /* ── Add a library formula to the worksheet ─────────────── */
    function _addLibraryFormula(item) {
        const syms = _extractVars(item.formula);
        const vars = syms.map(sym => ({ sym, name: sym, value: '' }));
        const ws   = _p26dbG('os_worksheet', { blocks: [], savedValues: {} });
        ws.blocks  = ws.blocks || [];
        ws.blocks.push({
            id:        _p26id(),
            type:      'formula',
            formulaId: null,
            title:     item.title,
            formula:   item.formula,
            vars,
            solveFor:  vars[0]?.sym || '',
            result:    null,
            savedAs:   '',
        });
        _p26dbS('os_worksheet', ws);
        if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
        _p26toast('Added: ' + item.title);
    }

    /* ── Inject library section into the open picker sheet ───── */
    function _injectLibSection() {
        const sheet = document.getElementById('p19-ws-picker-sheet');
        if (!sheet) return;

        sheet.querySelector('#p26-picker-lib-sec')?.remove();

        const sec = document.createElement('div');
        sec.className = 'p19-picker-section';
        sec.id        = 'p26-picker-lib-sec';

        const hdr = document.createElement('div');
        hdr.className   = 'p19-picker-section-hdr';
        hdr.textContent = 'Browse formula library';
        sec.appendChild(hdr);

        /* Controls row */
        const controls = document.createElement('div');
        controls.className = 'p26-lib-controls';

        const search = document.createElement('input');
        search.type        = 'text';
        search.className   = 'p26-lib-search';
        search.placeholder = 'Search formulas…';
        search.autocomplete = 'off';

        const subjectSel = document.createElement('select');
        subjectSel.className = 'p26-lib-subject-select';
        const allOpt = document.createElement('option');
        allOpt.value       = '';
        allOpt.textContent = 'All subjects';
        subjectSel.appendChild(allOpt);
        SUBJECTS.forEach(s => {
            const opt = document.createElement('option');
            opt.value       = s;
            opt.textContent = s;
            subjectSel.appendChild(opt);
        });

        controls.appendChild(search);
        controls.appendChild(subjectSel);
        sec.appendChild(controls);

        /* Formula grid */
        const grid = document.createElement('div');
        grid.className = 'p26-lib-grid';
        sec.appendChild(grid);

        /* Render filtered results */
        function _redraw() {
            const query = search.value.trim().toLowerCase();
            const subj  = subjectSel.value;
            grid.innerHTML = '';
            const filtered = LIBRARY.filter(f => {
                if (subj && f.subject !== subj) return false;
                if (query && !f.title.toLowerCase().includes(query) &&
                             !f.formula.toLowerCase().includes(query) &&
                             !f.subject.toLowerCase().includes(query)) return false;
                return true;
            });
            if (!filtered.length) {
                const empty = document.createElement('div');
                empty.className   = 'p26-lib-empty';
                empty.textContent = 'No formulas match your search.';
                grid.appendChild(empty);
                return;
            }
            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'p26-lib-card';

                const titleEl = document.createElement('div');
                titleEl.className   = 'p26-lib-card-title';
                titleEl.textContent = item.title;

                const subjEl = document.createElement('div');
                subjEl.className   = 'p26-lib-card-subj';
                subjEl.textContent = item.subject;

                const exprEl = document.createElement('div');
                exprEl.className   = 'p26-lib-card-expr';
                exprEl.textContent = item.formula;

                card.appendChild(titleEl);
                card.appendChild(subjEl);
                card.appendChild(exprEl);
                card.addEventListener('click', () => _addLibraryFormula(item));
                grid.appendChild(card);
            });
        }

        search.addEventListener('input', _redraw);
        subjectSel.addEventListener('change', _redraw);
        _redraw();

        sheet.appendChild(sec);
        setTimeout(() => search.focus(), 80);
    }

    /* ── Patch p19_wbOpenPicker to inject library section ─────── */
    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function') {
            setTimeout(_patchPicker, 400);
            return;
        }
        if (window._p26pickerDone) return;
        window._p26pickerDone = true;

        const _origOpen = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            _origOpen.apply(this, arguments);
            /* Inject after the picker sheet has been populated */
            setTimeout(_injectLibSection, 80);
        };
    }

    _patchPicker();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p26_init() {
    const _go = () => {
        _p26_attendanceMonthCal();
        _p26_formulaLibrary();
        console.log('[patches26] loaded — attendance month calendar, formula library picker');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 300));
    } else {
        setTimeout(_go, 300);
    }
})();
