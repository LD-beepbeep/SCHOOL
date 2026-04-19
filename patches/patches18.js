/* ================================================================
   StudentOS — patches18.js
   FIXES & IMPROVEMENTS:
   1.  Sidebar icon consistency  — all nav buttons use fa-solid
   2.  Task drag-and-drop        — full reorder with DOM + DB persistence
   3.  Attendance widget         — dashboard widget + quick-log modal
   4.  Routine mark-done         — check off today's blocks, daily progress
   5.  Worksheet improvements    — collapsible steps, result chaining UX,
                                   cleaner toolbar, better saved-values
   6.  Profile preview sync      — guarantee large avatar in settings
   7.  Re-render on tab switch   — tasks + formulas + attendance + routine
   ================================================================ */

/* ── helpers ─────────────────────────────────────────────────── */
const _p18lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p18lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p18dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p18lsG(k, d); } catch { return d; } };
const _p18dbS = (k, v) => { window.DB?.set ? window.DB.set(k, v) : _p18lsS(k, v); };
const _p18esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p18date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const _p18toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
function _p18safeColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6'; }

/* ================================================================
   1.  SIDEBAR ICON CONSISTENCY
       Replace all Phosphor (ph-*) icons in the nav with fa-solid
   ================================================================ */
const P18_NAV_ICON_MAP = {
    'btn-dashboard':  'fa-house',
    'btn-tasks':      'fa-circle-check',
    'btn-calendar':   'fa-calendar-days',
    'btn-notes':      'fa-book',
    'btn-whiteboard': 'fa-pen',
    'btn-cards':      'fa-clone',
    'btn-grades':     'fa-chart-bar',
    'btn-calc':       'fa-calculator',
    'btn-focus':      'fa-stopwatch',
    'btn-music':      'fa-music',
    'btn-formulas':   'fa-superscript',
    'btn-forum':      'fa-comments',
    'btn-routine':    'fa-calendar-week',
    'btn-attendance': 'fa-user-check',
    'btn-worksheet':  'fa-layer-group',
};

function _p18_fixSidebarIcons() {
    function _apply() {
        let changed = 0;
        Object.entries(P18_NAV_ICON_MAP).forEach(([btnId, faIcon]) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            const icons = btn.querySelectorAll('i');
            icons.forEach(i => {
                if (i.className.includes('ph')) {
                    i.className = 'fa-solid ' + faIcon + ' text-xl';
                    changed++;
                }
            });
        });

        /* Settings button — no stable id, match by tooltip */
        const settingsBtn = document.querySelector('nav button[data-tooltip="Settings"] i');
        if (settingsBtn && settingsBtn.className.includes('ph')) {
            settingsBtn.className = 'fa-solid fa-gear text-xl';
            changed++;
        }
        return changed;
    }

    function _try(attempts) {
        if (attempts > 20) return;
        /* Wait for all buttons (including p16's injected ones) */
        if (!document.getElementById('btn-dashboard')) { setTimeout(() => _try(attempts + 1), 300); return; }
        _apply();
        /* Run again after p16 injects the new tab buttons */
        setTimeout(() => _apply(), 2200);
    }
    _try(0);
}

/* ================================================================
   2.  TASK DRAG-AND-DROP — full reorder + persistence
   ================================================================ */
function _p18_initTaskDnD() {
    let _dndSrcId = null;
    let _applyingOrder = false;

    function _getOrder() { return _p18lsG('p18_task_order', null); }
    function _saveOrderFromDOM() {
        const list = document.getElementById('full-task-list');
        if (!list) return;
        const ids = [...list.querySelectorAll('.task-row')]
            .map(r => r.id?.replace('task-row-', ''))
            .filter(Boolean);
        _p18lsS('p18_task_order', ids);
    }

    function _applyOrder() {
        if (_applyingOrder) return;
        const order = _getOrder();
        if (!order || !order.length) return;
        const list = document.getElementById('full-task-list');
        if (!list) return;

        _applyingOrder = true;
        const rowMap = {};
        [...list.querySelectorAll('.task-row')].forEach(row => {
            const id = row.id?.replace('task-row-', '');
            if (id) rowMap[id] = row;
        });

        /* Build ordered fragment */
        const placed = new Set();
        const frag = document.createDocumentFragment();
        order.forEach(id => {
            if (rowMap[id]) { frag.appendChild(rowMap[id]); placed.add(id); }
        });
        /* Append any new tasks not yet in saved order */
        Object.keys(rowMap).forEach(id => {
            if (!placed.has(id)) frag.appendChild(rowMap[id]);
        });

        /* Replace list children with reordered fragment */
        list.innerHTML = '';
        list.appendChild(frag);
        _applyingOrder = false;
    }

    function _addDragEvents() {
        const list = document.getElementById('full-task-list');
        if (!list) return;

        list.querySelectorAll('.task-row:not([data-p18dnd])').forEach(row => {
            row.dataset.p18dnd = '1';
            row.draggable = true;

            row.addEventListener('dragstart', e => {
                _dndSrcId = row.id;
                row.dataset.dragstate = 'src';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.id);
            });

            row.addEventListener('dragend', () => {
                row.dataset.dragstate = '';
                _dndSrcId = null;
                list.querySelectorAll('[data-dragstate]').forEach(x => { x.dataset.dragstate = ''; });
            });

            row.addEventListener('dragover', e => {
                e.preventDefault();
                if (_dndSrcId && _dndSrcId !== row.id) row.dataset.dragstate = 'over';
                e.dataTransfer.dropEffect = 'move';
            });

            row.addEventListener('dragleave', e => {
                /* Only clear if leaving this row entirely */
                if (!row.contains(e.relatedTarget)) row.dataset.dragstate = '';
            });

            row.addEventListener('drop', e => {
                e.preventDefault();
                row.dataset.dragstate = '';
                const srcId = e.dataTransfer.getData('text/plain');
                if (!srcId || srcId === row.id) return;
                const src = document.getElementById(srcId);
                if (!src || !list.contains(src)) return;
                /* Insert src before or after row depending on direction */
                const siblings = [...list.querySelectorAll('.task-row')];
                if (siblings.indexOf(src) < siblings.indexOf(row))
                    list.insertBefore(src, row.nextSibling);
                else
                    list.insertBefore(src, row);
                _saveOrderFromDOM();
            });
        });
    }

    function _wrapRenderTasks() {
        if (typeof window.renderTasks !== 'function' || window._p18rtDone) {
            setTimeout(_wrapRenderTasks, 400);
            return;
        }
        window._p18rtDone = true;
        const _orig = window.renderTasks;
        window.renderTasks = function() {
            _orig();
            _applyOrder();
            _addDragEvents();
        };
        /* Initial application */
        _applyOrder();
        _addDragEvents();
    }

    function _tryInit() {
        const list = document.getElementById('full-task-list');
        if (!list) { setTimeout(_tryInit, 900); return; }
        _wrapRenderTasks();
    }
    _tryInit();
}

/* ================================================================
   3.  ATTENDANCE DASHBOARD WIDGET
   ================================================================ */
function _p18_injectAttendanceWidget() {
    let _retries = 0;
    function _tryInject() {
        if (document.getElementById('widget-attendance')) {
            _p18_renderAttWidget();
            return;
        }
        /* Find the dashboard widget grid */
        const grid = document.querySelector('.widgets-grid')
            || document.getElementById('widget-habits')?.parentElement
            || document.getElementById('widget-links')?.parentElement;
        if (!grid) {
            if (++_retries < 30) setTimeout(_tryInject, 500);
            return;
        }

        const w = document.createElement('div');
        w.id = 'widget-attendance';
        w.className = 'col-span-1 min-card p-5 flex flex-col widget-item';
        w.draggable = true;
        w.innerHTML = `
            <div class="flex items-center justify-between mb-3 flex-shrink-0">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-user-check text-sm" style="color:var(--accent);"></i>
                    <span class="text-xs uppercase tracking-widest font-bold" style="color:var(--text-muted);">Attendance</span>
                </div>
                <button onclick="typeof switchTab==='function'&&switchTab('attendance')"
                    style="font-size:.68rem;background:none;border:none;cursor:pointer;" class="hover:underline" style="color:var(--accent);">
                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:.6rem;"></i> View
                </button>
            </div>
            <div id="p18-att-widget-body" class="flex-1 flex flex-col gap-2 justify-center"></div>
            <button onclick="_p18_openQuickAttModal()"
                class="mt-3 w-full py-2 rounded-xl text-xs font-semibold transition hover:opacity-90 flex items-center justify-center gap-1.5"
                style="background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);">
                <i class="fa-solid fa-plus"></i> Log Today
            </button>`;

        /* Insert after habits widget if it exists */
        const habits = document.getElementById('widget-habits');
        if (habits && habits.parentElement === grid)
            grid.insertBefore(w, habits.nextSibling);
        else
            grid.appendChild(w);

        /* Register drag-and-drop with existing widget DnD system */
        if (typeof window._wpApplyOnLoad === 'function') setTimeout(window._wpApplyOnLoad, 100);

        _p18_renderAttWidget();

        /* Re-render after a short delay to pick up DB data that may
           not have been ready on the very first call */
        setTimeout(_p18_renderAttWidget, 1500);
        setTimeout(_p18_renderAttWidget, 3500);
    }
    _tryInject();

    /* Re-render on every dashboard switch so the widget updates
       even if the initial render happened before DB was ready */
    function _hookDashSwitch() {
        if (typeof window.switchTab !== 'function' || window._p18_dashAttDone) {
            if (!window._p18_dashAttDone) setTimeout(_hookDashSwitch, 400);
            return;
        }
        window._p18_dashAttDone = true;
        const _origST = window.switchTab;
        window.switchTab = function(name) {
            _origST.apply(this, arguments);
            if (name === 'dashboard') {
                setTimeout(() => {
                    if (!document.getElementById('widget-attendance')) {
                        _retries = 0;
                        _tryInject();
                    } else {
                        _p18_renderAttWidget();
                    }
                }, 150);
            }
        };
    }
    _hookDashSwitch();
}

function _p18_renderAttWidget() {
    const el = document.getElementById('p18-att-widget-body');
    if (!el) return;

    /* Read from the canonical keys used by patches16/17 */
    const courses = _p18dbG('os_attend_courses', []);
    const log     = _p18dbG('os_attend_log',     []);

    if (!courses || !courses.length) {
        el.innerHTML = `<div style="font-size:.75rem;color:var(--text-muted);text-align:center;padding:8px 0;">
            No courses tracked yet.<br>
            <button onclick="typeof switchTab==='function'&&switchTab('attendance')"
                style="color:var(--accent);background:none;border:none;cursor:pointer;font-size:.75rem;text-decoration:underline;margin-top:4px;">
                Set up in Attendance tab
            </button></div>`;
        return;
    }

    /* Compute overall % */
    let totalAtt = 0, totalSess = 0;
    courses.forEach(c => {
        const cLog = log.filter(l => l.courseId === c.id);
        totalSess += cLog.length;
        totalAtt  += cLog.filter(l => l.status === 'attended').length;
    });
    const overallPct = totalSess > 0 ? Math.round(totalAtt / totalSess * 100) : 0;
    const pctColor = overallPct >= 75 ? '#22c55e' : overallPct >= 60 ? '#f59e0b' : '#ef4444';

    /* Show overall stat + top 4 courses */
    const topCourses = courses.slice(0, 4);
    el.innerHTML = `
        <div class="flex items-end gap-3 mb-2">
            <div>
                <div class="p18-att-overall" style="color:${pctColor}">${overallPct}%</div>
                <div class="p18-att-overall-lbl">Overall attendance</div>
            </div>
            <div style="flex:1;padding-bottom:4px;">
                <div class="p18-att-bar-bg">
                    <div class="p18-att-bar-fill" style="width:${overallPct}%;background:${pctColor};"></div>
                </div>
                <div style="font-size:.62rem;color:var(--text-muted);margin-top:3px;">${totalAtt} of ${totalSess} classes</div>
            </div>
        </div>
        ${topCourses.map(c => {
            const cLog     = log.filter(l => l.courseId === c.id);
            const attended = cLog.filter(l => l.status === 'attended').length;
            const total    = cLog.length;
            const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
            const cColor   = _p18safeColor(c.color);
            const barColor = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
            return `<div class="p18-att-course-row">
                <div class="p18-att-dot" style="background:${cColor};"></div>
                <div class="p18-att-name">${_p18esc(c.name)}</div>
                <div class="p18-att-pct" style="color:${barColor}">${pct}%</div>
            </div>`;
        }).join('')}`;
}

/* Quick attendance log modal */
window._p18_openQuickAttModal = function() {
    const courses = _p18dbG('os_attend_courses', []);
    if (!courses || !courses.length) {
        _p18toast('No courses set up — go to the Attendance tab first.');
        if (typeof switchTab === 'function') switchTab('attendance');
        return;
    }
    _p18_injectQuickAttModal();
    _p18_renderQuickAttModal();
    if (typeof openModal === 'function') openModal('modal-p18-quick-att');
};

function _p18_injectQuickAttModal() {
    if (document.getElementById('modal-p18-quick-att')) return;
    const ov = document.getElementById('modal-overlay'); if (!ov) return;
    const m = document.createElement('div');
    m.id        = 'modal-p18-quick-att';
    m.className = 'hidden modal-panel min-card p-0 bg-[var(--bg-color)] border border-[var(--glass-border)] overflow-hidden';
    m.style.width = '440px';
    m.innerHTML = `
        <div class="px-6 py-5 border-b border-[var(--glass-border)] flex items-center justify-between">
            <div>
                <h3 class="text-base font-semibold" id="p18-qatt-date"></h3>
                <div class="text-xs" style="color:var(--text-muted);">Log attendance for today</div>
            </div>
            <button onclick="closeModals()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;" class="hover:opacity-70"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-5 py-4 space-y-2 max-h-[55vh] overflow-y-auto" id="p18-qatt-list"></div>
        <div class="px-6 py-4 border-t border-[var(--glass-border)] flex gap-3">
            <button onclick="closeModals()"
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                style="background:var(--accent);">Done</button>
        </div>`;
    ov.appendChild(m);
}

function _p18_renderQuickAttModal() {
    const courses = _p18dbG('os_attend_courses', []);
    const log     = _p18dbG('os_attend_log',     []);
    const today   = _p18date();

    const dateEl = document.getElementById('p18-qatt-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });

    const list = document.getElementById('p18-qatt-list');
    if (!list) return;

    list.innerHTML = courses.map(c => {
        const cLog      = log.filter(l => l.courseId === c.id);
        const todayLog  = cLog.find(l => l.date === today);
        const cColor    = _p18safeColor(c.color);
        return `<div class="p18-qatt-course-card" id="p18-qatt-card-${_p18esc(c.id)}">
            <div class="p18-qatt-dot" style="background:${cColor};"></div>
            <div class="p18-qatt-name">${_p18esc(c.name)}</div>
            <div class="p18-qatt-btns">
                <button class="p18-qatt-btn attend${todayLog?.status==='attended' ? ' active' : ''}"
                    onclick="_p18_quickLog('${_p18esc(c.id)}','attended',this)">
                    <i class="fa-solid fa-check"></i> Attended
                </button>
                <button class="p18-qatt-btn miss${todayLog?.status==='missed' ? ' active' : ''}"
                    onclick="_p18_quickLog('${_p18esc(c.id)}','missed',this)">
                    <i class="fa-solid fa-xmark"></i> Missed
                </button>
            </div>
        </div>`;
    }).join('');
}

window._p18_quickLog = function(cid, status, btn) {
    const today  = _p18date();
    let   log    = _p18dbG('os_attend_log', []).filter(l => !(l.courseId === cid && l.date === today));
    if (status !== 'remove') log.push({ courseId: cid, date: today, status });
    _p18dbS('os_attend_log', log);

    /* Update button states in modal */
    const card = btn.closest('.p18-qatt-course-card');
    if (card) {
        card.querySelectorAll('.p18-qatt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    /* Refresh the attendance tab if visible */
    if (typeof window.p16_renderAttendance === 'function') window.p16_renderAttendance();
    /* Refresh widget */
    _p18_renderAttWidget();
    /* Update p16 attendance stat row if visible */
    const statEl = document.getElementById('p16-att-stat-' + cid);
    if (statEl) {
        const allLog   = _p18dbG('os_attend_log', []).filter(l => l.courseId === cid);
        const attended = allLog.filter(l => l.status === 'attended').length;
        const total    = allLog.length;
        const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
        statEl.textContent = `${attended} attended, ${total - attended} missed — ${pct}% attendance`;
    }
};

/* ================================================================
   4.  ROUTINE MARK-DONE TODAY + DAILY PROGRESS
   ================================================================ */
function _p18_enhanceRoutine() {
    /* Daily done tracking key: p18_routine_done_YYYY-MM-DD → [id, id, ...] */
    function _getDoneToday() {
        return _p18lsG('p18_routine_done_' + _p18date(), []);
    }
    function _setDoneToday(ids) {
        _p18lsS('p18_routine_done_' + _p18date(), ids);
    }

    window._p18_toggleRoutineDone = function(itemId, btn) {
        let done = _getDoneToday();
        const isDone = done.includes(itemId);
        if (isDone) done = done.filter(id => id !== itemId);
        else done.push(itemId);
        _setDoneToday(done);

        /* Toggle visual on block */
        const block = btn.closest('.p16-routine-block');
        if (block) block.classList.toggle('p18-done-today', !isDone);
        btn.classList.toggle('done', !isDone);
        if (!isDone) btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        else btn.innerHTML = '';

        _p18_renderRoutineProgress();
    };

    function _injectDoneButtons() {
        const view = document.getElementById('view-routine'); if (!view) return;
        const doneToday = _getDoneToday();
        view.querySelectorAll('.p16-routine-block:not([data-p18done])').forEach(block => {
            block.dataset.p18done = '1';
            const btn = document.createElement('button');
            btn.className = 'p18-rb-done-btn';
            btn.title = 'Mark done today';
            const id = block.getAttribute('onclick')?.match(/p16_openRoutineEdit\(['"]([^'"]+)['"]\)/)?.[1] || '';
            btn.dataset.rid = id;
            const isDone = id && doneToday.includes(id);
            if (isDone) { btn.classList.add('done'); btn.innerHTML = '<i class="fa-solid fa-check"></i>'; block.classList.add('p18-done-today'); }
            btn.onclick = (e) => { e.stopPropagation(); window._p18_toggleRoutineDone(btn.dataset.rid, btn); };
            block.appendChild(btn);
        });
    }

    function _injectProgressBar() {
        const view = document.getElementById('view-routine'); if (!view) return;
        if (document.getElementById('p18-routine-progress')) return;

        const todayStrip = view.querySelector('.p17-today-strip');
        const insertBefore = todayStrip || view.querySelector('.p16-routine-grid');
        if (!insertBefore) return;

        const bar = document.createElement('div');
        bar.id = 'p18-routine-progress';
        bar.className = 'p18-routine-progress';
        bar.innerHTML = `
            <i class="fa-solid fa-circle-half-stroke" style="color:var(--accent);font-size:.75rem;flex-shrink:0;"></i>
            <div class="p18-routine-progress-bar">
                <div class="p18-routine-progress-fill" id="p18-rp-fill" style="width:0%"></div>
            </div>
            <div class="p18-routine-progress-lbl" id="p18-rp-lbl">0 / 0 done today</div>`;
        view.insertBefore(bar, insertBefore);
        _p18_renderRoutineProgress();
    }

    window._p18_renderRoutineProgress = function() {
        const dow = new Date().getDay();
        const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][dow];
        const items = _p18dbG('os_routine', []).filter(x => x.day === todayKey);
        const doneToday = _getDoneToday();
        const total = items.length;
        const done  = items.filter(item => doneToday.includes(item.id)).length;
        const pct   = total > 0 ? Math.round(done / total * 100) : 0;

        const fill = document.getElementById('p18-rp-fill');
        const lbl  = document.getElementById('p18-rp-lbl');
        if (fill) fill.style.width = pct + '%';
        if (lbl)  lbl.textContent  = `${done} / ${total} done today`;
    };

    /* Patch p16_renderRoutine to inject done buttons afterward */
    function _patchRenderRoutine() {
        if (typeof window.p16_renderRoutine !== 'function' || window._p18rrDone) {
            setTimeout(_patchRenderRoutine, 500);
            return;
        }
        window._p18rrDone = true;
        const _orig = window.p16_renderRoutine;
        window.p16_renderRoutine = function() {
            _orig();
            setTimeout(() => {
                _injectDoneButtons();
                _injectProgressBar();
                _p18_renderRoutineProgress();
            }, 50);
        };
    }

    function _tryRoutine() {
        const view = document.getElementById('view-routine');
        if (!view) { setTimeout(_tryRoutine, 1000); return; }
        _patchRenderRoutine();
        _injectDoneButtons();
        _injectProgressBar();
    }
    _tryRoutine();
}

/* ================================================================
   5.  WORKSHEET IMPROVEMENTS
       • Collapsible steps
       • Inline editable step title
       • Auto-chain: suggest feeding last result into next step
       • Clear-all button in toolbar
       • Better note block textarea
   ================================================================ */
function _p18_enhanceWorksheet() {

    /* Wrap p16_wsRender to enhance steps after render */
    function _patchWsRender() {
        if (typeof window.p16_wsRender !== 'function' || window._p18wsrDone) {
            setTimeout(_patchWsRender, 600);
            return;
        }
        window._p18wsrDone = true;
        const _orig = window.p16_wsRender;
        window.p16_wsRender = function() {
            _orig();
            _p18_enhanceWsSteps();
            _p18_addWsClearBtn();
        };
        _p18_enhanceWsSteps();
        _p18_addWsClearBtn();
    }

    function _p18_addWsClearBtn() {
        const view = document.getElementById('view-worksheet'); if (!view) return;
        if (view.querySelector('.p18-ws-clear-btn')) return;
        const toolbar = view.querySelector('.flex.gap-2');
        if (!toolbar) return;
        const btn = document.createElement('button');
        btn.className = 'p18-ws-tb-btn p18-ws-clear-btn';
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Clear';
        btn.title = 'Clear all steps';
        btn.onclick = () => {
            if (typeof window.p16_wsClearAll === 'function') window.p16_wsClearAll();
        };
        toolbar.insertBefore(btn, toolbar.firstChild);
    }

    function _p18_enhanceWsSteps() {
        const canvas = document.getElementById('p16-ws-canvas'); if (!canvas) return;
        const ws = _p18dbG('os_worksheet', { steps:[], savedValues:{} });

        canvas.querySelectorAll('[data-wssid]:not([data-p18ws])').forEach((el, stepIdx) => {
            el.dataset.p18ws = '1';
            const sid = el.dataset.wssid;

            /* --- Collapse button in step header --- */
            const hdr = el.querySelector('.p16-ws-step-hdr');
            if (hdr && !hdr.querySelector('.p18-ws-collapse-btn')) {
                const colBtn = document.createElement('button');
                colBtn.className = 'p18-ws-collapse-btn';
                colBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
                colBtn.title = 'Collapse step';
                colBtn.onclick = () => {
                    el.classList.toggle('collapsed');
                    const icon = colBtn.querySelector('i');
                    if (icon) icon.className = el.classList.contains('collapsed')
                        ? 'fa-solid fa-chevron-down'
                        : 'fa-solid fa-chevron-up';
                };
                hdr.appendChild(colBtn);
            }

            /* --- Wrap non-header content in collapsible body div --- */
            if (!el.querySelector('.p18-ws-step-body')) {
                const body = document.createElement('div');
                body.className = 'p18-ws-step-body';
                [...el.children].forEach(child => {
                    if (!child.classList.contains('p16-ws-step-hdr')) body.appendChild(child);
                });
                el.appendChild(body);
            }

            /* --- Auto-chain suggestion: if previous step had a result,
                   offer to use it for a variable in this step --- */
            if (stepIdx > 0) {
                const prevSteps = ws.steps.filter((_, i) => i < stepIdx);
                const lastResultStep = [...prevSteps].reverse().find(s => s.type === 'formula' && s.result !== null && s.savedAs);
                const step = ws.steps.find(s => s.id === sid);
                if (lastResultStep && step?.type === 'formula') {
                    const body = el.querySelector('.p18-ws-step-body');
                    if (body && !body.querySelector('.p18-ws-chain-row')) {
                        const chainRow = document.createElement('div');
                        chainRow.className = 'p18-ws-chain-row';
                        chainRow.innerHTML = `<i class="fa-solid fa-link-horizontal" style="font-size:.62rem;"></i>
                            Use <span class="p18-ws-chain-badge" title="Click to copy reference"
                                onclick="navigator.clipboard?.writeText('@${_p18esc(lastResultStep.savedAs)}')">
                                @${_p18esc(lastResultStep.savedAs)}
                            </span>
                            from previous step as a variable input`;
                        body.insertBefore(chainRow, body.firstChild);
                    }
                }
            }
        });
    }

    function _tryWs() {
        const view = document.getElementById('view-worksheet');
        if (!view) { setTimeout(_tryWs, 1000); return; }
        _patchWsRender();
    }
    _tryWs();
}

/* ================================================================
   6.  PROFILE PICTURE PREVIEW — guarantee large avatar in settings
   ================================================================ */
function _p18_keepAvatarSync() {
    function _syncAvatar() {
        const src = document.getElementById('avatar-preview');
        const dst = document.getElementById('p16-settings-avatar') || document.getElementById('p18-settings-avatar');
        if (!src || !dst) return;
        dst.innerHTML = src.innerHTML;
        if (src.style.background) dst.style.background = src.style.background;
        /* Force size in case something overrode it */
        dst.style.setProperty('width',  '72px', 'important');
        dst.style.setProperty('height', '72px', 'important');
        dst.style.setProperty('font-size', '2rem', 'important');
    }

    /* Patch renderProfileDisplay to also update settings avatar */
    function _patchRPD() {
        if (typeof window.renderProfileDisplay !== 'function' || window._p18rpdDone) {
            setTimeout(_patchRPD, 500);
            return;
        }
        window._p18rpdDone = true;
        const _orig = window.renderProfileDisplay;
        window.renderProfileDisplay = function() {
            _orig();
            setTimeout(_syncAvatar, 80);
        };
    }

    /* Also sync whenever settings modal opens */
    function _watchSettingsModal() {
        const modal = document.getElementById('modal-settings');
        if (!modal) { setTimeout(_watchSettingsModal, 900); return; }
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) setTimeout(_syncAvatar, 150);
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    _patchRPD();
    _watchSettingsModal();
}

/* ================================================================
   7.  RE-RENDER ON TAB SWITCH — tasks, formulas, attendance, routine
   ================================================================ */
function _p18_patchReRenders() {
    function _wrap() {
        if (typeof window.switchTab !== 'function' || window._p18stDone) {
            setTimeout(_wrap, 500);
            return;
        }
        window._p18stDone = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);

            /* Tasks: re-read from DB in case of remote change */
            if (name === 'tasks') {
                setTimeout(() => {
                    if (window.DB?.get && window.tasks) {
                        const fresh = window.DB.get('os_tasks', []);
                        if (JSON.stringify(fresh) !== JSON.stringify(window.tasks)) {
                            window.tasks = fresh;
                            if (typeof window.renderTasks === 'function') window.renderTasks();
                            if (typeof window.updateDashWidgets === 'function') window.updateDashWidgets();
                        }
                    }
                }, 120);
            }

            /* Formulas: re-render list */
            if (name === 'formulas') {
                setTimeout(() => {
                    if (typeof window.initFormulas === 'function') window.initFormulas();
                    else if (typeof window.renderFormulaList === 'function') window.renderFormulaList();
                }, 80);
            }

            /* Attendance: re-render tab + widget */
            if (name === 'attendance') {
                setTimeout(() => {
                    if (typeof window.p16_renderAttendance === 'function') window.p16_renderAttendance();
                }, 80);
                _p18_renderAttWidget();
            }

            /* Routine: inject done buttons + progress */
            if (name === 'routine') {
                setTimeout(() => {
                    if (window._p18_renderRoutineProgress) window._p18_renderRoutineProgress();
                    /* re-inject done buttons on re-render */
                    const view = document.getElementById('view-routine');
                    if (view) {
                        view.querySelectorAll('.p16-routine-block').forEach(b => delete b.dataset.p18done);
                    }
                    /* trigger a re-render to add done buttons */
                    if (typeof window.p16_renderRoutine === 'function') window.p16_renderRoutine();
                }, 100);
            }

            /* Dashboard: refresh attendance widget */
            if (name === 'dashboard') {
                _p18_renderAttWidget();
            }
        };
    }
    _wrap();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p18init() {
    const go = () => {
        _p18_fixSidebarIcons();
        _p18_initTaskDnD();
        _p18_injectAttendanceWidget();
        _p18_enhanceRoutine();
        _p18_enhanceWorksheet();
        _p18_keepAvatarSync();
        _p18_patchReRenders();

        /* Refresh attendance widget when attendance tab data changes */
        setTimeout(() => {
            const origP16dbS = window._p16dbS;  /* not accessible — use DB.set wrap */
            if (window.DB?.set && !window._p18dbWrapped) {
                window._p18dbWrapped = true;
                const _origSet = window.DB.set.bind(window.DB);
                window.DB.set = function(key, val) {
                    const result = _origSet(key, val);
                    if (key === 'os_attend_courses' || key === 'os_attend_log') {
                        _p18_renderAttWidget();
                    }
                    return result;
                };
            }
        }, 1500);

        console.log('[patches18] loaded — sidebar FA icons, task DnD, attendance widget, routine done, worksheet+, avatar sync, re-renders');
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', () => setTimeout(go, 1100))
        : setTimeout(go, 1100);
})();
