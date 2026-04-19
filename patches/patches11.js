/* ================================================================
   StudentOS — patches11.js
   ================================================================
   FIXES:
   1.  Forum FAB hidden when not on forum tab
   2.  Widget header icons standardised (all Phosphor)
   3.  Formula subject pills → always Math/Physics/Chemistry/
       Biology/Economics/Other (never Dutch school subjects)
   4.  All remaining browser confirm() → custom modal
       (forum.js forumDeletePost/Reply, features.js musicDeleteCustom/
        examDelete/ttDeleteSlot)
   5.  Notes sidebar toggle button bigger (CSS + aria-label)

   NEW FEATURES:
   6.  Global search  Ctrl+K  — tasks, notes, formulas, decks, tabs
   7.  Task priority dots (none / low / medium / high)
   8.  Confetti 🎉 when all daily goals are ticked
   9.  "What's Today" greeting widget
   10. Ideas logged in console for future patches

   INSTALL (after patches10):
   <link rel="stylesheet" href="patches11.css">
   <script type="module" src="patches11.js"></script>
   ================================================================ */

/* ── Tiny helpers ── */
const _p11 = {
    esc : s => { const d=document.createElement('div');d.textContent=s||'';return d.innerHTML; },
    lsG : (k,d) => { try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):d;}catch{return d;} },
    lsS : (k,v) => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
    dbG : (k,d) => window.DB?.get?.(k,d) ?? _p11.lsG(k,d),
    dbS : (k,v) => window.DB?.set?.(k,v) ?? _p11.lsS(k,v),
    toast: (msg,err=false) => {
        const t=document.getElementById('sos-toast'); if(!t)return;
        t.textContent=msg; t.style.background=err?'#ef4444':'';
        t.classList.add('show'); setTimeout(()=>{t.classList.remove('show');t.style.background='';},3400);
    },
};

/* ================================================================
   1. FORUM FAB — body class tracks active tab
   ================================================================ */
function _p11patchTabFab() {
    function _try() {
        if (typeof window.switchTab !== 'function') { setTimeout(_try, 300); return; }
        if (window._p11_tabFabPatched) return;
        window._p11_tabFabPatched = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            // Remove all p11-tab-* classes then add the right one
            document.body.className = document.body.className.replace(/\bp11-tab-\S+/g, '').trim();
            document.body.classList.add('p11-tab-' + name);
        };
        // Set initial class based on current active tab
        const active = document.querySelector('.nav-btn.active');
        if (active) {
            const id = active.id?.replace('btn-','') || 'dashboard';
            document.body.classList.add('p11-tab-' + id);
        } else {
            document.body.classList.add('p11-tab-dashboard');
        }
    }
    _try();
}

/* ================================================================
   2. WIDGET HEADER ICONS — standardise Exams to Phosphor
   ================================================================ */
function _p11fixWidgetIcons() {
    // Exams widget: replace fa-graduation-cap with ph-graduation-cap
    // and fa-list-ul with ph-list
    function _fix() {
        const examsH3 = document.querySelector('#widget-exams h3');
        if (examsH3) {
            const oldIcon = examsH3.querySelector('i.fa-solid');
            if (oldIcon && oldIcon.classList.contains('fa-graduation-cap')) {
                oldIcon.className = 'ph ph-graduation-cap';
                oldIcon.style.color = 'var(--accent)';
                oldIcon.style.marginRight = '4px';
            }
        }
        const manageBtn = document.querySelector('.exam-manage-btn i.fa-solid');
        if (manageBtn && manageBtn.classList.contains('fa-list-ul')) {
            manageBtn.className = 'ph ph-list';
        }
        // Also fix the streak fire icon in dashboard header (already fa-solid fa-fire - fine)
        // Mark as done
        window._p11_iconsFixed = true;
    }
    // Try immediately and after a short delay (features.js may inject late)
    setTimeout(_fix, 600);
    setTimeout(_fix, 2000);
}

/* ================================================================
   3. FORMULA SUBJECT PILLS — fixed English list only
   ================================================================ */
const P11_SUBJECTS = [
    { value: 'all',       label: 'All',       icon: 'ph-squares-four',    color: '#6b7280' },
    { value: 'Math',      label: 'Math',       icon: 'ph-math-operations', color: '#3b82f6' },
    { value: 'Physics',   label: 'Physics',    icon: 'ph-atom',            color: '#8b5cf6' },
    { value: 'Chemistry', label: 'Chemistry',  icon: 'ph-flask',           color: '#22c55e' },
    { value: 'Biology',   label: 'Biology',    icon: 'ph-dna',             color: '#f59e0b' },
    { value: 'Economics', label: 'Economics',  icon: 'ph-chart-line-up',   color: '#ec4899' },
    { value: 'Other',     label: 'Other',      icon: 'ph-question',        color: '#6b7280' },
];

// We keep our own subject state so features.js doesn't clobber it
window._p11_fSubj = 'all';

function _p11overrideSubjectBar() {
    function _try() {
        if (typeof window.renderFormulaSubjectBar !== 'function') { setTimeout(_try, 400); return; }
        if (window._p11_subjBarPatched) return;
        window._p11_subjBarPatched = true;

        window.renderFormulaSubjectBar = function() {
            const bar = document.getElementById('formula-subject-bar');
            if (!bar) return;
            const items = _p11.dbG('os_formulas', []);
            const counts = {};
            items.forEach(f => { if (f.subject) counts[f.subject] = (counts[f.subject]||0)+1; });
            const total = items.length;

            bar.innerHTML = P11_SUBJECTS.map(s => {
                const count = s.value === 'all' ? total : (counts[s.value] || 0);
                const active = window._p11_fSubj === s.value;
                return `<button class="formula-pill${active?' active':''}"
                                 data-subj="${s.value}"
                                 onclick="_p11setFormulaSubj('${s.value}')"
                                 style="${active ? '' : `--pill-accent:${s.color}`}">
                    <i class="ph ${s.icon}"></i>
                    ${s.label}
                    ${count > 0 ? `<span style="opacity:.55;font-size:.65rem;margin-left:2px;">${count}</span>` : ''}
                </button>`;
            }).join('');
        };

        // Also patch formulaSetSubject so switching pills still filters cards
        const _origRender = window.renderFormulas;
        window.formulaSetSubject = function(subj) {
            window._p11_fSubj = subj;
            window.renderFormulaSubjectBar();
            // Manually filter by calling the internal render with our subj
            // We patch renderFormulas to respect _p11_fSubj
            _p11renderFormulas();
        };

        // Re-render immediately
        window.renderFormulaSubjectBar();
    }
    _try();
}

window._p11setFormulaSubj = function(subj) {
    window._p11_fSubj = subj;
    window.renderFormulaSubjectBar();
    _p11renderFormulas();
};

function _p11renderFormulas() {
    // Lean on features.js renderFormulas but filter by our subject var
    const list = document.getElementById('formula-list');
    if (!list) return;
    const subj = window._p11_fSubj || 'all';
    const search = window._p11_fSearch || '';
    let items = _p11.dbG('os_formulas', []);
    if (subj !== 'all') items = items.filter(f => f.subject === subj);
    if (search) {
        const q = search.toLowerCase();
        items = items.filter(f => (f.title||'').toLowerCase().includes(q) || (f.formula||'').toLowerCase().includes(q) || (f.note||'').toLowerCase().includes(q));
    }
    if (!items.length) {
        list.innerHTML = `<div class="formula-empty"><i class="fa-solid fa-square-root-alt"></i><p>${search ? 'No results.' : 'No formulas yet — add one or browse the library!'}</p></div>`;
        return;
    }
    const subjects = _p11.dbG('os_subjects', []);
    const subjectColorMap = Object.fromEntries(subjects.map(s => [s.name, s.color]));
    const p11Colors = { Math:'#3b82f6', Physics:'#8b5cf6', Chemistry:'#22c55e', Biology:'#f59e0b', Economics:'#ec4899' };
    list.innerHTML = items.map(f => {
        const color = p11Colors[f.subject] || subjectColorMap[f.subject] || '#6b7280';
        return `<div class="formula-card">
            <div class="formula-card-header">
                <div class="formula-subject-dot" style="background:${color}"></div>
                <span class="formula-card-title">${_p11.esc(f.title)}</span>
                ${f.subject ? `<span class="formula-subject-tag" style="background:${color}22;color:${color}">${_p11.esc(f.subject)}</span>` : ''}
                <div class="formula-card-actions">
                    <button onclick="formulaEdit('${f.id}')" title="Edit"><i class="ph ph-pencil"></i></button>
                    <button onclick="formulaDelete('${f.id}')" title="Delete"><i class="ph ph-trash"></i></button>
                </div>
            </div>
            <div class="formula-body">${_p11.esc(f.formula)}</div>
            ${f.note ? `<div class="formula-note">${_p11.esc(f.note)}</div>` : ''}
        </div>`;
    }).join('');
}
window._p11_fSearch = '';
// Patch formulaSearch to use our renderer
function _p11patchFormulaSearch() {
    function _try() {
        if (typeof window.formulaSearch !== 'function') { setTimeout(_try, 400); return; }
        if (window._p11_searchPatched) return;
        window._p11_searchPatched = true;
        window.formulaSearch = function(q) {
            window._p11_fSearch = q;
            _p11renderFormulas();
        };
    }
    _try();
}

/* ================================================================
   4. PATCH ALL REMAINING browser confirm() WITH CUSTOM MODAL
   ================================================================ */

// Reuse p10confirm if available, else build our own
async function _p11confirm({ title='Are you sure?', desc='This cannot be undone.', okLabel='Delete', iconClass='ph-trash', iconColor='#ef4444' } = {}) {
    // Try p10's confirm first
    if (typeof window._p10confirm === 'function') return window._p10confirm({ title, desc, okLabel, iconClass: 'fa-'+iconClass.replace('ph-',''), iconColor });

    // Fallback: build a minimal confirm modal
    let box = document.getElementById('p11-confirm-fallback');
    if (!box) {
        box = document.createElement('div');
        box.id = 'p11-confirm-fallback';
        box.style.cssText = `position:fixed;inset:0;z-index:810;display:flex;align-items:center;justify-content:center;
            background:rgba(0,0,0,.52);backdrop-filter:blur(6px);opacity:0;transition:opacity .18s;pointer-events:none;`;
        box.innerHTML = `<div style="background:var(--bg-color);border:1px solid rgba(255,255,255,.1);border-radius:20px;
            padding:28px;max-width:340px;width:90%;box-shadow:0 16px 60px rgba(0,0,0,.4);">
            <div id="p11cf-icon" style="width:48px;height:48px;border-radius:14px;background:rgba(239,68,68,.1);
                border:2px solid rgba(239,68,68,.2);display:flex;align-items:center;justify-content:center;
                margin-bottom:14px;font-size:1.2rem;color:#ef4444;"></div>
            <div id="p11cf-title" style="font-size:1rem;font-weight:700;margin-bottom:7px;"></div>
            <div id="p11cf-desc"  style="font-size:.82rem;color:var(--text-muted);line-height:1.6;margin-bottom:20px;"></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button id="p11cf-cancel" style="padding:8px 18px;border-radius:10px;background:var(--glass-hover);
                    border:1px solid rgba(255,255,255,.09);color:var(--text-muted);cursor:pointer;font-size:.85rem;font-family:inherit;">Cancel</button>
                <button id="p11cf-ok" style="padding:8px 18px;border-radius:10px;background:rgba(239,68,68,.12);
                    color:#ef4444;border:1px solid rgba(239,68,68,.22);cursor:pointer;font-size:.85rem;font-weight:700;font-family:inherit;"></button>
            </div>
        </div>`;
        document.body.appendChild(box);
    }
    document.getElementById('p11cf-icon').innerHTML = `<i class="ph-bold ${iconClass}"></i>`;
    document.getElementById('p11cf-title').textContent = title;
    document.getElementById('p11cf-desc').textContent  = desc;
    document.getElementById('p11cf-ok').textContent    = okLabel;

    return new Promise(res => {
        box.style.pointerEvents = 'all';
        box.style.opacity = '1';
        const close = (val) => { box.style.opacity='0'; box.style.pointerEvents='none'; res(val); };
        document.getElementById('p11cf-ok').onclick     = () => close(true);
        document.getElementById('p11cf-cancel').onclick = () => close(false);
        box.onclick = e => { if (e.target === box) close(false); };
    });
}
window._p11confirm = _p11confirm;

function _p11patchConfirms() {
    /* ── forum.js ── */
    function _patchForum() {
        if (typeof window.forumDeletePost !== 'function') { setTimeout(_patchForum, 400); return; }
        if (window._p11_forumPatched) return;
        window._p11_forumPatched = true;

        const _origDelPost  = window.forumDeletePost;
        const _origDelReply = window.forumDeleteReply;

        window.forumDeletePost = async function(postId) {
            const yes = await _p11confirm({ title:'Delete Post', desc:'This post and all its replies will be permanently deleted.', okLabel:'Delete', iconClass:'ph-trash', iconColor:'#ef4444' });
            if (!yes) return;
            // Call original but stub out confirm so it passes
            const _orig = window.confirm; window.confirm = () => true;
            try { await _origDelPost(postId); } finally { window.confirm = _orig; }
        };

        window.forumDeleteReply = async function(postId, replyId) {
            const yes = await _p11confirm({ title:'Delete Reply', desc:'This reply will be permanently deleted.', okLabel:'Delete', iconClass:'ph-trash', iconColor:'#ef4444' });
            if (!yes) return;
            const _orig = window.confirm; window.confirm = () => true;
            try { await _origDelReply(postId, replyId); } finally { window.confirm = _orig; }
        };
    }
    _patchForum();

    /* ── features.js ── */
    function _patchFeatures() {
        const needed = ['musicDeleteCustom','examDelete','ttDeleteSlot'];
        const allExist = needed.every(fn => typeof window[fn] === 'function');
        if (!allExist) { setTimeout(_patchFeatures, 500); return; }
        if (window._p11_featuresPatched) return;
        window._p11_featuresPatched = true;

        // Music station remove
        const _origMusicDel = window.musicDeleteCustom;
        window.musicDeleteCustom = async function(id) {
            const yes = await _p11confirm({ title:'Remove Station', desc:'This custom station will be removed.', okLabel:'Remove', iconClass:'ph-music-note-slash', iconColor:'#ef4444' });
            if (!yes) return;
            const _orig = window.confirm; window.confirm = () => true;
            try { _origMusicDel(id); } finally { window.confirm = _orig; }
        };

        // Exam delete
        const _origExamDel = window.examDelete;
        window.examDelete = async function(id) {
            const items = _p11.dbG('os_exams', []);
            const exam = items.find(e => e.id === id);
            const name = exam?.title || 'this exam';
            const yes = await _p11confirm({ title:'Delete Exam', desc:`"${name}" will be permanently deleted.`, okLabel:'Delete', iconClass:'ph-trash', iconColor:'#ef4444' });
            if (!yes) return;
            const _orig = window.confirm; window.confirm = () => true;
            try { _origExamDel(id); } finally { window.confirm = _orig; }
        };

        // Timetable slot remove
        const _origTTDel = window.ttDeleteSlot;
        window.ttDeleteSlot = async function() {
            const yes = await _p11confirm({ title:'Remove Slot', desc:'This timetable slot will be removed.', okLabel:'Remove', iconClass:'ph-calendar-x', iconColor:'#ef4444' });
            if (!yes) return;
            const _orig = window.confirm; window.confirm = () => true;
            try { _origTTDel(); } finally { window.confirm = _orig; }
        };
    }
    _patchFeatures();

    /* Also catch any confirm() we may have missed with a global interceptor */
    if (!window._p11_confirmGlobalPatched) {
        window._p11_confirmGlobalPatched = true;
        // We can't make synchronous confirm async, but we can suppress the ugly
        // browser dialog for the few remaining raw calls by scheduling them async
        // Only do this for our known set (already handled above) — don't override global confirm
        // because that would break any legitimate synchronous use
    }
}

/* ================================================================
   5. NOTES SIDEBAR TOGGLE — ensure aria-label for accessibility
   ================================================================ */
function _p11fixNotesSidebarBtn() {
    setTimeout(() => {
        const btn = document.getElementById('notes-sidebar-toggle-btn');
        if (btn) {
            btn.setAttribute('aria-label', 'Toggle sidebar');
            btn.setAttribute('title', 'Toggle Sidebar (Ctrl+\\)');
        }
    }, 800);
}

/* ================================================================
   6. GLOBAL SEARCH  (Ctrl+K)
   ================================================================ */
function _p11buildSearch() {
    if (document.getElementById('p11-search-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'p11-search-overlay';
    overlay.innerHTML = `
        <div id="p11-search-box" role="dialog" aria-label="Global search">
            <div id="p11-search-input-row">
                <i class="ph ph-magnifying-glass"></i>
                <input id="p11-search-input" type="text" placeholder="Search tasks, notes, formulas, decks…"
                       autocomplete="off" spellcheck="false">
                <span id="p11-search-kbd">Esc to close</span>
            </div>
            <div id="p11-search-results"></div>
            <div class="p11-search-footer">
                <span><span class="p11-sf-key">↑↓</span> navigate</span>
                <span><span class="p11-sf-key">Enter</span> open</span>
                <span><span class="p11-sf-key">Esc</span> close</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) _p11closeSearch(); });

    const input = document.getElementById('p11-search-input');
    input.addEventListener('input', () => (window._p11doSearch || _p11doSearch)(input.value));
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { _p11closeSearch(); return; }
        if (e.key === 'ArrowDown') { _p11searchMove(1); e.preventDefault(); }
        if (e.key === 'ArrowUp')   { _p11searchMove(-1); e.preventDefault(); }
        if (e.key === 'Enter')     { _p11searchConfirm(); }
    });

    // Inject search trigger button into dashboard header area
    const dashHeader = document.querySelector('#view-dashboard header');
    if (dashHeader && !document.getElementById('p11-search-trigger')) {
        const btn = document.createElement('button');
        btn.id = 'p11-search-trigger';
        btn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Search <kbd>Ctrl K</kbd>';
        btn.onclick = _p11openSearch;
        dashHeader.appendChild(btn);
    }
}

window._p11openSearch = function() {
    _p11buildSearch();
    const overlay = document.getElementById('p11-search-overlay');
    const input   = document.getElementById('p11-search-input');
    overlay.classList.add('show');
    setTimeout(() => input?.focus(), 80);
    _p11doSearch('');
};

window._p11closeSearch = function() {
    const overlay = document.getElementById('p11-search-overlay');
    overlay?.classList.remove('show');
    /* Clear the search bar so it's fresh on next open */
    const input = document.getElementById('p11-search-input');
    if (input) input.value = '';
};

let _p11_selIdx = -1;

function _p11doSearch(q) {
    _p11_selIdx = -1;
    const results = document.getElementById('p11-search-results');
    if (!results) return;

    const items = _p11collectSearchItems();
    const query = q.trim().toLowerCase();

    // Quick navigation shortcuts (no query needed)
    const tabs = [
        { label:'Dashboard',   icon:'ph-squares-four',      color:'#3b82f6', action:()=>switchTab('dashboard') },
        { label:'Tasks',       icon:'ph-check-circle',      color:'#22c55e', action:()=>switchTab('tasks') },
        { label:'Calendar',    icon:'ph-calendar-blank',    color:'#ec4899', action:()=>switchTab('calendar') },
        { label:'Notes',       icon:'ph-notebook',          color:'#f59e0b', action:()=>switchTab('notes') },
        { label:'Whiteboard',  icon:'ph-pencil-simple',     color:'#8b5cf6', action:()=>switchTab('whiteboard') },
        { label:'Cards',       icon:'ph-cards',             color:'#ec4899', action:()=>switchTab('cards') },
        { label:'Grades',      icon:'ph-chart-bar',         color:'#14b8a6', action:()=>switchTab('grades') },
        { label:'Calculator',  icon:'ph-calculator',        color:'#6b7280', action:()=>switchTab('calc') },
        { label:'Focus Timer', icon:'ph-timer',             color:'#f97316', action:()=>switchTab('focus') },
        { label:'Music',       icon:'ph-music-note',        color:'#8b5cf6', action:()=>switchTab('music') },
        { label:'Formulas',    icon:'ph-math-operations',   color:'#8b5cf6', action:()=>switchTab('formulas') },
        { label:'Forum',       icon:'ph-chats-teardrop',    color:'#3b82f6', action:()=>switchTab('forum') },
        { label:'Routine',     icon:'ph-calendar-check',    color:'#22c55e', action:()=>switchTab('routine') },
        { label:'Attendance',  icon:'ph-user-check',        color:'#14b8a6', action:()=>switchTab('attendance') },
        { label:'Worksheet',   icon:'ph-stack',             color:'#f59e0b', action:()=>switchTab('worksheet') },
        { label:'Settings',    icon:'ph-gear',              color:'#6b7280', action:()=>{ if(typeof openModal==='function') openModal('modal-settings'); } },
    ];

    const matchTabs = !query ? tabs : tabs.filter(t => t.label.toLowerCase().includes(query));
    const matchItems = !query ? [] : items.filter(it => {
        const combined = ((it.title||'') + ' ' + (it.sub||'')).toLowerCase();
        return combined.includes(query);
    }).slice(0, 12);

    if (!query && !matchItems.length && !matchTabs.length) {
        results.innerHTML = `<div class="p11-search-empty"><i class="ph ph-magnifying-glass"></i><span>Start typing to search…</span></div>`;
        return;
    }
    if (query && !matchItems.length && !matchTabs.length) {
        results.innerHTML = `<div class="p11-search-empty"><i class="ph ph-smiley-sad"></i><span>No results for "<strong>${_p11.esc(q)}</strong>"</span></div>`;
        return;
    }

    /* Store tab actions for onclick access */
    window._p11_tabActions = matchTabs.map(t => t.action);

    function highlight(text, q) {
        if (!q) return _p11.esc(text);
        const idx = text.toLowerCase().indexOf(q.toLowerCase());
        if (idx < 0) return _p11.esc(text);
        return _p11.esc(text.slice(0, idx)) + `<mark class="p11-result-mark">${_p11.esc(text.slice(idx, idx+q.length))}</mark>` + _p11.esc(text.slice(idx+q.length));
    }

    let html = '';

    if (matchTabs.length) {
        html += `<div class="p11-result-group-lbl">${query ? 'Pages' : 'Quick Navigation'}</div>`;
        html += matchTabs.map((t,i) => `
            <div class="p11-result-item" data-idx="${i}" onclick="if(window._p11_tabActions&&window._p11_tabActions[${i}])window._p11_tabActions[${i}]();_p11closeSearch()">
                <div class="p11-result-icon" style="background:${t.color}22;color:${t.color}">
                    <i class="ph ${t.icon}"></i>
                </div>
                <div class="p11-result-text">
                    <div class="p11-result-title">${t.label}</div>
                </div>
                <i class="ph ph-arrow-right p11-result-arrow"></i>
            </div>`).join('');
    }

    if (matchItems.length) {
        // Group by type
        const groups = {};
        matchItems.forEach(it => { (groups[it.type]=[...groups[it.type]||[]]).push(it); });
        // Actually: just collect in order
        const grouped = {};
        matchItems.forEach(it => { if(!grouped[it.type]) grouped[it.type]=[]; grouped[it.type].push(it); });
        const typeLabels = { task:'Tasks', note:'Notes', formula:'Formulas', deck:'Flashcard Decks', card:'Flashcards' };
        let globalIdx = matchTabs.length;
        Object.entries(grouped).forEach(([type, grpItems]) => {
            html += `<div class="p11-result-group-lbl">${typeLabels[type] || type}</div>`;
            html += grpItems.map(it => {
                const gi = globalIdx++;
                return `<div class="p11-result-item" data-idx="${gi}" onclick="_p11searchOpen(${JSON.stringify(it).replace(/"/g,'&quot;')});_p11closeSearch()">
                    <div class="p11-result-icon" style="background:${it.color}22;color:${it.color}">
                        <i class="ph ${it.icon}"></i>
                    </div>
                    <div class="p11-result-text">
                        <div class="p11-result-title">${highlight(it.title, q)}</div>
                        ${it.sub ? `<div class="p11-result-sub">${_p11.esc(it.sub)}</div>` : ''}
                    </div>
                    <i class="ph ph-arrow-right p11-result-arrow"></i>
                </div>`;
            }).join('');
        });
    }

    results.innerHTML = html;
}

function _p11collectSearchItems() {
    const items = [];
    // Tasks
    try {
        const tasks = _p11.dbG('os_tasks', []);
        tasks.forEach(t => items.push({ type:'task', title:t.text||t.title||'Task', sub:t.date||'', icon:'ph-check-circle', color:'#22c55e', action:()=>switchTab('tasks') }));
    } catch{}
    // Notes
    try {
        const notes = _p11.dbG('os_notes', []);
        notes.forEach(n => items.push({ type:'note', title:n.title||'Untitled Note', sub:(n.body||'').replace(/<[^>]+>/g,'').slice(0,60), icon:'ph-notebook', color:'#f59e0b', id:n.id, action:()=>{ switchTab('notes'); setTimeout(()=>{ if(typeof loadNote==='function') loadNote(n.id); },200); } }));
    } catch{}
    // Formulas
    try {
        const formulas = _p11.dbG('os_formulas', []);
        formulas.forEach(f => items.push({ type:'formula', title:f.title||'Formula', sub:f.formula||'', icon:'ph-math-operations', color:'#8b5cf6', action:()=>switchTab('formulas') }));
    } catch{}
    // Decks
    try {
        const decks = _p11.dbG('os_decks', []);
        decks.forEach(d => items.push({ type:'deck', title:d.name||'Deck', sub:`${d.cards?.length||0} cards`, icon:'ph-cards', color:'#ec4899', action:()=>{ switchTab('cards'); } }));
    } catch{}
    return items;
}

window._p11searchOpen = function(item) {
    if (item && typeof item.action === 'function') item.action();
    else if (typeof switchTab === 'function') switchTab('dashboard');
};

function _p11searchMove(dir) {
    const items = document.querySelectorAll('.p11-result-item');
    if (!items.length) return;
    items[_p11_selIdx]?.classList.remove('selected');
    _p11_selIdx = Math.max(0, Math.min(items.length-1, _p11_selIdx + dir));
    items[_p11_selIdx]?.classList.add('selected');
    items[_p11_selIdx]?.scrollIntoView({ block:'nearest' });
}
function _p11searchConfirm() {
    const sel = document.querySelector('.p11-result-item.selected');
    if (sel) { sel.click(); return; }
    // If nothing selected, click first result
    document.querySelector('.p11-result-item')?.click();
}

// Global keyboard shortcut
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const overlay = document.getElementById('p11-search-overlay');
        if (overlay?.classList.contains('show')) _p11closeSearch();
        else _p11openSearch();
    }
    if (e.key === 'Escape') {
        const overlay = document.getElementById('p11-search-overlay');
        if (overlay?.classList.contains('show')) { _p11closeSearch(); }
    }
});

/* ================================================================
   7. TASK PRIORITY DOTS
   ================================================================ */
const P11_PRIORITIES = ['none','low','medium','high'];
const P11_PRIO_COLORS = { none:'rgba(255,255,255,.15)', low:'#22c55e', medium:'#f59e0b', high:'#ef4444' };
const P11_PRIO_LABELS = { none:'No priority', low:'Low', medium:'Medium', high:'High 🔴' };

function _p11getTaskPriorities() { return _p11.lsG('p11_task_priorities', {}); }
function _p11setTaskPriority(taskId, prio) {
    const p = _p11getTaskPriorities();
    if (prio === 'none') delete p[taskId]; else p[taskId] = prio;
    _p11.lsS('p11_task_priorities', p);
}

// We inject priority dots into the task list by patching the render
function _p11patchTaskRender() {
    function _try() {
        if (typeof window.renderTasks !== 'function') { setTimeout(_try, 500); return; }
        if (window._p11_taskRenderPatched) return;
        window._p11_taskRenderPatched = true;
        const _orig = window.renderTasks;
        window.renderTasks = function(...args) {
            _orig(...args);
            setTimeout(_p11injectPriorityDots, 30);
        };
        setTimeout(_p11injectPriorityDots, 800);
    }
    _try();
}

function _p11injectPriorityDots() {
    const priorities = _p11getTaskPriorities();
    document.querySelectorAll('.task-item[data-id]').forEach(row => {
        const id = row.dataset.id;
        if (!id || row.dataset.prioInjected) return;
        row.dataset.prioInjected = 'true';
        const prio = priorities[id] || 'none';
        const dot = document.createElement('div');
        dot.className = 'p11-task-priority';
        dot.dataset.p = prio;
        dot.title = P11_PRIO_LABELS[prio];
        dot.style.position = 'relative';
        dot.addEventListener('click', e => { e.stopPropagation(); _p11showPriorityPicker(dot, id); });
        // Insert before the checkbox or at the start
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.parentNode.insertBefore(dot, checkbox);
        else row.insertBefore(dot, row.firstChild);
    });
}

let _p11_prioPopup = null;
function _p11showPriorityPicker(anchor, taskId) {
    // Remove existing popup
    _p11_prioPopup?.remove();
    const popup = document.createElement('div');
    popup.className = 'p11-priority-popup';
    _p11_prioPopup = popup;

    P11_PRIORITIES.forEach(p => {
        const opt = document.createElement('div');
        opt.className = 'p11-pp-opt';
        opt.innerHTML = `<div class="p11-pp-dot" style="background:${P11_PRIO_COLORS[p]};${p==='none'?'border:2px solid rgba(255,255,255,.25)':''}"></div>${P11_PRIO_LABELS[p]}`;
        opt.addEventListener('click', e => {
            e.stopPropagation();
            _p11setTaskPriority(taskId, p);
            anchor.dataset.p = p;
            anchor.title = P11_PRIO_LABELS[p];
            popup.remove();
        });
        popup.appendChild(opt);
    });

    const rect = anchor.getBoundingClientRect();
    popup.style.cssText = `position:fixed;top:${rect.bottom+6}px;left:${rect.left}px;z-index:500;`;
    document.body.appendChild(popup);
    setTimeout(() => document.addEventListener('click', () => popup.remove(), { once: true }), 10);
}

/* ================================================================
   8. CONFETTI 🎉 on all daily goals complete
   ================================================================ */
function _p11buildConfettiCanvas() {
    if (document.getElementById('p11-confetti-canvas')) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'p11-confetti-canvas';
    document.body.appendChild(canvas);
}

window._p11fireConfetti = function() {
    _p11buildConfettiCanvas();
    const canvas = document.getElementById('p11-confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
    const colors = [accent, '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#fff'];
    const pieces = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: -20,
        r: Math.random() * 7 + 3,
        d: Math.random() * 4 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngle: 0,
        tiltSpeed: Math.random() * .12 + .05,
        vx: Math.random() * 3 - 1.5,
    }));

    let frame = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            ctx.beginPath();
            ctx.fillStyle = p.color;
            ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.tiltAngle, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.d; p.x += p.vx;
            p.tiltAngle += p.tiltSpeed;
            if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
        });
        frame++;
        if (frame < 180) requestAnimationFrame(draw);
        else { ctx.clearRect(0,0,canvas.width,canvas.height); }
    }
    draw();
};

function _p11patchGoalCompletion() {
    // Watch the goals container for all checkboxes being checked
    function _try() {
        const goalsContainer = document.getElementById('goals-container');
        if (!goalsContainer) { setTimeout(_try, 800); return; }
        let _lastFired = 0;
        const obs = new MutationObserver(() => {
            const boxes = goalsContainer.querySelectorAll('input[type="checkbox"]');
            if (!boxes.length) return;
            const allDone = [...boxes].every(b => b.checked);
            if (allDone && Date.now() - _lastFired > 5000) {
                _lastFired = Date.now();
                window._p11fireConfetti();
                _p11.toast('🎉 All goals done for today!');
            }
        });
        obs.observe(goalsContainer, { subtree: true, attributes: true, attributeFilter: ['checked'], childList: true });
    }
    _try();
}

/* ================================================================
   9. "WHAT'S TODAY" GREETING WIDGET
   ================================================================ */
function _p11injectTodayWidget() {
    if (document.getElementById('widget-today')) return;
    const grid = document.getElementById('widgets-grid');
    if (!grid) return;

    const widget = document.createElement('div');
    widget.className = 'col-span-2 min-card p-5 flex flex-col widget-item';
    widget.id = 'widget-today';
    widget.draggable = true;
    widget.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                <i class="ph ph-sun-horizon" style="color:var(--accent);margin-right:4px;"></i> Today
            </h3>
            <span id="p11-today-date" style="font-size:.72rem;color:var(--text-muted);"></span>
        </div>
        <div class="p11-today-greeting" id="p11-today-greeting">Good morning!</div>
        <div class="p11-today-chips" id="p11-today-chips"></div>
    `;
    // Insert as first child of grid
    grid.insertBefore(widget, grid.firstChild);
    _p11updateTodayWidget();
}

function _p11updateTodayWidget() {
    const greet  = document.getElementById('p11-today-greeting');
    const chips  = document.getElementById('p11-today-chips');
    const dateEl = document.getElementById('p11-today-date');
    if (!greet) return;

    const now  = new Date();
    const hour = now.getHours();
    const name = (document.getElementById('profile-name-input')?.value || '').trim();
    const tod  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    greet.innerHTML = `Good ${tod}${name ? `, <strong>${_p11.esc(name)}</strong>` : ''}! Let's make today count. 💪`;
    if (dateEl) dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    // Build chips from data
    const chipData = [];
    try {
        const tasks = _p11.dbG('os_tasks', []);
        const today = now.toISOString().slice(0,10);
        const dueTasks = tasks.filter(t => !t.done && (t.date === today || !t.date));
        if (dueTasks.length) chipData.push({ icon:'ph-check-circle', label:`${dueTasks.length} task${dueTasks.length>1?'s':''}`, color:'#22c55e' });
    } catch{}
    try {
        const exams = _p11.dbG('os_exams', []);
        const soon  = exams.filter(e => {
            const d = new Date(e.date); d.setHours(0,0,0,0);
            const diff = Math.ceil((d-now)/86400000);
            return diff >= 0 && diff <= 7;
        });
        if (soon.length) chipData.push({ icon:'ph-graduation-cap', label:`${soon.length} exam${soon.length>1?'s':''} this week`, color:'#ef4444' });
    } catch{}
    try {
        const habits = JSON.parse(localStorage.getItem('p9_habits')||'[]');
        const todayStr = now.toISOString().slice(0,10);
        if (!habits.includes(todayStr)) chipData.push({ icon:'ph-flame', label:'Study habit not marked yet', color:'#f59e0b' });
    } catch{}
    // Motivational if nothing
    if (!chipData.length) chipData.push({ icon:'ph-star', label:'Clear schedule — time to get ahead!', color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6' });

    if (chips) chips.innerHTML = chipData.map(c =>
        `<div class="p11-today-chip" style="color:${c.color};background:${c.color}18;border-color:${c.color}28;">
            <i class="ph ${c.icon}"></i> ${_p11.esc(c.label)}
        </div>`
    ).join('');
}

// Refresh the today widget whenever dashboard is shown
function _p11patchDashboardRefresh() {
    function _try() {
        if (typeof window.switchTab !== 'function') { setTimeout(_try, 300); return; }
        if (window._p11_dashRefreshPatched) return;
        window._p11_dashRefreshPatched = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            if (name === 'dashboard') setTimeout(_p11updateTodayWidget, 100);
        };
    }
    _try();
}

/* ================================================================
   INIT
   ================================================================ */
function _p11init() {
    _p11patchTabFab();
    _p11fixWidgetIcons();
    _p11overrideSubjectBar();
    _p11patchFormulaSearch();
    _p11patchConfirms();
    _p11fixNotesSidebarBtn();
    _p11buildSearch();
    _p11patchTaskRender();
    _p11patchGoalCompletion();
    _p11patchDashboardRefresh();

    // Today widget — inject after dashboard widgets exist
    setTimeout(_p11injectTodayWidget, 700);
    setTimeout(_p11updateTodayWidget, 1200);

    // Re-render formula bar once features.js is done loading
    setTimeout(() => {
        if (typeof window.renderFormulaSubjectBar === 'function') window.renderFormulaSubjectBar();
    }, 1500);

    // Refresh priority dots every time tasks re-render
    setTimeout(_p11injectPriorityDots, 1500);

    console.log('[patches11] ✓ FAB fix · Widget icons · Formula subjects · Confirm modals · Global search · Priority dots · Confetti · Today widget');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_p11init, 500));
} else {
    setTimeout(_p11init, 500);
}
