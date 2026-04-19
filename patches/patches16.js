/* ================================================================
   StudentOS — patches16.js
   NEW FEATURES:
   1. Background gradient — more visible (CSS only, patches16.css)
   2. Formula solver — calculate missing variable, units, constants
   3. Formula variable metadata (extends formula add/edit modal)
   4. Sidebar navigation item hiding (settings section)
   5. Routine planner tab (weekly schedule builder)
   6. Attendance tracker tab (class attendance)
   7. Worksheet tab (chained formula workflow)
   8. Small avatar preview in Settings modal
   ================================================================ */

/* ── helpers ── */
const _p16lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p16lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p16dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p16lsG(k, d); } catch { return d; } };
const _p16dbS = (k, v) => { window.DB?.set ? window.DB.set(k, v) : _p16lsS(k, v); };
const _p16esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p16id  = () => Math.random().toString(36).slice(2, 10);
const _p16toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };
const _p16date = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

/* ================================================================
   PHYSICS CONSTANTS
   ================================================================ */
const P16_CONSTANTS = {
    G:        { value: 6.674e-11,       label: 'Gravitational Constant', sym: 'G',    unit: 'm\u00b3/(kg\u00b7s\u00b2)' },
    k_B:      { value: 1.380649e-23,    label: 'Boltzmann Constant',     sym: 'k_B',  unit: 'J/K' },
    h_P:      { value: 6.62607015e-34,  label: 'Planck Constant',        sym: 'h',    unit: 'J\u00b7s' },
    hbar:     { value: 1.054571817e-34, label: 'Reduced Planck (\u210f)', sym: '\u210f', unit: 'J\u00b7s' },
    c_light:  { value: 299792458,       label: 'Speed of Light',         sym: 'c',    unit: 'm/s' },
    N_A:      { value: 6.02214076e23,   label: 'Avogadro Number',        sym: 'N_A',  unit: 'mol\u207b\u00b9' },
    R_gas:    { value: 8.314462,        label: 'Gas Constant',           sym: 'R',    unit: 'J/(mol\u00b7K)' },
    e_charge: { value: 1.602176634e-19, label: 'Elementary Charge',      sym: 'e',    unit: 'C' },
    eps0:     { value: 8.8541878128e-12,label: 'Vacuum Permittivity',    sym: '\u03b50', unit: 'F/m' },
    mu0:      { value: 1.25663706212e-6,label: 'Vacuum Permeability',    sym: '\u03bc0', unit: 'H/m' },
    g_acc:    { value: 9.80665,         label: 'Standard Gravity',       sym: 'g',    unit: 'm/s\u00b2' },
    sigma_sb: { value: 5.670374419e-8,  label: 'Stefan-Boltzmann',       sym: '\u03c3', unit: 'W/(m\u00b2\u00b7K\u2074)' },
    m_e:      { value: 9.1093837015e-31,label: 'Electron Mass',          sym: 'm_e',  unit: 'kg' },
    m_p:      { value: 1.67262192369e-27,label:'Proton Mass',            sym: 'm_p',  unit: 'kg' },
    u_amu:    { value: 1.66053906660e-27,label:'Atomic Mass Unit',       sym: 'u',    unit: 'kg' },
};

/* ================================================================
   UNIT CATEGORIES — conversion factors to SI base unit
   Special strings 'T_C' and 'T_F' trigger offset conversion.
   ================================================================ */
const P16_UNIT_CATS = {
    mass:         { base: 'kg',    label: 'Mass',         units: { kg:1, g:1e-3, mg:1e-6, lb:0.453592, oz:0.028349, t:1000 } },
    length:       { base: 'm',     label: 'Length',       units: { m:1, km:1e3, cm:1e-2, mm:1e-3, ft:0.3048, inch:0.0254, mi:1609.34, nm:1e-9 } },
    time:         { base: 's',     label: 'Time',         units: { s:1, ms:1e-3, min:60, h:3600, day:86400 } },
    force:        { base: 'N',     label: 'Force',        units: { N:1, kN:1e3, MN:1e6, lbf:4.44822 } },
    energy:       { base: 'J',     label: 'Energy',       units: { J:1, kJ:1e3, MJ:1e6, cal:4.184, kcal:4184, eV:1.602e-19, Wh:3600 } },
    power:        { base: 'W',     label: 'Power',        units: { W:1, kW:1e3, MW:1e6, hp:745.7, mW:1e-3 } },
    pressure:     { base: 'Pa',    label: 'Pressure',     units: { Pa:1, kPa:1e3, MPa:1e6, atm:101325, bar:1e5, mmHg:133.322, psi:6894.76 } },
    temperature:  { base: 'K',     label: 'Temperature',  units: { K:1, C:'T_C', F:'T_F' } },
    velocity:     { base: 'm/s',   label: 'Velocity',     units: { 'm/s':1, 'km/h':1/3.6, 'mph':0.44704, 'ft/s':0.3048 } },
    acceleration: { base: 'm/s\u00b2', label: 'Accel.',  units: { 'm/s\u00b2':1, 'g':9.80665, 'ft/s\u00b2':0.3048 } },
    frequency:    { base: 'Hz',    label: 'Frequency',    units: { Hz:1, kHz:1e3, MHz:1e6, GHz:1e9 } },
    voltage:      { base: 'V',     label: 'Voltage',      units: { V:1, mV:1e-3, kV:1e3 } },
    current:      { base: 'A',     label: 'Current',      units: { A:1, mA:1e-3, uA:1e-6 } },
    resistance:   { base: '\u03a9',label: 'Resistance',   units: { '\u03a9':1, 'k\u03a9':1e3, 'M\u03a9':1e6 } },
    charge:       { base: 'C',     label: 'Charge',       units: { C:1, mC:1e-3, uC:1e-6, nC:1e-9 } },
    angle:        { base: 'rad',   label: 'Angle',        units: { rad:1, deg:Math.PI/180 } },
    area:         { base: 'm\u00b2',label:'Area',          units: { 'm\u00b2':1, 'cm\u00b2':1e-4, 'mm\u00b2':1e-6, 'ft\u00b2':0.0929 } },
    volume:       { base: 'm\u00b3',label:'Volume',        units: { 'm\u00b3':1, L:1e-3, mL:1e-6, 'cm\u00b3':1e-6 } },
    dimensionless:{ base: '',      label: 'Dimensionless', units: { '\u2014':1 } },
};

function p16_toSI(value, cat, unit) {
    const c = P16_UNIT_CATS[cat]; if (!c) return +value;
    const f = c.units[unit];      if (f === undefined) return +value;
    if (f === 'T_C') return +value + 273.15;
    if (f === 'T_F') return (+value - 32) * 5/9 + 273.15;
    return +value * f;
}
function p16_fromSI(si, cat, unit) {
    const c = P16_UNIT_CATS[cat]; if (!c) return si;
    const f = c.units[unit];      if (f === undefined) return si;
    if (f === 'T_C') return si - 273.15;
    if (f === 'T_F') return (si - 273.15) * 9/5 + 32;
    return si / f;
}
function p16_fmt(n) {
    if (!isFinite(n)) return String(n);
    const a = Math.abs(n);
    if (a === 0) return '0';
    if (a >= 1e6 || (a < 1e-3 && a > 0)) return n.toExponential(4);
    return parseFloat(n.toPrecision(6)).toString();
}
/* Validate a colour is a safe CSS hex literal before embedding in style attributes */
function _p16safeColor(c) {
    return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#3b82f6';
}

/* ================================================================
   MATH PREPROCESSOR & NUMERICAL SOLVER
   ================================================================ */
const P16_MATHFNS = new Set(['sin','cos','tan','asin','acos','atan','atan2','sqrt','abs',
    'log','ln','log10','exp','ceil','floor','round','min','max','PI','pi','Math','pow']);

function p16_prep(expr) {
    return expr
        .replace(/\^/g,      '**')
        .replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)')
        .replace(/√([a-zA-Z0-9_.]+)/g, 'Math.sqrt($1)')
        .replace(/\bsqrt\s*\(/g,  'Math.sqrt(')
        .replace(/\babs\s*\(/g,   'Math.abs(')
        .replace(/\bsin\s*\(/g,   'Math.sin(')
        .replace(/\bcos\s*\(/g,   'Math.cos(')
        .replace(/\btan\s*\(/g,   'Math.tan(')
        .replace(/\basin\s*\(/g,  'Math.asin(')
        .replace(/\bacos\s*\(/g,  'Math.acos(')
        .replace(/\batan2\s*\(/g, 'Math.atan2(')
        .replace(/\batan\s*\(/g,  'Math.atan(')
        .replace(/\bln\s*\(/g,    'Math.log(')
        .replace(/\blog10\s*\(/g, 'Math.log10(')
        .replace(/\blog\s*\(/g,   'Math.log10(')
        .replace(/\bexp\s*\(/g,   'Math.exp(')
        .replace(/\bPI\b/g,       'Math.PI')
        .replace(/\bpi\b/g,       'Math.PI');
}

function p16_detectVars(formula) {
    const constKeys = new Set(Object.keys(P16_CONSTANTS));
    const tokens = (formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []);
    const seen = new Set(), result = [];
    for (const t of tokens) {
        if (seen.has(t) || P16_MATHFNS.has(t) || constKeys.has(t)) continue;
        seen.add(t); result.push(t);
    }
    return result;
}

function p16_buildPreamble(knownVals, skip) {
    const constLines = Object.entries(P16_CONSTANTS)
        .map(([k, c]) => `const ${k} = ${c.value};`).join('\n');
    const knownLines = Object.entries(knownVals)
        .filter(([k]) => k !== skip)
        .map(([k, v]) => `const ${k} = ${Number(v)};`).join('\n');
    return constLines + '\n' + knownLines;
}

function p16_newton(fnSrc, targetVar, x0) {
    const f = new Function(targetVar, fnSrc);
    let x = x0, H = 1e-8;
    for (let i = 0; i < 3000; i++) {
        let fx; try { fx = f(x); } catch { x = (Math.random()-.5)*100; continue; }
        if (!isFinite(fx)) { x = (Math.random()-.5)*100; continue; }
        if (Math.abs(fx) < 1e-9) return x;
        const h = Math.max(Math.abs(x)*H, H);
        let df; try { df = (f(x+h)-f(x-h))/(2*h); } catch { df = 0; }
        if (!isFinite(df) || Math.abs(df)<1e-20) { x += (Math.random()-.5)*10; continue; }
        const step = fx/df;
        x -= Math.max(Math.min(step,1e8),-1e8);
        if (!isFinite(x)) x = (Math.random()-.5)*100;
    }
    throw new Error('Solver did not converge. Check values or formula.');
}

function p16_solveFor(formula, knownVals, targetVar) {
    const eq = formula.indexOf('=');
    if (eq < 0) throw new Error('Formula must contain "=" (e.g. F = m * a)');
    const lhsP = p16_prep(formula.slice(0, eq).trim());
    const rhsP = p16_prep(formula.slice(eq+1).trim());
    const pre  = p16_buildPreamble(knownVals, targetVar);
    if (lhsP === targetVar) { const fn = new Function(`${pre}\nreturn (${rhsP});`); const r = fn(); if (!isFinite(r)) throw new Error('Result not finite — check values'); return r; }
    if (rhsP === targetVar) { const fn = new Function(`${pre}\nreturn (${lhsP});`); const r = fn(); if (!isFinite(r)) throw new Error('Result not finite — check values'); return r; }
    const src = `${pre}\nreturn (${lhsP})-(${rhsP});`;
    const guesses = [1,-1,10,-10,100,-100,0.1,1e4,-1e4,0.001];
    let lastErr;
    for (const g of guesses) { try { return p16_newton(src, targetVar, g); } catch(e) { lastErr = e; } }
    throw lastErr || new Error('Could not solve');
}

/* ================================================================
   FORMULA SOLVER MODAL
   ================================================================ */
let _p16_slvFid    = null;
let _p16_slvTarget = null;
let _p16_slvVars   = [];

function _p16_injectSolverModal() {
    if (document.getElementById('modal-formula-solve')) return;
    const ov = document.getElementById('modal-overlay'); if (!ov) return;
    const m = document.createElement('div');
    m.id        = 'modal-formula-solve';
    m.className = 'hidden modal-panel min-card p-0 bg-[var(--bg-color)] border border-[var(--glass-border)] max-h-[90vh] overflow-hidden flex flex-col';
    m.style.width = '520px';
    m.innerHTML = `
        <div class="px-7 py-5 border-b border-[var(--glass-border)] flex justify-between items-center flex-shrink-0">
            <div>
                <h3 class="text-lg font-medium" id="p16-slv-title">Solve Formula</h3>
                <div id="p16-slv-expr" style="font-size:.72rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-top:2px;"></div>
            </div>
            <button onclick="closeModals()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;" class="hover:opacity-70 transition"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="overflow-y-auto flex-1 px-7 py-5">
            <div class="text-xs uppercase tracking-widest font-bold mb-3" style="color:var(--text-muted);">
                Variables — click <i class="fa-solid fa-question" style="font-size:.6rem;"></i> to mark the unknown
            </div>
            <div id="p16-slv-vars"></div>
            <div class="mt-5">
                <button class="p16-const-toggle" onclick="p16_toggleConst()">
                    <i class="fa-solid fa-atom" style="color:var(--accent);font-size:.75rem;"></i>
                    Physics Constants Reference
                    <i class="fa-solid fa-chevron-down" id="p16-const-chev" style="font-size:.58rem;margin-left:auto;transition:transform .2s;"></i>
                </button>
                <div id="p16-const-list" class="p16-const-list" style="display:none;"></div>
            </div>
            <div id="p16-slv-err" class="mt-3 text-xs p-3 rounded-xl hidden" style="background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);"></div>
            <div id="p16-slv-result" class="mt-4 hidden"></div>
        </div>
        <div class="px-7 py-4 border-t border-[var(--glass-border)] flex gap-3 flex-shrink-0">
            <button onclick="p16_solve()" class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style="background:var(--accent);">
                <i class="fa-solid fa-calculator" style="margin-right:6px;"></i>Solve
            </button>
            <button onclick="closeModals()" class="px-5 py-2.5 rounded-xl text-sm" style="background:var(--glass-hover);color:var(--text-muted);">
                Close
            </button>
        </div>`;
    ov.appendChild(m);
    // populate constants
    const cl = m.querySelector('#p16-const-list');
    if (cl) cl.innerHTML = Object.entries(P16_CONSTANTS).map(([, c]) =>
        `<div class="p16-const-item" title="${c.label}: ${c.value} ${c.unit}">
            <span class="ci-sym">${_p16esc(c.sym)}</span>
            <span class="ci-lbl">${_p16esc(c.label)}</span>
            <span class="ci-val">${c.value < 1e-4 || c.value > 1e6 ? c.value.toExponential(3) : c.value} ${_p16esc(c.unit)}</span>
        </div>`
    ).join('');
}

window.p16_toggleConst = function() {
    const l = document.getElementById('p16-const-list');
    const ch = document.getElementById('p16-const-chev');
    if (!l) return;
    const open = l.style.display !== 'none';
    l.style.display = open ? 'none' : 'grid';
    if (ch) ch.style.transform = open ? '' : 'rotate(180deg)';
};

window.p16_openSolver = function(fid) {
    _p16_injectSolverModal();
    const formulas = _p16dbG('os_formulas', []);
    const f = formulas.find(x => x.id === fid);
    if (!f) { _p16toast('Formula not found'); return; }
    _p16_slvFid = fid;
    document.getElementById('p16-slv-title').textContent = f.title || 'Solve';
    document.getElementById('p16-slv-expr').textContent  = f.formula || '';
    const detected  = p16_detectVars(f.formula || '');
    const savedVars = f.vars || [];
    _p16_slvVars = detected.map(sym => {
        const meta = savedVars.find(v => v.sym === sym) || {};
        return { sym, name: meta.name || sym, cat: meta.cat || 'dimensionless', unit: meta.unit || '' };
    });
    _p16_slvTarget = _p16_slvVars[0]?.sym || null;
    _p16_renderSolverVars();
    const err = document.getElementById('p16-slv-err'); if (err) err.classList.add('hidden');
    const res = document.getElementById('p16-slv-result'); if (res) res.classList.add('hidden');
    if (typeof openModal === 'function') openModal('modal-formula-solve');
};

function _p16_renderSolverVars() {
    const el = document.getElementById('p16-slv-vars'); if (!el) return;
    el.innerHTML = _p16_slvVars.map(v => {
        const catDef = P16_UNIT_CATS[v.cat] || P16_UNIT_CATS.dimensionless;
        const uOpts  = Object.keys(catDef.units).map(u =>
            `<option value="${_p16esc(u)}" ${u === v.unit ? 'selected' : ''}>${_p16esc(u)}</option>`).join('');
        const isSolve = v.sym === _p16_slvTarget;
        return `<div class="p16-var-row">
            <div>
                <div class="p16-var-sym">${_p16esc(v.sym)}</div>
                <div class="p16-var-name">${_p16esc(v.name)}</div>
            </div>
            <input type="number" step="any" class="p16-var-input" id="p16-vi-${_p16esc(v.sym)}"
                placeholder="${isSolve ? 'will be solved\u2026' : 'enter value\u2026'}"
                ${isSolve ? 'disabled style="opacity:.45;"' : ''}>
            <select class="p16-var-unit" id="p16-vu-${_p16esc(v.sym)}">${uOpts}</select>
            <button class="p16-var-solve-btn${isSolve ? ' active' : ''}"
                onclick="p16_setTarget('${_p16esc(v.sym)}')" title="Solve for ${_p16esc(v.sym)}">
                <i class="fa-solid fa-question"></i>
            </button>
        </div>`;
    }).join('');
}

window.p16_setTarget = function(sym) {
    _p16_slvTarget = sym;
    _p16_renderSolverVars();
    const res = document.getElementById('p16-slv-result'); if (res) res.classList.add('hidden');
};

window.p16_solve = function() {
    const errEl = document.getElementById('p16-slv-err');
    const resEl = document.getElementById('p16-slv-result');
    errEl.classList.add('hidden'); resEl.classList.add('hidden');
    if (!_p16_slvTarget) { errEl.textContent='Select the unknown variable first (click ?)'; errEl.classList.remove('hidden'); return; }
    const formulas = _p16dbG('os_formulas', []);
    const f = formulas.find(x => x.id === _p16_slvFid);
    if (!f) return;
    const knownVals = {};
    for (const v of _p16_slvVars) {
        if (v.sym === _p16_slvTarget) continue;
        const inp = document.getElementById('p16-vi-' + v.sym);
        const raw = inp ? inp.value.trim() : '';
        if (raw === '') continue;
        const us  = document.getElementById('p16-vu-' + v.sym);
        const unit = us ? us.value : (P16_UNIT_CATS[v.cat]?.base ?? '');
        knownVals[v.sym] = p16_toSI(parseFloat(raw), v.cat, unit);
    }
    try {
        const siResult = p16_solveFor(f.formula, knownVals, _p16_slvTarget);
        const tMeta    = _p16_slvVars.find(v => v.sym === _p16_slvTarget) || {};
        const outUnitSel = document.getElementById('p16-vu-' + _p16_slvTarget);
        const outUnit    = outUnitSel ? outUnitSel.value : (P16_UNIT_CATS[tMeta.cat]?.base ?? '');
        const displayed  = p16_fromSI(siResult, tMeta.cat, outUnit);
        const siBase     = P16_UNIT_CATS[tMeta.cat]?.base ?? '';
        window._p16LastResult = { sym: _p16_slvTarget, value: siResult, unit: siBase };
        resEl.innerHTML = `<div class="p16-result-box">
            <div class="p16-result-lbl">Result</div>
            <div><span class="p16-result-val">${p16_fmt(displayed)}</span><span class="p16-result-unit">${_p16esc(outUnit)}</span></div>
            ${siBase && siBase !== outUnit ? `<div style="font-size:.68rem;color:var(--text-muted);margin-top:2px;">${_p16esc(_p16_slvTarget)} = ${p16_fmt(siResult)} ${_p16esc(siBase)} (SI)</div>` : ''}
            <div class="p16-result-saverow">
                <input type="text" id="p16-save-name" class="p16-var-input" style="flex:1;"
                    placeholder="Save as name (for worksheet)\u2026" value="${_p16esc(_p16_slvTarget)}">
                <button onclick="p16_saveToWS()" class="p16-fv-btn" style="padding:5px 11px;height:auto;">
                    <i class="fa-solid fa-bookmark" style="margin-right:4px;"></i>Save
                </button>
            </div>
        </div>`;
        resEl.classList.remove('hidden');
    } catch(e) {
        errEl.textContent = e.message || 'Solve failed';
        errEl.classList.remove('hidden');
    }
};

window.p16_saveToWS = function() {
    const nameEl = document.getElementById('p16-save-name');
    const name   = nameEl ? nameEl.value.trim() : (_p16_slvTarget || '');
    if (!name || !window._p16LastResult) return;
    const ws = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    ws.savedValues[name] = { value: window._p16LastResult.value, unit: window._p16LastResult.unit };
    _p16dbS('os_worksheet', ws);
    _p16toast(`"${name}" = ${p16_fmt(window._p16LastResult.value)} saved to worksheet`);
};

/* ── Add Solve button to every formula card (MutationObserver) ── */
function _p16_watchFormulaList() {
    function _attach(list) {
        list.querySelectorAll('.formula-card:not([data-p16s])').forEach(card => {
            card.dataset.p16s = '1';
            const acts = card.querySelector('.formula-card-actions'); if (!acts) return;
            const editBtn = acts.querySelector('[onclick*="formulaEdit"]'); if (!editBtn) return;
            const m = editBtn.getAttribute('onclick').match(/formulaEdit\(['"]([^'"]+)['"]\)/); if (!m) return;
            const btn = document.createElement('button');
            btn.title   = 'Solve for variable';
            btn.innerHTML = '<i class="fa-solid fa-calculator"></i>';
            btn.onclick = () => p16_openSolver(m[1]);
            acts.insertBefore(btn, acts.firstChild);
        });
    }
    function _try() {
        const l = document.getElementById('formula-list');
        if (!l) { setTimeout(_try, 1000); return; }
        _attach(l);
        new MutationObserver(() => _attach(l)).observe(l, { childList: true });
    }
    _try();
}

/* ================================================================
   FORMULA MODAL — VARIABLE METADATA SECTION
   ================================================================ */
function _p16_enhanceFormulaModal() {
    function _try() {
        const modal = document.getElementById('modal-formula');
        if (!modal || window._p16_fmDone) { setTimeout(_try, 700); return; }
        window._p16_fmDone = true;

        // Observe modal becoming visible
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden') && !modal.querySelector('.p16-formula-vars')) {
                _p16_injectVarSection(modal, []);
            }
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });

        // Patch formulaOpenModal to pre-fill saved vars
        const origOpen = window.formulaOpenModal;
        if (origOpen && !window._p16_foP) {
            window._p16_foP = true;
            window.formulaOpenModal = function(id) {
                origOpen(id);
                setTimeout(() => {
                    let vars = [];
                    if (id) {
                        const f = _p16dbG('os_formulas', []).find(x => x.id === id);
                        if (f) vars = f.vars || [];
                    }
                    let section = modal.querySelector('.p16-formula-vars');
                    if (!section) { _p16_injectVarSection(modal, vars); }
                    else { _p16_populateVars(section, vars); }
                    if (!vars.length) p16_autoDetectVars();
                }, 60);
            };
        }

        // Patch formulaSave to persist var metadata
        const origSave = window.formulaSave;
        if (origSave && !window._p16_fsP) {
            window._p16_fsP = true;
            window.formulaSave = function() {
                const vars  = _p16_collectModalVars();
                const rawId = document.getElementById('formula-modal-id')?.value;
                origSave();
                setTimeout(() => {
                    const title = document.getElementById('formula-modal-title')?.value?.trim();
                    const items = _p16dbG('os_formulas', []);
                    const f = rawId ? items.find(x => x.id === rawId) : items.find(x => x.title === title);
                    if (f && vars.length) { f.vars = vars; _p16dbS('os_formulas', items); }
                }, 120);
            };
        }
    }
    _try();
}

function _p16_injectVarSection(modal, vars) {
    const ta = modal.querySelector('#formula-modal-formula'); if (!ta) return;
    const sec = document.createElement('div');
    sec.className = 'p16-formula-vars';
    sec.innerHTML = `
        <div class="p16-fv-header">
            <div class="p16-fv-title"><i class="fa-solid fa-tags" style="margin-right:5px;color:var(--accent);"></i>Variables & Units</div>
            <button class="p16-fv-btn" onclick="p16_autoDetectVars()">
                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right:3px;"></i>Detect
            </button>
        </div>
        <div id="p16-fv-rows"></div>`;
    ta.parentElement.insertBefore(sec, ta.nextSibling);
    _p16_populateVars(sec, vars);
}

window.p16_autoDetectVars = function() {
    const ta  = document.getElementById('formula-modal-formula'); if (!ta) return;
    const modal = document.getElementById('modal-formula'); if (!modal) return;
    const detected = p16_detectVars(ta.value || '');
    let sec = modal.querySelector('.p16-formula-vars');
    if (!sec) { _p16_injectVarSection(modal, []); sec = modal.querySelector('.p16-formula-vars'); }
    if (!sec) return;
    const existing = _p16_collectModalVars();
    const existMap = {}; existing.forEach(v => { existMap[v.sym] = v; });
    const merged   = detected.map(sym => existMap[sym] || { sym, name: sym, cat: 'dimensionless', unit: '' });
    _p16_populateVars(sec, merged);
};

function _p16_populateVars(section, vars) {
    const rows = section.querySelector('#p16-fv-rows'); if (!rows) return;
    const catOpts = Object.entries(P16_UNIT_CATS)
        .map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('');
    rows.innerHTML = (vars || []).map(v => {
        const catDef = P16_UNIT_CATS[v.cat || 'dimensionless'] || P16_UNIT_CATS.dimensionless;
        const uOpts  = Object.keys(catDef.units).map(u =>
            `<option value="${_p16esc(u)}" ${v.unit === u ? 'selected' : ''}>${_p16esc(u)}</option>`).join('');
        const catOptsSelected = Object.entries(P16_UNIT_CATS)
            .map(([k, c]) => `<option value="${k}" ${v.cat === k ? 'selected' : ''}>${c.label}</option>`).join('');
        return `<div class="p16-fv-row" data-sym="${_p16esc(v.sym)}">
            <div class="p16-fv-sym-lbl">${_p16esc(v.sym)}</div>
            <input type="text" class="bare-input p16-fv-ni" value="${_p16esc(v.name||v.sym)}" placeholder="Name" style="font-size:.78rem;">
            <select class="p16-var-unit p16-fv-ci" onchange="p16_refreshUnits(this)">${catOptsSelected}</select>
            <select class="p16-var-unit p16-fv-ui">${uOpts}</select>
            <button class="p16-fv-del" onclick="this.closest('.p16-fv-row').remove()" title="Remove">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;
    }).join('');
}

window.p16_refreshUnits = function(catSel) {
    const row = catSel.closest('.p16-fv-row'); if (!row) return;
    const uSel   = row.querySelector('.p16-fv-ui'); if (!uSel) return;
    const catDef = P16_UNIT_CATS[catSel.value] || P16_UNIT_CATS.dimensionless;
    uSel.innerHTML = Object.keys(catDef.units).map(u => `<option value="${u}">${u}</option>`).join('');
};

function _p16_collectModalVars() {
    return [...document.querySelectorAll('#modal-formula .p16-fv-row')].map(r => ({
        sym:  r.dataset.sym || '',
        name: (r.querySelector('.p16-fv-ni')?.value || '').trim(),
        cat:  r.querySelector('.p16-fv-ci')?.value || 'dimensionless',
        unit: r.querySelector('.p16-fv-ui')?.value || '',
    })).filter(v => v.sym);
}

/* ================================================================
   SIDEBAR NAVIGATION HIDING
   ================================================================ */
const P16_NAV_ITEMS = [
    { id:'tasks',      label:'Tasks',        icon:'fa-check-circle'   },
    { id:'calendar',   label:'Calendar',     icon:'fa-calendar-alt'   },
    { id:'notes',      label:'Notes',        icon:'fa-book'           },
    { id:'whiteboard', label:'Whiteboard',   icon:'fa-pencil'         },
    { id:'cards',      label:'Flashcards',   icon:'fa-clone'          },
    { id:'grades',     label:'Grades',       icon:'fa-chart-bar'      },
    { id:'calc',       label:'Calculator',   icon:'fa-calculator'     },
    { id:'focus',      label:'Focus Timer',  icon:'fa-hourglass-half' },
    { id:'music',      label:'Music',        icon:'fa-music'          },
    { id:'formulas',   label:'Formulas',     icon:'fa-square-root-alt'},
    { id:'forum',      label:'Forum',        icon:'fa-comments'       },
    { id:'routine',    label:'Routine',      icon:'fa-calendar-week'  },
    { id:'attendance', label:'Attendance',   icon:'fa-user-check'     },
    { id:'worksheet',  label:'Worksheet',    icon:'fa-layer-group'    },
];

function _p16_applyNavHide() {
    const hidden = _p16lsG('p16_nav_hidden', []);
    P16_NAV_ITEMS.forEach(item => {
        const btn = document.getElementById('btn-' + item.id);
        if (btn) btn.style.display = hidden.includes(item.id) ? 'none' : '';
    });
}

function _p16_injectNavSettings() {
    function _try() {
        const modal = document.getElementById('modal-settings');
        if (!modal || document.getElementById('p16-nav-settings-section')) { setTimeout(_try, 900); return; }
        const hidden  = _p16lsG('p16_nav_hidden', []);
        const content = modal.querySelector('.overflow-y-auto'); if (!content) return;
        const sec = document.createElement('div');
        sec.id        = 'p16-nav-settings-section';
        sec.className = 'settings-section';
        sec.innerHTML = `
            <div class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-2">Navigation Items</div>
            <p class="text-xs mb-3" style="color:var(--text-muted);">Toggle to show or hide tabs. Dashboard is always visible.</p>
            <div class="space-y-2" id="p16-nav-list">
                ${P16_NAV_ITEMS.map(item => {
                    const vis = !hidden.includes(item.id);
                    return `<div class="p16-nav-toggle-row">
                        <div class="p16-nav-toggle-info">
                            <div class="p16-nav-icon">
                                <i class="fa-solid ${item.icon}" style="color:var(--accent);"></i>
                            </div>
                            <span class="text-sm">${_p16esc(item.label)}</span>
                        </div>
                        <button id="p16-ntog-${item.id}" onclick="p16_toggleNav('${item.id}')"
                            class="w-12 h-6 rounded-full relative transition border"
                            style="${vis ? 'background:var(--accent);border-color:transparent;' : 'background:var(--glass-hover);border-color:var(--glass-border);'}">
                            <div class="w-4 h-4 bg-white rounded-full absolute top-1 transition-transform"
                                style="${vis ? 'left:calc(100% - 18px);' : 'left:2px;'}"></div>
                        </button>
                    </div>`;
                }).join('')}
            </div>`;
        content.appendChild(sec);
        _p16_applyNavHide();
    }
    _try();
}

window.p16_toggleNav = function(id) {
    const hidden = _p16lsG('p16_nav_hidden', []);
    const idx    = hidden.indexOf(id);
    if (idx >= 0) hidden.splice(idx, 1); else hidden.push(id);
    _p16lsS('p16_nav_hidden', hidden);
    const btn   = document.getElementById('p16-ntog-' + id);
    const nowVis = !hidden.includes(id);
    if (btn) {
        btn.style.background    = nowVis ? 'var(--accent)' : 'var(--glass-hover)';
        btn.style.borderColor   = nowVis ? 'transparent' : 'var(--glass-border)';
        const dot = btn.querySelector('div');
        if (dot) dot.style.left = nowVis ? 'calc(100% - 18px)' : '2px';
    }
    _p16_applyNavHide();
};

/* ================================================================
   PATCH switchTab — support new tabs
   ================================================================ */
const P16_NEW_TABS = ['routine','attendance','worksheet'];

function _p16_patchSwitchTab() {
    function _try() {
        if (typeof window.switchTab !== 'function' || window._p16_stDone) { setTimeout(_try, 400); return; }
        window._p16_stDone = true;
        const orig = window.switchTab;
        window.switchTab = function(name) {
            orig(name);
            P16_NEW_TABS.forEach(t => {
                const v = document.getElementById('view-' + t);
                const b = document.getElementById('btn-' + t);
                if (v) v.classList.toggle('hidden', t !== name);
                if (b) b.classList.toggle('active', t === name);
            });
            if (name === 'routine')    { p16_renderRoutine();    }
            if (name === 'attendance') { p16_renderAttendance(); }
            if (name === 'worksheet')  { p16_wsRender(); p16_wsRenderLibrary(); }
        };
    }
    _try();
}

/* ── Inject sidebar nav buttons for new tabs ── */
function _p16_injectNavButtons() {
    function _try() {
        const col = document.querySelector('nav .flex.flex-col');
        if (!col) { setTimeout(_try, 500); return; }
        const NEW_BTNS = [
            { id:'routine',    icon:'fa-calendar-week', tip:'Routine'    },
            { id:'attendance', icon:'fa-user-check',    tip:'Attendance' },
            { id:'worksheet',  icon:'fa-layer-group',   tip:'Worksheet'  },
        ];
        NEW_BTNS.forEach(b => {
            if (document.getElementById('btn-' + b.id)) return;
            const btn = document.createElement('button');
            btn.id          = 'btn-' + b.id;
            btn.className   = 'nav-btn';
            btn.setAttribute('data-tooltip', b.tip);
            btn.innerHTML   = `<i class="fa-solid ${b.icon} text-xl"></i>`;
            btn.onclick     = () => typeof window.switchTab === 'function' && window.switchTab(b.id);
            col.appendChild(btn);
        });
        _p16_applyNavHide();
    }
    _try();
}

/* ================================================================
   ROUTINE PLANNER TAB
   ================================================================ */
const P16_DAYS = [
    { key:'mon', label:'Mon' }, { key:'tue', label:'Tue' },
    { key:'wed', label:'Wed' }, { key:'thu', label:'Thu' },
    { key:'fri', label:'Fri' }, { key:'sat', label:'Sat' },
    { key:'sun', label:'Sun' },
];
let _p16_editRid = null;

function _p16_injectRoutineTab() {
    if (document.getElementById('view-routine')) return;
    const main = document.getElementById('main-scroll'); if (!main) return;

    const v = document.createElement('div');
    v.id        = 'view-routine';
    v.className = 'hidden fade-in h-full flex flex-col';
    v.innerHTML = `
        <div class="flex items-center justify-between mb-5 flex-shrink-0">
            <h1 class="text-3xl font-light">Weekly Routine</h1>
            <button onclick="p16_openRoutineAdd(null)"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                style="background:var(--accent);">
                <i class="fa-solid fa-plus"></i>Add Block
            </button>
        </div>
        <div class="p16-routine-grid">
            ${P16_DAYS.map(d => `
                <div class="p16-day-col">
                    <div class="p16-day-hdr" id="p16-dhdr-${d.key}">${d.label}</div>
                    <div id="p16-dblk-${d.key}"></div>
                    <button class="p16-day-add" onclick="p16_openRoutineAdd('${d.key}')">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>`).join('')}
        </div>`;
    main.appendChild(v);

    // Routine edit modal
    if (!document.getElementById('modal-routine-edit')) {
        const ov = document.getElementById('modal-overlay'); if (!ov) return;
        const m = document.createElement('div');
        m.id        = 'modal-routine-edit';
        m.className = 'hidden modal-panel min-card p-7 bg-[var(--bg-color)] border border-[var(--glass-border)]';
        m.style.width = '380px';
        m.innerHTML = `
            <h3 class="text-lg font-medium mb-5" id="p16-re-hd">Add Routine Block</h3>
            <input type="hidden" id="p16-re-id">
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Activity</label>
                    <input type="text" id="p16-re-label" placeholder="e.g. Study Physics" class="bare-input w-full text-sm">
                </div>
                <div class="flex gap-3">
                    <div class="flex-1">
                        <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Day</label>
                        <select id="p16-re-day" class="bare-input w-full text-sm bg-transparent">
                            ${P16_DAYS.map(d=>`<option value="${d.key}">${d.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Start Time</label>
                        <input type="time" id="p16-re-time" class="bare-input w-full text-sm" value="09:00">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Duration (min)</label>
                    <input type="number" id="p16-re-dur" class="bare-input w-full text-sm" value="60" min="5" step="5">
                </div>
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Color</label>
                    <div class="flex gap-2 flex-wrap" id="p16-re-colors">
                        ${['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'].map(c =>
                            `<button onclick="p16_rCol('${c}')" id="p16-rc-${c.slice(1)}"
                                style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid transparent;cursor:pointer;transition:all .15s;"
                                class="hover:scale-110"></button>`).join('')}
                    </div>
                    <input type="hidden" id="p16-re-color" value="#3b82f6">
                </div>
            </div>
            <div id="p16-re-err" class="text-red-400 text-xs mt-3 min-h-[16px]"></div>
            <div class="flex gap-3 mt-5">
                <button onclick="p16_saveRoutine()"
                    class="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition"
                    style="background:var(--accent);">Save</button>
                <button onclick="closeModals()"
                    class="px-4 py-2.5 rounded-xl text-sm hover:opacity-80 transition"
                    style="background:var(--glass-hover);color:var(--text-muted);">Cancel</button>
                <button id="p16-re-del" onclick="p16_delRoutine()"
                    class="px-4 py-2.5 rounded-xl text-sm hidden"
                    style="background:rgba(239,68,68,.1);color:#f87171;">Delete</button>
            </div>`;
        ov.appendChild(m);
    }
}

window.p16_rCol = function(c) {
    document.getElementById('p16-re-color').value = c;
    document.querySelectorAll('[id^="p16-rc-"]').forEach(b => b.style.borderColor='transparent');
    const b = document.getElementById('p16-rc-' + c.slice(1));
    if (b) b.style.borderColor='rgba(255,255,255,.75)';
};

window.p16_openRoutineAdd = function(day) {
    _p16_editRid = null;
    document.getElementById('p16-re-hd').textContent = 'Add Routine Block';
    document.getElementById('p16-re-id').value       = '';
    document.getElementById('p16-re-label').value    = '';
    document.getElementById('p16-re-time').value     = '09:00';
    document.getElementById('p16-re-dur').value      = '60';
    document.getElementById('p16-re-err').textContent= '';
    document.getElementById('p16-re-del')?.classList.add('hidden');
    p16_rCol('#3b82f6');
    if (day) { const s=document.getElementById('p16-re-day'); if(s) s.value=day; }
    if (typeof openModal==='function') openModal('modal-routine-edit');
};

window.p16_openRoutineEdit = function(id) {
    const items = _p16dbG('os_routine', []);
    const item  = items.find(x => x.id === id); if (!item) return;
    _p16_editRid = id;
    document.getElementById('p16-re-hd').textContent  = 'Edit Routine Block';
    document.getElementById('p16-re-id').value        = id;
    document.getElementById('p16-re-label').value     = item.label  || '';
    document.getElementById('p16-re-time').value      = item.time   || '09:00';
    document.getElementById('p16-re-dur').value       = item.duration || 60;
    document.getElementById('p16-re-err').textContent = '';
    document.getElementById('p16-re-del')?.classList.remove('hidden');
    p16_rCol(item.color || '#3b82f6');
    const s = document.getElementById('p16-re-day'); if(s) s.value = item.day || 'mon';
    if (typeof openModal==='function') openModal('modal-routine-edit');
};

window.p16_saveRoutine = function() {
    const label    = document.getElementById('p16-re-label')?.value.trim();
    const day      = document.getElementById('p16-re-day')?.value;
    const time     = document.getElementById('p16-re-time')?.value   || '09:00';
    const duration = parseInt(document.getElementById('p16-re-dur')?.value || '60');
    const color    = document.getElementById('p16-re-color')?.value  || '#3b82f6';
    const errEl    = document.getElementById('p16-re-err');
    if (!label) { if(errEl) errEl.textContent='Activity name is required'; return; }
    if (errEl) errEl.textContent = '';
    let items = _p16dbG('os_routine', []);
    if (_p16_editRid) items = items.map(x => x.id===_p16_editRid ? {...x,label,day,time,duration,color} : x);
    else              items.push({ id:_p16id(), label, day, time, duration, color });
    _p16dbS('os_routine', items);
    if (typeof closeModals==='function') closeModals();
    p16_renderRoutine();
};

window.p16_delRoutine = function() {
    if (!_p16_editRid) return;
    let items = _p16dbG('os_routine', []).filter(x => x.id !== _p16_editRid);
    _p16dbS('os_routine', items);
    if (typeof closeModals==='function') closeModals();
    p16_renderRoutine();
};

window.p16_renderRoutine = function() {
    const items   = _p16dbG('os_routine', []);
    const dow     = new Date().getDay(); // 0=Sun
    const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][dow];
    P16_DAYS.forEach(d => {
        const col = document.getElementById('p16-dblk-' + d.key); if (!col) return;
        const hdr = document.getElementById('p16-dhdr-' + d.key);
        if (hdr) hdr.classList.toggle('today', d.key === todayKey);
        const dayItems = items.filter(x => x.day === d.key).sort((a,b) => a.time.localeCompare(b.time));
        col.innerHTML = dayItems.map(item => {
            const safeColor = _p16safeColor(item.color);
            const safeTime  = _p16esc(item.time || '');
            const safeDur   = parseInt(item.duration, 10) || 0;
            return `<div class="p16-routine-block" style="--bcolor:${safeColor}" onclick="p16_openRoutineEdit('${_p16esc(item.id)}')">
                <div class="p16-rb-time"><i class="fa-regular fa-clock" style="margin-right:3px;font-size:.55rem;"></i>${safeTime}</div>
                <div class="p16-rb-label">${_p16esc(item.label)}</div>
                <div class="p16-rb-dur">${safeDur} min</div>
            </div>`;
        }).join('');
    });
};

/* ================================================================
   ATTENDANCE TRACKER TAB
   ================================================================ */
let _p16_editCid = null;

function _p16_injectAttendanceTab() {
    if (document.getElementById('view-attendance')) return;
    const main = document.getElementById('main-scroll'); if (!main) return;

    const v = document.createElement('div');
    v.id        = 'view-attendance';
    v.className = 'hidden fade-in max-w-4xl mx-auto h-full flex flex-col';
    v.innerHTML = `
        <div class="flex items-center justify-between mb-5 flex-shrink-0">
            <h1 class="text-3xl font-light">Attendance</h1>
            <button onclick="p16_openCourseEdit(null)"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                style="background:var(--accent);">
                <i class="fa-solid fa-plus"></i>Add Course
            </button>
        </div>
        <div class="flex-1 overflow-y-auto">
            <div id="p16-att-courses" class="space-y-3"></div>
        </div>`;
    main.appendChild(v);

    if (!document.getElementById('modal-attend-course')) {
        const ov = document.getElementById('modal-overlay'); if (!ov) return;
        const m = document.createElement('div');
        m.id        = 'modal-attend-course';
        m.className = 'hidden modal-panel min-card p-7 bg-[var(--bg-color)] border border-[var(--glass-border)]';
        m.style.width = '380px';
        m.innerHTML = `
            <h3 class="text-lg font-medium mb-5" id="p16-ac-hd">Add Course</h3>
            <input type="hidden" id="p16-ac-id">
            <div class="space-y-3">
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Course Name</label>
                    <input type="text" id="p16-ac-name" placeholder="e.g. Mathematics" class="bare-input w-full text-sm">
                </div>
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Schedule (optional)</label>
                    <input type="text" id="p16-ac-sched" placeholder="e.g. Mon/Wed 09:00" class="bare-input w-full text-sm">
                </div>
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Attendance Goal (%)</label>
                    <input type="number" id="p16-ac-goal" class="bare-input w-full text-sm" value="80" min="1" max="100" step="5">
                </div>
                <div>
                    <label class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 block">Color</label>
                    <div class="flex gap-2 flex-wrap">
                        ${['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'].map(c =>
                            `<button onclick="p16_cCol('${c}')" id="p16-cc-${c.slice(1)}"
                                style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid transparent;cursor:pointer;transition:all .15s;"
                                class="hover:scale-110"></button>`).join('')}
                    </div>
                    <input type="hidden" id="p16-ac-color" value="#3b82f6">
                </div>
            </div>
            <div id="p16-ac-err" class="text-red-400 text-xs mt-3 min-h-[16px]"></div>
            <div class="flex gap-3 mt-5">
                <button onclick="p16_saveCourse()"
                    class="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition"
                    style="background:var(--accent);">Save</button>
                <button onclick="closeModals()"
                    class="px-4 py-2.5 rounded-xl text-sm hover:opacity-80 transition"
                    style="background:var(--glass-hover);color:var(--text-muted);">Cancel</button>
                <button id="p16-ac-del" onclick="p16_delCourse()"
                    class="px-4 py-2.5 rounded-xl text-sm hidden"
                    style="background:rgba(239,68,68,.1);color:#f87171;">Delete</button>
            </div>`;
        ov.appendChild(m);
    }
}

window.p16_cCol = function(c) {
    document.getElementById('p16-ac-color').value = c;
    document.querySelectorAll('[id^="p16-cc-"]').forEach(b => b.style.borderColor='transparent');
    const b = document.getElementById('p16-cc-' + c.slice(1));
    if (b) b.style.borderColor='rgba(255,255,255,.75)';
};

window.p16_openCourseEdit = function(id) {
    _p16_editCid = id;
    const course = id ? _p16dbG('os_attend_courses', []).find(c => c.id === id) : null;
    document.getElementById('p16-ac-hd').textContent   = course ? 'Edit Course' : 'Add Course';
    document.getElementById('p16-ac-id').value         = id || '';
    document.getElementById('p16-ac-name').value       = course?.name   || '';
    document.getElementById('p16-ac-sched').value      = course?.schedule || '';
    document.getElementById('p16-ac-goal').value       = course?.goal   || 80;
    document.getElementById('p16-ac-err').textContent  = '';
    document.getElementById('p16-ac-del')?.classList.toggle('hidden', !id);
    p16_cCol(course?.color || '#3b82f6');
    if (typeof openModal==='function') openModal('modal-attend-course');
};

window.p16_saveCourse = function() {
    const name     = document.getElementById('p16-ac-name')?.value.trim();
    const schedule = document.getElementById('p16-ac-sched')?.value.trim();
    const color    = document.getElementById('p16-ac-color')?.value  || '#3b82f6';
    const goal     = parseInt(document.getElementById('p16-ac-goal')?.value || '80');
    const errEl    = document.getElementById('p16-ac-err');
    if (!name) { if(errEl) errEl.textContent='Course name is required'; return; }
    if (errEl) errEl.textContent = '';
    let courses = _p16dbG('os_attend_courses', []);
    if (_p16_editCid) courses = courses.map(c => c.id===_p16_editCid ? {...c,name,schedule,color,goal} : c);
    else              courses.push({ id:_p16id(), name, schedule, color, goal });
    _p16dbS('os_attend_courses', courses);
    if (typeof closeModals==='function') closeModals();
    p16_renderAttendance();
};

window.p16_delCourse = function() {
    if (!_p16_editCid) return;
    _p16dbS('os_attend_courses', _p16dbG('os_attend_courses',[]).filter(c=>c.id!==_p16_editCid));
    _p16dbS('os_attend_log',     _p16dbG('os_attend_log',    []).filter(l=>l.courseId!==_p16_editCid));
    if (typeof closeModals==='function') closeModals();
    p16_renderAttendance();
};

window.p16_logAttend = function(courseId, status) {
    const today = _p16date();
    let log = _p16dbG('os_attend_log', []).filter(l => !(l.courseId===courseId && l.date===today));
    if (status !== 'remove') log.push({ courseId, date: today, status });
    _p16dbS('os_attend_log', log);
    p16_renderAttendance();
};

window.p16_renderAttendance = function() {
    const courses = _p16dbG('os_attend_courses', []);
    const log     = _p16dbG('os_attend_log', []);
    const today   = _p16date();
    const el = document.getElementById('p16-att-courses'); if (!el) return;

    if (!courses.length) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted);">
            <i class="fa-solid fa-user-check" style="font-size:2rem;display:block;margin-bottom:12px;opacity:.3;"></i>
            <div style="font-size:.88rem;">No courses yet. Add a course to start tracking attendance.</div>
        </div>`; return;
    }

    el.innerHTML = courses.map(course => {
        const cLog      = log.filter(l => l.courseId === course.id);
        const total     = cLog.length;
        const attended  = cLog.filter(l => l.status==='attended').length;
        const pct       = total > 0 ? Math.round(attended/total*100) : 0;
        const goal      = Math.max(1, Math.min(100, parseInt(course.goal, 10) || 80));
        const pctColor  = pct >= goal ? '#22c55e' : pct >= goal-10 ? '#f59e0b' : '#ef4444';
        const safeColor = _p16safeColor(course.color);
        const todaySt   = cLog.find(l => l.date===today)?.status;
        const recent    = [...cLog].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,24);
        return `<div class="p16-course-card">
            <div class="p16-course-hdr">
                <div class="p16-course-dot" style="background:${safeColor}"></div>
                <div class="p16-course-name">${_p16esc(course.name)}</div>
                ${course.schedule ? `<span style="font-size:.63rem;color:var(--text-muted);"><i class="fa-solid fa-clock" style="margin-right:3px;"></i>${_p16esc(course.schedule)}</span>` : ''}
                <button onclick="p16_openCourseEdit('${_p16esc(course.id)}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.72rem;padding:2px 6px;" class="hover:opacity-70"><i class="fa-solid fa-pencil"></i></button>
            </div>
            <div class="p16-attend-bar"><div class="p16-attend-fill" style="width:${pct}%;background:${pctColor}"></div></div>
            <div class="p16-attend-stat">
                <span>${attended}/${total} sessions attended</span>
                <span style="color:${pctColor};font-weight:800;">${pct}%<span style="font-weight:500;color:var(--text-muted);"> / goal ${goal}%</span></span>
            </div>
            <div class="p16-attend-actions">
                <button class="p16-att-btn attend${todaySt==='attended' ? ' active-attend' : ''}"
                    onclick="p16_logAttend('${_p16esc(course.id)}','${todaySt==='attended' ? 'remove' : 'attended'}')">
                    <i class="fa-solid fa-circle-check"></i>${todaySt==='attended' ? 'Attended Today' : 'Mark Attended'}
                </button>
                <button class="p16-att-btn miss${todaySt==='missed' ? ' active-miss' : ''}"
                    onclick="p16_logAttend('${_p16esc(course.id)}','${todaySt==='missed' ? 'remove' : 'missed'}')">
                    <i class="fa-solid fa-circle-xmark"></i>${todaySt==='missed' ? 'Marked Missed' : 'Mark Missed'}
                </button>
            </div>
            ${recent.length ? `<div class="p16-session-log">${recent.map(l =>
                `<div class="p16-session-dot" style="background:${l.status==='attended'?'#22c55e':'#ef4444'};opacity:.75;" title="${_p16esc(l.date)}: ${_p16esc(l.status)}"></div>`
            ).join('')}</div>` : ''}
        </div>`;
    }).join('');
};

/* ================================================================
   WORKSHEET TAB
   ================================================================ */
function _p16_injectWorksheetTab() {
    if (document.getElementById('view-worksheet')) return;
    const main = document.getElementById('main-scroll'); if (!main) return;

    const v = document.createElement('div');
    v.id        = 'view-worksheet';
    v.className = 'hidden fade-in h-full flex flex-col';
    v.innerHTML = `
        <div class="flex items-center justify-between mb-3 flex-shrink-0">
            <h1 class="text-3xl font-light">Worksheet</h1>
            <div class="flex gap-2">
                <button onclick="p16_wsAddNote()" class="p16-ws-tb-btn">
                    <i class="fa-solid fa-sticky-note"></i>Note
                </button>
                <button onclick="p16_wsComputeAll()"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                    style="background:var(--accent);">
                    <i class="fa-solid fa-bolt"></i>Compute All
                </button>
            </div>
        </div>
        <div class="p16-ws-layout flex-1 min-h-0">
            <div style="overflow:hidden;display:flex;flex-direction:column;gap:6px;">
                <div class="text-xs uppercase tracking-widest font-bold" style="color:var(--text-muted);flex-shrink:0;">Formula Library</div>
                <div class="p16-ws-library" id="p16-ws-lib"></div>
            </div>
            <div style="overflow:hidden;display:flex;flex-direction:column;gap:6px;">
                <div class="text-xs uppercase tracking-widest font-bold" style="color:var(--text-muted);flex-shrink:0;">Steps</div>
                <div id="p16-ws-canvas" class="p16-ws-canvas flex-1 min-h-0"
                     ondragover="event.preventDefault();this.querySelector('#p16-ws-ph')?.classList.add('drag-over')"
                     ondragleave="this.querySelector('#p16-ws-ph')?.classList.remove('drag-over')"
                     ondrop="p16_wsDrop(event)">
                    <div class="p16-ws-placeholder" id="p16-ws-ph">
                        <i class="fa-solid fa-arrow-left" style="font-size:1.3rem;opacity:.35;"></i>
                        <span>Drag a formula from the library to start your worksheet</span>
                    </div>
                </div>
                <div style="background:var(--glass-panel);border:1px solid var(--glass-border);border-radius:12px;padding:10px 14px;flex-shrink:0;">
                    <div class="text-xs uppercase tracking-widest font-bold mb-2" style="color:var(--text-muted);">Saved Values</div>
                    <div id="p16-ws-sv" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
                </div>
            </div>
        </div>`;
    main.appendChild(v);
}

window.p16_wsRenderLibrary = function() {
    const lib = document.getElementById('p16-ws-lib'); if (!lib) return;
    const formulas = _p16dbG('os_formulas', []);
    if (!formulas.length) {
        lib.innerHTML = `<div style="font-size:.75rem;color:var(--text-muted);padding:8px 0;">No formulas yet — add some in the Formulas tab first.</div>`;
        return;
    }
    lib.innerHTML = formulas.map(f =>
        `<div class="p16-ws-lib-card" draggable="true"
            ondragstart="p16_wsDragStart(event,'${_p16esc(f.id)}')"
            title="${_p16esc(f.formula)}">
            <div class="p16-ws-lib-title">${_p16esc(f.title)}</div>
            <div class="p16-ws-lib-expr">${_p16esc(f.formula)}</div>
        </div>`
    ).join('');
};

window.p16_wsDragStart = function(e, fid) {
    e.dataTransfer.setData('p16-fid', fid);
    e.dataTransfer.effectAllowed = 'copy';
};

window.p16_wsDrop = function(e) {
    e.preventDefault();
    document.getElementById('p16-ws-ph')?.classList.remove('drag-over');
    const fid = e.dataTransfer.getData('p16-fid');
    if (fid) p16_wsAddStep(fid);
};

window.p16_wsAddStep = function(fid) {
    const f = _p16dbG('os_formulas', []).find(x => x.id === fid); if (!f) return;
    const ws   = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    const vars = p16_detectVars(f.formula || '');
    const savedVars = f.vars || [];
    ws.steps.push({
        id: _p16id(), type: 'formula', formulaId: fid,
        title: f.title, formula: f.formula,
        vars: vars.map(sym => {
            const meta = savedVars.find(v => v.sym === sym) || {};
            return { sym, name: meta.name || sym, cat: meta.cat||'dimensionless', unit: meta.unit||'' };
        }),
        solveFor: vars[0] || '', result: null, savedAs: '',
    });
    _p16dbS('os_worksheet', ws);
    p16_wsRender();
};

window.p16_wsAddNote = function() {
    const ws = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    ws.steps.push({ id:_p16id(), type:'note', content:'' });
    _p16dbS('os_worksheet', ws);
    p16_wsRender();
};

window.p16_wsDeleteStep = function(sid) {
    const ws = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    ws.steps = ws.steps.filter(s => s.id !== sid);
    _p16dbS('os_worksheet', ws);
    p16_wsRender();
};

window.p16_wsSetSolveFor = function(sid, sym) {
    const ws   = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    const step = ws.steps.find(s => s.id === sid); if (!step) return;
    step.solveFor = sym; step.result = null;
    _p16dbS('os_worksheet', ws); p16_wsRender();
};

window.p16_wsUpdateNote = function(sid, val) {
    const ws   = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    const step = ws.steps.find(s => s.id === sid); if (!step) return;
    step.content = val; _p16dbS('os_worksheet', ws);
};

window.p16_wsComputeStep = function(sid) {
    const ws   = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    const step = ws.steps.find(s => s.id === sid);
    if (!step || step.type !== 'formula') return;
    const knownVals = {};
    for (const v of step.vars) {
        if (v.sym === step.solveFor) continue;
        const inp  = document.querySelector(`[data-wssid="${sid}"] [data-wsvar="${v.sym}"]`);
        const raw  = inp ? inp.value.trim() : '';
        if (!raw) continue;
        if (raw.startsWith('@')) {
            const ref = ws.savedValues[raw.slice(1)];
            if (ref !== undefined) knownVals[v.sym] = typeof ref === 'object' ? ref.value : ref;
            continue;
        }
        const uSel = inp ? inp.nextElementSibling : null;
        const unit = uSel ? uSel.value : (P16_UNIT_CATS[v.cat]?.base ?? '');
        knownVals[v.sym] = p16_toSI(parseFloat(raw), v.cat, unit);
    }
    try {
        step.result = p16_solveFor(step.formula, knownVals, step.solveFor);
        if (step.savedAs) {
            const tMeta = step.vars.find(v => v.sym === step.solveFor) || {};
            ws.savedValues[step.savedAs] = { value: step.result, unit: P16_UNIT_CATS[tMeta.cat]?.base || '' };
        }
        _p16dbS('os_worksheet', ws); p16_wsRender();
    } catch(e) { _p16toast('Compute error: ' + (e.message||'unknown')); }
};

window.p16_wsComputeAll = function() {
    const ws = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    ws.steps.forEach(s => { if (s.type==='formula') p16_wsComputeStep(s.id); });
};

window.p16_wsSaveAs = function(sid) {
    const nameEl = document.querySelector(`[data-wssid="${sid}"] .ws-saveas-inp`);
    const name   = nameEl ? nameEl.value.trim() : '';
    if (!name) return;
    const ws   = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    const step = ws.steps.find(s => s.id === sid);
    if (!step || step.result === null) { _p16toast('Compute the step first'); return; }
    step.savedAs = name;
    ws.savedValues[name] = { value: step.result, unit: '' };
    _p16dbS('os_worksheet', ws); p16_wsRender();
    _p16toast(`"${name}" = ${p16_fmt(step.result)} saved`);
};

window.p16_wsDeleteSaved = function(name) {
    const ws = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    delete ws.savedValues[name];
    // Clear savedAs on any step using this name
    ws.steps.forEach(s => { if (s.savedAs === name) s.savedAs = ''; });
    _p16dbS('os_worksheet', ws); p16_wsRender();
};

window.p16_wsClearAll = function() {
    if (!confirm('Clear the entire worksheet?')) return;
    _p16dbS('os_worksheet', { steps:[], savedValues:{} });
    p16_wsRender();
};

window.p16_wsRender = function() {
    const ws     = _p16dbG('os_worksheet', { steps:[], savedValues:{} });
    const canvas = document.getElementById('p16-ws-canvas'); if (!canvas) return;
    const ph     = document.getElementById('p16-ws-ph');
    const svEl   = document.getElementById('p16-ws-sv');

    // Update saved values bar
    if (svEl) {
        const entries = Object.entries(ws.savedValues || {});
        svEl.innerHTML = entries.length
            ? entries.map(([k,v]) => {
                const val = typeof v === 'object' ? v.value : v;
                return `<div class="p16-ws-saved-badge" title="${_p16esc(k)} = ${val}">
                    ${_p16esc(k)} = ${p16_fmt(val)}
                    <button onclick="p16_wsDeleteSaved('${_p16esc(k)}')"
                        style="background:none;border:none;color:inherit;cursor:pointer;opacity:.6;padding:0;margin-left:2px;font-size:.58rem;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>`;
            }).join('')
            : `<span style="font-size:.72rem;color:var(--text-muted);">Saved values will appear here</span>`;
    }

    if (!ws.steps || !ws.steps.length) {
        if (ph) ph.style.display = '';
        canvas.querySelectorAll('[data-wssid]').forEach(el => el.remove());
        return;
    }
    if (ph) ph.style.display = 'none';

    // Remove stale step elements
    canvas.querySelectorAll('[data-wssid]').forEach(el => {
        if (!ws.steps.find(s => s.id === el.dataset.wssid)) el.remove();
    });

    ws.steps.forEach((step, i) => {
        let el = canvas.querySelector(`[data-wssid="${step.id}"]`);
        if (!el) {
            el = document.createElement('div');
            el.dataset.wssid = step.id;
            canvas.insertBefore(el, ph || null);
        }
        el.className = 'p16-ws-step';

        if (step.type === 'note') {
            el.innerHTML = `<div class="p16-ws-step-hdr">
                <div class="p16-ws-step-num">${i+1}</div>
                <div class="p16-ws-step-title">Note</div>
                <button onclick="p16_wsDeleteStep('${step.id}')"
                    style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.75rem;margin-left:auto;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <textarea class="p16-var-input" style="width:100%;resize:vertical;min-height:56px;font-family:inherit;"
                placeholder="Write notes here\u2026"
                oninput="p16_wsUpdateNote('${step.id}',this.value)">${_p16esc(step.content||'')}</textarea>`;
        } else {
            const solvOpts = (step.vars||[]).map(v =>
                `<option value="${_p16esc(v.sym)}" ${v.sym===step.solveFor?'selected':''}>
                    ${_p16esc(v.sym)}${v.name&&v.name!==v.sym?' ('+v.name+')':''}
                </option>`).join('');
            const inputVars = (step.vars||[]).filter(v => v.sym !== step.solveFor);
            el.innerHTML = `<div class="p16-ws-step-hdr">
                <div class="p16-ws-step-num">${i+1}</div>
                <div class="p16-ws-step-title">${_p16esc(step.title||'Formula')}</div>
                <button onclick="p16_wsDeleteStep('${step.id}')"
                    style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.75rem;margin-left:auto;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="p16-ws-step-formula">${_p16esc(step.formula||'')}</div>
            <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:9px;">
                Solve for:
                <select onchange="p16_wsSetSolveFor('${step.id}',this.value)"
                    style="background:var(--glass-hover);border:1px solid var(--glass-border);border-radius:6px;padding:2px 6px;color:var(--text-main);font-size:.7rem;outline:none;margin-left:4px;">
                    ${solvOpts}
                </select>
            </div>
            <div class="p16-ws-vars-grid">
                ${inputVars.map(v => {
                    const catDef = P16_UNIT_CATS[v.cat]||P16_UNIT_CATS.dimensionless;
                    const uOpts  = Object.keys(catDef.units).map(u =>
                        `<option value="${_p16esc(u)}" ${u===v.unit?'selected':''}>${_p16esc(u)}</option>`).join('');
                    return `<div class="p16-ws-var-cell">
                        <div class="p16-ws-var-lbl">${_p16esc(v.sym)}</div>
                        <div class="p16-ws-var-sub">${_p16esc(v.name||'')}</div>
                        <div style="display:flex;gap:4px;align-items:center;">
                            <input type="text" class="p16-ws-var-inp" data-wsvar="${_p16esc(v.sym)}"
                                placeholder="value or @name" value="${_p16esc(String(v.value||''))}">
                            <select style="width:58px;font-size:.68rem;padding:4px;border-radius:7px;border:1px solid var(--glass-border);background:var(--glass-hover);color:var(--text-muted);outline:none;">
                                ${uOpts}
                            </select>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            <div class="p16-ws-result-row">
                <button onclick="p16_wsComputeStep('${step.id}')"
                    style="padding:7px 14px;border-radius:9px;background:var(--accent);color:#fff;font-size:.78rem;font-weight:700;border:none;cursor:pointer;">
                    <i class="fa-solid fa-calculator" style="margin-right:5px;"></i>Compute
                </button>
                <div class="p16-ws-result-badge">
                    ${step.result !== null ? p16_fmt(step.result) : '\u2014'}
                </div>
                <input type="text" class="p16-var-input ws-saveas-inp" style="width:100px;"
                    placeholder="save as\u2026" value="${_p16esc(step.savedAs||'')}">
                <button onclick="p16_wsSaveAs('${step.id}')"
                    style="padding:6px 10px;border-radius:8px;border:1px solid var(--glass-border);background:var(--glass-hover);color:var(--text-muted);font-size:.72rem;cursor:pointer;" class="hover:opacity-80">
                    <i class="fa-solid fa-bookmark"></i>
                </button>
            </div>`;
        }
    });
};

/* ================================================================
   SETTINGS — SMALL AVATAR PREVIEW
   ================================================================ */
function _p16_injectSettingsAvatar() {
    function _try() {
        const modal   = document.getElementById('modal-settings'); if (!modal) { setTimeout(_try,900); return; }
        if (document.getElementById('p16-settings-avatar')) return;
        // Find the "Profile Picture" settings row
        const rows = modal.querySelectorAll('.settings-row');
        let targetRow = null;
        rows.forEach(row => { if (row.textContent.includes('Profile Picture')) targetRow = row; });
        if (!targetRow) { setTimeout(_try,1200); return; }

        const avEl = document.createElement('div');
        avEl.id = 'p16-settings-avatar';
        // Copy content from main avatar
        const src = document.getElementById('avatar-preview');
        if (src) { avEl.innerHTML = src.innerHTML; avEl.style.background = src.style.background || 'var(--accent)'; }
        // Insert before the "Edit ->" button
        const editBtn = targetRow.querySelector('button');
        if (editBtn) targetRow.insertBefore(avEl, editBtn);
        else targetRow.appendChild(avEl);

        // Keep in sync with avatar changes
        const ov = new MutationObserver(() => {
            const s = document.getElementById('avatar-preview'); if (!s) return;
            const d = document.getElementById('p16-settings-avatar'); if (!d) return;
            d.innerHTML = s.innerHTML; d.style.background = s.style.background || 'var(--accent)';
        });
        const src2 = document.getElementById('avatar-preview');
        if (src2) ov.observe(src2, { childList:true, subtree:true, attributes:true, characterData:true });
    }
    _try();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p16init() {
    const go = () => {
        // Inject new tab views + modals
        _p16_injectSolverModal();
        _p16_injectRoutineTab();
        _p16_injectAttendanceTab();
        _p16_injectWorksheetTab();

        // Sidebar nav buttons for new tabs
        _p16_injectNavButtons();

        // Patch switchTab for new tabs
        _p16_patchSwitchTab();

        // Formula solver — observe list for Solve button
        _p16_watchFormulaList();

        // Formula modal — variable section
        _p16_enhanceFormulaModal();

        // Settings — nav hide section
        _p16_injectNavSettings();

        // Settings — avatar thumbnail
        _p16_injectSettingsAvatar();

        // Apply persisted nav visibility immediately
        _p16_applyNavHide();

        console.log('[patches16] loaded — formula solver, routine, attendance, worksheet');
    };
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', () => setTimeout(go, 900))
        : setTimeout(go, 900);
})();
