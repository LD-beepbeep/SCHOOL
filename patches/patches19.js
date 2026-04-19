/* ================================================================
   StudentOS — patches19.js
   FIXES & IMPROVEMENTS:
   1.  Background tint  — fix setBg() to write --custom-bg variable
                          so patches17/18 !important CSS picks it up
   2.  Worksheet        — full whiteboard redesign: block-based canvas,
                          formula blocks with clean variable inputs,
                          heading / text / divider block types,
                          add-block picker sheet, drag-to-reorder
   3.  Formula modal    — hide unit selects, slimmer variable rows
   4.  Task DnD         — pointer-events fallback (touch support)
   5.  Avatar sync      — reliable large preview in settings
   6.  Routine polish   — ensure done-buttons & progress bar persist
   7.  Re-render guard  — prevent stale view after remote DB sync
   ================================================================ */

/* ── helpers ─────────────────────────────────────────────────── */
const _p19lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p19lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p19dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p19lsG(k, d); } catch { return d; } };
const _p19dbS = (k, v) => { window.DB?.set ? window.DB.set(k, v) : _p19lsS(k, v); };
const _p19esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p19id  = () => Math.random().toString(36).slice(2, 10);
const _p19toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
const _p19date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
function _p19safeColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6'; }
function _p19fmt(n) {
    if (!isFinite(n)) return String(n);
    const a = Math.abs(n);
    if (a === 0) return '0';
    if (a >= 1e6 || (a < 1e-3 && a > 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(6)).toString();
}

/* ================================================================
   1.  BACKGROUND TINT FIX
       The original setBg() sets an inline background style on the
       #ambient-bg element, but patches17.css uses !important on the
       .ambient-light class, overriding the inline style.
       Fix: wrap setBg() to write the --custom-bg CSS variable on
       :root instead (which is exactly what var(--custom-bg, …) in
       the CSS already consumes).
   ================================================================ */
function _p19_fixBgTint() {
    function _patchSetBg() {
        if (typeof window.setBg !== 'function' || window._p19setBgDone) {
            if (!window._p19setBgDone) setTimeout(_patchSetBg, 400);
            return;
        }
        window._p19setBgDone = true;

        window.setBg = function(c) {
            /* Build two-stop gradient with the user's chosen colour at a visible opacity */
            const safe = _p19safeColor(c);
            const gradient = [
                `radial-gradient(ellipse at 28% 5%,  ${safe}99, transparent 52%)`,
                `radial-gradient(ellipse at 88% 90%, ${safe}66, transparent 52%)`,
                `radial-gradient(ellipse at 60% 55%, ${safe}33, transparent 42%)`,
            ].join(', ');

            /* Write the CSS variable so the !important rule picks it up */
            document.documentElement.style.setProperty('--custom-bg', gradient);

            /* Also set inline as a non-!important fallback for older patches */
            const el = document.getElementById('ambient-bg');
            if (el) el.style.setProperty('background', gradient, 'important');

            /* Persist */
            if (window.DB?.set) window.DB.set('os_bg_color', c);
            else try { localStorage.setItem('os_bg_color', JSON.stringify(c)); } catch {}
        };

        /* Re-apply whatever was saved so the page immediately shows the colour */
        const saved = _p19dbG('os_bg_color', '');
        if (saved) window.setBg(saved);

        /* Sync the colour pickers in Settings so they reflect the saved value */
        setTimeout(() => {
            ['p9-bg-color', 'p10-bg-color'].forEach(id => {
                const el = document.getElementById(id);
                if (el && saved) el.value = saved;
            });
        }, 800);
    }
    _patchSetBg();
}

/* ================================================================
   2.  WORKSHEET WHITEBOARD
       A full-width block-based canvas that replaces the sidebar
       library + step-list layout with a clean scratchpad feel.
       Data stays in the same `os_worksheet` key for compatibility.
   ================================================================ */

/* ── block helpers ──────────────────────────────────────────── */
function _p19_wbGetData() { return _p19dbG('os_worksheet', { blocks: [], savedValues: {} }); }
function _p19_wbSave(ws)  { _p19dbS('os_worksheet', ws); }

/* Upgrade old steps[] format produced by patches16 → blocks[] */
function _p19_wbMigrate(ws) {
    if (Array.isArray(ws.blocks)) return ws;  /* already new format (even if empty) */
    const blocks = (ws.steps || []).map(s => {
        if (s.type === 'note')    return { id: s.id || _p19id(), type: 'text',    content: s.content || '' };
        if (s.type === 'formula') return {
            id: s.id || _p19id(), type: 'formula',
            formulaId: s.formulaId, title: s.title, formula: s.formula,
            vars: s.vars || [], solveFor: s.solveFor || '',
            result: s.result ?? null, savedAs: s.savedAs || '',
        };
        return { id: s.id || _p19id(), type: 'text', content: '' };
    });
    return { blocks, savedValues: ws.savedValues || {}, steps: ws.steps };
}

/* ── main render ─────────────────────────────────────────────── */
window.p19_wbRender = function() {
    const board = document.getElementById('p19-ws-board');
    if (!board) return;

    const raw = _p19_wbGetData();
    const ws  = _p19_wbMigrate(raw);

    /* ── Saved values bar (built with DOM APIs) ─────────────────── */
    const svBar = document.getElementById('p19-ws-sv-bar');
    if (svBar) {
        svBar.innerHTML = '';
        const entries = Object.entries(ws.savedValues || {});
        if (entries.length) {
            entries.forEach(([k, v]) => {
                const val = typeof v === 'object' ? v.value : v;
                const chip = document.createElement('div');
                chip.className = 'p19-ws-sv-chip';
                chip.innerHTML = '<i class="fa-solid fa-at" style="font-size:.6rem;"></i>';
                const label = document.createTextNode(` ${k} = ${_p19fmt(val)} `);
                chip.appendChild(label);
                const delBtn = document.createElement('button');
                delBtn.title = 'Remove';
                delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                delBtn.dataset.p19action = 'del-saved';
                delBtn.dataset.name = k;
                chip.appendChild(delBtn);
                svBar.appendChild(chip);
            });
        } else {
            const hint = document.createElement('span');
            hint.style.cssText = 'font-size:.7rem;color:var(--text-muted);';
            hint.textContent = 'Saved values from formula steps appear here as @name references';
            svBar.appendChild(hint);
        }
    }

    /* ── Blocks (static structure + DOM-injected values) ─────────── */
    board.innerHTML = '';
    (ws.blocks || []).forEach(block => {
        const el = _p19_buildBlock(block, ws);
        if (el) board.appendChild(el);
    });

    /* Sticky add button */
    const addBtn = document.createElement('button');
    addBtn.id = 'p19-ws-add-btn-fixed';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add block';
    addBtn.addEventListener('click', () => window.p19_wbOpenPicker());
    board.appendChild(addBtn);

    /* Wire event delegation */
    _p19_wbAttachEvents(board, ws);

    /* Re-attach drag handles */
    _p19_wbInitDnD();
};

/* ── event delegation ────────────────────────────────────────── */
function _p19_wbAttachEvents(board, ws) {
    /* Remove old listeners by replacing the board's listener key */
    if (board._p19clickHandler) board.removeEventListener('click', board._p19clickHandler);
    if (board._p19inputHandler) board.removeEventListener('input', board._p19inputHandler);

    board._p19clickHandler = function(e) {
        const btn = e.target.closest('[data-p19action]');
        if (!btn) return;
        const action = btn.dataset.p19action;
        const bid    = btn.dataset.bid   || btn.closest('[data-bid]')?.dataset.bid;
        const sym    = btn.dataset.sym;
        const name   = btn.dataset.name;

        if (action === 'del-block'   && bid)       window.p19_wbDeleteBlock(bid);
        if (action === 'del-saved'   && name)      window.p19_wbDeleteSaved(name);
        if (action === 'compute'     && bid)       window.p19_wbCompute(bid);
        if (action === 'save-result' && bid)       window.p19_wbSaveResult(bid);
        if (action === 'solve-for'   && bid && sym) window.p19_wbSetSolveFor(bid, sym);
    };

    board._p19inputHandler = function(e) {
        const el  = e.target;
        const bid = el.dataset.bid || el.closest('[data-bid]')?.dataset.bid;
        if (!bid) return;

        if (el.dataset.p19input === 'text')   window.p19_wbUpdateText(bid, el.value);
        if (el.dataset.p19input === 'var')    window.p19_wbVarInput(bid, el.dataset.sym, el.value);
        if (el.dataset.p19input === 'saveas') window.p19_wbSetSaveAs(bid, el.value);
    };

    board.addEventListener('click', board._p19clickHandler);
    board.addEventListener('input', board._p19inputHandler);
}

/* ── block builders (DOM API — no user data in innerHTML) ────── */
function _p19_buildBlock(block, ws) {
    if (block.type === 'heading') return _p19_buildHeadingBlock(block);
    if (block.type === 'divider') return _p19_buildDividerBlock(block);
    if (block.type === 'text')    return _p19_buildTextBlock(block);
    if (block.type === 'formula') return _p19_buildFormulaBlock(block, ws);
    return null;
}

function _p19_makeActions(bid) {
    const wrap = document.createElement('div');
    wrap.className = 'p19-ws-block-actions';

    const handle = document.createElement('button');
    handle.className = 'p19-ws-block-btn handle';
    handle.dataset.bid = bid;
    handle.title = 'Drag to reorder';
    handle.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';

    const del = document.createElement('button');
    del.className = 'p19-ws-block-btn del';
    del.dataset.p19action = 'del-block';
    del.dataset.bid = bid;
    del.title = 'Delete block';
    del.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    wrap.appendChild(handle);
    wrap.appendChild(del);
    return wrap;
}

function _p19_buildHeadingBlock(block) {
    const el = document.createElement('div');
    el.className = 'p19-ws-block heading-block';
    el.dataset.bid = block.id;

    el.appendChild(_p19_makeActions(block.id));

    const inp = document.createElement('input');
    inp.className = 'p19-ws-heading-input';
    inp.placeholder = 'Section heading\u2026';
    inp.value = block.content || '';
    inp.style.paddingRight = '64px';
    inp.dataset.p19input = 'text';
    inp.dataset.bid = block.id;
    el.appendChild(inp);
    return el;
}

function _p19_buildDividerBlock(block) {
    const el = document.createElement('div');
    el.className = 'p19-ws-block divider-block';
    el.dataset.bid = block.id;
    el.appendChild(_p19_makeActions(block.id));
    el.appendChild(document.createElement('hr'));
    return el;
}

function _p19_buildTextBlock(block) {
    const el = document.createElement('div');
    el.className = 'p19-ws-block note-block';
    el.dataset.bid = block.id;
    el.appendChild(_p19_makeActions(block.id));

    const ta = document.createElement('textarea');
    ta.className = 'p19-ws-note-textarea';
    ta.placeholder = 'Notes, observations, equations\u2026';
    ta.value = block.content || '';
    ta.style.paddingRight = '64px';
    ta.dataset.p19input = 'text';
    ta.dataset.bid = block.id;
    el.appendChild(ta);
    return el;
}

function _p19_buildFormulaBlock(block, ws) {
    const el = document.createElement('div');
    el.className = 'p19-ws-block formula-block';
    el.dataset.bid = block.id;
    el.appendChild(_p19_makeActions(block.id));

    /* Header: title + expression */
    const hdr = document.createElement('div');
    hdr.className = 'p19-ws-formula-header';
    const hdrInner = document.createElement('div');

    const titleEl = document.createElement('div');
    titleEl.className = 'p19-ws-formula-title';
    titleEl.textContent = block.title || 'Formula';

    const exprEl = document.createElement('div');
    exprEl.className = 'p19-ws-formula-expr';
    exprEl.textContent = block.formula || '';

    hdrInner.appendChild(titleEl);
    hdrInner.appendChild(exprEl);
    hdr.appendChild(hdrInner);
    el.appendChild(hdr);

    /* Variable inputs */
    const grid = document.createElement('div');
    grid.className = 'p19-ws-vars-grid';
    (block.vars || []).forEach(v => {
        const isSolveFor = v.sym === block.solveFor;
        const row = document.createElement('div');
        row.className = 'p19-ws-var-row' + (isSolveFor ? ' solve-for-row' : '');

        const symEl = document.createElement('div');
        symEl.className = 'p19-ws-var-sym';
        symEl.textContent = v.sym;

        const eqEl = document.createElement('div');
        eqEl.className = 'p19-ws-var-eq';
        eqEl.textContent = '=';

        const inp = document.createElement('input');
        inp.className = 'p19-ws-var-input';
        inp.type = 'text';
        inp.placeholder = isSolveFor ? 'solve' : 'value';
        inp.dataset.p19input = 'var';
        inp.dataset.bid = block.id;
        inp.dataset.sym = v.sym;
        if (isSolveFor) {
            inp.value = block.result !== null ? _p19fmt(block.result) : '';
            inp.readOnly = true;
            inp.style.cssText = 'color:var(--accent);font-weight:700;';
        } else {
            inp.value = v.value !== undefined ? String(v.value) : '';
        }

        const ring = document.createElement('div');
        ring.className = 'p19-ws-var-solve-ring' + (isSolveFor ? ' active' : '');
        ring.title = 'Solve for this variable';
        ring.dataset.p19action = 'solve-for';
        ring.dataset.bid = block.id;
        ring.dataset.sym = v.sym;
        if (isSolveFor) ring.innerHTML = '<i class="fa-solid fa-equals"></i>';

        row.appendChild(symEl);
        row.appendChild(eqEl);
        row.appendChild(inp);
        row.appendChild(ring);
        grid.appendChild(row);
    });
    el.appendChild(grid);

    /* Compute button */
    const acts = document.createElement('div');
    acts.className = 'p19-ws-formula-actions';
    const computeBtn = document.createElement('button');
    computeBtn.className = 'p19-ws-formula-solve-btn';
    computeBtn.dataset.p19action = 'compute';
    computeBtn.dataset.bid = block.id;
    computeBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Compute';
    acts.appendChild(computeBtn);
    el.appendChild(acts);

    /* Result */
    if (block.result !== null) {
        const res = document.createElement('div');
        res.className = 'p19-ws-result';

        const symLabel = document.createElement('div');
        symLabel.className = 'p19-ws-result-sym';
        symLabel.textContent = (block.solveFor || '') + ' =';

        const valEl = document.createElement('div');
        valEl.className = 'p19-ws-result-val';
        valEl.textContent = _p19fmt(block.result);

        const saveRow = document.createElement('div');
        saveRow.className = 'p19-ws-saveas-row';

        const saveInp = document.createElement('input');
        saveInp.className = 'p19-ws-saveas-inp';
        saveInp.placeholder = 'Save as @name\u2026';
        saveInp.value = block.savedAs || '';
        saveInp.dataset.p19input = 'saveas';
        saveInp.dataset.bid = block.id;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'p19-ws-saveas-btn';
        saveBtn.dataset.p19action = 'save-result';
        saveBtn.dataset.bid = block.id;
        saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Save';

        saveRow.appendChild(saveInp);
        saveRow.appendChild(saveBtn);
        res.appendChild(symLabel);
        res.appendChild(valEl);
        res.appendChild(saveRow);
        el.appendChild(res);
    }

    return el;
}

/* ── block actions ───────────────────────────────────────────── */
window.p19_wbUpdateText = function(bid, val) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    const block = (migrated.blocks || []).find(b => b.id === bid);
    if (!block) return;
    block.content = val;
    migrated.steps = migrated.steps; // keep old compat key
    _p19_wbSave(migrated);
};

window.p19_wbVarInput = function(bid, sym, val) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    const block = (migrated.blocks || []).find(b => b.id === bid);
    if (!block || !block.vars) return;
    const v = block.vars.find(x => x.sym === sym);
    if (v) v.value = val;
    _p19_wbSave(migrated);
};

window.p19_wbSetSolveFor = function(bid, sym) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    const block = (migrated.blocks || []).find(b => b.id === bid);
    if (!block) return;
    block.solveFor = sym;
    block.result = null;
    _p19_wbSave(migrated);
    p19_wbRender();
};

window.p19_wbSetSaveAs = function(bid, val) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    const block = (migrated.blocks || []).find(b => b.id === bid);
    if (!block) return;
    block.savedAs = val;
    _p19_wbSave(migrated);
};

window.p19_wbCompute = function(bid) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    const block = (migrated.blocks || []).find(b => b.id === bid);
    if (!block || block.type !== 'formula') return;

    /* Gather input values from DOM (may have been typed without triggering input event) */
    const blockEl = document.querySelector(`[data-bid="${CSS.escape(bid)}"]`);
    if (blockEl) {
        (block.vars || []).forEach(v => {
            if (v.sym === block.solveFor) return;
            const inp = blockEl.querySelector(`[data-p19input="var"][data-sym="${CSS.escape(v.sym)}"]`);
            if (inp) v.value = inp.value.trim();
        });
    }

    const knownVals = {};
    (block.vars || []).forEach(v => {
        if (v.sym === block.solveFor) return;
        const raw = v.value || '';
        if (!raw) return;
        /* @ref support */
        if (raw.startsWith('@')) {
            const ref = (migrated.savedValues || {})[raw.slice(1)];
            if (ref !== undefined) knownVals[v.sym] = typeof ref === 'object' ? ref.value : ref;
            return;
        }
        const num = parseFloat(raw);
        if (!isNaN(num)) knownVals[v.sym] = num;
    });

    try {
        /* Use patches16 solver if available, otherwise use a simple eval-based one */
        if (typeof window.p16_solveFor === 'function') {
            block.result = window.p16_solveFor(block.formula, knownVals, block.solveFor);
        } else {
            block.result = _p19_simpleSolve(block.formula, knownVals, block.solveFor);
        }
        if (block.savedAs) {
            migrated.savedValues = migrated.savedValues || {};
            migrated.savedValues[block.savedAs] = { value: block.result };
        }
        _p19_wbSave(migrated);
        p19_wbRender();
    } catch (e) {
        _p19toast('Compute error: ' + (e.message || 'unknown'));
    }
};

/* Minimal fallback solver (bisection) when patches16 isn't available */
function _p19_simpleSolve(formula, knownVals, target) {
    const eq = formula.indexOf('=');
    if (eq < 0) throw new Error('No = in formula');
    const lhs = formula.slice(0, eq).trim();
    const rhs = formula.slice(eq + 1).trim();

    function _prep(expr) {
        return expr.replace(/\^/g, '**')
            .replace(/\bsin\b/g, 'Math.sin')
            .replace(/\bcos\b/g, 'Math.cos')
            .replace(/\btan\b/g, 'Math.tan')
            .replace(/\bsqrt\b/g, 'Math.sqrt')
            .replace(/\babs\b/g, 'Math.abs')
            .replace(/\bpi\b/gi, 'Math.PI')
            .replace(/\be\b/g, 'Math.E');
    }

    const keys = Object.keys(knownVals);
    const vals = Object.values(knownVals);
    /* eslint-disable-next-line no-new-func */
    const fn = new Function(...keys, target, `return (${_prep(lhs)}) - (${_prep(rhs)})`);
    const eval_ = (x) => fn(...vals, x);

    /* Try direct */
    try {
        /* eslint-disable-next-line no-new-func */
        const direct = new Function(...keys, `return ${_prep(lhs === target ? rhs : lhs)}`)(...vals);
        if (isFinite(direct)) return direct;
    } catch {}

    /* Bisection */
    let lo = -1e9, hi = 1e9, mid;
    for (let i = 0; i < 100; i++) {
        mid = (lo + hi) / 2;
        if (Math.abs(eval_(mid)) < 1e-10) return mid;
        if (eval_(lo) * eval_(mid) < 0) hi = mid; else lo = mid;
    }
    return mid;
}

window.p19_wbSaveResult = function(bid) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    const block = (migrated.blocks || []).find(b => b.id === bid);
    if (!block || block.result === null) { _p19toast('Compute the step first'); return; }
    /* Read from the DOM input (data-p19input="saveas") or fall back to block.savedAs */
    const saveAsInp = document.querySelector(`[data-bid="${CSS.escape(bid)}"] [data-p19input="saveas"]`);
    const name = (saveAsInp ? saveAsInp.value.trim() : block.savedAs) || '';
    if (!name) { _p19toast('Enter a name to save as'); return; }
    block.savedAs = name;
    migrated.savedValues = migrated.savedValues || {};
    migrated.savedValues[name] = { value: block.result };
    _p19_wbSave(migrated);
    _p19toast(`@${name} = ${_p19fmt(block.result)} saved`);
    p19_wbRender();
};

window.p19_wbDeleteSaved = function(name) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    delete (migrated.savedValues || {})[name];
    (migrated.blocks || []).forEach(b => { if (b.savedAs === name) b.savedAs = ''; });
    _p19_wbSave(migrated);
    p19_wbRender();
};

window.p19_wbDeleteBlock = function(bid) {
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    migrated.blocks = (migrated.blocks || []).filter(b => b.id !== bid);
    _p19_wbSave(migrated);
    p19_wbRender();
};

window.p19_wbAddBlock = function(type, formulaId) {
    p19_wbClosePicker();
    const ws = _p19_wbGetData();
    const migrated = _p19_wbMigrate(ws);
    migrated.blocks = migrated.blocks || [];

    if (type === 'formula' && formulaId) {
        const f = _p19dbG('os_formulas', []).find(x => x.id === formulaId);
        if (!f) return;
        let vars;
        if (typeof window.p16_detectVars === 'function') {
            vars = window.p16_detectVars(f.formula || '').map(sym => {
                const meta = (f.vars || []).find(v => v.sym === sym) || {};
                return { sym, name: meta.name || sym, value: '' };
            });
        } else {
            vars = (f.formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [])
                .filter(s => !['sin','cos','tan','sqrt','abs','log','pi','e'].includes(s.toLowerCase()))
                .filter((s, i, a) => a.indexOf(s) === i)
                .map(sym => ({ sym, name: sym, value: '' }));
        }
        migrated.blocks.push({
            id: _p19id(), type: 'formula',
            formulaId: f.id, title: f.title, formula: f.formula,
            vars, solveFor: vars[0]?.sym || '',
            result: null, savedAs: '',
        });
    } else if (type === 'heading') {
        migrated.blocks.push({ id: _p19id(), type: 'heading', content: '' });
    } else if (type === 'text') {
        migrated.blocks.push({ id: _p19id(), type: 'text', content: '' });
    } else if (type === 'divider') {
        migrated.blocks.push({ id: _p19id(), type: 'divider' });
    }

    _p19_wbSave(migrated);
    p19_wbRender();

    /* Focus new block */
    setTimeout(() => {
        const board = document.getElementById('p19-ws-board');
        if (!board) return;
        const last = board.querySelector('[data-bid]:last-of-type input, [data-bid]:last-of-type textarea');
        if (last) { last.focus(); last.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }, 80);
};

window.p19_wbClearAll = function() {
    if (!confirm('Clear the entire worksheet?')) return;
    _p19_wbSave({ blocks: [], savedValues: {} });
    p19_wbRender();
};

/* ── picker sheet ────────────────────────────────────────────── */
window.p19_wbOpenPicker = function() {
    let picker = document.getElementById('p19-ws-picker');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'p19-ws-picker';
        picker.innerHTML = `
            <div id="p19-ws-picker-backdrop" onclick="p19_wbClosePicker()"></div>
            <div id="p19-ws-picker-sheet">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <div style="font-size:.88rem;font-weight:700;color:var(--text-main);">Add block</div>
                    <button onclick="p19_wbClosePicker()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.9rem;" class="hover:opacity-70">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="p19-picker-section">
                    <div class="p19-picker-section-hdr">Content blocks</div>
                    <div class="p19-picker-block-types">
                        <button class="p19-picker-type-btn" onclick="p19_wbAddBlock('heading')">
                            <i class="fa-solid fa-heading"></i>Heading
                        </button>
                        <button class="p19-picker-type-btn" onclick="p19_wbAddBlock('text')">
                            <i class="fa-solid fa-align-left"></i>Text note
                        </button>
                        <button class="p19-picker-type-btn" onclick="p19_wbAddBlock('divider')">
                            <i class="fa-solid fa-minus"></i>Divider
                        </button>
                    </div>
                </div>
                <div class="p19-picker-section" id="p19-picker-formulas-sec">
                    <div class="p19-picker-section-hdr">Formula steps — click to add</div>
                    <div class="p19-picker-formula-grid" id="p19-picker-formula-grid"></div>
                </div>
            </div>`;
        document.body.appendChild(picker);
    }

    /* Populate formula grid */
    const grid = document.getElementById('p19-picker-formula-grid');
    if (grid) {
        grid.innerHTML = '';
        const formulas = _p19dbG('os_formulas', []);
        if (!formulas.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:.75rem;color:var(--text-muted);grid-column:1/-1;';
            empty.textContent = 'No formulas yet — add some in the Formulas tab first.';
            grid.appendChild(empty);
        } else {
            formulas.forEach(f => {
                const card = document.createElement('div');
                card.className = 'p19-picker-formula-card';
                card.dataset.fid = f.id;

                const titleEl = document.createElement('div');
                titleEl.className = 'p19-picker-formula-title';
                titleEl.textContent = f.title || '';

                const exprEl = document.createElement('div');
                exprEl.className = 'p19-picker-formula-expr';
                exprEl.textContent = f.formula || '';

                card.appendChild(titleEl);
                card.appendChild(exprEl);
                card.addEventListener('click', () => window.p19_wbAddBlock('formula', f.id));
                grid.appendChild(card);
            });
        }
    }

    requestAnimationFrame(() => picker.classList.add('open'));
};

window.p19_wbClosePicker = function() {
    const picker = document.getElementById('p19-ws-picker');
    if (picker) picker.classList.remove('open');
};

/* ── drag-and-drop reorder ───────────────────────────────────── */
function _p19_wbInitDnD() {
    const board = document.getElementById('p19-ws-board'); if (!board) return;

    let srcBid = null;
    let _ptr = { active: false, srcEl: null, placeholder: null };

    function _getBlocks() { return [...board.querySelectorAll('.p19-ws-block[data-bid]')]; }

    function _startDrag(e, handle) {
        const block = handle.closest('.p19-ws-block'); if (!block) return;
        srcBid = block.dataset.bid;
        block.dataset.dragstate = 'src';
        block.classList.add('drag-src');
        e.dataTransfer && (e.dataTransfer.effectAllowed = 'move');
    }
    function _endDrag() {
        srcBid = null;
        _getBlocks().forEach(b => { b.classList.remove('drag-src', 'drag-over'); delete b.dataset.dragstate; });
    }
    function _dropOn(target) {
        if (!srcBid || !target || target.dataset.bid === srcBid) return;
        const ws = _p19_wbGetData();
        const migrated = _p19_wbMigrate(ws);
        const blocks = migrated.blocks || [];
        const srcIdx = blocks.findIndex(b => b.id === srcBid);
        const dstIdx = blocks.findIndex(b => b.id === target.dataset.bid);
        if (srcIdx < 0 || dstIdx < 0) return;
        const [moved] = blocks.splice(srcIdx, 1);
        blocks.splice(dstIdx, 0, moved);
        _p19_wbSave(migrated);
        p19_wbRender();
    }

    /* Attach events on each handle button */
    board.querySelectorAll('.p19-ws-block-btn.handle').forEach(handle => {
        const block = handle.closest('.p19-ws-block'); if (!block) return;

        /* HTML5 drag (desktop) */
        handle.addEventListener('mousedown', () => { block.draggable = true; });
        handle.addEventListener('mouseup',   () => { block.draggable = false; });
        block.addEventListener('dragstart',  e => _startDrag(e, handle));
        block.addEventListener('dragend',    _endDrag);
        block.addEventListener('dragover',   e => {
            e.preventDefault();
            if (srcBid && block.dataset.bid !== srcBid) block.classList.add('drag-over');
            e.dataTransfer && (e.dataTransfer.dropEffect = 'move');
        });
        block.addEventListener('dragleave',  e => {
            if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
        });
        block.addEventListener('drop',       e => {
            e.preventDefault();
            block.classList.remove('drag-over');
            _dropOn(block);
        });

        /* Touch / pointer events (mobile) */
        handle.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                e.preventDefault();
                handle.setPointerCapture(e.pointerId);
                _ptr.active = true;
                _ptr.srcEl  = block;
                srcBid      = block.dataset.bid;
                block.classList.add('drag-src');
            }
        });
        handle.addEventListener('pointermove', e => {
            if (!_ptr.active) return;
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const target = under?.closest('.p19-ws-block[data-bid]');
            _getBlocks().forEach(b => b.classList.remove('drag-over'));
            if (target && target.dataset.bid !== srcBid) target.classList.add('drag-over');
        });
        handle.addEventListener('pointerup', e => {
            if (!_ptr.active) return;
            _ptr.active = false;
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const target = under?.closest('.p19-ws-block[data-bid]');
            if (target) _dropOn(target);
            _endDrag();
        });
        handle.addEventListener('pointercancel', _endDrag);
    });
}

/* ── inject whiteboard into existing worksheet view ─────────── */
function _p19_injectWhiteboard() {
    function _try() {
        const view = document.getElementById('view-worksheet');
        if (!view) { setTimeout(_try, 1000); return; }
        if (view.querySelector('#p19-ws-board')) return; /* already injected */

        /* Mark view as whiteboard-active (CSS hides old layout) */
        view.classList.add('p19-ws-active');

        /* Hide old toolbar if present */
        const oldToolbar = view.querySelector('.flex.items-center.justify-between.mb-3');
        if (oldToolbar) oldToolbar.style.display = 'none';

        /* Build new toolbar */
        const toolbar = document.createElement('div');
        toolbar.id = 'p19-ws-toolbar';
        toolbar.innerHTML = `
            <div style="flex:1;">
                <span style="font-size:1.5rem;font-weight:300;color:var(--text-main);">Worksheet</span>
            </div>
            <button class="p19-ws-tb-btn" onclick="p19_wbOpenPicker()">
                <i class="fa-solid fa-plus"></i> Add block
            </button>
            <button class="p19-ws-tb-btn danger" onclick="p19_wbClearAll()">
                <i class="fa-solid fa-trash-can"></i> Clear
            </button>`;

        /* Saved-values bar */
        const svBar = document.createElement('div');
        svBar.id = 'p19-ws-sv-bar';

        /* Main board */
        const board = document.createElement('div');
        board.id = 'p19-ws-board';

        view.prepend(board);
        view.prepend(svBar);
        view.prepend(toolbar);

        p19_wbRender();
    }
    _try();
}

/* Patch switchTab so worksheet always uses the whiteboard */
function _p19_patchSwitchTabWs() {
    function _try() {
        if (typeof window.switchTab !== 'function' || window._p19stWsDone) {
            setTimeout(_try, 400);
            return;
        }
        window._p19stWsDone = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            if (name === 'worksheet') {
                setTimeout(() => {
                    _p19_injectWhiteboard();
                    p19_wbRender();
                }, 80);
            }
        };
    }
    _try();
}

/* ================================================================
   3.  FORMULA MODAL — minimal variable rows
       Hide category and unit selects (handled by patches19.css).
       The JS here only forces a re-clean when the modal opens,
       since patches17 moves elements around in the DOM.
   ================================================================ */
function _p19_simplifyFormulaModal() {
    function _clean() {
        const modal = document.getElementById('modal-formula'); if (!modal) return;
        modal.querySelectorAll('.p16-fv-ci, .p16-fv-ui').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        modal.querySelectorAll('.p16-fv-row').forEach(row => {
            row.style.gridTemplateColumns = '48px 1fr 26px';
        });
    }
    const modal = document.getElementById('modal-formula');
    if (modal) {
        new MutationObserver(_clean).observe(modal, { childList: true, subtree: true });
        _clean();
    } else {
        setTimeout(_p19_simplifyFormulaModal, 1200);
    }
}

/* ================================================================
   4.  TASK DRAG-AND-DROP — pointer event fallback
       Augments patches18's HTML5 DnD with a pointer-events
       implementation that works on touch screens.
   ================================================================ */
function _p19_taskDnDPointer() {
    let _src = null;
    let _moved = false;

    function _getList() { return document.getElementById('full-task-list'); }

    function _attachPointer(row) {
        const handle = row.querySelector('.task-drag-handle');
        if (!handle || handle.dataset.p19pe) return;
        handle.dataset.p19pe = '1';

        handle.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            _src = row;
            _moved = false;
            row.dataset.dragstate = 'src';
        });

        handle.addEventListener('pointermove', e => {
            if (!_src || _src !== row) return;
            _moved = true;
            const list = _getList(); if (!list) return;
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const target = under?.closest('.task-row');
            list.querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = r === _src ? 'src' : ''; });
            if (target && target !== _src && list.contains(target)) target.dataset.dragstate = 'over';
        });

        handle.addEventListener('pointerup', e => {
            if (!_src || _src !== row || !_moved) { _src = null; _moved = false; return; }
            const list = _getList(); if (!list) return;
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const target = under?.closest('.task-row');
            if (target && target !== _src && list.contains(target)) {
                const siblings = [...list.querySelectorAll('.task-row')];
                if (siblings.indexOf(_src) < siblings.indexOf(target))
                    list.insertBefore(_src, target.nextSibling);
                else
                    list.insertBefore(_src, target);
                /* Persist order — re-use p18 helper if available */
                try {
                    const ids = [...list.querySelectorAll('.task-row')]
                        .map(r => r.id?.replace('task-row-', '')).filter(Boolean);
                    localStorage.setItem('p18_task_order', JSON.stringify(ids));
                } catch {}
            }
            list.querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = ''; });
            _src = null; _moved = false;
        });

        handle.addEventListener('pointercancel', () => {
            if (_getList()) _getList().querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = ''; });
            _src = null; _moved = false;
        });
    }

    function _attachAll() {
        const list = _getList(); if (!list) return;
        list.querySelectorAll('.task-row').forEach(row => _attachPointer(row));
    }

    /* Re-attach whenever the task list re-renders */
    function _watch() {
        const list = _getList();
        if (!list) { setTimeout(_watch, 900); return; }
        new MutationObserver(_attachAll).observe(list, { childList: true });
        _attachAll();
    }
    _watch();
}

/* ================================================================
   5.  AVATAR SYNC — reliable large preview in Settings
   ================================================================ */
function _p19_avatarSync() {
    function _sync() {
        const src = document.getElementById('avatar-preview'); if (!src) return;
        ['p16-settings-avatar', 'p10-avatar-preview-tab'].forEach(id => {
            const dst = document.getElementById(id); if (!dst) return;
            dst.innerHTML     = src.innerHTML;
            dst.style.background = src.style.background || 'var(--accent)';
            dst.style.setProperty('width',     '80px', 'important');
            dst.style.setProperty('height',    '80px', 'important');
            dst.style.setProperty('font-size', '2.2rem', 'important');
        });
    }

    function _patchRPD() {
        if (typeof window.renderProfileDisplay !== 'function' || window._p19rpdDone) {
            setTimeout(_patchRPD, 500);
            return;
        }
        window._p19rpdDone = true;
        const _orig = window.renderProfileDisplay;
        window.renderProfileDisplay = function() { _orig(); setTimeout(_sync, 80); };
    }

    /* Sync on settings modal open */
    function _watchSettings() {
        const modal = document.getElementById('modal-settings');
        if (!modal) { setTimeout(_watchSettings, 900); return; }
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) setTimeout(_sync, 150);
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
        _sync();
    }

    _patchRPD();
    _watchSettings();
}

/* ================================================================
   6.  ROUTINE POLISH — ensure done-buttons & progress bar survive
       re-renders triggered by patches17/18
   ================================================================ */
function _p19_routinePolish() {
    /* Patches18 already handles routine done-buttons, but the
       MutationObserver from p18 sometimes fires before p19 is ready.
       We simply re-call its helpers after any view-routine mutation. */
    function _watch() {
        const view = document.getElementById('view-routine');
        if (!view) { setTimeout(_watch, 1000); return; }
        new MutationObserver(() => {
            if (typeof window._p18_renderRoutineProgress === 'function')
                setTimeout(window._p18_renderRoutineProgress, 60);
        }).observe(view, { childList: true, subtree: true });
    }
    _watch();
}

/* ================================================================
   7.  RE-RENDER GUARD
       Merged into _p19_patchSwitchTabWs above; no-op kept for
       clarity.
   ================================================================ */
function _p19_reRenderGuard() {
    /* Handled in _p19_patchSwitchTabWs */
}

/* ================================================================
   INIT
   ================================================================ */
(function _p19init() {
    const go = () => {
        _p19_fixBgTint();
        _p19_injectWhiteboard();
        _p19_patchSwitchTabWs();
        _p19_simplifyFormulaModal();
        _p19_taskDnDPointer();
        _p19_avatarSync();
        _p19_routinePolish();
        _p19_reRenderGuard();
        console.log('[patches19] loaded — bg tint fix, worksheet whiteboard, formula modal cleanup, task DnD touch, avatar sync');
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', () => setTimeout(go, 1300))
        : setTimeout(go, 1300);
})();
