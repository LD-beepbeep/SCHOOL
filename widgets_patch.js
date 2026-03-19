/* ================================================================
   StudentOS — widgets_patch.js
   Rebuilds the "Customize Widgets" modal so that:
   · Every widget (including Today, Weather, Quote, Habits) appears
   · Every widget has a consistent icon (no emoji mix)
   · Every widget has a color tint picker
   · Toggling any widget actually hides/shows it correctly
   · Saved state is restored on load

   INSTALL: add to index.html after all other scripts
   <script type="module" src="widgets_patch.js"></script>
   ================================================================ */

/* All widgets the app can have, in display order */
const WP_WIDGETS = [
    { id: 'today',       label: 'Today Overview',   icon: 'ph-sun-horizon',      color: '#f59e0b' },
    { id: 'links',       label: 'Quick Links',       icon: 'ph-link',             color: '#3b82f6' },
    { id: 'goals',       label: 'Daily Goals',       icon: 'ph-check-circle',     color: '#22c55e' },
    { id: 'upnext',      label: 'Up Next',           icon: 'ph-lightning',        color: '#f59e0b' },
    { id: 'studystats',  label: 'Study Stats',       icon: 'ph-chart-bar',        color: '#8b5cf6' },
    { id: 'grades',      label: 'Grades Overview',   icon: 'ph-medal',            color: '#14b8a6' },
    { id: 'minicalendar',label: 'Upcoming Events',   icon: 'ph-calendar-blank',   color: '#ec4899' },
    { id: 'quicknote',   label: 'Quick Note',        icon: 'ph-note-pencil',      color: '#f97316' },
    { id: 'exams',       label: 'Exam Countdown',    icon: 'ph-graduation-cap',   color: '#ef4444' },
    { id: 'music',       label: 'Music Player',      icon: 'ph-music-note',       color: '#8b5cf6' },
    { id: 'forum',       label: 'Forum Quick Ask',   icon: 'ph-chats-teardrop',   color: '#3b82f6' },
    { id: 'weather',     label: 'Weather',           icon: 'ph-cloud-sun',        color: '#0ea5e9' },
    { id: 'quote',       label: 'Quote of the Day',  icon: 'ph-quotes',           color: '#6b7280' },
    { id: 'habits',      label: 'Study Habits',      icon: 'ph-flame',            color: '#f97316' },
];

/* ── helpers ── */
function _wpLsG(k, d) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } }
function _wpLsS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* Unified visibility getter — checks all the different stores used by
   script.js (widgetConfig / os_widgets) and patches9 (p9_widget_vis)  */
function _wpIsVisible(id) {
    // patches9 widgets stored separately
    if (['weather', 'quote', 'habits'].includes(id)) {
        const p9 = _wpLsG('p9_widget_vis', {});
        return p9[id] !== false;
    }
    // script.js widgets via os_widgets
    const cfg = (window.DB?.get?.('os_widgets', {}) || _wpLsG('os_widgets', {}));
    if (cfg[id] && cfg[id].visible === false) return false;
    return true; // default visible
}

/* Unified color getter */
function _wpGetColor(id, fallback) {
    const cfg = (window.DB?.get?.('os_widgets', {}) || _wpLsG('os_widgets', {}));
    return (cfg[id] && cfg[id].color) || fallback;
}

/* Unified toggle */
function _wpSetVisible(id, vis) {
    if (['weather', 'quote', 'habits'].includes(id)) {
        const p9 = _wpLsG('p9_widget_vis', {});
        p9[id] = vis;
        _wpLsS('p9_widget_vis', p9);
        const el = document.getElementById('widget-' + id);
        if (el) el.classList.toggle('widget-hidden', !vis);
        return;
    }
    // today widget — stored in its own key
    if (id === 'today') {
        _wpLsS('wp_today_vis', vis);
        const el = document.getElementById('widget-today');
        if (el) el.classList.toggle('widget-hidden', !vis);
        return;
    }
    // standard widgets via script.js
    if (typeof window.setWidgetVisible === 'function') {
        window.setWidgetVisible(id, vis);
    } else {
        const el = document.getElementById('widget-' + id);
        if (el) el.classList.toggle('widget-hidden', !vis);
    }
}

/* Unified color setter */
function _wpSetColor(id, color) {
    // All widgets get a subtle border tint
    const el = document.getElementById('widget-' + id);
    if (el) el.style.borderColor = color + '55';
    // Persist via script.js for standard widgets
    if (typeof window.setWidgetColor === 'function') {
        window.setWidgetColor(id, color);
    } else {
        // Fallback: save directly
        const cfg = (window.DB?.get?.('os_widgets', {}) || _wpLsG('os_widgets', {}));
        if (!cfg[id]) cfg[id] = {};
        cfg[id].color = color;
        if (window.DB?.set) window.DB.set('os_widgets', cfg);
        else _wpLsS('os_widgets', cfg);
    }
    // Also store in our own key so we can read it back
    _wpLsS('wp_color_' + id, color);
}

/* ── Build & inject the modal content ── */
function _wpBuildModal() {
    const modal = document.getElementById('modal-widgets');
    if (!modal) return;

    // Rebuild inner HTML completely
    modal.innerHTML = `
        <h3 style="font-size:1.05rem;font-weight:600;margin-bottom:4px;">Customize Widgets</h3>
        <p style="font-size:.72rem;color:var(--text-muted);margin-bottom:16px;">Toggle · reorder by dragging · tint color</p>
        <div id="wp-widget-list" style="display:flex;flex-direction:column;gap:6px;"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:18px;">
            <button onclick="closeModals()"
                    style="padding:9px 22px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:.85rem;font-weight:700;cursor:pointer;">
                Done
            </button>
        </div>
    `;

    const list = document.getElementById('wp-widget-list');

    WP_WIDGETS.forEach(w => {
        const visible = w.id === 'today'
            ? _wpLsG('wp_today_vis', true)
            : _wpIsVisible(w.id);
        const color   = _wpLsG('wp_color_' + w.id, null) || _wpGetColor(w.id, w.color);

        const row = document.createElement('div');
        row.style.cssText = `
            display:flex;align-items:center;justify-content:space-between;
            padding:10px 14px;
            background:var(--glass-panel);
            border:1px solid rgba(255,255,255,.06);
            border-radius:14px;
            gap:10px;
        `;
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <div style="width:30px;height:30px;border-radius:9px;background:${color}22;
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="ph ${w.icon}" style="color:${color};font-size:1rem;"></i>
                </div>
                <label for="wp-vis-${w.id}" style="font-size:.85rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${w.label}
                </label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <input type="color" id="wp-col-${w.id}" value="${color}"
                       title="Tint color"
                       style="width:22px;height:22px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.15);cursor:pointer;background:none;"
                       onchange="_wpSetColor('${w.id}',this.value);document.querySelector('#wp-vis-${w.id}').closest('div').previousElementSibling.querySelector('i').style.color=this.value;document.querySelector('#wp-vis-${w.id}').closest('div').previousElementSibling.querySelector('div').style.background=this.value+'22'">
                <div id="wp-vis-${w.id}"
                     class="${visible ? 'wp-toggle on' : 'wp-toggle'}"
                     onclick="_wpToggle('${w.id}', this)"
                     style="cursor:pointer;"></div>
            </div>
        `;
        list.appendChild(row);
    });
}

/* Toggle handler called from the inline onclick */
window._wpToggle = function(id, toggleEl) {
    const isOn = toggleEl.classList.toggle('on');
    _wpSetVisible(id, isOn);
};

/* ── Toggle styles (injected once) ── */
function _wpInjectStyles() {
    if (document.getElementById('wp-toggle-style')) return;
    const s = document.createElement('style');
    s.id = 'wp-toggle-style';
    s.textContent = `
        .wp-toggle {
            width: 42px; height: 24px; border-radius: 12px;
            background: rgba(255,255,255,.1);
            border: 1px solid rgba(255,255,255,.12);
            position: relative; transition: background .2s;
            flex-shrink: 0;
        }
        [data-theme="light"] .wp-toggle {
            background: rgba(0,0,0,.1);
            border-color: rgba(0,0,0,.12);
        }
        .wp-toggle.on { background: var(--accent); border-color: transparent; }
        .wp-toggle::after {
            content: ''; position: absolute;
            width: 18px; height: 18px; border-radius: 50%;
            background: #fff; top: 2px; left: 3px;
            transition: transform .2s;
            box-shadow: 0 1px 4px rgba(0,0,0,.25);
        }
        .wp-toggle.on::after { transform: translateX(18px); }

        /* Light mode row background */
        [data-theme="light"] #wp-widget-list > div {
            background: rgba(255,255,255,.88) !important;
            border-color: rgba(0,0,0,.07) !important;
        }
    `;
    document.head.appendChild(s);
}

/* ── Apply saved visibility on load ── */
function _wpApplyOnLoad() {
    WP_WIDGETS.forEach(w => {
        // today widget
        if (w.id === 'today') {
            const vis = _wpLsG('wp_today_vis', true);
            const el = document.getElementById('widget-today');
            if (el) el.classList.toggle('widget-hidden', !vis);
            return;
        }
        // color tints
        const saved = _wpLsG('wp_color_' + w.id, null);
        if (saved) {
            const el = document.getElementById('widget-' + w.id);
            if (el) el.style.borderColor = saved + '55';
        }
    });
}

/* ── Patch the Widgets button to rebuild modal on each open ── */
function _wpPatchOpenModal() {
    function _try() {
        if (typeof window.openModal !== 'function') { setTimeout(_try, 300); return; }
        if (window._wp_patched) return;
        window._wp_patched = true;
        const _orig = window.openModal;
        window.openModal = function(id) {
            if (id === 'modal-widgets') _wpBuildModal();
            _orig(id);
        };
    }
    _try();
}

/* ── Init ── */
(function _wpInit() {
    _wpInjectStyles();
    _wpPatchOpenModal();
    // Apply saved colors/visibility after widgets are injected by other patches
    setTimeout(_wpApplyOnLoad, 1200);
})();
