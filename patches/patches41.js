/* ================================================================
   StudentOS -- patches41.js
   FEATURE UPDATE requested by the 200+ user community.

   1.  ROUTINE — recurring options
       Routine blocks are one-time by default. Users can mark a block
       as recurring and choose which days it repeats on, plus a
       frequency (weekly / bi-weekly / monthly). Recurring blocks are
       rendered on every selected day. Data stored in os_routine.

   2.  WORKSHEET — multi-worksheet support
       Allows creating multiple worksheets (tabs, like whiteboards).
       Each worksheet is stored separately in os_worksheets (array).
       Active worksheet ID tracked in os_active_ws. Cloud-synced
       through the existing DB.set / DB.get layer.

   3.  WORKSHEET — layout / overlay fixes
       Duplicate buttons no longer overlap block content. Block
       margins and padding are consistent. Action strip repositioned.

   4.  MINDMAP — comprehensive fix
       Replaces the original wbMmRender with a version that:
       - Properly sizes SVG to the container
       - Fixes event propagation (click vs drag vs dblclick)
       - Prevents ghost clicks after drag
       - Preserves patches32/34 edit and context-menu features

   5.  PROFILE — emoji avatars restored alongside FA icons
       The emoji picker grid is preserved (user can still pick an
       emoji). The FA icon grid (from patches39) is shown below it
       in a separate section. The profile picture can be either.

   6.  MINDMAP STATUS BAR — emoji replaced with FA icon

   7.  QoL — focus improvements, consistent spacing
   ================================================================ */

'use strict';

/* -- helpers --------------------------------------------------- */
const _p41dbG = (k, d) => {
    try { return window.DB?.get ? window.DB.get(k, d) : (JSON.parse(localStorage.getItem(k) ?? 'null') ?? d); }
    catch { return d; }
};
const _p41dbS = (k, v) => {
    try { if (window.DB?.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); }
    catch {}
};
const _p41id    = () => Math.random().toString(36).slice(2, 10);
const _p41esc   = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p41toast = msg => {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
};

/* Reusable polling helper (max attempts, interval) */
function _p41waitFor(fn, maxAttempts, interval) {
    maxAttempts = maxAttempts || 60;
    interval = interval || 300;
    let n = 0;
    (function _try() {
        if (fn()) return;
        if (++n < maxAttempts) setTimeout(_try, interval);
    })();
}

/* Validate a colour is a safe CSS hex literal */
function _p41safeColor(c) {
    return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6';
}

/* ================================================================
   1.  ROUTINE — RECURRING OPTIONS
   ================================================================ */
(function _p41_routineRecurring() {

    const P41_DAYS = [
        { key: 'mon', label: 'Mo' }, { key: 'tue', label: 'Tu' },
        { key: 'wed', label: 'We' }, { key: 'thu', label: 'Th' },
        { key: 'fri', label: 'Fr' }, { key: 'sat', label: 'Sa' },
        { key: 'sun', label: 'Su' },
    ];

    /* A. Inject recurring options into the routine edit modal */
    _p41waitFor(function() {
        const modal = document.getElementById('modal-routine-edit');
        if (!modal) return false;
        if (document.getElementById('p41-recur-section')) return true;

        /* Find the color section to insert after it */
        const colorDiv = modal.querySelector('#p16-re-colors');
        if (!colorDiv) return false;
        const colorParent = colorDiv.closest('div.space-y-3') || colorDiv.parentElement?.parentElement;
        if (!colorParent) return false;

        const section = document.createElement('div');
        section.id = 'p41-recur-section';
        section.className = 'p41-recur-row';
        section.innerHTML = [
            '<label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Recurring</label>',
            '<label class="p41-recur-toggle">',
            '  <input type="checkbox" id="p41-re-recur">',
            '  <span class="text-xs" style="color:var(--text-main);">Repeat on multiple days</span>',
            '</label>',
            '<div class="p41-recur-opts" id="p41-recur-opts" style="display:none;">',
            P41_DAYS.map(d =>
                '<button type="button" class="p41-recur-day-btn" data-day="' + d.key + '">' + d.label + '</button>'
            ).join(''),
            '</div>',
            '<select id="p41-re-freq" class="p41-recur-freq" style="display:none;">',
            '  <option value="weekly">Every week</option>',
            '  <option value="biweekly">Every 2 weeks</option>',
            '  <option value="monthly">Monthly</option>',
            '</select>',
        ].join('');

        /* Insert after the color row */
        const colorRow = colorDiv.parentElement;
        if (colorRow && colorRow.nextSibling) {
            colorParent.insertBefore(section, colorRow.nextSibling);
        } else {
            colorParent.appendChild(section);
        }

        /* Toggle handler */
        const chk = document.getElementById('p41-re-recur');
        chk.addEventListener('change', function() {
            document.getElementById('p41-recur-opts').style.display = chk.checked ? 'flex' : 'none';
            document.getElementById('p41-re-freq').style.display = chk.checked ? '' : 'none';
        });

        /* Day button toggles */
        section.querySelectorAll('.p41-recur-day-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                btn.classList.toggle('active');
            });
        });

        return true;
    });

    /* B. Patch p16_openRoutineAdd to reset recurring fields */
    _p41waitFor(function() {
        if (typeof window.p16_openRoutineAdd !== 'function') return false;
        if (window._p41routineAddPatched) return true;
        window._p41routineAddPatched = true;

        const _origAdd = window.p16_openRoutineAdd;
        window.p16_openRoutineAdd = function(day) {
            _origAdd(day);
            /* Reset recurring fields */
            const chk = document.getElementById('p41-re-recur');
            if (chk) {
                chk.checked = false;
                chk.dispatchEvent(new Event('change'));
            }
            document.querySelectorAll('.p41-recur-day-btn').forEach(b => b.classList.remove('active'));
            /* Pre-select the chosen day if provided */
            if (day) {
                const btn = document.querySelector('.p41-recur-day-btn[data-day="' + day + '"]');
                if (btn) btn.classList.add('active');
            }
            const freq = document.getElementById('p41-re-freq');
            if (freq) freq.value = 'weekly';
        };

        return true;
    });

    /* C. Patch p16_openRoutineEdit to load recurring fields */
    _p41waitFor(function() {
        if (typeof window.p16_openRoutineEdit !== 'function') return false;
        if (window._p41routineEditPatched) return true;
        window._p41routineEditPatched = true;

        const _origEdit = window.p16_openRoutineEdit;
        window.p16_openRoutineEdit = function(id) {
            _origEdit(id);
            /* Load recurring data */
            const items = _p41dbG('os_routine', []);
            const item  = items.find(x => x.id === id);
            if (!item) return;

            const chk = document.getElementById('p41-re-recur');
            const isRecurring = item.recurring === true;
            if (chk) {
                chk.checked = isRecurring;
                chk.dispatchEvent(new Event('change'));
            }
            document.querySelectorAll('.p41-recur-day-btn').forEach(b => {
                b.classList.remove('active');
                if (isRecurring && Array.isArray(item.recurDays) && item.recurDays.includes(b.dataset.day)) {
                    b.classList.add('active');
                }
            });
            const freq = document.getElementById('p41-re-freq');
            if (freq) freq.value = item.recurFreq || 'weekly';
        };

        return true;
    });

    /* D. Patch p16_saveRoutine to save recurring data */
    _p41waitFor(function() {
        if (typeof window.p16_saveRoutine !== 'function') return false;
        if (window._p41routineSavePatched) return true;
        window._p41routineSavePatched = true;

        window.p16_saveRoutine = function() {
            const label    = (document.getElementById('p16-re-label')?.value || '').trim();
            const day      = document.getElementById('p16-re-day')?.value;
            const time     = document.getElementById('p16-re-time')?.value || '09:00';
            const duration = parseInt(document.getElementById('p16-re-dur')?.value || '60', 10);
            const color    = document.getElementById('p16-re-color')?.value || '#3b82f6';
            const errEl    = document.getElementById('p16-re-err');
            if (!label) { if (errEl) errEl.textContent = 'Activity name is required'; return; }
            if (errEl) errEl.textContent = '';

            /* Recurring */
            const isRecurring = document.getElementById('p41-re-recur')?.checked || false;
            const recurDays = [];
            if (isRecurring) {
                document.querySelectorAll('.p41-recur-day-btn.active').forEach(b => recurDays.push(b.dataset.day));
            }
            const recurFreq = document.getElementById('p41-re-freq')?.value || 'weekly';

            let items = _p41dbG('os_routine', []);
            const editId = document.getElementById('p16-re-id')?.value;

            const block = {
                label, day, time, duration, color: _p41safeColor(color),
                recurring: isRecurring,
                recurDays: recurDays,
                recurFreq: recurFreq,
            };

            if (editId) {
                items = items.map(x => x.id === editId ? { ...x, ...block } : x);
            } else {
                items.push({ id: _p41id(), ...block });
            }

            _p41dbS('os_routine', items);
            if (typeof closeModals === 'function') closeModals();
            if (typeof window.p16_renderRoutine === 'function') window.p16_renderRoutine();
        };

        return true;
    });

    /* E. Patch p16_renderRoutine to show recurring blocks on all their days */
    _p41waitFor(function() {
        if (typeof window.p16_renderRoutine !== 'function') return false;
        if (window._p41routineRenderPatched) return true;
        window._p41routineRenderPatched = true;

        window.p16_renderRoutine = function() {
            const items   = _p41dbG('os_routine', []);
            const dow     = new Date().getDay();
            const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow];
            const P16_DAYS = [
                { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' },
                { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' },
                { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
                { key: 'sun', label: 'Sun' },
            ];

            P16_DAYS.forEach(d => {
                const col = document.getElementById('p16-dblk-' + d.key);
                if (!col) return;
                const hdr = document.getElementById('p16-dhdr-' + d.key);
                if (hdr) hdr.classList.toggle('today', d.key === todayKey);

                /* Collect items for this day:
                   - Items with day === d.key (original behaviour)
                   - Recurring items that include d.key in recurDays */
                const dayItems = items.filter(x => {
                    if (x.day === d.key) return true;
                    if (x.recurring && Array.isArray(x.recurDays) && x.recurDays.includes(d.key)) return true;
                    return false;
                }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

                col.innerHTML = dayItems.map(item => {
                    const safeColor = _p41safeColor(item.color);
                    const safeTime  = _p41esc(item.time || '');
                    const safeDur   = parseInt(item.duration, 10) || 0;
                    const recurBadge = item.recurring
                        ? '<div class="p16-rb-recur"><i class="fa-solid fa-repeat"></i>' + _p41esc(item.recurFreq || 'weekly') + '</div>'
                        : '';
                    return '<div class="p16-routine-block" style="--bcolor:' + safeColor + '" onclick="p16_openRoutineEdit(\'' + _p41esc(item.id) + '\')">'
                        + '<div class="p16-rb-time"><i class="fa-regular fa-clock" style="margin-right:3px;font-size:.55rem;"></i>' + safeTime + '</div>'
                        + '<div class="p16-rb-label">' + _p41esc(item.label) + '</div>'
                        + '<div class="p16-rb-dur">' + safeDur + ' min</div>'
                        + recurBadge
                        + '</div>';
                }).join('');
            });
        };

        return true;
    });

})();


/* ================================================================
   2.  WORKSHEET — MULTI-WORKSHEET SUPPORT
       Follows the whiteboard multi-board pattern.
   ================================================================ */
(function _p41_multiWorksheet() {

    /* Storage keys */
    const WS_LIST_KEY  = 'os_ws_list';      /* Array of { id, name } */
    const WS_ACTIVE_KEY = 'os_ws_active';   /* Active worksheet id */

    function _getWsList() {
        return _p41dbG(WS_LIST_KEY, [{ id: 'default', name: 'Worksheet 1' }]);
    }
    function _getActiveId() {
        const list = _getWsList();
        const saved = _p41dbG(WS_ACTIVE_KEY, 'default');
        /* Make sure active ID exists in list */
        if (list.find(w => w.id === saved)) return saved;
        return list[0]?.id || 'default';
    }
    function _wsDataKey(id) {
        return id === 'default' ? 'os_worksheet' : 'os_worksheet_' + id;
    }
    function _wsTitleKey(id) {
        return id === 'default' ? 'os_worksheet_title' : 'os_worksheet_title_' + id;
    }

    /* Migrate: if user has data in os_worksheet but no ws_list, create list with default entry */
    function _ensureMigrated() {
        const list = _p41dbG(WS_LIST_KEY, null);
        if (list) return;
        /* First run: create the list with a default entry */
        _p41dbS(WS_LIST_KEY, [{ id: 'default', name: 'Worksheet 1' }]);
        _p41dbS(WS_ACTIVE_KEY, 'default');
    }

    /* A. Inject tabs bar into the worksheet view */
    _p41waitFor(function() {
        const view = document.getElementById('view-worksheet');
        if (!view) return false;
        if (document.getElementById('p41-ws-tabs')) return true;

        _ensureMigrated();

        /* Find the header row (first child) */
        const hdr = view.querySelector('.flex.items-center.justify-between');
        if (!hdr) return false;

        const tabsBar = document.createElement('div');
        tabsBar.id = 'p41-ws-tabs';
        tabsBar.className = 'p41-ws-tabs-bar';

        /* Insert after the header */
        if (hdr.nextSibling) {
            hdr.parentElement.insertBefore(tabsBar, hdr.nextSibling);
        } else {
            view.insertBefore(tabsBar, view.children[1] || null);
        }

        /* Cloud indicator */
        const cloudBadge = document.createElement('span');
        cloudBadge.id = 'p41-ws-cloud';
        cloudBadge.className = 'p41-ws-cloud-badge';
        cloudBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> Synced';
        hdr.querySelector('.flex.gap-2')?.appendChild(cloudBadge);

        return true;
    });

    /* B. Render worksheet tabs */
    window._p41wsRenderTabs = function() {
        const bar = document.getElementById('p41-ws-tabs');
        if (!bar) return;
        const list = _getWsList();
        const activeId = _getActiveId();

        bar.innerHTML = '';
        list.forEach(ws => {
            const btn = document.createElement('button');
            btn.className = 'p41-ws-tab' + (ws.id === activeId ? ' active' : '');
            btn.textContent = ws.name;
            btn.title = ws.name;
            btn.addEventListener('click', () => _p41wsSwitchTo(ws.id));
            /* Double click to rename */
            btn.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                _p41wsRename(ws.id);
            });
            /* Right click context menu for delete */
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (list.length > 1) {
                    _p41wsDelete(ws.id);
                }
            });
            bar.appendChild(btn);
        });

        /* Add button */
        const addBtn = document.createElement('button');
        addBtn.className = 'p41-ws-tab-add';
        addBtn.title = 'New worksheet';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addBtn.addEventListener('click', _p41wsNew);
        bar.appendChild(addBtn);

        /* Update cloud badge */
        const cloud = document.getElementById('p41-ws-cloud');
        if (cloud) {
            if (window.DB?.set) {
                cloud.className = 'p41-ws-cloud-badge synced';
                cloud.innerHTML = '<i class="fa-solid fa-cloud"></i> Synced';
            } else {
                cloud.className = 'p41-ws-cloud-badge';
                cloud.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Local';
            }
        }
    };

    /* C. Switch worksheet */
    function _p41wsSwitchTo(id) {
        const activeId = _getActiveId();
        if (id === activeId) return;
        _p41dbS(WS_ACTIVE_KEY, id);

        /* Point the existing worksheet data key to the new sheet */
        _p41wsReloadActive();
        _p41wsRenderTabs();
    }

    /* Reload active worksheet data into the view */
    function _p41wsReloadActive() {
        const id = _getActiveId();
        const dataKey = _wsDataKey(id);
        const data = _p41dbG(dataKey, { blocks: [], savedValues: {} });

        /* Write into the canonical os_worksheet key so all existing
           patches (p16, p19, p30) read from it seamlessly */
        _p41dbS('os_worksheet', data);

        /* Also update the title */
        const titleKey = _wsTitleKey(id);
        const title = _p41dbG(titleKey, '');
        _p41dbS('os_worksheet_title', title);

        /* Re-render */
        if (typeof window.p19_wbRender === 'function') {
            window.p19_wbRender();
        } else if (typeof window.p16_wsRender === 'function') {
            window.p16_wsRender();
            if (typeof window.p16_wsRenderLibrary === 'function') window.p16_wsRenderLibrary();
        }
    }

    /* D. Save active worksheet data back to its key */
    window._p41wsSaveActive = function() {
        const id = _getActiveId();
        const dataKey = _wsDataKey(id);
        const data = _p41dbG('os_worksheet', { blocks: [], savedValues: {} });
        _p41dbS(dataKey, data);

        const titleKey = _wsTitleKey(id);
        const title = _p41dbG('os_worksheet_title', '');
        _p41dbS(titleKey, title);
    };

    /* E. Auto-save: wrap DB.set for os_worksheet to also persist to the active sheet key */
    _p41waitFor(function() {
        if (!window.DB?.set) return false;
        if (window._p41wsAutoSave) return true;
        window._p41wsAutoSave = true;

        const _origSet = window.DB.set.bind(window.DB);
        window.DB.set = function(key, val) {
            _origSet(key, val);
            /* Mirror canonical worksheet data to the active sheet */
            if (key === 'os_worksheet') {
                const id = _getActiveId();
                if (id !== 'default') {
                    _origSet(_wsDataKey(id), val);
                }
            }
            if (key === 'os_worksheet_title') {
                const id = _getActiveId();
                if (id !== 'default') {
                    _origSet(_wsTitleKey(id), val);
                }
            }
        };
        return true;
    });

    /* F. New worksheet */
    function _p41wsNew() {
        const list = _getWsList();
        const newId = _p41id();
        const name = 'Worksheet ' + (list.length + 1);
        list.push({ id: newId, name: name });
        _p41dbS(WS_LIST_KEY, list);

        /* Save current worksheet first */
        window._p41wsSaveActive?.();

        /* Switch to new empty worksheet */
        _p41dbS(WS_ACTIVE_KEY, newId);
        _p41dbS('os_worksheet', { blocks: [], savedValues: {} });
        _p41dbS('os_worksheet_title', '');

        _p41wsReloadActive();
        _p41wsRenderTabs();
        _p41toast('New worksheet created');
    }

    /* G. Rename worksheet */
    function _p41wsRename(id) {
        const list = _getWsList();
        const ws = list.find(w => w.id === id);
        if (!ws) return;
        const newName = prompt('Rename worksheet:', ws.name);
        if (!newName || !newName.trim()) return;
        ws.name = newName.trim();
        _p41dbS(WS_LIST_KEY, list);
        _p41wsRenderTabs();
    }

    /* H. Delete worksheet */
    function _p41wsDelete(id) {
        const list = _getWsList();
        if (list.length <= 1) { _p41toast('Cannot delete the last worksheet'); return; }
        if (!confirm('Delete this worksheet?')) return;

        const newList = list.filter(w => w.id !== id);
        _p41dbS(WS_LIST_KEY, newList);

        /* If deleting active, switch to first */
        if (_getActiveId() === id) {
            _p41dbS(WS_ACTIVE_KEY, newList[0].id);
            _p41wsReloadActive();
        }

        _p41wsRenderTabs();
        _p41toast('Worksheet deleted');
    }

    /* I. Hook into switchTab to render tabs when worksheet opens */
    _p41waitFor(function() {
        if (typeof window.switchTab !== 'function') return false;
        if (window._p41wsTabHooked) return true;
        window._p41wsTabHooked = true;

        const _origSwitch = window.switchTab;
        window.switchTab = function(name) {
            _origSwitch.apply(this, arguments);
            if (name === 'worksheet') {
                _p41wsRenderTabs();
            }
        };
        return true;
    });

})();


/* ================================================================
   3.  WORKSHEET — DUPLICATE BUTTON OVERLAY FIX
       Ensure action buttons (drag, duplicate, delete) are properly
       positioned and don't cover block content.
   ================================================================ */
(function _p41_wsOverlayFix() {

    /* Patches33.css already adds padding-right fixes, but some blocks
       still get overlapped because the padding is applied with
       !important and some block types override it. This fix ensures
       all blocks have the correct structure. */

    _p41waitFor(function() {
        const board = document.getElementById('p19-ws-board');
        if (!board) return false;
        if (window._p41overlayFixed) return true;
        window._p41overlayFixed = true;

        /* Observer to fix action button positioning on new blocks */
        function _fixBlock(blockEl) {
            if (blockEl.dataset.p41fixed) return;
            blockEl.dataset.p41fixed = '1';

            const actions = blockEl.querySelector('.p19-ws-block-actions');
            if (actions) {
                /* Ensure proper stacking */
                actions.style.zIndex = '5';
                actions.style.pointerEvents = 'auto';
            }

            /* Ensure the block has position:relative for absolute actions */
            if (getComputedStyle(blockEl).position === 'static') {
                blockEl.style.position = 'relative';
            }
        }

        /* Initial pass */
        board.querySelectorAll('.p19-ws-block[data-bid]').forEach(_fixBlock);

        /* Watch for future blocks */
        new MutationObserver(() => {
            board.querySelectorAll('.p19-ws-block[data-bid]:not([data-p41fixed])').forEach(_fixBlock);
        }).observe(board, { childList: true, subtree: true });

        return true;
    }, 80, 400);
})();


/* ================================================================
   4.  MINDMAP — COMPREHENSIVE FIX
       The mindmap has multiple overlapping render functions from
       script.js, patches32, and patches34. This causes:
       - Double event listeners (click fires after drag)
       - SVG not sized correctly
       - Nodes unresponsive after certain interactions
       
       Fix: Replace wbMmRender with a clean version that handles all
       features from patches32 (edit modal, context menu) and
       patches34 (drag/click discrimination).
   ================================================================ */
(function _p41_mindmapFix() {

    _p41waitFor(function() {
        if (typeof window.wbMmRender !== 'function') return false;
        if (typeof window.wbMmSave !== 'function') return false;
        if (window._p41mmFixed) return true;
        window._p41mmFixed = true;

        /* Store reference to save/addnode/deletenode */
        const _mmSave = window.wbMmSave;
        const _mmAddNode = typeof window.wbMmAddNode === 'function' ? window.wbMmAddNode : null;

        window.wbMmRender = function() {
            var svg = document.getElementById('wb-mindmap-svg');
            if (!svg) return;

            /* Clear all existing content and event listeners */
            svg.innerHTML = '';

            /* Size SVG to container */
            var con = document.getElementById('wb-container');
            if (con && con.clientWidth > 0 && con.clientHeight > 0) {
                svg.setAttribute('width', con.clientWidth);
                svg.setAttribute('height', con.clientHeight);
            }

            var nodes = window.wbMindMapNodes || [];
            var edges = window.wbMindMapEdges || [];
            var selectedId = window.wbMindMapSelected;

            /* Draw edges */
            edges.forEach(function(edge) {
                var from = nodes.find(function(n) { return n.id === edge.from; });
                var to   = nodes.find(function(n) { return n.id === edge.to; });
                if (!from || !to) return;

                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', from.x);
                line.setAttribute('y1', from.y);
                line.setAttribute('x2', to.x);
                line.setAttribute('y2', to.y);
                line.setAttribute('stroke', 'rgba(255,255,255,0.3)');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            });

            /* Draw nodes */
            nodes.forEach(function(node) {
                var isSelected = (node.id === selectedId);
                var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');
                g.style.cursor = 'pointer';

                /* Calculate width based on text length */
                var w = Math.max(80, (node.text || '').length * 8 + 24);
                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', -(w / 2));
                rect.setAttribute('y', '-18');
                rect.setAttribute('width', w);
                rect.setAttribute('height', '36');
                rect.setAttribute('rx', '10');
                rect.setAttribute('fill', node.color || '#3b82f6');
                rect.setAttribute('stroke', isSelected ? '#fff' : 'none');
                rect.setAttribute('stroke-width', isSelected ? '2' : '0');

                var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('fill', '#fff');
                text.setAttribute('font-size', '13');
                text.setAttribute('font-family', 'Inter, sans-serif');
                text.textContent = node.text || '';

                g.appendChild(rect);
                g.appendChild(text);

                /* Event handling — clean implementation that prevents
                   click from firing after drag */
                (function(n) {
                    var _isDragging = false;
                    var _didMove = false;
                    var _dsx = 0, _dsy = 0, _nsx = 0, _nsy = 0;
                    var DRAG_THRESHOLD = 4;

                    g.addEventListener('pointerdown', function(e) {
                        e.stopPropagation();
                        _isDragging = true;
                        _didMove = false;
                        _dsx = e.clientX;
                        _dsy = e.clientY;
                        _nsx = n.x;
                        _nsy = n.y;
                        g.setPointerCapture(e.pointerId);
                    });

                    g.addEventListener('pointermove', function(e) {
                        if (!_isDragging) return;
                        var dx = e.clientX - _dsx;
                        var dy = e.clientY - _dsy;
                        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
                            _didMove = true;
                        }
                        n.x = _nsx + dx;
                        n.y = _nsy + dy;
                        /* Update transform directly instead of full re-render */
                        g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
                        /* Update connected edges */
                        _updateEdges(svg, nodes, edges);
                    });

                    g.addEventListener('pointerup', function() {
                        if (_isDragging) {
                            _isDragging = false;
                            if (_didMove) {
                                _mmSave();
                            }
                        }
                    });

                    g.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (_didMove) {
                            _didMove = false;
                            return;
                        }
                        window.wbMindMapSelected = (window.wbMindMapSelected === n.id) ? null : n.id;
                        window.wbMmRender();
                    });

                    g.addEventListener('dblclick', function(e) {
                        e.stopPropagation();
                        if (typeof window._p32openEditNode === 'function') {
                            window._p32openEditNode(n.id);
                        }
                    });

                    g.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window._p32showMmCtx === 'function') {
                            window._p32showMmCtx(n.id, e.clientX, e.clientY);
                        }
                    });
                })(node);

                svg.appendChild(g);
            });

            /* Click on empty SVG area to add node */
            svg.onclick = function(e) {
                if (e.target === svg) {
                    var r = svg.getBoundingClientRect();
                    var clickX = e.clientX - r.left;
                    var clickY = e.clientY - r.top;
                    if (_mmAddNode) {
                        _mmAddNode(clickX, clickY);
                    }
                }
            };
        };

        /* Helper: update edge positions without full re-render */
        function _updateEdges(svg, nodes, edges) {
            var lines = svg.querySelectorAll('line');
            var lineIdx = 0;
            edges.forEach(function(edge) {
                var from = nodes.find(function(n) { return n.id === edge.from; });
                var to   = nodes.find(function(n) { return n.id === edge.to; });
                if (!from || !to) return;
                if (lineIdx < lines.length) {
                    lines[lineIdx].setAttribute('x1', from.x);
                    lines[lineIdx].setAttribute('y1', from.y);
                    lines[lineIdx].setAttribute('x2', to.x);
                    lines[lineIdx].setAttribute('y2', to.y);
                }
                lineIdx++;
            });
        }

        console.log('[patches41] mindmap render replaced with clean version');
        return true;
    });

    /* Fix the mindmap status bar — replace emoji with FA icon */
    _p41waitFor(function() {
        var status = document.getElementById('mm-status');
        if (!status) return false;
        var span = status.querySelector('span');
        if (!span) return false;
        if (status.dataset.p41fixed) return true;
        status.dataset.p41fixed = '1';

        span.innerHTML = '<i class="fa-solid fa-diagram-project" style="margin-right:5px;"></i>'
            + '<strong>Mind Map Mode</strong>'
            + ' &mdash; Click empty area to add node &middot; Click to select &middot; Drag to move'
            + ' &middot; Double-click to edit &middot; Right-click for options';

        return true;
    });

})();


/* ================================================================
   5.  PROFILE — EMOJI AVATARS RESTORED ALONGSIDE FA ICONS
       patches39 replaces the emoji grid with FA icons. This patch
       restores the emoji grid above the FA grid, so users can pick
       either an emoji or an FA icon as their avatar.
   ================================================================ */
(function _p41_profileEmoji() {

    _p41waitFor(function() {
        /* Wait for the patches39 FA grid to be injected */
        var grid = document.querySelector('.p10-emoji-grid');
        if (!grid) return false;
        if (!grid.dataset.p39replaced) return false;
        if (grid.dataset.p41restored) return true;
        grid.dataset.p41restored = '1';

        /* The original emoji grid was replaced by patches39.
           We'll create a wrapper that has both sections. */
        var parent = grid.parentElement;
        if (!parent) return true;

        /* Build the emoji section */
        var wrapper = document.createElement('div');
        wrapper.className = 'p41-avatar-section';

        /* Emoji section */
        var emojiLabel = document.createElement('div');
        emojiLabel.className = 'p41-avatar-section-label';
        emojiLabel.textContent = 'Emoji';
        wrapper.appendChild(emojiLabel);

        var emojiGrid = document.createElement('div');
        emojiGrid.className = 'p41-emoji-grid';

        var EMOJIS = [
            '\uD83C\uDF93', '\uD83D\uDCDA', '\uD83E\uDDD1\u200D\uD83D\uDCBB', '\u270F\uFE0F',
            '\uD83E\uDD8A', '\uD83D\uDC31', '\uD83D\uDC3C', '\uD83E\uDD81',
            '\uD83C\uDF1F', '\uD83D\uDE80', '\uD83C\uDFAF', '\uD83D\uDCA1',
            '\uD83C\uDFAE', '\uD83D\uDD25', '\u26A1', '\uD83E\uDDE0',
            '\uD83C\uDFB8', '\uD83C\uDF08', '\uD83E\uDD8B', '\uD83C\uDF3A',
            '\uD83D\uDC09', '\uD83E\uDD84', '\uD83C\uDFC6', '\uD83C\uDFA8',
            '\uD83E\uDDE9', '\uD83C\uDFAD', '\uD83C\uDF19', '\u2600\uFE0F',
            '\uD83C\uDF40', '\uD83E\uDD85', '\uD83D\uDC2C', '\uD83C\uDF35',
        ];

        emojiGrid.innerHTML = EMOJIS.map(function(em) {
            return '<div class="emoji-opt" onclick="setProfileEmoji(\'' + em + '\')">' + em + '</div>';
        }).join('');

        wrapper.appendChild(emojiGrid);

        /* FA icon section */
        var faLabel = document.createElement('div');
        faLabel.className = 'p41-avatar-section-label';
        faLabel.style.marginTop = '8px';
        faLabel.textContent = 'Icons';
        wrapper.appendChild(faLabel);

        /* Move the existing FA grid into wrapper */
        wrapper.appendChild(grid.cloneNode(true));

        /* Copy onclick handlers from cloned grid buttons */
        var clonedGrid = wrapper.querySelector('.p10-emoji-grid');
        if (clonedGrid) {
            clonedGrid.querySelectorAll('.p39-fa-avatar-opt').forEach(function(btn) {
                var icon = btn.querySelector('i');
                if (icon) {
                    var classes = icon.className.replace(/\s*text-.*$/,'').trim();
                    btn.onclick = function() {
                        if (typeof window._p39setFaAvatar === 'function') {
                            window._p39setFaAvatar(classes);
                        }
                    };
                }
            });
        }

        /* Replace the original grid with our wrapper */
        parent.replaceChild(wrapper, grid);

        return true;
    }, 80, 500);

})();


/* ================================================================
   6.  QOL — VARIOUS IMPROVEMENTS
   ================================================================ */
(function _p41_qol() {

    /* A. Ensure Enter key works in routine modal to save */
    _p41waitFor(function() {
        var labelInput = document.getElementById('p16-re-label');
        if (!labelInput) return false;
        if (labelInput.dataset.p41enter) return true;
        labelInput.dataset.p41enter = '1';

        labelInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof window.p16_saveRoutine === 'function') window.p16_saveRoutine();
            }
        });
        return true;
    });

    /* B. Ensure mindmap modal Enter key works */
    _p41waitFor(function() {
        var mmInput = document.getElementById('mm-node-text-input');
        if (!mmInput) return false;
        if (mmInput.dataset.p41enter) return true;
        mmInput.dataset.p41enter = '1';

        mmInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof window.confirmMmNode === 'function') window.confirmMmNode();
            }
        });
        return true;
    });

    /* C. Worksheet — Ensure the toolbar buttons have consistent spacing */
    _p41waitFor(function() {
        var view = document.getElementById('view-worksheet');
        if (!view) return false;
        var toolbar = view.querySelector('.p16-ws-tb-btn, .flex.gap-2');
        if (!toolbar) return false;
        if (view.dataset.p41tbFixed) return true;
        view.dataset.p41tbFixed = '1';

        /* Ensure the toolbar row doesn't overflow on narrow screens */
        var hdr = view.querySelector('.flex.items-center.justify-between');
        if (hdr) {
            hdr.style.flexWrap = 'wrap';
            hdr.style.gap = '8px';
        }
        return true;
    });

})();


/* ================================================================
   INIT
   ================================================================ */
console.log('[patches41] loaded — routine recurring, multi-worksheet, mindmap fix, profile emoji restore, QoL');
