/* ================================================================
   StudentOS — patches22.js
   FIXES & IMPROVEMENTS:
   1.  Task DnD          — bounding-rect row detection (fixes pointer
                           capture conflicting with elementFromPoint)
   2.  Profile avatar    — robust large preview in settings
   3.  Attendance        — compact cells + past-date toggle
   4.  Worksheet         — checklist block type; PDF button to right
   5.  Formula modal     — hard-hide unit/cat selects + add-var btn
   ================================================================ */

'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const _p22lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p22lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p22dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p22lsG(k, d); } catch { return d; } };
const _p22dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p22lsS(k, v); } catch {} };
const _p22esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p22id  = () => Math.random().toString(36).slice(2, 10);
const _p22toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
const _p22date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
function _p22safeColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6'; }

/* ================================================================
   1.  TASK DRAG-AND-DROP — bounding-rect fix
       Previous patches used setPointerCapture + elementFromPoint.
       When pointer capture is active the browser routes all pointer
       events to the capturing element, so elementFromPoint always
       returns that element, not the row underneath.
       Fix: compare e.clientY to each row's bounding rect instead.
   ================================================================ */
function _p22_taskDnD() {
    let _src   = null;
    let _moved = false;
    let _sx = 0, _sy = 0;

    function _list() { return document.getElementById('full-task-list'); }

    /* Find the task-row whose bounding rect contains point (x, y) */
    function _rowAt(x, y, list) {
        const rows = list.querySelectorAll('.task-row');
        for (const row of rows) {
            const r = row.getBoundingClientRect();
            if (y >= r.top && y <= r.bottom) return row;
        }
        return null;
    }

    function _saveOrder() {
        const l = _list(); if (!l) return;
        const ids = [...l.querySelectorAll('.task-row')]
            .map(r => r.id?.replace('task-row-', '')).filter(Boolean);
        _p22lsS('p18_task_order', ids);
        _p22dbS('os_task_order', ids);
    }

    function _clearStates(l) {
        l?.querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = ''; });
    }

    function _attachPointer(row) {
        const handle = row.querySelector('.task-drag-handle');
        if (!handle || handle.dataset.p22) return;
        handle.dataset.p22 = '1';

        /* Block conflicting HTML5 dragstart from the handle */
        row.addEventListener('dragstart', e => e.preventDefault(), true);

        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            /* Capture so we keep receiving pointermove outside the element */
            try { handle.setPointerCapture(e.pointerId); } catch {}
            _src   = row;
            _moved = false;
            _sx    = e.clientX;
            _sy    = e.clientY;
        });

        handle.addEventListener('pointermove', e => {
            if (!_src || _src !== row) return;
            if (!_moved) {
                if (Math.hypot(e.clientX - _sx, e.clientY - _sy) < 6) return;
                _moved = true;
                _src.dataset.dragstate = 'src';
            }
            const l = _list(); if (!l) return;

            /* Use bounding rect — does NOT rely on elementFromPoint */
            const target = _rowAt(e.clientX, e.clientY, l);
            _clearStates(l);
            _src.dataset.dragstate = 'src';
            if (target && target !== _src) target.dataset.dragstate = 'over';
        });

        handle.addEventListener('pointerup', e => {
            const l = _list();
            if (_moved && _src && l) {
                const target = _rowAt(e.clientX, e.clientY, l);
                if (target && target !== _src && l.contains(target)) {
                    const siblings = [...l.querySelectorAll('.task-row')];
                    if (siblings.indexOf(_src) < siblings.indexOf(target))
                        l.insertBefore(_src, target.nextSibling);
                    else
                        l.insertBefore(_src, target);
                    _saveOrder();
                }
                _clearStates(l);
            }
            if (_src) _src.dataset.dragstate = '';
            _src   = null;
            _moved = false;
        });

        handle.addEventListener('pointercancel', () => {
            _clearStates(_list());
            _src   = null;
            _moved = false;
        });
    }

    function _attachAll() {
        const l = _list(); if (!l) return;
        l.querySelectorAll('.task-row').forEach(row => _attachPointer(row));
    }

    function _watch() {
        const l = _list();
        if (!l) { setTimeout(_watch, 600); return; }
        _attachAll();
        new MutationObserver(_attachAll).observe(l, { childList: true });
    }
    _watch();
}

/* ================================================================
   2.  PROFILE AVATAR — robust large preview
       Copies the sidebar avatar (emoji / image) to the settings
       preview and ensures inner img fills the container at 100%.
   ================================================================ */
function _p22_avatarPreview() {
    function _sync() {
        const src  = document.getElementById('avatar-preview');
        const dest = document.getElementById('p10-avatar-preview-tab');
        if (!src || !dest) return;

        dest.innerHTML = src.innerHTML;
        dest.style.background = src.style.background || '';

        /* Make any img inside fill the larger preview container */
        dest.querySelectorAll('img').forEach(img => {
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
        });

        /* Ensure emoji text scales up to fill the larger box */
        if (!dest.querySelector('img')) {
            dest.style.display     = 'flex';
            dest.style.alignItems  = 'center';
            dest.style.justifyContent = 'center';
            dest.style.fontSize    = '2.6rem';
            dest.style.lineHeight  = '1';
        }
    }

    /* Patch renderProfileDisplay to re-sync after any profile change */
    function _patchRPD() {
        if (typeof window.renderProfileDisplay !== 'function' || window._p22rpdDone) {
            if (!window._p22rpdDone) setTimeout(_patchRPD, 500);
            return;
        }
        window._p22rpdDone = true;
        const _orig = window.renderProfileDisplay;
        window.renderProfileDisplay = function() { _orig(); setTimeout(_sync, 80); };
    }

    /* Also sync whenever the settings modal opens */
    function _watchSettings() {
        const modal = document.getElementById('modal-settings');
        if (!modal) { setTimeout(_watchSettings, 900); return; }
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) setTimeout(_sync, 100);
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    /* Override the p10 _p10syncAvatar with our improved version */
    function _patchP10() {
        if (window._p22syncDone) return;
        if (!window._p10syncAvatar) { setTimeout(_patchP10, 400); return; }
        window._p22syncDone = true;
        window._p10syncAvatar = function() { _sync(); };
    }

    _patchRPD();
    _watchSettings();
    _patchP10();
    setTimeout(_sync, 1200);
}

/* ================================================================
   3.  ATTENDANCE — compact cells + past-date toggle
       Adds click handlers on every non-future calendar cell so
       users can correct or add attendance for past dates.
       Re-uses the canonical os_attend_log data store.
   ================================================================ */
function _p22_attendancePastDates() {

    /* Dismiss any open day popup */
    function _dismissPopup() {
        document.querySelectorAll('.p22-att-day-popup').forEach(p => p.remove());
    }

    /* Build and position a small popup anchored to the cell */
    function _showPopup(cell, courseId, dateStr, currentStatus) {
        _dismissPopup();

        const popup = document.createElement('div');
        popup.className = 'p22-att-day-popup';

        const dateLabel = document.createElement('div');
        dateLabel.className = 'p22-att-day-popup-date';
        dateLabel.innerHTML = '<i class="fa-solid fa-calendar-day" style="margin-right:5px;font-size:.6rem;"></i>' + _p22esc(dateStr);
        popup.appendChild(dateLabel);

        /* Close button */
        const closeBtn = document.createElement('button');
        closeBtn.className = 'p22-att-day-popup-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener('click', e => { e.stopPropagation(); _dismissPopup(); });
        popup.appendChild(closeBtn);

        function _action(status) {
            const log  = _p22dbG('os_attend_log', []);
            const kept = log.filter(l => !(l.courseId === courseId && l.date === dateStr));
            if (status !== 'remove') kept.push({ courseId, date: dateStr, status });
            _p22dbS('os_attend_log', kept);
            _dismissPopup();
            /* Re-render attendance */
            if (typeof window.p16_renderAttendance === 'function') window.p16_renderAttendance();
        }

        if (currentStatus !== 'attended') {
            const attBtn = document.createElement('button');
            attBtn.className = 'p22-att-day-popup-btn attend' + (currentStatus === 'attended' ? ' active' : '');
            attBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Attended';
            attBtn.addEventListener('click', e => { e.stopPropagation(); _action('attended'); });
            popup.appendChild(attBtn);
        }
        if (currentStatus !== 'missed') {
            const missBtn = document.createElement('button');
            missBtn.className = 'p22-att-day-popup-btn miss' + (currentStatus === 'missed' ? ' active' : '');
            missBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Missed';
            missBtn.addEventListener('click', e => { e.stopPropagation(); _action('missed'); });
            popup.appendChild(missBtn);
        }
        if (currentStatus) {
            const remBtn = document.createElement('button');
            remBtn.className = 'p22-att-day-popup-btn remove';
            remBtn.innerHTML = '<i class="fa-solid fa-eraser"></i> Clear';
            remBtn.addEventListener('click', e => { e.stopPropagation(); _action('remove'); });
            popup.appendChild(remBtn);
        }

        /* Position near the cell */
        document.body.appendChild(popup);
        const cr = cell.getBoundingClientRect();
        const pr = popup.getBoundingClientRect();
        let top  = cr.bottom + window.scrollY + 4;
        let left = cr.left   + window.scrollX - pr.width / 2 + cr.width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
        popup.style.top  = top  + 'px';
        popup.style.left = left + 'px';

        /* Auto-dismiss on outside click */
        setTimeout(() => {
            document.addEventListener('click', function _outside(ev) {
                if (!popup.contains(ev.target)) {
                    _dismissPopup();
                    document.removeEventListener('click', _outside);
                }
            });
        }, 50);
    }

    /* Augment each calendar cell with a click handler when the
       attendance view is rendered or re-rendered.                */
    function _attachCells() {
        document.querySelectorAll('.p21-att-cal-cell:not(.future):not(.today)').forEach(cell => {
            if (cell.dataset.p22) return;
            cell.dataset.p22 = '1';
            cell.classList.add('past-date');

            cell.addEventListener('click', e => {
                e.stopPropagation();
                const dateStr  = cell.title?.split(':')[0]?.trim();
                const courseId = cell.dataset.courseId;
                if (!dateStr || !courseId) return;
                const log    = _p22dbG('os_attend_log', []);
                const entry  = log.find(l => l.courseId === courseId && l.date === dateStr);
                _showPopup(cell, courseId, dateStr, entry?.status || null);
            });
        });

        /* Also attach today cells */
        document.querySelectorAll('.p21-att-cal-cell.today:not([data-p22])').forEach(cell => {
            if (cell.dataset.p22) return;
            cell.dataset.p22 = '1';
            cell.classList.add('past-date');
            cell.addEventListener('click', e => {
                e.stopPropagation();
                const dateStr  = cell.title?.split(':')[0]?.trim();
                const courseId = cell.dataset.courseId;
                if (!dateStr || !courseId) return;
                const log    = _p22dbG('os_attend_log', []);
                const entry  = log.find(l => l.courseId === courseId && l.date === dateStr);
                _showPopup(cell, courseId, dateStr, entry?.status || null);
            });
        });
    }

    /* Patch p21's _renderCourseCard to embed courseId on each cell */
    function _patchP21Render() {
        const orig21 = window.p16_renderAttendance;
        if (!orig21 || window._p22attPatchDone) {
            if (!window._p22attPatchDone) setTimeout(_patchP21Render, 500);
            return;
        }
        window._p22attPatchDone = true;

        const _origRender = window.p16_renderAttendance;
        window.p16_renderAttendance = function() {
            _origRender();
            setTimeout(() => {
                /* After render, stamp courseId on each cell by reading the
                   nearest course card's data-courseid attribute.           */
                document.querySelectorAll('.p21-att-course-card').forEach(card => {
                    const courseId = card.dataset.courseId;
                    if (!courseId) return;
                    card.querySelectorAll('.p21-att-cal-cell').forEach(cell => {
                        cell.dataset.courseId = courseId;
                    });
                });
                _attachCells();
            }, 80);
        };
    }

    /* Also patch p21's _renderCourseCard to set data-courseId on the card */
    function _patchCourseCard() {
        if (window._p22ccDone) return;
        /* p21 builds cards via _renderCourseCard which appends to #p16-att-courses.
           We observe the container and stamp courseId from course data.             */
        function _observe() {
            const el = document.getElementById('p16-att-courses');
            if (!el) { setTimeout(_observe, 800); return; }

            function _stamp() {
                const courses = _p22dbG('os_attend_courses', []);
                el.querySelectorAll('.p21-att-course-card').forEach((card, i) => {
                    if (!card.dataset.courseId && courses[i]) {
                        card.dataset.courseId = courses[i].id;
                    }
                });
                /* Stamp cells */
                el.querySelectorAll('.p21-att-course-card').forEach(card => {
                    const cid = card.dataset.courseId;
                    if (!cid) return;
                    card.querySelectorAll('.p21-att-cal-cell').forEach(cell => {
                        cell.dataset.courseId = cid;
                    });
                });
                _attachCells();
            }

            _stamp();
            new MutationObserver(_stamp).observe(el, { childList: true, subtree: true });
            window._p22ccDone = true;
        }
        _observe();
    }

    _patchP21Render();
    _patchCourseCard();

    /* Dismiss popup on scroll */
    document.addEventListener('scroll', _dismissPopup, true);
}

/* ================================================================
   4.  WORKSHEET IMPROVEMENTS
       4a. Move PDF export button to right end of toolbar
       4b. Add "Checklist" block type
   ================================================================ */
function _p22_worksheetImprovements() {

    /* 4a — Ensure the PDF button sits at the far right of the toolbar */
    function _fixPdfBtnPosition() {
        function _try() {
            const btn = document.getElementById('p21-ws-print-btn');
            const toolbar = document.getElementById('p19-ws-toolbar');
            if (!btn || !toolbar) { setTimeout(_try, 800); return; }

            /* Move it to be the last child of the toolbar so margin-left:auto
               (set in CSS) pushes it to the right.                              */
            toolbar.appendChild(btn);
        }
        _try();

        /* Re-check whenever toolbar changes (worksheet re-render) */
        function _watchToolbar() {
            const view = document.getElementById('view-worksheet');
            if (!view) { setTimeout(_watchToolbar, 1000); return; }
            new MutationObserver(() => {
                const btn = document.getElementById('p21-ws-print-btn');
                const toolbar = document.getElementById('p19-ws-toolbar');
                if (btn && toolbar && toolbar.lastChild !== btn) toolbar.appendChild(btn);
            }).observe(view, { childList: true, subtree: true });
        }
        _watchToolbar();
    }

    /* 4b — Checklist block type */
    function _injectChecklist() {

        /* Store helpers (share os_worksheet with p19) */
        function _getData()   { return _p22dbG('os_worksheet', { blocks: [], savedValues: {} }); }
        function _saveData(d) { _p22dbS('os_worksheet', d); }

        function _migrate(ws) {
            if (Array.isArray(ws.blocks)) return ws;
            return { blocks: (ws.steps || []).map(s => ({ id: s.id || _p22id(), type: 'text', content: s.content || '' })),
                     savedValues: ws.savedValues || {} };
        }

        /* Build DOM for a single checklist block */
        function _buildChecklistBlock(block) {
            const el = document.createElement('div');
            el.className = 'p19-ws-block checklist-block';
            el.dataset.bid = block.id;

            /* Reuse p19 action buttons */
            const actions = document.createElement('div');
            actions.className = 'p19-ws-block-actions';
            const handle = document.createElement('button');
            handle.className = 'p19-ws-block-btn handle';
            handle.dataset.bid = block.id;
            handle.title = 'Drag to reorder';
            handle.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
            const del = document.createElement('button');
            del.className = 'p19-ws-block-btn del';
            del.dataset.p19action = 'del-block';
            del.dataset.bid = block.id;
            del.title = 'Delete block';
            del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            actions.appendChild(handle);
            actions.appendChild(del);
            el.appendChild(actions);

            const titleBar = document.createElement('div');
            titleBar.className = 'p22-ws-checklist-title';
            titleBar.innerHTML = '<i class="fa-solid fa-list-check" style="margin-right:5px;"></i>Checklist';
            el.appendChild(titleBar);

            const itemsEl = document.createElement('div');
            itemsEl.className = 'p22-ws-cl-items';
            itemsEl.dataset.bid = block.id;

            const items = block.items || [];
            items.forEach((item, idx) => _appendItem(itemsEl, block, item, idx));

            el.appendChild(itemsEl);

            /* Add-item button */
            const addBtn = document.createElement('button');
            addBtn.className = 'p22-ws-cl-add-btn';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add item';
            addBtn.addEventListener('click', () => {
                const ws = _migrate(_getData());
                const b  = (ws.blocks || []).find(x => x.id === block.id);
                if (!b) return;
                b.items = b.items || [];
                b.items.push({ id: _p22id(), text: '', checked: false });
                _saveData(ws);
                if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
            });
            el.appendChild(addBtn);
            return el;
        }

        function _appendItem(container, block, item, idx) {
            const row = document.createElement('div');
            row.className = 'p22-ws-cl-row';

            const check = document.createElement('button');
            check.className = 'p22-ws-cl-check' + (item.checked ? ' checked' : '');
            check.innerHTML = item.checked ? '<i class="fa-solid fa-check"></i>' : '';
            check.addEventListener('click', () => {
                const ws = _migrate(_getData());
                const b  = (ws.blocks || []).find(x => x.id === block.id);
                if (!b || !b.items) return;
                const it = b.items.find(i => i.id === item.id);
                if (it) it.checked = !it.checked;
                _saveData(ws);
                if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
            });

            const inp = document.createElement('input');
            inp.className = 'p22-ws-cl-input' + (item.checked ? ' checked' : '');
            inp.placeholder = 'Item\u2026';
            inp.value = item.text || '';
            inp.addEventListener('input', () => {
                const ws = _migrate(_getData());
                const b  = (ws.blocks || []).find(x => x.id === block.id);
                if (!b || !b.items) return;
                const it = b.items.find(i => i.id === item.id);
                if (it) it.text = inp.value;
                _saveData(ws);
            });
            inp.addEventListener('keydown', e => {
                /* Enter — add new item below */
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const ws = _migrate(_getData());
                    const b  = (ws.blocks || []).find(x => x.id === block.id);
                    if (!b) return;
                    b.items = b.items || [];
                    const pos = b.items.findIndex(i => i.id === item.id);
                    b.items.splice(pos + 1, 0, { id: _p22id(), text: '', checked: false });
                    _saveData(ws);
                    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                }
                /* Backspace on empty item — delete it */
                if (e.key === 'Backspace' && inp.value === '') {
                    e.preventDefault();
                    const ws = _migrate(_getData());
                    const b  = (ws.blocks || []).find(x => x.id === block.id);
                    if (!b || !b.items) return;
                    b.items = b.items.filter(i => i.id !== item.id);
                    _saveData(ws);
                    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                }
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'p22-ws-cl-del';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.title = 'Remove item';
            delBtn.addEventListener('click', () => {
                const ws = _migrate(_getData());
                const b  = (ws.blocks || []).find(x => x.id === block.id);
                if (!b || !b.items) return;
                b.items = b.items.filter(i => i.id !== item.id);
                _saveData(ws);
                if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
            });

            row.appendChild(check);
            row.appendChild(inp);
            row.appendChild(delBtn);
            container.appendChild(row);
        }

        /* Patch p19_wbRender to also handle our checklist type */
        function _patchRender() {
            if (typeof window.p19_wbRender !== 'function' || window._p22wbRenderDone) {
                if (!window._p22wbRenderDone) setTimeout(_patchRender, 400);
                return;
            }
            window._p22wbRenderDone = true;

            /* Hook into the existing _p19_buildBlock by storing our builder globally */
            const origRender = window.p19_wbRender;
            window.p19_wbRender = function() {
                origRender();
                /* After p19 renders, find any checklist blocks that weren't rendered
                   (p19 returns null for unknown types) and inject them in-place.     */
                const board = document.getElementById('p19-ws-board'); if (!board) return;
                const ws    = _migrate(_p22dbG('os_worksheet', { blocks: [], savedValues: {} }));
                (ws.blocks || []).forEach(block => {
                    if (block.type !== 'checklist') return;
                    /* If board already has this block rendered, skip */
                    if (board.querySelector(`[data-bid="${CSS.escape(block.id)}"]`)) return;
                    /* Find where it should be inserted based on order */
                    const idx   = ws.blocks.indexOf(block);
                    const allEls = [...board.querySelectorAll('[data-bid]')];
                    const el    = _buildChecklistBlock(block);
                    if (idx === 0 || allEls.length === 0) {
                        board.insertBefore(el, board.firstChild);
                    } else {
                        /* Insert after the block that comes before this one */
                        const prevBlock = ws.blocks[idx - 1];
                        const prevEl    = board.querySelector(`[data-bid="${CSS.escape(prevBlock.id)}"]`);
                        if (prevEl) prevEl.after(el);
                        else board.insertBefore(el, board.querySelector('#p19-ws-add-btn-fixed') || null);
                    }
                });
            };

            /* Expose a global builder for the picker */
            window._p22buildChecklistBlock = _buildChecklistBlock;
        }

        /* Add "Checklist" option to the block picker */
        function _patchPicker() {
            if (typeof window.p19_wbOpenPicker !== 'function' || window._p22pickerDone) {
                if (!window._p22pickerDone) setTimeout(_patchPicker, 400);
                return;
            }
            window._p22pickerDone = true;

            const origOpen = window.p19_wbOpenPicker;
            window.p19_wbOpenPicker = function() {
                origOpen();
                /* Inject checklist button after the picker opens */
                setTimeout(() => {
                    const types = document.querySelector('.p19-picker-block-types');
                    if (!types || types.querySelector('[data-p22cl]')) return;
                    const btn = document.createElement('button');
                    btn.className = 'p19-picker-type-btn';
                    btn.dataset.p22cl = '1';
                    btn.innerHTML = '<i class="fa-solid fa-list-check"></i>Checklist';
                    btn.addEventListener('click', () => {
                        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
                        /* Add block directly */
                        const ws = _migrate(_getData());
                        ws.blocks = ws.blocks || [];
                        ws.blocks.push({ id: _p22id(), type: 'checklist', items: [{ id: _p22id(), text: '', checked: false }] });
                        _saveData(ws);
                        if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
                    });
                    types.appendChild(btn);
                }, 60);
            };
        }

        _patchRender();
        _patchPicker();
    }

    _fixPdfBtnPosition();
    _injectChecklist();
}

/* ================================================================
   5.  FORMULA MODAL — hard-hide unit/category/description
       Watches the modal for any DOM changes and hides the selects
       every time they appear (patches16 recreates them on open).
   ================================================================ */
function _p22_formulaModalClean() {
    const HIDE_SELS = [
        '.p16-fv-ci',
        '.p16-fv-ui',
        'select[id*="unit"]',
        'select[id*="cat"]',
        '[id*="formula-modal-unit"]',
        '[id*="formula-modal-cat"]',
        '.formula-cat-wrap',
        '.formula-unit-wrap',
        'label[for*="formula-modal-unit"]',
        'label[for*="formula-modal-cat"]',
        '[id*="formula-modal-desc"]',
        '.formula-desc-wrap',
        'label[for*="formula-modal-desc"]',
        '[onclick*="p16_addVar"], [onclick*="addVar"]',
    ];

    function _clean(modal) {
        HIDE_SELS.forEach(sel => {
            try {
                modal.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important'));
            } catch {}
        });
        /* Compact variable row grid: sym + delete */
        modal.querySelectorAll('#p16-fv-rows .p16-fv-row').forEach(row => {
            row.style.gridTemplateColumns = '60px 26px';
            row.style.gap = '6px';
        });
    }

    function _watch() {
        const modal = document.getElementById('modal-formula');
        if (!modal) { setTimeout(_watch, 1000); return; }

        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) _clean(modal);
        }).observe(modal, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });

        _clean(modal);
    }
    _watch();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p22_init() {
    _p22_taskDnD();
    _p22_avatarPreview();
    _p22_attendancePastDates();
    _p22_worksheetImprovements();
    _p22_formulaModalClean();

    console.log('[patches22] loaded — task DnD bounding-rect fix, avatar preview, attendance past dates, worksheet checklist, PDF btn right, formula modal clean');
})();
