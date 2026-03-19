/* ================================================================
   StudentOS — patches12.js
   ================================================================
   FIXES:
   1. Formula subject pills — MutationObserver intercept (the only
      reliable fix since renderFormulaSubjectBar is a private closure
      inside features.js that we cannot override on window)
   2. Dashboard drag & drop — re-bind listeners whenever new widget-
      items are added (fixes weather/quote/habits/today widgets)
   3. Search moved to sidebar (magnifying glass nav button)
   4. Hide the p11 dashboard header search trigger

   NEW SETTINGS (injected into the p10 settings tab):
   5. Personalisation page — custom greeting, clock 12/24h,
      hide clock, dashboard layout density, status message,
      confetti on task complete, card border radius slider,
      custom CSS textarea, sidebar accent, hide streak pill
   ================================================================ */

/* ── Helpers ── */
const _p12 = {
    lsG: (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
    lsS: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    dbG: (k, d) => window.DB?.get?.(k, d) ?? (() => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } })(),
    dbS: (k, v) => { if (window.DB?.set) window.DB.set(k, v); else { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } },
};

/* ================================================================
   1. FORMULA SUBJECT PILLS — MutationObserver intercept
   features.js renders the bar from os_subjects (school grades).
   We watch the DOM and immediately replace the pills each time.
   ================================================================ */
const P12_SUBJECTS = [
    { id: 'all',       name: 'All',        icon: 'ph-squares-four',    color: '#6b7280' },
    { id: 'Math',      name: 'Math',        icon: 'ph-math-operations', color: '#3b82f6' },
    { id: 'Physics',   name: 'Physics',     icon: 'ph-atom',            color: '#8b5cf6' },
    { id: 'Chemistry', name: 'Chemistry',   icon: 'ph-flask',           color: '#22c55e' },
    { id: 'Biology',   name: 'Biology',     icon: 'ph-dna',             color: '#f59e0b' },
    { id: 'Economics', name: 'Economics',   icon: 'ph-chart-line-up',   color: '#ec4899' },
    { id: 'Other',     name: 'Other',       icon: 'ph-question',        color: '#6b7280' },
];

// Track active subject ourselves — independent of features.js _fSubject
window._p12_activeSubj = 'all';
// Flag to prevent feedback loop when we write to the bar
let _p12_barWriting = false;
let _p12_subjectBarObs = null;

function _p12buildSubjectBar(bar) {
    const items = _p12.dbG('os_formulas', []);
    const counts = {};
    items.forEach(f => { if (f.subject) counts[f.subject] = (counts[f.subject] || 0) + 1; });

    if (_p12_subjectBarObs) _p12_subjectBarObs.disconnect();
    bar.innerHTML = P12_SUBJECTS.map(s => {
        const active = window._p12_activeSubj === s.id;
        const count  = s.id === 'all' ? items.length : (counts[s.id] || 0);
        return `<button class="formula-pill${active ? ' active' : ''}"
                         data-subj="${s.id}"
                         onclick="_p12setSubj('${s.id}')"
                         style="${active ? '' : `--pill-c:${s.color}`}">
            <i class="ph ${s.icon}" style="${active ? '' : `color:${s.color}`}"></i>
            ${s.name}${count > 0 ? `<span style="opacity:.55;font-size:.64rem;margin-left:2px;">${count}</span>` : ''}
        </button>`;
    }).join('');
    if (_p12_subjectBarObs) _p12_subjectBarObs.observe(bar, { childList: true });
}

window._p12setSubj = function(subj) {
    window._p12_activeSubj = subj;
    // Rebuild bar (controlled)
    const bar = document.getElementById('formula-subject-bar');
    if (bar) _p12buildSubjectBar(bar);
    // Filter formula list — call features.js formulaSetSubject which sets
    // its internal _fSubject and calls renderFormulas()
    if (typeof window.formulaSetSubject === 'function') {
        window.formulaSetSubject(subj);
    } else if (typeof window.renderFormulas === 'function') {
        window.renderFormulas();
    }
    // After features.js re-renders the bar (which we now intercept), rebuild
    setTimeout(() => {
        const b = document.getElementById('formula-subject-bar');
        if (b) _p12buildSubjectBar(b);
    }, 20);
};

function _p12watchSubjectBar() {
    function _attach() {
        const bar = document.getElementById('formula-subject-bar');
        if (!bar) { setTimeout(_attach, 400); return; }

        // Initial build
        _p12buildSubjectBar(bar);

        _p12_subjectBarObs = new MutationObserver(() => {
            _p12buildSubjectBar(bar);
        });
        _p12_subjectBarObs.observe(bar, { childList: true });
    }
    _attach();

    // Also patch formulaSetSubject to keep our bar in sync
    function _patchFSS() {
        if (typeof window.formulaSetSubject !== 'function') { setTimeout(_patchFSS, 400); return; }
        if (window._p12_fssPatch) return;
        window._p12_fssPatch = true;
        const _orig = window.formulaSetSubject;
        window.formulaSetSubject = function(subj) {
            // Update our state to stay in sync when called externally
            window._p12_activeSubj = subj;
            _orig(subj);
            // Re-impose our bar after features.js renders it
            setTimeout(() => {
                const b = document.getElementById('formula-subject-bar');
                if (b) _p12buildSubjectBar(b);
            }, 15);
        };
    }
    _patchFSS();

    // Also hook initFormulas which is called when the formulas tab opens
    function _patchInit() {
        if (typeof window.initFormulas !== 'function') { setTimeout(_patchInit, 400); return; }
        if (window._p12_initPatch) return;
        window._p12_initPatch = true;
        const _orig = window.initFormulas;
        window.initFormulas = function() {
            _orig();
            setTimeout(() => {
                const b = document.getElementById('formula-subject-bar');
                if (b) _p12buildSubjectBar(b);
            }, 20);
        };
    }
    _patchInit();
}

/* ================================================================
   2. DRAG & DROP — re-bind to all .widget-item including late ones
   ================================================================ */
let _p12_dragSrc = null;

function _p12bindDrag(widget) {
    if (widget.dataset.p12drag) return; // already bound
    widget.dataset.p12drag = '1';
    widget.draggable = true;

    widget.addEventListener('dragstart', function(e) {
        _p12_dragSrc = this;
        this.classList.add('widget-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.id || '');
    });
    widget.addEventListener('dragend', function() {
        this.classList.remove('widget-dragging');
        document.querySelectorAll('.widget-item').forEach(x => x.classList.remove('widget-drag-over'));
        _p12_dragSrc = null;
        _p12saveWidgetOrder();
    });
    widget.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('widget-drag-over');
    });
    widget.addEventListener('dragleave', function() {
        this.classList.remove('widget-drag-over');
    });
    widget.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('widget-drag-over');
        if (!_p12_dragSrc || _p12_dragSrc === this) return;
        const grid = this.parentNode;
        const els  = Array.from(grid.children);
        const si   = els.indexOf(_p12_dragSrc);
        const ti   = els.indexOf(this);
        if (si < ti) grid.insertBefore(_p12_dragSrc, this.nextSibling);
        else         grid.insertBefore(_p12_dragSrc, this);
        _p12saveWidgetOrder();
    });
}

function _p12bindAllWidgets() {
    document.querySelectorAll('.widget-item').forEach(_p12bindDrag);
}

function _p12saveWidgetOrder() {
    const grid = document.getElementById('widgets-grid');
    if (!grid) return;
    const order = Array.from(grid.children)
        .map(el => el.id)
        .filter(Boolean);
    _p12.lsS('p12_widget_order', order);
}

function _p12restoreWidgetOrder() {
    const order = _p12.lsG('p12_widget_order', null);
    if (!order || !order.length) return;
    const grid = document.getElementById('widgets-grid');
    if (!grid) return;
    order.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentNode === grid) grid.appendChild(el);
    });
}

function _p12watchNewWidgets() {
    const grid = document.getElementById('widgets-grid');
    if (!grid) { setTimeout(_p12watchNewWidgets, 400); return; }
    // Bind existing
    _p12bindAllWidgets();
    // Watch for new ones
    const obs = new MutationObserver(() => _p12bindAllWidgets());
    obs.observe(grid, { childList: true });
}

/* ================================================================
   3. SIDEBAR SEARCH BUTTON
   ================================================================ */
function _p12injectSidebarSearch() {
    if (document.getElementById('p12-nav-search')) return;
    // Find sidebar nav top section (right below profile button)
    const profileWrap = document.querySelector('nav .mb-8');
    if (!profileWrap) return;

    const btn = document.createElement('button');
    btn.id = 'p12-nav-search';
    btn.title = 'Search';
    btn.innerHTML = '<i class="ph ph-magnifying-glass" style="font-size:1.2rem;"></i>';
    btn.onclick = () => {
        if (typeof window._p11openSearch === 'function') window._p11openSearch();
        else {
            // Fallback: dispatch Ctrl+K
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        }
    };

    // Insert right after the profile wrap (above nav buttons)
    const navBtnsDiv = profileWrap.nextElementSibling;
    profileWrap.parentNode.insertBefore(btn, navBtnsDiv);
    // Small gap
    btn.style.marginBottom = '4px';
}

/* ================================================================
   4. MORE SETTINGS — inject "Personalise" page into p10 settings tab
   ================================================================ */
function _p12injectPersonaliseSettings() {
    // Wait for p10's settings tab to be built
    function _try() {
        const sidebar  = document.getElementById('p10-stab-sidebar');
        const content  = document.getElementById('p10-stab-content');
        if (!sidebar || !content) { setTimeout(_try, 600); return; }
        if (document.getElementById('p10-page-personalise')) return; // already done

        // Add nav button to sidebar
        const signOutBtn = sidebar.querySelector('[onclick*="logOut"]')?.parentElement;
        const navBtn = document.createElement('button');
        navBtn.className = 'p10-stab-nav-btn';
        navBtn.dataset.page = 'personalise';
        navBtn.setAttribute('onclick', "_p10switchSettingsPage('personalise')");
        navBtn.innerHTML = '<i class="fa-solid fa-sliders"></i> Personalise';
        if (signOutBtn) sidebar.insertBefore(navBtn, signOutBtn);
        else sidebar.appendChild(navBtn);

        // Build the page
        const page = document.createElement('div');
        page.className = 'p10-s-page';
        page.id = 'p10-page-personalise';
        page.innerHTML = _p12personalisePageHTML();
        content.appendChild(page);

        // Load saved values
        _p12syncPersonaliseValues();
    }
    _try();
}

function _p12personalisePageHTML() {
    return `
    <div class="p10-page-title">Personalise <span>Your Space</span></div>

    <div class="p10-section">
        <div class="p10-section-title">Dashboard</div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Custom Greeting Name</div><div class="p10-row-sub">Shown in "Good morning, …" (leave blank to use profile name)</div></div>
            <input id="p12-greeting-name" type="text" class="p10-input" placeholder="e.g. Lars"
                   style="width:140px;text-align:right;"
                   oninput="_p12applyGreetingName(this.value)">
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Custom Status Message</div><div class="p10-row-sub">Replaces "Ready to learn"</div></div>
            <input id="p12-status-msg" type="text" class="p10-input" placeholder="e.g. Locked in 🔒"
                   style="width:160px;text-align:right;"
                   oninput="_p12applyStatusMsg(this.value)">
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Clock Format</div></div>
            <select id="p12-clock-fmt" class="p10-select" onchange="_p12applyClockFormat(this.value)">
                <option value="24">24-hour (19:32)</option>
                <option value="12">12-hour (7:32 PM)</option>
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Hide Clock</div><div class="p10-row-sub">Show only greeting & date</div></div>
            <div id="p12-hide-clock-toggle" class="p10-toggle" onclick="_p12toggleHideClock()"></div>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Hide Streak Pill</div><div class="p10-row-sub">Remove the streak counter from dashboard</div></div>
            <div id="p12-hide-streak-toggle" class="p10-toggle" onclick="_p12toggleHideStreak()"></div>
        </div>
    </div>

    <div class="p10-section">
        <div class="p10-section-title">Style</div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Card Border Radius</div><div class="p10-row-sub">Roundness of all cards and panels</div></div>
            <div style="display:flex;align-items:center;gap:10px;">
                <input type="range" id="p12-radius-range" min="8" max="28" value="20" step="2"
                       oninput="_p12applyRadius(this.value);document.getElementById('p12-radius-val').textContent=this.value+'px'"
                       style="width:100px;accent-color:var(--accent);">
                <span id="p12-radius-val" style="font-size:.78rem;color:var(--text-muted);width:32px;">20px</span>
            </div>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Sidebar Position</div></div>
            <select id="p12-sidebar-pos" class="p10-select" onchange="_p12applySidebarPos(this.value)">
                <option value="left">Left (default)</option>
                <option value="right">Right</option>
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Nav Icon Size</div></div>
            <select id="p12-nav-size" class="p10-select" onchange="_p12applyNavSize(this.value)">
                <option value="sm">Small (40px)</option>
                <option value="md">Medium (44px)</option>
                <option value="lg">Large (50px)</option>
            </select>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Widget Gap</div><div class="p10-row-sub">Space between dashboard widgets</div></div>
            <select id="p12-widget-gap" class="p10-select" onchange="_p12applyWidgetGap(this.value)">
                <option value="tight">Tight (8px)</option>
                <option value="normal">Normal (16px)</option>
                <option value="relaxed">Relaxed (24px)</option>
            </select>
        </div>
    </div>

    <div class="p10-section">
        <div class="p10-section-title">Behaviour</div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Confetti on Task Complete</div><div class="p10-row-sub">🎉 Celebrate when you finish a task</div></div>
            <div id="p12-confetti-task-toggle" class="p10-toggle" onclick="_p12toggleTaskConfetti()"></div>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Confirm Before Deleting Tasks</div><div class="p10-row-sub">Show a modal before removing a task</div></div>
            <div id="p12-confirm-task-toggle" class="p10-toggle" onclick="_p12toggleConfirmTask()"></div>
        </div>
        <div class="p10-row">
            <div><div class="p10-row-lbl">Auto-save Notes</div><div class="p10-row-sub">Save automatically while you type</div></div>
            <div id="p12-autosave-toggle" class="p10-toggle on" onclick="_p12toggleAutosave()"></div>
        </div>
    </div>

    <div class="p10-section" style="padding-bottom:16px;">
        <div class="p10-section-title">Custom CSS</div>
        <div style="padding:10px 0 4px;">
            <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:10px;line-height:1.6;">
                Write any CSS to further customise StudentOS. Applied instantly.
            </div>
            <textarea class="p12-custom-css-area" id="p12-custom-css"
                      placeholder="/* e.g. */&#10;.min-card { border-radius: 8px !important; }&#10;#clock-time { font-style: italic; }"
                      oninput="_p12applyCustomCSS(this.value)"></textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button class="p10-btn p10-btn-ghost" style="font-size:.78rem;padding:6px 14px;"
                        onclick="document.getElementById('p12-custom-css').value='';_p12applyCustomCSS('')">
                    Clear
                </button>
                <div id="p12-css-status" style="font-size:.72rem;color:var(--text-muted);align-self:center;"></div>
            </div>
        </div>
    </div>
    `;
}

/* ── Apply personalise settings ── */
window._p12applyGreetingName = function(val) {
    _p12.lsS('p12_greeting_name', val);
    // Patch updateGreeting to use our name
    _p12patchGreeting();
    if (typeof window.updateGreeting === 'function') window.updateGreeting();
};

window._p12applyStatusMsg = function(val) {
    _p12.lsS('p12_status_msg', val);
    const el = document.querySelector('[data-i18n="status_txt"]');
    if (el) el.textContent = val || (document.documentElement.lang === 'nl' ? 'Klaar om te leren' : 'Ready to learn');
};

window._p12applyClockFormat = function(val) {
    _p12.lsS('p12_clock_fmt', val);
    _p12patchClock();
};

window._p12toggleHideClock = function() {
    const cur = _p12.lsG('p12_hide_clock', false);
    _p12.lsS('p12_hide_clock', !cur);
    const t = document.getElementById('p12-hide-clock-toggle');
    if (t) t.classList.toggle('on', !cur);
    const cl = document.getElementById('clock-time');
    if (cl) cl.style.display = !cur ? 'none' : '';
};

window._p12toggleHideStreak = function() {
    const cur = _p12.lsG('p12_hide_streak', false);
    _p12.lsS('p12_hide_streak', !cur);
    const t = document.getElementById('p12-hide-streak-toggle');
    if (t) t.classList.toggle('on', !cur);
    // Find streak pill
    const streakPill = document.querySelector('[id="dash-streak"]')?.closest('div.flex');
    if (streakPill) streakPill.style.display = !cur ? 'none' : '';
};

window._p12applyRadius = function(val) {
    _p12.lsS('p12_radius', val);
    let style = document.getElementById('p12-radius-style');
    if (!style) { style = document.createElement('style'); style.id = 'p12-radius-style'; document.head.appendChild(style); }
    style.textContent = `.min-card { border-radius: ${val}px !important; } .modal-panel { border-radius: ${val}px !important; }`;
};

window._p12applySidebarPos = function(val) {
    _p12.lsS('p12_sidebar_pos', val);
    const app = document.getElementById('app') || document.querySelector('.flex.h-full') || document.body.firstElementChild;
    if (!app) return;
    const nav  = app.querySelector('nav');
    const main = app.querySelector('main, #main-scroll');
    if (!nav || !main) return;
    if (val === 'right') {
        app.style.flexDirection = 'row-reverse';
        nav.style.borderRight = 'none';
        nav.style.borderLeft = 'var(--glass-border)';
        // fix tooltip direction
        let s = document.getElementById('p12-sidebar-style');
        if (!s) { s = document.createElement('style'); s.id = 'p12-sidebar-style'; document.head.appendChild(s); }
        s.textContent = `.nav-btn:hover::after { left:auto !important; right:56px !important; }`;
    } else {
        app.style.flexDirection = '';
        nav.style.borderRight = '';
        nav.style.borderLeft = '';
        const s = document.getElementById('p12-sidebar-style');
        if (s) s.remove();
    }
};

window._p12applyNavSize = function(val) {
    _p12.lsS('p12_nav_size', val);
    const sizes = { sm: '40px', md: '44px', lg: '50px' };
    const px = sizes[val] || '44px';
    let s = document.getElementById('p12-navsize-style');
    if (!s) { s = document.createElement('style'); s.id = 'p12-navsize-style'; document.head.appendChild(s); }
    s.textContent = `.nav-btn { width: ${px} !important; height: ${px} !important; } #p12-nav-search { width: ${px} !important; height: ${px} !important; }`;
};

window._p12applyWidgetGap = function(val) {
    _p12.lsS('p12_widget_gap', val);
    const gaps = { tight: '8px', normal: '16px', relaxed: '24px' };
    const gap = gaps[val] || '16px';
    const grid = document.getElementById('widgets-grid');
    if (grid) grid.style.gap = gap;
};

window._p12toggleTaskConfetti = function() {
    const cur = _p12.lsG('p12_confetti_task', false);
    _p12.lsS('p12_confetti_task', !cur);
    const t = document.getElementById('p12-confetti-task-toggle');
    if (t) t.classList.toggle('on', !cur);
    _p12patchTaskComplete();
};

window._p12toggleConfirmTask = function() {
    const cur = _p12.lsG('p12_confirm_task', false);
    _p12.lsS('p12_confirm_task', !cur);
    const t = document.getElementById('p12-confirm-task-toggle');
    if (t) t.classList.toggle('on', !cur);
    _p12patchDeleteTask();
};

window._p12toggleAutosave = function() {
    const cur = _p12.lsG('p12_autosave', true);
    _p12.lsS('p12_autosave', !cur);
    const t = document.getElementById('p12-autosave-toggle');
    if (t) t.classList.toggle('on', !cur);
};

window._p12applyCustomCSS = function(css) {
    _p12.lsS('p12_custom_css', css);
    let style = document.getElementById('p12-custom-style');
    if (!style) { style = document.createElement('style'); style.id = 'p12-custom-style'; document.head.appendChild(style); }
    try {
        style.textContent = css;
        const s = document.getElementById('p12-css-status');
        if (s) { s.textContent = css ? '✓ Applied' : ''; s.style.color = '#22c55e'; }
    } catch {
        const s = document.getElementById('p12-css-status');
        if (s) { s.textContent = '⚠ CSS error'; s.style.color = '#ef4444'; }
    }
};

function _p12syncPersonaliseValues() {
    const gn = document.getElementById('p12-greeting-name');
    if (gn) gn.value = _p12.lsG('p12_greeting_name', '');
    const sm = document.getElementById('p12-status-msg');
    if (sm) sm.value = _p12.lsG('p12_status_msg', '');
    const cf = document.getElementById('p12-clock-fmt');
    if (cf) cf.value = _p12.lsG('p12_clock_fmt', '24');
    const hc = document.getElementById('p12-hide-clock-toggle');
    if (hc) hc.classList.toggle('on', _p12.lsG('p12_hide_clock', false));
    const hs = document.getElementById('p12-hide-streak-toggle');
    if (hs) hs.classList.toggle('on', _p12.lsG('p12_hide_streak', false));
    const rr = document.getElementById('p12-radius-range');
    const rv = document.getElementById('p12-radius-val');
    const radius = _p12.lsG('p12_radius', 20);
    if (rr) rr.value = radius;
    if (rv) rv.textContent = radius + 'px';
    const sp = document.getElementById('p12-sidebar-pos');
    if (sp) sp.value = _p12.lsG('p12_sidebar_pos', 'left');
    const ns = document.getElementById('p12-nav-size');
    if (ns) ns.value = _p12.lsG('p12_nav_size', 'md');
    const wg = document.getElementById('p12-widget-gap');
    if (wg) wg.value = _p12.lsG('p12_widget_gap', 'normal');
    const ct = document.getElementById('p12-confetti-task-toggle');
    if (ct) ct.classList.toggle('on', _p12.lsG('p12_confetti_task', false));
    const cnf = document.getElementById('p12-confirm-task-toggle');
    if (cnf) cnf.classList.toggle('on', _p12.lsG('p12_confirm_task', false));
    const at = document.getElementById('p12-autosave-toggle');
    if (at) at.classList.toggle('on', _p12.lsG('p12_autosave', true));
    const css = document.getElementById('p12-custom-css');
    if (css) css.value = _p12.lsG('p12_custom_css', '');
}

/* ================================================================
   5. APPLY SAVED PERSONALISE SETTINGS ON LOAD
   ================================================================ */
function _p12applyAllSaved() {
    // Custom CSS
    const css = _p12.lsG('p12_custom_css', '');
    if (css) _p12applyCustomCSS(css);

    // Clock format
    _p12patchClock();

    // Greeting name
    _p12patchGreeting();

    // Status msg
    const sm = _p12.lsG('p12_status_msg', '');
    if (sm) {
        setTimeout(() => {
            const el = document.querySelector('[data-i18n="status_txt"]');
            if (el) el.textContent = sm;
        }, 600);
    }

    // Hide clock
    if (_p12.lsG('p12_hide_clock', false)) {
        setTimeout(() => {
            const cl = document.getElementById('clock-time');
            if (cl) cl.style.display = 'none';
        }, 300);
    }

    // Hide streak
    if (_p12.lsG('p12_hide_streak', false)) {
        setTimeout(() => {
            const streak = document.getElementById('dash-streak');
            const pill = streak?.closest('div.flex');
            if (pill) pill.style.display = 'none';
        }, 600);
    }

    // Radius
    const radius = _p12.lsG('p12_radius', null);
    if (radius) _p12applyRadius(radius);

    // Sidebar position
    const sp = _p12.lsG('p12_sidebar_pos', 'left');
    if (sp === 'right') setTimeout(() => _p12applySidebarPos('right'), 300);

    // Nav size
    const ns = _p12.lsG('p12_nav_size', 'md');
    if (ns !== 'md') _p12applyNavSize(ns);

    // Widget gap
    const wg = _p12.lsG('p12_widget_gap', 'normal');
    if (wg !== 'normal') setTimeout(() => _p12applyWidgetGap(wg), 700);

    // Task confetti + confirm task
    _p12patchTaskComplete();
    _p12patchDeleteTask();
}

/* ── Patch updateGreeting to use our custom name ── */
function _p12patchGreeting() {
    if (window._p12_greetingPatched) return;
    function _try() {
        if (typeof window.updateGreeting !== 'function') { setTimeout(_try, 300); return; }
        window._p12_greetingPatched = true;
        const _orig = window.updateGreeting;
        window.updateGreeting = function() {
            _orig();
            const customName = _p12.lsG('p12_greeting_name', '').trim();
            if (!customName) return;
            const h = new Date().getHours();
            const lang = typeof currentLang !== 'undefined' ? currentLang : 'en';
            let greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
            if (lang === 'nl') greet = h < 12 ? 'Goedemorgen' : h < 17 ? 'Goedemiddag' : 'Goedenavond';
            const el = document.getElementById('dash-greeting');
            if (el) el.innerText = `${greet}, ${customName} 👋`;
        };
    }
    _try();
}

/* ── Patch updateClock to support 12h format ── */
function _p12patchClock() {
    if (window._p12_clockPatched) return;
    function _try() {
        if (typeof window.updateClock !== 'function') { setTimeout(_try, 300); return; }
        window._p12_clockPatched = true;
        const _orig = window.updateClock;
        window.updateClock = function() {
            _orig(); // let original run first (sets date, greeting)
            const fmt = _p12.lsG('p12_clock_fmt', '24');
            if (fmt !== '12') return;
            const now = new Date();
            const h = now.getHours(), m = now.getMinutes();
            const hh = h % 12 || 12;
            const ampm = h < 12 ? 'AM' : 'PM';
            const timeStr = `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
            const el = document.getElementById('clock-time');
            if (el) el.innerText = timeStr;
        };
        // Fire immediately
        window.updateClock();
    }
    _try();
}

/* ── Confetti on task complete ── */
function _p12patchTaskComplete() {
    if (!_p12.lsG('p12_confetti_task', false)) return;
    if (window._p12_taskCompletePatched) return;
    function _try() {
        if (typeof window.toggleTask !== 'function') { setTimeout(_try, 400); return; }
        window._p12_taskCompletePatched = true;
        const _orig = window.toggleTask;
        window.toggleTask = function(id) {
            _orig(id);
            // Check if the task is now done
            const tasks = _p12.dbG('os_tasks', []);
            const task = tasks.find(t => t.id === id);
            if (task && task.done) {
                if (typeof window._p11fireConfetti === 'function') window._p11fireConfetti();
            }
        };
    }
    _try();
}

/* ── Confirm before deleting task ── */
let _p12_deleteTaskPatched = false;
function _p12patchDeleteTask() {
    if (!_p12.lsG('p12_confirm_task', false)) return;
    if (_p12_deleteTaskPatched) return;
    function _try() {
        if (typeof window.deleteTask !== 'function') { setTimeout(_try, 400); return; }
        _p12_deleteTaskPatched = true;
        const _orig = window.deleteTask;
        window.deleteTask = async function(id) {
            const confirm = typeof window._p11confirm === 'function'
                ? window._p11confirm
                : (opts) => Promise.resolve(window.confirm(opts.title + '\n' + opts.desc));
            const yes = await confirm({ title: 'Delete Task', desc: 'This task will be permanently removed.', okLabel: 'Delete', iconClass: 'ph-trash', iconColor: '#ef4444' });
            if (yes) _orig(id);
        };
    }
    _try();
}

/* ================================================================
   INIT
   ================================================================ */
function _p12init() {
    // 1. Formula subjects — MutationObserver fix
    _p12watchSubjectBar();

    // 2. Drag & drop — re-bind all widgets including future ones
    setTimeout(() => {
        _p12watchNewWidgets();
        _p12restoreWidgetOrder();
    }, 800);

    // 3. Sidebar search button
    _p12injectSidebarSearch();
    // Retry in case nav wasn't ready
    setTimeout(_p12injectSidebarSearch, 600);

    // 4. More settings (Personalise page)
    _p12injectPersonaliseSettings();
    // Re-try after settings tab is built by p10
    setTimeout(_p12injectPersonaliseSettings, 1200);
    setTimeout(_p12injectPersonaliseSettings, 2500);

    // 5. Apply all saved personalise settings
    _p12applyAllSaved();

// 6. Sync personalise values when settings tab opens
    document.getElementById('btn-settings')?.addEventListener('click', () => setTimeout(_p12syncPersonaliseValues, 300));
    console.log('[patches12] ✓ Light mode · Formula subjects fix · Drag fix · Sidebar search · More settings');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_p12init, 500));
} else {
    setTimeout(_p12init, 500);
}
