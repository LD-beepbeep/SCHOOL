/* ================================================================
   StudentOS — patches4.js  (final polish)

   1. Math keyboard — floating panel, organised groups, works in
      formula modal AND in notes (toggle with Alt+M)
   2. Notes sidebar — smooth slide + keyboard shortcut (Ctrl+\)
   3. Forum — live search, bookmark posts, "My Posts" filter,
      reply count badge, mark-solved from list
   4. Collab — presence heartbeat so users don't stay stuck in bar,
      "X has joined" toast, copy-link button in toolbar chip

   Add LAST in index.html after patches3.js:
   <script type="module" src="patches4.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const _app  = getApps()[0];
const _auth = getAuth(_app);
const _db   = getFirestore(_app);
let _uid = null, _uname = '';
onAuthStateChanged(_auth, u => {
    if (!u) return;
    _uid   = u.uid;
    _uname = u.displayName || u.email?.split('@')[0] || 'Student';
});

/* ═══════════════════════════════════════════════════════════════
   SHARED CSS
   ═══════════════════════════════════════════════════════════════ */
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `

/* ── Math keyboard ── */
#math-kb {
    position: fixed;
    bottom: 0; left: 50%; transform: translateX(-50%);
    z-index: 300;
    width: min(680px, 98vw);
    background: var(--bg-color);
    border: 1px solid rgba(255,255,255,.12);
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 40px rgba(0,0,0,.45);
    padding: 14px 16px 18px;
    display: none;
    flex-direction: column;
    gap: 10px;
    backdrop-filter: blur(24px);
    animation: mathKbUp .2s ease-out;
}
#math-kb.open { display: flex; }
@keyframes mathKbUp {
    from { transform: translateX(-50%) translateY(40px); opacity:0; }
    to   { transform: translateX(-50%) translateY(0);    opacity:1; }
}
.mkb-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,.07);
}
.mkb-title {
    font-size: .65rem; font-weight: 800; letter-spacing: .1em;
    text-transform: uppercase; color: var(--text-muted);
    display: flex; align-items: center; gap: 6px;
}
.mkb-tabs {
    display: flex; gap: 4px; flex-wrap: wrap;
}
.mkb-tab {
    padding: 4px 10px; border-radius: 8px; border: none; cursor: pointer;
    font-size: .65rem; font-weight: 700; background: rgba(255,255,255,.06);
    color: var(--text-muted); transition: all .12s;
}
.mkb-tab.active { background: var(--accent); color: #fff; }
.mkb-row {
    display: flex; flex-wrap: wrap; gap: 5px;
}
.mkb-btn {
    min-width: 42px; height: 36px; padding: 0 8px;
    border-radius: 9px; border: 1px solid rgba(255,255,255,.09);
    background: rgba(255,255,255,.06); color: var(--text-main);
    cursor: pointer; font-size: .8rem; font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    transition: background .1s, color .1s, transform .08s;
    display: flex; align-items: center; justify-content: center;
    white-space: nowrap;
}
.mkb-btn:hover  { background: var(--accent); color: #fff; transform: scale(1.05); }
.mkb-btn:active { transform: scale(.96); }
.mkb-btn.wide   { min-width: 64px; }
.mkb-btn.greek  { font-style: italic; font-family: serif; font-size: .95rem; }
.mkb-preview {
    min-height: 36px; padding: 6px 12px;
    background: rgba(59,130,246,.07); border: 1px solid rgba(59,130,246,.2);
    border-radius: 10px; font-size: .8rem; color: var(--text-main);
    display: flex; align-items: center; gap: 8px; overflow-x: auto;
}
.mkb-close {
    background: transparent; border: none; cursor: pointer;
    color: var(--text-muted); font-size: .85rem; padding: 4px 6px;
    border-radius: 6px; transition: color .12s;
}
.mkb-close:hover { color: var(--text-main); }
.mkb-toggle-btn {
    position: fixed; bottom: 16px; right: 80px; z-index: 200;
    background: var(--glass-panel); border: var(--glass-border);
    border-radius: 12px; padding: 7px 12px; font-size: .7rem;
    font-weight: 700; color: var(--accent); cursor: pointer;
    display: none; align-items: center; gap: 5px;
    box-shadow: 0 4px 16px rgba(0,0,0,.3);
    transition: background .12s;
}
.mkb-toggle-btn:hover { background: var(--glass-hover); }
.mkb-toggle-btn.visible { display: flex; }

/* ── Notes sidebar ── */
.notes-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 16px;
    height: 100%;
    transition: grid-template-columns .25s ease;
}
.notes-layout.sidebar-hidden {
    grid-template-columns: 0px 1fr;
}
.notes-layout.sidebar-hidden #notes-left-panel {
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    padding: 0;
    min-width: 0;
}
#notes-left-panel {
    transition: opacity .2s ease, min-width .25s ease;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* ── Forum search ── */
#forum-search-wrap {
    padding: 0 0 10px;
    position: relative;
}
#forum-search-wrap i {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted); font-size: .7rem; pointer-events: none;
}
#forum-search-inp {
    width: 100%; background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.09); border-radius: 12px;
    padding: 9px 12px 9px 34px; font-size: .8rem;
    color: var(--text-main); outline: none; box-sizing: border-box;
    font-family: inherit; transition: border-color .15s;
}
#forum-search-inp:focus { border-color: var(--accent); }

/* ── Forum bookmark ── */
.fpc-bookmark {
    background: transparent; border: none; cursor: pointer;
    color: var(--text-muted); font-size: .75rem; padding: 3px 5px;
    border-radius: 5px; transition: color .12s;
    margin-left: auto;
}
.fpc-bookmark:hover, .fpc-bookmark.saved { color: #f59e0b; }

/* ── Forum filter chips ── */
.forum-filter-chips {
    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;
}
.ffc-chip {
    padding: 4px 12px; border-radius: 20px; font-size: .68rem;
    font-weight: 700; border: 1px solid rgba(255,255,255,.1);
    background: transparent; color: var(--text-muted); cursor: pointer;
    transition: all .12s;
}
.ffc-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }

/* ── Collab join toast ── */
@keyframes collabJoin {
    0%   { transform: translateX(-50%) translateY(20px); opacity: 0; }
    15%  { transform: translateX(-50%) translateY(0);    opacity: 1; }
    80%  { transform: translateX(-50%) translateY(0);    opacity: 1; }
    100% { transform: translateX(-50%) translateY(-10px);opacity: 0; }
}
.collab-join-toast {
    position: fixed; bottom: 100px; left: 50%;
    transform: translateX(-50%);
    background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3);
    color: #22c55e; border-radius: 20px; padding: 7px 16px;
    font-size: .75rem; font-weight: 700; z-index: 70;
    animation: collabJoin 3s ease forwards;
    pointer-events: none; white-space: nowrap;
}

` }));


/* ═══════════════════════════════════════════════════════════════
   1. MATH KEYBOARD
   ═══════════════════════════════════════════════════════════════ */
(function mathKeyboard() {

    const GROUPS = {
        'Basis': [
            { label:'+',    latex:'+' },
            { label:'−',    latex:'-' },
            { label:'×',    latex:'\\times' },
            { label:'÷',    latex:'\\div' },
            { label:'=',    latex:'=' },
            { label:'≠',    latex:'\\neq' },
            { label:'≈',    latex:'\\approx' },
            { label:'≤',    latex:'\\leq' },
            { label:'≥',    latex:'\\geq' },
            { label:'<',    latex:'<' },
            { label:'>',    latex:'>' },
            { label:'±',    latex:'\\pm' },
            { label:'( )',  latex:'\\left(  \\right)', cur:-9 },
            { label:'[ ]',  latex:'\\left[  \\right]', cur:-9 },
            { label:'|x|',  latex:'\\left|  \\right|', cur:-9 },
            { label:'%',    latex:'\\%' },
            { label:'∞',    latex:'\\infty' },
        ],
        'Machten & Wortels': [
            { label:'x²',   latex:'^{2}' },
            { label:'x³',   latex:'^{3}' },
            { label:'xⁿ',   latex:'^{n}', cur:-1 },
            { label:'x₁',   latex:'_{1}' },
            { label:'xₙ',   latex:'_{n}', cur:-1 },
            { label:'√x',   latex:'\\sqrt{x}', cur:-2 },
            { label:'∛x',   latex:'\\sqrt[3]{x}', cur:-2 },
            { label:'ⁿ√x',  latex:'\\sqrt[n]{x}', cur:-2 },
            { label:'a/b',  latex:'\\frac{a}{b}', cur:-2, wide:true },
            { label:'aᵇ/c', latex:'\\frac{a^{b}}{c}', cur:-2, wide:true },
        ],
        'Grieks': [
            { label:'α', latex:'\\alpha', greek:true },
            { label:'β', latex:'\\beta',  greek:true },
            { label:'γ', latex:'\\gamma', greek:true },
            { label:'δ', latex:'\\delta', greek:true },
            { label:'ε', latex:'\\epsilon',greek:true},
            { label:'θ', latex:'\\theta', greek:true },
            { label:'λ', latex:'\\lambda',greek:true },
            { label:'μ', latex:'\\mu',    greek:true },
            { label:'π', latex:'\\pi',    greek:true },
            { label:'ρ', latex:'\\rho',   greek:true },
            { label:'σ', latex:'\\sigma', greek:true },
            { label:'τ', latex:'\\tau',   greek:true },
            { label:'φ', latex:'\\phi',   greek:true },
            { label:'ω', latex:'\\omega', greek:true },
            { label:'Δ', latex:'\\Delta', greek:true },
            { label:'Σ', latex:'\\Sigma', greek:true },
            { label:'Ω', latex:'\\Omega', greek:true },
            { label:'Π', latex:'\\Pi',    greek:true },
        ],
        'Trig': [
            { label:'sin',   latex:'\\sin',    wide:true },
            { label:'cos',   latex:'\\cos',    wide:true },
            { label:'tan',   latex:'\\tan',    wide:true },
            { label:'sin⁻¹', latex:'\\arcsin', wide:true },
            { label:'cos⁻¹', latex:'\\arccos', wide:true },
            { label:'tan⁻¹', latex:'\\arctan', wide:true },
            { label:'°',     latex:'^{\\circ}' },
            { label:'log',   latex:'\\log' },
            { label:'ln',    latex:'\\ln'  },
            { label:'log₂',  latex:'\\log_2', wide:true },
            { label:'logₙ',  latex:'\\log_{n}', wide:true, cur:-1 },
            { label:'eˣ',    latex:'e^{x}', cur:-2 },
        ],
        'Analyse': [
            { label:'∫',      latex:'\\int_{a}^{b}', cur:-2, wide:true },
            { label:'∫∫',     latex:'\\iint',        wide:true },
            { label:'d/dx',   latex:'\\frac{d}{dx}', wide:true },
            { label:'∂/∂x',   latex:'\\frac{\\partial}{\\partial x}', wide:true },
            { label:'∑',      latex:'\\sum_{i=1}^{n}', cur:-2, wide:true },
            { label:'∏',      latex:'\\prod_{i=1}^{n}',cur:-2, wide:true },
            { label:'lim',    latex:'\\lim_{x \\to \\infty}', wide:true },
            { label:'→',      latex:'\\rightarrow' },
            { label:'⇒',      latex:'\\Rightarrow' },
            { label:'⟺',      latex:'\\Leftrightarrow', wide:true },
            { label:'∀',      latex:'\\forall' },
            { label:'∃',      latex:'\\exists' },
            { label:'∈',      latex:'\\in' },
            { label:'∉',      latex:'\\notin' },
            { label:'⊂',      latex:'\\subset' },
            { label:'∩',      latex:'\\cap' },
            { label:'∪',      latex:'\\cup' },
        ],
    };

    let _activeGroup = 'Basis';
    let _targetEl    = null;  // textarea or contenteditable

    /* ── Build the keyboard DOM ── */
    function _build() {
        if (document.getElementById('math-kb')) return;
        const kb = document.createElement('div');
        kb.id = 'math-kb';

        kb.innerHTML = `
            <div class="mkb-header">
                <div class="mkb-title">
                    <i class="fa-solid fa-square-root-alt" style="color:var(--accent)"></i>
                    Wiskunde Toetsenbord
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="mkb-tabs" id="mkb-tabs"></div>
                    <button class="mkb-close" onclick="window._mathKbClose()" title="Sluiten (Esc)">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="mkb-preview" id="mkb-preview">
                <span style="font-size:.6rem;color:var(--text-muted);flex-shrink:0;">Druk om in te voegen →</span>
            </div>
            <div class="mkb-row" id="mkb-keys"></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(255,255,255,.06);">
                <button class="mkb-btn wide" onclick="window._mathKbInsert('$$  $$',-3)" title="Display math blok">$$ blok</button>
                <button class="mkb-btn" onclick="window._mathKbInsert('$  $',-2)" title="Inline math">$ inline</button>
                <button class="mkb-btn wide" onclick="window._mathKbInsert('\\\\begin{cases}  \\\\\\\\   \\\\end{cases}',-20)" title="Stuksgewijze functie">cases</button>
                <button class="mkb-btn wide" onclick="window._mathKbInsert('\\\\begin{pmatrix}a & b \\\\\\\\c & d\\\\end{pmatrix}')">matrix</button>
                <div style="flex:1"></div>
                <button class="mkb-btn wide" style="background:rgba(239,68,68,.1);color:#f87171;border-color:rgba(239,68,68,.2);" onclick="window._mathKbBackspace()">
                    <i class="fa-solid fa-delete-left"></i> Delete
                </button>
            </div>
        `;

        document.body.appendChild(kb);
        _renderTabs();
        _renderKeys();
    }

    function _renderTabs() {
        const tabs = document.getElementById('mkb-tabs');
        if (!tabs) return;
        tabs.innerHTML = Object.keys(GROUPS).map(g => `
            <button class="mkb-tab ${g===_activeGroup?'active':''}"
                    onclick="window._mathKbGroup('${g}')">${g}</button>
        `).join('');
    }

    function _renderKeys() {
        const row = document.getElementById('mkb-keys');
        if (!row) return;
        row.innerHTML = GROUPS[_activeGroup].map(s => `
            <button class="mkb-btn ${s.wide?'wide':''} ${s.greek?'greek':''}"
                    title="${s.latex}"
                    onclick="window._mathKbInsert('${s.latex.replace(/'/g,"\\'")}',${s.cur||0})">
                ${s.label}
            </button>
        `).join('');
    }

    /* ── Public API ── */
    window._mathKbGroup = g => {
        _activeGroup = g;
        _renderTabs();
        _renderKeys();
    };

    window._mathKbInsert = (latex, curOffset = 0) => {
        if (!_targetEl) return;

        /* Update preview */
        const prev = document.getElementById('mkb-preview');
        if (prev && window.katex) {
            try {
                const rendered = window.katex.renderToString(
                    latex.replace(/\\\\/g,'\\'), { throwOnError:false, displayMode:false }
                );
                prev.innerHTML = `<span style="font-size:.6rem;color:var(--text-muted);flex-shrink:0;">Voorbeeld:</span>${rendered}`;
            } catch(e) { prev.textContent = latex; }
        }

        if (_targetEl.tagName === 'TEXTAREA' || _targetEl.tagName === 'INPUT') {
            /* Plain textarea insert */
            const s = _targetEl.selectionStart;
            const e = _targetEl.selectionEnd;
            const v = _targetEl.value;
            _targetEl.value = v.slice(0,s) + latex + v.slice(e);
            const pos = s + latex.length + curOffset;
            _targetEl.setSelectionRange(pos, pos);
            _targetEl.focus();
            _targetEl.dispatchEvent(new Event('input', { bubbles:true }));
        } else if (_targetEl.contentEditable === 'true') {
            /* ContentEditable (note editor) — wrap in $...$ */
            _targetEl.focus();
            const toInsert = `$${latex}$`;
            document.execCommand('insertText', false, toInsert);
        }
    };

    window._mathKbBackspace = () => {
        if (!_targetEl) return;
        if (_targetEl.tagName === 'TEXTAREA' || _targetEl.tagName === 'INPUT') {
            const s = _targetEl.selectionStart;
            if (s === 0) return;
            _targetEl.value = _targetEl.value.slice(0, s-1) + _targetEl.value.slice(_targetEl.selectionEnd);
            _targetEl.setSelectionRange(s-1, s-1);
            _targetEl.dispatchEvent(new Event('input', { bubbles:true }));
        } else {
            _targetEl.focus();
            document.execCommand('delete');
        }
    };

    window._mathKbClose = () => {
        const kb = document.getElementById('math-kb');
        if (kb) kb.classList.remove('open');
        const tb = document.getElementById('mkb-float-btn');
        if (tb) tb.classList.remove('active');
    };

    window._mathKbOpen = (targetEl) => {
        _build();
        _targetEl = targetEl || _targetEl;
        const kb = document.getElementById('math-kb');
        if (kb) kb.classList.add('open');
        const tb = document.getElementById('mkb-float-btn');
        if (tb) tb.classList.add('active');
    };

    /* ── Float trigger button ── */
    function _injectToggleBtn() {
        if (document.getElementById('mkb-float-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'mkb-float-btn';
        btn.className = 'mkb-toggle-btn';
        btn.innerHTML = '<i class="fa-solid fa-square-root-alt"></i> Wiskunde';
        btn.title = 'Alt+M om te openen/sluiten';
        btn.onclick = () => {
            const kb = document.getElementById('math-kb');
            if (kb?.classList.contains('open')) {
                window._mathKbClose();
            } else {
                /* Find the best target */
                const active = document.activeElement;
                const target = (active && (active.tagName==='TEXTAREA'||active.tagName==='INPUT'||active.contentEditable==='true'))
                    ? active
                    : document.getElementById('formula-modal-formula') ||
                      document.getElementById('note-editor');
                window._mathKbOpen(target);
            }
        };
        document.body.appendChild(btn);
    }

    /* ── Show float button in formula modal and on notes tab ── */
    function _watchContext() {
        const floatBtn = () => document.getElementById('mkb-float-btn');

        /* Formula modal open → show button + auto-open keyboard */
        new MutationObserver(() => {
            const m = document.getElementById('modal-formula');
            if (m && !m.classList.contains('hidden')) {
                floatBtn()?.classList.add('visible');
                /* Auto-focus formula textarea and open kb */
                const ta = document.getElementById('formula-modal-formula');
                if (ta) {
                    ta.addEventListener('focus', () => { _targetEl = ta; }, { once:false });
                }
            } else {
                /* Close kb when modal closes */
                window._mathKbClose();
                floatBtn()?.classList.remove('visible');
            }
        }).observe(document.body, { attributes:true, subtree:true, attributeFilter:['class'] });

        /* Notes tab → show button */
        (function _pt() {
            if (typeof window.switchTab !== 'function') { setTimeout(_pt,200); return; }
            const _o = window.switchTab;
            window.switchTab = function(n) {
                _o(n);
                const fb = floatBtn();
                if (!fb) return;
                if (n === 'notes' || n === 'formulas') {
                    fb.classList.add('visible');
                } else {
                    fb.classList.remove('visible');
                    window._mathKbClose();
                }
            };
        })();
    }

    /* ── Focus tracking — update _targetEl when user clicks an input ── */
    document.addEventListener('focusin', e => {
        const el = e.target;
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ||
            el.contentEditable === 'true') {
            _targetEl = el;
        }
    });

    /* Alt+M global shortcut */
    document.addEventListener('keydown', e => {
        if (e.altKey && e.key === 'm') {
            e.preventDefault();
            const kb = document.getElementById('math-kb');
            if (kb?.classList.contains('open')) window._mathKbClose();
            else window._mathKbOpen(null);
        }
        if (e.key === 'Escape') window._mathKbClose();
    });

    /* ── Add a small "∑" button to the notes toolbar ── */
    function _injectNoteToolbarBtn() {
        const toolbar = document.getElementById('note-toolbar');
        if (!toolbar || toolbar.querySelector('#mkb-notes-btn')) return;
        const divider = document.createElement('div');
        divider.className = 'note-section-divider';
        const btn = document.createElement('button');
        btn.id = 'mkb-notes-btn';
        btn.className = 'tbar-dropdown-btn';
        btn.innerHTML = '<i class="fa-solid fa-square-root-alt" style="color:var(--accent)"></i> Wiskunde';
        btn.title = 'Wiskunde toetsenbord (Alt+M)';
        btn.onclick = () => {
            const ed = document.getElementById('note-editor');
            _targetEl = ed;
            const kb = document.getElementById('math-kb');
            if (kb?.classList.contains('open')) window._mathKbClose();
            else window._mathKbOpen(ed);
        };
        /* Insert after Insert group */
        const groups = toolbar.querySelectorAll('.tbar-group');
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.nextSibling) {
            toolbar.insertBefore(divider, lastGroup.nextSibling);
            toolbar.insertBefore(btn, divider.nextSibling);
        } else if (lastGroup) {
            toolbar.appendChild(divider);
            toolbar.appendChild(btn);
        }
        console.log('[p4] Math button injected into notes toolbar ✓');
    }

    setTimeout(() => { _build(); _injectToggleBtn(); _injectNoteToolbarBtn(); _watchContext(); }, 300);
})();


/* ═══════════════════════════════════════════════════════════════
   2. NOTES SIDEBAR — smooth hide, Ctrl+\ shortcut, keyboard hint
   ═══════════════════════════════════════════════════════════════ */
(function notesSidebarPolish() {
    /* Ctrl+\ to toggle sidebar */
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
            e.preventDefault();
            window.toggleNotesSidebar?.();
        }
    });

    /* Update toggle button tooltip */
    function _fixTooltip() {
        const btn = document.getElementById('notes-sidebar-toggle-btn');
        if (!btn) return;
        btn.title = 'Zijbalk verbergen / tonen (Ctrl+\\)';
    }
    setTimeout(_fixTooltip, 500);

    /* When sidebar hides, make editor fill the full width nicely */
    (function _patch() {
        if (typeof window.toggleNotesSidebar !== 'function') { setTimeout(_patch, 200); return; }
        const _o = window.toggleNotesSidebar;
        window.toggleNotesSidebar = function() {
            _o();
            /* Small delay to let transition finish */
            setTimeout(() => {
                const editor = document.getElementById('note-editor');
                if (editor) editor.style.maxWidth = '';
            }, 260);
        };
    })();
})();


/* ═══════════════════════════════════════════════════════════════
   3. FORUM ENHANCEMENTS
   ═══════════════════════════════════════════════════════════════ */
(function forumEnhancements() {

    /* ── Bookmarks stored in localStorage ── */
    function _getBookmarks() {
        try { return JSON.parse(localStorage.getItem('forum_bookmarks') || '[]'); } catch(e){ return []; }
    }
    function _toggleBookmark(postId) {
        const bm = _getBookmarks();
        const idx = bm.indexOf(postId);
        if (idx === -1) bm.push(postId); else bm.splice(idx, 1);
        localStorage.setItem('forum_bookmarks', JSON.stringify(bm));
        return idx === -1; // true = added
    }
    window._forumToggleBookmark = function(postId, btn) {
        const added = _toggleBookmark(postId);
        btn.classList.toggle('saved', added);
        btn.title = added ? 'Verwijder bladwijzer' : 'Bewaar post';
        window._toast?.(added ? 'Post bewaard 🔖' : 'Bladwijzer verwijderd');
        /* Re-render if in bookmarks filter */
        if (window._forumActiveFilter === 'bookmarks') window._forumApplyFilter();
    };

    /* ── Filter state ── */
    window._forumActiveFilter = 'all'; // 'all' | 'mine' | 'bookmarks' | 'unsolved'

    /* ── Inject search + filter chips above post list ── */
    function _injectSearchAndFilters() {
        const listView = document.getElementById('forum-list-view');
        if (!listView || document.getElementById('forum-search-wrap')) return;

        /* Search bar */
        const searchWrap = document.createElement('div');
        searchWrap.id = 'forum-search-wrap';
        searchWrap.innerHTML = `
            <i class="fa-solid fa-magnifying-glass"></i>
            <input id="forum-search-inp" placeholder="Zoek in berichten…" type="text">
        `;

        /* Filter chips */
        const chips = document.createElement('div');
        chips.className = 'forum-filter-chips';
        chips.id = 'forum-filter-chips';
        chips.innerHTML = `
            <button class="ffc-chip active" data-f="all"       onclick="window._forumSetFilter('all')">Alles</button>
            <button class="ffc-chip"        data-f="mine"      onclick="window._forumSetFilter('mine')">Mijn posts</button>
            <button class="ffc-chip"        data-f="bookmarks" onclick="window._forumSetFilter('bookmarks')"><i class="fa-solid fa-bookmark" style="font-size:.6rem"></i> Bewaard</button>
            <button class="ffc-chip"        data-f="unsolved"  onclick="window._forumSetFilter('unsolved')">Onopgelost</button>
        `;

        /* Insert before subject bar */
        const subBar = document.getElementById('forum-subject-bar');
        if (subBar) {
            listView.insertBefore(chips, subBar);
            listView.insertBefore(searchWrap, chips);
        }

        /* Wire search */
        document.getElementById('forum-search-inp').addEventListener('input', function() {
            window._forumSearchQuery = this.value.toLowerCase().trim();
            window._forumApplyFilter?.();
        });

        console.log('[p4] Forum search + filters injected ✓');
    }

    /* ── Filter logic — hooks into forum_fix.js's _render ── */
    window._forumSearchQuery = '';

    window._forumSetFilter = function(f) {
        window._forumActiveFilter = f;
        document.querySelectorAll('.ffc-chip').forEach(c =>
            c.classList.toggle('active', c.dataset.f === f)
        );
        window._forumApplyFilter();
    };

    /* Patch forum_fix.js's render to also apply our search+filter */
    function _patchForumRender() {
        /* forum_fix.js sets window.forumSetSort and window.forumFixSetSubject.
           We intercept by patching the post-list render step.
           The cleanest hook: watch #forum-post-list for changes and
           re-apply our filter on top.                              */

        /* Override the global forumInit which triggers _render */
        const _origInit = window.forumInit;
        if (!_origInit || window._p4ForumPatched) return;
        window._p4ForumPatched = true;

        window._forumApplyFilter = function() {
            const list = document.getElementById('forum-post-list');
            if (!list) return;
            const q  = window._forumSearchQuery || '';
            const f  = window._forumActiveFilter || 'all';
            const bm = _getBookmarks();

            list.querySelectorAll('.forum-post-card').forEach(card => {
                const title  = card.querySelector('.fpc-title')?.textContent?.toLowerCase()  || '';
                const body   = card.querySelector('.fpc-excerpt')?.textContent?.toLowerCase()|| '';
                const postId = card.getAttribute('data-postid') || '';
                const isOwn  = card.dataset.own === '1';
                const solved = card.classList.contains('solved');

                let show = true;
                if (q && !title.includes(q) && !body.includes(q)) show = false;
                if (f === 'mine'      && !isOwn)                   show = false;
                if (f === 'bookmarks' && !bm.includes(postId))     show = false;
                if (f === 'unsolved'  && solved)                   show = false;

                card.style.display = show ? '' : 'none';
            });

            /* Empty state */
            const visible = [...list.querySelectorAll('.forum-post-card')].filter(c=>c.style.display!=='none');
            let empty = list.querySelector('.p4-forum-empty');
            if (visible.length === 0 && list.querySelectorAll('.forum-post-card').length > 0) {
                if (!empty) {
                    empty = document.createElement('div');
                    empty.className = 'forum-empty p4-forum-empty';
                    list.appendChild(empty);
                }
                empty.innerHTML = q
                    ? `<i class="fa-solid fa-magnifying-glass"></i><p>Geen resultaten voor "<strong>${q}</strong>"</p>`
                    : `<i class="fa-solid fa-filter"></i><p>Geen berichten in dit filter</p>`;
            } else if (empty) {
                empty.remove();
            }
        };

        /* Patch the MutationObserver approach: after forum_fix renders cards,
           inject data-postid and data-own, then apply filter              */
        const obs = new MutationObserver(() => {
            const list = document.getElementById('forum-post-list');
            if (!list) return;
            const bm = _getBookmarks();

            list.querySelectorAll('.forum-post-card').forEach(card => {
                /* Extract post ID from onclick attr if not set */
                if (!card.getAttribute('data-postid')) {
                    const onclick = card.getAttribute('onclick') || '';
                    const m = onclick.match(/forumOpenPost\('([^']+)'\)/);
                    if (m) card.setAttribute('data-postid', m[1]);
                }
                /* Mark own posts */
                if (!card.dataset.ownChecked && _uid) {
                    card.dataset.ownChecked = '1';
                    const del = card.querySelector('.fpc-delete');
                    if (del) card.dataset.own = '1';
                }

                /* Inject bookmark button if missing */
                const footer = card.querySelector('.fpc-footer');
                if (footer && !footer.querySelector('.fpc-bookmark')) {
                    const postId = card.getAttribute('data-postid');
                    const saved  = bm.includes(postId);
                    const bbtn   = document.createElement('button');
                    bbtn.className = `fpc-bookmark${saved?' saved':''}`;
                    bbtn.title     = saved ? 'Verwijder bladwijzer' : 'Bewaar post';
                    bbtn.innerHTML = `<i class="fa-${saved?'solid':'regular'} fa-bookmark"></i>`;
                    bbtn.onclick   = e => {
                        e.stopPropagation();
                        window._forumToggleBookmark(postId, bbtn);
                        bbtn.innerHTML = `<i class="fa-${_getBookmarks().includes(postId)?'solid':'regular'} fa-bookmark"></i>`;
                    };
                    footer.appendChild(bbtn);
                }
            });

            window._forumApplyFilter?.();
        });
        obs.observe(document.getElementById('forum-post-list') || document.body,
            { childList:true, subtree:true });

        console.log('[p4] Forum filter/search patched ✓');
    }

    /* ── Wait for forum_fix to be ready ── */
    function _init() {
        _injectSearchAndFilters();
        _patchForumRender();
    }

    /* Run when forum tab opens */
    (function _wt() {
        if (typeof window.switchTab !== 'function') { setTimeout(_wt, 200); return; }
        const _o = window.switchTab;
        window.switchTab = function(n) {
            _o(n);
            if (n === 'forum') setTimeout(_init, 200);
        };
    })();
    setTimeout(_init, 800);

    /* ── Keyboard shortcut: / to focus forum search ── */
    document.addEventListener('keydown', e => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey) return;
        const view = document.getElementById('view-forum');
        if (!view || view.classList.contains('hidden')) return;
        const inp = document.getElementById('forum-search-inp');
        if (inp && document.activeElement !== inp) {
            e.preventDefault();
            inp.focus();
        }
    });
})();


/* ═══════════════════════════════════════════════════════════════
   4. COLLAB — heartbeat, join toast, copy-link chip in toolbar
   ═══════════════════════════════════════════════════════════════ */
(function collabPolish() {

    let _heartbeatTimer = null;
    let _prevUsers = [];

    /* ── Heartbeat: update activeUsers every 15s so stale users drop off ── */
    function _startHeartbeat(shareId) {
        clearInterval(_heartbeatTimer);
        _heartbeatTimer = setInterval(async () => {
            if (!_uid || !shareId) return;
            try {
                await setDoc(doc(_db, 'shared_notes', shareId), {
                    activeUsers: arrayUnion(_uname),
                    [`presence_${_uid}`]: Date.now(),
                }, { merge: true });
            } catch(e) {}
        }, 15000);
    }

    function _stopHeartbeat() {
        clearInterval(_heartbeatTimer);
    }

    /* ── Show join toast when a new user appears in activeUsers ── */
    function _checkJoins(users) {
        const joined = users.filter(u => u !== _uname && !_prevUsers.includes(u));
        joined.forEach(u => {
            const t = document.createElement('div');
            t.className = 'collab-join-toast';
            t.innerHTML = `<i class="fa-solid fa-user-plus" style="margin-right:6px"></i>${u} heeft de notitie geopend`;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3200);
        });
        _prevUsers = [...users];
    }

    /* ── Copy-link button in collab chip ── */
    function _injectCollabChip() {
        const collabBtn = document.getElementById('notes-collab-btn');
        if (!collabBtn || document.getElementById('p4-collab-copy')) return;
        const btn = document.createElement('button');
        btn.id = 'p4-collab-copy';
        btn.className = 'nt-btn';
        btn.title = 'Kopieer deellink';
        btn.innerHTML = '<i class="fa-regular fa-copy" style="font-size:.7rem"></i>';
        btn.style.display = 'none';
        btn.onclick = () => {
            const shareId = window._collabId;
            if (!shareId) return;
            const url = `${location.origin}${location.pathname}?collab=${shareId}`;
            navigator.clipboard.writeText(url).then(() => {
                window._toast?.('Link gekopieerd! 🔗');
                btn.innerHTML = '<i class="fa-solid fa-check" style="color:#22c55e;font-size:.7rem"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy" style="font-size:.7rem"></i>'; }, 1800);
            });
        };
        collabBtn.after(btn);
    }

    /* ── Watch for collab to start/stop ── */
    setInterval(() => {
        const shareId = window._collabId;
        const copyBtn = document.getElementById('p4-collab-copy');

        if (shareId) {
            if (copyBtn) copyBtn.style.display = '';
            _startHeartbeat(shareId);
        } else {
            if (copyBtn) copyBtn.style.display = 'none';
            _stopHeartbeat();
            _prevUsers = [];
        }
    }, 2000);

    /* ── Hook into patches3.js _renderAvatars to detect joins ── */
    const _origRenderAvatars = window._renderCollabAvatars;
    /* patches3 doesn't expose it, so we watch the DOM */
    const avatarObs = new MutationObserver(() => {
        const bar = document.getElementById('collab-users-bar');
        if (!bar) return;
        const users = [...bar.querySelectorAll('div[title]')].map(d => d.title);
        if (users.length !== _prevUsers.length || users.some((u,i) => u !== _prevUsers[i])) {
            _checkJoins(users);
        }
    });
    avatarObs.observe(document.body, { childList:true, subtree:true });

    /* Inject copy btn once toolbar is ready */
    setTimeout(_injectCollabChip, 600);
    (function _wt() {
        if (typeof window.switchTab !== 'function') { setTimeout(_wt,200); return; }
        const _o = window.switchTab;
        window.switchTab = function(n) {
            _o(n);
            if (n === 'notes') setTimeout(_injectCollabChip, 200);
        };
    })();
})();


console.log('[StudentOS patches4] Loaded ✓  (math kb · notes sidebar · forum · collab)');
