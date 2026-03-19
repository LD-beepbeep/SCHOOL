/* ================================================================
   StudentOS — patches.js
   Drop-in fixes: clock color, enter-to-save, Dutch, sidebar scroll,
   mobile nav, edit subjects in grades, KaTeX math in formulas.

   Add to index.html AFTER the other scripts:
   <script type="module" src="patches.js"></script>
   ================================================================ */



/* ================================================================
   1. CLOCK COLOR — actually applies to the main clock + focus timer
   ================================================================ */
(function patchClockColor() {
    function _apply(color) {
        document.documentElement.style.setProperty('--clock-color', color);
        const clockEl = document.getElementById('clock-time');
        if (clockEl) clockEl.style.color = color;
    }

    /* Patch setClockColor once it exists */
    function _tryPatch() {
        if (typeof window.setClockColor === 'function') {
            const _orig = window.setClockColor;
            window.setClockColor = function(color) {
                _orig(color);
                _apply(color);
            };
        } else {
            /* If function isn't defined yet, define it */
            window.setClockColor = function(color) {
                localStorage.setItem('os_clock_color', color);
                _apply(color);
                const picker = document.getElementById('clock-color-picker');
                if (picker) picker.value = color;
            };
        }
        /* Apply saved color on load */
        const saved = localStorage.getItem('os_clock_color');
        if (saved) _apply(saved);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _tryPatch);
    } else {
        _tryPatch();
    }
})();

/* ================================================================
   2. SCROLLABLE SIDEBAR (desktop nav)
   ================================================================ */
(function patchSidebar() {
    const style = document.createElement('style');
    style.textContent = `
        nav.w-20 {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            scrollbar-width: none;
        }
        nav.w-20::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
})();

/* ================================================================
   3. ENTER-TO-SAVE EVERYWHERE
   ================================================================ */
(function patchEnterToSave() {
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter' || e.shiftKey) return;
        const id = document.activeElement?.id;
        if (!id) return;

        const map = {
            /* Tasks */
            'task-input':           () => typeof addTask       === 'function' && addTask(),
            'dash-quick-task':      () => typeof dashAddTask   === 'function' && dashAddTask(),
            /* Grades */
            'subject-name':         () => typeof saveSubject   === 'function' && saveSubject(),
            'test-score':           () => typeof saveTest      === 'function' && saveTest(),
            'test-max':             () => typeof saveTest      === 'function' && saveTest(),
            'test-name':            () => typeof saveTest      === 'function' && saveTest(),
            /* Calendar */
            'event-input':          () => typeof saveCalEvent  === 'function' && saveCalEvent(),
            /* Links */
            'link-name':            () => { /* tab to url */ document.getElementById('link-url')?.focus(); },
            'link-url':             () => typeof saveQuickLink === 'function' && saveQuickLink(),
            /* Notes */
            'note-group-name':      () => typeof saveNoteGroup === 'function' && saveNoteGroup(),
            /* Decks */
            'deck-name':            () => typeof saveDeck      === 'function' && saveDeck(),
            'group-name':           () => typeof saveGroup     === 'function' && saveGroup(),
            /* Cards */
            'card-a-input':         () => typeof saveFlashcard === 'function' && saveFlashcard(),
            /* Formulas */
            'formula-modal-title':  () => { document.getElementById('formula-modal-formula')?.focus(); },
            /* Exam */
            'exam-modal-title':     () => { document.getElementById('exam-modal-date')?.focus(); },
            /* Goal */
            'goal-input':           () => typeof addGoal       === 'function' && addGoal(),
        };

        if (map[id]) {
            e.preventDefault();
            map[id]();
        }
    });
})();

/* ================================================================
   4. DUTCH (NL) TRANSLATIONS — improved
   ================================================================ */
(function patchDutch() {
    const NL_EXTRA = {
        /* Nav */
        'tasks':       'Taken',
        'calendar':    'Kalender',
        'notes':       'Notities',
        'whiteboard':  'Tekenbord',
        'grades':      'Cijfers',
        'study_decks': 'Studiekaarten',
        'focus':       'Focus',
        /* Dashboard */
        'ql':          'Snelkoppelingen',
        'goals':       'Dagdoelen',
        'up_next':     'Volgende',
        'status':      'Huidige Status',
        'status_txt':  'Klaar om te leren',
        /* Actions */
        'clear_done':  'Voltooid Wissen',
        'new_deck':    'Nieuw Pakket',
        'import':      'Importeren',
        'clear':       'Wissen',
        'sync_url':    'Kalender URL',
        'remove_sync': 'Alles Verwijderen',
        'open_tab':    'Open in Tabblad',
        /* Greeting */
        'good_morning':'Goedemorgen',
        'good_afternoon':'Goedemiddag',
        'good_evening':'Goedenavond',
    };

    function _applyNL() {
        /* Update all [data-i18n] elements */
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (NL_EXTRA[key]) el.textContent = NL_EXTRA[key];
        });
        /* Update greeting */
        const greet = document.getElementById('dash-greeting');
        if (greet) {
            const h = new Date().getHours();
            if (h < 12)      greet.textContent = 'Goedemorgen';
            else if (h < 18) greet.textContent = 'Goedemiddag';
            else             greet.textContent = 'Goedenavond';
        }
    }

    /* Patch setLanguage to apply extra NL strings */
    function _tryPatch() {
        if (typeof window.setLanguage === 'function') {
            const _orig = window.setLanguage;
            window.setLanguage = function(lang) {
                _orig(lang);
                if (lang === 'nl') setTimeout(_applyNL, 50);
            };
            /* Apply if already NL */
            const saved = localStorage.getItem('os_lang');
            if (saved === 'nl') setTimeout(_applyNL, 200);
        } else {
            setTimeout(_tryPatch, 200);
        }
    }
    _tryPatch();
})();

/* ================================================================
   5. EDIT SUBJECTS IN GRADES
   ================================================================ */
(function patchEditSubjects() {
    /* Inject "Edit" button next to each subject card */
    function _patchSubjectCards() {
        document.querySelectorAll('[data-subject-id]').forEach(card => {
            if (card.querySelector('.subject-edit-btn')) return;
            const sid  = card.getAttribute('data-subject-id');
            const btn  = document.createElement('button');
            btn.className = 'subject-edit-btn';
            btn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            btn.title     = 'Vak bewerken';
            btn.style.cssText = `
                position:absolute;top:10px;right:10px;
                background:transparent;border:none;cursor:pointer;
                color:var(--text-muted);font-size:.75rem;padding:4px 6px;
                border-radius:6px;transition:color .15s,background .15s;
                opacity:0;transition:opacity .15s, color .15s, background .15s;
            `;
            btn.onclick = e => { e.stopPropagation(); _openEditSubject(sid); };
            card.style.position = 'relative';
            card.appendChild(btn);
            card.addEventListener('mouseenter', () => btn.style.opacity = '1');
            card.addEventListener('mouseleave', () => btn.style.opacity = '0');
        });
    }

    function _openEditSubject(sid) {
        const subjects = JSON.parse(localStorage.getItem('os_subjects') || '[]');
        const s = subjects.find(x => x.id === sid);
        if (!s) return;
        const newName = prompt('Nieuw vaknaam:', s.name);
        if (!newName || !newName.trim() || newName.trim() === s.name) return;
        const updated = subjects.map(x => x.id === sid ? { ...x, name: newName.trim() } : x);
        localStorage.setItem('os_subjects', JSON.stringify(updated));
        /* Trigger a re-render if the function exists */
        if (typeof window.renderSubjects === 'function') window.renderSubjects();
        else if (typeof window.initGrades === 'function') window.initGrades();
        else location.reload();
    }

    /* Watch for grade view to appear and patch */
    const obs = new MutationObserver(() => {
        if (!document.getElementById('subjects-container')) return;
        _patchSubjectCards();
    });
    obs.observe(document.body, { childList: true, subtree: true });
})();

/* ================================================================
   6. KATEX MATH RENDERING IN FORMULAS
   Supports both $inline$ and $$display$$ syntax in formula bodies
   ================================================================ */
window.renderMathInFormulas = function() {
    if (typeof window.katex === 'undefined') {
        /* KaTeX not loaded yet, retry */
        setTimeout(window.renderMathInFormulas, 300);
        return;
    }
    document.querySelectorAll('.formula-body').forEach(el => {
        if (el.dataset.mathRendered === 'true') return;
        const raw = el.textContent;
        let html = _escapeForMath(raw);

        /* $$...$$ display math */
        html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
            try {
                return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
            } catch(e) { return _; }
        });
        /* $...$ inline math */
        html = html.replace(/\$([^\n$]+?)\$/g, (_, expr) => {
            try {
                return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
            } catch(e) { return _; }
        });

        if (html !== _escapeForMath(raw)) {
            el.innerHTML = html;
            el.dataset.mathRendered = 'true';
        }
    });
};

function _escapeForMath(str) {
    return str
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
}

/* Patch renderFormulas to auto-render math after each render */
(function patchFormulaMath() {
    function _try() {
        if (typeof window.renderFormulas === 'function') {
            const _orig = window.renderFormulas;
            window._origRenderFormulas = _orig;
            window.renderFormulas = function(...args) {
                _orig(...args);
                setTimeout(window.renderMathInFormulas, 50);
            };
        } else {
            setTimeout(_try, 200);
        }
    }
    _try();
})();


/* ================================================================
   8. MOBILE NAV — add missing tabs + active state improvements
   ================================================================ */
(function patchMobileNav() {
    const style = document.createElement('style');
    style.textContent = `
        /* Mobile nav height custom property */
        :root { --mob-nav-h: 74px; }

        /* Improved mobile nav */
        #mobile-nav {
            padding-bottom: max(env(safe-area-inset-bottom), 6px) !important;
        }
        .mob-nav-btn.active {
            color: var(--accent) !important;
        }
        .mob-nav-btn.active i {
            filter: drop-shadow(0 0 5px var(--accent)) !important;
        }

        /* Drawer layout — 2 column proper grid */
        #mob-more-drawer.open {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
        }
        .mbd-label {
            font-size: .6rem;
            font-weight: 800;
            letter-spacing: .1em;
            text-transform: uppercase;
            color: var(--text-muted);
            padding: 0 2px;
        }
        .mbd-featured {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .mbd-feat {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 7px;
            padding: 16px 10px;
            border-radius: 16px;
            background: color-mix(in srgb, var(--c) 12%, transparent);
            border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
            color: var(--c);
            cursor: pointer;
            transition: all .15s;
        }
        .mbd-feat:hover, .mbd-feat.active {
            background: color-mix(in srgb, var(--c) 22%, transparent);
        }
        .mbd-feat-icon {
            width: 40px; height: 40px;
            border-radius: 12px;
            background: color-mix(in srgb, var(--c) 18%, transparent);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem;
        }
        .mbd-feat-name {
            font-size: .72rem;
            font-weight: 700;
        }
        .mbd-tools {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }
        .mbd-tool {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            padding: 12px 8px;
            border-radius: 12px;
            background: color-mix(in srgb, var(--c, #6b7280) 10%, transparent);
            border: 1px solid color-mix(in srgb, var(--c, #6b7280) 20%, transparent);
            color: color-mix(in srgb, var(--c, var(--text-muted)) 90%, var(--text-muted));
            cursor: pointer;
            transition: all .15s;
            font-size: .65rem;
            font-weight: 700;
        }
        .mbd-tool.active {
            background: color-mix(in srgb, var(--c) 20%, transparent);
        }
        .mbd-tool-icon { font-size: 1.1rem; }
        .mbd-tool-name { font-size: .65rem; font-weight: 700; }
        .mbd-divider { height: 1px; background: rgba(255,255,255,.07); }
        .mbd-account {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }
        .mbd-account-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            padding: 12px 8px;
            border-radius: 12px;
            background: var(--glass-panel);
            border: 1px solid rgba(255,255,255,.07);
            color: var(--text-muted);
            cursor: pointer;
            font-size: .65rem;
            font-weight: 700;
            transition: all .15s;
        }
        .mbd-acct-icon {
            width: 32px; height: 32px;
            border-radius: 10px;
            background: color-mix(in srgb, var(--c) 15%, transparent);
            color: var(--c);
            display: flex; align-items: center; justify-content: center;
            font-size: .9rem;
        }
        .mbd-acct-logout { color: #f87171 !important; }
        .mbd-acct-logout:hover { background: rgba(239,68,68,.1) !important; }

        /* Backdrop */
        #mob-drawer-backdrop {
            display: none;
            background: rgba(0,0,0,.5);
            backdrop-filter: blur(4px);
        }
        #mob-drawer-backdrop.open {
            display: block !important;
        }

        /* Active indicator on More button */
        #mob-btn-more.open i {
            transform: rotate(45deg);
        }
        #mob-btn-more i { transition: transform .2s; }
    `;
    document.head.appendChild(style);
})();

/* ================================================================
   9. CONSISTENT TAB TITLES (music, formulas, forum)
   ================================================================ */
(function patchTabTitles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Unify all tab headers */
        .music-page-header h1,
        .formula-topbar h1,
        .forum-topbar h1 {
            font-size: 1.8rem !important;
            font-weight: 300 !important;
            letter-spacing: -.03em !important;
        }
        .music-page-header h1 span,
        .formula-topbar h1 span,
        .forum-topbar h1 span {
            color: var(--accent) !important;
        }

        /* Music section label spacing */
        .music-section-label {
            margin-top: 6px !important;
        }
    `;
    document.head.appendChild(style);
})();

/* ================================================================
   10. FORMULA TAB — subject bar matches formula pill style
   ================================================================ */
(function patchFormulaSubjects() {
    /* Ensure "Wiskunde" label is also used when in NL */
    const saved = localStorage.getItem('os_lang');
    if (saved !== 'nl') return;
    setTimeout(() => {
        document.querySelectorAll('#formula-subject-bar .formula-pill').forEach(pill => {
            const map = {
                'Mathematics': 'Wiskunde',
                'Physics':     'Fysica',
                'Chemistry':   'Scheikunde',
                'Biology':     'Biologie',
                'History':     'Geschiedenis',
                'Geography':   'Aardrijkskunde',
                'English':     'Engels',
                'Dutch':       'Nederlands',
                'Science':     'Wetenschappen',
            };
            const text = pill.textContent.trim();
            if (map[text]) pill.textContent = map[text];
        });
    }, 500);
})();

/* ================================================================
   11. AUTO-SAVE: ENTER on reply textarea (Ctrl+Enter already in forum.js,
       but also patch the enter key on bare-inputs that have pending saves)
   ================================================================ */
(function patchBareInputs() {
    /* Make sure grade subject-name saves on Enter */
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const target = e.target;
        /* Subject input in grades modal */
        if (target.id === 'subject-name') {
            e.preventDefault();
            if (typeof window.saveSubject === 'function') window.saveSubject();
        }
        /* Note group */
        if (target.id === 'note-group-name') {
            e.preventDefault();
            if (typeof window.saveNoteGroup === 'function') window.saveNoteGroup();
        }
    });
})();

/* ================================================================
   12. FORMULA MODAL: ensure subject field suggests known subjects
   ================================================================ */
(function patchFormulaSubjectAutocomplete() {
    function _addDatalist() {
        const inp = document.getElementById('formula-modal-subject');
        if (!inp || inp.getAttribute('list')) return;
        const listId = 'formula-subject-list';
        let dl = document.getElementById(listId);
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = listId;
            document.body.appendChild(dl);
        }
        inp.setAttribute('list', listId);

        function _populate() {
            const subjects = JSON.parse(localStorage.getItem('os_subjects') || '[]');
            const existing = JSON.parse(localStorage.getItem('os_formulas') || '[]')
                .map(f => f.subject).filter(Boolean);
            const all = [...new Set([...subjects.map(s=>s.name), ...existing])];
            dl.innerHTML = all.map(s => `<option value="${s}">`).join('');
        }

        inp.addEventListener('focus', _populate);
        _populate();
    }

    const obs = new MutationObserver(() => {
        const modal = document.getElementById('modal-formula');
        if (modal && !modal.classList.contains('hidden')) _addDatalist();
    });
    obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
})();

/* ================================================================
   END patches.js
   ================================================================ */
console.log('[StudentOS patches] Loaded ✓');
