/* ================================================================
   StudentOS — patches5.js

   Fixes & improvements:
   1.  Forum global stubs — forumOpenPost / forumOpenNew available
       immediately so onclick attrs never throw ReferenceError
   2.  Collab real-time — auto-write to Firestore on every keystroke
       (500 ms debounce) so both users see each other's changes live
   3.  Collab panel — show actual profile picture of current user
   4.  Formula modal — move KaTeX preview ABOVE the textarea input
   5.  Notes toolbar — remove quick-image and quick-PDF buttons
   6.  Grades — add edit-pencil button next to trash icon
   7.  Whiteboard — add outline border around canvas
   8.  Whiteboard — background colour as a compact dropdown
   9.  Dutch text → English everywhere (forum.js SUBJECTS, time-ago,
       remaining "Anoniem / Geen / geleden" strings, forum_fix stubs)
   10. Forum attach — image/PDF file picker in the ask-question page
   11. Service-worker — graceful registration so a 404 on sw.js never
       spams the console (guard + correct scope)
   12. bootstrap-autofill error is a browser-extension issue — silenced

   Add LAST in index.html, after patches4.js:
   <script type="module" src="patches5.js"></script>
   ================================================================ */

/* ── tiny helpers ── */
const _p5 = {
    toast(msg, err = false) {
        const t = document.getElementById('sos-toast');
        if (!t) return;
        t.textContent      = msg;
        t.style.background = err ? '#ef4444' : '';
        t.classList.add('show');
        setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 2400);
    },
    wait(fn, name, interval = 180) {
        if (typeof window[name] === 'function' && !window[name]._sos_stub) { fn(); return; }
        const id = setInterval(() => {
            if (typeof window[name] === 'function' && !window[name]._sos_stub) { clearInterval(id); fn(); }
        }, interval);
    },
    css(text) {
        document.head.appendChild(Object.assign(document.createElement('style'), { textContent: text }));
    },
};

/* ================================================================
   1. FORUM — expose functions globally BEFORE modules finish loading
      so onclick="forumOpenPost(…)" in HTML never throws ReferenceError
   ================================================================ */
(function forumStubs() {
    const _queue = {};
    function _stub(name) {
        if (window[name]) return;           // already set by forum.js
        _queue[name] = [];
        window[name] = function(...args) {
            if (window[`_p5_${name}_real`]) return window[`_p5_${name}_real`](...args);
            _queue[name].push(args);
        };
    }
    ['forumOpenPost','forumOpenNew','forumVote','forumDeletePost',
     'forumSubmitPost','forumCancelNew','forumSubmitReply',
     'forumSetSubject','forumSetSort','forumInit'].forEach(_stub);

    /* Once the real function lands on window, drain the queue */
    function _flush() {
        Object.keys(_queue).forEach(name => {
            if (typeof window[name] === 'function' && !window[`_p5_${name}_real`]) {
                window[`_p5_${name}_real`] = window[name];
                const realFn = window[name];
                /* Replace stub: now calls real function immediately */
                window[name] = function(...args) { return realFn(...args); };
                /* Drain queued calls */
                (_queue[name] || []).forEach(args => { try { realFn(...args); } catch(e) {} });
            }
        });
    }
    /* Poll until all stubs are replaced */
    const _fi = setInterval(() => {
        _flush();
        if (Object.keys(_queue).every(k => window[`_p5_${k}_real`])) clearInterval(_fi);
    }, 200);
    setTimeout(() => clearInterval(_fi), 15000);
})();


/* ================================================================
   2. COLLAB — real-time keystroke sync
      Both users see changes within ~600 ms without needing Ctrl+S
   ================================================================ */
(function collabRealtimeInput() {
    let _writeTimer = null;
    let _isMine     = false;
    let _firestoreModule = null;

    /* Lazily grab Firestore — it was already imported by collab_fix.js */
    async function _getFirestore() {
        if (_firestoreModule) return _firestoreModule;
        const { getFirestore, doc, setDoc, serverTimestamp } =
            await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const { getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const app = getApps()[0];
        _firestoreModule = { db: getFirestore(app), doc, setDoc, serverTimestamp };
        return _firestoreModule;
    }

    async function _pushToFirestore() {
        const shareId = window._collabId;
        const uid     = window._currentUid || null;
        if (!shareId) return;

        const title = document.getElementById('note-title')?.value   || '';
        const body  = document.getElementById('note-editor')?.innerHTML || '';

        try {
            const { db, doc, setDoc, serverTimestamp } = await _getFirestore();
            _isMine = true;
            await setDoc(doc(db, 'shared_notes', shareId), {
                title, body,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        } catch(e) {
            console.warn('[p5/collab] write error:', e);
        } finally {
            setTimeout(() => { _isMine = false; }, 350);
        }
    }

    function _attachInputListeners() {
        const editor = document.getElementById('note-editor');
        const titleI = document.getElementById('note-title');
        if (!editor || editor.dataset.p5ci) return;
        editor.dataset.p5ci = '1';

        const trigger = () => {
            if (!window._collabId) return;
            clearTimeout(_writeTimer);
            _writeTimer = setTimeout(() => window.saveNote?.(), 600);
        };
        editor.addEventListener('input',  trigger);
        titleI?.addEventListener('input', trigger);
    }

    /* Attach once notes tab becomes visible */
    _p5.wait(() => {
        const _origST = window.switchTab;
        window.switchTab = function(name) {
            _origST(name);
            if (name === 'notes') setTimeout(_attachInputListeners, 100);
        };
    }, 'switchTab', 200);
    setTimeout(_attachInputListeners, 800);

    /* Also capture _currentUid from auth */
    (async () => {
        try {
            const { getAuth, onAuthStateChanged } =
                await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
            const { getApps } =
                await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
            onAuthStateChanged(getAuth(getApps()[0]), u => {
                if (u) window._currentUid = u.uid;
            });
        } catch(e) {}
    })();
})();


/* ================================================================
   3. COLLAB PANEL — show actual profile picture / avatar
   ================================================================ */
(function collabProfilePic() {
    /* Patch _openCollabPanel (it lives inside collab_fix.js's closure).
       We do it by watching for the panel DOM node and injecting our avatar. */
    function _injectAvatarIntoPanel() {
        const panel = document.getElementById('collab-panel');
        if (!panel || panel.dataset.p5av) return;
        panel.dataset.p5av = '1';

        /* Build avatar HTML from stored profile */
        let pd = null;
        try {
            pd = typeof window.DB !== 'undefined'
                ? window.DB.get('os_profile', null)
                : JSON.parse(localStorage.getItem('os_profile') || 'null');
        } catch(e) {}

        const name = pd?.name ||
            document.getElementById('profile-name-input')?.value ||
            'You';

        let avatarHTML = '';
        if (pd?.type === 'image' && pd?.img) {
            avatarHTML = `<img src="${pd.img}"
                style="width:32px;height:32px;border-radius:50%;object-fit:cover;
                border:2px solid var(--bg-color);flex-shrink:0;" title="${name}">`;
        } else if (pd?.type === 'emoji' && pd?.emoji) {
            avatarHTML = `<div style="width:32px;height:32px;border-radius:50%;
                background:${pd.bg||'var(--accent)'};display:flex;align-items:center;
                justify-content:center;font-size:.95rem;flex-shrink:0;
                border:2px solid var(--bg-color);" title="${name}">${pd.emoji}</div>`;
        } else {
            const hue = (name.charCodeAt(0) * 53) % 360;
            avatarHTML = `<div style="width:32px;height:32px;border-radius:50%;
                background:hsl(${hue},55%,48%);display:flex;align-items:center;
                justify-content:center;font-size:.72rem;font-weight:800;color:#fff;
                flex-shrink:0;border:2px solid var(--bg-color);" title="${name}">
                ${name.slice(0,1).toUpperCase()}</div>`;
        }

        /* Insert avatar as first child of panel */
        const tmp = document.createElement('div');
        tmp.innerHTML = avatarHTML;
        panel.insertBefore(tmp.firstChild, panel.firstChild);
    }

    /* Watch for panel appearing */
    const _panelObs = new MutationObserver(() => {
        if (document.getElementById('collab-panel')) _injectAvatarIntoPanel();
    });
    _panelObs.observe(document.body, { childList: true, subtree: false });
})();


/* ================================================================
   4. FORMULA MODAL — move KaTeX preview ABOVE the textarea
   ================================================================ */
(function formulaPreviewOnTop() {
    function _reorder() {
        const modal = document.getElementById('modal-formula');
        if (!modal || modal.dataset.p5fp) return;

        const ta   = document.getElementById('formula-modal-formula');
        const prev = document.getElementById('katex-preview');
        if (!ta || !prev) return;

        modal.dataset.p5fp = '1';

        /* Move the preview div to appear BEFORE the textarea */
        ta.parentNode.insertBefore(prev, ta);

        /* Give it a "Live preview" label if not already there */
        if (!prev.querySelector('.p5-prev-label')) {
            const lbl = document.createElement('div');
            lbl.className = 'p5-prev-label';
            lbl.style.cssText = 'font-size:.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em;font-weight:800;margin-bottom:6px;';
            lbl.textContent  = 'Live Preview';
            prev.insertBefore(lbl, prev.firstChild);
        }

        /* Make preview always visible (even empty) with placeholder */
        prev.style.display = 'block';
        prev.style.minHeight = '48px';
        if (!prev.textContent.trim() && !prev.querySelector('.katex')) {
            prev.innerHTML = '<div style="font-size:.72rem;color:var(--text-muted);font-style:italic;padding:4px 0;">Start typing a formula to see the rendered preview…</div>';
        }

        /* Update: show placeholder when empty */
        const _origInput = ta.oninput;
        ta.addEventListener('input', function() {
            if (!this.value.trim()) {
                prev.innerHTML = '<div class="p5-prev-label" style="font-size:.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em;font-weight:800;margin-bottom:6px;">Live Preview</div><div style="font-size:.72rem;color:var(--text-muted);font-style:italic;padding:4px 0;">Start typing a formula to see the rendered preview…</div>';
            }
        });
    }

    /* Hook into openModal */
    _p5.wait(() => {
        const _orig = window.openModal;
        if (window._p5omFormula) return;
        window._p5omFormula = true;
        window.openModal = function(id) {
            _orig(id);
            if (id === 'modal-formula') {
                /* patches3 runs first (creates the preview div), then we reorder */
                setTimeout(_reorder, 80);
                setTimeout(_reorder, 300); /* retry if KaTeX loads late */
            }
        };
    }, 'openModal');
})();


/* ================================================================
   5. NOTES TOOLBAR — remove quick-image and quick-PDF buttons
      (they clutter the toolbar and are duplicated in Insert dropdown)
   ================================================================ */
(function removeNoteQuickInsertButtons() {
    function _remove() {
        document.getElementById('p4-img-quick')?.remove();
        document.getElementById('p4-pdf-quick')?.remove();
    }
    /* Run after patches4 has had a chance to inject them */
    setTimeout(_remove, 900);
    setTimeout(_remove, 2000);

    /* Also suppress re-injection by patching patches4's inject function */
    _p5.wait(() => {
        const _orig = window.switchTab;
        if (window._p5stNQI) return;
        window._p5stNQI = true;
        window.switchTab = function(name) {
            _orig(name);
            if (name === 'notes') setTimeout(_remove, 200);
        };
    }, 'switchTab', 200);
})();


/* ================================================================
   6. GRADES — edit-pencil button on every subject card
   ================================================================ */
_p5.css(`
/* Grades edit pencil */
.p5-sub-edit {
    position: absolute; bottom: 10px; right: 36px;
    background: transparent; border: none; cursor: pointer;
    color: var(--text-muted); font-size: .7rem; padding: 5px 7px;
    border-radius: 7px; opacity: 0; z-index: 2;
    transition: opacity .15s, color .15s;
}
.p5-sub-edit:hover { color: var(--accent); }
`);

(function gradesEditPencil() {
    function _inject() {
        const c = document.getElementById('subjects-container');
        if (!c) return;
        Array.from(c.children).forEach(card => {
            if (card.querySelector('.p5-sub-edit')) return;

            /* Find the subject id — look for deleteSubject call */
            const delBtn = card.querySelector('[onclick*="deleteSubject"]');
            if (!delBtn) return;
            const m = delBtn.getAttribute('onclick')?.match(/deleteSubject\((\d+)\)/);
            if (!m) return;
            const subId = parseInt(m[1]);

            card.style.position = 'relative';

            const editBtn = document.createElement('button');
            editBtn.className = 'p5-sub-edit';
            editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            editBtn.title = 'Edit subject';
            editBtn.onclick = e => {
                e.stopPropagation();
                _openEditSubject(subId);
            };
            card.onmouseenter = () => {
                editBtn.style.opacity = '1';
                /* also show the p4 trash */
                const trash = card.querySelector('.p4-sub-del');
                if (trash) trash.style.opacity = '1';
            };
            card.onmouseleave = () => {
                editBtn.style.opacity = '0';
                const trash = card.querySelector('.p4-sub-del');
                if (trash) trash.style.opacity = '0';
            };
            card.appendChild(editBtn);
        });
    }

    function _openEditSubject(subId) {
        /* Load subject data */
        let subjects = [];
        try {
            subjects = typeof window.DB !== 'undefined'
                ? window.DB.get('os_subjects', [])
                : JSON.parse(localStorage.getItem('os_subjects') || '[]');
        } catch(e) {}
        const sub = subjects.find(s => s.id === subId);
        if (!sub) { _p5.toast('Subject not found', true); return; }

        /* Remove any existing modal */
        document.getElementById('p5-edit-sub-modal')?.remove();

        const m = document.createElement('div');
        m.id = 'p5-edit-sub-modal';
        m.style.cssText = `
            position:fixed;inset:0;z-index:250;
            background:rgba(0,0,0,.65);backdrop-filter:blur(8px);
            display:flex;align-items:center;justify-content:center;
        `;
        m.innerHTML = `
        <div style="background:var(--bg-color);border:1px solid rgba(255,255,255,.1);
                    border-radius:22px;padding:26px;width:min(400px,96vw);
                    box-shadow:0 12px 48px rgba(0,0,0,.5);
                    display:flex;flex-direction:column;gap:14px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <i class="fa-solid fa-pencil" style="color:var(--accent)"></i>
                <h3 style="font-size:.95rem;font-weight:700;margin:0;">Edit Subject</h3>
                <button id="p5esclose" style="margin-left:auto;background:transparent;border:none;
                    color:var(--text-muted);cursor:pointer;font-size:.85rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div id="p5-edit-sub-err" style="color:#f87171;font-size:.75rem;min-height:14px;"></div>
            <div style="display:flex;flex-direction:column;gap:5px;">
                <label style="font-size:.6rem;font-weight:800;letter-spacing:.1em;
                    text-transform:uppercase;color:var(--text-muted);">Subject Name</label>
                <input id="p5esname" type="text" value="${sub.name||''}"
                    style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
                    border-radius:12px;padding:10px 14px;color:var(--text-main);font-size:.88rem;
                    font-family:inherit;outline:none;box-sizing:border-box;width:100%;"
                    onkeydown="if(event.key==='Enter')document.getElementById('p5essave').click()">
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;">
                <label style="font-size:.6rem;font-weight:800;letter-spacing:.1em;
                    text-transform:uppercase;color:var(--text-muted);">Goal Grade (optional)</label>
                <input id="p5esgoal" type="number" min="0" max="100"
                    value="${sub.goal||''}" placeholder="e.g. 15"
                    style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
                    border-radius:12px;padding:10px 14px;color:var(--text-main);font-size:.88rem;
                    font-family:inherit;outline:none;box-sizing:border-box;width:100%;">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
                <button id="p5escancel" style="padding:8px 16px;border-radius:10px;
                    background:transparent;border:1px solid rgba(255,255,255,.1);
                    color:var(--text-muted);font-size:.78rem;font-weight:600;cursor:pointer;">Cancel</button>
                <button id="p5essave" style="padding:8px 18px;border-radius:10px;
                    background:var(--accent);color:#fff;font-size:.78rem;
                    font-weight:700;border:none;cursor:pointer;">Save Changes</button>
            </div>
        </div>`;
        document.body.appendChild(m);

        m.querySelector('#p5esclose').onclick  = () => m.remove();
        m.querySelector('#p5escancel').onclick = () => m.remove();
        m.onclick = e => { if (e.target === m) m.remove(); };

        m.querySelector('#p5essave').onclick = () => {
            const name = m.querySelector('#p5esname').value.trim();
            const goal = parseFloat(m.querySelector('#p5esgoal').value) || null;
            const err  = m.querySelector('#p5-edit-sub-err');
            if (!name) { err.textContent = 'Please enter a subject name.'; return; }
            err.textContent = '';

            try {
                let subs = typeof window.DB !== 'undefined'
                    ? window.DB.get('os_subjects', [])
                    : JSON.parse(localStorage.getItem('os_subjects') || '[]');
                subs = subs.map(s => s.id === subId
                    ? { ...s, name, ...(goal !== null ? { goal } : {}) }
                    : s);
                if (typeof window.DB !== 'undefined') window.DB.set('os_subjects', subs);
                else localStorage.setItem('os_subjects', JSON.stringify(subs));
            } catch(err2) { console.error('[p5] edit subject', err2); }

            m.remove();
            window.renderGrades?.();
            _p5.toast('Subject updated ✓');
        };

        setTimeout(() => m.querySelector('#p5esname')?.focus(), 40);
    }

    _p5.wait(() => {
        const _orig = window.renderGrades;
        if (window._p5rgPatch) return;
        window._p5rgPatch = true;
        window.renderGrades = function(...a) {
            const r = _orig.apply(this, a);
            setTimeout(_inject, 50);
            return r;
        };
    }, 'renderGrades');
    setTimeout(_inject, 900);
})();


/* ================================================================
   7. WHITEBOARD — add visible border around canvas
   ================================================================ */
_p5.css(`
#wb-container {
    border: 2px solid rgba(0,0,0,.9) !important;
    box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 4px 20px rgba(0,0,0,.4) !important;
}
`);


/* ================================================================
   8. WHITEBOARD — background colour as compact dropdown
      (extends patches4's colour dropdown idea to backgrounds)
   ================================================================ */
_p5.css(`
#wb-bg-drop-wrap { position: relative; }
#wb-bg-trigger {
    width: 22px; height: 22px; border-radius: 5px;
    border: 2px solid rgba(255,255,255,.3);
    cursor: pointer; flex-shrink: 0;
    transition: transform .12s;
    display: flex; align-items: center; justify-content: center;
}
#wb-bg-trigger:hover { transform: scale(1.15); }
#wb-bg-panel {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 200;
    background: var(--bg-color); border: 1px solid rgba(255,255,255,.12);
    border-radius: 14px; padding: 10px; width: 170px;
    box-shadow: 0 6px 28px rgba(0,0,0,.5);
    display: none; flex-direction: column; gap: 8px;
    animation: p4fadeUp .14s ease-out;
}
#wb-bg-panel.open { display: flex; }
.wbgp-row { display: flex; gap: 5px; flex-wrap: wrap; }
.wbgp-dot {
    width: 22px; height: 22px; border-radius: 5px;
    border: 2px solid transparent; cursor: pointer;
    transition: transform .1s, border-color .1s; flex-shrink: 0;
}
.wbgp-dot:hover   { transform: scale(1.2); }
.wbgp-dot.active  { border-color: var(--accent) !important; }
`);

(function wbBgDropdown() {
    const BG_COLORS = [
        { hex: '#09090b', label: 'Dark',  border: 'rgba(255,255,255,.2)' },
        { hex: '#ffffff', label: 'White', border: '#d1d5db' },
        { hex: '#fef3c7', label: 'Cream', border: '#fcd34d' },
        { hex: '#f0fdf4', label: 'Green', border: '#86efac' },
        { hex: '#eff6ff', label: 'Blue',  border: '#93c5fd' },
        { hex: '#fdf4ff', label: 'Purple',border: '#e9d5ff' },
        { hex: '#fff1f2', label: 'Rose',  border: '#fda4af' },
        { hex: '#1e1e2e', label: 'Night', border: 'rgba(255,255,255,.15)' },
    ];
    let _curBg = '#09090b';

    function _inject() {
        const toolbar = document.querySelector('.wb-toolbar-row');
        if (!toolbar || document.getElementById('wb-bg-drop-wrap')) return;

        /* Hide old bg circle buttons */
        toolbar.querySelectorAll('[id^="wbbg-"]').forEach(b => b.style.display = 'none');

        /* Find the divider right after the old bg circles (between bg and More actions) */
        const moreGroup = toolbar.querySelector('.wb-tool-group:last-of-type');

        const wrap = document.createElement('div');
        wrap.id = 'wb-bg-drop-wrap';
        wrap.className = 'wb-tool-group';
        wrap.style.position = 'relative';

        const trigger = document.createElement('div');
        trigger.id = 'wb-bg-trigger';
        trigger.title = 'Canvas background';
        trigger.style.background = _curBg;
        trigger.innerHTML = '<i class="fa-solid fa-square" style="font-size:.55rem;opacity:.6;"></i>';
        trigger.onclick = ev => { ev.stopPropagation(); panel.classList.toggle('open'); };

        const panel = document.createElement('div');
        panel.id = 'wb-bg-panel';

        const label = document.createElement('div');
        label.style.cssText = 'font-size:.58rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);';
        label.textContent = 'Background';

        const grid = document.createElement('div');
        grid.className = 'wbgp-row';
        BG_COLORS.forEach(c => {
            const dot = document.createElement('div');
            dot.className = 'wbgp-dot' + (c.hex === _curBg ? ' active' : '');
            dot.style.cssText = `background:${c.hex};border-color:${c.border};`;
            dot.title = c.label;
            dot.onclick = ev => {
                ev.stopPropagation();
                _curBg = c.hex;
                trigger.style.background = c.hex;
                panel.querySelectorAll('.wbgp-dot').forEach(d => d.classList.toggle('active', d.title === c.label));
                if (typeof window.setWbBg === 'function') window.setWbBg(c.hex);
                else {
                    const canvas = document.getElementById('wb-canvas');
                    if (canvas) canvas.style.background = c.hex;
                }
                panel.classList.remove('open');
            };
            grid.appendChild(dot);
        });

        panel.appendChild(label);
        panel.appendChild(grid);
        wrap.appendChild(trigger);
        wrap.appendChild(panel);

        /* Insert before More actions group */
        if (moreGroup) toolbar.insertBefore(wrap, moreGroup);
        else toolbar.appendChild(wrap);

        /* Divider before it */
        const div = document.createElement('div');
        div.className = 'wb-divider';
        toolbar.insertBefore(div, wrap);

        document.addEventListener('click', () => panel.classList.remove('open'));
    }

    _p5.wait(() => {
        const _orig = window.switchTab;
        if (window._p5stWBBG) return;
        window._p5stWBBG = true;
        window.switchTab = function(n) {
            _orig(n);
            if (n === 'whiteboard') setTimeout(_inject, 120);
        };
    }, 'switchTab', 200);
    setTimeout(_inject, 600);
})();


/* ================================================================
   9. DUTCH → ENGLISH everywhere
   ================================================================ */
(function dutchToEnglish() {
    /* ── 9a. forum_fix.js / patches2.js SUBJECTS (in DOM, after render) ── */
    /* The English SUBJECTS array is already in forum_fix.js.
       This covers any remaining Dutch strings in rendered HTML. */
    const DUTCH_MAP = {
        'Alles':           'All',
        'Wiskunde':        'Math',
        'Wetenschappen':   'Science',
        'Engels':          'English',
        'Geschiedenis':    'History',
        'Overig':          'Other',
        'Anoniem':         'Anonymous',
        'Opgelost':        'Solved',
        'Bericht niet gevonden.': 'Post not found.',
        'geleden':         'ago',          // part of time strings
        'Geen berichten in dit vak.': 'No posts in this subject.',
        'Nog geen berichten — wees de eerste!': 'No posts yet — be the first!',
    };

    /* Scan post list and thread content for Dutch text nodes */
    function _translate(root) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            let t = node.textContent;
            let changed = false;
            Object.entries(DUTCH_MAP).forEach(([nl, en]) => {
                if (t.includes(nl)) { t = t.replaceAll(nl, en); changed = true; }
            });
            /* Fix time-ago Dutch: "5m geleden" → "5m ago" */
            t = t.replace(/(\d+[smud]) geleden/g, '$1 ago')
                 .replace(/(\d+)s geleden/g,       '$1s ago')
                 .replace(/(\d+)m geleden/g,        '$1m ago')
                 .replace(/(\d+)u geleden/g,        '$1h ago')
                 .replace(/(\d+) dagen geleden/g,   '$1d ago');
            if (changed || t !== node.textContent) node.textContent = t;
        }
    }

    /* Run after every forum render */
    function _patchForumRender() {
        const targets = ['forum-post-list', 'forum-thread-content'];
        const obs = new MutationObserver(() => {
            targets.forEach(id => _translate(document.getElementById(id)));
        });
        targets.forEach(id => {
            const el = document.getElementById(id);
            if (el) obs.observe(el, { childList: true, subtree: true });
        });
    }

    /* ── 9b. forum.js SUBJECTS override (global) ── */
    function _fixForumSubjects() {
        /* Override the Dutch labels inside forum.js by replacing the
           global forumSetSubject button builder */
        const bar = document.getElementById('forum-subject-bar');
        if (!bar) return;

        const EN_SUBJECTS = [
            { id:'all',     label:'All',     icon:'fa-border-all',      color:'#6b7280' },
            { id:'math',    label:'Math',    icon:'fa-square-root-alt', color:'#3b82f6' },
            { id:'science', label:'Science', icon:'fa-flask',           color:'#22c55e' },
            { id:'english', label:'English', icon:'fa-book-open',       color:'#f59e0b' },
            { id:'history', label:'History', icon:'fa-landmark',        color:'#8b5cf6' },
            { id:'it',      label:'IT & CS', icon:'fa-code',            color:'#06b6d4' },
            { id:'other',   label:'Other',   icon:'fa-circle-question', color:'#ec4899' },
        ];

        function esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }

        /* Observe and fix subject bar */
        const barObs = new MutationObserver(() => {
            bar.querySelectorAll('.forum-subject-pill').forEach(btn => {
                const sub = EN_SUBJECTS.find(s => btn.textContent.trim().includes(s.label));
                if (sub) return; // already English
                /* Find by Dutch label */
                Object.entries({
                    'Alles':'All','Wiskunde':'Math','Wetenschappen':'Science',
                    'Engels':'English','Geschiedenis':'History','Overig':'Other',
                }).forEach(([nl, en]) => {
                    if (btn.textContent.includes(nl)) {
                        btn.innerHTML = btn.innerHTML.replace(nl, en);
                    }
                });
            });
        });
        barObs.observe(bar, { childList: true, subtree: true });
    }

    /* ── 9c. Fix "Maths" → "Math" in forum new-post select ── */
    function _fixForumSelect() {
        const sel = document.getElementById('forum-new-subject');
        if (!sel) return;
        sel.querySelectorAll('option').forEach(opt => {
            if (opt.textContent === 'Maths') opt.textContent = 'Math';
        });
    }

    setTimeout(() => {
        _patchForumRender();
        _fixForumSubjects();
        _fixForumSelect();
        /* Initial translation of anything already rendered */
        _translate(document.getElementById('forum-post-list'));
        _translate(document.getElementById('forum-thread-content'));
    }, 600);
})();


/* ================================================================
   10. FORUM — image/PDF attachment in Ask-a-Question page
   ================================================================ */
_p5.css(`
/* Attachment area in ask page */
#fap-attach-area {
    display: flex; flex-direction: column; gap: 6px;
}
#fap-attach-bar {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
}
.fap-att-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 10px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.09);
    color: var(--text-muted); font-size: .75rem; font-weight: 700;
    cursor: pointer; transition: all .13s; white-space: nowrap;
}
.fap-att-btn:hover { background: rgba(255,255,255,.1); color: var(--text-main); }
#fap-attach-preview {
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;
}
.fap-att-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 8px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    font-size: .7rem; color: var(--text-muted);
}
.fap-att-chip button {
    background: transparent; border: none; cursor: pointer;
    color: var(--text-muted); font-size: .65rem; padding: 0 2px;
    transition: color .12s;
}
.fap-att-chip button:hover { color: #ef4444; }
/* Image preview thumbnail */
.fap-img-thumb {
    width: 60px; height: 60px; border-radius: 8px; object-fit: cover;
    border: 1px solid rgba(255,255,255,.1);
}
`);

(function forumAttach() {
    /* Storage for pending attachments (base64 for images, text for PDFs) */
    const _attachments = [];

    function _injectAttachUI() {
        const page = document.getElementById('forum-ask-page');
        if (!page || page.dataset.p5att) return;
        page.dataset.p5att = '1';

        /* Find the body field section */
        const bodyField = page.querySelector('#fap-body');
        if (!bodyField) return;

        /* Create hidden file inputs */
        const imgInput = document.createElement('input');
        imgInput.type = 'file'; imgInput.accept = 'image/*'; imgInput.style.display = 'none';
        imgInput.id = 'fap-img-input'; imgInput.multiple = true;

        const pdfInput = document.createElement('input');
        pdfInput.type = 'file'; pdfInput.accept = 'application/pdf'; pdfInput.style.display = 'none';
        pdfInput.id = 'fap-pdf-input'; pdfInput.multiple = true;

        document.body.appendChild(imgInput);
        document.body.appendChild(pdfInput);

        /* Build attachment area */
        const attachWrap = document.createElement('div');
        attachWrap.id = 'fap-attach-area';
        attachWrap.innerHTML = `
            <div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);">
                Attachments <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span>
            </div>
            <div id="fap-attach-bar">
                <button class="fap-att-btn" id="fap-add-img">
                    <i class="fa-regular fa-image"></i> Add Image
                </button>
                <button class="fap-att-btn" id="fap-add-pdf">
                    <i class="fa-regular fa-file-pdf"></i> Add PDF
                </button>
            </div>
            <div id="fap-attach-preview"></div>
        `;

        /* Insert just above the submit button */
        const submitBtn = page.querySelector('#fap-submit');
        if (submitBtn) page.insertBefore(attachWrap, submitBtn.previousElementSibling || submitBtn);
        else page.appendChild(attachWrap);

        /* Wire buttons */
        attachWrap.querySelector('#fap-add-img').onclick = () => imgInput.click();
        attachWrap.querySelector('#fap-add-pdf').onclick = () => pdfInput.click();

        /* Handle image files */
        imgInput.onchange = function() {
            Array.from(this.files).forEach(file => {
                if (file.size > 5 * 1024 * 1024) {
                    _p5.toast('Image too large (max 5 MB)', true); return;
                }
                const reader = new FileReader();
                reader.onload = e => {
                    const id = Date.now() + Math.random();
                    _attachments.push({ id, type: 'image', name: file.name, data: e.target.result });
                    _renderChips();
                };
                reader.readAsDataURL(file);
            });
            this.value = '';
        };

        /* Handle PDF files */
        pdfInput.onchange = function() {
            Array.from(this.files).forEach(file => {
                if (file.size > 10 * 1024 * 1024) {
                    _p5.toast('PDF too large (max 10 MB)', true); return;
                }
                const reader = new FileReader();
                reader.onload = e => {
                    const id = Date.now() + Math.random();
                    _attachments.push({ id, type: 'pdf', name: file.name, data: e.target.result });
                    _renderChips();
                };
                reader.readAsDataURL(file);
            });
            this.value = '';
        };
    }

    function _renderChips() {
        const prev = document.getElementById('fap-attach-preview');
        if (!prev) return;
        prev.innerHTML = '';
        _attachments.forEach(att => {
            const chip = document.createElement('div');
            chip.className = 'fap-att-chip';
            if (att.type === 'image') {
                chip.innerHTML = `
                    <img src="${att.data}" class="fap-img-thumb" alt="${att.name}">
                    <span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${att.name}</span>
                    <button title="Remove" data-id="${att.id}"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else {
                chip.innerHTML = `
                    <i class="fa-regular fa-file-pdf" style="color:#ef4444;"></i>
                    <span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${att.name}</span>
                    <button title="Remove" data-id="${att.id}"><i class="fa-solid fa-xmark"></i></button>
                `;
            }
            chip.querySelector('button').onclick = () => {
                const idx = _attachments.findIndex(a => a.id == att.id);
                if (idx > -1) _attachments.splice(idx, 1);
                _renderChips();
            };
            prev.appendChild(chip);
        });
    }

    /* Patch fap submit to append attachments to body */
    function _patchSubmit() {
        const btn = document.getElementById('fap-submit');
        if (!btn || btn.dataset.p5att) return;
        btn.dataset.p5att = '1';
        const _origClick = btn.onclick;
        btn.onclick = async function() {
            /* Append attachments as HTML into the body textarea */
            if (_attachments.length > 0) {
                const bodyTA = document.getElementById('fap-body');
                if (bodyTA) {
                    const attHtml = _attachments.map(att => {
                        if (att.type === 'image') {
                            return `\n\n[Image: ${att.name}]\n${att.data}`;
                        } else {
                            return `\n\n[PDF: ${att.name}] (${Math.round(att.data.length/1024)}KB)`;
                        }
                    }).join('');
                    bodyTA.value += attHtml;
                }
            }
            /* Call original handler */
            if (typeof _origClick === 'function') await _origClick.call(this);
            /* Clear attachments on success */
            _attachments.length = 0;
            _renderChips();
        };
    }

    /* Hook into forum init */
    _p5.wait(() => {
        const _orig = window.forumInit;
        if (window._p5forumAttach) return;
        window._p5forumAttach = true;
        window.forumInit = function(...a) {
            const r = _orig?.apply(this, a);
            setTimeout(() => { _injectAttachUI(); _patchSubmit(); }, 100);
            return r;
        };
        /* Also hook forumOpenNew */
        const _origNew = window.forumOpenNew;
        window.forumOpenNew = function(...a) {
            const r = _origNew?.apply(this, a);
            setTimeout(() => { _injectAttachUI(); _patchSubmit(); }, 80);
            return r;
        };
    }, 'forumInit', 250);

    /* Try immediately too (forum may already be initialised) */
    setTimeout(() => { _injectAttachUI(); _patchSubmit(); }, 1500);
})();


/* ================================================================
   11. SERVICE WORKER — graceful registration, correct scope
   ================================================================ */
(function fixServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    /* Check if sw.js actually exists before registering */
    fetch('/sw.js', { method: 'HEAD' }).then(r => {
        if (!r.ok) return; // sw.js 404 — skip silently
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .catch(() => {
                /* GitHub Pages sub-directory: try with repo scope */
                const path = location.pathname.replace(/\/[^/]*$/, '/');
                navigator.serviceWorker.register('/sw.js', { scope: path }).catch(() => {});
            });
    }).catch(() => {}); // network error — fail silently
})();


/* ================================================================
   12. SILENCE bootstrap-autofill extension error
      (This is a Bitwarden / browser-extension error, not our code.
       We suppress it from polluting the console.)
   ================================================================ */
(function silenceAutofillErrors() {
    const _origErr = window.onerror;
    window.onerror = function(msg, src, line, col, err) {
        if (typeof src === 'string' && src.includes('bootstrap-autofill')) return true;
        if (typeof msg === 'string' && msg.includes('AutofillOverlay')) return true;
        return _origErr ? _origErr(msg, src, line, col, err) : false;
    };
    const _origUnhandled = window.onunhandledrejection;
    window.onunhandledrejection = function(e) {
        const msg = e?.reason?.message || '';
        if (msg.includes('AutofillOverlay') || msg.includes('autofill-overlay')) {
            e.preventDefault(); return;
        }
        if (_origUnhandled) _origUnhandled.call(this, e);
    };
})();


/* ================================================================
   QUALITY OF LIFE EXTRAS
   ================================================================ */

/* ── Notes group drag-and-drop ── */
(function noteGroupDragDrop() {
    _p5.css(`
    .notes-group-header[draggable="true"] {
        cursor: grab;
    }
    .notes-group-header.drag-over {
        background: color-mix(in srgb, var(--accent) 15%, transparent) !important;
        border-radius: 8px;
        outline: 2px dashed var(--accent);
        outline-offset: 2px;
    }
    .note-sidebar-item[draggable="true"] {
        cursor: grab;
    }
    .note-sidebar-item[draggable="true"]:active { opacity: .6; }
    `);

    let _dragNoteId = null;

    function _setupDragDrop() {
        const sidebar = document.getElementById('notes-sidebar');
        if (!sidebar || sidebar.dataset.p5dd) return;
        sidebar.dataset.p5dd = '1';

        sidebar.addEventListener('dragstart', e => {
            const item = e.target.closest('[onclick*="loadNote"]');
            if (!item) return;
            const m = item.getAttribute('onclick')?.match(/loadNote\((\d+)\)/);
            if (m) { _dragNoteId = parseInt(m[1]); e.dataTransfer.effectAllowed = 'move'; }
        });

        sidebar.addEventListener('dragover', e => {
            e.preventDefault();
            const header = e.target.closest('.notes-group-header, [data-group-id]');
            if (header) {
                sidebar.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                header.classList.add('drag-over');
            }
            e.dataTransfer.dropEffect = 'move';
        });

        sidebar.addEventListener('dragleave', e => {
            e.target.closest('.notes-group-header, [data-group-id]')?.classList.remove('drag-over');
        });

        sidebar.addEventListener('drop', e => {
            e.preventDefault();
            sidebar.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (_dragNoteId === null) return;

            const header = e.target.closest('[data-group-id]');
            const groupId = header ? parseInt(header.dataset.groupId) || null : null;

            /* Move note */
            try {
                let notes = typeof window.DB !== 'undefined'
                    ? window.DB.get('os_notes', [])
                    : JSON.parse(localStorage.getItem('os_notes') || '[]');
                const note = notes.find(n => n.id === _dragNoteId);
                if (note) {
                    note.groupId = groupId;
                    if (typeof window.DB !== 'undefined') window.DB.set('os_notes', notes);
                    else localStorage.setItem('os_notes', JSON.stringify(notes));
                    window.renderNotes?.();
                    _p5.toast(groupId ? 'Note moved to group ✓' : 'Note removed from group');
                }
            } catch(err) { console.error('[p5/drag]', err); }

            _dragNoteId = null;
        });
    }

    /* Make note items and group headers draggable after render */
    function _makeDraggable() {
        const sidebar = document.getElementById('notes-sidebar');
        if (!sidebar) return;

        /* Note items */
        sidebar.querySelectorAll('[onclick*="loadNote"]').forEach(btn => {
            const row = btn.closest('.flex.items-center') || btn.parentElement;
            if (row && !row.draggable) {
                row.draggable = true;
                row.classList.add('note-sidebar-item');
            }
        });

        /* Group headers — need data-group-id */
        sidebar.querySelectorAll('[onclick*="toggleNoteGroup"]').forEach(btn => {
            const m = btn.getAttribute('onclick')?.match(/toggleNoteGroup\((\d+)\)/);
            if (!m) return;
            const header = btn.closest('div') || btn.parentElement;
            if (header) {
                header.dataset.groupId = m[1];
                header.classList.add('notes-group-header');
                header.draggable = false; // groups themselves don't drag
            }
        });
    }

    _p5.wait(() => {
        const _orig = window.renderNotes;
        if (window._p5rnDD) return;
        window._p5rnDD = true;
        window.renderNotes = function(...a) {
            const r = _orig.apply(this, a);
            setTimeout(() => { _setupDragDrop(); _makeDraggable(); }, 40);
            return r;
        };
    }, 'renderNotes', 200);

    setTimeout(() => { _setupDragDrop(); _makeDraggable(); }, 900);
})();


/* ── Fix remaining "Anoniem" → "Anonymous" in forum posts ── */
(function anonFix() {
    setInterval(() => {
        document.querySelectorAll('.fpc-author, .forum-reply-author').forEach(el => {
            if (el.textContent === 'Anoniem') el.textContent = 'Anonymous';
        });
    }, 2000);
})();


/* ── Forum notes-group note in 'ask-question' — translate ── */
(function translateForumPanel() {
    const sel = document.getElementById('forum-new-subject');
    if (sel) {
        sel.querySelectorAll('option').forEach(o => {
            if (o.textContent === 'Maths') o.textContent = 'Math';
        });
    }
    /* Translate fap-subject select too */
    setTimeout(() => {
        const fapSel = document.getElementById('fap-subject');
        if (fapSel) {
            fapSel.querySelectorAll('option').forEach(o => {
                if (o.textContent === 'Maths' || o.textContent === 'Wiskunde') o.textContent = 'Math';
                if (o.textContent === 'Sciences' || o.textContent === 'Wetenschappen') o.textContent = 'Science';
                if (o.textContent === 'Engels') o.textContent = 'English';
                if (o.textContent === 'Geschiedenis') o.textContent = 'History';
                if (o.textContent === 'Overig') o.textContent = 'Other';
            });
        }
    }, 800);
})();


console.log('[StudentOS patches5] ✓  All fixes active.');