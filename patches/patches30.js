/* ================================================================
   StudentOS — patches30.js
   Worksheet — comprehensive UX + reliability improvements

   1.  Pre-render input sync  — save every formula-block DOM input
       to storage BEFORE board.innerHTML='', so auto-compute can
       never wipe a value the user was typing in another block.
   2.  In-place compute update — override p19_wbCompute to update
       only the result panel of the computed block instead of doing
       a full board re-render.  Keeps cursor/focus in every other
       input field.
   3.  Duplicate block button — copy-icon action button on each block.
   4.  One-level undo bar      — "Block deleted / Undo" toast
       that appears for 6 s after any block is deleted.
   5.  Worksheet title         — editable title persisted under
       os_worksheet_title; shown above the board.
   6.  Print button            — builds a print-ready HTML window.
   7.  Formula-modal tab badge — small count chip on the "My
       formulas" tab showing how many custom formulas exist.
   8.  Formula-modal default tab — automatically switches to "My
       formulas" when the modal opens and the user already has at
       least one custom formula saved.
   ================================================================ */

'use strict';

/* ── helpers ──────────────────────────────────────────────────── */
const _p30lsG   = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p30lsS   = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p30dbG   = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p30lsG(k, d); } catch { return d; } };
const _p30dbS   = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p30lsS(k, v); } catch {} };
const _p30id    = () => Math.random().toString(36).slice(2, 10);
const _p30toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const _p30esc   = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function _p30fmt(v) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return String(v);
    return parseFloat(v.toPrecision(8)).toString();
}
function _p30getWs() { return _p30dbG('os_worksheet', { blocks: [], savedValues: {} }); }

/* ================================================================
   1.  PRE-RENDER INPUT SYNC
       Wrap p19_wbRender so that every formula-block input value
       currently visible in the DOM is written to storage FIRST.
       This is the safety net that prevents auto-compute on block A
       from wiping in-progress values in block B.
   ================================================================ */
function _p30_patchPreRenderSync() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbRender !== 'function' || window._p30syncDone) {
            if (!window._p30syncDone && ++_retries < 50) setTimeout(_try, 250);
            return;
        }
        window._p30syncDone = true;
        const _orig = window.p19_wbRender;
        window.p19_wbRender = function() {
            _p30_syncAllFormInputs();
            _orig.apply(this, arguments);
        };
    })();
}

function _p30_syncAllFormInputs() {
    const board = document.getElementById('p19-ws-board');
    if (!board || typeof window.p19_wbVarInput !== 'function') return;
    board.querySelectorAll('.formula-block[data-bid]').forEach(blockEl => {
        const bid = blockEl.dataset.bid;
        if (!bid) return;
        blockEl.querySelectorAll('[data-p19input="var"][data-sym]').forEach(inp => {
            window.p19_wbVarInput(bid, inp.dataset.sym, inp.value.trim());
        });
    });
}

/* ================================================================
   2.  IN-PLACE COMPUTE RESULT UPDATE
       Wrap p19_wbCompute to intercept its internal call to
       p19_wbRender and instead update only the single block that
       was just computed — leaving every other input untouched.
   ================================================================ */
function _p30_patchInPlaceCompute() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbCompute !== 'function' || window._p30inplaceDone) {
            if (!window._p30inplaceDone && ++_retries < 50) setTimeout(_try, 250);
            return;
        }
        window._p30inplaceDone = true;
        const _origCompute = window.p19_wbCompute;

        window.p19_wbCompute = function(bid) {
            /* Suppress the full re-render that p19_wbCompute triggers */
            let _renderWanted = false;
            const _savedRender = window.p19_wbRender;
            window.p19_wbRender = () => { _renderWanted = true; };

            _origCompute.call(this, bid);

            window.p19_wbRender = _savedRender;

            if (_renderWanted) {
                /* Update only the affected block in-place */
                _p30_refreshBlockResult(bid);
                /* Refresh saved-values bar */
                _p30_refreshSvBar();
            }
        };
    })();
}

/* Re-draw only the result section of a formula block */
function _p30_refreshBlockResult(bid) {
    const ws    = _p30getWs();
    const block = (ws.blocks || []).find(b => b.id === bid);
    if (!block || block.type !== 'formula') return;

    const blockEl = document.querySelector('[data-bid="' + CSS.escape(bid) + '"]');
    if (!blockEl) {
        /* Fallback: full render */
        if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
        return;
    }

    /* Update the solve-for readonly input */
    const sfInp = blockEl.querySelector('.solve-for-inp');
    if (sfInp) sfInp.value = (block.result !== null && block.result !== undefined) ? _p30fmt(block.result) : '';

    /* Remove stale result/error nodes */
    ['p29-result-panel','p29-formula-error','p19-ws-result','p16-result-box'].forEach(cls => {
        blockEl.querySelector('.' + cls)?.remove();
    });

    /* Inject fresh result panel */
    if (block.result !== null && block.result !== undefined) {
        blockEl.appendChild(_p30_buildResultPanel(block, ws, bid));
    }
}

function _p30_refreshSvBar() {
    const svBar = document.getElementById('p19-ws-sv-bar');
    if (!svBar) return;
    const ws = _p30getWs();
    const entries = Object.entries(ws.savedValues || {});
    svBar.innerHTML = '';
    if (!entries.length) {
        const hint = document.createElement('span');
        hint.style.cssText = 'font-size:.7rem;color:var(--text-muted);';
        hint.textContent = 'Saved values from formula steps appear here as @name references';
        svBar.appendChild(hint);
        return;
    }
    entries.forEach(([k, v]) => {
        const val = typeof v === 'object' ? v.value : v;
        const chip = document.createElement('div');
        chip.className = 'p19-ws-sv-chip';
        chip.innerHTML = '<i class="fa-solid fa-at" style="font-size:.6rem;"></i>';
        chip.appendChild(document.createTextNode(' ' + k + ' = ' + _p30fmt(val) + ' '));
        const del = document.createElement('button');
        del.title = 'Remove';
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        del.dataset.p19action = 'del-saved';
        del.dataset.name = k;
        chip.appendChild(del);
        svBar.appendChild(chip);
    });
}

/* ── Result panel builder (mirrors p29 design) ─────────────── */
function _p30_buildResultPanel(block, ws, bid) {
    const panel = document.createElement('div');
    panel.className = 'p29-result-panel';

    const symEl = document.createElement('div');
    symEl.className = 'p29-result-sym';
    symEl.textContent = (block.solveFor || '') + ' =';

    const valEl = document.createElement('div');
    valEl.className = 'p29-result-val';
    valEl.textContent = _p30fmt(block.result);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'p29-result-copy-btn';
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
    copyBtn.addEventListener('click', () => {
        const txt = String(block.result);
        navigator.clipboard?.writeText(txt).then(
            () => _p30toast('Copied: ' + txt),
            () => _p30toast('Result: ' + txt)
        );
    });

    panel.appendChild(symEl);
    panel.appendChild(valEl);
    panel.appendChild(copyBtn);

    /* Save-as row */
    const saveRow = document.createElement('div');
    saveRow.className = 'p29-saveas-row';

    if (block.savedAs) {
        const lbl = document.createElement('span');
        lbl.className = 'p29-saveas-saved-name';
        lbl.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved as @' + _p30esc(block.savedAs);
        saveRow.appendChild(lbl);

        const changeBtn = document.createElement('button');
        changeBtn.type = 'button';
        changeBtn.className = 'p29-saveas-btn';
        changeBtn.title = 'Change saved name';
        changeBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
        changeBtn.addEventListener('click', () => {
            saveRow.innerHTML = '';
            _p30_buildSaveAsInput(saveRow, bid, block);
        });
        saveRow.appendChild(changeBtn);
    } else {
        _p30_buildSaveAsInput(saveRow, bid, block);
    }

    panel.appendChild(saveRow);
    return panel;
}

function _p30_buildSaveAsInput(saveRow, bid, block) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'p29-saveas-inp';
    inp.placeholder = 'Save as @name\u2026';
    inp.value = block.savedAs || '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'p29-saveas-btn';
    btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Save';

    btn.addEventListener('click', () => {
        const name = inp.value.trim().replace(/^@/, '');
        if (!name) { _p30toast('Enter a name to save this result.'); inp.focus(); return; }

        const ws = _p30getWs();
        const b  = (ws.blocks || []).find(x => x.id === bid);
        if (!b || b.result === null || b.result === undefined) return;

        b.savedAs = name;
        ws.savedValues = ws.savedValues || {};
        ws.savedValues[name] = { value: b.result };
        _p30dbS('os_worksheet', ws);

        _p30toast('@' + name + ' = ' + _p30fmt(b.result) + ' saved');

        /* Update the row UI in-place */
        saveRow.innerHTML = '';
        const lbl = document.createElement('span');
        lbl.className = 'p29-saveas-saved-name';
        lbl.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved as @' + _p30esc(name);
        saveRow.appendChild(lbl);

        _p30_refreshSvBar();

        /* Keep p19 in sync */
        if (typeof window.p19_wbSetSaveAs === 'function') window.p19_wbSetSaveAs(bid, name);
    });

    inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

    saveRow.appendChild(inp);
    saveRow.appendChild(btn);
}

/* ================================================================
   3.  DUPLICATE BLOCK BUTTON
       After every render, inject a copy-icon button into each
       block's action strip (between handle and delete).
   ================================================================ */
function _p30_watchForDupButtons() {
    let _retries = 0;
    (function _tryBoard() {
        const board = document.getElementById('p19-ws-board');
        if (!board) { if (++_retries < 60) setTimeout(_tryBoard, 300); return; }

        function _injectDup(blockEl) {
            if (blockEl.dataset.p30dup) return;
            blockEl.dataset.p30dup = '1';
            const actions = blockEl.querySelector('.p19-ws-block-actions');
            if (!actions) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'p19-ws-block-btn';
            btn.title = 'Duplicate block';
            btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            btn.addEventListener('click', e => {
                e.stopPropagation();
                _p30_duplicateBlock(blockEl.dataset.bid);
            });

            const del = actions.querySelector('.del');
            if (del) actions.insertBefore(btn, del);
            else actions.appendChild(btn);
        }

        /* Initial pass */
        board.querySelectorAll('.p19-ws-block[data-bid]').forEach(_injectDup);

        /* Watch for future blocks */
        new MutationObserver(() => {
            board.querySelectorAll('.p19-ws-block[data-bid]:not([data-p30dup])').forEach(_injectDup);
        }).observe(board, { childList: true, subtree: true });
    })();
}

function _p30_duplicateBlock(bid) {
    if (!bid) return;
    const ws  = _p30getWs();
    const idx = (ws.blocks || []).findIndex(b => b.id === bid);
    if (idx < 0) return;

    const clone    = JSON.parse(JSON.stringify(ws.blocks[idx]));
    clone.id       = _p30id();
    clone.result   = null;
    clone.savedAs  = '';

    ws.blocks.splice(idx + 1, 0, clone);
    _p30dbS('os_worksheet', ws);

    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
    _p30toast('Block duplicated');
}

/* ================================================================
   4.  ONE-LEVEL UNDO BAR
       Intercept p19_wbDeleteBlock to stash the deleted block then
       show a transient "Block deleted  [Undo]" bar at the bottom.
   ================================================================ */
let _p30_undoStack = null;
let _p30_undoTimer = null;

function _p30_patchDeleteBlock() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbDeleteBlock !== 'function' || window._p30deleteDone) {
            if (!window._p30deleteDone && ++_retries < 50) setTimeout(_try, 250);
            return;
        }
        window._p30deleteDone = true;
        const _orig = window.p19_wbDeleteBlock;
        window.p19_wbDeleteBlock = function(bid) {
            const ws  = _p30getWs();
            const idx = (ws.blocks || []).findIndex(b => b.id === bid);
            if (idx >= 0) {
                _p30_undoStack = { block: JSON.parse(JSON.stringify(ws.blocks[idx])), idx };
                _p30_showUndoBar();
            }
            _orig.call(this, bid);
        };
    })();
}

function _p30_showUndoBar() {
    document.getElementById('p30-undo-bar')?.remove();
    clearTimeout(_p30_undoTimer);

    const bar = document.createElement('div');
    bar.id = 'p30-undo-bar';
    bar.innerHTML =
        '<span><i class="fa-solid fa-trash-can" style="margin-right:7px;opacity:.65;"></i>Block deleted</span>' +
        '<button id="p30-undo-btn"><i class="fa-solid fa-rotate-left"></i> Undo</button>';
    document.body.appendChild(bar);

    document.getElementById('p30-undo-btn')?.addEventListener('click', () => window.p30_undoDelete());

    _p30_undoTimer = setTimeout(() => {
        const el = document.getElementById('p30-undo-bar');
        if (el) { el.classList.add('p30-undo-hide'); setTimeout(() => el.remove(), 320); }
        _p30_undoStack = null;
    }, 6000);
}

window.p30_undoDelete = function() {
    if (!_p30_undoStack) return;
    clearTimeout(_p30_undoTimer);
    document.getElementById('p30-undo-bar')?.remove();

    const { block, idx } = _p30_undoStack;
    _p30_undoStack = null;

    const ws = _p30getWs();
    ws.blocks = ws.blocks || [];
    ws.blocks.splice(idx, 0, block);
    _p30dbS('os_worksheet', ws);

    if (typeof window.p19_wbRender === 'function') window.p19_wbRender();
    _p30toast('Block restored');
};

/* Ctrl+Z undo shortcut (only on worksheet view) */
function _p30_undoShortcut() {
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            /* Only trigger when focused inside the worksheet */
            const ws = document.getElementById('view-worksheet');
            if (!ws || ws.classList.contains('hidden')) return;
            if (!_p30_undoStack) return;
            e.preventDefault();
            window.p30_undoDelete();
        }
    });
}

/* ================================================================
   5.  WORKSHEET TITLE
       An editable input displayed above the canvas, persisted as
       os_worksheet_title.  Injected once after whiteboard init.
   ================================================================ */
function _p30_injectTitle() {
    let _retries = 0;
    (function _try() {
        const board = document.getElementById('p19-ws-board');
        if (!board) { if (++_retries < 60) setTimeout(_try, 300); return; }
        if (document.getElementById('p30-ws-title')) return;

        const inp = document.createElement('input');
        inp.id          = 'p30-ws-title';
        inp.type        = 'text';
        inp.className   = 'p30-ws-title-inp';
        inp.placeholder = 'Untitled worksheet';
        inp.value       = _p30dbG('os_worksheet_title', '');
        inp.spellcheck  = false;
        inp.autocomplete = 'off';

        inp.addEventListener('input', () => _p30dbS('os_worksheet_title', inp.value));

        board.before(inp);
    })();
}

/* ================================================================
   6.  PRINT BUTTON
       Injects a print icon button into the worksheet toolbar once
       it exists.  On click, opens a formatted print window.
   ================================================================ */
function _p30_injectPrintBtn() {
    let _retries = 0;
    (function _try() {
        const toolbar = document.getElementById('p19-ws-toolbar');
        if (!toolbar) { if (++_retries < 60) setTimeout(_try, 300); return; }
        if (toolbar.dataset.p30print) return;
        toolbar.dataset.p30print = '1';

        const btn = document.createElement('button');
        btn.className = 'p19-ws-tb-btn';
        btn.title     = 'Print worksheet';
        btn.innerHTML = '<i class="fa-solid fa-print"></i> Print';
        btn.addEventListener('click', _p30_printWorksheet);

        /* Insert before the "Clear" danger button */
        const clear = toolbar.querySelector('.danger');
        if (clear) toolbar.insertBefore(btn, clear);
        else toolbar.appendChild(btn);
    })();
}

function _p30_printWorksheet() {
    const ws    = _p30getWs();
    const title = (_p30dbG('os_worksheet_title', '') || 'Worksheet').trim();

    const style = `
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
             font-size:14px;color:#1e293b;background:#fff;padding:32px 40px}
        h1{font-size:1.6rem;font-weight:300;margin-bottom:24px;color:#0f172a;
           border-bottom:1px solid #e2e8f0;padding-bottom:12px}
        .sv-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}
        .sv-chip{font-family:monospace;font-size:.72rem;color:#3b82f6;
                 background:#eff6ff;border:1px solid #bfdbfe;border-radius:99px;
                 padding:2px 10px}
        .block{margin-bottom:18px;page-break-inside:avoid}
        .block-num{font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;
                   color:#64748b;font-weight:700;margin-bottom:6px}
        .heading{font-size:1.35rem;font-weight:700;color:#0f172a;
                 border-left:4px solid #3b82f6;padding-left:12px}
        .note{font-size:.9rem;color:#475569;white-space:pre-wrap;
              background:#f8fafc;border-radius:8px;padding:10px 14px;
              border:1px solid #e2e8f0}
        .divider-line{border:none;border-top:2px solid #e2e8f0;margin:4px 0}
        .formula-box{background:#f8fafc;border:1px solid #e2e8f0;
                     border-radius:8px;padding:12px 16px}
        .formula-expr{font-family:monospace;font-size:.88rem;color:#334155;
                      margin-bottom:10px;font-weight:600}
        .vars-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
                   gap:8px;margin-bottom:10px}
        .var-item{display:flex;flex-direction:column;gap:3px}
        .var-sym{font-family:monospace;font-size:.7rem;color:#3b82f6;font-weight:700}
        .var-val{font-family:monospace;font-size:.85rem;color:#1e293b;
                 border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;background:#fff}
        .result-row{font-family:monospace;font-size:1.2rem;font-weight:800;color:#3b82f6;
                    border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px}
        .checklist-title{font-weight:700;margin-bottom:6px}
        ul.checklist{padding-left:20px;display:flex;flex-direction:column;gap:4px}
        ul.checklist li{font-size:.9rem}
        ul.checklist li.done{text-decoration:line-through;color:#94a3b8}
        pre.code{font-family:monospace;font-size:.8rem;background:#f1f5f9;
                 border-radius:8px;padding:12px 16px;white-space:pre-wrap;
                 border:1px solid #e2e8f0;overflow:auto}
        .callout{padding:10px 16px;border-radius:8px;background:#f0fdf4;
                 border-left:4px solid #22c55e}
        @media print{body{padding:12px}}`;

    let body = `<h1>${_p30esc(title)}</h1>\n`;

    const saved = Object.entries(ws.savedValues || {});
    if (saved.length) {
        body += `<div class="sv-bar">` +
            saved.map(([k,v]) => {
                const val = typeof v === 'object' ? v.value : v;
                return `<div class="sv-chip">@${_p30esc(k)} = ${_p30esc(_p30fmt(val))}</div>`;
            }).join('') + `</div>\n`;
    }

    (ws.blocks || []).forEach((blk, i) => {
        body += `<div class="block">`;
        if (blk.type === 'heading') {
            body += `<div class="heading">${_p30esc(blk.content || '')}</div>`;
        } else if (blk.type === 'text') {
            if ((blk.content || '').trim())
                body += `<div class="note">${_p30esc(blk.content || '')}</div>`;
        } else if (blk.type === 'divider') {
            body += `<hr class="divider-line">`;
        } else if (blk.type === 'formula') {
            body += `<div class="block-num">${i + 1}. ${_p30esc(blk.title || 'Formula')}</div>
                     <div class="formula-box">
                       <div class="formula-expr">${_p30esc(blk.formula || '')}</div>
                       <div class="vars-grid">`;
            (blk.vars || []).forEach(v => {
                const isSF = v.sym === blk.solveFor;
                const dv   = isSF && blk.result !== null && blk.result !== undefined
                    ? _p30fmt(blk.result) : (v.value || '');
                body += `<div class="var-item">
                           <div class="var-sym">${_p30esc(v.sym)}${isSF ? ' (result)' : ''}</div>
                           <div class="var-val">${_p30esc(dv) || '&mdash;'}</div>
                         </div>`;
            });
            body += `</div>`;
            if (blk.result !== null && blk.result !== undefined) {
                body += `<div class="result-row">${_p30esc(blk.solveFor)} = ${_p30esc(_p30fmt(blk.result))}</div>`;
            }
            body += `</div>`;
        } else if (blk.type === 'checklist') {
            body += `<div class="checklist-title">${_p30esc(blk.title || 'Checklist')}</div>
                     <ul class="checklist">` +
                (blk.items || []).map(it =>
                    `<li class="${it.done ? 'done' : ''}">${_p30esc(it.text || '')}</li>`
                ).join('') + `</ul>`;
        } else if (blk.type === 'code') {
            body += `<pre class="code">${_p30esc(blk.content || '')}</pre>`;
        } else if (blk.type === 'callout') {
            body += `<div class="callout">${_p30esc(blk.content || '')}</div>`;
        }
        body += `</div>\n`;
    });

    const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>${_p30esc(title)}</title>
        <style>${style}</style>
        </head><body>${body}</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { _p30toast('Allow popups to print the worksheet.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
}

/* ================================================================
   7.  FORMULA MODAL — TAB BADGE
       Show a small count chip on the "My formulas" tab and on the
       "Mine" toolbar button in the picker so users can see at a
       glance that they have saved formulas.
   ================================================================ */
function _p30_formulaModalBadge() {
    let _retries = 0;
    (function _try() {
        if (!window.p28_openFormulaModal || window._p30badgeDone) {
            if (!window._p30badgeDone && ++_retries < 50) setTimeout(_try, 300);
            return;
        }
        window._p30badgeDone = true;

        const _origOpen = window.p28_openFormulaModal;
        window.p28_openFormulaModal = function() {
            _origOpen.apply(this, arguments);
            setTimeout(_p30_applyTabBadges, 120);
        };
    })();
}

function _p30_applyTabBadges() {
    const modal = document.getElementById('p28-formula-modal');
    if (!modal) return;
    const count = (_p30dbG('os_formulas', []) || []).length;

    modal.querySelectorAll('.p28-modal-tab[data-tab="mine"]').forEach(tab => {
        tab.querySelector('.p30-tab-badge')?.remove();
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className   = 'p30-tab-badge';
            badge.textContent = count;
            tab.appendChild(badge);
        }
    });
}

/* ================================================================
   8.  FORMULA MODAL — DEFAULT TO "MY FORMULAS" TAB
       When the user already has custom formulas saved, switch to the
       "mine" tab automatically when the modal opens so they see
       their own formulas first.
   ================================================================ */
function _p30_formulaModalDefaultTab() {
    /* We piggyback on the same patch entry point as the badge feature.
       Called after badges are applied. */
    const modal = document.getElementById('p28-formula-modal');
    if (!modal) return;
    const count = (_p30dbG('os_formulas', []) || []).length;
    if (!count) return;

    /* Simulate a click on the "mine" tab so p28's own logic activates it */
    const mineTab = modal.querySelector('.p28-modal-tab[data-tab="mine"]');
    if (mineTab) mineTab.click();
}

/* Re-run badges + default-tab logic every time the modal opens */
function _p30_patchModalOpen() {
    let _retries = 0;
    (function _try() {
        if (!window.p28_openFormulaModal || window._p30modalTabDone) {
            if (!window._p30modalTabDone && ++_retries < 50) setTimeout(_try, 300);
            return;
        }
        window._p30modalTabDone = true;

        const _origOpen = window.p28_openFormulaModal;
        window.p28_openFormulaModal = function() {
            _origOpen.apply(this, arguments);
            setTimeout(() => {
                _p30_applyTabBadges();
                _p30_formulaModalDefaultTab();
            }, 150);
        };
    })();
}

/* ================================================================
   ALSO PATCH switchTab
   Inject title and print button whenever the worksheet view opens.
   ================================================================ */
function _p30_patchSwitchTab() {
    let _retries = 0;
    (function _try() {
        if (typeof window.switchTab !== 'function' || window._p30switchDone) {
            if (!window._p30switchDone && ++_retries < 50) setTimeout(_try, 300);
            return;
        }
        window._p30switchDone = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            if (name === 'worksheet') {
                setTimeout(() => {
                    _p30_injectTitle();
                    _p30_injectPrintBtn();
                    _p30_watchForDupButtons();
                }, 200);
            }
        };
    })();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p30_init() {
    function _go() {
        /* Core bug fixes */
        _p30_patchPreRenderSync();
        _p30_patchInPlaceCompute();

        /* Undo infrastructure */
        _p30_patchDeleteBlock();
        _p30_undoShortcut();

        /* Duplicate buttons (MutationObserver, watches board) */
        _p30_watchForDupButtons();

        /* Worksheet title + print (retry until toolbar/board exist) */
        _p30_injectTitle();
        _p30_injectPrintBtn();

        /* Formula modal: badge count + default-to-mine */
        _p30_formulaModalBadge();
        _p30_patchModalOpen();

        /* Hook into switchTab for future worksheet opens */
        _p30_patchSwitchTab();

        console.log('[patches30] loaded — in-place compute, pre-render sync, undo, title, print, formula-modal badges');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 600));
    } else {
        setTimeout(_go, 600);
    }
})();
