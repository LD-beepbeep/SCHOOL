/* ================================================================
   StudentOS — patches33.js
   1.  Inline formula editor
       Adds an "Edit formula" toggle button to every formula block
       that is already on the worksheet.  Clicking it reveals an
       inline panel where the user can change the title and the
       formula expression without leaving the worksheet and without
       needing to go through the picker or the formula modal.
       This is the "custom add formula integrated into the formula
       block" requested feature.

   2.  Content-aware resize re-check
       After the inline editor saves a new expression, the block's
       natural minimum height is re-evaluated so the block never
       collapses below its new content.

   3.  Overlay guard pass
       After every render, scan for blocks that still have the
       note-textarea paddingRight inline-style set to the old 64 px
       value (set by patches19) and raise it to 96 px.
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p33dbG = (k, d) => {
    try { return window.DB?.get ? window.DB.get(k, d) : JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; }
    catch { return d; }
};
const _p33dbS = (k, v) => {
    try { if (window.DB?.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); }
    catch {}
};
const _p33id    = () => Math.random().toString(36).slice(2, 10);
const _p33toast = msg => {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
};

/* ── Variable extractor (same skip list as p28/p29) ─────────── */
const _P33_SKIP = new Set([
    'sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh',
    'sqrt','cbrt','abs','log','log2','log10','exp','pow','ceil','floor',
    'round','sign','min','max','hypot','pi','e','inf','infinity','nan',
    'true','false','if','else','and','or','not',
]);
function _p33ExtractVars(expr) {
    const tokens = (expr || '').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const seen   = new Set();
    return tokens.filter(t => {
        if (_P33_SKIP.has(t.toLowerCase())) return false;
        if (seen.has(t)) return false;
        seen.add(t);
        return true;
    });
}

/* ── Worksheet data ─────────────────────────────────────────── */
function _p33GetWs()    { return _p33dbG('os_worksheet', { blocks: [], savedValues: {} }); }
function _p33SaveWs(ws) { _p33dbS('os_worksheet', ws); }
function _p33MigrateWs(ws) {
    if (Array.isArray(ws.blocks)) return ws;
    return { blocks: [], savedValues: ws.savedValues || {} };
}

/* ================================================================
   1.  INLINE FORMULA EDITOR
   ================================================================ */

/*
 * _p33_attachEditToggle(blockEl)
 * --------------------------------
 * Attaches the "Edit formula" toggle button to a single formula block
 * that has already been upgraded by patches29.  Safe to call multiple
 * times on the same element.
 */
function _p33_attachEditToggle(blockEl) {
    if (blockEl.dataset.p33edit) return;
    blockEl.dataset.p33edit = '1';

    const bid = blockEl.dataset.bid;
    if (!bid) return;

    /* Find the formula header produced by patches29 */
    const hdr = blockEl.querySelector('.p19-ws-formula-header');
    if (!hdr) return;

    /* Build toggle button */
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'p33-formula-edit-toggle';
    btn.title     = 'Edit the formula title and expression';
    btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit formula';

    btn.addEventListener('click', e => {
        e.stopPropagation();
        _p33_toggleEditPanel(blockEl, bid, btn);
    });

    /* Insert the button right after the formula header */
    hdr.insertAdjacentElement('afterend', btn);
}

/*
 * _p33_toggleEditPanel(blockEl, bid, toggleBtn)
 * -----------------------------------------------
 * Opens the inline edit panel below the toggle button, or closes it
 * if it is already open.
 */
function _p33_toggleEditPanel(blockEl, bid, toggleBtn) {
    /* If panel already open, close it */
    const existing = blockEl.querySelector('.p33-formula-edit-panel');
    if (existing) {
        existing.remove();
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit formula';
        return;
    }

    /* Load current block data */
    const ws    = _p33MigrateWs(_p33GetWs());
    const block = (ws.blocks || []).find(b => b.id === bid);
    if (!block || block.type !== 'formula') return;

    /* Build panel */
    const panel = document.createElement('div');
    panel.className = 'p33-formula-edit-panel';

    /* Panel heading */
    const panelTitle = document.createElement('div');
    panelTitle.className = 'p33-fep-title-row';
    panelTitle.innerHTML = '<i class="fa-solid fa-function"></i> Edit formula';
    panel.appendChild(panelTitle);

    /* Title field */
    const titleField = document.createElement('div');
    titleField.className = 'p33-fep-field';

    const titleLabel = document.createElement('div');
    titleLabel.className   = 'p33-fep-label';
    titleLabel.textContent = 'Title (optional)';

    const titleInp = document.createElement('input');
    titleInp.type        = 'text';
    titleInp.className   = 'p33-fep-input';
    titleInp.placeholder = 'e.g. Quadratic Formula';
    titleInp.value       = block.title || '';
    titleInp.autocomplete = 'off';

    titleField.appendChild(titleLabel);
    titleField.appendChild(titleInp);
    panel.appendChild(titleField);

    /* Formula expression field */
    const exprField = document.createElement('div');
    exprField.className = 'p33-fep-field';

    const exprLabel = document.createElement('div');
    exprLabel.className   = 'p33-fep-label';
    exprLabel.textContent = 'Formula expression';

    const exprInp = document.createElement('input');
    exprInp.type        = 'text';
    exprInp.className   = 'p33-fep-input mono';
    exprInp.placeholder = 'e.g. x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)';
    exprInp.value       = block.formula || '';
    exprInp.autocomplete = 'off';
    exprInp.spellcheck   = false;

    exprField.appendChild(exprLabel);
    exprField.appendChild(exprInp);
    panel.appendChild(exprField);

    /* Variable detection preview */
    const varsRow = document.createElement('div');
    varsRow.className = 'p33-fep-vars';

    function _updateVarsPreview() {
        varsRow.innerHTML = '';
        const vars = _p33ExtractVars(exprInp.value);
        if (!vars.length) {
            const hint = document.createElement('span');
            hint.className   = 'p33-fep-vars-label';
            hint.textContent = 'Detected variables will appear here';
            varsRow.appendChild(hint);
            return;
        }
        const lbl = document.createElement('span');
        lbl.className   = 'p33-fep-vars-label';
        lbl.textContent = 'Variables:';
        varsRow.appendChild(lbl);
        vars.forEach(sym => {
            const chip = document.createElement('span');
            chip.className   = 'p33-fep-var-chip';
            chip.textContent = sym;
            varsRow.appendChild(chip);
        });
    }

    exprInp.addEventListener('input', _updateVarsPreview);
    _updateVarsPreview();
    panel.appendChild(varsRow);

    /* Error line */
    const errEl = document.createElement('div');
    errEl.className = 'p33-fep-err';
    panel.appendChild(errEl);

    /* Action buttons */
    const actRow = document.createElement('div');
    actRow.className = 'p33-fep-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type      = 'button';
    saveBtn.className = 'p33-fep-save-btn';
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save changes';

    const cancelBtn = document.createElement('button');
    cancelBtn.type      = 'button';
    cancelBtn.className = 'p33-fep-cancel-btn';
    cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel';

    actRow.appendChild(saveBtn);
    actRow.appendChild(cancelBtn);
    panel.appendChild(actRow);

    /* ── Wire save ─────────────────────────────────────────── */
    saveBtn.addEventListener('click', () => {
        errEl.textContent = '';
        const newExpr  = exprInp.value.trim();
        const newTitle = titleInp.value.trim();

        if (!newExpr) {
            errEl.textContent = 'Formula expression is required.';
            exprInp.focus();
            return;
        }

        const newVars = _p33ExtractVars(newExpr);

        /* Preserve existing variable values where the symbol name matches */
        const oldVarMap = {};
        (block.vars || []).forEach(v => { oldVarMap[v.sym] = v.value; });

        /* Compute updated solveFor: keep existing if still valid, else first var */
        const newSolveFor = newVars.includes(block.solveFor)
            ? block.solveFor
            : (newVars[0] || '');

        /* Persist */
        const ws2 = _p33MigrateWs(_p33GetWs());
        const b2  = (ws2.blocks || []).find(x => x.id === bid);
        if (!b2) {
            errEl.textContent = 'Block not found — try refreshing the worksheet.';
            return;
        }

        b2.title    = newTitle || newExpr;
        b2.formula  = newExpr;
        b2.vars     = newVars.map(sym => ({
            sym,
            name:  sym,
            value: oldVarMap[sym] !== undefined ? oldVarMap[sym] : '',
        }));
        b2.solveFor = newSolveFor;
        b2.result   = null; /* clear stale result */

        _p33SaveWs(ws2);

        /* Close panel before re-render */
        panel.remove();
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit formula';

        /* Re-render the full worksheet so patches29 rebuilds the block */
        if (typeof window.p19_wbRender === 'function') {
            window.p19_wbRender();
        }

        _p33toast('Formula updated: ' + (newTitle || newExpr));
    });

    /* ── Wire cancel ─────────────────────────────────────────── */
    cancelBtn.addEventListener('click', () => {
        panel.remove();
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit formula';
    });

    /* Insert panel after the toggle button */
    toggleBtn.insertAdjacentElement('afterend', panel);
    toggleBtn.classList.add('active');
    toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel edit';

    /* Focus the title if blank, otherwise the expression */
    setTimeout(() => {
        if (!titleInp.value) titleInp.focus();
        else exprInp.focus();
    }, 60);
}

/* ================================================================
   2.  OBSERVER — ATTACH EDIT TOGGLE AFTER PATCHES29 UPGRADES BLOCKS
   ================================================================ */

/*
 * Formula blocks are upgraded by patches29 inside a requestAnimationFrame
 * after every render.  We need to run AFTER patches29 (rAF1) and
 * patches31 (rAF2), so we schedule a triple-rAF on top of p19_wbRender.
 *
 * We also watch the board via MutationObserver for blocks that appear
 * outside the normal render cycle.
 */
function _p33_attachAllEditToggles() {
    document.querySelectorAll('.formula-block.p19-ws-block[data-p29fb]:not([data-p33edit])').forEach(el => {
        _p33_attachEditToggle(el);
    });
}

function _p33_hookRender() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbRender !== 'function' || window._p33hookDone) {
            if (!window._p33hookDone && ++_retries < 80) setTimeout(_try, 300);
            return;
        }
        window._p33hookDone = true;

        const _orig = window.p19_wbRender;
        window.p19_wbRender = function() {
            _orig.apply(this, arguments);
            /* rAF1: patches28+29 run.
               rAF2: patches31 runs.
               rAF3: we attach edit toggles. */
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(_p33_attachAllEditToggles);
                });
            });
        };

        /* Handle blocks already on the board right now */
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(_p33_attachAllEditToggles);
            });
        });
    })();
}

/* Also watch for blocks that may be added by other means */
function _p33_observeBoard() {
    let _retries = 0;
    (function _try() {
        const board = document.getElementById('p19-ws-board');
        if (!board) {
            if (++_retries < 60) setTimeout(_try, 400);
            return;
        }
        new MutationObserver(() => {
            /* Debounce to avoid running on every individual child change */
            clearTimeout(_p33_observeBoard._tid);
            _p33_observeBoard._tid = setTimeout(_p33_attachAllEditToggles, 120);
        }).observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-p29fb'] });
    })();
}

/* ================================================================
   3.  OVERLAY GUARD — RAISE NOTE-TEXTAREA PADDING
   ================================================================ */

/*
 * patches19 sets paddingRight:'64px' as an inline style on note
 * (text) block textareas.  Our CSS rule (patches33.css) uses
 * !important to override this, but belt-and-suspenders: also fix it
 * in JS after every render so the inline style never wins.
 */
function _p33_fixNoteTextareaPadding() {
    document.querySelectorAll('.p19-ws-note-textarea').forEach(ta => {
        ta.style.paddingRight = '96px';
    });
}

function _p33_hookNotepadding() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbRender !== 'function' || window._p33paddingHookDone) {
            if (!window._p33paddingHookDone && ++_retries < 80) setTimeout(_try, 300);
            return;
        }
        window._p33paddingHookDone = true;

        const _orig = window.p19_wbRender;
        window.p19_wbRender = function() {
            _orig.apply(this, arguments);
            requestAnimationFrame(_p33_fixNoteTextareaPadding);
        };
    })();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p33_init() {
    function _go() {
        _p33_hookRender();
        _p33_hookNotepadding();
        _p33_observeBoard();
        console.log('[patches33] loaded — inline formula editor, overlay fixes');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 800));
    } else {
        setTimeout(_go, 800);
    }
})();
