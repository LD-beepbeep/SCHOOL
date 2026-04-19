/* ================================================================
   StudentOS — patches17.js
   IMPROVEMENTS OVER patches16:
   1.  Formula modal  — variable section is collapsible by default
                        (cleaner add/edit experience)
   2.  Settings avatar — 72 px prominent preview (override p16 size)
   3.  Worksheet       — drag-to-reorder steps via grab handles
   4.  Attendance      — "Log History" modal: click any past day to
                         toggle attended/missed on a 8-week calendar
   5.  Routine         — category + notes fields; today-strip at top;
                         duration-progress bar on each block
   6.  Task D&D        — MutationObserver keeps handles alive after
                         any re-render, not just the first one
   7.  Re-render fixes — force calendar/notes/grades re-render when
                         tab is switched back to them after changes
   ================================================================ */

/* ── helpers (same pattern as earlier patches) ─────────────────── */
const _p17lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p17lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p17dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p17lsG(k, d); } catch { return d; } };
const _p17dbS = (k, v) => { window.DB?.set ? window.DB.set(k, v) : _p17lsS(k, v); };
const _p17esc  = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p17id   = () => Math.random().toString(36).slice(2, 10);
const _p17toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
const _p17date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

/* ================================================================
   1.  FORMULA MODAL — collapsible variable section
   ================================================================ */
function _p17_wrapVarSection() {
    function _try() {
        /* Wait until patches16 has injected _p16_injectVarSection */
        if (typeof window._p16_fmDone === 'undefined') { setTimeout(_try, 600); return; }
        if (window._p17_fvDone) return;
        window._p17_fvDone = true;

        /* After patches16 builds the section, wrap it in an accordion */
        function _makeCollapsible(section) {
            if (!section || section.dataset.p17c) return;
            section.dataset.p17c = '1';

            const header = section.querySelector('.p16-fv-header');
            const rows   = section.querySelector('#p16-fv-rows');
            if (!header || !rows) return;

            /* Build accordion toggle */
            const toggle = document.createElement('button');
            toggle.className = 'p17-fv-toggle';
            toggle.innerHTML = `
                <i class="fa-solid fa-tags" style="color:var(--accent);font-size:.72rem;"></i>
                Variables &amp; Units
                <span style="font-size:.67rem;color:var(--text-muted);margin-left:4px;" id="p17-fv-count"></span>
                <i class="fa-solid fa-chevron-down p17-chev"></i>`;

            const body = document.createElement('div');
            body.className = 'p17-fv-body';

            /* Move the old header + rows into the body */
            body.appendChild(header.cloneNode(true));
            body.appendChild(rows);
            header.remove();

            /* Re-attach detect button handler in the new header */
            const detectBtn = body.querySelector('.p16-fv-btn');
            if (detectBtn) detectBtn.onclick = () => typeof window.p16_autoDetectVars === 'function' && window.p16_autoDetectVars();

            /* Insert toggle + body into section */
            section.innerHTML = '';
            section.appendChild(toggle);
            section.appendChild(body);

            /* Update count badge */
            function _updateCount() {
                const n = body.querySelectorAll('.p16-fv-row').length;
                const badge = section.querySelector('#p17-fv-count');
                if (badge) badge.textContent = n ? `(${n})` : '';
                /* Auto-open if there are vars already */
                if (n > 0 && !body.classList.contains('open')) {
                    body.classList.add('open');
                    toggle.classList.add('open');
                }
            }
            _updateCount();

            toggle.addEventListener('click', () => {
                const open = body.classList.toggle('open');
                toggle.classList.toggle('open', open);
            });

            /* Watch for row additions (auto-detect adds rows) */
            new MutationObserver(_updateCount).observe(body, { childList: true, subtree: true });
        }

        /* Observe formula modal for when the section gets injected */
        const modal = document.getElementById('modal-formula');
        if (!modal) return;

        function _checkSection() {
            const sec = modal.querySelector('.p16-formula-vars');
            if (sec) _makeCollapsible(sec);
        }
        _checkSection();
        new MutationObserver(_checkSection).observe(modal, { childList: true, subtree: true });
    }
    _try();
}

/* ================================================================
   2.  SETTINGS AVATAR — keep the 72 px override in sync
   ================================================================ */
function _p17_keepAvatarLarge() {
    function _enforce() {
        const el = document.getElementById('p16-settings-avatar');
        if (!el) return;
        el.style.setProperty('width',         '72px', 'important');
        el.style.setProperty('height',        '72px', 'important');
        el.style.setProperty('border-radius', '18px', 'important');
        el.style.setProperty('font-size',     '2rem', 'important');
    }

    /* Watch settings modal becoming visible */
    function _try() {
        const modal = document.getElementById('modal-settings');
        if (!modal) { setTimeout(_try, 900); return; }
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) _enforce();
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
        _enforce();
    }
    _try();
}

/* ================================================================
   3.  WORKSHEET — drag-to-reorder steps
   ================================================================ */
let _p17_wsDragId = null;

function _p17_attachWsHandles() {
    const canvas = document.getElementById('p16-ws-canvas');
    if (!canvas) return;
    canvas.querySelectorAll('[data-wssid]:not([data-p17h])').forEach(el => {
        el.dataset.p17h = '1';
        el.draggable = true;

        /* Insert handle into step header (after step-num) */
        const hdr = el.querySelector('.p16-ws-step-hdr');
        if (hdr && !hdr.querySelector('.p17-ws-handle')) {
            const h = document.createElement('span');
            h.className = 'p17-ws-handle';
            h.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
            hdr.insertBefore(h, hdr.firstChild);
        }

        el.addEventListener('dragstart', e => {
            _p17_wsDragId = el.dataset.wssid;
            el.dataset.p17drag = 'src';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('p17-wssid', el.dataset.wssid);
        });
        el.addEventListener('dragend', () => {
            el.dataset.p17drag = '';
            _p17_wsDragId = null;
            canvas.querySelectorAll('[data-p17drag]').forEach(x => { x.dataset.p17drag = ''; });
            _p17_saveWsOrder();
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (_p17_wsDragId && _p17_wsDragId !== el.dataset.wssid)
                el.dataset.p17drag = 'over';
        });
        el.addEventListener('dragleave', () => { el.dataset.p17drag = ''; });
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.dataset.p17drag = '';
            const srcId = e.dataTransfer.getData('p17-wssid');
            if (!srcId || srcId === el.dataset.wssid) return;
            const src = canvas.querySelector(`[data-wssid="${srcId}"]`);
            if (!src) return;
            const siblings = [...canvas.querySelectorAll('[data-wssid]')];
            if (siblings.indexOf(src) < siblings.indexOf(el))
                canvas.insertBefore(src, el.nextSibling);
            else
                canvas.insertBefore(src, el);
            _p17_saveWsOrder();
        });
    });
}

function _p17_saveWsOrder() {
    const canvas = document.getElementById('p16-ws-canvas'); if (!canvas) return;
    const newOrder = [...canvas.querySelectorAll('[data-wssid]')].map(el => el.dataset.wssid);
    const ws = _p17dbG('os_worksheet', { steps: [], savedValues: {} });
    const map = {};
    ws.steps.forEach(s => { map[s.id] = s; });
    ws.steps = newOrder.map(id => map[id]).filter(Boolean);
    /* Renumber displayed step-num badges */
    canvas.querySelectorAll('[data-wssid]').forEach((el, i) => {
        const badge = el.querySelector('.p16-ws-step-num');
        if (badge) badge.textContent = i + 1;
    });
    _p17dbS('os_worksheet', ws);
}

function _p17_watchWorksheet() {
    function _try() {
        const canvas = document.getElementById('p16-ws-canvas');
        if (!canvas) { setTimeout(_try, 800); return; }
        _p17_attachWsHandles();
        new MutationObserver(() => _p17_attachWsHandles())
            .observe(canvas, { childList: true });
    }
    _try();
}

/* ================================================================
   4.  ATTENDANCE — "Log History" modal with 8-week calendar
   ================================================================ */
let _p17_histCid = null;

function _p17_injectHistModal() {
    if (document.getElementById('modal-attend-history')) return;
    const ov = document.getElementById('modal-overlay'); if (!ov) return;
    const m = document.createElement('div');
    m.id        = 'modal-attend-history';
    m.className = 'hidden modal-panel min-card p-0 bg-[var(--bg-color)] border border-[var(--glass-border)] flex flex-col overflow-hidden';
    m.style.maxHeight = '85vh';
    m.innerHTML = `
        <div class="px-7 py-5 border-b border-[var(--glass-border)] flex justify-between items-center flex-shrink-0">
            <div>
                <h3 class="text-lg font-medium" id="p17-hist-title">Attendance History</h3>
                <div id="p17-hist-sub" style="font-size:.72rem;color:var(--text-muted);margin-top:2px;"></div>
            </div>
            <button onclick="closeModals()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;" class="hover:opacity-70 transition">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="overflow-y-auto flex-1 px-7 py-5">
            <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:10px;">
                Click any past day to toggle attended / missed. Today is highlighted in blue.
            </div>
            <div id="p17-hist-cal"></div>
        </div>
        <div class="px-7 py-4 border-t border-[var(--glass-border)] flex justify-between items-center flex-shrink-0">
            <div id="p17-hist-stat" style="font-size:.75rem;color:var(--text-muted);"></div>
            <button onclick="closeModals()" class="px-5 py-2.5 rounded-xl text-sm" style="background:var(--glass-hover);color:var(--text-muted);">Close</button>
        </div>`;
    ov.appendChild(m);
}

window.p17_openHistory = function(courseId) {
    _p17_injectHistModal();
    _p17_histCid = courseId;
    const courses = _p17dbG('os_attend_courses', []);
    const course  = courses.find(c => c.id === courseId);
    if (!course) return;
    document.getElementById('p17-hist-title').textContent = course.name + ' — History';
    document.getElementById('p17-hist-sub').textContent   = course.schedule || '';
    _p17_renderHistCal(courseId);
    if (typeof openModal === 'function') openModal('modal-attend-history');
};

function _p17_renderHistCal(courseId) {
    const calEl  = document.getElementById('p17-hist-cal');
    const statEl = document.getElementById('p17-hist-stat');
    if (!calEl) return;

    const log   = _p17dbG('os_attend_log', []).filter(l => l.courseId === courseId);
    const logMap = {};
    log.forEach(l => { logMap[l.date] = l.status; });

    const today  = _p17date();
    const WEEKS  = 8;
    const DAYS   = WEEKS * 7;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    /* Build array of DAYS ending today */
    const days = [];
    const todayDate = new Date(today + 'T12:00:00');
    /* Align start to Sunday of 8 weeks ago */
    const startDate = new Date(todayDate);
    startDate.setDate(todayDate.getDate() - (DAYS - 1));
    /* Push back to Sunday */
    const startDow = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDow);

    for (let i = 0; i < WEEKS * 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const ds = _p17date(d);
        days.push({ ds, dow: d.getDay(), month: d.getMonth(), date: d.getDate() });
    }

    /* Group by month for labels */
    let html = '';
    let lastMonth = -1;
    /* Header row */
    html += '<div class="p17-cal-grid">';
    dayNames.forEach(n => { html += `<div class="p17-cal-hdr">${n}</div>`; });
    html += '</div>';

    /* Weeks */
    for (let w = 0; w < WEEKS; w++) {
        const weekDays = days.slice(w * 7, w * 7 + 7);
        /* Check if any new month starts this week */
        weekDays.forEach(d => {
            if (d.month !== lastMonth && d.date <= 7) {
                lastMonth = d.month;
                const mn = new Date(d.ds + 'T12:00:00').toLocaleString('default', { month: 'long', year: 'numeric' });
                html += `<div class="p17-cal-month-lbl">${mn}</div>`;
            }
        });
        html += '<div class="p17-cal-grid">';
        weekDays.forEach(d => {
            const isFuture  = d.ds > today;
            const isToday   = d.ds === today;
            const status    = logMap[d.ds];
            let cls = 'p17-cal-day';
            if (isFuture)            cls += ' future';
            else if (isToday)        cls += ' today';
            if (status === 'attended') cls += ' attended';
            else if (status === 'missed') cls += ' missed';
            const icon = status === 'attended' ? '<div class="p17-cd-icon"><i class="fa-solid fa-circle-check"></i></div>'
                       : status === 'missed'   ? '<div class="p17-cd-icon"><i class="fa-solid fa-circle-xmark"></i></div>'
                       : '';
            html += `<div class="${cls}" onclick="p17_toggleHistDay('${courseId}','${d.ds}')" title="${d.ds}">
                <div class="p17-cd-num">${d.date}</div>
                ${icon}
            </div>`;
        });
        html += '</div>';
    }

    calEl.innerHTML = html;

    /* Stats */
    const total    = log.length;
    const attended = log.filter(l => l.status === 'attended').length;
    const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
    if (statEl) statEl.textContent = `${attended} attended, ${total - attended} missed — ${pct}% attendance`;
}

window.p17_toggleHistDay = function(courseId, dateStr) {
    const today = _p17date();
    if (dateStr > today) return;         /* never toggle future */

    let log = _p17dbG('os_attend_log', []);
    const existing = log.find(l => l.courseId === courseId && l.date === dateStr);
    if (!existing) {
        log.push({ courseId, date: dateStr, status: 'attended' });
    } else if (existing.status === 'attended') {
        existing.status = 'missed';
    } else {
        log = log.filter(l => !(l.courseId === courseId && l.date === dateStr));
    }
    _p17dbS('os_attend_log', log);
    _p17_renderHistCal(courseId);

    /* Also refresh attendance tab if visible */
    if (typeof window.p16_renderAttendance === 'function') window.p16_renderAttendance();
};

/* Inject History button into every course card ────────────────── */
function _p17_addHistButtons() {
    const courses = document.getElementById('p16-att-courses'); if (!courses) return;
    courses.querySelectorAll('.p16-course-card:not([data-p17hb])').forEach(card => {
        card.dataset.p17hb = '1';
        const hdr = card.querySelector('.p16-course-hdr'); if (!hdr) return;
        /* Extract course id from the edit button's onclick */
        const editBtn = hdr.querySelector('[onclick*="p16_openCourseEdit"]');
        if (!editBtn) return;
        const m = editBtn.getAttribute('onclick').match(/p16_openCourseEdit\(['"]([^'"]+)['"]\)/);
        if (!m) return;
        const cid = m[1];
        const histBtn = document.createElement('button');
        histBtn.className = 'p17-hist-btn';
        histBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.72rem;padding:2px 6px;';
        histBtn.innerHTML = '<i class="fa-solid fa-calendar-days"></i>';
        histBtn.title     = 'View attendance history';
        histBtn.onclick   = e => { e.stopPropagation(); window.p17_openHistory(cid); };
        hdr.insertBefore(histBtn, editBtn);
    });
}

function _p17_watchAttendance() {
    function _try() {
        const el = document.getElementById('p16-att-courses');
        if (!el) { setTimeout(_try, 900); return; }
        _p17_addHistButtons();
        new MutationObserver(() => _p17_addHistButtons()).observe(el, { childList: true });
    }
    _try();
}

/* ================================================================
   5.  ROUTINE — category + notes fields; today strip; duration bar
   ================================================================ */
const P17_CATS = [
    { key: 'study',    label: 'Study',    icon: 'fa-book'          },
    { key: 'break',    label: 'Break',    icon: 'fa-mug-hot'       },
    { key: 'exercise', label: 'Exercise', icon: 'fa-dumbbell'      },
    { key: 'personal', label: 'Personal', icon: 'fa-user'          },
    { key: 'work',     label: 'Work',     icon: 'fa-briefcase'     },
    { key: 'other',    label: 'Other',    icon: 'fa-circle-dot'    },
];

function _p17_enhanceRoutineModal() {
    function _try() {
        const modal = document.getElementById('modal-routine-edit');
        if (!modal || document.getElementById('p17-re-cat')) { setTimeout(_try, 700); return; }

        /* Add Category field before the error line */
        const errEl = document.getElementById('p16-re-err'); if (!errEl) return;
        const catDiv = document.createElement('div');
        catDiv.innerHTML = `
            <div style="margin-top:12px;">
                <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-2 block">Category</label>
                <select id="p17-re-cat" class="bare-input w-full text-sm bg-transparent">
                    ${P17_CATS.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
                </select>
            </div>
            <div style="margin-top:10px;">
                <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-2 block">Notes (optional)</label>
                <textarea id="p17-re-notes" class="bare-input w-full text-sm" rows="2"
                    placeholder="e.g. Chapter 4 review, 20 min run\u2026" style="resize:vertical;min-height:44px;"></textarea>
            </div>`;
        errEl.insertAdjacentElement('beforebegin', catDiv);
    }
    _try();
}

/* Patch p16_openRoutineEdit to pre-fill cat + notes ─────────── */
function _p17_patchOpenRoutineEdit() {
    function _try() {
        if (typeof window.p16_openRoutineEdit !== 'function' || window._p17_oreDone) { setTimeout(_try, 600); return; }
        window._p17_oreDone = true;
        const _orig = window.p16_openRoutineEdit;
        window.p16_openRoutineEdit = function(id) {
            _orig(id);
            setTimeout(() => {
                const item = _p17dbG('os_routine', []).find(x => x.id === id);
                const catSel  = document.getElementById('p17-re-cat');
                const notesTa = document.getElementById('p17-re-notes');
                if (catSel  && item) catSel.value   = item.cat   || 'other';
                if (notesTa && item) notesTa.value  = item.notes || '';
            }, 40);
        };
    }
    _try();
}

/* Patch p16_saveRoutine to persist edited items' cat + notes ─── */
function _p17_patchSaveRoutineEdit() {
    /* We need to intercept when editing (not adding) as well.
       After p16_saveRoutine processes an edit, the item already has the
       old data re-mapped with label/day/time/duration/color but no cat/notes.
       Re-apply them with a small delay. */
    function _try() {
        if (typeof window.p16_saveRoutine !== 'function' || window._p17_sreDone) { setTimeout(_try, 600); return; }
        window._p17_sreDone = true;
        const _orig2 = window.p16_saveRoutine;
        window.p16_saveRoutine = function() {
            const editId = document.getElementById('p16-re-id')?.value || null;
            const cat    = document.getElementById('p17-re-cat')?.value   || 'other';
            const notes  = document.getElementById('p17-re-notes')?.value?.trim() || '';
            _orig2();
            setTimeout(() => {
                let items = _p17dbG('os_routine', []);
                const target = editId ? items.find(x => x.id === editId) : items[items.length - 1];
                if (target) { target.cat = cat; target.notes = notes; _p17dbS('os_routine', items); }
                /* Re-render so today strip + cat badges show */
                if (typeof window.p16_renderRoutine === 'function') window.p16_renderRoutine();
                _p17_renderTodayStrip();
            }, 90);
        };
    }
    _try();
}

/* ── Today strip ─────────────────────────────────────────────── */
function _p17_injectTodayStrip() {
    if (document.getElementById('p17-today-strip')) return;
    const view = document.getElementById('view-routine'); if (!view) return;
    const grid = view.querySelector('.p16-routine-grid'); if (!grid) return;
    const strip = document.createElement('div');
    strip.id        = 'p17-today-strip';
    strip.className = 'p17-today-strip';
    strip.innerHTML = `
        <div class="p17-today-strip-hdr">
            <i class="fa-solid fa-sun"></i>Today's Schedule
        </div>
        <div class="p17-today-blocks" id="p17-today-blocks">
            <span style="font-size:.75rem;color:var(--text-muted);">Nothing scheduled for today.</span>
        </div>`;
    grid.insertAdjacentElement('beforebegin', strip);
    _p17_renderTodayStrip();
}

function _p17_renderTodayStrip() {
    const el = document.getElementById('p17-today-blocks'); if (!el) return;
    const dow     = new Date().getDay();
    const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][dow];
    const items    = _p17dbG('os_routine', [])
        .filter(x => x.day === todayKey)
        .sort((a, b) => a.time.localeCompare(b.time));

    if (!items.length) {
        el.innerHTML = '<span style="font-size:.75rem;color:var(--text-muted);">Nothing scheduled for today.</span>';
        return;
    }
    const safeColor = c => (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#3b82f6';
    el.innerHTML = items.map(item => {
        const catObj  = P17_CATS.find(c => c.key === item.cat) || P17_CATS[P17_CATS.length - 1];
        const sc      = safeColor(item.color);
        const dur     = parseInt(item.duration, 10) || 0;
        return `<div class="p17-today-block" style="--bcolor:${sc}" onclick="p16_openRoutineEdit('${_p17esc(item.id)}')">
            <div class="p16-rb-time"><i class="fa-regular fa-clock" style="margin-right:3px;font-size:.52rem;"></i>${_p17esc(item.time || '')}</div>
            <div class="p16-rb-label">${_p17esc(item.label)}</div>
            <div class="p17-rb-cat"><i class="fa-solid ${catObj.icon}"></i>${catObj.label}</div>
            ${item.notes ? `<div class="p17-rb-note">${_p17esc(item.notes)}</div>` : ''}
        </div>`;
    }).join('');
}

/* Patch p16_renderRoutine to also add cat badges + duration bar + today strip */
function _p17_patchRenderRoutine() {
    function _try() {
        if (typeof window.p16_renderRoutine !== 'function' || window._p17_rrDone) { setTimeout(_try, 600); return; }
        window._p17_rrDone = true;
        const _orig = window.p16_renderRoutine;
        window.p16_renderRoutine = function() {
            _orig();
            /* Add category badges and duration bars to rendered blocks */
            _p17_augmentRoutineBlocks();
            /* Ensure today strip is present and updated */
            _p17_injectTodayStrip();
            _p17_renderTodayStrip();
        };
    }
    _try();
}

function _p17_augmentRoutineBlocks() {
    const items = _p17dbG('os_routine', []);
    document.querySelectorAll('.p16-routine-block:not([data-p17aug])').forEach(block => {
        block.dataset.p17aug = '1';
        const onclick = block.getAttribute('onclick') || '';
        const m = onclick.match(/p16_openRoutineEdit\(['"]([^'"]+)['"]\)/);
        if (!m) return;
        const item = items.find(x => x.id === m[1]); if (!item) return;
        const catObj = P17_CATS.find(c => c.key === item.cat) || P17_CATS[P17_CATS.length - 1];
        /* Category badge */
        if (!block.querySelector('.p17-rb-cat')) {
            const badge = document.createElement('div');
            badge.className = 'p17-rb-cat';
            badge.innerHTML = `<i class="fa-solid ${catObj.icon}"></i>${catObj.label}`;
            block.appendChild(badge);
        }
        /* Notes */
        if (item.notes && !block.querySelector('.p17-rb-note')) {
            const n = document.createElement('div');
            n.className = 'p17-rb-note';
            n.textContent = item.notes;
            block.appendChild(n);
        }
        /* Duration bar — % relative to MAX_DURATION_MINUTES */
        if (!block.querySelector('.p17-rb-durbar')) {
            const MAX_DURATION_MINUTES = 240;
            const dur  = Math.min(parseInt(item.duration, 10) || 0, MAX_DURATION_MINUTES);
            const pct  = Math.round(dur / MAX_DURATION_MINUTES * 100);
            const bar  = document.createElement('div');
            bar.className = 'p17-rb-durbar';
            bar.innerHTML = `<div class="p17-rb-durbar-fill" style="width:${pct}%"></div>`;
            block.appendChild(bar);
        }
    });
}

/* ================================================================
   6.  TASK DRAG & DROP — MutationObserver keeps handles alive
   ================================================================ */
function _p17_robustTaskDnD() {
    function _addHandles() {
        document.querySelectorAll('#full-task-list .task-row:not([data-p17h])').forEach(row => {
            row.dataset.p17h = '1';
            if (!row.querySelector('.task-drag-handle')) {
                const inner = row.querySelector('.flex.items-center.gap-3') || row;
                const h = document.createElement('span');
                h.className = 'task-drag-handle';
                h.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
                inner.insertBefore(h, inner.firstChild);
            }
        });
    }

    function _try() {
        const list = document.getElementById('full-task-list');
        if (!list) { setTimeout(_try, 900); return; }
        _addHandles();
        new MutationObserver(_addHandles).observe(list, { childList: true, subtree: true });
    }
    _try();
}

/* ================================================================
   7.  RE-RENDER FIXES — calendar, notes, grades re-render on
       switch-back if data was changed while on another tab
   ================================================================ */
let _p17_dirtyCalendar = false;
let _p17_dirtyNotes    = false;
let _p17_dirtyGrades   = false;

function _p17_patchRerenders() {
    /* Track dirty state when DB.set is called */
    function _wrapDB() {
        if (window._p17_dbWrapped || !window.DB?.set) return;
        window._p17_dbWrapped = true;
        const _origSet = window.DB.set.bind(window.DB);
        window.DB.set = function(key, val) {
            if (typeof key === 'string') {
                if (key.startsWith('os_event') || key === 'os_calendar') _p17_dirtyCalendar = true;
                if (key === 'os_notes') _p17_dirtyNotes = true;
                if (key === 'os_subjects' || key === 'os_grades') _p17_dirtyGrades = true;
            }
            return _origSet(key, val);
        };
    }

    /* Patch switchTab to force re-render if dirty */
    function _tryST() {
        if (typeof window.switchTab !== 'function' || window._p17_stDone) { setTimeout(_tryST, 500); return; }
        window._p17_stDone = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            if (name === 'calendar' && _p17_dirtyCalendar) {
                _p17_dirtyCalendar = false;
                if (typeof window.renderCalendar === 'function') setTimeout(window.renderCalendar, 60);
            }
            if (name === 'notes' && _p17_dirtyNotes) {
                _p17_dirtyNotes = false;
                if (typeof window.renderNotes === 'function') setTimeout(window.renderNotes, 60);
            }
            if (name === 'grades' && _p17_dirtyGrades) {
                _p17_dirtyGrades = false;
                if (typeof window.renderGrades === 'function') setTimeout(window.renderGrades, 60);
            }
            /* Routine today strip on every visit */
            if (name === 'routine') {
                _p17_injectTodayStrip();
                _p17_renderTodayStrip();
            }
            /* Worksheet handles on every visit */
            if (name === 'worksheet') setTimeout(_p17_attachWsHandles, 80);
        };
    }

    setTimeout(_wrapDB, 1200);
    _tryST();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p17init() {
    const go = () => {
        _p17_wrapVarSection();
        _p17_keepAvatarLarge();
        _p17_watchWorksheet();
        _p17_watchAttendance();
        _p17_enhanceRoutineModal();
        _p17_patchSaveRoutineEdit();   /* covers both add + edit */
        _p17_patchOpenRoutineEdit();
        _p17_patchRenderRoutine();
        _p17_robustTaskDnD();
        _p17_patchRerenders();

        /* Initial renders if tabs already visible */
        setTimeout(() => {
            _p17_injectTodayStrip();
            _p17_renderTodayStrip();
            _p17_attachWsHandles();
            _p17_addHistButtons();
        }, 1800);

        console.log('[patches17] loaded — collapsible vars, larger avatar, ws drag, history modal, routine++, task DnD++, re-render fixes');
    };
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', () => setTimeout(go, 1000))
        : setTimeout(go, 1000);
})();
