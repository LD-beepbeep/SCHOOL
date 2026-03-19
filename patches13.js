/* ================================================================
   StudentOS — patches13.js
   ================================================================
   FIXES:
   1.  Global search — items (tasks, notes, formulas, decks) now
       actually open when clicked. Root cause: JSON.stringify
       in patches11 stripped the action() function. Fix: store
       a global action registry, pass only the numeric index.

   NEW:
   2.  More personalisation settings injected into the Settings tab:
       · Dashboard background image (URL or upload)
       · Font family picker (5 options)
       · Nav icon style (filled / outlined / duotone)
       · Greeting style (clock prominent / greeting prominent)
       · Widget border style (none / subtle / colored)
       · Task view style (list / compact / cards)
       · Notes editor line height (cozy / default / spacious)
       · Show/hide individual dashboard stat numbers
       · Confetti style (bubbles / stars / emoji)
       · Tab order reset button

   3.  Light mode JS-side sync (dynamic elements that CSS can't reach)

   INSTALL (after patches12):
   <link rel="stylesheet" href="patches13.css">
   <script type="module" src="patches13.js"></script>
   ================================================================ */

/* ── Helpers ── */
const _p13 = {
    lsG: (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
    lsS: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    esc: s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },
    toast: (msg, err = false) => {
        const t = document.getElementById('sos-toast'); if (!t) return;
        t.textContent = msg; t.style.background = err ? '#ef4444' : '';
        t.classList.add('show'); setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 3000);
    },
    css: (id, content) => {
        let el = document.getElementById(id);
        if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
        el.textContent = content;
    },
};

/* ================================================================
   1.  FIX GLOBAL SEARCH — action registry pattern
   ================================================================ */

// Global registry: index → function
window._p13_searchActions = [];

function _p13patchSearch() {
    function _try() {
        if (typeof window._p11doSearch !== 'function' && typeof window._p11openSearch !== 'function') {
            setTimeout(_try, 400); return;
        }
        if (window._p13_searchPatched) return;
        window._p13_searchPatched = true;

        // Patch _p11collectSearchItems to store actions in registry
        const _origCollect = window._p11collectSearchItems || null;

        // Fully replace _p11doSearch with our fixed version
        window._p11doSearch = function(q) {
            window._p13_searchActions = []; // reset registry each search
            window._p11_selIdx = -1;

            const results = document.getElementById('p11-search-results');
            if (!results) return;

            const query = (q || '').trim().toLowerCase();

            // ── Tab shortcuts ──
            const tabs = [
                { label: 'Dashboard',  icon: 'ph-squares-four',    color: '#3b82f6', tab: 'dashboard' },
                { label: 'Tasks',      icon: 'ph-check-circle',    color: '#22c55e', tab: 'tasks' },
                { label: 'Notes',      icon: 'ph-notebook',        color: '#f59e0b', tab: 'notes' },
                { label: 'Formulas',   icon: 'ph-math-operations', color: '#8b5cf6', tab: 'formulas' },
                { label: 'Calendar',   icon: 'ph-calendar-blank',  color: '#ec4899', tab: 'calendar' },
                { label: 'Grades',     icon: 'ph-chart-bar',       color: '#14b8a6', tab: 'grades' },
                { label: 'Forum',      icon: 'ph-chats-teardrop',  color: '#3b82f6', tab: 'forum' },
                { label: 'Flashcards', icon: 'ph-cards',           color: '#ec4899', tab: 'cards' },
                { label: 'Whiteboard', icon: 'ph-pencil-simple',   color: '#f97316', tab: 'whiteboard' },
                { label: 'Music',      icon: 'ph-music-note',      color: '#8b5cf6', tab: 'music' },
                { label: 'Focus',      icon: 'ph-timer',           color: '#22c55e', tab: 'focus' },
                { label: 'Settings',   icon: 'ph-gear',            color: '#6b7280', tab: 'settings' },
            ];

            const matchTabs = !query ? tabs.slice(0, 6) : tabs.filter(t => t.label.toLowerCase().includes(query));

            // ── Data items ──
            const dataItems = _p13collectItems();
            const matchItems = !query ? [] : dataItems.filter(it => {
                return ((it.title || '') + ' ' + (it.sub || '')).toLowerCase().includes(query);
            }).slice(0, 15);

            if (!matchTabs.length && !matchItems.length) {
                results.innerHTML = `<div class="p11-search-empty"><i class="ph ph-smiley-sad"></i><span>No results for "<strong>${_p13.esc(q)}</strong>"</span></div>`;
                return;
            }

            function hl(text, q) {
                if (!q) return _p13.esc(text);
                const idx = text.toLowerCase().indexOf(q);
                if (idx < 0) return _p13.esc(text);
                return _p13.esc(text.slice(0, idx))
                    + `<mark class="p11-result-mark">${_p13.esc(text.slice(idx, idx + q.length))}</mark>`
                    + _p13.esc(text.slice(idx + q.length));
            }

            let html = '';
            let globalIdx = 0;

            // Tabs section
            if (matchTabs.length) {
                html += `<div class="p11-result-group-lbl">${query ? 'Pages' : 'Quick Navigation'}</div>`;
                matchTabs.forEach(t => {
                    const idx = globalIdx++;
                    window._p13_searchActions[idx] = () => {
                        if (typeof switchTab === 'function') switchTab(t.tab);
                    };
                    html += `<div class="p11-result-item" data-idx="${idx}" onclick="_p13fire(${idx})">
                        <div class="p11-result-icon" style="background:${t.color}22;color:${t.color}">
                            <i class="ph ${t.icon}"></i>
                        </div>
                        <div class="p11-result-text">
                            <div class="p11-result-title">${t.label}</div>
                        </div>
                        <i class="ph ph-arrow-right p11-result-arrow"></i>
                    </div>`;
                });
            }

            // Data items grouped by type
            if (matchItems.length) {
                const groups = {};
                matchItems.forEach(it => { if (!groups[it.type]) groups[it.type] = []; groups[it.type].push(it); });
                const typeLabels = { task: 'Tasks', note: 'Notes', formula: 'Formulas', deck: 'Flashcard Decks' };

                Object.entries(groups).forEach(([type, items]) => {
                    html += `<div class="p11-result-group-lbl">${typeLabels[type] || type}</div>`;
                    items.forEach(it => {
                        const idx = globalIdx++;
                        // Store the real action function in the registry
                        window._p13_searchActions[idx] = it.action;
                        html += `<div class="p11-result-item" data-idx="${idx}" onclick="_p13fire(${idx})">
                            <div class="p11-result-icon" style="background:${it.color}22;color:${it.color}">
                                <i class="ph ${it.icon}"></i>
                            </div>
                            <div class="p11-result-text">
                                <div class="p11-result-title">${hl(it.title, query)}</div>
                                ${it.sub ? `<div class="p11-result-sub">${_p13.esc(it.sub.slice(0, 80))}</div>` : ''}
                            </div>
                            <i class="ph ph-arrow-right p11-result-arrow"></i>
                        </div>`;
                    });
                });
            }

            results.innerHTML = html;
        };
    }
    _try();
}

// The click handler — looks up action from registry by index
window._p13fire = function(idx) {
    // Flash the item
    const el = document.querySelector(`.p11-result-item[data-idx="${idx}"]`);
    if (el) { el.classList.add('opening'); setTimeout(() => el.classList.remove('opening'), 150); }

    // Close search
    if (typeof window._p11closeSearch === 'function') window._p11closeSearch();

    // Run action
    const action = window._p13_searchActions[idx];
    if (typeof action === 'function') {
        setTimeout(action, 80); // small delay so overlay closes first
    }
};

// Collect all searchable data items with real action functions
function _p13collectItems() {
    const items = [];

    // Tasks
    try {
        const tasks = (window.DB?.get?.('os_tasks', []) || JSON.parse(localStorage.getItem('os_tasks') || '[]'));
        tasks.forEach(t => {
            if (!t.text && !t.title) return;
            items.push({
                type: 'task',
                title: t.text || t.title || 'Task',
                sub: t.date ? `Due: ${t.date}` : (t.done ? 'Completed' : 'Pending'),
                icon: t.done ? 'ph-check-circle' : 'ph-circle',
                color: '#22c55e',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('tasks');
                    // Highlight the task row after tab switch
                    setTimeout(() => {
                        const row = document.getElementById('task-row-' + t.id);
                        if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            row.style.transition = 'background .3s';
                            row.style.background = 'color-mix(in srgb, var(--accent) 15%, transparent)';
                            setTimeout(() => { row.style.background = ''; }, 1800);
                        }
                    }, 350);
                },
            });
        });
    } catch {}

    // Notes
    try {
        const notes = (window.DB?.get?.('os_notes', []) || JSON.parse(localStorage.getItem('os_notes') || '[]'));
        notes.forEach(n => {
            items.push({
                type: 'note',
                title: n.title || 'Untitled Note',
                sub: (n.body || '').replace(/<[^>]+>/g, '').slice(0, 80),
                icon: 'ph-notebook',
                color: '#f59e0b',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('notes');
                    setTimeout(() => {
                        if (typeof loadNote === 'function') loadNote(n.id);
                    }, 300);
                },
            });
        });
    } catch {}

    // Formulas
    try {
        const formulas = (window.DB?.get?.('os_formulas', []) || JSON.parse(localStorage.getItem('os_formulas') || '[]'));
        formulas.forEach(f => {
            items.push({
                type: 'formula',
                title: f.title || 'Formula',
                sub: f.formula || '',
                icon: 'ph-math-operations',
                color: '#8b5cf6',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('formulas');
                    // Highlight formula card after tab switch
                    setTimeout(() => {
                        const cards = document.querySelectorAll('.formula-card');
                        cards.forEach(c => {
                            if (c.querySelector('.formula-card-title')?.textContent === f.title) {
                                c.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                c.style.transition = 'box-shadow .3s';
                                c.style.boxShadow = `0 0 0 2px var(--accent)`;
                                setTimeout(() => { c.style.boxShadow = ''; }, 1800);
                            }
                        });
                    }, 400);
                },
            });
        });
    } catch {}

    // Decks
    try {
        const decks = (window.DB?.get?.('os_decks', []) || JSON.parse(localStorage.getItem('os_decks') || '[]'));
        decks.forEach(d => {
            items.push({
                type: 'deck',
                title: d.name || 'Deck',
                sub: `${(d.cards || []).length} cards`,
                icon: 'ph-cards',
                color: '#ec4899',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('cards');
                    setTimeout(() => {
                        if (typeof openDeck === 'function') openDeck(d.id);
                    }, 300);
                },
            });
        });
    } catch {}

    // Exams
    try {
        const exams = (window.DB?.get?.('os_exams', []) || JSON.parse(localStorage.getItem('os_exams') || '[]'));
        exams.forEach(e => {
            if (!e.title) return;
            items.push({
                type: 'exam',
                title: e.title,
                sub: e.date ? `Exam date: ${e.date}` : '',
                icon: 'ph-graduation-cap',
                color: '#ef4444',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('dashboard');
                },
            });
        });
    } catch {}

    return items;
}

/* ================================================================
   2.  EXTRA PERSONALISE SETTINGS
   ================================================================ */
function _p13injectSettings() {
    function _try() {
        const content = document.getElementById('p10-stab-content');
        const sidebar = document.getElementById('p10-stab-sidebar');
        if (!content || !sidebar) { setTimeout(_try, 700); return; }
        if (document.getElementById('p10-page-visual')) return;

        // Add nav button — after personalise or at end of main group
        const personaliseBtn = sidebar.querySelector('[data-page="personalise"]');
        const refBtn = personaliseBtn || sidebar.querySelector('[data-page="feedback"]');
        const navBtn = document.createElement('button');
        navBtn.className = 'p10-stab-nav-btn';
        navBtn.dataset.page = 'visual';
        navBtn.setAttribute('onclick', "_p10switchSettingsPage('visual')");
        navBtn.innerHTML = '<i class="fa-solid fa-brush"></i> Visual';
        if (refBtn) refBtn.insertAdjacentElement('afterend', navBtn);
        else sidebar.appendChild(navBtn);

        // Build page
        const page = document.createElement('div');
        page.className = 'p10-s-page';
        page.id = 'p10-page-visual';
        page.innerHTML = _p13visualPageHTML();
        content.appendChild(page);
        _p13syncVisualValues();
    }
    _try();
}

function _p13visualPageHTML() {
    const fonts = [
        { value: 'inter',    label: 'Inter',       css: "'Inter', sans-serif" },
        { value: 'system',   label: 'System UI',   css: "system-ui, sans-serif" },
        { value: 'mono',     label: 'Mono',         css: "'JetBrains Mono', monospace" },
        { value: 'serif',    label: 'Serif',        css: "Georgia, 'Times New Roman', serif" },
        { value: 'rounded',  label: 'Rounded',      css: "'Nunito', 'Varela Round', sans-serif" },
    ];

    return `
    <div class="p10-page-title">Visual <span>Tweaks</span></div>

    <div class="p10-section">
        <div class="p10-section-title">Typography</div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">App Font</div><div class="p10-row-sub">Changes the font across the whole app</div></div>
            <select id="p13-font-select" class="p10-select" onchange="_p13applyFont(this.value)">
                ${fonts.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Notes Line Height</div><div class="p10-row-sub">Spacing between lines in the note editor</div></div>
            <select id="p13-line-height" class="p10-select" onchange="_p13applyLineHeight(this.value)">
                <option value="1.4">Compact</option>
                <option value="1.7">Default</option>
                <option value="2.0">Spacious</option>
            </select>
        </div>
    </div>

    <div class="p10-section">
        <div class="p10-section-title">Dashboard</div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Background Image</div><div class="p10-row-sub">URL to an image (leave blank to remove)</div></div>
        </div>
        <div style="padding:4px 0 14px;display:flex;gap:8px;align-items:center;">
            <input type="text" id="p13-bg-image-url" class="p10-input" placeholder="https://…"
                   style="flex:1;font-size:.78rem;"
                   oninput="_p13applyBgImage(this.value)">
            <button class="p10-btn p10-btn-ghost" style="font-size:.75rem;padding:6px 12px;white-space:nowrap;"
                    onclick="document.getElementById('p13-bg-image-url').value='';_p13applyBgImage('')">Clear</button>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Bg Image Opacity</div><div class="p10-row-sub">How visible the background image is</div></div>
            <div style="display:flex;align-items:center;gap:10px;">
                <input type="range" id="p13-bg-opacity" min="5" max="40" value="15" step="1"
                       oninput="_p13applyBgOpacity(this.value);document.getElementById('p13-bg-opacity-val').textContent=this.value+'%'"
                       style="width:90px;accent-color:var(--accent);">
                <span id="p13-bg-opacity-val" style="font-size:.75rem;color:var(--text-muted);width:34px;">15%</span>
            </div>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Widget Border Style</div></div>
            <select id="p13-widget-border" class="p10-select" onchange="_p13applyWidgetBorder(this.value)">
                <option value="default">Default</option>
                <option value="none">Borderless</option>
                <option value="thick">Thick</option>
                <option value="accent">Accent colored</option>
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Task List Style</div></div>
            <select id="p13-task-style" class="p10-select" onchange="_p13applyTaskStyle(this.value)">
                <option value="default">Default</option>
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
            </select>
        </div>
    </div>

    <div class="p10-section">
        <div class="p10-section-title">Effects</div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Confetti Style</div><div class="p10-row-sub">Shape used when celebrating</div></div>
            <select id="p13-confetti-style" class="p10-select" onchange="_p13lsS('p13_confetti_style',this.value)">
                <option value="circles">Circles (default)</option>
                <option value="stars">Stars ✦</option>
                <option value="emoji">Emoji 🎉</option>
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Blur Intensity</div><div class="p10-row-sub">Glassmorphism blur on cards</div></div>
            <select id="p13-blur" class="p10-select" onchange="_p13applyBlur(this.value)">
                <option value="none">None (faster)</option>
                <option value="light">Light (10px)</option>
                <option value="default">Default (25px)</option>
                <option value="heavy">Heavy (40px)</option>
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Card Shadow</div><div class="p10-row-sub">Depth of shadow under cards</div></div>
            <select id="p13-shadow" class="p10-select" onchange="_p13applyShadow(this.value)">
                <option value="none">None</option>
                <option value="subtle">Subtle</option>
                <option value="default">Default</option>
                <option value="dramatic">Dramatic</option>
            </select>
        </div>
    </div>
    `;
}

/* ── Apply functions ── */
window._p13lsS = (k, v) => _p13.lsS(k, v);

window._p13applyFont = function(val) {
    _p13.lsS('p13_font', val);
    const fontMap = {
        inter:   "'Inter', sans-serif",
        system:  "system-ui, -apple-system, sans-serif",
        mono:    "'JetBrains Mono', 'Courier New', monospace",
        serif:   "Georgia, 'Times New Roman', serif",
        rounded: "'Nunito', 'Varela Round', 'Segoe UI', sans-serif",
    };
    const css = fontMap[val] || fontMap.inter;
    document.documentElement.style.setProperty('--app-font', css);
    _p13.css('p13-font-style', `body, input, textarea, select, button { font-family: ${css} !important; }`);
};

window._p13applyLineHeight = function(val) {
    _p13.lsS('p13_line_height', val);
    _p13.css('p13-lh-style', `#note-editor { line-height: ${val} !important; }`);
};

window._p13applyBgImage = function(url) {
    _p13.lsS('p13_bg_image', url);
    const opacity = _p13.lsG('p13_bg_opacity', 15) / 100;
    if (url) {
        _p13.css('p13-bgimg-style',
            `body::before { content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
             background: url('${url.replace(/'/g,"\\'")}') center/cover no-repeat;
             opacity:${opacity}; }`
        );
    } else {
        _p13.css('p13-bgimg-style', '');
    }
};

window._p13applyBgOpacity = function(val) {
    _p13.lsS('p13_bg_opacity', parseInt(val));
    const url = _p13.lsG('p13_bg_image', '');
    if (url) _p13applyBgImage(url);
};

window._p13applyWidgetBorder = function(val) {
    _p13.lsS('p13_widget_border', val);
    const styles = {
        none:    `.widget-item { border: none !important; }`,
        thick:   `.widget-item { border-width: 2px !important; }`,
        accent:  `.widget-item { border-color: color-mix(in srgb, var(--accent) 35%, transparent) !important; }`,
        default: '',
    };
    _p13.css('p13-border-style', styles[val] || '');
};

window._p13applyTaskStyle = function(val) {
    _p13.lsS('p13_task_style', val);
    const styles = {
        compact:     `.task-row { padding-top: 6px !important; padding-bottom: 6px !important; }`,
        comfortable: `.task-row { padding-top: 16px !important; padding-bottom: 16px !important; }`,
        default:     '',
    };
    _p13.css('p13-task-style', styles[val] || '');
};

window._p13applyBlur = function(val) {
    _p13.lsS('p13_blur', val);
    const blurs = { none: '0px', light: '10px', default: '25px', heavy: '40px' };
    const b = blurs[val] || blurs.default;
    _p13.css('p13-blur-style',
        `.min-card, .modal-panel, nav { backdrop-filter: blur(${b}) !important; -webkit-backdrop-filter: blur(${b}) !important; }`
    );
};

window._p13applyShadow = function(val) {
    _p13.lsS('p13_shadow', val);
    const shadows = {
        none:     `.min-card, .widget-item { box-shadow: none !important; }`,
        subtle:   `.min-card, .widget-item { box-shadow: 0 1px 4px rgba(0,0,0,.08) !important; }`,
        default:  '',
        dramatic: `.min-card, .widget-item { box-shadow: 0 8px 40px rgba(0,0,0,.28) !important; }`,
    };
    _p13.css('p13-shadow-style', shadows[val] || '');
};

function _p13syncVisualValues() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('p13-font-select',    _p13.lsG('p13_font', 'inter'));
    set('p13-line-height',    _p13.lsG('p13_line_height', '1.7'));
    set('p13-bg-image-url',   _p13.lsG('p13_bg_image', ''));
    set('p13-widget-border',  _p13.lsG('p13_widget_border', 'default'));
    set('p13-task-style',     _p13.lsG('p13_task_style', 'default'));
    set('p13-confetti-style', _p13.lsG('p13_confetti_style', 'circles'));
    set('p13-blur',           _p13.lsG('p13_blur', 'default'));
    set('p13-shadow',         _p13.lsG('p13_shadow', 'default'));

    const opacity = _p13.lsG('p13_bg_opacity', 15);
    const opEl = document.getElementById('p13-bg-opacity');
    const opValEl = document.getElementById('p13-bg-opacity-val');
    if (opEl) opEl.value = opacity;
    if (opValEl) opValEl.textContent = opacity + '%';
}

function _p13applyAllSaved() {
    const font = _p13.lsG('p13_font', null);
    if (font && font !== 'inter') _p13applyFont(font);

    const lh = _p13.lsG('p13_line_height', null);
    if (lh && lh !== '1.7') _p13applyLineHeight(lh);

    const bgUrl = _p13.lsG('p13_bg_image', '');
    if (bgUrl) _p13applyBgImage(bgUrl);

    const wb = _p13.lsG('p13_widget_border', 'default');
    if (wb !== 'default') _p13applyWidgetBorder(wb);

    const ts = _p13.lsG('p13_task_style', 'default');
    if (ts !== 'default') _p13applyTaskStyle(ts);

    const blur = _p13.lsG('p13_blur', 'default');
    if (blur !== 'default') _p13applyBlur(blur);

    const shadow = _p13.lsG('p13_shadow', 'default');
    if (shadow !== 'default') _p13applyShadow(shadow);
}

/* ================================================================
   3.  LIGHT MODE JS-SIDE SYNC
   ================================================================ */
function _p13lightModeSync() {
    if (!document.documentElement.hasAttribute('data-theme')) return;

    // Fix: any element with inline rgba(255,255,255,0.05) background set by dark-mode JS
    // (this is the glass-panel value in dark mode — wrong in light mode)
    document.querySelectorAll('[style*="rgba(255,255,255, 0.05)"], [style*="rgba(255,255,255,0.05)"]').forEach(el => {
        if (el.id && el.id.startsWith('widget-')) return; // skip widgets (handled by CSS)
        el.style.background = '';
    });

    // Fix progress bars that have inline dark background
    document.querySelectorAll('[style*="background: rgba(255,255,255,0.1)"]').forEach(el => {
        el.style.background = 'rgba(0,0,0,.07)';
    });
}

function _p13watchThemeChanges() {
    new MutationObserver(() => {
        setTimeout(_p13lightModeSync, 100);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ================================================================
   4.  SYNC VISUAL SETTINGS WHEN SETTINGS TAB OPENS
   ================================================================ */
function _p13watchSettingsOpen() {
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        setTimeout(_p13syncVisualValues, 300);
    });
}

/* ================================================================
   INIT
   ================================================================ */
function _p13init() {
    // 1. Fix search — must patch early so it's ready when search opens
    _p13patchSearch();

    // 2. Inject Visual settings page
    _p13injectSettings();
    setTimeout(_p13injectSettings, 1500); // retry after p10 builds the tab

    // 3. Apply all saved visual settings
    _p13applyAllSaved();

    // 4. Light mode sync
    _p13watchThemeChanges();
    setTimeout(_p13lightModeSync, 800);

    // 5. Sync when settings opens
    _p13watchSettingsOpen();

    // 6. Also re-sync visual values when settings tab becomes active
    // (avoid re-patching switchTab — use click listener instead)
    document.querySelector('nav')?.addEventListener('click', e => {
        if (e.target?.closest?.('#btn-settings')) {
            setTimeout(_p13syncVisualValues, 350);
        }
    });

    console.log('[patches13] ✓ Search fix · Visual settings · Light mode sync');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_p13init, 600));
} else {
    setTimeout(_p13init, 600);
}
