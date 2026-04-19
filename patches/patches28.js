/* ================================================================
   StudentOS — patches28.js
   1.  Attendance: continuously remove patches27 DOM additions
       (heat strip, streak badge, Today button).
   2.  Worksheet: unified Formula browser modal — one "Formulas"
       button replaces the three separate formula picker sections.
   3.  Worksheet: drag-to-resize for every block.
   4.  Worksheet: two new block types — checklist & code.
   5.  Worksheet: UX polish — empty state, Ctrl+Enter shortcut.
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p28lsG   = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p28lsS   = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p28dbG   = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p28lsG(k, d); } catch { return d; } };
const _p28dbS   = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p28lsS(k, v); } catch {} };
const _p28id    = () => Math.random().toString(36).slice(2, 10);
const _p28toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };

/* ================================================================
   1.  ATTENDANCE — REMOVE PATCHES27 ADDITIONS
   ================================================================ */
function _p28_undoAttendanceP27() {
    /* CSS already hides these elements (patches28.css).
       This observer also physically removes them for DOM cleanliness.
       We do NOT delete data-p27enhanced/data-p27streakAdded so that
       patches27's own observer will not try to re-add them. */
    let _scheduled = false;
    function _clean() {
        document.querySelectorAll('.p27-heat-strip, .p27-streak-badge, .p27-today-btn').forEach(el => el.remove());
    }
    const obs = new MutationObserver(() => {
        if (_scheduled) return;
        _scheduled = true;
        requestAnimationFrame(() => { _scheduled = false; _clean(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    _clean();
}

/* ================================================================
   2.  UNIFIED FORMULA BROWSER MODAL
   ================================================================ */
function _p28_formulaModal() {

    /* ── Built-in formula library (mirrors patches26 LIBRARY) ─── */
    const LIBRARY = [
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

        { title: 'Sine (SOH)',              formula: 'sin_theta = opposite / hypotenuse',      subject: 'Trigonometry' },
        { title: 'Cosine (CAH)',            formula: 'cos_theta = adjacent / hypotenuse',      subject: 'Trigonometry' },
        { title: 'Tangent (TOA)',           formula: 'tan_theta = opposite / adjacent',        subject: 'Trigonometry' },
        { title: 'Law of Sines',            formula: 'a / sin(A) = b / sin(B)',                subject: 'Trigonometry' },
        { title: 'Law of Cosines',          formula: 'c^2 = a^2 + b^2 - 2*a*b*cos(C)',        subject: 'Trigonometry' },
        { title: 'Pythagorean Identity',    formula: 'sin(x)^2 + cos(x)^2 = 1',               subject: 'Trigonometry' },
        { title: 'Arc Length',              formula: 's = r * theta',                          subject: 'Trigonometry' },

        { title: 'Mean',                    formula: 'mean = total / n',                       subject: 'Statistics' },
        { title: 'Z-Score',                 formula: 'z = (x - mu) / sigma',                  subject: 'Statistics' },
        { title: 'Combinations nCr',        formula: 'C = n! / (r! * (n - r)!)',               subject: 'Statistics' },
        { title: 'Probability',             formula: 'p = favorable / total',                  subject: 'Statistics' },
        { title: 'Expected Value',          formula: 'E = p * value',                          subject: 'Statistics' },
        { title: 'Margin of Error',         formula: 'me = z * sigma / sqrt(n)',               subject: 'Statistics' },
        { title: 'Coefficient of Var.',     formula: 'cv = sigma / mean * 100',                subject: 'Statistics' },

        { title: 'Kinetic Energy',          formula: 'KE = 0.5 * m * v^2',                    subject: 'Mechanics' },
        { title: 'Gravitational PE',        formula: 'PE = m * g * h',                        subject: 'Mechanics' },
        { title: "Newton's 2nd Law",        formula: 'F = m * a',                             subject: 'Mechanics' },
        { title: 'Work',                    formula: 'W = F * d',                             subject: 'Mechanics' },
        { title: 'Power',                   formula: 'P = W / t',                             subject: 'Mechanics' },
        { title: 'Momentum',                formula: 'p = m * v',                             subject: 'Mechanics' },
        { title: 'Velocity',                formula: 'v = d / t',                             subject: 'Mechanics' },
        { title: 'Acceleration',            formula: 'a = (v - u) / t',                       subject: 'Mechanics' },
        { title: 'Kinematic: s',            formula: 's = u*t + 0.5*a*t^2',                   subject: 'Mechanics' },
        { title: 'Kinematic: v2',           formula: 'v2 = u^2 + 2*a*s',                      subject: 'Mechanics' },
        { title: 'Centripetal Force',       formula: 'Fc = m * v^2 / r',                      subject: 'Mechanics' },
        { title: 'Gravitational Force',     formula: 'Fg = G * m1 * m2 / r^2',               subject: 'Mechanics' },
        { title: 'Pressure',                formula: 'P = F / A',                             subject: 'Mechanics' },
        { title: 'Density',                 formula: 'rho = m / V',                           subject: 'Mechanics' },
        { title: 'Friction Force',          formula: 'Ff = mu * N',                           subject: 'Mechanics' },
        { title: 'Torque',                  formula: 'T = F * r',                             subject: 'Mechanics' },
        { title: 'Angular Velocity',        formula: 'omega = theta / t',                     subject: 'Mechanics' },

        { title: 'Wave Speed',              formula: 'v = f * lambda',                        subject: 'Waves' },
        { title: 'Period',                  formula: 'T = 1 / f',                             subject: 'Waves' },
        { title: 'Doppler Effect',          formula: 'f_obs = f * (v + vo) / (v - vs)',       subject: 'Waves' },
        { title: "Snell's Law",             formula: 'n1 * sin(theta1) = n2 * sin(theta2)',   subject: 'Waves' },

        { title: 'Heat Transfer',           formula: 'Q = m * c * deltaT',                    subject: 'Thermodynamics' },
        { title: 'Ideal Gas Law',           formula: 'P * V = n * R * T',                     subject: 'Thermodynamics' },
        { title: "Boyle's Law",             formula: 'P1 * V1 = P2 * V2',                     subject: 'Thermodynamics' },
        { title: "Charles's Law",           formula: 'V1 / T1 = V2 / T2',                     subject: 'Thermodynamics' },

        { title: "Ohm's Law",               formula: 'V = I * R',                             subject: 'Electricity' },
        { title: 'Electric Power',          formula: 'P = I * V',                             subject: 'Electricity' },
        { title: "Coulomb's Law",           formula: 'F = k * q1 * q2 / r^2',                subject: 'Electricity' },
        { title: 'Capacitance',             formula: 'C = Q / V',                             subject: 'Electricity' },
        { title: 'Series Resistance',       formula: 'Rt = R1 + R2 + R3',                     subject: 'Electricity' },
        { title: 'Parallel Resistance',     formula: 'Rt = 1 / (1/R1 + 1/R2 + 1/R3)',        subject: 'Electricity' },
        { title: 'Electric Field',          formula: 'E = F / q',                             subject: 'Electricity' },

        { title: 'Moles from Mass',         formula: 'n = m / M',                             subject: 'Chemistry' },
        { title: 'Concentration',           formula: 'c = n / V',                             subject: 'Chemistry' },
        { title: 'pH',                      formula: 'pH = -log(H)',                           subject: 'Chemistry' },
        { title: 'Dilution',                formula: 'C1 * V1 = C2 * V2',                     subject: 'Chemistry' },
        { title: 'Percent Yield',           formula: 'yield = (actual / theoretical) * 100',  subject: 'Chemistry' },
        { title: 'Combined Gas Law',        formula: 'P1 * V1 / T1 = P2 * V2 / T2',          subject: 'Chemistry' },

        { title: 'Compound Interest',       formula: 'A = P * (1 + r/n)^(n*t)',               subject: 'Finance' },
        { title: 'Simple Interest',         formula: 'I = P * r * t',                         subject: 'Finance' },
        { title: 'Present Value',           formula: 'PV = FV / (1 + r)^n',                   subject: 'Finance' },
        { title: 'Future Value',            formula: 'FV = PV * (1 + r)^n',                   subject: 'Finance' },
        { title: 'ROI',                     formula: 'ROI = (gain - cost) / cost * 100',       subject: 'Finance' },
        { title: 'Break-Even Units',        formula: 'units = fixed / (price - variable)',     subject: 'Finance' },
    ];

    const SUBJECTS = [...new Set(LIBRARY.map(f => f.subject))];

    /* ── Extract variable symbols from a formula string ──────── */
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

    /* ── Add a formula to the worksheet ──────────────────────── */
    function _addFormula(item, isUserFormula) {
        const syms = isUserFormula
            ? (typeof window.p16_detectVars === 'function'
                ? window.p16_detectVars(item.formula || '')
                : _extractVars(item.formula))
            : _extractVars(item.formula);

        const existingVars = item.vars || [];
        const vars = syms.map(sym => {
            const meta = existingVars.find(v => v.sym === sym) || {};
            return { sym, name: meta.name || sym, value: '' };
        });

        const ws = _p28dbG('os_worksheet', { blocks: [], savedValues: {} });
        ws.blocks = ws.blocks || [];
        ws.blocks.push({
            id:        _p28id(),
            type:      'formula',
            formulaId: isUserFormula ? (item.id || null) : null,
            title:     item.title,
            formula:   item.formula,
            vars,
            solveFor:  vars[0]?.sym || '',
            result:    null,
            savedAs:   '',
        });
        _p28dbS('os_worksheet', ws);
        if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
        _closeModal();
        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
        _p28toast('Added: ' + item.title);
    }

    /* ── Build / get the modal element ───────────────────────── */
    function _getModal() {
        let modal = document.getElementById('p28-formula-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'p28-formula-modal';

        /* Box */
        const box = document.createElement('div');
        box.className = 'p28-modal-box';

        /* Header */
        const hdr = document.createElement('div');
        hdr.className = 'p28-modal-header';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'p28-modal-title';
        titleDiv.innerHTML = '<i class="fa-solid fa-square-root-variable"></i>';
        titleDiv.appendChild(document.createTextNode(' Formula Library'));

        const closeBtn = document.createElement('button');
        closeBtn.className = 'p28-modal-close-btn';
        closeBtn.type      = 'button';
        closeBtn.title     = 'Close';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener('click', _closeModal);

        hdr.appendChild(titleDiv);
        hdr.appendChild(closeBtn);
        box.appendChild(hdr);

        /* Tabs */
        const tabs = document.createElement('div');
        tabs.className = 'p28-modal-tabs';
        tabs.id        = 'p28-modal-tabs';

        const tabLib  = document.createElement('button');
        tabLib.type      = 'button';
        tabLib.className = 'p28-modal-tab active';
        tabLib.textContent = 'Built-in library';
        tabLib.dataset.tab = 'library';

        const tabMine = document.createElement('button');
        tabMine.type      = 'button';
        tabMine.className = 'p28-modal-tab';
        tabMine.textContent = 'My formulas';
        tabMine.dataset.tab = 'mine';

        tabs.appendChild(tabLib);
        tabs.appendChild(tabMine);
        box.appendChild(tabs);

        /* Controls */
        const controls = document.createElement('div');
        controls.className = 'p28-modal-controls';

        const searchWrap = document.createElement('div');
        searchWrap.className = 'p28-modal-search-wrap';
        const searchIcon = document.createElement('i');
        searchIcon.className = 'fa-solid fa-magnifying-glass';
        const searchInp = document.createElement('input');
        searchInp.type        = 'text';
        searchInp.id          = 'p28-formula-search';
        searchInp.className   = 'p28-modal-search-inp';
        searchInp.placeholder = 'Search formulas…';
        searchInp.autocomplete = 'off';
        searchWrap.appendChild(searchIcon);
        searchWrap.appendChild(searchInp);

        const subjSel = document.createElement('select');
        subjSel.id        = 'p28-formula-subject';
        subjSel.className = 'p28-modal-subject-sel';
        const allOpt = document.createElement('option');
        allOpt.value       = '';
        allOpt.textContent = 'All subjects';
        subjSel.appendChild(allOpt);
        SUBJECTS.forEach(s => {
            const opt = document.createElement('option');
            opt.value       = s;
            opt.textContent = s;
            subjSel.appendChild(opt);
        });

        controls.appendChild(searchWrap);
        controls.appendChild(subjSel);
        box.appendChild(controls);

        /* Formula grid */
        const grid = document.createElement('div');
        grid.className = 'p28-formula-grid';
        grid.id        = 'p28-formula-grid';
        box.appendChild(grid);

        modal.appendChild(box);
        document.body.appendChild(modal);

        /* ── Close on backdrop click ── */
        modal.addEventListener('click', e => {
            if (e.target === modal) _closeModal();
        });

        /* ── Close on Escape ── */
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('open')) _closeModal();
        });

        /* ── Tab switching ── */
        let _activeTab = 'library';
        tabs.addEventListener('click', e => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            _activeTab = btn.dataset.tab;
            tabs.querySelectorAll('.p28-modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _activeTab));
            /* Hide subject select on "mine" tab */
            subjSel.style.display = _activeTab === 'mine' ? 'none' : '';
            _redraw();
        });

        /* ── Redraw on search/subject change ── */
        function _redraw() {
            const query = searchInp.value.trim().toLowerCase();
            const subj  = subjSel.value;
            grid.innerHTML = '';

            if (_activeTab === 'library') {
                const filtered = LIBRARY.filter(f => {
                    if (subj && f.subject !== subj) return false;
                    if (query && !f.title.toLowerCase().includes(query) &&
                                 !f.formula.toLowerCase().includes(query) &&
                                 !f.subject.toLowerCase().includes(query)) return false;
                    return true;
                });
                if (!filtered.length) {
                    const empty = document.createElement('div');
                    empty.className   = 'p28-formula-grid-empty';
                    empty.textContent = 'No formulas match your search.';
                    grid.appendChild(empty);
                    return;
                }
                filtered.forEach(item => grid.appendChild(_buildCard(item, false)));

            } else {
                /* My formulas */
                const userFormulas = _p28dbG('os_formulas', []);
                const filtered = userFormulas.filter(f => {
                    if (!query) return true;
                    return (f.title || '').toLowerCase().includes(query) ||
                           (f.formula || '').toLowerCase().includes(query);
                });
                if (!filtered.length) {
                    const empty = document.createElement('div');
                    empty.className   = 'p28-formula-grid-empty';
                    empty.textContent = userFormulas.length
                        ? 'No formulas match your search.'
                        : 'No saved formulas yet. Add formulas in the Formulas tab first.';
                    grid.appendChild(empty);
                    return;
                }
                filtered.forEach(item => grid.appendChild(_buildCard(item, true)));
            }
        }

        modal._redraw = _redraw;

        searchInp.addEventListener('input', _redraw);
        subjSel.addEventListener('change', _redraw);

        return modal;
    }

    /* ── Build a single formula card ─────────────────────────── */
    function _buildCard(item, isMine) {
        const card = document.createElement('div');
        card.className = 'p28-fml-card';

        const badges = document.createElement('div');
        badges.className = 'p28-fml-card-badges';

        if (isMine) {
            const b = document.createElement('span');
            b.className   = 'p28-fml-mine-badge';
            b.textContent = 'Mine';
            badges.appendChild(b);
        } else {
            const b = document.createElement('span');
            b.className   = 'p28-fml-subj-badge';
            b.textContent = item.subject;
            badges.appendChild(b);
        }
        card.appendChild(badges);

        const titleEl = document.createElement('div');
        titleEl.className   = 'p28-fml-card-title';
        titleEl.textContent = item.title || 'Untitled';
        card.appendChild(titleEl);

        const exprEl = document.createElement('div');
        exprEl.className   = 'p28-fml-card-expr';
        exprEl.textContent = item.formula || '';
        card.appendChild(exprEl);

        const addRow = document.createElement('div');
        addRow.className = 'p28-fml-card-add-row';
        const addBtn = document.createElement('button');
        addBtn.type      = 'button';
        addBtn.className = 'p28-fml-card-add-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to worksheet';
        addBtn.addEventListener('click', e => {
            e.stopPropagation();
            _addFormula(item, isMine);
        });
        addRow.appendChild(addBtn);
        card.appendChild(addRow);

        card.addEventListener('click', () => _addFormula(item, isMine));
        return card;
    }

    /* ── Open / close ─────────────────────────────────────────── */
    function _openModal() {
        const modal = _getModal();
        modal.classList.add('open');
        const searchInp = document.getElementById('p28-formula-search');
        if (searchInp) { searchInp.value = ''; }
        const subjSel = document.getElementById('p28-formula-subject');
        if (subjSel) { subjSel.value = ''; }
        if (modal._redraw) modal._redraw();
        setTimeout(() => { if (searchInp) searchInp.focus(); }, 80);
    }

    function _closeModal() {
        const modal = document.getElementById('p28-formula-modal');
        if (modal) modal.classList.remove('open');
    }

    /* Expose opener globally for picker button onclick */
    window.p28_openFormulaModal = _openModal;

    /* ── Patch p19_wbOpenPicker to:
          • Remove formula sections (p19 saved / p26 library)
          • Remove p27's formula renaming side-effect
          • Add a single "Formulas" button to Content blocks     ── */
    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function' || window._p28pickerDone) {
            if (!window._p28pickerDone) { setTimeout(_patchPicker, 400); return; }
            return;
        }
        window._p28pickerDone = true;
        const _origOpen = window.p19_wbOpenPicker;

        window.p19_wbOpenPicker = function() {
            _origOpen.apply(this, arguments);
            /* Run after patches26 and patches27 have injected their sections
               (both use ~80 ms timeouts, so 220 ms is safe) */
            setTimeout(() => {
                const sheet = document.getElementById('p19-ws-picker-sheet');
                if (!sheet) return;

                /* Remove old formula sections */
                sheet.querySelector('#p19-picker-formulas-sec')?.remove();
                sheet.querySelector('#p26-picker-lib-sec')?.remove();

                /* Add "Formulas" button to Content blocks grid if not already there */
                const blockTypes = sheet.querySelector('.p19-picker-block-types');
                if (blockTypes && !blockTypes.querySelector('.p28-picker-formula-btn')) {
                    const fBtn = document.createElement('button');
                    fBtn.type      = 'button';
                    fBtn.className = 'p19-picker-type-btn p28-picker-formula-btn';
                    fBtn.innerHTML = '<i class="fa-solid fa-square-root-variable"></i>Formulas';
                    fBtn.addEventListener('click', () => {
                        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
                        _openModal();
                    });
                    blockTypes.appendChild(fBtn);
                }
            }, 220);
        };
    }

    _patchPicker();
}

/* ================================================================
   3.  RESIZABLE BLOCKS
   ================================================================ */
function _p28_resizableBlocks() {

    function _getWs()    { return _p28dbG('os_worksheet', { blocks: [], savedValues: {} }); }
    function _saveWs(ws) { _p28dbS('os_worksheet', ws); }
    function _migrateWs(ws) {
        if (Array.isArray(ws.blocks)) return ws;
        return { blocks: [], savedValues: ws.savedValues || {} };
    }

    /* Apply stored heights to all blocks on the board */
    function _applyStoredHeights() {
        const board = document.getElementById('p19-ws-board');
        if (!board) return;
        const ws = _migrateWs(_getWs());
        (ws.blocks || []).forEach(block => {
            if (!block.height) return;
            const el = board.querySelector('[data-bid="' + CSS.escape(block.id) + '"]');
            if (el) el.style.minHeight = block.height + 'px';
        });
    }

    /* Attach a resize handle to every .p19-ws-block that doesn't have one yet */
    function _attachHandles() {
        document.querySelectorAll('.p19-ws-block:not([data-p28resize])').forEach(blockEl => {
            blockEl.dataset.p28resize = '1';

            const handle = document.createElement('div');
            handle.className = 'p28-resize-handle';
            blockEl.appendChild(handle);

            handle.addEventListener('pointerdown', e => {
                e.preventDefault();
                e.stopPropagation();
                handle.classList.add('dragging');

                const startY  = e.clientY;
                const startH  = blockEl.offsetHeight;

                const onMove = ev => {
                    const newH = Math.max(60, startH + (ev.clientY - startY));
                    blockEl.style.minHeight = newH + 'px';
                };

                const onUp = ev => {
                    handle.classList.remove('dragging');
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);

                    const newH = Math.max(60, startH + (ev.clientY - startY));
                    /* Save height to block data */
                    const bid = blockEl.dataset.bid;
                    if (!bid) return;
                    const ws = _migrateWs(_getWs());
                    const b  = (ws.blocks || []).find(x => x.id === bid);
                    if (b) b.height = newH;
                    _saveWs(ws);
                };

                handle.setPointerCapture(e.pointerId);
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
            });
        });
    }

    /* Patch p19_wbRender to apply heights and add handles after each render */
    function _patchRender() {
        if (typeof window.p19_wbRender !== 'function' || window._p28resizeDone) {
            if (!window._p28resizeDone) { setTimeout(_patchRender, 400); return; }
            return;
        }
        window._p28resizeDone = true;
        const _origRender = window.p19_wbRender;

        window.p19_wbRender = function() {
            _origRender.apply(this, arguments);
            /* Short delay so patches27's render hook also runs first */
            requestAnimationFrame(() => {
                _applyStoredHeights();
                _attachHandles();
                _p28_injectEmptyState();
            });
        };
    }

    /* Also observe DOM for blocks added by patches27's render hook */
    const _resizeObs = new MutationObserver(() => {
        _attachHandles();
    });

    function _startObs() {
        const board = document.getElementById('p19-ws-board');
        if (board) {
            _resizeObs.observe(board, { childList: true });
        } else {
            setTimeout(_startObs, 600);
        }
    }
    _startObs();

    _patchRender();
}

/* ================================================================
   4.  CHECKLIST & CODE BLOCK TYPES
   ================================================================ */
function _p28_newBlockTypes() {

    function _getWs()    { return _p28dbG('os_worksheet', { blocks: [], savedValues: {} }); }
    function _saveWs(ws) { _p28dbS('os_worksheet', ws); }
    function _migrateWs(ws) {
        if (Array.isArray(ws.blocks)) return ws;
        return { blocks: [], savedValues: ws.savedValues || {} };
    }
    function _render() { if (typeof window.p19_wbRender === 'function') window.p19_wbRender(); }

    function _makeActions(bid) {
        const wrap   = document.createElement('div');
        wrap.className = 'p19-ws-block-actions';
        const handle = document.createElement('button');
        handle.type      = 'button';
        handle.className = 'p19-ws-block-btn handle';
        handle.dataset.p19action = 'drag';
        handle.dataset.bid       = bid;
        handle.title     = 'Drag to reorder';
        handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        const del = document.createElement('button');
        del.type      = 'button';
        del.className = 'p19-ws-block-btn del';
        del.dataset.p19action = 'del-block';
        del.dataset.bid       = bid;
        del.title     = 'Delete block';
        del.innerHTML = '<i class="fa-solid fa-trash"></i>';
        wrap.appendChild(handle);
        wrap.appendChild(del);
        return wrap;
    }

    /* ================================================================
       CHECKLIST BLOCK
       data: { id, type:'checklist', title:'', items:[{id,text,done}] }
    ================================================================ */
    function _buildChecklistBlock(block) {
        block.items = block.items || [];

        const el     = document.createElement('div');
        el.className = 'p19-ws-block p28-checklist-block';
        el.dataset.bid = block.id;
        el.appendChild(_makeActions(block.id));

        /* Title input */
        const titleInp = document.createElement('input');
        titleInp.type        = 'text';
        titleInp.className   = 'p28-checklist-title-inp';
        titleInp.placeholder = 'List title (optional)…';
        titleInp.value       = block.title || '';
        titleInp.addEventListener('change', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (b) b.title = titleInp.value;
            _saveWs(ws);
        });
        el.appendChild(titleInp);

        /* Items list */
        const itemsEl = document.createElement('div');
        itemsEl.className = 'p28-checklist-items';

        function _renderItems() {
            itemsEl.innerHTML = '';
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            const items = b ? (b.items || []) : (block.items || []);

            items.forEach((item, idx) => {
                const row = document.createElement('div');
                row.className = 'p28-checklist-item';

                const cb = document.createElement('input');
                cb.type      = 'checkbox';
                cb.className = 'p28-checklist-item-cb';
                cb.checked   = !!item.done;
                cb.addEventListener('change', () => {
                    const ws2 = _migrateWs(_getWs());
                    const b2  = ws2.blocks.find(x => x.id === block.id);
                    if (b2 && b2.items && b2.items[idx]) b2.items[idx].done = cb.checked;
                    _saveWs(ws2);
                    textInp.classList.toggle('done', cb.checked);
                    _updateStats();
                });

                const textInp = document.createElement('input');
                textInp.type      = 'text';
                textInp.className = 'p28-checklist-item-text' + (item.done ? ' done' : '');
                textInp.value     = item.text || '';
                textInp.placeholder = 'Task…';
                textInp.addEventListener('change', () => {
                    const ws2 = _migrateWs(_getWs());
                    const b2  = ws2.blocks.find(x => x.id === block.id);
                    if (b2 && b2.items && b2.items[idx]) b2.items[idx].text = textInp.value;
                    _saveWs(ws2);
                });
                /* Enter = add new item below */
                textInp.addEventListener('keydown', ev => {
                    if (ev.key !== 'Enter') return;
                    ev.preventDefault();
                    const ws2 = _migrateWs(_getWs());
                    const b2  = ws2.blocks.find(x => x.id === block.id);
                    if (!b2) return;
                    b2.items = b2.items || [];
                    b2.items.splice(idx + 1, 0, { id: _p28id(), text: '', done: false });
                    _saveWs(ws2);
                    block.items = b2.items;
                    _renderItems();
                    const newRow = itemsEl.querySelectorAll('.p28-checklist-item')[idx + 1];
                    if (newRow) newRow.querySelector('.p28-checklist-item-text')?.focus();
                });

                const delBtn = document.createElement('button');
                delBtn.type      = 'button';
                delBtn.className = 'p28-checklist-item-del';
                delBtn.title     = 'Delete item';
                delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                delBtn.addEventListener('click', () => {
                    const ws2 = _migrateWs(_getWs());
                    const b2  = ws2.blocks.find(x => x.id === block.id);
                    if (b2 && b2.items) b2.items.splice(idx, 1);
                    _saveWs(ws2);
                    block.items = b2?.items || [];
                    _renderItems();
                });

                row.appendChild(cb);
                row.appendChild(textInp);
                row.appendChild(delBtn);
                itemsEl.appendChild(row);
            });

            _updateStats();
        }

        el.appendChild(itemsEl);

        /* Stats line */
        const stats = document.createElement('div');
        stats.className = 'p28-checklist-stats';
        el.appendChild(stats);

        function _updateStats() {
            const ws2 = _migrateWs(_getWs());
            const b2  = ws2.blocks.find(x => x.id === block.id);
            const items = b2 ? (b2.items || []) : [];
            const done  = items.filter(i => i.done).length;
            stats.textContent = items.length
                ? done + ' / ' + items.length + ' completed'
                : '';
        }

        /* Add item button */
        const addBtn = document.createElement('button');
        addBtn.type      = 'button';
        addBtn.className = 'p28-checklist-add-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add item';
        addBtn.addEventListener('click', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            b.items = b.items || [];
            b.items.push({ id: _p28id(), text: '', done: false });
            _saveWs(ws);
            block.items = b.items;
            _renderItems();
            const last = itemsEl.lastElementChild;
            if (last) last.querySelector('.p28-checklist-item-text')?.focus();
        });
        el.appendChild(addBtn);

        _renderItems();
        return el;
    }

    /* ================================================================
       CODE BLOCK
       data: { id, type:'code', content:'', language:'text' }
    ================================================================ */
    const CODE_LANGUAGES = [
        { value: 'text',       label: 'Plain text' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'python',     label: 'Python' },
        { value: 'html',       label: 'HTML' },
        { value: 'css',        label: 'CSS' },
        { value: 'sql',        label: 'SQL' },
        { value: 'java',       label: 'Java' },
        { value: 'cpp',        label: 'C++' },
        { value: 'c',          label: 'C' },
        { value: 'bash',       label: 'Bash / Shell' },
        { value: 'json',       label: 'JSON' },
        { value: 'markdown',   label: 'Markdown' },
    ];

    function _buildCodeBlock(block) {
        const el     = document.createElement('div');
        el.className = 'p19-ws-block p28-code-block';
        el.dataset.bid = block.id;
        el.appendChild(_makeActions(block.id));

        /* Toolbar */
        const toolbar = document.createElement('div');
        toolbar.className = 'p28-code-toolbar';

        const langSel = document.createElement('select');
        langSel.className = 'p28-code-lang-sel';
        CODE_LANGUAGES.forEach(lang => {
            const opt = document.createElement('option');
            opt.value       = lang.value;
            opt.textContent = lang.label;
            opt.selected    = lang.value === (block.language || 'text');
            langSel.appendChild(opt);
        });
        langSel.addEventListener('change', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (b) b.language = langSel.value;
            _saveWs(ws);
        });

        const copyBtn = document.createElement('button');
        copyBtn.type      = 'button';
        copyBtn.className = 'p28-code-copy-btn';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.addEventListener('click', () => {
            const text = ta.value;
            if (!text) return;
            navigator.clipboard?.writeText(text).then(
                () => _p28toast('Code copied to clipboard'),
                () => {
                    /* Fallback */
                    const tmp = document.createElement('textarea');
                    tmp.value = text;
                    document.body.appendChild(tmp);
                    tmp.select();
                    document.execCommand('copy');
                    tmp.remove();
                    _p28toast('Code copied to clipboard');
                }
            );
        });

        toolbar.appendChild(langSel);
        toolbar.appendChild(copyBtn);
        el.appendChild(toolbar);

        /* Code textarea */
        const ta = document.createElement('textarea');
        ta.className   = 'p28-code-textarea';
        ta.placeholder = '// Paste or type code here…';
        ta.value       = block.content || '';
        ta.spellcheck  = false;

        /* Auto-grow */
        function _autoGrow() {
            ta.style.height = 'auto';
            ta.style.height = Math.max(100, ta.scrollHeight) + 'px';
        }
        ta.addEventListener('input', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (b) b.content = ta.value;
            _saveWs(ws);
            _autoGrow();
        });
        /* Tab key inserts spaces */
        ta.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = ta.selectionStart;
                const end   = ta.selectionEnd;
                ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
                ta.selectionStart = ta.selectionEnd = start + 2;
            }
        });
        el.appendChild(ta);
        requestAnimationFrame(_autoGrow);

        return el;
    }

    const NEW_TYPES = new Set(['checklist', 'code']);

    /* ── Patch p19_wbRender to render new types ───────────────── */
    function _patchRender() {
        if (typeof window.p19_wbRender !== 'function' || window._p28blocksDone) {
            if (!window._p28blocksDone) { setTimeout(_patchRender, 400); return; }
            return;
        }
        window._p28blocksDone = true;
        const _origRender = window.p19_wbRender;

        window.p19_wbRender = function() {
            _origRender.apply(this, arguments);
            const board = document.getElementById('p19-ws-board');
            if (!board) return;
            const ws       = _p28dbG('os_worksheet', { blocks: [], savedValues: {} });
            const migrated = Array.isArray(ws.blocks) ? ws : { blocks: [] };

            (migrated.blocks || []).forEach(block => {
                if (!NEW_TYPES.has(block.type)) return;
                if (board.querySelector('[data-bid="' + CSS.escape(block.id) + '"]')) return;

                let el = null;
                if (block.type === 'checklist') el = _buildChecklistBlock(block);
                if (block.type === 'code')      el = _buildCodeBlock(block);
                if (!el) return;

                /* Insert in correct position */
                const idx = migrated.blocks.indexOf(block);
                if (idx === 0) {
                    board.insertBefore(el, board.firstChild);
                } else {
                    const prevBlock = migrated.blocks[idx - 1];
                    const prevEl    = prevBlock
                        ? board.querySelector('[data-bid="' + CSS.escape(prevBlock.id) + '"]')
                        : null;
                    if (prevEl) prevEl.after(el);
                    else board.appendChild(el);
                }
            });
        };
    }

    /* ── Patch picker to add Checklist & Code buttons ─────────── */
    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function' || window._p28newTypesPickerDone) {
            if (!window._p28newTypesPickerDone) { setTimeout(_patchPicker, 400); return; }
            return;
        }
        window._p28newTypesPickerDone = true;
        const _origOpen = window.p19_wbOpenPicker;

        window.p19_wbOpenPicker = function() {
            _origOpen.apply(this, arguments);
            setTimeout(() => {
                const sheet = document.getElementById('p19-ws-picker-sheet');
                if (!sheet) return;
                sheet.querySelector('#p28-new-types-sec')?.remove();

                const sec = document.createElement('div');
                sec.className = 'p19-picker-section';
                sec.id        = 'p28-new-types-sec';

                const hdr = document.createElement('div');
                hdr.className   = 'p19-picker-section-hdr';
                hdr.textContent = 'Checklists & Code';
                sec.appendChild(hdr);

                const grid = document.createElement('div');
                grid.className = 'p19-picker-block-types';

                [
                    { type: 'checklist', icon: 'list-check',        label: 'Checklist'   },
                    { type: 'code',      icon: 'code',               label: 'Code'        },
                ].forEach(({ type, icon, label }) => {
                    const btn = document.createElement('button');
                    btn.type      = 'button';
                    btn.className = 'p19-picker-type-btn';
                    btn.innerHTML = '<i class="fa-solid fa-' + icon + '"></i>' + label;
                    btn.addEventListener('click', () => _addBlock(type));
                    grid.appendChild(btn);
                });

                sec.appendChild(grid);
                /* Insert before the p27 utilities section if it exists */
                const p27sec = sheet.querySelector('#p27-picker-sec');
                if (p27sec) sheet.insertBefore(sec, p27sec);
                else sheet.appendChild(sec);
            }, 240);
        };
    }

    function _addBlock(type) {
        const ws = _p28dbG('os_worksheet', { blocks: [], savedValues: {} });
        ws.blocks = ws.blocks || [];
        if (ws.blocks.some(b => b.type === type)) return;
        const id  = _p28id();
        if (type === 'checklist') {
            ws.blocks.push({ id, type: 'checklist', title: '', items: [] });
        } else if (type === 'code') {
            ws.blocks.push({ id, type: 'code', content: '', language: 'text' });
        }
        _p28dbS('os_worksheet', ws);
        if (typeof window.p19_wbRender    === 'function') window.p19_wbRender();
        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
    }

    _patchRender();
    _patchPicker();
}

/* ================================================================
   5.  WORKSHEET UX POLISH
   ================================================================ */

/* Empty state: show hint when board has no real blocks */
function _p28_injectEmptyState() {
    const board = document.getElementById('p19-ws-board');
    if (!board) return;

    document.getElementById('p28-ws-empty-state')?.remove();

    const realBlocks = board.querySelectorAll('[data-bid]');
    if (realBlocks.length > 0) return;

    const shortcut = _p28_shortcutLabel();
    const es = document.createElement('div');
    es.id          = 'p28-ws-empty-state';
    es.innerHTML   = '<i class="fa-solid fa-layer-group"></i>'
                   + '<p>Your worksheet is empty.<br>Click <strong>Add block</strong> or press <kbd>' + shortcut + '+Enter</kbd> to begin.</p>';
    board.insertBefore(es, board.firstChild);
}

/* Keyboard shortcut: Ctrl+Enter (or Cmd+Enter on Mac) opens the block picker */
function _p28_keyboardShortcut() {
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const board = document.getElementById('p19-ws-board');
            if (!board) return;
            if (!board.closest('#view-worksheet')) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.p19_wbOpenPicker === 'function') window.p19_wbOpenPicker();
        }
    });
}

/* Platform-aware shortcut label (Ctrl on Windows/Linux, Cmd on Mac) */
function _p28_shortcutLabel() {
    return /mac/i.test(navigator.platform || navigator.userAgentData?.platform || '') ? 'Cmd' : 'Ctrl';
}

/* ================================================================
   INIT
   ================================================================ */
(function _p28_init() {
    const _go = () => {
        _p28_undoAttendanceP27();
        _p28_formulaModal();
        _p28_resizableBlocks();
        _p28_newBlockTypes();
        _p28_keyboardShortcut();
        console.log('[patches28] loaded — formula modal, resizable blocks, checklist/code blocks, p27 attendance undo');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 400));
    } else {
        setTimeout(_go, 400);
    }
})();
