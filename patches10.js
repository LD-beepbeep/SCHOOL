/* ================================================================
   StudentOS — patches10.js
   ================================================================
   CHANGES vs patches9:
   1. Settings → proper sidebar tab (not overlay/fullscreen)
      + Profile picture editing integrated inside settings
   2. Location permission modal before requesting geolocation
   3. Formula subject: dropdown with Math/Physics/Chemistry/
      Biology/Economics/Other (instead of free text)
   4. Formula category pills use subject icons & colors
   5. Delete formula → custom modal (no browser confirm())
   6. Kill KaTeX live preview
   7. Bigger quote widget text
   8. Light mode improvements (supplement patches10.css)
   9. More settings options

   INSTALL: add after patches9 in index.html
   <link rel="stylesheet" href="patches10.css">
   <script type="module" src="patches10.js"></script>
   ================================================================ */

/* ── helpers ── */
function _p10esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function _p10lsGet(k,d){try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):d;}catch{return d;}}
function _p10lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function _p10dbGet(k,d){return(window.DB&&typeof window.DB.get==='function')?window.DB.get(k,d):_p10lsGet(k,d);}
function _p10dbSet(k,v){if(window.DB&&typeof window.DB.set==='function')window.DB.set(k,v);else _p10lsSet(k,v);}
function _p10toast(msg,err=false){
    const t=document.getElementById('sos-toast');if(!t)return;
    t.textContent=msg;t.style.background=err?'#ef4444':'';
    t.classList.add('show');setTimeout(()=>{t.classList.remove('show');t.style.background='';},3400);
}

/* ================================================================
   SECTION 1 — KILL KaTeX PREVIEW
   ================================================================ */
function _p10killKatexPreview(){
    // Hide existing preview if rendered by patches.js
    const prev = document.getElementById('formula-math-preview');
    if(prev) prev.style.setProperty('display','none','important');

    // Neutralize the patches.js preview installer so it never re-fires
    if(!window._p10_katexKilled){
        window._p10_katexKilled = true;
        // Watch for the preview being (re-)created and hide it
        const obs = new MutationObserver(()=>{
            const p = document.getElementById('formula-math-preview');
            if(p) p.style.setProperty('display','none','important');
        });
        obs.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['style']});
    }
}

/* ================================================================
   SECTION 2 — LOCATION PERMISSION MODAL
   ================================================================ */
function _p10buildLocationModal(){
    if(document.getElementById('p10-location-modal')) return;
    const el = document.createElement('div');
    el.id = 'p10-location-modal';
    el.innerHTML = `
        <div class="p10-loc-box">
            <div class="p10-loc-icon">📍</div>
            <div class="p10-loc-title">Enable Weather Widget</div>
            <div class="p10-loc-desc">
                StudentOS would like to know your <strong>approximate location</strong> to show you
                the current weather and a 4-day forecast right on your dashboard.
            </div>
            <div class="p10-loc-note">
                <i class="fa-solid fa-shield-halved"></i>
                <strong>Your privacy matters.</strong> Your location is only used to fetch weather data
                from <em>Open-Meteo</em> (no API key, no account needed). It is never stored on our
                servers. Results are cached locally for 30 minutes.
            </div>
            <div class="p10-loc-btns">
                <button class="p10-loc-btn-no" onclick="_p10locationDecline()">Not now</button>
                <button class="p10-loc-btn-yes" onclick="_p10locationAllow()">
                    <i class="fa-solid fa-location-crosshairs" style="margin-right:6px;"></i>Allow Location
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(el);
}

window._p10locationAllow = function(){
    _p10lsSet('p10_location_decision', 'allowed');
    const m = document.getElementById('p10-location-modal');
    if(m){ m.classList.remove('show'); setTimeout(()=>m.remove(),300); }
    // Now actually trigger weather fetch
    const inner = document.getElementById('weather-inner');
    if(inner) window._p9RenderWeather?.(inner);
    else if(inner) inner.innerHTML = `<div class="weather-loading"><i class="fa-solid fa-circle-notch w-spin"></i><span>Loading…</span></div>`;
};

window._p10locationDecline = function(){
    _p10lsSet('p10_location_decision', 'declined');
    const m = document.getElementById('p10-location-modal');
    if(m){ m.classList.remove('show'); setTimeout(()=>m.remove(),300); }
    const inner = document.getElementById('weather-inner');
    if(inner) inner.innerHTML = `<div class="weather-error">
        Location not granted. <span onclick="_p10askLocationAgain()">Ask again</span>
    </div>`;
};

window._p10askLocationAgain = function(){
    _p10lsSet('p10_location_decision', null);
    const inner = document.getElementById('weather-inner');
    if(inner) _p10promptLocation(inner);
};

function _p10promptLocation(inner){
    const decision = _p10lsGet('p10_location_decision', null);
    if(decision === 'allowed'){
        // Just render
        if(inner) window._p9RenderWeather?.(inner);
    } else if(decision === 'declined'){
        if(inner) inner.innerHTML = `<div class="weather-error">Location not granted. <span onclick="_p10askLocationAgain()">Enable</span></div>`;
    } else {
        // Show modal
        _p10buildLocationModal();
        requestAnimationFrame(()=>{
            const m = document.getElementById('p10-location-modal');
            if(m) m.classList.add('show');
        });
        if(inner) inner.innerHTML = `<div class="weather-loading"><i class="fa-solid fa-location-dot w-spin"></i><span>Waiting for permission…</span></div>`;
    }
}

/* Patch the weather widget to use our modal instead of just calling geolocation directly */
function _p10patchWeatherWidget(){
    // Intercept the widget-weather rendering once it exists
    function _tryPatch(){
        const ww = document.getElementById('widget-weather');
        if(!ww){ setTimeout(_tryPatch, 400); return; }
        const inner = document.getElementById('weather-inner');
        if(!inner){ setTimeout(_tryPatch, 400); return; }
        // Check if content is empty / loading-state — inject our gated version
        const decision = _p10lsGet('p10_location_decision', null);
        if(decision !== 'allowed'){
            // Replace with gated version
            _p10promptLocation(inner);
        }
    }
    _tryPatch();
}

/* ================================================================
   SECTION 3 — CUSTOM CONFIRM MODAL (replaces browser confirm())
   ================================================================ */
function _p10buildConfirmModal(){
    if(document.getElementById('p10-confirm-modal')) return;
    const el = document.createElement('div');
    el.id = 'p10-confirm-modal';
    el.innerHTML = `
        <div class="p10-confirm-box">
            <div class="p10-confirm-icon" id="p10-confirm-icon">
                <i class="fa-solid fa-trash"></i>
            </div>
            <div class="p10-confirm-title" id="p10-confirm-title">Delete Formula</div>
            <div class="p10-confirm-desc"  id="p10-confirm-desc">
                This formula will be permanently deleted. This cannot be undone.
            </div>
            <div class="p10-confirm-btns">
                <button class="p10-confirm-cancel" onclick="_p10confirmNo()">Cancel</button>
                <button class="p10-confirm-ok" id="p10-confirm-ok-btn" onclick="_p10confirmYes()">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(el);
}

let _p10_confirmResolve = null;

function _p10confirm({ title='Are you sure?', desc='This cannot be undone.', okLabel='Delete', iconClass='fa-trash', iconColor='#ef4444' } = {}){
    _p10buildConfirmModal();
    document.getElementById('p10-confirm-title').textContent = title;
    document.getElementById('p10-confirm-desc').textContent  = desc;
    const okBtn = document.getElementById('p10-confirm-ok-btn');
    if(okBtn) okBtn.textContent = okLabel;
    const iconEl = document.getElementById('p10-confirm-icon');
    if(iconEl){
        iconEl.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
        iconEl.style.color = iconColor;
        iconEl.style.background = iconColor + '18';
        iconEl.style.borderColor = iconColor + '30';
    }
    return new Promise(resolve => {
        _p10_confirmResolve = resolve;
        const modal = document.getElementById('p10-confirm-modal');
        modal.classList.add('show');
    });
}

window._p10confirmYes = function(){
    const m = document.getElementById('p10-confirm-modal');
    if(m) m.classList.remove('show');
    if(_p10_confirmResolve){ _p10_confirmResolve(true); _p10_confirmResolve=null; }
};
window._p10confirmNo = function(){
    const m = document.getElementById('p10-confirm-modal');
    if(m) m.classList.remove('show');
    if(_p10_confirmResolve){ _p10_confirmResolve(false); _p10_confirmResolve=null; }
};

// Close on backdrop click
document.addEventListener('click', e => {
    const m = document.getElementById('p10-confirm-modal');
    if(m && m.classList.contains('show') && e.target === m) _p10confirmNo();
    const lm = document.getElementById('p10-location-modal');
    if(lm && lm.classList.contains('show') && e.target === lm) _p10locationDecline();
});

/* Patch formulaDelete to use our modal */
function _p10patchFormulaDelete(){
    function _tryPatch(){
        if(typeof window.formulaDelete !== 'function'){ setTimeout(_tryPatch, 300); return; }
        if(window._p10_formulaDeletePatched) return;
        window._p10_formulaDeletePatched = true;
        window.formulaDelete = async function(id){
            const items = _p10dbGet('os_formulas', []);
            const f = items.find(x => x.id === id);
            const name = f ? (f.title || 'this formula') : 'this formula';
            const yes = await _p10confirm({
                title: 'Delete Formula',
                desc: `"${name}" will be permanently deleted.`,
                okLabel: 'Delete', iconClass: 'fa-trash', iconColor: '#ef4444'
            });
            if(!yes) return;
            _p10dbSet('os_formulas', items.filter(x => x.id !== id));
            if(typeof window.renderFormulas === 'function') window.renderFormulas();
            if(typeof window.renderFormulaSubjectBar === 'function') window.renderFormulaSubjectBar();
            _p10toast('Formula deleted.');
        };
    }
    _tryPatch();
}

/* ================================================================
   SECTION 4 — FORMULA SUBJECT DROPDOWN
   ================================================================ */
const P10_FORMULA_SUBJECTS = [
    { value: 'Math',       label: 'Math',       icon: 'fa-square-root-alt', color: '#3b82f6' },
    { value: 'Physics',    label: 'Physics',     icon: 'fa-atom',            color: '#8b5cf6' },
    { value: 'Chemistry',  label: 'Chemistry',   icon: 'fa-flask',           color: '#22c55e' },
    { value: 'Biology',    label: 'Biology',     icon: 'fa-dna',             color: '#f59e0b' },
    { value: 'Economics',  label: 'Economics',   icon: 'fa-chart-line',      color: '#ec4899' },
    { value: 'Other',      label: 'Other',       icon: 'fa-circle-question', color: '#6b7280' },
];

function _p10patchFormulaModal(){
    // Replace the plain text subject input with a proper select dropdown
    function _tryPatch(){
        const subjectInput = document.getElementById('formula-modal-subject');
        if(!subjectInput || subjectInput.dataset.p10patched){ setTimeout(_tryPatch, 400); return; }
        subjectInput.dataset.p10patched = 'true';
        
        // Build select element
        const wrap = document.createElement('div');
        wrap.id = 'formula-modal-subject-wrap';
        const select = document.createElement('select');
        select.id = 'p10-formula-subj-select';
        select.className = 'bare-input w-full mb-4';
        select.style.cssText = 'appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:24px;';
        select.innerHTML = `<option value="">— Select subject —</option>` +
            P10_FORMULA_SUBJECTS.map(s => `<option value="${s.value}">${s.label}</option>`).join('');
        
        // Arrow decoration
        const arrow = document.createElement('span');
        arrow.className = 'formula-modal-subj-arrow';
        arrow.innerHTML = '<i class="ph-bold ph-caret-down"></i>';
        
        wrap.appendChild(select);
        wrap.appendChild(arrow);
        
        // Replace the original input with our select
        subjectInput.parentNode.insertBefore(wrap, subjectInput);
        subjectInput.style.display = 'none';
        
        // Sync select → hidden input so existing formulaSave() still reads it
        select.addEventListener('change', () => {
            subjectInput.value = select.value;
        });
        
        // Patch formulaOpenModal to sync value on open
        if(typeof window.formulaOpenModal === 'function' && !window._p10_formulaOpenPatched){
            window._p10_formulaOpenPatched = true;
            const _orig = window.formulaOpenModal;
            window.formulaOpenModal = function(id){
                _orig(id);
                setTimeout(() => {
                    const val = document.getElementById('formula-modal-subject')?.value || '';
                    const sel = document.getElementById('p10-formula-subj-select');
                    if(sel) sel.value = val;
                }, 50);
            };
        }
    }
    _tryPatch();
}

/* ================================================================
   SECTION 5 — ENHANCED FORMULA SUBJECT PILLS
   ================================================================ */
function _p10patchFormulaSubjectBar(){
    // Override renderFormulaSubjectBar to use icons + predefined subjects
    function _tryPatch(){
        if(typeof window.renderFormulaSubjectBar !== 'function'){ setTimeout(_tryPatch, 400); return; }
        if(window._p10_formulaBarPatched) return;
        window._p10_formulaBarPatched = true;

        const _origRenderFormulas = window.renderFormulas;

        window.renderFormulaSubjectBar = function(){
            const bar = document.getElementById('formula-subject-bar');
            if(!bar) return;
            const items = _p10dbGet('os_formulas', []);
            const currentSubj = window._p10_fSubject || 'all';
            
            // Count per subject
            const counts = {};
            items.forEach(f => { if(f.subject) counts[f.subject] = (counts[f.subject]||0) + 1; });
            
            // Fixed subjects + any custom ones from user's formulas
            const fixedSubjects = P10_FORMULA_SUBJECTS.map(s => s.value);
            const allSubjectsInData = Object.keys(counts);
            const customSubjects = allSubjectsInData.filter(s => !fixedSubjects.includes(s));
            
            // All pill
            const allActive = currentSubj === 'all';
            let html = `<button class="formula-pill${allActive?' active':''}" onclick="p10FormulaSetSubject('all')">
                <i class="fa-solid fa-border-all"></i> All
                <span style="margin-left:3px;opacity:.6;font-size:.65rem;">${items.length}</span>
            </button>`;
            
            // Fixed subjects (only show if they have formulas or always show core ones)
            P10_FORMULA_SUBJECTS.forEach(s => {
                const count = counts[s.value] || 0;
                const active = currentSubj === s.value;
                html += `<button class="formula-pill${active?' active':''}" 
                                  onclick="p10FormulaSetSubject('${s.value}')"
                                  style="${active ? '' : `--pill-c:${s.color}`}">
                    <i class="fa-solid ${s.icon}"></i> ${s.label}
                    ${count > 0 ? `<span style="margin-left:3px;opacity:.6;font-size:.65rem;">${count}</span>` : ''}
                </button>`;
            });
            
            // Custom subjects not in our list
            customSubjects.forEach(s => {
                const count = counts[s] || 0;
                const active = currentSubj === s;
                html += `<button class="formula-pill${active?' active':''}" onclick="p10FormulaSetSubject('${_p10esc(s)}')">
                    <i class="fa-solid fa-circle-question"></i> ${_p10esc(s)}
                    ${count > 0 ? `<span style="margin-left:3px;opacity:.6;font-size:.65rem;">${count}</span>` : ''}
                </button>`;
            });
            
            bar.innerHTML = html;
        };
    }
    _tryPatch();
}

// Separate subject state for p10 (so we don't conflict with features.js internal var)
window._p10_fSubject = 'all';
window.p10FormulaSetSubject = function(subj){
    window._p10_fSubject = subj;
    // Also update features.js internal state via its function
    if(typeof window.formulaSetSubject === 'function') window.formulaSetSubject(subj);
    else {
        window.renderFormulaSubjectBar();
        if(typeof window.renderFormulas === 'function') window.renderFormulas();
    }
};

/* ================================================================
   SECTION 6 — SETTINGS AS A PROPER TAB
   ================================================================ */

function _p10buildSettingsTab(){
    // 1. Add Settings button to sidebar nav (at the bottom)
    if(!document.getElementById('btn-settings')){
        const oldGear = document.querySelector('button[onclick*="modal-settings"]:not(.p9-s-nav-btn):not(.p10-stab-nav-btn)');
        if(oldGear){
            // Replace its onclick
            oldGear.id = 'btn-settings';
            oldGear.setAttribute('onclick', "switchTab('settings')");
        } else {
            // Inject new button
            const nav = document.querySelector('nav .mt-auto');
            if(nav){
                const btn = document.createElement('button');
                btn.id = 'btn-settings';
                btn.className = 'nav-btn';
                btn.setAttribute('data-tooltip', 'Settings');
                btn.setAttribute('onclick', "switchTab('settings')");
                btn.innerHTML = '<i class="ph ph-gear text-xl"></i>';
                nav.insertBefore(btn, nav.firstChild);
            }
        }
    }

    // 2. Inject #view-settings into main scroll area
    if(!document.getElementById('view-settings')){
        const main = document.getElementById('main-scroll');
        if(!main) return;
        const div = document.createElement('div');
        div.id = 'view-settings';
        div.className = 'hidden fade-in';
        div.innerHTML = _p10settingsHTML();
        main.querySelector('main, #main-content') ?
            main.querySelector('main, #main-content').appendChild(div) :
            main.appendChild(div);
    }

    // 3. Patch openModal to use switchTab for settings
    function _tryPatchOpenModal(){
        if(typeof window.openModal !== 'function'){ setTimeout(_tryPatchOpenModal, 200); return; }
        if(window._p10_openModalPatched) return;
        window._p10_openModalPatched = true;
        const _orig = window.openModal;
        window.openModal = function(id){
            if(id === 'modal-settings'){
                if(typeof window.switchTab === 'function') window.switchTab('settings');
                return;
            }
            _orig(id);
        };
    }
    _tryPatchOpenModal();

    // 4. Patch switchTab to include 'settings'
    function _tryPatchSwitchTab(){
        if(typeof window.switchTab !== 'function'){ setTimeout(_tryPatchSwitchTab, 200); return; }
        if(window._p10_switchTabPatched) return;
        window._p10_switchTabPatched = true;
        const _orig = window.switchTab;
        window.switchTab = function(name){
            if(name === 'settings'){
                // Hide all other views
                document.querySelectorAll('[id^="view-"]').forEach(v => {
                    v.classList.add('hidden');
                    v.classList.remove('active');
                });
                // Show settings
                const sv = document.getElementById('view-settings');
                if(sv){ sv.classList.remove('hidden'); sv.classList.add('active'); }
                // Update nav buttons
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                const settBtn = document.getElementById('btn-settings');
                if(settBtn) settBtn.classList.add('active');
                // Sync values
                _p10syncSettingsValues();
                return;
            }
            _orig(name);
            // Hide settings view when switching away
            const sv = document.getElementById('view-settings');
            if(sv){ sv.classList.add('hidden'); sv.classList.remove('active'); }
        };
    }
    _tryPatchSwitchTab();
}

function _p10settingsHTML(){
    const accentSwatches = [
        ['#3b82f6','Blue'],['#ef4444','Red'],['#10b981','Emerald'],
        ['#8b5cf6','Violet'],['#f59e0b','Amber'],['#ec4899','Pink'],
        ['#14b8a6','Teal'],['#f97316','Orange'],['#06b6d4','Cyan'],['#84cc16','Lime']
    ].map(([c,n]) =>
        `<div class="p10-accent-swatch" style="background:${c}" title="${n}"
              onclick="if(typeof setAccent==='function')setAccent('${c}');_p10refreshAccentSwatches('${c}')"></div>`
    ).join('');

    const navItems = [
        { page:'profile',       icon:'fa-user',          label:'Profile' },
        { page:'appearance',    icon:'fa-palette',       label:'Appearance' },
        { page:'timer',         icon:'fa-stopwatch',     label:'Focus & Timer' },
        { page:'notifications', icon:'fa-bell',          label:'Notifications' },
        { section:'Tools' },
        { page:'data',          icon:'fa-database',      label:'Data & Sync' },
        { page:'widgets',       icon:'fa-th-large',      label:'Widgets' },
        { page:'shortcuts',     icon:'fa-keyboard',      label:'Shortcuts' },
        { section:'More' },
        { page:'feedback',      icon:'fa-comment-dots',  label:'Feedback' },
        { page:'about',         icon:'fa-circle-info',   label:'About' },
    ];
    const sidebarHTML = navItems.map(item => {
        if(item.section) return `<div class="p10-stab-section-lbl">${item.section}</div>`;
        return `<button class="p10-stab-nav-btn ${item.page==='profile'?'active':''}"
                        data-page="${item.page}"
                        onclick="_p10switchSettingsPage('${item.page}')">
            <i class="fa-solid ${item.icon}"></i> ${item.label}
        </button>`;
    }).join('');

    const shortcuts = [
        ['Alt + 1–9','Switch tab by number'],['Alt + T','New Task'],
        ['Alt + N','New Note'],['Esc','Close dialog'],['Space','Flip flashcard'],
        ['← →','Mark card hard / easy'],['Ctrl+Enter','Submit forum post'],
        ['Tab / Shift+Tab','Indent note bullet'],
    ].map(([k,v])=>`<div class="p10-row"><div class="p10-row-lbl">${v}</div><span class="p10-kbd">${k}</span></div>`).join('');

    return `
    <div id="p10-stab-sidebar">${sidebarHTML}
        <div style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:12px;">
            <button class="p10-stab-nav-btn" style="color:#f87171;"
                    onclick="if(typeof logOut==='function')logOut()">
                <i class="ph-bold ph-sign-out"></i> Sign Out
            </button>
        </div>
    </div>
    <div id="p10-stab-content">

        <!-- ── PROFILE ── -->
        <div class="p10-s-page active" id="p10-page-profile">
            <div class="p10-page-title">My <span>Profile</span></div>
            <div class="p10-section">
                <div class="p10-section-title">Avatar</div>
                <div class="p10-row" style="flex-direction:column;align-items:flex-start;gap:16px;">
                    <div style="display:flex;align-items:center;gap:18px;">
                        <div class="p10-avatar-display" id="p10-avatar-preview-tab"
                             onclick="document.getElementById('profile-img-input').click()"
                             title="Click to upload photo">
                        </div>
                        <div>
                            <div style="font-size:.85rem;font-weight:600;margin-bottom:4px;">Profile Picture</div>
                            <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:10px;">
                                Shown on forum posts and your profile
                            </div>
                            <button class="p10-btn p10-btn-ghost" style="font-size:.78rem;padding:6px 14px;"
                                    onclick="document.getElementById('profile-img-input').click()">
                                <i class="ph-bold ph-upload" style="margin-right:5px;"></i>Upload Photo
                            </button>
                        </div>
                    </div>
                    <div style="width:100%;">
                        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:var(--text-muted);margin-bottom:8px;">
                            Avatar Background
                        </div>
                        <div class="p10-bg-swatches" id="p10-bg-swatches">
                            ${['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#1a1a2e','#0f172a'].map(c=>
                                `<div class="p10-bg-swatch" style="background:${c}" onclick="setAvatarBg('${c}');_p10syncAvatar()"></div>`
                            ).join('')}
                            <input type="color" title="Custom color" style="width:24px;height:24px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.2);cursor:pointer;"
                                   onchange="setAvatarBg(this.value);_p10syncAvatar()">
                        </div>
                    </div>
                    <div style="width:100%;">
                        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:var(--text-muted);margin-bottom:8px;">
                            Choose Emoji
                        </div>
                        <div class="p10-emoji-grid">
                            ${['🎓','📚','🧑‍💻','✏️','🦊','🐱','🐼','🦁','🌟','🚀','🎯','💡','🎮','🔥','⚡','🧠','🎸','🌈','🦋','🌺','🐉','🦄','🏆','🎨','🧩','🎭','🌙','☀️','🍀','🦅'].map(e=>
                                `<button class="p10-emoji-opt" onclick="setProfileEmoji('${e}');_p10syncAvatar()">${e}</button>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Identity</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Your Name</div><div class="p10-row-sub">Shown on your profile & forum</div></div>
                    <input id="p10-name-input" type="text" class="p10-input" placeholder="Your name"
                           style="width:160px;text-align:right;"
                           oninput="_p10setName(this.value)">
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Language</div></div>
                    <select id="p10-lang-select" class="p10-select"
                            onchange="if(typeof setLanguage==='function')setLanguage(this.value)">
                        <option value="en">🇬🇧 English</option>
                        <option value="nl">🇧🇪 Nederlands</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- ── APPEARANCE ── -->
        <div class="p10-s-page" id="p10-page-appearance">
            <div class="p10-page-title">App <span>Appearance</span></div>
            <div class="p10-section">
                <div class="p10-section-title">Theme</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Light Mode</div><div class="p10-row-sub">Toggle dark ↔ light</div></div>
                    <div id="p10-theme-toggle" class="p10-toggle" onclick="_p10toggleTheme()"></div>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Follow System Theme</div><div class="p10-row-sub">Auto-switch based on OS preference</div></div>
                    <div id="p10-sys-theme-toggle" class="p10-toggle" onclick="_p10toggleSysTheme()"></div>
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Accent Color</div>
                <div class="p10-accent-grid" style="padding:10px 0 14px;">${accentSwatches}
                    <input type="color" title="Custom" class="p10-accent-custom-input"
                           onchange="if(typeof setAccent==='function')setAccent(this.value);_p10refreshAccentSwatches(this.value)">
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Clock Color</div></div>
                    <input type="color" id="p10-clock-color" value="#ffffff"
                           onchange="if(typeof setClockColor==='function')setClockColor(this.value)"
                           style="width:32px;height:32px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.15);cursor:pointer;">
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Background Tint</div><div class="p10-row-sub">Ambient glow color</div></div>
                    <input type="color" id="p10-bg-color"
                           onchange="if(typeof setBg==='function')setBg(this.value)"
                           style="width:32px;height:32px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.15);cursor:pointer;">
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Typography & Layout</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Font Scale</div></div>
                    <div class="p10-font-btns">
                        <button class="p10-font-btn" onclick="if(typeof setFontScale==='function')setFontScale(.85);_p10refreshFontBtns(.85)">S</button>
                        <button class="p10-font-btn active" onclick="if(typeof setFontScale==='function')setFontScale(1);_p10refreshFontBtns(1)">M</button>
                        <button class="p10-font-btn" onclick="if(typeof setFontScale==='function')setFontScale(1.12);_p10refreshFontBtns(1.12)">L</button>
                    </div>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Show Seconds on Clock</div></div>
                    <div id="p10-secs-toggle" class="p10-toggle" onclick="_p10toggleSeconds()"></div>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Compact Widget Mode</div><div class="p10-row-sub">Denser widget layout</div></div>
                    <div id="p10-compact-toggle" class="p10-toggle" onclick="_p10toggleCompact()"></div>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Reduced Motion</div><div class="p10-row-sub">Minimize animations throughout the app</div></div>
                    <div id="p10-motion-toggle" class="p10-toggle" onclick="_p10toggleMotion()"></div>
                </div>
            </div>
        </div>

        <!-- ── FOCUS & TIMER ── -->
        <div class="p10-s-page" id="p10-page-timer">
            <div class="p10-page-title">Focus <span>& Timer</span></div>
            <div class="p10-section">
                <div class="p10-section-title">Pomodoro Durations</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Focus Duration</div><div class="p10-row-sub">Minutes per focus block</div></div>
                    <input type="number" id="p10-pomo-focus" class="p10-input p10-num-input" value="25" min="1" max="120"
                           onchange="if(typeof setCustomPomodoro==='function')setCustomPomodoro(this.value)">
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Short Break</div></div>
                    <input type="number" id="p10-pomo-short" class="p10-input p10-num-input" value="5" min="1" max="30"
                           onchange="_p10setPomoTime('short', this.value)">
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Long Break</div></div>
                    <input type="number" id="p10-pomo-long" class="p10-input p10-num-input" value="15" min="1" max="60"
                           onchange="_p10setPomoTime('long', this.value)">
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Sessions Before Long Break</div></div>
                    <input type="number" id="p10-pomo-sessions" class="p10-input p10-num-input" value="4" min="1" max="10"
                           onchange="_p10lsSet('p9_pomo_sessions', parseInt(this.value))">
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Behaviour</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Timer Sound</div><div class="p10-row-sub">Play a chime when session ends</div></div>
                    <div id="p10-timer-sound-toggle" class="p10-toggle on" onclick="_p10toggleTimerSound()"></div>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Auto-start Breaks</div><div class="p10-row-sub">Automatically start the break timer</div></div>
                    <div id="p10-autobreak-toggle" class="p10-toggle" onclick="_p10toggleAutoBreak()"></div>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Daily Study Goal</div><div class="p10-row-sub">Target focus sessions per day</div></div>
                    <input type="number" id="p10-daily-goal" class="p10-input p10-num-input" value="4" min="1" max="20"
                           onchange="_p10lsSet('p9_daily_goal', parseInt(this.value))">
                </div>
            </div>
        </div>

        <!-- ── NOTIFICATIONS ── -->
        <div class="p10-s-page" id="p10-page-notifications">
            <div class="p10-page-title">Notifications</div>
            <div class="p10-section">
                <div class="p10-section-title">Browser Notifications</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Calendar Reminders</div><div class="p10-row-sub">Alerts for upcoming events</div></div>
                    <button class="p10-btn p10-btn-ghost" onclick="if(typeof requestCalNotifications==='function')requestCalNotifications()">Enable</button>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Task Due Alerts</div><div class="p10-row-sub">Reminders for tasks due today</div></div>
                    <button class="p10-btn p10-btn-ghost" onclick="if(typeof requestTaskNotifications==='function')requestTaskNotifications()">Enable</button>
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Preferences</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Exam Warning (days before)</div></div>
                    <input type="number" id="p10-exam-warn" class="p10-input p10-num-input" value="14" min="1" max="60"
                           onchange="_p10lsSet('p9_exam_warn_days', parseInt(this.value))">
                </div>
            </div>
        </div>

        <!-- ── DATA ── -->
        <div class="p10-s-page" id="p10-page-data">
            <div class="p10-page-title">Data <span>& Sync</span></div>
            <div class="p10-section">
                <div class="p10-section-title">Backup</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Export All Data</div><div class="p10-row-sub">Download a full JSON backup</div></div>
                    <button class="p10-btn p10-btn-ghost" onclick="if(typeof exportAllData==='function')exportAllData()">Export</button>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Import Data</div><div class="p10-row-sub">Restore from a backup file</div></div>
                    <button class="p10-btn p10-btn-ghost" onclick="document.getElementById('import-all-input')?.click()">Import</button>
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Academic</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Grade Scale</div></div>
                    <select class="p10-select" id="p10-grade-scale" onchange="_p10lsSet('p9_grade_scale',this.value)">
                        <option value="pct">Percentage (0–100%)</option>
                        <option value="ten">Out of 10</option>
                        <option value="twenty">Out of 20</option>
                        <option value="letter">Letter (A–F)</option>
                    </select>
                </div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl">Week Starts On</div></div>
                    <select class="p10-select" id="p10-week-start" onchange="_p10lsSet('p9_week_start',this.value)">
                        <option value="mon">Monday</option>
                        <option value="sun">Sunday</option>
                    </select>
                </div>
            </div>
            <div class="p10-section">
                <div class="p10-section-title">Danger Zone</div>
                <div class="p10-row">
                    <div><div class="p10-row-lbl" style="color:#f87171;">Reset All Data</div><div class="p10-row-sub">Permanently delete all your data</div></div>
                    <button class="p10-btn p10-btn-danger" onclick="if(typeof resetAllData==='function')resetAllData()">Reset</button>
                </div>
            </div>
        </div>

        <!-- ── WIDGETS ── -->
        <div class="p10-s-page" id="p10-page-widgets">
            <div class="p10-page-title">Dashboard <span>Widgets</span></div>
            <div class="p10-section">
                <div class="p10-section-title">Visible Widgets</div>
                <div id="p10-widget-list">
                    ${[
                        {id:'links',key:'links',label:'Quick Links'},
                        {id:'goals',key:'goals',label:'Daily Goals'},
                        {id:'upnext',key:'upnext',label:'Up Next'},
                        {id:'studystats',key:'studystats',label:'Study Stats'},
                        {id:'grades',key:'grades',label:'Grades Overview'},
                        {id:'minicalendar',key:'minicalendar',label:'Upcoming Events'},
                        {id:'quicknote',key:'quicknote',label:'Quick Note'},
                        {id:'exams',key:'exams',label:'Exam Countdown'},
                        {id:'music',key:'music',label:'Music Player'},
                        {id:'forum',key:'forum',label:'Forum Quick Ask'},
                        {id:'weather',key:'weather',label:'Weather'},
                        {id:'quote',key:'quote',label:'Quote of the Day'},
                        {id:'habits',key:'habits',label:'Study Habits'},
                    ].map(w=>`
                        <div class="p10-row">
                            <div class="p10-row-lbl">${w.label}</div>
                            <div id="p10-wt-${w.id}" class="p10-toggle on"
                                 onclick="_p10toggleWidget('${w.key}', this)"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- ── SHORTCUTS ── -->
        <div class="p10-s-page" id="p10-page-shortcuts">
            <div class="p10-page-title">Keyboard <span>Shortcuts</span></div>
            <div class="p10-section">
                <div class="p10-section-title">All Shortcuts</div>
                ${shortcuts}
            </div>
        </div>

        <!-- ── FEEDBACK ── -->
        <div class="p10-s-page" id="p10-page-feedback">
            <div class="p10-page-title">Send <span>Feedback</span></div>
            <div class="p10-section" style="padding-bottom:16px;">
                <div class="p10-section-title">Message</div>
                <div class="p10-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
                    <div class="p10-row-lbl">Feedback Type</div>
                    <select class="p10-select" id="p10-fb-type" style="width:100%;">
                        <option value="general">💬 General Feedback</option>
                        <option value="bug">🐛 Bug Report</option>
                        <option value="feature">✨ Feature Request</option>
                        <option value="praise">❤️ Compliment</option>
                    </select>
                </div>
                <div class="p10-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
                    <div class="p10-row-lbl">Your Message</div>
                    <textarea class="p10-textarea" id="p10-fb-text"
                              placeholder="Tell us anything — bugs, ideas, or just say hi! 💌"></textarea>
                </div>
                <div style="display:flex;gap:10px;padding:12px 0 4px;align-items:center;">
                    <button class="p10-btn p10-btn-primary" onclick="_p10submitFeedback()">
                        <i class="fa-solid fa-paper-plane" style="margin-right:6px;"></i>Send
                    </button>
                    <div id="p10-feedback-status"></div>
                </div>
            </div>
            <p style="font-size:.74rem;color:var(--text-muted);line-height:1.7;padding:0 2px;">
                Feedback is sent to <strong style="color:var(--accent);">lars.dehairs@gmail.com</strong>.
                We read every message and aim to reply within a few days. Thank you! 🙏
            </p>
        </div>

        <!-- ── ABOUT ── -->
        <div class="p10-s-page" id="p10-page-about">
            <div class="p10-page-title">About <span>StudentOS</span></div>
            <div class="p10-about-card">
                <div class="p10-about-icon"><i class="ph-bold ph-student"></i></div>
                <div>
                    <div style="font-size:1.05rem;font-weight:700;">StudentOS</div>
                    <div style="font-size:.72rem;color:var(--text-muted);margin-top:3px;">Version 1.2</div>
                    <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px;">Your all-in-one student workspace 🎓</div>
                </div>
        </div>

    </div><!-- /p10-stab-content -->
    `;
}

/* ================================================================
   SECTION 7 — SETTINGS INTERACTION HANDLERS
   ================================================================ */
window._p10switchSettingsPage = function(page){
    document.querySelectorAll('.p10-s-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.p10-stab-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    const p = document.getElementById('p10-page-' + page);
    if(p) p.classList.add('active');
    // Sync avatar when visiting profile
    if(page === 'profile') _p10syncAvatar();
};

window._p10toggleTheme = function(){
    if(typeof toggleTheme === 'function') toggleTheme();
    setTimeout(() => {
        const isLight = document.documentElement.hasAttribute('data-theme');
        const t = document.getElementById('p10-theme-toggle');
        if(t) t.classList.toggle('on', isLight);
    }, 50);
};

window._p10toggleSysTheme = function(){
    const cur = _p10lsGet('p9_sys_theme', false);
    _p10lsSet('p9_sys_theme', !cur);
    const t = document.getElementById('p10-sys-theme-toggle');
    if(t) t.classList.toggle('on', !cur);
};

window._p10toggleSeconds = function(){
    const cur = _p10lsGet('p9_show_seconds', false);
    _p10lsSet('p9_show_seconds', !cur);
    const t = document.getElementById('p10-secs-toggle');
    if(t) t.classList.toggle('on', !cur);
};

window._p10toggleCompact = function(){
    const cur = _p10lsGet('p9_compact', false);
    _p10lsSet('p9_compact', !cur);
    const t = document.getElementById('p10-compact-toggle');
    if(t) t.classList.toggle('on', !cur);
    document.body.classList.toggle('p9-compact', !cur);
};

window._p10toggleMotion = function(){
    const cur = _p10lsGet('p10_reduced_motion', false);
    _p10lsSet('p10_reduced_motion', !cur);
    const t = document.getElementById('p10-motion-toggle');
    if(t) t.classList.toggle('on', !cur);
    document.documentElement.classList.toggle('p10-reduce-motion', !cur);
};

window._p10toggleTimerSound = function(){
    if(typeof toggleTimerSound === 'function') toggleTimerSound();
    const t = document.getElementById('p10-timer-sound-toggle');
    if(t) t.classList.toggle('on');
};

window._p10toggleAutoBreak = function(){
    const t = document.getElementById('p10-autobreak-toggle');
    if(t) t.classList.toggle('on');
    if(window.pomodoroAutoBreak !== undefined){
        window.pomodoroAutoBreak = !window.pomodoroAutoBreak;
        _p10dbSet('os_pomo_autobreak', window.pomodoroAutoBreak);
    }
};

window._p10setPomoTime = function(type, val){
    const times = _p10lsGet('os_pomo_times', {focus:25, short:5, long:15});
    times[type] = parseInt(val) || times[type];
    _p10lsSet('os_pomo_times', times);
    _p10dbSet('os_pomo_times', times);
};

window._p10setName = function(val){
    if(typeof setStudentName === 'function') setStudentName(val);
    // Sync the hidden profile-name-input in modal
    const ni = document.getElementById('profile-name-input');
    if(ni) ni.value = val;
};

window._p10refreshAccentSwatches = function(color){
    document.querySelectorAll('.p10-accent-swatch').forEach(s => {
        s.classList.toggle('active', s.style.background.replace(/\s/g,'').toLowerCase() === color.replace(/\s/g,'').toLowerCase());
    });
};
window._p10refreshFontBtns = function(scale){
    const map = { S:.85, M:1, L:1.12 };
    document.querySelectorAll('.p10-font-btn').forEach(b => {
        b.classList.toggle('active', Math.abs(map[b.textContent]-scale) < 0.01);
    });
};

window._p10toggleWidget = function(key, toggleEl){
    const isOn = toggleEl.classList.toggle('on');
    // Use existing setWidgetVisible if available
    if(typeof setWidgetVisible === 'function') setWidgetVisible(key, isOn);
    // Also handle p9 widgets
    if(['weather','quote','habits'].includes(key)){
        const cfg = _p10lsGet('p9_widget_vis', {weather:true,quote:true,habits:true});
        cfg[key] = isOn;
        _p10lsSet('p9_widget_vis', cfg);
        const el = document.getElementById('widget-'+key);
        if(el) el.classList.toggle('widget-hidden', !isOn);
    }
};

window._p10syncAvatar = function(){
    // Mirror the sidebar avatar-preview into p10-avatar-preview-tab
    const src = document.getElementById('avatar-preview');
    const dest = document.getElementById('p10-avatar-preview-tab');
    if(!src || !dest) return;
    dest.innerHTML = src.innerHTML;
    dest.style.background = src.style.background || '';
};

function _p10syncSettingsValues(){
    try {
        // Theme
        const isLight = document.documentElement.hasAttribute('data-theme');
        const tt = document.getElementById('p10-theme-toggle');
        if(tt) tt.classList.toggle('on', isLight);
        // Sys theme
        const st = document.getElementById('p10-sys-theme-toggle');
        if(st) st.classList.toggle('on', _p10lsGet('p9_sys_theme', false));
        // Seconds
        const ss = document.getElementById('p10-secs-toggle');
        if(ss) ss.classList.toggle('on', _p10lsGet('p9_show_seconds', false));
        // Compact
        const ct = document.getElementById('p10-compact-toggle');
        if(ct) ct.classList.toggle('on', _p10lsGet('p9_compact', false));
        // Motion
        const mt = document.getElementById('p10-motion-toggle');
        if(mt) mt.classList.toggle('on', _p10lsGet('p10_reduced_motion', false));
        // Name
        const ni = document.getElementById('p10-name-input');
        if(ni){ const n = document.getElementById('profile-name-input'); if(n) ni.value = n.value; }
        // Lang
        const li = document.getElementById('p10-lang-select');
        if(li){ const l = document.getElementById('lang-select'); if(l) li.value = l.value; }
        // Clock color
        const cp = document.getElementById('p10-clock-color');
        if(cp){ const c = document.getElementById('clock-color-picker'); if(c) cp.value = c.value; }
        // Accent
        const ca = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        if(ca) _p10refreshAccentSwatches(ca);
        // Font
        const fs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')||1);
        _p10refreshFontBtns(fs);
        // Pomo
        const pf = document.getElementById('p10-pomo-focus');
        if(pf){ const o = document.getElementById('custom-pomodoro'); if(o) pf.value = o.value||25; }
        const times = _p10lsGet('os_pomo_times', {short:5, long:15});
        const ps = document.getElementById('p10-pomo-short'); if(ps) ps.value = times.short||5;
        const pl = document.getElementById('p10-pomo-long');  if(pl) pl.value = times.long||15;
        const pss = document.getElementById('p10-pomo-sessions'); if(pss) pss.value = _p10lsGet('p9_pomo_sessions',4);
        // Goal
        const dg = document.getElementById('p10-daily-goal'); if(dg) dg.value = _p10lsGet('p9_daily_goal',4);
        // Grade scale
        const gs = document.getElementById('p10-grade-scale'); if(gs) gs.value = _p10lsGet('p9_grade_scale','pct');
        // Week start
        const ws = document.getElementById('p10-week-start'); if(ws) ws.value = _p10lsGet('p9_week_start','mon');
        // Exam warn
        const ew = document.getElementById('p10-exam-warn'); if(ew) ew.value = _p10lsGet('p9_exam_warn_days',14);
        // Widget toggles - sync from existing widget config
        _p10syncWidgetToggles();
        // Avatar
        _p10syncAvatar();
    } catch(e){ console.warn('[p10] settings sync error:', e); }
}

function _p10syncWidgetToggles(){
    const p9vis = _p10lsGet('p9_widget_vis', {weather:true, quote:true, habits:true});
    ['weather','quote','habits'].forEach(k => {
        const t = document.getElementById('p10-wt-'+k);
        if(t) t.classList.toggle('on', p9vis[k] !== false);
    });
    // Standard widgets - check their visibility from DOM
    ['links','goals','upnext','studystats','grades','minicalendar','quicknote','exams','music','forum'].forEach(k => {
        const widgetEl = document.getElementById('widget-'+k) || document.querySelector(`[data-widget="${k}"]`);
        const t = document.getElementById('p10-wt-'+k);
        if(t && widgetEl){
            const hidden = widgetEl.classList.contains('widget-hidden') || widgetEl.style.display === 'none';
            t.classList.toggle('on', !hidden);
        }
    });
}

/* Feedback */
window._p10submitFeedback = function(){
    const type = document.getElementById('p10-fb-type')?.value || 'general';
    const text = document.getElementById('p10-fb-text')?.value?.trim() || '';
    const status = document.getElementById('p10-feedback-status');
    if(!text){ if(status){status.textContent='⚠️ Please write something first!';status.className='err';} return; }
    if(status){ status.textContent='Sending…'; status.className=''; }
    const subject = encodeURIComponent(`StudentOS Feedback: ${type.charAt(0).toUpperCase()+type.slice(1)}`);
    const body = encodeURIComponent(`Type: ${type}\n\n${text}`);
    const a = document.createElement('a');
    a.href = `mailto:lars.dehairs@gmail.com?subject=${subject}&body=${body}`;
    a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if(status){ status.textContent='✓ Sent! Thank you 💌'; status.className='ok'; }
    const fb = document.getElementById('p10-fb-text'); if(fb) fb.value='';
    setTimeout(()=>{ if(status) status.textContent=''; }, 6000);
};

/* ================================================================
   SECTION 8 — QUOTE WIDGET SIZE (re-enforce via JS for robustness)
   ================================================================ */
function _p10fixQuoteSize(){
    const style = document.createElement('style');
    style.textContent = `
        #widget-quote .quote-text { font-size:.98rem !important; -webkit-line-clamp:8 !important; line-height:1.72 !important; }
        #widget-quote .quote-author { font-size:.8rem !important; }
        #widget-quote { min-height:140px; }
    `;
    document.head.appendChild(style);
}

/* ================================================================
   SECTION 9 — REDUCED MOTION
   ================================================================ */
function _p10applyMotion(){
    if(_p10lsGet('p10_reduced_motion', false)){
        document.documentElement.classList.add('p10-reduce-motion');
        const s = document.createElement('style');
        s.textContent = '.p10-reduce-motion *, .p10-reduce-motion *::before, .p10-reduce-motion *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }';
        document.head.appendChild(s);
    }
}

/* ================================================================
   INIT
   ================================================================ */
function _p10init(){
    // 1. Kill KaTeX preview immediately and observe for re-creation
    _p10killKatexPreview();

    // 2. Build settings tab
    _p10buildSettingsTab();

    // 3. Location modal gating for weather widget
    _p10patchWeatherWidget();

    // 4. Delete formula custom modal
    _p10patchFormulaDelete();

    // 5. Formula subject dropdown
    _p10patchFormulaModal();

    // 6. Enhanced formula subject pills
    _p10patchFormulaSubjectBar();

    // 7. Quote size
    _p10fixQuoteSize();

    // 8. Reduced motion
    _p10applyMotion();

    // 9. Re-kill katex every time modal-formula opens
    document.addEventListener('click', e => {
        if(e.target && (e.target.id === 'formula-modal-formula' || e.target.closest('#modal-formula'))){
            setTimeout(_p10killKatexPreview, 100);
        }
    });

    // 10. Watch for formula modal to open (for subject dropdown + preview kill)
    const obs = new MutationObserver(() => {
        const fModal = document.getElementById('modal-formula');
        if(fModal && !fModal.classList.contains('hidden')){
            _p10killKatexPreview();
            _p10patchFormulaModal();
        }
    });
    obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

    // 11. Render formula subject bar with new icons (after short delay for existing functions to load)
    setTimeout(() => {
        if(typeof window.renderFormulaSubjectBar === 'function') window.renderFormulaSubjectBar();
    }, 1200);

    console.log('[patches10] ✓ Loaded — Settings Tab · Location Modal · Formula Dropdown · Delete Modal · Light Mode · Quote Fix');
}

if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(_p10init, 500));
} else {
    setTimeout(_p10init, 500);
}
