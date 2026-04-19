/* ================================================================
   StudentOS — patches29.js
   1.  Formula modal  — inline "Create / Edit formula" form in the
                        "My formulas" tab of the p28 formula browser.
                        Users can add and edit custom formulas without
                        leaving the worksheet.
   2.  Formula block  — full UX overhaul:
                        • Solve-for chip strip replaces opaque rings
                        • Improved labelled variable grid
                        • Auto-compute when all inputs are filled
                        • Enter key in any var input triggers compute
                        • @ref dropdown for saved-value references
                        • Inline error banner instead of toast only
                        • Improved result panel with copy button
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p29lsG   = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p29lsS   = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p29dbG   = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p29lsG(k, d); } catch { return d; } };
const _p29dbS   = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p29lsS(k, v); } catch {} };
const _p29id    = () => Math.random().toString(36).slice(2, 10);
const _p29toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const _p29esc   = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ── shared variable extractor (same skip list as p28) ─────────── */
const _P29_SKIP = new Set([
    'sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh',
    'sqrt','cbrt','abs','log','log2','log10','exp','pow','ceil','floor',
    'round','sign','min','max','hypot','pi','e','inf','infinity','nan',
    'true','false','if','else','and','or','not',
]);
function _p29ExtractVars(expr) {
    const tokens = (expr || '').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const seen   = new Set();
    return tokens.filter(t => {
        if (_P29_SKIP.has(t.toLowerCase())) return false;
        if (seen.has(t)) return false;
        seen.add(t);
        return true;
    });
}

/* ── worksheet data ─────────────────────────────────────────── */
function _p29GetWs()    { return _p29dbG('os_worksheet', { blocks: [], savedValues: {} }); }
function _p29SaveWs(ws) { _p29dbS('os_worksheet', ws); }
function _p29MigrateWs(ws) {
    if (Array.isArray(ws.blocks)) return ws;
    return { blocks: (ws.steps || []).map(s => ({ id: s.id || _p29id(), type: 'text', content: s.content || '' })), savedValues: ws.savedValues || {} };
}

/* ================================================================
   1.  FORMULA MODAL — CREATE / EDIT FORMULA INLINE
   ================================================================ */
function _p29_formulaModalEnhance() {

    /* Wait for p28's formula modal to be set up */
    let _p29_enhanceRetries = 0;
    if (!window.p28_openFormulaModal) {
        (function _retry() {
            if (window.p28_openFormulaModal) { _p29_formulaModalEnhance(); return; }
            if (++_p29_enhanceRetries > 30) return; /* ~9 seconds max */
            setTimeout(_retry, 300);
        })();
        return;
    }

    /* Patch p28_openFormulaModal to inject our enhancements after the modal opens */
    const _origOpen = window.p28_openFormulaModal;
    window.p28_openFormulaModal = function() {
        _origOpen.apply(this, arguments);
        /* Allow the modal to be created/rendered first */
        setTimeout(_p29_injectCreateForm, 60);
    };

    /* Also patch on first call immediately */
    _p29_injectCreateForm();
}

function _p29_getFormulaSubjects() {
    const formulas  = _p29dbG('os_formulas', []);
    const subjects  = _p29dbG('os_subjects', []);
    const names = new Set([
        ...subjects.map(s => s.name),
        ...formulas.map(f => f.subject).filter(Boolean),
    ]);
    return [...names].sort();
}

function _p29_injectCreateForm() {
    const modal = document.getElementById('p28-formula-modal');
    if (!modal) return;

    /* Only inject once per modal lifetime */
    if (modal.dataset.p29enhanced) return;
    modal.dataset.p29enhanced = '1';

    const box = modal.querySelector('.p28-modal-box');
    if (!box) return;

    /* We need to intercept tab switching to show/hide our toolbar & form */
    const tabs = box.querySelector('#p28-modal-tabs');
    if (!tabs) return;

    /* ── Toolbar (shows only on "mine" tab) ── */
    const toolbar = document.createElement('div');
    toolbar.id        = 'p29-mine-toolbar';
    toolbar.className = 'hidden';

    const createBtn = document.createElement('button');
    createBtn.id        = 'p29-create-formula-btn';
    createBtn.type      = 'button';
    createBtn.innerHTML = '<i class="fa-solid fa-plus"></i> New formula';
    createBtn.addEventListener('click', () => _p29_showCreateForm(box, false));
    toolbar.appendChild(createBtn);

    /* ── Create form (hidden by default) ── */
    const createForm = document.createElement('div');
    createForm.id        = 'p29-create-formula-form';
    createForm.className = 'hidden';
    createForm.innerHTML = _p29_formHTML('create');

    /* ── Edit form (hidden by default) ── */
    const editForm = document.createElement('div');
    editForm.id        = 'p29-edit-formula-form';
    editForm.className = 'hidden';
    editForm.innerHTML = _p29_formHTML('edit');

    /* Insert toolbar + forms after the controls bar (before the grid) */
    const grid = box.querySelector('#p28-formula-grid');
    box.insertBefore(editForm, grid);
    box.insertBefore(createForm, grid);
    box.insertBefore(toolbar, grid);

    /* Wire up create form */
    _p29_wireForm(createForm, 'create', box);
    /* Wire up edit form */
    _p29_wireForm(editForm, 'edit', box);

    /* Patch tab switching to show/hide toolbar and reset forms */
    tabs.addEventListener('click', e => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        const isMinTab = btn.dataset.tab === 'mine';
        toolbar.classList.toggle('hidden', !isMinTab);
        if (!isMinTab) {
            createForm.classList.add('hidden');
            editForm.classList.add('hidden');
        }
    });

    /* Attach edit buttons via delegation on the grid */
    const gridEl = box.querySelector('#p28-formula-grid');
    if (gridEl) {
        gridEl.addEventListener('click', e => {
            const editBtn = e.target.closest('[data-p29edit]');
            if (!editBtn) return;
            e.stopPropagation();
            const id = editBtn.dataset.p29edit;
            _p29_showEditForm(box, id);
        });
        gridEl.addEventListener('click', e => {
            const delBtn = e.target.closest('[data-p29delete]');
            if (!delBtn) return;
            e.stopPropagation();
            const id = delBtn.dataset.p29delete;
            _p29_deleteFormula(id, box);
        });
    }

    /* Inject edit/delete buttons into existing user formula cards via MutationObserver */
    const cardObs = new MutationObserver(() => {
        _p29_patchMineCards(box);
    });
    if (gridEl) cardObs.observe(gridEl, { childList: true });
}

function _p29_formHTML(mode) {
    const label = mode === 'create' ? 'New Formula' : 'Edit Formula';
    const icon  = mode === 'create' ? 'fa-plus-circle' : 'fa-pencil';
    const prefix = 'p29-' + mode;
    return `
        <div class="p29-cf-form-title"><i class="fa-solid ${icon}"></i>${label}</div>
        <div class="p29-cf-row">
            <div class="p29-cf-field">
                <div class="p29-cf-label">Title</div>
                <input type="text" id="${prefix}-title" class="p29-cf-input" placeholder="e.g. Quadratic Formula" autocomplete="off">
            </div>
            <div class="p29-cf-field" style="flex:.7">
                <div class="p29-cf-label">Subject</div>
                <input type="text" id="${prefix}-subject" class="p29-cf-input" placeholder="e.g. Algebra" list="${prefix}-subject-list" autocomplete="off">
                <datalist id="${prefix}-subject-list"></datalist>
            </div>
        </div>
        <div class="p29-cf-row">
            <div class="p29-cf-field">
                <div class="p29-cf-label">Formula expression</div>
                <input type="text" id="${prefix}-formula" class="p29-cf-input mono" placeholder="e.g. x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)" autocomplete="off">
                <div class="p29-cf-vars-preview" id="${prefix}-vars-preview">
                    <span class="p29-cf-vars-label">Detected variables will appear here</span>
                </div>
            </div>
        </div>
        <div class="p29-cf-row">
            <div class="p29-cf-field">
                <div class="p29-cf-label">Notes <span style="opacity:.5;font-weight:400;text-transform:none">(optional)</span></div>
                <textarea id="${prefix}-note" class="p29-cf-textarea" placeholder="When to use, examples, tips…"></textarea>
            </div>
        </div>
        <div class="p29-cf-err" id="${prefix}-err"></div>
        <div class="p29-cf-actions">
            <button type="button" id="${prefix}-save-btn" class="p29-cf-save-btn"><i class="fa-solid fa-check"></i> ${mode === 'create' ? 'Add formula' : 'Save changes'}</button>
            <button type="button" id="${prefix}-cancel-btn" class="p29-cf-cancel-btn">Cancel</button>
        </div>`;
}

function _p29_wireForm(formEl, mode, box) {
    const prefix = 'p29-' + mode;

    const titleInp   = formEl.querySelector('#' + prefix + '-title');
    const subjInp    = formEl.querySelector('#' + prefix + '-subject');
    const formulaInp = formEl.querySelector('#' + prefix + '-formula');
    const noteInp    = formEl.querySelector('#' + prefix + '-note');
    const errEl      = formEl.querySelector('#' + prefix + '-err');
    const saveBtn    = formEl.querySelector('#' + prefix + '-save-btn');
    const cancelBtn  = formEl.querySelector('#' + prefix + '-cancel-btn');
    const varsPrev   = formEl.querySelector('#' + prefix + '-vars-preview');
    const subjList   = formEl.querySelector('#' + prefix + '-subject-list');

    if (!titleInp || !formulaInp || !saveBtn || !cancelBtn) return;

    /* Populate subject datalist */
    function _refreshSubjectList() {
        if (!subjList) return;
        subjList.innerHTML = '';
        _p29_getFormulaSubjects().forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            subjList.appendChild(opt);
        });
    }

    /* Update vars preview as user types the formula */
    function _updateVarsPreview() {
        if (!varsPrev) return;
        const vars = _p29ExtractVars(formulaInp.value);
        varsPrev.innerHTML = '';
        if (!vars.length) {
            varsPrev.innerHTML = '<span class="p29-cf-vars-label">Detected variables will appear here</span>';
            return;
        }
        const lbl = document.createElement('span');
        lbl.className   = 'p29-cf-vars-label';
        lbl.textContent = 'Variables:';
        varsPrev.appendChild(lbl);
        vars.forEach(v => {
            const chip = document.createElement('span');
            chip.className   = 'p29-cf-var-chip';
            chip.textContent = v;
            varsPrev.appendChild(chip);
        });
    }

    formulaInp.addEventListener('input', _updateVarsPreview);

    /* Save */
    saveBtn.addEventListener('click', () => {
        errEl.textContent = '';
        const title   = titleInp.value.trim();
        const formula = formulaInp.value.trim();
        const subject = subjInp ? subjInp.value.trim() : '';
        const note    = noteInp ? noteInp.value.trim() : '';

        if (!title)   { errEl.textContent = 'Title is required.';   titleInp.focus();   return; }
        if (!formula) { errEl.textContent = 'Formula is required.'; formulaInp.focus(); return; }

        let items = _p29dbG('os_formulas', []);
        if (mode === 'edit') {
            const id = formEl.dataset.editId;
            items = items.map(f => f.id === id ? { ...f, title, formula, subject, note } : f);
        } else {
            items.push({ id: _p29id(), title, formula, subject, note, createdAt: Date.now() });
        }
        _p29dbS('os_formulas', items);

        /* Reset form and close */
        formEl.classList.add('hidden');
        formEl.dataset.editId = '';

        /* Refresh the formula grid (switch to mine tab) */
        _p29_refreshMineGrid(box);
        _p29toast(mode === 'edit' ? 'Formula updated.' : 'Formula added.');

        /* Refresh Features tab as well */
        if (typeof window.initFormulas === 'function') window.initFormulas();
    });

    /* Cancel */
    cancelBtn.addEventListener('click', () => {
        formEl.classList.add('hidden');
        errEl.textContent = '';
    });

    /* Expose refresh for callers */
    formEl._refreshSubjectList = _refreshSubjectList;
}

function _p29_showCreateForm(box, focus) {
    const createForm = box.querySelector('#p29-create-formula-form');
    const editForm   = box.querySelector('#p29-edit-formula-form');
    if (!createForm) return;

    editForm?.classList.add('hidden');
    createForm.classList.remove('hidden');

    /* Clear previous values */
    ['p29-create-title','p29-create-subject','p29-create-formula','p29-create-note'].forEach(id => {
        const el = createForm.querySelector('#' + id);
        if (el) el.value = '';
    });
    const errEl = createForm.querySelector('#p29-create-err');
    if (errEl) errEl.textContent = '';

    /* Refresh vars preview */
    const varsPrev = createForm.querySelector('#p29-create-vars-preview');
    if (varsPrev) varsPrev.innerHTML = '<span class="p29-cf-vars-label">Detected variables will appear here</span>';

    /* Refresh subject list */
    if (createForm._refreshSubjectList) createForm._refreshSubjectList();

    /* Focus title */
    const titleInp = createForm.querySelector('#p29-create-title');
    setTimeout(() => titleInp?.focus(), 60);
}

function _p29_showEditForm(box, id) {
    const editForm   = box.querySelector('#p29-edit-formula-form');
    const createForm = box.querySelector('#p29-create-formula-form');
    if (!editForm) return;

    const items  = _p29dbG('os_formulas', []);
    const item   = items.find(f => f.id === id);
    if (!item) return;

    createForm?.classList.add('hidden');
    editForm.classList.remove('hidden');
    editForm.dataset.editId = id;

    const titleInp   = editForm.querySelector('#p29-edit-title');
    const subjInp    = editForm.querySelector('#p29-edit-subject');
    const formulaInp = editForm.querySelector('#p29-edit-formula');
    const noteInp    = editForm.querySelector('#p29-edit-note');
    const errEl      = editForm.querySelector('#p29-edit-err');

    if (titleInp)   titleInp.value   = item.title   || '';
    if (subjInp)    subjInp.value    = item.subject  || '';
    if (formulaInp) formulaInp.value = item.formula  || '';
    if (noteInp)    noteInp.value    = item.note     || '';
    if (errEl)      errEl.textContent = '';

    /* Refresh vars preview */
    const varsPrev = editForm.querySelector('#p29-edit-vars-preview');
    if (varsPrev && formulaInp) {
        const vars = _p29ExtractVars(formulaInp.value);
        varsPrev.innerHTML = '';
        if (vars.length) {
            const lbl = document.createElement('span');
            lbl.className = 'p29-cf-vars-label';
            lbl.textContent = 'Variables:';
            varsPrev.appendChild(lbl);
            vars.forEach(v => {
                const chip = document.createElement('span');
                chip.className = 'p29-cf-var-chip';
                chip.textContent = v;
                varsPrev.appendChild(chip);
            });
        }
    }

    /* Refresh subject list */
    if (editForm._refreshSubjectList) editForm._refreshSubjectList();

    const titleEl = editForm.querySelector('#p29-edit-title');
    setTimeout(() => titleEl?.focus(), 60);
}

function _p29_deleteFormula(id, box) {
    if (!confirm('Delete this formula? This cannot be undone.')) return;
    let items = _p29dbG('os_formulas', []);
    items = items.filter(f => f.id !== id);
    _p29dbS('os_formulas', items);
    _p29_refreshMineGrid(box);
    _p29toast('Formula deleted.');
    if (typeof window.initFormulas === 'function') window.initFormulas();
}

/* Force the p28 modal to re-render the "mine" grid */
function _p29_refreshMineGrid(box) {
    /* Activate "mine" tab */
    const tabs = box.querySelector('#p28-modal-tabs');
    if (!tabs) return;
    tabs.querySelectorAll('.p28-modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mine'));

    /* Show mine toolbar */
    const toolbar = box.querySelector('#p29-mine-toolbar');
    if (toolbar) toolbar.classList.remove('hidden');

    /* Reset subject filter (mine tab doesn't use it) */
    const subjSel = box.querySelector('#p28-formula-subject');
    if (subjSel) subjSel.style.display = 'none';

    /* Trigger p28 redraw */
    const modal = document.getElementById('p28-formula-modal');
    if (modal && modal._redraw) modal._redraw();

    /* Patch cards with edit/delete buttons */
    setTimeout(() => _p29_patchMineCards(box), 60);
}

/* Append edit & delete action buttons to user formula cards */
function _p29_patchMineCards(box) {
    const grid = box.querySelector('#p28-formula-grid');
    if (!grid) return;
    grid.querySelectorAll('.p28-fml-card:not([data-p29card])').forEach(card => {
        card.dataset.p29card = '1';

        /* Determine formula id from the card's add button data attribute (the closure stores item) */
        /* We'll look for the "Add to worksheet" button and extract via a data attribute we inject */
        const addBtn = card.querySelector('.p28-fml-card-add-btn');
        if (!addBtn) return;

        /* Add edit/delete row only for "mine" cards (those with the mine-badge) */
        const isMine = !!card.querySelector('.p28-fml-mine-badge');
        if (!isMine) return;

        /* Find the matching formula by title+formula text (best proxy we have) */
        const titleEl = card.querySelector('.p28-fml-card-title');
        const exprEl  = card.querySelector('.p28-fml-card-expr');
        if (!titleEl || !exprEl) return;

        const items = _p29dbG('os_formulas', []);
        const match = items.find(f =>
            f.title   === (titleEl.textContent || '').trim() &&
            f.formula === (exprEl.textContent  || '').trim()
        );
        if (!match) return;

        /* Check if already has our buttons */
        if (card.querySelector('[data-p29edit]')) return;

        /* Create action row */
        const actRow = document.createElement('div');
        actRow.style.cssText = 'display:flex;gap:5px;margin-top:4px;';

        const editBtn = document.createElement('button');
        editBtn.type               = 'button';
        editBtn.dataset.p29edit    = match.id;
        editBtn.className          = 'p28-fml-card-add-btn';
        editBtn.innerHTML          = '<i class="fa-solid fa-pencil"></i> Edit';
        editBtn.style.flex         = '1';

        const delBtn = document.createElement('button');
        delBtn.type                = 'button';
        delBtn.dataset.p29delete   = match.id;
        delBtn.className           = 'p28-fml-card-add-btn';
        delBtn.innerHTML           = '<i class="fa-solid fa-trash"></i>';
        delBtn.style.color         = '#f87171';
        delBtn.style.borderColor   = 'rgba(239,68,68,.3)';

        actRow.appendChild(editBtn);
        actRow.appendChild(delBtn);
        card.appendChild(actRow);
    });
}

/* ================================================================
   2.  FORMULA BLOCK — FULL UX OVERHAUL
   ================================================================ */
function _p29_formulaBlockOverhaul() {
    let _p29_blockRetries = 0;
    if (typeof window.p19_wbRender !== 'function' || window._p29blockDone) {
        if (!window._p29blockDone) {
            if (++_p29_blockRetries > 30) return; /* ~12 seconds max */
            setTimeout(_p29_formulaBlockOverhaul, 400);
            return;
        }
        return;
    }
    window._p29blockDone = true;

    /* Patch p19_wbRender: after original renders formula blocks, replace them */
    const _origRender = window.p19_wbRender;
    window.p19_wbRender = function() {
        _origRender.apply(this, arguments);
        requestAnimationFrame(_p29_reRenderFormulaBlocks);
    };

    /* Also patch p19_wbCompute so we can add inline error display */
    if (typeof window.p19_wbCompute === 'function' && !window._p29computePatched) {
        window._p29computePatched = true;
        const _origCompute = window.p19_wbCompute;
        window.p19_wbCompute = function(bid) {
            /* Clear previous error */
            const blockEl = document.querySelector('[data-bid="' + CSS.escape(bid) + '"]');
            if (blockEl) {
                blockEl.querySelector('.p29-formula-error')?.remove();
            }
            try {
                _origCompute.apply(this, arguments);
            } catch (e) {
                /* Show inline error if the outer call throws (it shouldn't — p19 toasts internally) */
            }
        };
    }
}

function _p29_reRenderFormulaBlocks() {
    const board = document.getElementById('p19-ws-board');
    if (!board) return;

    board.querySelectorAll('.formula-block:not([data-p29fb])').forEach(blockEl => {
        blockEl.dataset.p29fb = '1';

        const bid = blockEl.dataset.bid;
        if (!bid) return;

        /* Build new improved UI and replace the existing content, keeping the
           outer block element (to avoid disturbing drag handles etc.) */
        _p29_upgradeFormulaBlock(blockEl, bid);
    });
}

function _p29_upgradeFormulaBlock(blockEl, bid) {
    /* Gather current block data */
    const ws      = _p29MigrateWs(_p29GetWs());
    const block   = (ws.blocks || []).find(b => b.id === bid);
    if (!block || block.type !== 'formula') return;

    /* Remove old p19 content (but keep our already-injected action buttons & resize handle) */
    Array.from(blockEl.childNodes).forEach(n => {
        if (n.nodeType === 1) {
            /* Keep: p19-ws-block-actions (drag/del), p28-resize-handle */
            if (n.classList.contains('p19-ws-block-actions')) return;
            if (n.classList.contains('p28-resize-handle'))    return;
        }
        n.remove();
    });

    /* ── Header ── */
    const hdr = document.createElement('div');
    hdr.className = 'p19-ws-formula-header';

    const titleEl = document.createElement('div');
    titleEl.className   = 'p19-ws-formula-title';
    titleEl.textContent = block.title || 'Formula';

    const exprEl = document.createElement('div');
    exprEl.className   = 'p19-ws-formula-expr';
    exprEl.textContent = block.formula || '';

    hdr.appendChild(titleEl);
    hdr.appendChild(exprEl);
    blockEl.appendChild(hdr);

    /* ── Solve-for chip strip ── */
    if (block.vars && block.vars.length > 1) {
        const sfRow = document.createElement('div');
        sfRow.className = 'p29-solve-for-row';

        const sfLabel = document.createElement('span');
        sfLabel.className   = 'p29-solve-for-label';
        sfLabel.textContent = 'Solve for:';
        sfRow.appendChild(sfLabel);

        block.vars.forEach(v => {
            const chip = document.createElement('button');
            chip.type      = 'button';
            chip.className = 'p29-solve-for-chip' + (v.sym === block.solveFor ? ' active' : '');
            chip.textContent = v.sym;
            chip.title     = 'Solve for ' + v.sym;
            chip.addEventListener('click', () => {
                if (typeof window.p19_wbSetSolveFor === 'function') {
                    window.p19_wbSetSolveFor(bid, v.sym);
                }
            });
            sfRow.appendChild(chip);
        });
        blockEl.appendChild(sfRow);
    }

    /* ── Variable input grid ── */
    const varGrid = document.createElement('div');
    varGrid.className = 'p29-var-grid';

    (block.vars || []).forEach(v => {
        const isSolveFor = v.sym === block.solveFor;

        const item = document.createElement('div');
        item.className = 'p29-var-item';

        /* Symbol + name label row */
        const labelRow = document.createElement('div');
        labelRow.className = 'p29-var-sym-label';

        const symEl = document.createElement('span');
        symEl.className   = 'p29-var-sym' + (isSolveFor ? ' solve-for-sym' : '');
        symEl.textContent = v.sym;

        labelRow.appendChild(symEl);

        if (v.name && v.name !== v.sym) {
            const nameHint = document.createElement('span');
            nameHint.className   = 'p29-var-name-hint';
            nameHint.textContent = v.name;
            labelRow.appendChild(nameHint);
        }
        item.appendChild(labelRow);

        /* Input wrapper */
        const inpWrap = document.createElement('div');
        inpWrap.className = 'p29-var-inp-wrap' + (isSolveFor ? ' is-solve-for' : '');

        const inp = document.createElement('input');
        inp.type        = 'text';
        inp.className   = 'p29-var-input' + (isSolveFor ? ' solve-for-inp' : '');
        inp.dataset.p19input = 'var';
        inp.dataset.bid      = bid;
        inp.dataset.sym      = v.sym;
        inp.autocomplete     = 'off';
        inp.spellcheck       = false;

        if (isSolveFor) {
            inp.placeholder = 'result';
            inp.readOnly    = true;
            inp.value       = block.result !== null && block.result !== undefined ? _p29fmt(block.result) : '';
        } else {
            inp.placeholder = 'value';
            inp.value       = v.value !== undefined ? String(v.value) : '';

            inp.addEventListener('input', () => {
                /* Persist via p19 function */
                if (typeof window.p19_wbVarInput === 'function') {
                    window.p19_wbVarInput(bid, v.sym, inp.value.trim());
                }
                /* Attempt auto-compute */
                _p29_tryAutoCompute(bid);
            });

            inp.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    _p29_computeBlock(bid, blockEl);
                }
            });
        }

        inpWrap.appendChild(inp);

        /* @ref button (only for non-solve-for inputs) */
        if (!isSolveFor) {
            const refBtn = document.createElement('button');
            refBtn.type      = 'button';
            refBtn.className = 'p29-var-ref-btn';
            refBtn.title     = 'Insert a saved value reference (@name)';
            refBtn.textContent = '@';
            refBtn.addEventListener('click', e => {
                e.stopPropagation();
                _p29_showRefDropdown(item, inp, bid);
            });
            inpWrap.appendChild(refBtn);
        }

        item.appendChild(inpWrap);
        varGrid.appendChild(item);
    });

    blockEl.appendChild(varGrid);

    /* ── Compute button row ── */
    const btnRow = document.createElement('div');
    btnRow.className = 'p29-formula-btn-row';

    const computeBtn = document.createElement('button');
    computeBtn.type      = 'button';
    computeBtn.className = 'p19-ws-formula-solve-btn';
    /* Do NOT use data-p19action="compute" — we handle the click ourselves to
       avoid the p19 board handler also firing p19_wbCompute on the same click. */
    computeBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Compute';
    computeBtn.addEventListener('click', e => {
        e.stopPropagation();
        _p29_computeBlock(bid, blockEl);
    });
    btnRow.appendChild(computeBtn);

    /* Auto-compute badge placeholder */
    const acBadge = document.createElement('span');
    acBadge.className = 'p29-autocompute-badge hidden';
    acBadge.innerHTML = '<i class="fa-solid fa-check"></i> Auto';
    btnRow.appendChild(acBadge);
    blockEl.appendChild(btnRow);

    /* ── Result panel ── */
    if (block.result !== null && block.result !== undefined) {
        const panel = document.createElement('div');
        panel.className = 'p29-result-panel';

        const symLabel = document.createElement('div');
        symLabel.className   = 'p29-result-sym';
        symLabel.textContent = (block.solveFor || '') + ' =';

        const valEl = document.createElement('div');
        valEl.className   = 'p29-result-val';
        valEl.textContent = _p29fmt(block.result);

        const copyBtn = document.createElement('button');
        copyBtn.type      = 'button';
        copyBtn.className = 'p29-result-copy-btn';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.addEventListener('click', () => {
            const text = String(block.result);
            navigator.clipboard?.writeText(text).then(
                () => _p29toast('Result copied: ' + text),
                () => _p29toast('Result: ' + text)
            );
        });

        panel.appendChild(symLabel);
        panel.appendChild(valEl);
        panel.appendChild(copyBtn);

        /* Save-as row */
        const saveRow = document.createElement('div');
        saveRow.className = 'p29-saveas-row';

        const savedValues = ws.savedValues || {};
        const currentSavedName = Object.keys(savedValues).find(k => {
            const sv = savedValues[k];
            return (typeof sv === 'object' ? sv.value : sv) === block.result && block.savedAs === k;
        }) || (block.savedAs || '');

        if (currentSavedName) {
            const savedLabel = document.createElement('span');
            savedLabel.className = 'p29-saveas-saved-name';
            savedLabel.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved as @' + _p29esc(currentSavedName);
            saveRow.appendChild(savedLabel);

            const changeBtn = document.createElement('button');
            changeBtn.type      = 'button';
            changeBtn.className = 'p29-saveas-btn';
            changeBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            changeBtn.title     = 'Change saved name';
            changeBtn.addEventListener('click', () => {
                saveRow.innerHTML = '';
                _p29_buildSaveAsInput(saveRow, bid, block, ws, panel);
            });
            saveRow.appendChild(changeBtn);
        } else {
            _p29_buildSaveAsInput(saveRow, bid, block, ws, panel);
        }

        panel.appendChild(saveRow);
        blockEl.appendChild(panel);
    }
}

function _p29_buildSaveAsInput(saveRow, bid, block, ws, panel) {
    const saveInp = document.createElement('input');
    saveInp.type        = 'text';
    saveInp.className   = 'p29-saveas-inp';
    saveInp.placeholder = 'Save as @name\u2026';
    saveInp.value       = block.savedAs || '';
    saveInp.dataset.p19input = 'saveas';
    saveInp.dataset.bid      = bid;

    const saveBtn = document.createElement('button');
    saveBtn.type      = 'button';
    saveBtn.className = 'p29-saveas-btn';
    saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Save';
    saveBtn.addEventListener('click', () => {
        const name = saveInp.value.trim().replace(/^@/, '');
        if (!name) { _p29toast('Enter a name to save this result.'); saveInp.focus(); return; }
        if (typeof window.p19_wbSetSaveAs === 'function') window.p19_wbSetSaveAs(bid, name);
        const ws2 = _p29MigrateWs(_p29GetWs());
        ws2.savedValues = ws2.savedValues || {};
        ws2.savedValues[name] = { value: block.result };
        const b2 = (ws2.blocks || []).find(x => x.id === bid);
        if (b2) b2.savedAs = name;
        _p29SaveWs(ws2);
        _p29toast('@' + name + ' = ' + _p29fmt(block.result) + ' saved.');
        /* Re-render to show the saved label */
        if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
    });

    saveInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveBtn.click();
    });

    saveRow.appendChild(saveInp);
    saveRow.appendChild(saveBtn);
}

/* ── Attempt auto-compute if all non-solve-for vars are filled ── */
const _p29_autoComputeTimers = {};
function _p29_tryAutoCompute(bid) {
    /* Debounce: wait for user to stop typing */
    clearTimeout(_p29_autoComputeTimers[bid]);
    _p29_autoComputeTimers[bid] = setTimeout(() => {
        const ws    = _p29MigrateWs(_p29GetWs());
        const block = (ws.blocks || []).find(b => b.id === bid);
        if (!block || block.type !== 'formula') return;

        /* Check current DOM values */
        const blockEl = document.querySelector('[data-bid="' + CSS.escape(bid) + '"]');
        if (!blockEl) return;

        const allFilled = (block.vars || []).every(v => {
            if (v.sym === block.solveFor) return true;
            const inp = blockEl.querySelector('[data-p19input="var"][data-sym="' + CSS.escape(v.sym) + '"]');
            const val = inp ? inp.value.trim() : v.value;
            return val !== '' && val !== undefined && val !== null;
        });

        if (allFilled) {
            _p29_computeBlock(bid, blockEl, true);
        }
    }, 500);
}

/* ── Compute a formula block (wrapper with inline error display) ── */
function _p29_computeBlock(bid, blockEl, silent) {
    /* Remove previous error */
    blockEl.querySelector('.p29-formula-error')?.remove();

    /* Sync DOM inputs to data first */
    const ws = _p29MigrateWs(_p29GetWs());
    const block = (ws.blocks || []).find(b => b.id === bid);
    if (!block || block.type !== 'formula') return;

    (block.vars || []).forEach(v => {
        if (v.sym === block.solveFor) return;
        const inp = blockEl.querySelector('[data-p19input="var"][data-sym="' + CSS.escape(v.sym) + '"]');
        if (inp) v.value = inp.value.trim();
    });
    _p29SaveWs(ws);

    /* Call original compute */
    if (typeof window.p19_wbCompute === 'function') {
        try {
            window.p19_wbCompute(bid);
        } catch (e) {
            _p29_showInlineError(blockEl, e.message || 'Compute error');
        }
    }

    /* Show auto badge if silent */
    if (silent) {
        const badge = blockEl.querySelector('.p29-autocompute-badge');
        if (badge) {
            badge.classList.remove('hidden');
            clearTimeout(badge._hideTimer);
            badge._hideTimer = setTimeout(() => badge.classList.add('hidden'), 2000);
        }
    }
}

/* ── Show inline error inside the block ── */
function _p29_showInlineError(blockEl, msg) {
    const err = document.createElement('div');
    err.className = 'p29-formula-error';
    err.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + _p29esc(msg);
    /* Insert after the button row */
    const btnRow = blockEl.querySelector('.p29-formula-btn-row');
    if (btnRow && btnRow.nextSibling) btnRow.parentNode.insertBefore(err, btnRow.nextSibling);
    else blockEl.appendChild(err);
}

/* ── @ref dropdown ─────────────────────────────────────────── */
function _p29_showRefDropdown(container, inp, bid) {
    /* Remove any existing dropdown */
    document.querySelectorAll('.p29-ref-dropdown').forEach(d => d.remove());

    const ws          = _p29MigrateWs(_p29GetWs());
    const savedValues = ws.savedValues || {};
    const names       = Object.keys(savedValues);

    const dropdown = document.createElement('div');
    dropdown.className = 'p29-ref-dropdown';

    if (!names.length) {
        const empty = document.createElement('div');
        empty.className   = 'p29-ref-empty';
        empty.textContent = 'No saved values yet. Compute a formula and save its result first.';
        dropdown.appendChild(empty);
    } else {
        names.forEach(name => {
            const sv  = savedValues[name];
            const val = typeof sv === 'object' ? sv.value : sv;

            const item = document.createElement('div');
            item.className = 'p29-ref-item';

            const nameEl = document.createElement('span');
            nameEl.className   = 'p29-ref-item-name';
            nameEl.textContent = '@' + name;

            const valEl = document.createElement('span');
            valEl.className   = 'p29-ref-item-val';
            valEl.textContent = _p29fmt(val);

            item.appendChild(nameEl);
            item.appendChild(valEl);
            item.addEventListener('click', () => {
                inp.value = '@' + name;
                if (typeof window.p19_wbVarInput === 'function') {
                    window.p19_wbVarInput(bid, inp.dataset.sym, '@' + name);
                }
                dropdown.remove();
                inp.focus();
                _p29_tryAutoCompute(bid);
            });
            dropdown.appendChild(item);
        });
    }

    container.appendChild(dropdown);

    /* Close on outside click */
    const _close = e => {
        if (!dropdown.contains(e.target) && e.target !== inp) {
            dropdown.remove();
            document.removeEventListener('click', _close, true);
        }
    };
    setTimeout(() => document.addEventListener('click', _close, true), 10);
}

/* ── Number formatter ─────────────────────────────────────── */
function _p29fmt(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') {
        if (!isFinite(v)) return String(v);
        /* Up to 8 sig figs, strip trailing zeros */
        return parseFloat(v.toPrecision(8)).toString();
    }
    return String(v);
}

/* ================================================================
   INIT
   ================================================================ */
(function _p29_init() {
    const _go = () => {
        _p29_formulaModalEnhance();
        _p29_formulaBlockOverhaul();
        console.log('[patches29] loaded — formula modal create/edit, formula block UX overhaul, auto-compute, @ref dropdown');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 500));
    } else {
        setTimeout(_go, 500);
    }
})();
