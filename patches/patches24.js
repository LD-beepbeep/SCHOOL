/* ================================================================
   StudentOS — patches24.js
   FIXES & IMPROVEMENTS:
   1.  Task DnD          — document-level capture delegation; single
                           authoritative implementation that stops all
                           competing handlers from patches14–22
   2.  Formula modal     — remove variable/unit metadata section
                           entirely; keep only Title/Subject/Formula/Notes
   3.  Worksheet draw    — canvas drawing ("whiteboard") block type
   4.  Worksheet picker  — live formula search bar
   5.  Worksheet PDF     — popup-window print (reliable cross-browser)
   6.  Attendance        — summary header, responsive 2-col grid,
                           consistent rendering
   ================================================================ */

'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const _p24lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _p24lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _p24dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _p24lsG(k, d); } catch { return d; } };
const _p24dbS = (k, v) => { try { if (window.DB?.set) window.DB.set(k, v); else _p24lsS(k, v); } catch {} };
const _p24esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const _p24id  = () => Math.random().toString(36).slice(2, 10);
const _p24toast = msg => { const t = document.getElementById('sos-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

/* ================================================================
   1.  TASK DRAG-AND-DROP — definitive fix
       Uses document-level capture-phase listeners so this
       implementation runs before any element-level listeners added
       by patches14–22.  stopPropagation() during capture prevents
       the event from ever reaching those handlers.
       Also patches renderTasks() to include the drag handle in the
       generated HTML so timing issues are eliminated.
   ================================================================ */
function _p24_taskDnD() {
    let _src   = null;   // the .task-row being dragged
    let _moved = false;
    let _ox    = 0, _oy = 0;

    /* ── Patch renderTasks to embed the handle in each row ──── */
    function _patchRenderTasks() {
        if (typeof window.renderTasks !== 'function' || window._p24rtDone) {
            if (!window._p24rtDone) { setTimeout(_patchRenderTasks, 200); return; }
            return;
        }
        window._p24rtDone = true;

        const _orig = window.renderTasks;
        window.renderTasks = function() {
            _orig.apply(this, arguments);
            /* After the original builds the DOM, stamp a handle on
               every row that doesn't already have one.               */
            const list = document.getElementById('full-task-list');
            if (!list) return;
            list.querySelectorAll('.task-row').forEach(row => {
                /* Remove patches14 HTML5 draggable to prevent conflicts */
                row.removeAttribute('draggable');

                if (row.querySelector('.task-drag-handle')) return;
                /* Find the flex row that contains the checkbox */
                const inner = row.querySelector('.flex.items-center.gap-3');
                if (!inner) return;
                const h = document.createElement('span');
                h.className = 'task-drag-handle';
                h.setAttribute('title', 'Drag to reorder');
                h.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
                inner.insertBefore(h, inner.firstChild);
            });
        };
        /* Also run immediately so any already-rendered rows get handles */
        window.renderTasks();
    }

    /* ── Helpers ─────────────────────────────────────────────── */
    function _list() { return document.getElementById('full-task-list'); }

    function _rowAt(y) {
        const list = _list(); if (!list) return null;
        for (const row of list.querySelectorAll('.task-row')) {
            const r = row.getBoundingClientRect();
            if (y >= r.top && y <= r.bottom) return row;
        }
        return null;
    }

    function _clearStates() {
        _list()?.querySelectorAll('.task-row').forEach(r => { r.dataset.dragstate = ''; });
    }

    function _saveOrder() {
        const list = _list(); if (!list) return;
        const ids = [...list.querySelectorAll('.task-row')]
            .map(r => r.id?.replace('task-row-', '')).filter(Boolean);
        _p24lsS('p18_task_order', ids);
        _p24dbS('os_task_order', ids);
    }

    /* ── Document-level CAPTURE listeners ───────────────────── *
     * During the capture phase the event travels window→document→…
     * →target.  Calling e.stopPropagation() here prevents the event
     * from reaching the target element, so patches14–22 listeners
     * that are attached to the handle/row element (bubble phase) are
     * never invoked.                                               */

    document.addEventListener('pointerdown', function(e) {
        const handle = e.target.closest?.('.task-drag-handle');
        if (!handle) return;
        const list = _list();
        if (!list || !list.contains(handle)) return;

        e.stopPropagation();   // block all competing DnD handlers
        e.preventDefault();

        _src   = handle.closest('.task-row');
        _moved = false;
        _ox    = e.clientX;
        _oy    = e.clientY;
    }, { capture: true });

    document.addEventListener('pointermove', function(e) {
        if (!_src) return;
        e.stopPropagation();

        if (!_moved && Math.hypot(e.clientX - _ox, e.clientY - _oy) < 5) return;
        _moved = true;

        _clearStates();
        _src.dataset.dragstate = 'src';
        const target = _rowAt(e.clientY);
        if (target && target !== _src) target.dataset.dragstate = 'over';
    }, { capture: true });

    document.addEventListener('pointerup', function(e) {
        if (!_src) return;
        e.stopPropagation();

        const list = _list();
        if (_moved && list) {
            const target = _rowAt(e.clientY);
            if (target && target !== _src && list.contains(target)) {
                const siblings = [...list.querySelectorAll('.task-row')];
                if (siblings.indexOf(_src) < siblings.indexOf(target))
                    list.insertBefore(_src, target.nextSibling);
                else
                    list.insertBefore(_src, target);
                _saveOrder();
            }
            _clearStates();
        }
        if (_src) _src.dataset.dragstate = '';
        _src   = null;
        _moved = false;
    }, { capture: true });

    document.addEventListener('pointercancel', function() {
        if (!_src) return;
        _clearStates();
        _src   = null;
        _moved = false;
    }, { capture: true });

    /* Block HTML5 dragstart on task rows to prevent conflict with pointer DnD */
    document.addEventListener('dragstart', function(e) {
        const list = _list();
        if (!list) return;
        const row = e.target.closest?.('.task-row');
        if (row && list.contains(row)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, { capture: true });

    _patchRenderTasks();
}

/* ================================================================
   2.  FORMULA MODAL — CLEAN
       Remove all variable/unit/category metadata from the modal.
       Run on every open because patches16 re-injects on each open.
   ================================================================ */
function _p24_formulaModalClean() {
    /* Selectors of elements to completely remove */
    const REMOVE = [
        '.p16-formula-vars',
        '.p16-fv-hint',
        '.p16-fv-add-btn',
        '[id="p16-fv-rows"]',
        '.p21-formula-vars-hint',
        '[id="p21-formula-vars-hint"]',
        '#modal-formula [onclick*="p16_addVar"]',
    ];
    /* Selectors of elements to hard-hide */
    const HIDE = [
        '.p16-fv-ci', '.p16-fv-ui', '.p16-fv-ni',
        'select[id*="unit"]', 'select[id*="cat"]',
        '[id*="formula-modal-unit"]', '[id*="formula-modal-cat"]',
        '.formula-cat-wrap', '.formula-unit-wrap',
        '[id*="formula-modal-desc"]', '.formula-desc-wrap',
        'label[for*="formula-modal-unit"]', 'label[for*="formula-modal-cat"]',
        'label[for*="formula-modal-desc"]',
    ];

    function _clean(modal) {
        REMOVE.forEach(sel => {
            try { modal.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
        });
        HIDE.forEach(sel => {
            try { modal.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important')); } catch {}
        });
    }

    function _watch() {
        const modal = document.getElementById('modal-formula');
        if (!modal) { setTimeout(_watch, 800); return; }

        /* Run on every class change (hidden → visible) and on DOM changes */
        new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) setTimeout(() => _clean(modal), 30);
        }).observe(modal, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });

        _clean(modal);
    }
    _watch();
}

/* ================================================================
   3.  WORKSHEET DRAW BLOCK
       A canvas-based whiteboard block.  Data is persisted as a
       base64 PNG dataUrl in the block's `dataUrl` property.
   ================================================================ */
function _p24_worksheetDraw() {
    function _getData()   { return _p24dbG('os_worksheet', { blocks: [], savedValues: {} }); }
    function _saveData(d) { _p24dbS('os_worksheet', d); }
    function _migrate(ws) {
        if (Array.isArray(ws.blocks)) return ws;
        return { blocks: (ws.steps || []).map(s => ({ id: s.id || _p24id(), type: 'text', content: s.content || '' })),
                 savedValues: ws.savedValues || {} };
    }

    /* Build the canvas drawing block DOM */
    function _buildDrawBlock(block) {
        const el = document.createElement('div');
        el.className = 'p19-ws-block p24-draw-block';
        el.dataset.bid = block.id;

        /* ── Toolbar ── */
        const tb = document.createElement('div');
        tb.className = 'p24-draw-toolbar';

        /* Tool state */
        let _tool = 'pen';   // 'pen' | 'eraser'
        let _color = '#3b82f6';
        let _size  = 3;

        /* Pen button */
        const penBtn = document.createElement('button');
        penBtn.className = 'p24-draw-tool-btn active';
        penBtn.title = 'Pen';
        penBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        penBtn.addEventListener('click', () => {
            _tool = 'pen';
            penBtn.classList.add('active');
            eraserBtn.classList.remove('active');
            canvas.classList.remove('p24-eraser-mode');
        });

        /* Eraser button */
        const eraserBtn = document.createElement('button');
        eraserBtn.className = 'p24-draw-tool-btn';
        eraserBtn.title = 'Eraser';
        eraserBtn.innerHTML = '<i class="fa-solid fa-eraser"></i>';
        eraserBtn.addEventListener('click', () => {
            _tool = 'eraser';
            eraserBtn.classList.add('active');
            penBtn.classList.remove('active');
            canvas.classList.add('p24-eraser-mode');
        });

        /* Color picker */
        const colorPick = document.createElement('input');
        colorPick.type = 'color';
        colorPick.value = _color;
        colorPick.title = 'Stroke color';
        colorPick.addEventListener('input', () => { _color = colorPick.value; });

        /* Stroke size */
        const sizeSlider = document.createElement('input');
        sizeSlider.type = 'range';
        sizeSlider.min  = '1';
        sizeSlider.max  = '20';
        sizeSlider.value = String(_size);
        sizeSlider.className = 'p24-draw-size-slider';
        sizeSlider.title = 'Stroke size';
        sizeSlider.addEventListener('input', () => { _size = Number(sizeSlider.value); });

        /* Clear button */
        const clearBtn = document.createElement('button');
        clearBtn.className = 'p24-draw-tool-btn';
        clearBtn.title = 'Clear canvas';
        clearBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Clear';
        clearBtn.addEventListener('click', () => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            _persistCanvas();
        });

        /* Delete block */
        const delBtn = document.createElement('button');
        delBtn.className = 'p24-draw-tool-btn';
        delBtn.title = 'Delete block';
        delBtn.style.cssText = 'margin-left:auto;color:#f87171;border-color:rgba(248,113,113,.25);';
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.addEventListener('click', () => {
            if (typeof window.p19_wbDeleteBlock === 'function') {
                window.p19_wbDeleteBlock(block.id);
            } else {
                const ws = _migrate(_getData());
                ws.blocks = (ws.blocks || []).filter(b => b.id !== block.id);
                _saveData(ws);
                window.p19_wbRender?.();
            }
        });

        tb.appendChild(penBtn);
        tb.appendChild(eraserBtn);
        tb.appendChild(colorPick);
        tb.appendChild(sizeSlider);
        tb.appendChild(clearBtn);
        tb.appendChild(delBtn);
        el.appendChild(tb);

        /* ── Canvas ── */
        const canvas = document.createElement('canvas');
        canvas.className = 'p24-draw-canvas';
        canvas.height = 280;
        el.appendChild(canvas);

        /* Set canvas width to match container after append */
        requestAnimationFrame(() => {
            const w = el.offsetWidth || 700;
            canvas.width = w;
            /* Restore saved drawing */
            if (block.dataUrl) {
                const img = new Image();
                img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0);
                img.src = block.dataUrl;
            }
        });

        /* ── Drawing logic ── */
        let _drawing = false;
        let _lx = 0, _ly = 0;
        let _saveTimer = null;

        function _getPos(e) {
            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width  / r.width;
            const scaleY = canvas.height / r.height;
            const src = e.touches ? e.touches[0] : e;
            return {
                x: (src.clientX - r.left) * scaleX,
                y: (src.clientY - r.top)  * scaleY,
            };
        }

        function _persistCanvas() {
            clearTimeout(_saveTimer);
            _saveTimer = setTimeout(() => {
                const ws  = _migrate(_getData());
                const blk = (ws.blocks || []).find(b => b.id === block.id);
                if (blk) blk.dataUrl = canvas.toDataURL('image/png');
                _saveData(ws);
            }, 400);
        }

        function _startDraw(e) {
            e.preventDefault();
            _drawing = true;
            const { x, y } = _getPos(e);
            _lx = x; _ly = y;
            const ctx = canvas.getContext('2d');
            /* Single dot on tap */
            ctx.beginPath();
            ctx.arc(x, y, (_tool === 'eraser' ? _size * 3 : _size) / 2, 0, Math.PI * 2);
            ctx.fillStyle = _tool === 'eraser' ? 'rgba(0,0,0,0)' : _color;
            if (_tool === 'eraser') {
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fill();
            }
        }

        function _doDraw(e) {
            if (!_drawing) return;
            e.preventDefault();
            const { x, y } = _getPos(e);
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.lineWidth   = _tool === 'eraser' ? _size * 4 : _size;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.strokeStyle = _tool === 'eraser' ? 'rgba(0,0,0,0)' : _color;
            if (_tool === 'eraser') {
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.moveTo(_lx, _ly); ctx.lineTo(x, y);
                ctx.stroke();
                ctx.restore();
            } else {
                ctx.moveTo(_lx, _ly); ctx.lineTo(x, y);
                ctx.stroke();
            }
            _lx = x; _ly = y;
            _persistCanvas();
        }

        function _stopDraw() {
            if (!_drawing) return;
            _drawing = false;
            _persistCanvas();
        }

        /* Mouse events */
        canvas.addEventListener('mousedown',  _startDraw);
        canvas.addEventListener('mousemove',  _doDraw);
        canvas.addEventListener('mouseup',    _stopDraw);
        canvas.addEventListener('mouseleave', _stopDraw);

        /* Touch events */
        canvas.addEventListener('touchstart',  _startDraw, { passive: false });
        canvas.addEventListener('touchmove',   _doDraw,    { passive: false });
        canvas.addEventListener('touchend',    _stopDraw);
        canvas.addEventListener('touchcancel', _stopDraw);

        return el;
    }

    /* Expose add-draw for the picker button */
    window.p24_wbAddDraw = function() {
        const ws = _migrate(_getData());
        ws.blocks = ws.blocks || [];
        ws.blocks.push({ id: _p24id(), type: 'draw', dataUrl: null });
        _saveData(ws);
        window.p19_wbRender?.();
    };

    /* Patch p19_wbRender to handle draw blocks */
    function _patchRender() {
        if (typeof window.p19_wbRender !== 'function' || window._p24wbRenderDone) {
            if (!window._p24wbRenderDone) { setTimeout(_patchRender, 400); return; }
            return;
        }
        window._p24wbRenderDone = true;

        const origRender = window.p19_wbRender;
        window.p19_wbRender = function() {
            origRender();
            const board = document.getElementById('p19-ws-board'); if (!board) return;
            const ws    = _migrate(_getData());

            (ws.blocks || []).forEach(block => {
                if (block.type !== 'draw') return;
                if (board.querySelector(`[data-bid="${CSS.escape(block.id)}"]`)) return;

                const idx    = (ws.blocks || []).indexOf(block);
                const el     = _buildDrawBlock(block);

                if (idx === 0) {
                    board.insertBefore(el, board.firstChild);
                } else {
                    const prevBlock = ws.blocks[idx - 1];
                    const prevEl    = board.querySelector(`[data-bid="${CSS.escape(prevBlock?.id ?? '')}"]`);
                    if (prevEl) prevEl.after(el);
                    else board.insertBefore(el, board.querySelector('#p19-ws-add-btn-fixed') || null);
                }
            });
        };
    }

    /* Patch the picker to add a "Whiteboard" block button */
    function _patchPicker() {
        if (typeof window.p19_wbOpenPicker !== 'function' || window._p24pickerDone) {
            if (!window._p24pickerDone) { setTimeout(_patchPicker, 400); return; }
            return;
        }
        window._p24pickerDone = true;

        const origOpen = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            origOpen();
            setTimeout(() => {
                const types = document.querySelector('.p19-picker-block-types');
                if (types && !types.querySelector('[data-p24draw]')) {
                    const btn = document.createElement('button');
                    btn.className      = 'p19-picker-type-btn';
                    btn.dataset.p24draw = '1';
                    btn.innerHTML      = '<i class="fa-solid fa-pen-nib"></i>Whiteboard';
                    btn.addEventListener('click', () => {
                        window.p19_wbClosePicker?.();
                        window.p24_wbAddDraw?.();
                    });
                    types.appendChild(btn);
                }

                /* ── Formula search bar ── */
                const sec = document.getElementById('p19-picker-formulas-sec');
                if (sec && !sec.querySelector('.p24-formula-search')) {
                    const wrap = document.createElement('div');
                    wrap.className = 'p24-formula-search';
                    wrap.innerHTML  = `<div class="p24-search-wrap">
                        <i class="fa-solid fa-magnifying-glass p24-search-icon"></i>
                        <input type="text" id="p24-formula-search-inp" placeholder="Search formulas\u2026" autocomplete="off">
                    </div>`;
                    const hdr = sec.querySelector('.p19-picker-section-hdr');
                    if (hdr) hdr.after(wrap);
                    else sec.insertBefore(wrap, sec.firstChild);

                    wrap.querySelector('#p24-formula-search-inp')
                        ?.addEventListener('input', function() {
                            const q = this.value.toLowerCase();
                            document.querySelectorAll('#p19-picker-formula-grid .p19-picker-formula-card')
                                .forEach(card => {
                                    const t = (card.querySelector('.p19-picker-formula-title')?.textContent || '').toLowerCase();
                                    const x = (card.querySelector('.p19-picker-formula-expr')?.textContent  || '').toLowerCase();
                                    card.style.display = (!q || t.includes(q) || x.includes(q)) ? '' : 'none';
                                });
                        });
                }
            }, 50);
        };
    }

    _patchRender();
    _patchPicker();
}

/* ================================================================
   4.  WORKSHEET PDF — popup-window print
       Opens a new window with rendered worksheet content and
       triggers window.print() from there.  More reliable than
       the @media print approach because we control the entire page.
   ================================================================ */
function _p24_worksheetPDF() {
    function _buildPrintCSS() {
        return `
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                background: #fff;
                color: #111;
                padding: 32px 48px;
                line-height: 1.5;
            }
            h1 { font-size: 1.5rem; font-weight: 300; margin-bottom: 20px; color: #222; }
            .p19-ws-block {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 16px 18px;
                margin-bottom: 12px;
                page-break-inside: avoid;
            }
            .p19-ws-block-actions, .p19-ws-block-btn,
            #p19-ws-add-btn-fixed, .p24-draw-toolbar button { display: none !important; }
            .p19-ws-heading-input {
                font-size: 1.15rem; font-weight: 700; color: #111;
                background: transparent; border: none; width: 100%;
            }
            .p19-ws-note-textarea, .p23-ws-code-body {
                background: transparent; border: none; width: 100%;
                color: #222; resize: none; white-space: pre-wrap; word-break: break-word;
            }
            .p19-ws-formula-header { margin-bottom: 8px; }
            .p19-ws-formula-title  { font-weight: 700; font-size: .9rem; color: #111; }
            .p19-ws-formula-expr   {
                font-family: 'Courier New', monospace;
                background: #eff6ff; color: #1d4ed8;
                border: 1px solid #bfdbfe;
                border-radius: 6px;
                padding: 5px 10px;
                font-size: .85rem;
                display: inline-block;
            }
            .p19-ws-result {
                background: #f0fdf4; border: 1px solid #86efac;
                border-radius: 8px; padding: 8px 14px; margin-top: 8px;
                display: flex; align-items: center; gap: 8px;
            }
            .p19-ws-result-val { font-size: 1.1rem; font-weight: 800; color: #166534; font-family: 'Courier New', monospace; }
            .p19-ws-var-row { margin-top: 4px; font-size: .78rem; color: #555; }
            .p19-ws-var-row input { border: none; background: transparent; color: #555; font-size: .78rem; }
            .p24-draw-canvas { border: 1px solid #e5e7eb; border-radius: 6px; max-width: 100%; height: auto; display: block; }
            .p19-ws-sv-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: .7rem; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; margin: 2px; }
            .p19-ws-sv-chip button { display: none; }
            .checklist-block .p22-checklist-item { display: flex; align-items: center; gap: 8px; font-size: .85rem; padding: 3px 0; }
            .p23-ws-code-body { font-family: 'Courier New', monospace; font-size: .8rem; background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 6px; }
            @media print {
                body { padding: 0; }
                .p19-ws-block { page-break-inside: avoid; }
            }
        `;
    }

    function _exportPDF() {
        const board = document.getElementById('p19-ws-board');
        if (!board) { _p24toast('Open the Worksheet first'); return; }

        /* Clone the board to avoid mutating live DOM */
        const clone = board.cloneNode(true);

        /* Remove interactive-only elements */
        clone.querySelectorAll(
            '.p19-ws-block-actions, #p19-ws-add-btn-fixed, ' +
            '.p23-ws-autosave, .p19-picker-*, #p19-ws-picker, ' +
            '#p24-ws-print-btn, #p21-ws-print-btn, ' +
            '.p24-draw-toolbar button'
        ).forEach(el => el.remove());

        /* Convert draw canvases: replace live canvas with <img> */
        const liveCanvases = board.querySelectorAll('.p24-draw-canvas');
        const cloneCanvases = clone.querySelectorAll('.p24-draw-canvas');
        liveCanvases.forEach((cvs, i) => {
            const img = document.createElement('img');
            img.src = cvs.toDataURL('image/png');
            img.className = 'p24-draw-canvas';
            img.style.cssText = 'max-width:100%;height:auto;';
            cloneCanvases[i]?.replaceWith(img);
        });

        const win = window.open('', '_blank', 'width=860,height=700,scrollbars=yes');
        if (!win) {
            _p24toast('Allow pop-ups to export PDF');
            return;
        }

        const title = 'Worksheet — ' + (document.title || 'StudentOS');
        const html = `<!DOCTYPE html>
<html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width">
    <title>${_p24esc(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>${_buildPrintCSS()}</style>
</head><body>
    <h1>Worksheet</h1>
    ${clone.outerHTML}
    <script>
        window.addEventListener('load', function() {
            setTimeout(function() { window.print(); }, 400);
        });
    <\/script>
</body></html>`;

        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    /* Inject an Export PDF button into the worksheet toolbar */
    function _injectBtn() {
        function _try() {
            const toolbar = document.getElementById('p19-ws-toolbar');
            if (!toolbar) { setTimeout(_try, 1200); return; }
            if (document.getElementById('p24-ws-print-btn')) return;

            /* Hide the older p21 print button if it exists */
            const old = document.getElementById('p21-ws-print-btn');
            if (old) old.style.display = 'none';

            const btn = document.createElement('button');
            btn.id        = 'p24-ws-print-btn';
            btn.title     = 'Export worksheet as PDF';
            btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Export PDF';
            btn.addEventListener('click', _exportPDF);

            /* Push to end of toolbar (margin-left:auto takes effect) */
            toolbar.appendChild(btn);
        }
        _try();

        /* Re-inject after worksheet re-renders */
        const view = document.getElementById('view-worksheet');
        if (view) {
            new MutationObserver(() => {
                if (!document.getElementById('p24-ws-print-btn')) _try();
                /* Keep older button hidden */
                const old = document.getElementById('p21-ws-print-btn');
                if (old) old.style.display = 'none';
            }).observe(view, { childList: true, subtree: true });
        } else {
            /* Worksheet view may not exist yet; watch main-scroll */
            const main = document.getElementById('main-scroll');
            if (main) {
                new MutationObserver(() => {
                    const v2 = document.getElementById('view-worksheet');
                    if (!v2 || v2._p24btnWatcher) return;
                    v2._p24btnWatcher = true;
                    new MutationObserver(() => {
                        if (!document.getElementById('p24-ws-print-btn')) _try();
                        const old = document.getElementById('p21-ws-print-btn');
                        if (old) old.style.display = 'none';
                    }).observe(v2, { childList: true, subtree: true });
                    _try();
                }).observe(main, { childList: true });
            }
        }
    }

    _injectBtn();
}

/* ================================================================
   5.  ATTENDANCE — SUMMARY HEADER + RESPONSIVE GRID
       Patches the existing p16_renderAttendance / p21's _render
       to wrap the output in a responsive 2-column grid and prepend
       a summary stats row.
   ================================================================ */
function _p24_attendanceUI() {

    function _buildSummary(courses, log) {
        const total    = courses.length;
        if (!total) return null;

        let allAtt = 0, allSess = 0;
        courses.forEach(c => {
            const cLog = log.filter(l => l.courseId === c.id);
            allSess += cLog.length;
            allAtt  += cLog.filter(l => l.status === 'attended').length;
        });
        const overallPct = allSess > 0 ? Math.round(allAtt / allSess * 100) : 0;
        const pctColor   = overallPct >= 80 ? '#22c55e' : overallPct >= 65 ? '#f59e0b' : '#ef4444';

        const bar = document.createElement('div');
        bar.className = 'p24-att-summary';

        bar.innerHTML = `
            <div class="p24-att-summary-item">
                <div class="p24-att-summary-val">${total}</div>
                <div class="p24-att-summary-lbl">Courses</div>
            </div>
            <div class="p24-att-summary-div"></div>
            <div class="p24-att-summary-item">
                <div class="p24-att-summary-val">${allSess}</div>
                <div class="p24-att-summary-lbl">Sessions</div>
            </div>
            <div class="p24-att-summary-div"></div>
            <div class="p24-att-summary-item">
                <div class="p24-att-summary-val" style="color:${pctColor};">${overallPct}%</div>
                <div class="p24-att-summary-lbl">Overall</div>
            </div>`;
        return bar;
    }

    function _patchRender() {
        /* Wait for p16 (and p21's override) to be set */
        if (typeof window.p16_renderAttendance !== 'function' || window._p24attDone) {
            if (!window._p24attDone) { setTimeout(_patchRender, 300); return; }
            return;
        }
        window._p24attDone = true;

        const _orig = window.p16_renderAttendance;
        window.p16_renderAttendance = function() {
            _orig();

            /* Add summary bar above the courses grid */
            const container = document.getElementById('view-attendance');
            if (!container) return;
            if (document.getElementById('p24-att-summary')) document.getElementById('p24-att-summary').remove();

            const courses = _p24dbG('os_attend_courses', []);
            const log     = _p24dbG('os_attend_log', []);
            if (!courses.length) return;

            const bar = _buildSummary(courses, log);
            if (!bar) return;
            bar.id = 'p24-att-summary';

            const coursesList = document.getElementById('p16-att-courses');
            if (coursesList) {
                /* Insert summary bar directly before the courses list, inside
                   its parent wrapper (the overflow-y-auto div).              */
                const wrapper = coursesList.parentElement || container;
                wrapper.insertBefore(bar, coursesList);
            }

            /* Stamp each course card with its colour for the left-border accent */
            document.querySelectorAll('.p21-att-course-card').forEach((card, i) => {
                const course = courses[i];
                if (course?.color) {
                    card.style.setProperty('--c', course.color);
                    card.style.borderLeftColor = course.color;
                }
            });
        };

        /* Run once immediately if the view is already rendered */
        setTimeout(() => {
            if (!document.getElementById('p16-att-courses')?.children.length) return;
            window.p16_renderAttendance();
        }, 200);
    }

    _patchRender();
}

/* ================================================================
   INIT
   ================================================================ */
(function _p24_init() {
    const _go = () => {
        _p24_taskDnD();
        _p24_formulaModalClean();
        _p24_worksheetDraw();
        _p24_worksheetPDF();
        _p24_attendanceUI();
        console.log('[patches24] loaded — task DnD capture-phase fix, formula modal clean, worksheet draw block + search + PDF, attendance summary');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 200));
    } else {
        setTimeout(_go, 200);
    }
})();
