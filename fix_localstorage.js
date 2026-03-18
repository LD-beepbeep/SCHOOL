/* ================================================================
   fix_localstorage.js — Offline localStorage persistence
   ================================================================
   SETUP — add ONE line to script.js right after the DB definition
   (around line 59, after the closing `})();` of the DB IIFE):

       window.DB = DB;

   Then add this script to index.html after all other scripts:
   <script type="module" src="fix_localstorage.js"></script>

   WHAT IT DOES:
   - Every 500ms: reads all data from window.DB and writes to localStorage
   - On offline button click: reads localStorage back into window.DB
   - Shows an amber banner while offline
   ================================================================ */

/* All keys that StudentOS stores in DB */
var KEYS = [
    'os_tasks', 'os_notes', 'os_decks', 'os_goals',
    'os_events', 'os_subjects', 'os_links', 'os_streak',
    'os_card_stats', 'os_deck_groups', 'os_note_groups',
    'os_quick_note', 'os_pomo_times', 'os_pomo_today',
    'os_widgets', 'os_theme', 'os_accent', 'os_font_scale',
    'os_name', 'os_formulas', 'os_exams', 'os_music_custom',
    'os_clock_color', 'os_bg_color', 'os_profile',
    'os_wb_boards', 'os_cal_urls', 'os_pomo_autobreak',
];

/* ── Helpers ── */
function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
}
function lsGet(k, def) {
    try {
        var v = localStorage.getItem(k);
        return v !== null ? JSON.parse(v) : def;
    } catch(e) { return def; }
}

/* ── Save snapshot ── */
function saveAll() {
    if (!window.DB || typeof window.DB.get !== 'function') return;
    KEYS.forEach(function(k) {
        var v = window.DB.get(k, null);
        if (v !== null) lsSet(k, v);
    });
}

/* ── Restore from localStorage into DB ── */
function restoreAll() {
    if (!window.DB || typeof window.DB._hydrate !== 'function') return;
    var data = {};
    KEYS.forEach(function(k) {
        var v = lsGet(k, null);
        if (v !== null) data[k] = v;
    });
    var count = Object.keys(data).length;
    if (count > 0) {
        window.DB._hydrate(data);
        console.log('[fix_localstorage] Restored', count, 'keys from localStorage');
    }
    return count;
}

/* ── Wrap DB.set so every write ALSO goes to localStorage ── */
function wrapDBset() {
    if (!window.DB || !window.DB.set || window.DB._lsWrapped) {
        setTimeout(wrapDBset, 300);
        return;
    }
    window.DB._lsWrapped = true;
    var orig = window.DB.set.bind(window.DB);
    window.DB.set = function(key, val) {
        orig(key, val);
        lsSet(key, val);
    };
    console.log('[fix_localstorage] DB.set wrapped — writes mirror to localStorage');
}
wrapDBset();

/* ── 500ms interval snapshot ── */
setInterval(saveAll, 500);

/* ── Offline button: restore from localStorage ── */
function watchOfflineBtn() {
    var overlay = document.getElementById('login-overlay');
    if (!overlay) { setTimeout(watchOfflineBtn, 300); return; }

    var btn = Array.from(overlay.querySelectorAll('button')).find(function(b) {
        return /offline/i.test(b.textContent);
    });
    if (!btn || btn.dataset.lsHook) { setTimeout(watchOfflineBtn, 400); return; }
    btn.dataset.lsHook = '1';

    btn.addEventListener('click', function() {
        /* Wait for initApp to run, then restore */
        setTimeout(function() {
            var n = restoreAll();
            if (n > 0) {
                /* Re-render everything */
                if (typeof window.renderTasks      === 'function') window.renderTasks();
                if (typeof window.renderNotes      === 'function') window.renderNotes();
                if (typeof window.renderDecks      === 'function') window.renderDecks();
                if (typeof window.renderGrades     === 'function') window.renderGrades();
                if (typeof window.renderCalendar   === 'function') window.renderCalendar();
                if (typeof window.updateDashWidgets === 'function') window.updateDashWidgets();
            }
            showBanner(n);
        }, 600);
    }, { once: true });
}
watchOfflineBtn();

/* ── Amber banner ── */
function showBanner(keysRestored) {
    if (document.getElementById('ls-offline-banner')) return;
    var b = document.createElement('div');
    b.id = 'ls-offline-banner';
    var msg = keysRestored > 0
        ? '\u2601\uFE0F Offline \u2014 ' + keysRestored + ' data keys restored from last session'
        : '\u2601\uFE0F Offline \u2014 changes save to this browser';
    b.innerHTML = msg;
    b.style.cssText =
        'position:fixed;top:12px;left:50%;transform:translateX(-50%);' +
        'z-index:9999;background:rgba(245,158,11,.18);' +
        'border:1px solid rgba(245,158,11,.4);border-radius:20px;' +
        'padding:6px 18px;font-size:.72rem;font-weight:700;color:#fbbf24;' +
        'backdrop-filter:blur(10px);white-space:nowrap;pointer-events:none;' +
        'display:flex;align-items:center;gap:8px;';
    document.body.appendChild(b);
    /* Shrink to corner after 6 s, stays visible */
    setTimeout(function() {
        b.style.transition = 'all .5s ease';
        b.style.top  = '4px';
        b.style.fontSize = '.58rem';
        b.style.padding = '3px 10px';
        b.innerHTML = '\u2601\uFE0F Offline';
    }, 6000);
}

/* ── Tip in console if window.DB not exported ── */
setTimeout(function() {
    if (!window.DB) {
        console.warn(
            '[fix_localstorage] window.DB not found!\n' +
            'Add this ONE LINE to script.js, right after the DB closing })(); on line ~59:\n\n' +
            '   window.DB = DB;\n\n' +
            'Without it, localStorage persistence cannot work.'
        );
    }
}, 2500);

console.log('[fix_localstorage] Loaded — 500ms snapshot active');
