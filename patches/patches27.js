/* ================================================================
   StudentOS — patches27.js
   1.  Worksheet new block types:
       - table      — editable grid (rows × cols, optional header)
       - callout    — styled highlight box (info / tip / warning / success / error)
       - flashcard  — flip-card deck for studying
       - calc       — quick multi-line expression calculator
       - timer      — countdown / Pomodoro timer with ring display
   2.  Formula block improvements:
       - Rename "Formula steps" → "Saved formulas" in picker
       - Auto-compute when all known variables are filled in
   3.  Attendance calendar enhancements:
       - "Today" jump button on month nav
       - 30-day heat strip below each month calendar
       - Streak counter badge on each course card
   ================================================================ */

'use strict';

/* ── constants ────────────────────────────────────────────────── */
const _P27_TIMER_PRESETS  = [
    { label: '5m',  sec: 300  },
    { label: '10m', sec: 600  },
    { label: '25m', sec: 1500 },
    { label: '45m', sec: 2700 },
    { label: '60m', sec: 3600 },
];
const _P27_TIMER_DEFAULT  = 1500; /* 25 minutes */
const _P27_MAX_STREAK_DAYS = 365;

/* ── helpers ──────────────────────────────────────────────────── */
const _p27lsG   = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p27lsS   = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p27dbG   = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p27lsG(k, d); } catch { return d; } };
const _p27dbS   = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p27lsS(k, v); } catch {} };
const _p27id    = () => Math.random().toString(36).slice(2, 10);
const _p27toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const _p27date  = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ================================================================
   1.  NEW WORKSHEET BLOCK TYPES
   ================================================================ */
function _p27_newBlockTypes() {

    /* ── Worksheet data helpers ──────────────────────────────── */
    function _getWs()    { return _p27dbG('os_worksheet', { blocks: [], savedValues: {} }); }
    function _saveWs(ws) { _p27dbS('os_worksheet', ws); }
    function _migrateWs(ws) {
        if (Array.isArray(ws.blocks)) return ws;
        return { blocks: (ws.steps || []).map(s => ({ id: s.id || _p27id(), type: 'text', content: s.content || '' })), savedValues: ws.savedValues || {} };
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
       TABLE BLOCK
       data: { id, type:'table', rows: string[][], hasHeader: boolean }
    ================================================================ */
    function _buildTableBlock(block) {
        const el     = document.createElement('div');
        el.className = 'p19-ws-block p27-table-block';
        el.dataset.bid = block.id;
        el.appendChild(_makeActions(block.id));

        block.rows     = block.rows     || [['Column A', 'Column B'], ['', '']];
        block.hasHeader = block.hasHeader !== false;

        /* Toolbar */
        const toolbar = document.createElement('div');
        toolbar.className = 'p27-table-toolbar';

        function _refreshBlock() {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (b) { block.rows = b.rows; block.hasHeader = b.hasHeader; }
            _saveWs(ws);
            _render();
        }

        const addRowBtn = document.createElement('button');
        addRowBtn.type      = 'button';
        addRowBtn.className = 'p27-table-btn';
        addRowBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Row';
        addRowBtn.addEventListener('click', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            const nc = Math.max(...(b.rows || [[]]).map(r => r.length), 1);
            (b.rows = b.rows || []).push(Array(nc).fill(''));
            _refreshBlock();
        });

        const addColBtn = document.createElement('button');
        addColBtn.type      = 'button';
        addColBtn.className = 'p27-table-btn';
        addColBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Column';
        addColBtn.addEventListener('click', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            (b.rows = b.rows || []).forEach(r => r.push(''));
            _refreshBlock();
        });

        const headerToggle = document.createElement('button');
        headerToggle.type      = 'button';
        headerToggle.className = 'p27-table-btn' + (block.hasHeader ? ' active' : '');
        headerToggle.innerHTML = '<i class="fa-solid fa-table-columns"></i> Header row';
        headerToggle.addEventListener('click', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            b.hasHeader = !b.hasHeader;
            _refreshBlock();
        });

        toolbar.appendChild(addRowBtn);
        toolbar.appendChild(addColBtn);
        toolbar.appendChild(headerToggle);
        el.appendChild(toolbar);

        /* Table */
        const wrap  = document.createElement('div');
        wrap.className = 'p27-table-wrap';
        const table = document.createElement('table');
        table.className = 'p27-table';

        const rows = block.rows || [];
        const cols = Math.max(...rows.map(r => r.length), 1);

        rows.forEach((row, ri) => {
            const tr = document.createElement('tr');
            for (let ci = 0; ci < cols; ci++) {
                const isHeader = ri === 0 && block.hasHeader;
                const td  = document.createElement(isHeader ? 'th' : 'td');
                td.className = isHeader ? 'p27-table-th' : 'p27-table-td';
                const inp = document.createElement('input');
                inp.type        = 'text';
                inp.className   = 'p27-table-cell-inp';
                inp.value       = row[ci] !== undefined ? row[ci] : '';
                inp.placeholder = isHeader ? 'Header' : '';
                inp.addEventListener('change', () => {
                    const ws = _migrateWs(_getWs());
                    const b  = ws.blocks.find(x => x.id === block.id);
                    if (b && b.rows && b.rows[ri]) b.rows[ri][ci] = inp.value;
                    _saveWs(ws);
                });
                td.appendChild(inp);
                tr.appendChild(td);
            }
            /* Delete row button */
            if (rows.length > 1) {
                const delTd  = document.createElement('td');
                delTd.className = 'p27-table-del-cell';
                const delBtn = document.createElement('button');
                delBtn.type      = 'button';
                delBtn.className = 'p27-table-del-row-btn';
                delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                delBtn.title     = 'Delete row';
                delBtn.addEventListener('click', () => {
                    const ws = _migrateWs(_getWs());
                    const b  = ws.blocks.find(x => x.id === block.id);
                    if (!b || !b.rows) return;
                    b.rows.splice(ri, 1);
                    _refreshBlock();
                });
                delTd.appendChild(delBtn);
                tr.appendChild(delTd);
            }
            table.appendChild(tr);
        });

        /* Delete-column strip below table */
        if (cols > 1) {
            const strip = document.createElement('div');
            strip.className = 'p27-table-del-col-strip';
            for (let ci = 0; ci < cols; ci++) {
                const btn = document.createElement('button');
                btn.type      = 'button';
                btn.className = 'p27-table-del-col-btn';
                btn.title     = 'Delete column ' + (ci + 1);
                btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                btn.addEventListener('click', () => {
                    const ws = _migrateWs(_getWs());
                    const b  = ws.blocks.find(x => x.id === block.id);
                    if (!b) return;
                    (b.rows || []).forEach(r => r.splice(ci, 1));
                    _refreshBlock();
                });
                strip.appendChild(btn);
            }
            /* placeholder for the delete-row column */
            if (rows.length > 1) strip.appendChild(document.createElement('div'));
            wrap.appendChild(table);
            wrap.appendChild(strip);
        } else {
            wrap.appendChild(table);
        }

        el.appendChild(wrap);
        return el;
    }

    /* ================================================================
       CALLOUT BLOCK
       data: { id, type:'callout', content: '', variant: 'info' }
    ================================================================ */
    const CALLOUT_VARIANTS = {
        info:    { icon: 'circle-info',          label: 'Info',    color: '#3b82f6' },
        tip:     { icon: 'lightbulb',             label: 'Tip',     color: '#8b5cf6' },
        warning: { icon: 'triangle-exclamation',  label: 'Warning', color: '#f59e0b' },
        success: { icon: 'circle-check',          label: 'Success', color: '#22c55e' },
        error:   { icon: 'circle-xmark',          label: 'Error',   color: '#ef4444' },
    };

    function _buildCalloutBlock(block) {
        const v    = block.variant || 'info';
        const meta = CALLOUT_VARIANTS[v] || CALLOUT_VARIANTS.info;

        const el     = document.createElement('div');
        el.className = 'p19-ws-block p27-callout-block p27-callout-' + v;
        el.dataset.bid = block.id;
        el.style.setProperty('--p27c', meta.color);
        el.appendChild(_makeActions(block.id));

        const hdr   = document.createElement('div');
        hdr.className = 'p27-callout-hdr';

        const icon  = document.createElement('i');
        icon.className = 'fa-solid fa-' + meta.icon + ' p27-callout-icon';

        const label = document.createElement('span');
        label.className   = 'p27-callout-label';
        label.textContent = meta.label;

        const sel = document.createElement('select');
        sel.className = 'p27-callout-variant-sel';
        Object.entries(CALLOUT_VARIANTS).forEach(([key, m]) => {
            const opt = document.createElement('option');
            opt.value       = key;
            opt.textContent = m.label;
            opt.selected    = key === v;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (b) b.variant = sel.value;
            _saveWs(ws);
            _render();
        });

        hdr.appendChild(icon);
        hdr.appendChild(label);
        hdr.appendChild(sel);
        el.appendChild(hdr);

        const ta = document.createElement('textarea');
        ta.className   = 'p27-callout-textarea';
        ta.placeholder = 'Write your note here...';
        ta.value       = block.content || '';
        ta.addEventListener('input', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (b) b.content = ta.value;
            _saveWs(ws);
        });
        el.appendChild(ta);

        return el;
    }

    /* ================================================================
       FLASHCARD BLOCK
       data: { id, type:'flashcard', cards: [{front, back}] }
    ================================================================ */
    function _buildFlashcardBlock(block) {
        block.cards = block.cards || [{ front: '', back: '' }];

        const el     = document.createElement('div');
        el.className = 'p19-ws-block p27-fc-block';
        el.dataset.bid = block.id;
        el.appendChild(_makeActions(block.id));

        let currentIdx = 0;
        let flipped    = false;

        /* Card area */
        const cardArea  = document.createElement('div');
        cardArea.className = 'p27-fc-card-area';

        const cardInner = document.createElement('div');
        cardInner.className = 'p27-fc-card-inner';

        const cardFront = document.createElement('div');
        cardFront.className = 'p27-fc-card-face p27-fc-front';

        const cardBack = document.createElement('div');
        cardBack.className = 'p27-fc-card-face p27-fc-back';

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        cardArea.appendChild(cardInner);

        const counter = document.createElement('div');
        counter.className = 'p27-fc-counter';

        function _updateCard() {
            const cards = block.cards || [];
            if (!cards.length) {
                cardFront.innerHTML = '<span class="p27-fc-empty"><i class="fa-solid fa-layer-group"></i> No cards — click + Card to add one</span>';
                cardBack.innerHTML  = '';
                counter.textContent = '0 / 0';
                return;
            }
            const card = cards[currentIdx] || { front: '', back: '' };

            cardFront.innerHTML = '';
            cardBack.innerHTML  = '';

            const frontLabel = document.createElement('div');
            frontLabel.className   = 'p27-fc-side-label';
            frontLabel.innerHTML   = '<i class="fa-solid fa-eye"></i> Front';

            const frontTA = document.createElement('textarea');
            frontTA.className   = 'p27-fc-textarea';
            frontTA.placeholder = 'Front of card...';
            frontTA.value       = card.front || '';
            frontTA.addEventListener('input', () => {
                const ws = _migrateWs(_getWs());
                const b  = ws.blocks.find(x => x.id === block.id);
                if (b && b.cards && b.cards[currentIdx]) { b.cards[currentIdx].front = frontTA.value; card.front = frontTA.value; }
                _saveWs(ws);
            });

            const backLabel = document.createElement('div');
            backLabel.className   = 'p27-fc-side-label back';
            backLabel.innerHTML   = '<i class="fa-solid fa-rotate"></i> Back';

            const backTA = document.createElement('textarea');
            backTA.className   = 'p27-fc-textarea';
            backTA.placeholder = 'Back of card (answer)...';
            backTA.value       = card.back || '';
            backTA.addEventListener('input', () => {
                const ws = _migrateWs(_getWs());
                const b  = ws.blocks.find(x => x.id === block.id);
                if (b && b.cards && b.cards[currentIdx]) { b.cards[currentIdx].back = backTA.value; card.back = backTA.value; }
                _saveWs(ws);
            });

            cardFront.appendChild(frontLabel);
            cardFront.appendChild(frontTA);
            cardBack.appendChild(backLabel);
            cardBack.appendChild(backTA);

            counter.textContent = (currentIdx + 1) + ' / ' + cards.length;

            /* Reset flip when changing card */
            if (flipped) { cardInner.classList.remove('flipped'); flipped = false; }
        }

        /* Click card to flip */
        cardArea.addEventListener('click', e => {
            if (e.target.tagName === 'TEXTAREA') return;
            flipped = !flipped;
            cardInner.classList.toggle('flipped', flipped);
        });

        /* Navigation bar */
        const nav = document.createElement('div');
        nav.className = 'p27-fc-nav';

        const prevBtn = document.createElement('button');
        prevBtn.type      = 'button';
        prevBtn.className = 'p27-fc-nav-btn';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.title     = 'Previous card';
        prevBtn.addEventListener('click', () => {
            const cards = block.cards || [];
            if (!cards.length) return;
            currentIdx = (currentIdx - 1 + cards.length) % cards.length;
            _updateCard();
        });

        const flipBtn = document.createElement('button');
        flipBtn.type      = 'button';
        flipBtn.className = 'p27-fc-nav-btn flip';
        flipBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Flip';
        flipBtn.addEventListener('click', () => {
            flipped = !flipped;
            cardInner.classList.toggle('flipped', flipped);
        });

        const nextBtn = document.createElement('button');
        nextBtn.type      = 'button';
        nextBtn.className = 'p27-fc-nav-btn';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.title     = 'Next card';
        nextBtn.addEventListener('click', () => {
            const cards = block.cards || [];
            if (!cards.length) return;
            currentIdx = (currentIdx + 1) % cards.length;
            _updateCard();
        });

        const addCardBtn = document.createElement('button');
        addCardBtn.type      = 'button';
        addCardBtn.className = 'p27-fc-nav-btn add';
        addCardBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Card';
        addCardBtn.addEventListener('click', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            b.cards = b.cards || [];
            b.cards.push({ front: '', back: '' });
            block.cards = b.cards;
            _saveWs(ws);
            currentIdx = b.cards.length - 1;
            _updateCard();
        });

        const delCardBtn = document.createElement('button');
        delCardBtn.type      = 'button';
        delCardBtn.className = 'p27-fc-nav-btn del';
        delCardBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delCardBtn.title     = 'Delete this card';
        delCardBtn.addEventListener('click', () => {
            const cards = block.cards || [];
            if (!cards.length) return;
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            b.cards.splice(currentIdx, 1);
            block.cards = b.cards;
            _saveWs(ws);
            currentIdx = Math.min(currentIdx, Math.max(0, b.cards.length - 1));
            _updateCard();
        });

        nav.appendChild(prevBtn);
        nav.appendChild(flipBtn);
        nav.appendChild(counter);
        nav.appendChild(nextBtn);
        nav.appendChild(addCardBtn);
        nav.appendChild(delCardBtn);

        el.appendChild(cardArea);
        el.appendChild(nav);
        _updateCard();
        return el;
    }

    /* ================================================================
       QUICK CALCULATOR BLOCK
       data: { id, type:'calc', lines: [{expr, result}] }
    ================================================================ */
    function _evalExpr(raw) {
        let e = (raw || '').trim().replace(/#.*$/, '').trim();
        if (!e) return null;
        e = e.replace(/\^/g, '**')
             .replace(/\batan2\b/g, 'Math.atan2')
             .replace(/\basin\b/g, 'Math.asin')
             .replace(/\bacos\b/g, 'Math.acos')
             .replace(/\batan\b/g, 'Math.atan')
             .replace(/\bsinh\b/g, 'Math.sinh')
             .replace(/\bcosh\b/g, 'Math.cosh')
             .replace(/\btanh\b/g, 'Math.tanh')
             .replace(/\bsin\b/g,  'Math.sin')
             .replace(/\bcos\b/g,  'Math.cos')
             .replace(/\btan\b/g,  'Math.tan')
             .replace(/\bsqrt\b/g, 'Math.sqrt')
             .replace(/\bcbrt\b/g, 'Math.cbrt')
             .replace(/\babs\b/g,  'Math.abs')
             .replace(/\blog10\b/g,'Math.log10')
             .replace(/\blog2\b/g, 'Math.log2')
             .replace(/\blog\b/g,  'Math.log')
             .replace(/\bexp\b/g,  'Math.exp')
             .replace(/\bfloor\b/g,'Math.floor')
             .replace(/\bceil\b/g, 'Math.ceil')
             .replace(/\bround\b/g,'Math.round')
             .replace(/\bpow\b/g,  'Math.pow')
             .replace(/\bmin\b/g,  'Math.min')
             .replace(/\bmax\b/g,  'Math.max')
             .replace(/\bpi\b/gi,  'Math.PI')
             .replace(/\be\b/g,    'Math.E');
        try {
            /* eslint-disable-next-line no-new-func */
            const r = new Function('return (' + e + ')')();
            if (r === undefined || r === null) return null;
            if (!isFinite(r)) return isNaN(r) ? 'NaN' : (r > 0 ? 'Inf' : '-Inf');
            return r;
        } catch { return null; }
    }

    function _fmtResult(n) {
        if (typeof n === 'string') return n;
        if (n === null || n === undefined) return '';
        if (Number.isInteger(n) || Math.abs(n) >= 1e12) return String(n);
        const rounded = Math.round(n * 1e10) / 1e10;
        return String(rounded);
    }

    function _buildCalcBlock(block) {
        block.lines = block.lines || [{ expr: '', result: null }];

        const el     = document.createElement('div');
        el.className = 'p19-ws-block p27-calc-block';
        el.dataset.bid = block.id;
        el.appendChild(_makeActions(block.id));

        const hdr = document.createElement('div');
        hdr.className = 'p27-calc-hdr';
        hdr.innerHTML = '<i class="fa-solid fa-calculator"></i><span>Quick Calculator</span>';
        el.appendChild(hdr);

        const linesDiv = document.createElement('div');
        linesDiv.className = 'p27-calc-lines';

        function _saveLines() {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === block.id);
            if (!b) return;
            b.lines = block.lines.map(l => ({ expr: l.expr, result: l.result }));
            _saveWs(ws);
        }

        function _renderLines() {
            linesDiv.innerHTML = '';
            block.lines.forEach((line, idx) => {
                const row = document.createElement('div');
                row.className = 'p27-calc-row';

                const inp = document.createElement('input');
                inp.type        = 'text';
                inp.className   = 'p27-calc-inp';
                inp.placeholder = idx === 0 ? 'e.g.  2 * (3 + 4)  or  sqrt(16)' : 'expression...';
                inp.value       = line.expr;
                inp.autocomplete = 'off';

                const eq = document.createElement('div');
                eq.className   = 'p27-calc-eq';
                eq.textContent = '=';

                const resultEl = document.createElement('div');
                resultEl.className   = 'p27-calc-result' + (line.result !== null && line.result !== undefined && line.result !== '' ? ' has-val' : '');
                resultEl.textContent = _fmtResult(line.result);

                const delBtn = document.createElement('button');
                delBtn.type      = 'button';
                delBtn.className = 'p27-calc-del-btn';
                delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                delBtn.title     = 'Remove line';
                delBtn.addEventListener('click', () => {
                    if (block.lines.length <= 1) {
                        block.lines[0].expr   = '';
                        block.lines[0].result = null;
                        _renderLines(); _saveLines(); return;
                    }
                    block.lines.splice(idx, 1);
                    _renderLines(); _saveLines();
                });

                inp.addEventListener('input', () => {
                    line.expr   = inp.value;
                    const r     = _evalExpr(inp.value);
                    line.result = r;
                    resultEl.textContent = _fmtResult(r);
                    resultEl.classList.toggle('has-val', r !== null && r !== undefined && r !== '');
                    _saveLines();
                });

                inp.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        block.lines.splice(idx + 1, 0, { expr: '', result: null });
                        _renderLines(); _saveLines();
                        setTimeout(() => {
                            const inputs = linesDiv.querySelectorAll('.p27-calc-inp');
                            if (inputs[idx + 1]) inputs[idx + 1].focus();
                        }, 0);
                    } else if (e.key === 'Backspace' && !inp.value && block.lines.length > 1) {
                        e.preventDefault();
                        block.lines.splice(idx, 1);
                        _renderLines(); _saveLines();
                        setTimeout(() => {
                            const inputs = linesDiv.querySelectorAll('.p27-calc-inp');
                            const target = inputs[Math.max(0, idx - 1)];
                            if (target) { target.focus(); target.setSelectionRange(target.value.length, target.value.length); }
                        }, 0);
                    }
                });

                row.appendChild(inp);
                row.appendChild(eq);
                row.appendChild(resultEl);
                row.appendChild(delBtn);
                linesDiv.appendChild(row);
            });
        }

        el.appendChild(linesDiv);
        _renderLines();

        const addLineBtn = document.createElement('button');
        addLineBtn.type      = 'button';
        addLineBtn.className = 'p27-calc-add-btn';
        addLineBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add line';
        addLineBtn.addEventListener('click', () => {
            block.lines.push({ expr: '', result: null });
            _renderLines(); _saveLines();
            setTimeout(() => {
                const inputs = linesDiv.querySelectorAll('.p27-calc-inp');
                if (inputs[inputs.length - 1]) inputs[inputs.length - 1].focus();
            }, 0);
        });
        el.appendChild(addLineBtn);

        return el;
    }

    /* ================================================================
       COUNTDOWN TIMER BLOCK
       data: { id, type:'timer', label: 'Focus', duration: 1500 }
    ================================================================ */
    const _timerState = {}; /* bid → { remaining, running, intervalId } */

    function _buildTimerBlock(block) {
        const bid      = block.id;
        const duration = block.duration || _P27_TIMER_DEFAULT;

        /* Initialise or restore in-memory state */
        if (!_timerState[bid]) {
            _timerState[bid] = { remaining: duration, running: false, intervalId: null };
        }
        const state = _timerState[bid];
        /* If duration changed (preset clicked during render), reset remaining */
        if (state.remaining > duration) state.remaining = duration;

        const el     = document.createElement('div');
        el.className = 'p19-ws-block p27-timer-block';
        el.dataset.bid = bid;
        el.appendChild(_makeActions(bid));

        function _fmt(s) {
            return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
        }

        /* Label input */
        const labelInp = document.createElement('input');
        labelInp.type        = 'text';
        labelInp.className   = 'p27-timer-label-inp';
        labelInp.placeholder = 'Label  (e.g. Focus, Short Break)';
        labelInp.value       = block.label || 'Focus';
        labelInp.addEventListener('change', () => {
            const ws = _migrateWs(_getWs());
            const b  = ws.blocks.find(x => x.id === bid);
            if (b) { b.label = labelInp.value; block.label = labelInp.value; }
            _saveWs(ws);
        });
        el.appendChild(labelInp);

        /* Ring SVG */
        const svgNS  = 'http://www.w3.org/2000/svg';
        const SIZE   = 130;
        const R      = 52;
        const CIRC   = 2 * Math.PI * R;

        const ringWrap = document.createElement('div');
        ringWrap.className = 'p27-timer-ring-wrap';

        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('p27-timer-ring');
        svg.setAttribute('viewBox', '0 0 ' + SIZE + ' ' + SIZE);
        svg.setAttribute('width',  SIZE);
        svg.setAttribute('height', SIZE);

        const bgCirc = document.createElementNS(svgNS, 'circle');
        bgCirc.setAttribute('cx', SIZE / 2);
        bgCirc.setAttribute('cy', SIZE / 2);
        bgCirc.setAttribute('r',  R);
        bgCirc.setAttribute('fill', 'none');
        bgCirc.setAttribute('stroke', 'var(--glass-border)');
        bgCirc.setAttribute('stroke-width', '7');

        const fgCirc = document.createElementNS(svgNS, 'circle');
        fgCirc.setAttribute('cx', SIZE / 2);
        fgCirc.setAttribute('cy', SIZE / 2);
        fgCirc.setAttribute('r',  R);
        fgCirc.setAttribute('fill', 'none');
        fgCirc.setAttribute('stroke', 'var(--accent)');
        fgCirc.setAttribute('stroke-width', '7');
        fgCirc.setAttribute('stroke-linecap', 'round');
        fgCirc.setAttribute('transform', 'rotate(-90 ' + (SIZE / 2) + ' ' + (SIZE / 2) + ')');
        fgCirc.style.strokeDasharray  = CIRC;
        fgCirc.style.strokeDashoffset = '0';
        fgCirc.style.transition       = 'stroke-dashoffset 0.95s linear';

        svg.appendChild(bgCirc);
        svg.appendChild(fgCirc);

        const timeLabel = document.createElement('div');
        timeLabel.className = 'p27-timer-ring-time';
        timeLabel.textContent = _fmt(state.remaining);

        ringWrap.appendChild(svg);
        ringWrap.appendChild(timeLabel);
        el.appendChild(ringWrap);

        function _updateDisplay() {
            timeLabel.textContent = _fmt(state.remaining);
            const progress = duration > 0 ? state.remaining / duration : 0;
            fgCirc.style.strokeDashoffset = CIRC * (1 - progress);
        }

        /* Controls */
        const controls = document.createElement('div');
        controls.className = 'p27-timer-controls';

        const startBtn = document.createElement('button');
        startBtn.type      = 'button';
        startBtn.className = 'p27-timer-btn start' + (state.running ? ' active' : '');
        startBtn.innerHTML = state.running
            ? '<i class="fa-solid fa-pause"></i> Pause'
            : '<i class="fa-solid fa-play"></i> Start';

        function _start() {
            if (state.running || state.remaining <= 0) return;
            state.running    = true;
            startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            startBtn.classList.add('active');
            state.intervalId = setInterval(() => {
                state.remaining--;
                _updateDisplay();
                if (state.remaining <= 0) {
                    clearInterval(state.intervalId);
                    state.running   = false;
                    state.intervalId = null;
                    startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
                    startBtn.classList.remove('active');
                    _p27toast((block.label || 'Timer') + ' finished!');
                }
            }, 1000);
        }

        function _pause() {
            if (!state.running) return;
            clearInterval(state.intervalId);
            state.running   = false;
            state.intervalId = null;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
            startBtn.classList.remove('active');
        }

        startBtn.addEventListener('click', () => { if (state.running) _pause(); else _start(); });

        const resetBtn = document.createElement('button');
        resetBtn.type      = 'button';
        resetBtn.className = 'p27-timer-btn reset';
        resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset';
        resetBtn.addEventListener('click', () => {
            _pause();
            state.remaining = block.duration || _P27_TIMER_DEFAULT;
            _updateDisplay();
        });

        controls.appendChild(startBtn);
        controls.appendChild(resetBtn);
        el.appendChild(controls);

        /* Duration presets */
        const presets = document.createElement('div');
        presets.className = 'p27-timer-presets';
        _P27_TIMER_PRESETS.forEach(p => {
            const btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = 'p27-timer-preset-btn' + (p.sec === duration ? ' active' : '');
            btn.textContent = p.label;
            btn.addEventListener('click', () => {
                _pause();
                const ws = _migrateWs(_getWs());
                const b  = ws.blocks.find(x => x.id === bid);
                if (b) { b.duration = p.sec; block.duration = p.sec; }
                _saveWs(ws);
                state.remaining = p.sec;
                presets.querySelectorAll('.p27-timer-preset-btn').forEach(b2 => b2.classList.remove('active'));
                btn.classList.add('active');
                _updateDisplay();
                /* Recompute ring circumference proportion */
                fgCirc.style.strokeDashoffset = CIRC;
            });
            presets.appendChild(btn);
        });
        el.appendChild(presets);

        _updateDisplay();
        return el;
    }

    /* ── Build dispatcher ─────────────────────────────────────── */
    function _buildForType(block) {
        if (block.type === 'table')     return _buildTableBlock(block);
        if (block.type === 'callout')   return _buildCalloutBlock(block);
        if (block.type === 'flashcard') return _buildFlashcardBlock(block);
        if (block.type === 'calc')      return _buildCalcBlock(block);
        if (block.type === 'timer')     return _buildTimerBlock(block);
        return null;
    }

    const NEW_TYPES = new Set(['table', 'callout', 'flashcard', 'calc', 'timer']);

    /* ── Patch p19_wbRender ────────────────────────────────────── */
    function _patchRender() {
        if (typeof window.p19_wbRender !== 'function' || window._p27wbRenderDone) {
            if (!window._p27wbRenderDone) { setTimeout(_patchRender, 400); return; }
            return;
        }
        window._p27wbRenderDone = true;
        const _origRender = window.p19_wbRender;

        window.p19_wbRender = function() {
            _origRender.apply(this, arguments);
            const board = document.getElementById('p19-ws-board');
            if (!board) return;
            const ws       = _p27dbG('os_worksheet', { blocks: [], savedValues: {} });
            const migrated = Array.isArray(ws.blocks) ? ws : { blocks: [], savedValues: {} };

            (migrated.blocks || []).forEach(block => {
                if (!NEW_TYPES.has(block.type)) return;
                if (board.querySelector('[data-bid="' + CSS.escape(block.id) + '"]')) return;
                const el  = _buildForType(block);
                if (!el) return;
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

    /* ── Patch p19_wbOpenPicker ────────────────────────────────── */
    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function' || window._p27pickerDone) {
            if (!window._p27pickerDone) { setTimeout(_patchPicker, 400); return; }
            return;
        }
        window._p27pickerDone = true;
        const _origOpen = window.p19_wbOpenPicker;

        window.p19_wbOpenPicker = function() {
            _origOpen.apply(this, arguments);
            setTimeout(() => {
                const sheet = document.getElementById('p19-ws-picker-sheet');
                if (!sheet) return;
                sheet.querySelector('#p27-picker-sec')?.remove();

                const sec = document.createElement('div');
                sec.className = 'p19-picker-section';
                sec.id        = 'p27-picker-sec';

                const hdr = document.createElement('div');
                hdr.className   = 'p19-picker-section-hdr';
                hdr.textContent = 'Utilities & Study tools';
                sec.appendChild(hdr);

                const grid = document.createElement('div');
                grid.className = 'p19-picker-block-types';

                [
                    { type: 'table',     icon: 'table',          label: 'Table'      },
                    { type: 'callout',   icon: 'circle-info',    label: 'Callout'    },
                    { type: 'flashcard', icon: 'layer-group',    label: 'Flashcards' },
                    { type: 'calc',      icon: 'calculator',     label: 'Calculator' },
                    { type: 'timer',     icon: 'stopwatch',      label: 'Timer'      },
                    { type: 'formula',   icon: 'square-root-variable', label: 'Formula' },
                ].forEach(({ type, icon, label }) => {
                    const btn = document.createElement('button');
                    btn.type      = 'button';
                    btn.className = 'p19-picker-type-btn';
                    btn.innerHTML = '<i class="fa-solid fa-' + icon + '"></i>' + label;
                    btn.addEventListener('click', () => _addBlock(type));
                    grid.appendChild(btn);
                });

                sec.appendChild(grid);
                sheet.appendChild(sec);
            }, 80);
        };
    }

    function _addBlock(type) {
        const ws = _p27dbG('os_worksheet', { blocks: [], savedValues: {} });
        ws.blocks = ws.blocks || [];
        if (ws.blocks.some(b => b.type === type)) return;
        const id  = _p27id();
        const defaults = {
            table:     { id, type: 'table',     rows: [['Column A', 'Column B'], ['', '']], hasHeader: true },
            callout:   { id, type: 'callout',   content: '', variant: 'info' },
            flashcard: { id, type: 'flashcard', cards: [{ front: '', back: '' }] },
            calc:      { id, type: 'calc',      lines: [{ expr: '', result: null }] },
            timer:     { id, type: 'timer',     label: 'Focus', duration: _P27_TIMER_DEFAULT },
            formula:   { id, type: 'formula',   formulaId: null, title: 'New Formula', formula: '', vars: [], solveFor: '', result: null, savedAs: '' },
        };
        ws.blocks.push(defaults[type]);
        _p27dbS('os_worksheet', ws);
        if (typeof window.p19_wbRender    === 'function') window.p19_wbRender();
        if (typeof window.p19_wbClosePicker === 'function') window.p19_wbClosePicker();
    }

    _patchRender();
    _patchPicker();
}

/* ================================================================
   2.  FORMULA BLOCK IMPROVEMENTS
   ================================================================ */
function _p27_formulaImprovements() {

    /* ── Rename "Formula steps" → "Saved formulas" in picker ─── */
    function _watchPickerLabel() {
        const observer = new MutationObserver(() => {
            const hdr = document.querySelector('#p19-picker-formulas-sec .p19-picker-section-hdr');
            if (hdr && hdr.textContent.includes('Formula steps')) {
                hdr.textContent = 'Saved formulas';
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        /* Also check immediately in case it's already open */
        const hdr = document.querySelector('#p19-picker-formulas-sec .p19-picker-section-hdr');
        if (hdr && hdr.textContent.includes('Formula steps')) hdr.textContent = 'Saved formulas';
    }

    /* ── Auto-compute when all known variables are filled ───── */
    function _attachAutoCompute() {
        function _tryBoard() {
            const board = document.getElementById('p19-ws-board');
            if (!board) { setTimeout(_tryBoard, 800); return; }

            board.addEventListener('input', e => {
                const inp = e.target;
                if (inp.dataset.p19input !== 'var') return;
                const bid = inp.dataset.bid;
                if (!bid) return;
                const blockEl = board.querySelector('[data-bid="' + CSS.escape(bid) + '"]');
                if (!blockEl || !blockEl.classList.contains('formula-block')) return;

                /* Check if all non-readonly (i.e. non-solveFor) inputs have values */
                const varInputs = blockEl.querySelectorAll('[data-p19input="var"]');
                let allFilled = varInputs.length > 0;
                varInputs.forEach(v => {
                    if (v.readOnly) return;
                    if (!v.value.trim()) allFilled = false;
                });

                if (allFilled) {
                    clearTimeout(inp._p27autoTimer);
                    inp._p27autoTimer = setTimeout(() => {
                        if (typeof window.p19_wbCompute === 'function') window.p19_wbCompute(bid);
                    }, 500);
                }
            });

            /* Also watch for new blocks */
            new MutationObserver(() => {
                /* Nothing extra needed — event delegation handles new inputs */
            }).observe(board, { childList: true, subtree: false });
        }

        /* Wait for worksheet view to be injected */
        function _waitView() {
            const main = document.getElementById('main-scroll');
            if (!main) { setTimeout(_waitView, 800); return; }
            new MutationObserver(() => {
                if (document.getElementById('p19-ws-board')) _tryBoard();
            }).observe(main, { childList: true });
            if (document.getElementById('p19-ws-board')) _tryBoard();
        }
        _waitView();
    }

    _watchPickerLabel();
    _attachAutoCompute();
}

/* ================================================================
   3.  ATTENDANCE CALENDAR ENHANCEMENTS
   ================================================================ */
function _p27_calendarEnhancements() {

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    /* ── Calculate current attended streak ──────────────────── */
    function _calcStreak(courseId) {
        const log    = _p27dbG('os_attend_log', []);
        const logMap = {};
        log.filter(l => l.courseId === courseId).forEach(l => { logMap[l.date] = l.status; });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let streak = 0;

        for (let i = 0; i < _P27_MAX_STREAK_DAYS; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const ds = _p27date(d);
            if (logMap[ds] === 'attended') {
                streak++;
            } else if (logMap[ds] === 'missed') {
                break;
            }
            /* days with no log are transparent — continue checking backwards */
        }
        return streak;
    }

    /* ── 30-day heat strip ───────────────────────────────────── */
    function _buildHeatStrip(courseId) {
        const log    = _p27dbG('os_attend_log', []);
        const logMap = {};
        log.filter(l => l.courseId === courseId).forEach(l => { logMap[l.date] = l.status; });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const strip = document.createElement('div');
        strip.className        = 'p27-heat-strip';
        strip.dataset.courseId = courseId;

        for (let i = 29; i >= 0; i--) {
            const d   = new Date(today);
            d.setDate(today.getDate() - i);
            const ds  = _p27date(d);
            const st  = logMap[ds];
            const dot = document.createElement('div');
            dot.className = 'p27-heat-dot' + (st === 'attended' ? ' att' : st === 'missed' ? ' miss' : '');
            dot.title     = ds + (st ? ' — ' + st : '');
            strip.appendChild(dot);
        }
        return strip;
    }

    /* ── Enhance a single .p26-att-month-cal element ────────── */
    function _enhanceCal(cal) {
        if (cal.dataset.p27enhanced) return;
        cal.dataset.p27enhanced = '1';

        const card     = cal.closest('[data-course-id]');
        const courseId = card ? card.dataset.courseId : null;

        /* ── "Today" button in nav ── */
        const nav = cal.querySelector('.p26-att-month-nav');
        if (nav) {
            const todayBtn = document.createElement('button');
            todayBtn.type      = 'button';
            todayBtn.className = 'p26-att-month-nav-btn p27-today-btn';
            todayBtn.title     = 'Jump to today';
            todayBtn.innerHTML = '<i class="fa-solid fa-calendar-day"></i>';

            /* Insert before the "next" button (last child of nav) */
            const lastBtn = nav.lastElementChild;
            if (lastBtn) nav.insertBefore(todayBtn, lastBtn);
            else nav.appendChild(todayBtn);

            todayBtn.addEventListener('click', e => {
                e.stopPropagation();
                const label = nav.querySelector('.p26-att-month-label');
                if (!label) return;

                /* Parse current month/year from label e.g. "April 2025" */
                const parts    = label.textContent.trim().split(' ');
                const curMonth = MONTHS.indexOf(parts[0]);
                const curYear  = parseInt(parts[1], 10);
                if (curMonth < 0 || isNaN(curYear)) return;

                const now  = new Date();
                const diff = (now.getFullYear() - curYear) * 12 + (now.getMonth() - curMonth);

                const prevBtn = nav.querySelector('.p26-att-month-nav-btn:first-child');
                const nextBtn = nav.querySelector('.p26-att-month-nav-btn:nth-last-child(2)');

                if (diff > 0 && nextBtn && !nextBtn.disabled) {
                    for (let i = 0; i < diff; i++) nextBtn.click();
                } else if (diff < 0 && prevBtn && !prevBtn.disabled) {
                    for (let i = 0; i < -diff; i++) prevBtn.click();
                }
            });
        }

        /* ── Heat strip ── */
        if (courseId) {
            cal.appendChild(_buildHeatStrip(courseId));
        }
    }

    /* ── Add streak badge to each .p25-att-card ─────────────── */
    function _enhanceCard(card) {
        if (card.dataset.p27streakAdded) return;
        card.dataset.p27streakAdded = '1';

        const courseId = card.dataset.courseId;
        if (!courseId) return;

        const streak = _calcStreak(courseId);
        const pctEl  = card.querySelector('.p25-att-pct');
        if (!pctEl) return;

        const badge = document.createElement('span');
        badge.className = 'p27-streak-badge' + (streak === 0 ? ' cold' : '');
        badge.innerHTML = '<i class="fa-solid fa-fire"></i> ' + streak + ' day streak';
        pctEl.after(badge);
    }

    /* ── Observe DOM for attendance calendars & cards ────────── */
    function _scan() {
        document.querySelectorAll('.p26-att-month-cal:not([data-p27enhanced])').forEach(_enhanceCal);
        document.querySelectorAll('.p25-att-card[data-course-id]:not([data-p27streakAdded])').forEach(_enhanceCard);
    }

    const _observer = new MutationObserver(_scan);
    _observer.observe(document.body, { childList: true, subtree: true });
    _scan();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p27_init() {
    const _go = () => {
        _p27_newBlockTypes();
        _p27_formulaImprovements();
        _p27_calendarEnhancements();
        console.log('[patches27] loaded — new blocks (table/callout/flashcard/calc/timer), formula auto-compute, calendar enhancements');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 350));
    } else {
        setTimeout(_go, 350);
    }
})();
