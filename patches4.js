/* ================================================================
   StudentOS — patches4.js  (final, clean)

   Fixes & features:
   1.  Math symbol picker — formula modal ONLY, not notes
   2.  Task date — remove calendar emoji, use a styled pill
   3.  Notes: add "Move to group" option on each note item
   4.  CSS fixes — search icon centered, colour ✕ centered,
       collab share button far right in toolbar
   5.  Notes sidebar — smooth CSS transition + Ctrl+\ shortcut
   6.  Whiteboard colour picker → compact dropdown
   7.  Grades — "Delete subject" becomes a small corner trash icon
   8.  Forum "Ask a Question" — full inline page, no modal/FAB
   9.  Notes image/PDF insert — visible buttons in Insert dropdown
   10. Per-deck flashcard quick import
   11. Collab avatar bar — only visible on notes tab
   12. QoL: Ctrl+S saves note, Esc closes panels, auto-resize textareas

   Add last in index.html after patches3.js and collab_fix.js:
   <script type="module" src="patches4.js"></script>
   ================================================================ */

/* ════════════════════════════════════════════════════════════════
   GLOBAL CSS
   ════════════════════════════════════════════════════════════════ */
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `

/* ── 1. Math symbol panel ── */
.sym-panel-wrap { position: relative; }
.sym-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 300;
    background: var(--bg-color);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 16px;
    padding: 12px;
    width: 272px;
    display: none;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 8px 36px rgba(0,0,0,.55);
    animation: p4fadeUp .16s ease-out;
}
@keyframes p4fadeUp {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
}
.sym-panel.open { display: flex; }
.sym-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.sym-tab {
    padding: 3px 9px; border-radius: 8px; border: none; cursor: pointer;
    font-size: .62rem; font-weight: 700;
    background: rgba(255,255,255,.06); color: var(--text-muted);
    transition: all .12s;
}
.sym-tab.active { background: var(--accent); color: #fff; }
.sym-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.sym-btn {
    aspect-ratio: 1; border-radius: 7px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.05);
    color: var(--text-main); cursor: pointer; font-size: .88rem;
    display: flex; align-items: center; justify-content: center;
    transition: background .1s, transform .08s;
}
.sym-btn:hover { background: var(--accent); color: #fff; transform: scale(1.1); }

/* ── 2. Task date pill (replaces 📅 emoji) ── */
.task-date-pill {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: .65rem; color: var(--text-muted);
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 6px; padding: 1px 6px; margin-top: 2px;
}
.task-date-pill.overdue { color: #f87171; border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.07); }
.task-date-pill.today   { color: #f59e0b; border-color: rgba(245,158,11,.3); background: rgba(245,158,11,.07); }

/* ── 3. Note move-to-group button ── */
.note-group-move {
    opacity: 0; background: transparent; border: none; cursor: pointer;
    color: var(--text-muted); font-size: .7rem; padding: 4px 5px;
    border-radius: 5px; transition: opacity .15s, color .15s;
    flex-shrink: 0;
}
.group:hover .note-group-move { opacity: 1; }
.note-group-move:hover { color: var(--accent); }

/* Move-to-group dropdown */
.move-group-dd {
    position: fixed; z-index: 400;
    background: var(--bg-color); border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px; padding: 6px; min-width: 160px;
    box-shadow: 0 6px 24px rgba(0,0,0,.45);
    animation: p4fadeUp .12s ease-out;
}
.move-group-opt {
    display: block; width: 100%; padding: 7px 12px; border-radius: 8px;
    border: none; background: transparent; color: var(--text-main);
    font-size: .75rem; text-align: left; cursor: pointer;
    transition: background .1s;
}
.move-group-opt:hover { background: var(--glass-hover); }

/* ── 4. Notes toolbar fixes ── */
/* Share button goes far right — collab btn moved there */
#notes-collab-btn {
    order: 10;
}
/* Centered search icon in note sidebar search */
#p4-nsearch-wrap {
    position: relative;
    padding-bottom: 6px;
}
#p4-nsearch-wrap .srch-ico {
    position: absolute; left: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    z-index: 1;
}
#p4-nsearch {
    width: 100%;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px;
    padding: 6px 10px 6px 28px;
    font-size: .72rem; color: var(--text-main);
    outline: none; box-sizing: border-box; font-family: inherit;
    transition: border-color .15s;
}
#p4-nsearch:focus { border-color: var(--accent); }

/* Centred colour ✕ in task colour picker */
#task-color + button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    vertical-align: middle !important;
    font-size: .55rem !important;
    line-height: 1 !important;
    padding: 0 !important;
    width: 16px !important; height: 16px !important;
}

/* ── 5. Notes sidebar smooth transition ── */
.notes-layout {
    display: grid !important;
    grid-template-columns: 240px 1fr !important;
    gap: 16px !important;
    height: 100% !important;
    transition: grid-template-columns .25s ease !important;
}
.notes-layout.sidebar-hidden {
    grid-template-columns: 0px 1fr !important;
}
.notes-layout.sidebar-hidden #notes-left-panel {
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    min-width: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
}
#notes-left-panel {
    transition: opacity .2s ease !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
}

/* ── 6. Whiteboard colour dropdown ── */
#wb-color-drop-wrap { position: relative; }
#wb-color-trigger {
    width: 22px; height: 22px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.3);
    cursor: pointer; flex-shrink: 0;
    transition: transform .12s;
}
#wb-color-trigger:hover { transform: scale(1.15); }
#wb-color-panel {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 200;
    background: var(--bg-color); border: 1px solid rgba(255,255,255,.12);
    border-radius: 14px; padding: 10px; width: 180px;
    box-shadow: 0 6px 28px rgba(0,0,0,.5);
    display: none; flex-direction: column; gap: 8px;
    animation: p4fadeUp .14s ease-out;
}
#wb-color-panel.open { display: flex; }
.wcp-row { display: flex; gap: 5px; flex-wrap: wrap; }
.wcp-dot {
    width: 22px; height: 22px; border-radius: 50%;
    border: 2px solid transparent; cursor: pointer;
    transition: transform .1s, border-color .1s;
    flex-shrink: 0;
}
.wcp-dot:hover { transform: scale(1.2); }
.wcp-dot.active { border-color: white; }
.wcp-custom { width: 22px; height: 22px; border-radius: 50%; padding: 0;
    border: 2px solid rgba(255,255,255,.25); cursor: pointer; flex-shrink: 0; }

/* ── 7. Grades corner trash ── */
.p4-sub-del {
    position: absolute; bottom: 10px; right: 10px;
    background: transparent; border: none; cursor: pointer;
    color: var(--text-muted); font-size: .7rem; padding: 5px 7px;
    border-radius: 7px; opacity: 0; z-index: 2;
    transition: opacity .15s, color .15s;
}
.p4-sub-del:hover { color: #f87171; }

/* ── 8. Forum ask-question inline page ── */
#forum-ask-page {
    display: none;
    flex-direction: column;
    gap: 14px;
    max-width: 680px;
    margin: 0 auto;
    padding: 4px 0 32px;
    animation: p4fadeUp .18s ease-out;
}
#forum-ask-page.open { display: flex; }
.fap-back {
    display: flex; align-items: center; gap: 8px;
    font-size: .78rem; color: var(--text-muted);
    background: transparent; border: none; cursor: pointer;
    transition: color .12s; padding: 0;
}
.fap-back:hover { color: var(--text-main); }
.fap-title { font-size: 1.4rem; font-weight: 300; letter-spacing: -.02em; }
.fap-field { display: flex; flex-direction: column; gap: 5px; }
.fap-label {
    font-size: .6rem; font-weight: 800; letter-spacing: .1em;
    text-transform: uppercase; color: var(--text-muted);
}
.fap-input, .fap-select, .fap-textarea {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 12px; padding: 11px 14px;
    color: var(--text-main); font-size: .88rem; font-family: inherit;
    outline: none; transition: border-color .15s;
    box-sizing: border-box; width: 100%;
}
.fap-input:focus, .fap-select:focus, .fap-textarea:focus {
    border-color: var(--accent);
}
.fap-textarea { min-height: 140px; resize: vertical; line-height: 1.65; }
.fap-submit {
    align-self: flex-end;
    padding: 10px 24px; border-radius: 12px;
    background: var(--accent); color: #fff;
    font-size: .85rem; font-weight: 700; border: none; cursor: pointer;
    display: flex; align-items: center; gap: 7px;
    transition: opacity .12s;
}
.fap-submit:hover { opacity: .88; }

/* ── 9. Notes image/PDF insert ── */
/* (no extra CSS needed – handled by button injection) */

/* ── 10. Per-deck import modal ── */
#p4-imp-modal {
    position: fixed; inset: 0; z-index: 220;
    background: rgba(0,0,0,.65); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
}
#p4-imp-box {
    background: var(--bg-color);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 22px; padding: 26px;
    width: min(460px, 96vw);
    box-shadow: 0 12px 48px rgba(0,0,0,.5);
    display: flex; flex-direction: column; gap: 14px;
}
#p4-imp-ta {
    width: 100%; min-height: 150px; resize: vertical;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px; padding: 11px 13px;
    color: var(--text-main); font-size: .82rem;
    font-family: 'JetBrains Mono', monospace;
    outline: none; box-sizing: border-box; line-height: 1.6;
    transition: border-color .15s;
}
#p4-imp-ta:focus { border-color: var(--accent); }

/* ── 11. Collab avatar bar – only notes tab ── */
#collab-users-bar { display: none !important; }
#collab-users-bar.show { display: flex !important; }

` }));


/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */
function _toast(msg, isErr = false) {
    /* Use global if available (patches3), otherwise create */
    if (window._toast && window._toast !== _toast) { window._toast(msg, isErr); return; }
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg; t.style.background = isErr ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 2200);
}
window._toast = _toast;

function _patchFn(name, after, guardProp) {
    /* Retry until real (non-stub) function is available on window */
    if (typeof window[name] !== 'function' || window[name]._sos_stub) { setTimeout(() => _patchFn(name, after, guardProp), 200); return; }
    if (guardProp && window[guardProp]) return;
    if (guardProp) window[guardProp] = true;
    const _o = window[name];
    window[name] = function(...a) { const r = _o.apply(this, a); after(...a); return r; };
}

/* ════════════════════════════════════════════════════════════════
   1. MATH SYMBOL PICKER — formula modal ONLY
   ════════════════════════════════════════════════════════════════ */
(function symPicker() {
    const GROUPS = {
        'Basic':   ['+','−','×','÷','=','≠','≈','±','≤','≥',
                    '½','⅓','¼','⅔','¾','²','³','⁴','⁵','⁶','⁷',
                    '₁','₂','₃','₄','₅','√','∛','∜','∞','°','%'],
        'Greek':   ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ',
                    'ν','ξ','π','ρ','σ','τ','υ','φ','χ','ψ','ω',
                    'Δ','Λ','Π','Σ','Φ','Ψ','Ω'],
        'Arrows':  ['→','←','↑','↓','↔','⇒','⇐','⇔','⟹','⟺','∴','∵','∝'],
        'Sets':    ['∈','∉','⊂','⊃','⊆','⊇','∩','∪','∅','∀','∃','¬','|','‖'],
        'Calc':    ['∫','∬','∮','∂','∇','∑','∏','′','″','‴'],
    };
    let _grp = 'Basic';

    function _insert(sym) {
        const ta = document.getElementById('formula-modal-formula');
        if (!ta) return;
        const s = ta.selectionStart, e = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + sym + ta.value.slice(e);
        ta.setSelectionRange(s + sym.length, s + sym.length);
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function _buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'sym-panel';

        function _render() {
            panel.innerHTML = '';
            const tabs = document.createElement('div'); tabs.className = 'sym-tabs';
            Object.keys(GROUPS).forEach(g => {
                const t = document.createElement('button');
                t.className = `sym-tab${g === _grp ? ' active' : ''}`;
                t.textContent = g;
                t.onclick = ev => {
                    ev.stopPropagation();
                    _grp = g;
                    panel.querySelectorAll('.sym-tab').forEach(b => b.classList.toggle('active', b.textContent === g));
                    _renderGrid();
                };
                tabs.appendChild(t);
            });
            panel.appendChild(tabs);

            const grid = document.createElement('div'); grid.className = 'sym-grid';
            panel.appendChild(grid);
            _renderGrid();

            function _renderGrid() {
                grid.innerHTML = '';
                GROUPS[_grp].forEach(sym => {
                    const b = document.createElement('button');
                    b.className = 'sym-btn'; b.textContent = sym; b.title = sym;
                    b.onclick = ev => { ev.stopPropagation(); _insert(sym); };
                    grid.appendChild(b);
                });
            }
        }
        _render();
        return panel;
    }

    /* Inject "Insert symbol" above the formula textarea when modal opens */
    function _inject() {
        const ta = document.getElementById('formula-modal-formula');
        if (!ta || ta.dataset.sym4) return;
        ta.dataset.sym4 = '1';

        const wrap = document.createElement('div');
        wrap.className = 'sym-panel-wrap';
        wrap.style.cssText = 'margin-bottom:8px;';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
            display:flex;align-items:center;gap:6px;width:100%;
            padding:7px 12px;border-radius:10px;
            background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);
            color:var(--text-muted);font-size:.72rem;font-weight:700;cursor:pointer;
            transition:background .12s,color .12s;
        `;
        btn.innerHTML = '<i class="fa-solid fa-omega" style="color:var(--accent)"></i> Insert symbol…';
        btn.onmouseenter = () => { btn.style.background='rgba(255,255,255,.1)'; btn.style.color='var(--text-main)'; };
        btn.onmouseleave = () => { btn.style.background='rgba(255,255,255,.06)'; btn.style.color='var(--text-muted)'; };

        const panel = _buildPanel();
        btn.onclick = ev => { ev.stopPropagation(); panel.classList.toggle('open'); };

        wrap.appendChild(btn);
        wrap.appendChild(panel);
        ta.parentNode.insertBefore(wrap, ta);
    }

    /* Hook into openModal */
    _patchFn('openModal', (id) => {
        if (id === 'modal-formula') setTimeout(_inject, 40);
    }, '_p4OMsym');

    /* Close on outside click */
    document.addEventListener('click', () =>
        document.querySelectorAll('.sym-panel.open').forEach(p => p.classList.remove('open'))
    );
})();


/* ════════════════════════════════════════════════════════════════
   2. TASK DATE — styled pill, no calendar emoji
   ════════════════════════════════════════════════════════════════ */
(function taskDatePill() {
    _patchFn('renderTasks', () => {
        const today = new Date().toISOString().split('T')[0];
        document.querySelectorAll('[id^="task-row-"]').forEach(row => {
            /* Find the 📅 date element and replace it */
            const spans = row.querySelectorAll('div.text-\\[10px\\]');
            spans.forEach(el => {
                const txt = el.textContent.trim();
                if (!txt.includes('📅')) return;
                const date = txt.replace('📅', '').trim();
                const overdue = date < today;
                const isToday = date === today;
                const cls = isToday ? 'today' : overdue ? 'overdue' : '';
                el.outerHTML = `<div class="task-date-pill ${cls}">
                    <i class="fa-regular fa-calendar" style="font-size:.55rem"></i>
                    ${date}
                </div>`;
            });
        });
    }, '_p4rtPatch');
})();


/* ════════════════════════════════════════════════════════════════
   3. NOTES — "Move to group" button on each note item
   ════════════════════════════════════════════════════════════════ */
(function noteGroupMove() {
    function _injectMoveButtons() {
        const sidebar = document.getElementById('notes-sidebar');
        if (!sidebar) return;

        sidebar.querySelectorAll('[onclick*="loadNote"]').forEach(btn => {
            const row = btn.closest('.flex.items-center.group');
            if (!row || row.querySelector('.note-group-move')) return;

            /* Extract note id */
            const m = btn.getAttribute('onclick')?.match(/loadNote\((\d+)\)/);
            if (!m) return;
            const noteId = parseInt(m[1]);

            const moveBtn = document.createElement('button');
            moveBtn.className = 'note-group-move';
            moveBtn.title = 'Move to group';
            moveBtn.innerHTML = '<i class="fa-solid fa-folder-arrow-down"></i>';
            moveBtn.onclick = ev => { ev.stopPropagation(); _showGroupDropdown(noteId, moveBtn); };

            /* Insert before the trash button */
            const trash = row.querySelector('[onclick*="confirmDeleteNote"]');
            if (trash) row.insertBefore(moveBtn, trash);
            else row.appendChild(moveBtn);
        });
    }

    function _showGroupDropdown(noteId, anchor) {
        /* Remove any existing dropdown */
        document.getElementById('p4-move-dd')?.remove();

        const noteGroups = typeof window.DB !== 'undefined'
            ? window.DB.get('os_note_groups', [])
            : JSON.parse(localStorage.getItem('os_note_groups') || '[]');

        const dd = document.createElement('div');
        dd.id = 'p4-move-dd';
        dd.className = 'move-group-dd';

        /* Position near the button */
        const rect = anchor.getBoundingClientRect();
        dd.style.cssText = `top:${rect.bottom + 4}px;left:${rect.left}px;`;

        /* "No group" option */
        const none = document.createElement('button');
        none.className = 'move-group-opt';
        none.textContent = '— No group';
        none.onclick = () => { _moveNote(noteId, null); dd.remove(); };
        dd.appendChild(none);

        if (noteGroups.length === 0) {
            const hint = document.createElement('div');
            hint.style.cssText = 'padding:6px 12px;font-size:.7rem;color:var(--text-muted);';
            hint.textContent = 'No groups yet — create one first';
            dd.appendChild(hint);
        } else {
            noteGroups.forEach(g => {
                const opt = document.createElement('button');
                opt.className = 'move-group-opt';
                const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color||'var(--accent)'};margin-right:6px;"></span>`;
                opt.innerHTML = dot + g.name;
                opt.onclick = () => { _moveNote(noteId, g.id); dd.remove(); };
                dd.appendChild(opt);
            });
        }

        document.body.appendChild(dd);

        /* Close on outside click */
        setTimeout(() => {
            document.addEventListener('click', function _close() {
                dd.remove();
                document.removeEventListener('click', _close);
            });
        }, 50);
    }

    function _moveNote(noteId, groupId) {
        if (typeof window.DB !== 'undefined') {
            const notes = window.DB.get('os_notes', []);
            const n = notes.find(x => x.id === noteId);
            if (!n) return;
            n.groupId = groupId;
            window.DB.set('os_notes', notes);
        } else {
            const notes = JSON.parse(localStorage.getItem('os_notes') || '[]');
            const n = notes.find(x => x.id === noteId);
            if (!n) return;
            n.groupId = groupId;
            localStorage.setItem('os_notes', JSON.stringify(notes));
        }
        if (typeof window.renderNotes === 'function') window.renderNotes();
        _toast(groupId ? 'Note moved to group ✓' : 'Note removed from group');
    }

    /* Re-inject after renderNotes */
    _patchFn('renderNotes', () => setTimeout(_injectMoveButtons, 30), '_p4rnPatch');
    setTimeout(_injectMoveButtons, 700);
})();


/* ════════════════════════════════════════════════════════════════
   4. NOTES TOOLBAR — sidebar search + collab btn alignment
   ════════════════════════════════════════════════════════════════ */
(function notesUIFix() {
    /* ── Replace old broken search with clean version ── */
    function _injectSearch() {
        const sidebar = document.getElementById('notes-sidebar');
        if (!sidebar || document.getElementById('p4-nsearch')) return;

        const wrap = document.createElement('div');
        wrap.id = 'p4-nsearch-wrap';

        const ico = document.createElement('i');
        ico.className = 'fa-solid fa-magnifying-glass srch-ico';
        const inp = document.createElement('input');
        inp.id = 'p4-nsearch';
        inp.placeholder = 'Search notes…';
        inp.type = 'text';

        wrap.appendChild(ico);
        wrap.appendChild(inp);
        sidebar.parentNode.insertBefore(wrap, sidebar);

        inp.addEventListener('input', function() {
            const q = this.value.toLowerCase().trim();
            sidebar.querySelectorAll('button[onclick*="loadNote"]').forEach(btn => {
                const row = btn.closest('div');
                if (row) row.style.display = (!q || btn.textContent.toLowerCase().includes(q)) ? '' : 'none';
            });
        });
        inp.addEventListener('focus', () => { inp.style.borderColor = 'var(--accent)'; });
        inp.addEventListener('blur',  () => { inp.style.borderColor = 'rgba(255,255,255,.08)'; });
    }

    /* ── Move collab button to far right of toolbar ── */
    function _fixCollabPos() {
        const rightDiv = document.querySelector('#note-toolbar .ml-auto');
        const collabBtn = document.getElementById('notes-collab-btn');
        if (!rightDiv || !collabBtn) return;
        /* Make it the LAST item */
        rightDiv.appendChild(collabBtn);
        /* Make the existing trash button subtler */
        const trash = rightDiv.querySelector('button[onclick*="deleteCurrentNote"]');
        if (trash) {
            trash.style.opacity = '.45';
            trash.onmouseenter = () => { trash.style.opacity='1'; trash.style.color='#f87171'; };
            trash.onmouseleave = () => { trash.style.opacity='.45'; trash.style.color=''; };
        }
    }

    _patchFn('switchTab', (name) => {
        if (name === 'notes') { setTimeout(_injectSearch, 80); setTimeout(_fixCollabPos, 80); }
    }, '_p4stNotes');
    setTimeout(_injectSearch, 600);
    setTimeout(_fixCollabPos, 700);
})();


/* ════════════════════════════════════════════════════════════════
   5. NOTES SIDEBAR — Ctrl+\ shortcut + ensure CSS works
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        window.toggleNotesSidebar?.();
    }
});
setTimeout(() => {
    const b = document.getElementById('notes-sidebar-toggle-btn');
    if (b) b.title = 'Toggle sidebar (Ctrl+\\)';
}, 500);


/* ════════════════════════════════════════════════════════════════
   6. WHITEBOARD COLOUR DROPDOWN
   Replaces individual colour circles with a compact picker button
   ════════════════════════════════════════════════════════════════ */
(function wbColorDropdown() {
    const COLORS = [
        { hex: '#ffffff', label: 'White'  },
        { hex: '#1a1a1a', label: 'Black'  },
        { hex: '#ef4444', label: 'Red'    },
        { hex: '#3b82f6', label: 'Blue'   },
        { hex: '#22c55e', label: 'Green'  },
        { hex: '#f59e0b', label: 'Amber'  },
        { hex: '#8b5cf6', label: 'Violet' },
        { hex: '#fde047', label: 'Yellow' },
        { hex: '#ec4899', label: 'Pink'   },
        { hex: '#14b8a6', label: 'Teal'   },
        { hex: '#f97316', label: 'Orange' },
        { hex: '#6366f1', label: 'Indigo' },
    ];

    let _curColor = '#ffffff';

    function _inject() {
        const toolbar = document.querySelector('.wb-toolbar-row');
        if (!toolbar || document.getElementById('wb-color-drop-wrap')) return;

        /* Find and HIDE the existing colour buttons */
        const allBtns = toolbar.querySelectorAll('button[onclick*="setPenColor"]');
        const colorInput = toolbar.querySelector('#wb-custom-color');
        allBtns.forEach(b => b.style.display = 'none');
        if (colorInput) colorInput.style.display = 'none';

        /* Also hide the adjacent dividers if they become orphaned */
        toolbar.querySelectorAll('.wb-divider').forEach((d, i) => {
            /* We'll rebuild cleanly — just hide all and re-insert one */
        });

        /* Build dropdown */
        const wrap = document.createElement('div');
        wrap.id = 'wb-color-drop-wrap';
        wrap.className = 'wb-tool-group';
        wrap.style.position = 'relative';

        const trigger = document.createElement('div');
        trigger.id = 'wb-color-trigger';
        trigger.style.background = _curColor;
        trigger.title = 'Pen colour';
        trigger.onclick = ev => { ev.stopPropagation(); panel.classList.toggle('open'); };

        const panel = document.createElement('div');
        panel.id = 'wb-color-panel';

        /* Colour grid */
        const grid = document.createElement('div');
        grid.className = 'wcp-row';
        COLORS.forEach(c => {
            const dot = document.createElement('div');
            dot.className = 'wcp-dot' + (c.hex === _curColor ? ' active' : '');
            dot.style.background = c.hex;
            dot.title = c.label;
            dot.onclick = ev => {
                ev.stopPropagation();
                _setColor(c.hex);
                panel.querySelectorAll('.wcp-dot').forEach(d => d.classList.toggle('active', d.title === c.label));
                trigger.style.background = c.hex;
            };
            grid.appendChild(dot);
        });

        /* Custom colour picker */
        const custom = document.createElement('input');
        custom.type = 'color'; custom.className = 'wcp-custom'; custom.value = '#ffffff';
        custom.title = 'Custom colour';
        custom.onchange = function() {
            _setColor(this.value);
            trigger.style.background = this.value;
            panel.querySelectorAll('.wcp-dot').forEach(d => d.classList.remove('active'));
        };
        grid.appendChild(custom);

        panel.appendChild(grid);
        wrap.appendChild(trigger);
        wrap.appendChild(panel);

        /* Insert before size range — find a wb-divider after the shape tools */
        const sizeInput = toolbar.querySelector('#wb-size');
        if (sizeInput) {
            /* Find the divider before size */
            let target = sizeInput.previousElementSibling;
            while (target && !target.classList.contains('wb-divider')) {
                target = target.previousElementSibling;
            }
            if (target) {
                toolbar.insertBefore(wrap, target);
                const div = document.createElement('div');
                div.className = 'wb-divider';
                toolbar.insertBefore(div, target);
            } else {
                toolbar.insertBefore(wrap, sizeInput);
            }
        } else {
            toolbar.appendChild(wrap);
        }

        /* Close on outside click */
        document.addEventListener('click', () => panel.classList.remove('open'));
    }

    function _setColor(hex) {
        _curColor = hex;
        if (typeof window.setPenColor === 'function') window.setPenColor(hex);
    }

    _patchFn('switchTab', name => {
        if (name === 'whiteboard') setTimeout(_inject, 100);
    }, '_p4stWB');
    setTimeout(_inject, 500);
})();


/* ════════════════════════════════════════════════════════════════
   7. GRADES — small corner trash, hide text button
   ════════════════════════════════════════════════════════════════ */
(function gradeCornerTrash() {
    function _inject() {
        const c = document.getElementById('subjects-container');
        if (!c) return;
        Array.from(c.children).forEach(card => {
            if (card.querySelector('.p4-sub-del')) return;
            const textDel = card.querySelector('button[onclick*="deleteSubject"]');
            if (!textDel) return;
            const m = textDel.getAttribute('onclick')?.match(/deleteSubject\((\d+)\)/);
            if (!m) return;
            textDel.style.display = 'none';
            card.style.position = 'relative';
            const btn = document.createElement('button');
            btn.className = 'p4-sub-del';
            btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            btn.title = 'Delete subject';
            btn.onclick = e => {
                e.stopPropagation();
                window.deleteSubject?.(parseInt(m[1]));
            };
            card.onmouseenter = () => btn.style.opacity = '1';
            card.onmouseleave = () => btn.style.opacity = '0';
            card.appendChild(btn);
        });
    }
    _patchFn('renderGrades', () => setTimeout(_inject, 40), '_p4rgPatch');
    setTimeout(_inject, 700);
})();


/* ════════════════════════════════════════════════════════════════
   8. FORUM — "Ask a Question" as a full inline page
   ════════════════════════════════════════════════════════════════ */
(function forumAskPage() {
    function _buildAskPage() {
        if (document.getElementById('forum-ask-page')) return;

        /* Insert INSIDE the forum list view, hidden by default */
        const listView = document.getElementById('forum-list-view');
        if (!listView) return;

        const page = document.createElement('div');
        page.id = 'forum-ask-page';
        page.innerHTML = `
            <button class="fap-back" id="fap-back-btn">
                <i class="fa-solid fa-arrow-left"></i> Back to forum
            </button>
            <div>
                <h2 class="fap-title">Ask a Question</h2>
                <p style="font-size:.75rem;color:var(--text-muted);margin-top:4px;">
                    Be specific — the more detail you give, the better the answers.
                </p>
            </div>
            <div id="fap-error" style="color:#f87171;font-size:.75rem;min-height:16px;"></div>
            <div class="fap-field">
                <label class="fap-label">Title</label>
                <input id="fap-title" class="fap-input" type="text"
                    placeholder="What's your question? (be specific)"
                    onkeydown="if(event.key==='Enter')document.getElementById('fap-body').focus()">
            </div>
            <div class="fap-field">
                <label class="fap-label">Subject</label>
                <select id="fap-subject" class="fap-select">
                    <option value="math">Mathematics</option>
                    <option value="science">Sciences</option>
                    <option value="english">English</option>
                    <option value="history">History</option>
                    <option value="it">IT &amp; CS</option>
                    <option value="other" selected>Other</option>
                </select>
            </div>
            <div class="fap-field">
                <label class="fap-label">Details</label>
                <textarea id="fap-body" class="fap-textarea"
                    placeholder="Describe your question in detail…"
                    onkeydown="if(event.ctrlKey&&event.key==='Enter')document.getElementById('fap-submit').click()"></textarea>
            </div>
            <p style="font-size:.65rem;color:var(--text-muted);">Ctrl+Enter to post</p>
            <button id="fap-submit" class="fap-submit">
                <i class="fa-solid fa-paper-plane"></i> Post Question
            </button>
        `;

        listView.appendChild(page);

        /* Wire back button */
        page.querySelector('#fap-back-btn').onclick = _closeAskPage;

        /* Wire submit */
        page.querySelector('#fap-submit').onclick = _submitAskPage;
    }

    function _openAskPage() {
        _buildAskPage();
        /* Hide the post list + subject bar + sort row */
        document.getElementById('forum-post-list')?.style.setProperty('display', 'none');
        document.getElementById('forum-subject-bar')?.style.setProperty('display', 'none');
        document.querySelector('.forum-sort-row')?.style.setProperty('display', 'none');
        document.querySelector('.forum-topbar')?.style.setProperty('display', 'none');
        document.getElementById('forum-fab')?.classList.add('hidden');
        /* Also hide search/filter if patches4 added them */
        document.getElementById('forum-search-wrap')?.style.setProperty('display', 'none');
        document.querySelector('.forum-filter-chips')?.style.setProperty('display', 'none');

        /* Show ask page */
        const page = document.getElementById('forum-ask-page');
        if (page) { page.classList.add('open'); setTimeout(() => document.getElementById('fap-title')?.focus(), 80); }
    }

    function _closeAskPage() {
        document.getElementById('forum-ask-page')?.classList.remove('open');
        document.getElementById('forum-post-list')?.style.removeProperty('display');
        document.getElementById('forum-subject-bar')?.style.removeProperty('display');
        document.querySelector('.forum-sort-row')?.style.removeProperty('display');
        document.querySelector('.forum-topbar')?.style.removeProperty('display');
        document.getElementById('forum-search-wrap')?.style.removeProperty('display');
        document.querySelector('.forum-filter-chips')?.style.removeProperty('display');
        /* Re-show FAB */
        const fab = document.getElementById('forum-fab');
        if (fab) fab.classList.remove('hidden');
        /* Clear fields */
        const t = document.getElementById('fap-title');
        const b = document.getElementById('fap-body');
        const e = document.getElementById('fap-error');
        if (t) t.value = '';
        if (b) b.value = '';
        if (e) e.textContent = '';
    }

    async function _submitAskPage() {
        const title   = document.getElementById('fap-title')?.value.trim();
        const body    = document.getElementById('fap-body')?.value.trim();
        const subject = document.getElementById('fap-subject')?.value || 'other';
        const errEl   = document.getElementById('fap-error');
        const btn     = document.getElementById('fap-submit');

        if (!title) { if (errEl) errEl.textContent = 'Please enter a title.'; return; }
        if (!body)  { if (errEl) errEl.textContent = 'Please describe your question.'; return; }
        if (errEl) errEl.textContent = '';

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Posting…'; }

        /* Use the existing forumSubmitPost logic by populating the hidden form fields */
        const hiddenTitle   = document.getElementById('forum-new-title');
        const hiddenBody    = document.getElementById('forum-new-body');
        const hiddenSubject = document.getElementById('forum-new-subject');
        if (hiddenTitle)   hiddenTitle.value   = title;
        if (hiddenBody)    hiddenBody.value    = body;
        if (hiddenSubject) hiddenSubject.value = subject;

        try {
            await window.forumSubmitPost?.();
            _closeAskPage();
            _toast('Question posted! ✓');
        } catch(e) {
            console.error('[p4] post error:', e);
            if (errEl) errEl.textContent = 'Failed to post — check your connection.';
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post Question'; }
        }
    }

    /* Override forumOpenNew to use our page instead of the panel */
    function _override() {
        if (typeof window.forumOpenNew !== 'function') { setTimeout(_override, 200); return; }
        if (window._p4forumOverridden) return;
        window._p4forumOverridden = true;
        window.forumOpenNew = _openAskPage;
        /* Also hide the old panel */
        document.getElementById('forum-new-panel')?.style.setProperty('display', 'none');
    }
    _override();

    /* Also change the FAB label */
    setTimeout(() => {
        const fab = document.getElementById('forum-fab');
        if (fab) { fab.innerHTML = '<i class="fa-solid fa-plus"></i> Ask a Question'; }
    }, 600);
})();


/* ════════════════════════════════════════════════════════════════
   9. NOTES — image + PDF insert more prominent
   ════════════════════════════════════════════════════════════════ */
(function notesInsertButtons() {
    function _inject() {
        const toolbar = document.getElementById('note-toolbar');
        if (!toolbar || toolbar.dataset.p4ins) return;
        toolbar.dataset.p4ins = '1';

        /* The existing Insert dropdown already has image and PDF — we just
           make them always visible as quick-access buttons in the right area */
        const rightDiv = toolbar.querySelector('.ml-auto');
        if (!rightDiv) return;

        /* Image quick button */
        if (!document.getElementById('p4-img-quick')) {
            const imgBtn = document.createElement('button');
            imgBtn.id = 'p4-img-quick';
            imgBtn.className = 'nt-btn';
            imgBtn.title = 'Insert image';
            imgBtn.innerHTML = '<i class="fa-regular fa-image" style="font-size:.7rem"></i>';
            imgBtn.onclick = () => document.getElementById('note-img-input')?.click();
            /* Insert before the stats */
            const stats = rightDiv.querySelector('#note-stats');
            rightDiv.insertBefore(imgBtn, stats || rightDiv.firstChild);
        }

        /* PDF quick button */
        if (!document.getElementById('p4-pdf-quick')) {
            const pdfBtn = document.createElement('button');
            pdfBtn.id = 'p4-pdf-quick';
            pdfBtn.className = 'nt-btn';
            pdfBtn.title = 'Annotate PDF';
            pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf" style="font-size:.7rem;color:#f87171"></i>';
            pdfBtn.onclick = () => window.openPdfAnnotator?.();
            const imgBtn = document.getElementById('p4-img-quick');
            rightDiv.insertBefore(pdfBtn, imgBtn?.nextSibling || rightDiv.firstChild);
        }
    }

    _patchFn('switchTab', name => { if (name === 'notes') setTimeout(_inject, 100); }, '_p4stIns');
    setTimeout(_inject, 600);
})();


/* ════════════════════════════════════════════════════════════════
   10. PER-DECK FLASHCARD QUICK IMPORT
   ════════════════════════════════════════════════════════════════ */
(function deckQuickImport() {
    function _parse(text) {
        return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
            let q, a;
            if (line.includes('\t')) {
                const parts = line.split('\t');
                q = parts[0]; a = parts.slice(1).join('\t');
            } else if (/ - /.test(line)) {
                const i = line.indexOf(' - ');
                q = line.slice(0, i); a = line.slice(i + 3);
            } else if (line.includes(',')) {
                const i = line.indexOf(',');
                q = line.slice(0, i); a = line.slice(i + 1);
            } else {
                q = line; a = '';
            }
            return { q: q?.trim() || '', a: a?.trim() || '' };
        }).filter(c => c.q);
    }

    function _doImport(deckId, cards) {
        try {
            let decks = typeof window.DB !== 'undefined'
                ? window.DB.get('os_decks', [])
                : JSON.parse(localStorage.getItem('os_decks') || '[]');
            const deck = decks.find(d => d.id === deckId);
            if (!deck) return;
            if (!deck.cards) deck.cards = [];
            const now = Date.now();
            cards.forEach((c, i) => deck.cards.push({
                id: now + i, question: c.q, answer: c.a,
                hint: '', hard: false, starred: false,
            }));
            if (typeof window.DB !== 'undefined') window.DB.set('os_decks', decks);
            else localStorage.setItem('os_decks', JSON.stringify(decks));
            window.renderDecks?.();
            window.updateDashWidgets?.();
        } catch(e) { console.error('[p4] import', e); }
    }

    function _openModal(deckId, deckName) {
        document.getElementById('p4-imp-modal')?.remove();
        const m = document.createElement('div');
        m.id = 'p4-imp-modal';
        m.innerHTML = `<div id="p4-imp-box">
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-file-import" style="color:var(--accent)"></i>
                <h3 style="font-size:.95rem;font-weight:700;margin:0;">Import into "${deckName}"</h3>
                <button id="p4ic" style="margin-left:auto;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:.85rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:.72rem;color:var(--text-muted);margin:0;line-height:1.6;">
                One card per line. Separate term and definition with a
                <strong>comma</strong>, <strong> - </strong>, or <strong>tab</strong>.
            </p>
            <textarea id="p4-imp-ta" placeholder="Photosynthesis, process plants use to make food&#10;Mitosis - cell division&#10;DNA&#9;deoxyribonucleic acid"></textarea>
            <div id="p4ip" style="font-size:.7rem;color:var(--text-muted);min-height:16px;"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button id="p4ix" style="padding:8px 16px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--text-muted);font-size:.78rem;font-weight:600;cursor:pointer;">Cancel</button>
                <button id="p4is" style="padding:8px 18px;border-radius:10px;background:var(--accent);color:#fff;font-size:.78rem;font-weight:700;border:none;cursor:pointer;">Import cards</button>
            </div>
        </div>`;
        document.body.appendChild(m);

        const ta = m.querySelector('#p4-imp-ta');
        const prev = m.querySelector('#p4ip');

        ta.addEventListener('input', () => {
            const n = _parse(ta.value).length;
            prev.textContent = n ? `${n} card${n === 1 ? '' : 's'} detected` : '';
        });
        m.querySelector('#p4ic').onclick = () => m.remove();
        m.querySelector('#p4ix').onclick = () => m.remove();
        m.onclick = e => { if (e.target === m) m.remove(); };
        m.querySelector('#p4is').onclick = () => {
            const cards = _parse(ta.value);
            if (!cards.length) { prev.textContent = 'No valid cards found.'; prev.style.color = '#f87171'; return; }
            _doImport(deckId, cards);
            m.remove();
            _toast(`Imported ${cards.length} card${cards.length === 1 ? '' : 's'} ✓`);
        };
        setTimeout(() => ta.focus(), 40);
    }

    function _injectButtons() {
        document.querySelectorAll('[onclick*="openDeck"]').forEach(card => {
            if (card.querySelector('.p4-deck-imp')) return;
            const mm = card.getAttribute('onclick')?.match(/openDeck\((\d+)\)/);
            if (!mm) return;
            const deckId = parseInt(mm[1]);
            let deckName = 'Deck';
            try {
                const decks = typeof window.DB !== 'undefined'
                    ? window.DB.get('os_decks', [])
                    : JSON.parse(localStorage.getItem('os_decks') || '[]');
                deckName = decks.find(d => d.id === deckId)?.name || 'Deck';
            } catch(e) {}

            const btn = document.createElement('button');
            btn.className = 'p4-deck-imp';
            btn.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 10px;
                border-radius:8px;background:rgba(255,255,255,.05);
                border:1px solid rgba(255,255,255,.08);color:var(--text-muted);
                font-size:.68rem;font-weight:700;cursor:pointer;
                transition:background .12s,color .12s;margin-top:4px;width:100%;`;
            btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Quick import';
            btn.onmouseenter = () => { btn.style.background='rgba(255,255,255,.1)';btn.style.color='var(--text-main)'; };
            btn.onmouseleave = () => { btn.style.background='rgba(255,255,255,.05)';btn.style.color='var(--text-muted)'; };
            btn.onclick = e => { e.stopPropagation(); _openModal(deckId, deckName); };
            card.appendChild(btn);
        });
    }

    _patchFn('renderDecks', () => setTimeout(_injectButtons, 60), '_p4rdPatch');
    setTimeout(_injectButtons, 700);
})();


/* ════════════════════════════════════════════════════════════════
   11. COLLAB AVATAR BAR — only on notes tab
   ════════════════════════════════════════════════════════════════ */
(function collabVisibility() {
    function _update() {
        const hidden = document.getElementById('view-notes')?.classList.contains('hidden');
        const bar = document.getElementById('collab-users-bar');
        if (!bar) return;
        bar.classList.toggle('show', !hidden && !!window._collabId);
    }
    _patchFn('switchTab', _update, '_p4cvPatch');
    setInterval(_update, 2000);
})();


/* ════════════════════════════════════════════════════════════════
   12. QoL — Ctrl+S, Escape, auto-resize textareas
   ════════════════════════════════════════════════════════════════ */
/* Ctrl+S to save note */
document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== 's') return;
    if (!document.getElementById('view-notes')?.classList.contains('hidden')) {
        e.preventDefault();
        window.saveNote?.();
        window._p3ShowSaved?.();
    }
});

/* Escape closes open panels */
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.getElementById('p4-move-dd')?.remove();
    document.querySelectorAll('.sym-panel.open, #wb-color-panel.open')
        .forEach(p => p.classList.remove('open'));
    /* Close collab panel */
    document.getElementById('collab-panel')?.remove();
    /* Close grade edit modal */
    document.getElementById('p3-sm')?.remove();
});

/* Auto-resize textareas in forum and formula modal */
(function autoResize() {
    const IDS = ['forum-reply-input', 'forum-new-body', 'formula-modal-note', 'fap-body'];
    const setup = id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.ar) return;
        el.dataset.ar = '1';
        el.addEventListener('input', () => {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 360) + 'px';
        });
    };
    IDS.forEach(setup);
    // Also try again when forum/formula opens
    _patchFn('openModal', id => {
        if (id === 'modal-formula') setTimeout(() => setup('formula-modal-note'), 50);
    }, '_p4arPatch');
    setTimeout(() => IDS.forEach(setup), 600);
})();


console.log('[StudentOS patches4 final] ✓  All features active.');