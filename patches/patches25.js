/* ================================================================
   StudentOS — patches25.js
   FIXES & IMPROVEMENTS:
   1.  Worksheet resize  — draggable bottom handle on every block,
                           height saved in os_worksheet per block id
   2.  Custom formula    — add any formula expression to the
                           worksheet without needing a saved library
                           entry; all library formulas still listed
   3.  PDF export        — blob-URL approach (no popup-blocker risk),
                           font-load wait, HTML download fallback
   4.  Attendance UI     — definitive consolidated renderer:
                           2-col responsive grid, 4-week calendar
                           with click-to-log any past date, summary
                           bar above the scroll area, correct course-
                           id binding, day-log popup
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p25lsG  = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p25lsS  = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p25dbG  = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p25lsG(k, d); } catch { return d; } };
const _p25dbS  = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p25lsS(k, v); } catch {} };
const _p25esc  = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p25id   = () => Math.random().toString(36).slice(2, 10);
const _p25toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const _p25date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const _p25safeColor = c => /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : 'var(--accent)';

/* ================================================================
   1.  WORKSHEET BLOCK RESIZE
       Patches p19_wbRender (and all overlay renderers) to attach a
       drag handle at the bottom of every .p19-ws-block.  Heights are
       saved in the os_worksheet blob under block.height.
   ================================================================ */
function _p25_resizableBlocks() {

    function _getWs()    { return _p25dbG('os_worksheet', { blocks: [], savedValues: {} }); }
    function _saveWs(ws) { _p25dbS('os_worksheet', ws); }

    /* Attach resize handle to a single block element.
       Safe to call multiple times; only attaches once per element. */
    function _attachHandle(el) {
        if (!el || el.dataset.p25resize) return;
        el.dataset.p25resize = '1';

        /* Restore saved height */
        const bid = el.dataset.bid;
        if (bid) {
            const ws = _getWs();
            const blk = (ws.blocks || []).find(b => b.id === bid);
            if (blk?.height) el.style.minHeight = blk.height + 'px';
        }

        const handle = document.createElement('div');
        handle.className = 'p25-block-resize';
        handle.title     = 'Drag to resize block';
        handle.innerHTML = '<div class="p25-block-resize-grip"></div>';

        let _startY = 0;
        let _startH = 0;

        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            e.stopPropagation();
            _startY = e.clientY;
            _startH = el.offsetHeight;
            handle.classList.add('active');
            handle.setPointerCapture(e.pointerId);
        });

        handle.addEventListener('pointermove', e => {
            if (!handle.hasPointerCapture(e.pointerId)) return;
            const newH = Math.max(52, _startH + (e.clientY - _startY));
            el.style.minHeight = newH + 'px';
        });

        handle.addEventListener('pointerup', e => {
            if (!handle.hasPointerCapture(e.pointerId)) return;
            handle.classList.remove('active');
            if (!bid) return;
            const ws  = _getWs();
            const blk = (ws.blocks || []).find(b => b.id === bid);
            if (blk) blk.height = el.offsetHeight;
            _saveWs(ws);
        });

        handle.addEventListener('pointercancel', () => handle.classList.remove('active'));

        el.appendChild(handle);
    }

    /* Observe #p19-ws-board and attach handles to any new blocks */
    function _observe() {
        const board = document.getElementById('p19-ws-board');
        if (!board) { setTimeout(_observe, 600); return; }

        /* Attach to already-rendered blocks */
        board.querySelectorAll('.p19-ws-block[data-bid]').forEach(_attachHandle);

        new MutationObserver(() => {
            board.querySelectorAll('.p19-ws-block[data-bid]').forEach(_attachHandle);
        }).observe(board, { childList: true, subtree: false });
    }

    /* Also re-run when worksheet view is first injected */
    function _waitView() {
        const main = document.getElementById('main-scroll');
        if (!main) { setTimeout(_waitView, 800); return; }
        new MutationObserver(() => {
            if (document.getElementById('p19-ws-board')) _observe();
        }).observe(main, { childList: true });
        if (document.getElementById('p19-ws-board')) _observe();
    }

    _waitView();
}

/* ================================================================
   2.  CUSTOM FORMULA BLOCK IN PICKER
       Patches p19_wbOpenPicker to inject a "Custom formula" section
       where the user can type any expression and instantly add a
       formula block — no library entry required.
       Also includes a small "vars" auto-detector so the block gets
       proper variable input fields.
   ================================================================ */
function _p25_customFormulaPicker() {

    /* Detect variable symbols from expression string */
    function _extractVars(expr) {
        const SKIP = new Set(['sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh',
                              'sqrt','cbrt','abs','log','log2','log10','exp','pow','ceil','floor',
                              'round','sign','min','max','hypot','pi','e','inf','infinity','nan',
                              'true','false','if','else','and','or','not']);
        const tokens = (expr || '').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        const seen = new Set();
        return tokens.filter(t => {
            const lo = t.toLowerCase();
            if (SKIP.has(lo)) return false;
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        });
    }

    /* Add a custom-expression formula block to the worksheet */
    function _addCustomFormula(title, expr) {
        if (!expr.trim()) { _p25toast('Enter a formula expression first'); return; }
        const syms = _extractVars(expr);
        let vars;
        if (typeof window.p16_detectVars === 'function') {
            vars = window.p16_detectVars(expr).map(sym => ({ sym, name: sym, value: '' }));
        } else {
            vars = syms.map(sym => ({ sym, name: sym, value: '' }));
        }

        const ws = _p25dbG('os_worksheet', { blocks: [], savedValues: {} });
        ws.blocks = ws.blocks || [];
        ws.blocks.push({
            id:        _p25id(),
            type:      'formula',
            formulaId: null,
            title:     title.trim() || expr.trim(),
            formula:   expr.trim(),
            vars,
            solveFor:  vars[0]?.sym || '',
            result:    null,
            savedAs:   '',
        });
        _p25dbS('os_worksheet', ws);
        if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
    }

    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function' || window._p25pickerDone) {
            if (!window._p25pickerDone) { setTimeout(_patchPicker, 400); return; }
            return;
        }
        window._p25pickerDone = true;

        const _origOpen = window.p19_wbOpenPicker;

        window.p19_wbOpenPicker = function() {
            _origOpen();

            setTimeout(() => {
                /* ── Inject custom-formula section once per picker open ── */
                const sheet = document.getElementById('p19-ws-picker-sheet');
                if (!sheet) return;

                /* Remove any stale instance from a previous open */
                sheet.querySelector('#p25-picker-custom-sec')?.remove();

                const sec = document.createElement('div');
                sec.className = 'p19-picker-section';
                sec.id        = 'p25-picker-custom-sec';

                const hdr = document.createElement('div');
                hdr.className   = 'p19-picker-section-hdr';
                hdr.textContent = 'Custom formula';
                sec.appendChild(hdr);

                const grid = document.createElement('div');
                grid.className = 'p25-custom-formula-grid';

                const nameInp = document.createElement('input');
                nameInp.type        = 'text';
                nameInp.id          = 'p25-cf-name';
                nameInp.className   = 'p25-cf-input';
                nameInp.placeholder = 'Name (e.g. Kinetic Energy)';
                nameInp.autocomplete = 'off';

                const exprInp = document.createElement('input');
                exprInp.type        = 'text';
                exprInp.id          = 'p25-cf-expr';
                exprInp.className   = 'p25-cf-input mono p25-cf-full';
                exprInp.placeholder = 'Expression (e.g. 0.5 * m * v^2)';
                exprInp.autocomplete = 'off';
                exprInp.addEventListener('keydown', e => {
                    if (e.key === 'Enter') addBtn.click();
                });

                const addBtn = document.createElement('button');
                addBtn.className = 'p25-cf-add-btn p25-cf-full';
                addBtn.type      = 'button';
                addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to worksheet';
                addBtn.addEventListener('click', () => {
                    _addCustomFormula(nameInp.value, exprInp.value);
                });

                grid.appendChild(nameInp);
                grid.appendChild(exprInp);
                grid.appendChild(addBtn);
                sec.appendChild(grid);
                sheet.appendChild(sec);

                /* Focus the name input */
                setTimeout(() => nameInp.focus(), 80);
            }, 60);
        };
    }

    _patchPicker();
}

/* ================================================================
   3.  WORKSHEET PDF — BLOB-URL APPROACH
       Creates a self-contained HTML page in a Blob, opens it in a
       new tab, and calls window.print() after fonts load.  Falls
       back to an HTML download if the tab could not be opened.
       Supersedes patches21 + patches24 PDF buttons.
   ================================================================ */
function _p25_worksheetPDF() {

    function _printCSS() {
        return `
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                background: #fff; color: #111;
                padding: 32px 48px; line-height: 1.6;
            }
            h1 { font-size: 1.4rem; font-weight: 300; margin-bottom: 20px; color: #222; letter-spacing: -.01em; }
            .p19-ws-block {
                background: #f9fafb; border: 1px solid #e5e7eb;
                border-radius: 10px; padding: 16px 18px;
                margin-bottom: 12px; page-break-inside: avoid;
            }
            /* hide interactive chrome */
            .p19-ws-block-actions, .p19-ws-block-btn,
            #p19-ws-add-btn-fixed, .p25-block-resize,
            .p24-draw-toolbar button, .p23-ws-code-header button,
            .p19-ws-formula-actions button, .p19-ws-saveas-row,
            #p25-ws-pdf-btn, #p24-ws-print-btn, #p21-ws-print-btn,
            .p23-ws-autosave { display: none !important; }
            /* inputs & textareas read as plain text */
            input, textarea {
                border: none !important; background: transparent !important;
                outline: none; width: 100%; color: inherit; font-family: inherit;
                font-size: inherit; resize: none; padding: 0;
            }
            .p19-ws-heading-input { font-size: 1.2rem; font-weight: 700; }
            .p19-ws-formula-expr  {
                font-family: 'Courier New', monospace;
                background: #eff6ff; color: #1d4ed8;
                border: 1px solid #bfdbfe !important;
                border-radius: 6px; padding: 4px 10px; display: inline-block;
                font-size: .82rem;
            }
            .p19-ws-result {
                background: #f0fdf4; border: 1px solid #86efac !important;
                border-radius: 8px; padding: 8px 14px; margin-top: 8px;
                display: flex; align-items: center; gap: 8px;
            }
            .p19-ws-result-val { font-size: 1.1rem; font-weight: 800; color: #166534; font-family: 'Courier New', monospace; }
            .p24-draw-canvas { border: 1px solid #e5e7eb; border-radius: 6px; max-width: 100%; display: block; }
            .p23-ws-code-body {
                font-family: 'Courier New', monospace; font-size: .78rem;
                background: #1e1e2e; color: #cdd6f4;
                padding: 12px; border-radius: 6px; white-space: pre-wrap;
            }
            .p19-ws-var-row {
                display: flex; align-items: center; gap: 6px;
                padding: 5px 8px; border: 1px solid #e5e7eb;
                border-radius: 8px; margin: 4px 0;
            }
            .checklist-block .p22-checklist-item { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: .85rem; }
            .p23-ws-img-display { max-width: 100%; border-radius: 8px; }
            @media print {
                body { padding: 0; }
                .p19-ws-block { page-break-inside: avoid; }
            }
        `;
    }

    function _exportPDF() {
        const board = document.getElementById('p19-ws-board');
        if (!board) { _p25toast('Open the Worksheet first'); return; }

        /* Clone and sanitise */
        const clone = board.cloneNode(true);

        /* Convert live draw canvases to static images */
        board.querySelectorAll('.p24-draw-canvas').forEach((cvs, i) => {
            const cloneCvs = clone.querySelectorAll('.p24-draw-canvas')[i];
            if (!cloneCvs) return;
            try {
                const img = document.createElement('img');
                img.src        = cvs.toDataURL('image/png');
                img.className  = 'p24-draw-canvas';
                img.style.cssText = 'max-width:100%;height:auto;';
                cloneCvs.replaceWith(img);
            } catch {}
        });

        /* Remove interactive controls */
        clone.querySelectorAll([
            '.p19-ws-block-actions', '#p19-ws-add-btn-fixed',
            '.p23-ws-autosave', '.p25-block-resize',
            '#p25-ws-pdf-btn', '#p24-ws-print-btn', '#p21-ws-print-btn',
            '#p19-ws-picker',
        ].join(',')).forEach(el => el.remove());

        const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>Worksheet — StudentOS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>${_printCSS()}</style>
</head><body>
<h1>Worksheet</h1>
${clone.outerHTML}
<script>
(function() {
    function _go() { window.print(); }
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() { setTimeout(_go, 250); });
    } else {
        window.addEventListener('load', function() { setTimeout(_go, 400); });
    }
})();
<\/script>
</body></html>`;

        /* ── Blob URL approach — no popup-blocker risk ── */
        let blobUrl = null;
        try {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            blobUrl = URL.createObjectURL(blob);
        } catch (err) {
            _p25toast('Could not prepare PDF: ' + err.message);
            return;
        }

        const win = window.open(blobUrl, '_blank');

        if (win) {
            /* Revoke blob URL once the window has loaded its content */
            setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch {} }, 20000);
        } else {
            /* Popup blocked — download HTML file instead */
            try {
                const a       = document.createElement('a');
                a.href        = blobUrl;
                a.download    = 'worksheet.html';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 5000);
                _p25toast('Saved worksheet.html — open it and print to PDF');
            } catch {
                _p25toast('Allow pop-ups to export PDF');
            }
        }
    }

    /* Inject button into worksheet toolbar — replaces / hides older buttons */
    function _injectBtn() {
        function _try() {
            const toolbar = document.getElementById('p19-ws-toolbar');
            if (!toolbar) { setTimeout(_try, 1200); return; }
            if (document.getElementById('p25-ws-pdf-btn')) return;

            /* Hide older export buttons */
            ['p21-ws-print-btn','p24-ws-print-btn'].forEach(id => {
                const old = document.getElementById(id);
                if (old) old.style.display = 'none';
            });

            const btn = document.createElement('button');
            btn.id        = 'p25-ws-pdf-btn';
            btn.type      = 'button';
            btn.title     = 'Export worksheet as PDF';
            btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Export PDF';
            btn.addEventListener('click', _exportPDF);
            toolbar.appendChild(btn);
        }
        _try();

        /* Re-inject after any worksheet re-render */
        function _watchMain() {
            const main = document.getElementById('main-scroll');
            if (!main) { setTimeout(_watchMain, 800); return; }
            new MutationObserver(() => {
                const toolbar = document.getElementById('p19-ws-toolbar');
                if (!toolbar) return;
                if (!document.getElementById('p25-ws-pdf-btn')) _try();
                ['p21-ws-print-btn','p24-ws-print-btn'].forEach(id => {
                    const old = document.getElementById(id);
                    if (old) old.style.display = 'none';
                });
            }).observe(main, { childList: true, subtree: true });
        }
        _watchMain();
    }

    _injectBtn();
}

/* ================================================================
   4.  ATTENDANCE UI — DEFINITIVE RENDERER
       Completely overrides p16_renderAttendance with a clean,
       correct implementation that:
       • Uses p25-att-card design with proper data-course-id
       • Shows a summary bar ABOVE the scroll container
       • Renders a 4-week date grid with click-to-log any past day
       • Opens a tiny popup to choose attended / missed / remove
       • Handles the p16_logAttend Firebase/localStorage bridge
   ================================================================ */
function _p25_attendanceFix() {

    /* ── Date helpers ─────────────────────────────────────────── */
    function _calDays(n) {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push({
                str:     _p25date(d),
                dow:     d.getDay(),
                day:     d.getDate(),
                month:   d.getMonth(),
                isToday: i === 0,
                /* All days in this loop are past or today; never future */
            });
        }
        return days;
    }

    /* ── Day-log popup ─────────────────────────────────────────── */
    let _popup = null;

    function _getPopup() {
        if (_popup) return _popup;
        _popup = document.createElement('div');
        _popup.className = 'p25-att-day-popup';
        _popup.id        = 'p25-att-day-popup';
        document.body.appendChild(_popup);

        /* Dismiss on outside click */
        document.addEventListener('pointerdown', e => {
            if (_popup && !_popup.contains(e.target)) _dismissPopup();
        }, true);
        return _popup;
    }

    function _dismissPopup() {
        if (_popup) _popup.classList.remove('show');
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
            { label: 'Attended',  cls: 'att',  status: 'attended' },
            { label: 'Missed',    cls: 'miss', status: 'missed'   },
            { label: 'Remove log',cls: 'rem',  status: 'remove'   },
        ];

        actions.forEach(a => {
            if (a.status !== 'remove' && a.status === currentStatus) return; // skip active-state re-set
            const b = document.createElement('button');
            b.className = 'p25-att-popup-btn ' + a.cls;
            b.type      = 'button';
            b.innerHTML = '<i class="fa-solid fa-' +
                (a.status === 'attended' ? 'circle-check' : a.status === 'missed' ? 'circle-xmark' : 'trash') +
                '"></i> ' + a.label;
            b.addEventListener('click', () => {
                _dismissPopup();
                _logDate(courseId, dateStr, a.status);
            });
            btns.appendChild(b);
        });
        popup.appendChild(btns);

        /* Position near anchor */
        const rect  = anchorEl.getBoundingClientRect();
        const scrollY = window.scrollY || 0;
        const scrollX = window.scrollX || 0;
        popup.classList.add('show');
        const pw = popup.offsetWidth  || 160;
        const ph = popup.offsetHeight || 100;
        let left = rect.left + scrollX;
        let top  = rect.bottom + scrollY + 6;
        if (left + pw > window.innerWidth - 12)  left = window.innerWidth - pw - 12;
        if (top  + ph > window.innerHeight + scrollY - 12) top = rect.top + scrollY - ph - 6;
        popup.style.left = left + 'px';
        popup.style.top  = top  + 'px';
    }

    /* ── Log a single day ─────────────────────────────────────── */
    function _logDate(courseId, dateStr, status) {
        let log = _p25dbG('os_attend_log', [])
                    .filter(l => !(l.courseId === courseId && l.date === dateStr));
        if (status !== 'remove') log.push({ courseId, date: dateStr, status });
        _p25dbS('os_attend_log', log);
        /* Keep Firebase in sync via p16 bridge if available */
        if (typeof window.p16_logAttend === 'function' && dateStr === _p25date()) {
            window.p16_logAttend(courseId, status); // p16 only stores today
        } else {
            window.p16_renderAttendance();
        }
    }

    /* ── Build one course card ─────────────────────────────────── */
    function _buildCard(course, log) {
        const today    = _p25date();
        const cLog     = log.filter(l => l.courseId === course.id);
        const attended = cLog.filter(l => l.status === 'attended').length;
        const total    = cLog.length;
        const pct      = total > 0 ? Math.round(attended / total * 100) : 0;
        const goal     = Math.max(1, Math.min(100, parseInt(course.goal, 10) || 80));
        const pctColor = pct >= goal ? '#22c55e' : pct >= goal - 15 ? '#f59e0b' : '#ef4444';
        const cColor   = _p25safeColor(course.color);
        const todaySt  = cLog.find(l => l.date === today)?.status;
        const logMap   = {};
        cLog.forEach(l => { logMap[l.date] = l.status; });

        const card = document.createElement('div');
        card.className         = 'p25-att-card';
        card.dataset.courseId  = course.id;
        card.style.setProperty('--p25c', cColor);

        /* ── Header ── */
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
            sched.innerHTML = '<i class="fa-solid fa-clock"></i>' + _p25esc(course.schedule);
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

        /* ── Stats ── */
        const stats = document.createElement('div');
        stats.className = 'p25-att-stats';

        const pctEl = document.createElement('div');
        pctEl.className  = 'p25-att-pct';
        pctEl.style.color = pctColor;
        pctEl.textContent = pct + '%';

        const barCol = document.createElement('div');
        barCol.className = 'p25-att-bar-col';

        const barBg   = document.createElement('div');
        barBg.className = 'p25-att-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'p25-att-bar-fill';
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

        /* ── 4-week calendar ─────────────────────────────────── */
        const days  = _calDays(28);
        const weeks = [];
        /* Split 28 days into 4 rows of 7 (Mon–Sun via offset) */
        for (let w = 0; w < 4; w++) weeks.push(days.slice(w * 7, w * 7 + 7));

        const cal = document.createElement('div');
        cal.className = 'p25-att-cal';

        /* Day-of-week header labels */
        const hdrRow = document.createElement('div');
        hdrRow.className = 'p25-att-cal-hdr-row';
        /* week label spacer */
        const spacer = document.createElement('div');
        spacer.style.cssText = 'width:18px;flex-shrink:0;';
        hdrRow.appendChild(spacer);
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(lbl => {
            const l = document.createElement('div');
            l.className   = 'p25-att-cal-dlbl';
            l.textContent = lbl;
            hdrRow.appendChild(l);
        });
        cal.appendChild(hdrRow);

        const weeksWrap = document.createElement('div');
        weeksWrap.className = 'p25-att-cal-weeks';

        weeks.forEach((weekDays, wi) => {
            const row = document.createElement('div');
            row.className = 'p25-att-cal-week';

            /* Week offset label (e.g. -3w, -2w, -1w, now) */
            const wlbl = document.createElement('div');
            wlbl.className   = 'p25-att-week-lbl';
            wlbl.textContent = wi === 3 ? 'now' : '-' + (3 - wi) + 'w';
            row.appendChild(wlbl);

            /* Pad the first week so Sunday aligns to column 0 */
            if (wi === 0 && weekDays.length > 0) {
                const firstDow = weekDays[0].dow; /* 0=Sun … 6=Sat */
                for (let p = 0; p < firstDow; p++) {
                    const pad = document.createElement('div');
                    pad.className = 'p25-att-cell future';
                    row.appendChild(pad);
                }
            }

            weekDays.forEach(day => {
                const cell = document.createElement('div');
                const st   = logMap[day.str];
                cell.className = 'p25-att-cell' + (day.isToday ? ' today' : '');
                if (st) cell.dataset.status = st;
                cell.title = day.str + (st ? ' — ' + st : '');

                cell.addEventListener('click', e => {
                    e.stopPropagation();
                    _showDayPopup(course.id, day.str, st, cell);
                });
                row.appendChild(cell);
            });
            weeksWrap.appendChild(row);
        });

        cal.appendChild(weeksWrap);
        card.appendChild(cal);

        /* ── Today action buttons ── */
        const actions = document.createElement('div');
        actions.className = 'p25-att-actions';

        const attBtn = document.createElement('button');
        attBtn.type      = 'button';
        attBtn.className = 'p25-att-btn att' + (todaySt === 'attended' ? ' active' : '');
        attBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i>' +
                           (todaySt === 'attended' ? 'Attended Today' : 'Mark Attended');
        attBtn.addEventListener('click', () => _logDate(course.id, today, todaySt === 'attended' ? 'remove' : 'attended'));

        const missBtn = document.createElement('button');
        missBtn.type      = 'button';
        missBtn.className = 'p25-att-btn miss' + (todaySt === 'missed' ? ' active' : '');
        missBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>' +
                            (todaySt === 'missed' ? 'Marked Missed' : 'Mark Missed');
        missBtn.addEventListener('click', () => _logDate(course.id, today, todaySt === 'missed' ? 'remove' : 'missed'));

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
        bar.id        = 'p25-att-summary-bar';
        bar.className = 'p25-att-summary-bar';  /* p25 provides CSS class */
        bar.id        = 'p25-att-summary-bar';

        const items = [
            { val: courses.length, lbl: 'Courses' },
            null,
            { val: allSess,        lbl: 'Sessions' },
            null,
            { val: pct + '%',      lbl: 'Overall', color: pctColor },
        ];
        items.forEach(item => {
            if (!item) {
                const div = document.createElement('div');
                div.className = 'p25-att-sum-div';
                bar.appendChild(div);
                return;
            }
            const wrap = document.createElement('div');
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

    /* ── Main render function ─────────────────────────────────── */
    function _render() {
        const courses = _p25dbG('os_attend_courses', []);
        const log     = _p25dbG('os_attend_log',     []);
        const el      = document.getElementById('p16-att-courses');
        if (!el) return;

        /* Clear old p24 summary bar (appended inside scroll) */
        document.getElementById('p24-att-summary')?.remove();

        /* Refresh / inject summary bar ABOVE the scroll container */
        const view    = document.getElementById('view-attendance');
        const scrollDiv = el.closest('.overflow-y-auto, [style*="overflow"]') || el.parentElement;

        document.getElementById('p25-att-summary-bar')?.remove();
        if (courses.length && view) {
            const bar = _buildSummary(courses, log);
            /* Insert before the scroll container (or before the courses el) */
            const target = scrollDiv && scrollDiv !== view ? scrollDiv : el;
            target.parentElement?.insertBefore(bar, target);
        }

        el.innerHTML = '';

        if (!courses.length) {
            const empty = document.createElement('div');
            empty.className = 'p25-att-empty';
            empty.innerHTML = `<i class="fa-solid fa-user-check" style="font-size:2rem;display:block;margin-bottom:12px;opacity:.3;"></i>
                <div style="font-size:.88rem;">No courses yet. Add a course to start tracking attendance.</div>`;
            empty.style.cssText = 'text-align:center;padding:48px 20px;color:var(--text-muted);';
            el.appendChild(empty);
            return;
        }

        courses.forEach(course => el.appendChild(_buildCard(course, log)));
    }

    /* ── Wait for p16's functions to exist, then override ──────── */
    function _init() {
        if (typeof window.p16_renderAttendance !== 'function' || window._p25attDone) {
            if (!window._p25attDone) { setTimeout(_init, 300); return; }
            return;
        }
        window._p25attDone = true;
        window.p16_renderAttendance = _render;

        /* Run once if attendance view is already visible */
        setTimeout(() => {
            if (document.getElementById('p16-att-courses')) _render();
        }, 200);
    }

    _init();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p25_init() {
    const _go = () => {
        _p25_resizableBlocks();
        /* _p25_customFormulaPicker() — removed: custom formula is now
           integrated into the formula block via the picker (patches27) */
        /* _p25_worksheetPDF() — removed: PDF export replaced by
           window.print() (patches35) */
        _p25_attendanceFix();
        console.log('[patches25] loaded — block resize, attendance UI overhaul');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 200));
    } else {
        setTimeout(_go, 200);
    }
})();
