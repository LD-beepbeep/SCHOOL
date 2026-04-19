/* ================================================================
   StudentOS — patches36.js
   1.  Whiteboard grid — adaptive line color for light canvases
   2.  Whiteboard image overlay — fix resize pointer-capture bug
   3.  Settings — move Sidebar page into the Tools section
   4.  Settings — add more options (notes sidebar, startup tab,
       task density, default whiteboard background)
   5.  Task list style selector — body-class reliability fix
   ================================================================ */

'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const _p36lsG = (k, d) => {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; }
};
const _p36lsS = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};
const _p36dbG = (k, d) => {
    try { return window.DB?.get ? window.DB.get(k, d) : _p36lsG(k, d); } catch { return d; }
};
const _p36dbS = (k, v) => {
    try { if (window.DB?.set) window.DB.set(k, v); else _p36lsS(k, v); } catch {}
};

function _p36waitFor(fn, interval) {
    (function _try() { if (!fn()) setTimeout(_try, interval || 250); })();
}

/* ================================================================
   1.  GRID — ADAPTIVE LINE COLOR FOR LIGHT / WHITE CANVASES
   ================================================================ */

/*
 * The CSS overlay in patches32.css uses semi-transparent grey lines.
 * On dark canvases these are visible; on white / very light canvases
 * they become invisible.
 *
 * Fix: compute the perceived luminance of the active canvas background
 * and add/remove the class  wb-grid-light  on the overlay.
 * patches36.css maps  .wb-grid-light  to dark (black-ish) lines.
 */

function _p36_hexLum(hex) {
    /* Returns perceived luminance [0,1] for "#rgb" or "#rrggbb".
       Returns 0 on parse failure (treated as dark). */
    if (!hex || hex[0] !== '#') return 0;
    var h = hex.slice(1);
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length !== 6) return 0;
    var r = parseInt(h.slice(0,2),16) / 255;
    var g = parseInt(h.slice(2,4),16) / 255;
    var b = parseInt(h.slice(4,6),16) / 255;
    /* sRGB luminance (ITU-R BT.709) */
    return 0.2126*r + 0.7152*g + 0.0722*b;
}

function _p36_gridColorSync() {
    var ov = document.getElementById('wb-grid-overlay');
    if (!ov) return;

    var bg = (typeof window.wbGetBg === 'function')
        ? window.wbGetBg()
        : _p36dbG('os_wb_bg_' + (window.wbActiveBoardId ?? 1), '#1a1a1a');

    /* luminance > 0.45 → treat as light canvas → dark grid lines */
    var isLight = _p36_hexLum(bg) > 0.45;
    ov.classList.toggle('wb-grid-light', isLight);
}

(function _p36_gridColor() {
    /* Wrap wbToggleGrid (already replaced by patches32/34) */
    _p36waitFor(function() {
        if (typeof window.wbToggleGrid !== 'function') return false;
        if (window._p36gcDone) return true;
        window._p36gcDone = true;

        var _orig = window.wbToggleGrid;
        window.wbToggleGrid = function() {
            _orig.apply(this, arguments);
            _p36_gridColorSync();
        };
        return true;
    });

    /* Wrap setWbBg so the grid re-checks color when bg changes */
    _p36waitFor(function() {
        if (typeof window.setWbBg !== 'function') return false;
        if (window._p36bgDone) return true;
        window._p36bgDone = true;

        var _orig = window.setWbBg;
        window.setWbBg = function() {
            _orig.apply(this, arguments);
            _p36_gridColorSync();
        };
        return true;
    });

    /* Sync when whiteboard tab is opened */
    _p36waitFor(function() {
        if (typeof window.switchTab !== 'function') return false;
        if (window._p36stGcDone) return true;
        window._p36stGcDone = true;

        var _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            if (name === 'whiteboard') setTimeout(_p36_gridColorSync, 250);
        };
        return true;
    });

    /* Also sync on initial load */
    setTimeout(_p36_gridColorSync, 1500);
})();

/* ================================================================
   2.  IMAGE OVERLAY — FIX RESIZE POINTER-CAPTURE BUG
   ================================================================ */

/*
 * patches32 creates the overlay and sets up resize handles.
 * The bug: inside each handle's pointerdown it calls
 *   ov.setPointerCapture(e.pointerId)
 * — capturing on the OVERLAY, not the HANDLE.  This routes
 *   subsequent events to ov.pointermove, not h.pointermove, so
 *   the resize logic on h never fires.
 *
 * Fix: clone each handle to strip its listeners, re-attach them
 * using  h.setPointerCapture()  so events stay on the handle.
 */

(function _p36_imgResize() {
    var _resizing  = false;
    var _resizeDir = '';
    var _sx = 0, _sy = 0, _sw = 0, _sh = 0, _sl = 0, _st = 0;

    _p36waitFor(function() {
        var ov = document.getElementById('p32-img-overlay');
        if (!ov || ov.dataset.p36fixed) return false;
        ov.dataset.p36fixed = '1';

        ov.querySelectorAll('.p32-img-handle').forEach(function(h) {
            /* Clone to remove all listeners attached by patches32 */
            var clone = h.cloneNode(true);
            h.parentNode.replaceChild(clone, h);

            clone.addEventListener('pointerdown', function(e) {
                e.stopPropagation();
                _resizing  = true;
                _resizeDir = clone.dataset.dir;
                _sx = e.clientX; _sy = e.clientY;
                _sw = ov.offsetWidth;  _sh = ov.offsetHeight;
                _sl = ov.offsetLeft;   _st = ov.offsetTop;
                /* Capture on the HANDLE — events follow it correctly */
                clone.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            clone.addEventListener('pointermove', function(e) {
                if (!_resizing) return;
                var dx = e.clientX - _sx;
                var dy = e.clientY - _sy;
                var nW = _sw, nH = _sh, nL = _sl, nT = _st;

                if (_resizeDir.includes('e')) nW = Math.max(40, _sw + dx);
                if (_resizeDir.includes('s')) nH = Math.max(40, _sh + dy);
                if (_resizeDir.includes('w')) { nW = Math.max(40, _sw - dx); nL = _sl + (_sw - nW); }
                if (_resizeDir.includes('n')) { nH = Math.max(40, _sh - dy); nT = _st + (_sh - nH); }

                ov.style.width  = nW + 'px';
                ov.style.height = nH + 'px';
                ov.style.left   = nL + 'px';
                ov.style.top    = nT + 'px';
            });

            clone.addEventListener('pointerup', function() {
                _resizing = false;
            });

            clone.addEventListener('pointercancel', function() {
                _resizing = false;
            });
        });

        return true;
    });
})();

/* ================================================================
   3.  SETTINGS — MOVE SIDEBAR PAGE INTO THE TOOLS SECTION
   ================================================================ */

/*
 * patches21 injects the Sidebar settings nav button just before the
 * sign-out div (at the bottom of the nav, after "About").
 * The user wants it in the Tools section (after Shortcuts, before
 * the More section label).
 */

(function _p36_sidebarUnderTools() {
    function _try() {
        var nav = document.getElementById('p10-stab-sidebar');
        if (!nav) { setTimeout(_try, 800); return; }

        var sidebarBtn = nav.querySelector('[data-page="sidebar"]');
        if (!sidebarBtn) { setTimeout(_try, 800); return; }

        /* Find the "More" section label */
        var moreLabel = null;
        nav.querySelectorAll('.p10-stab-section-lbl').forEach(function(lbl) {
            if (lbl.textContent.trim() === 'More') moreLabel = lbl;
        });
        if (!moreLabel) { setTimeout(_try, 800); return; }

        /* Only move if the button is NOT already before the More label */
        /* (insertBefore is idempotent if already in the right place) */
        nav.insertBefore(sidebarBtn, moreLabel);

        /* Update the button icon to be more descriptive */
        if (!sidebarBtn.dataset.p36moved) {
            sidebarBtn.dataset.p36moved = '1';
            sidebarBtn.innerHTML = '<i class="fa-solid fa-bars"></i> Sidebar';
        }
    }
    /* Run after patches21 has had time to inject its button */
    setTimeout(_try, 1500);
    setTimeout(_try, 3000);
})();

/* ================================================================
   4.  SETTINGS — MORE OPTIONS
   ================================================================ */

/*
 * Injects additional settings rows into existing pages:
 *   • Sidebar page  → Notes sidebar show/hide toggle
 *   • Appearance    → Startup tab selector
 *   • Visual (p13)  → Nothing new; task-style row already exists
 */

(function _p36_moreSettings() {

    /* ── 4a. Notes sidebar toggle ── */
    function _injectNotesSidebarToggle() {
        var sidebarPage = document.getElementById('p10-page-sidebar');
        if (!sidebarPage || sidebarPage.querySelector('#p36-nst-row')) return false;

        var section = sidebarPage.querySelector('.p10-section');
        if (!section) return false;

        var isShown = !_p36lsG('os_notes_sidebar_hidden', false);
        var row = document.createElement('div');
        row.id = 'p36-nst-row';
        row.className = 'p10-row';
        row.innerHTML = [
            '<div>',
            '  <div class="p10-row-lbl">Show Notes Sidebar</div>',
            '  <div class="p10-row-sub">Left panel in the Notes tab</div>',
            '</div>',
            '<div id="p36-nst-tog" class="p10-toggle' + (isShown ? ' on' : '') + '"',
            '     onclick="_p36toggleNotesSidebar()"></div>',
        ].join('');
        section.appendChild(row);
        return true;
    }

    /* ── 4b. Startup tab selector ── */
    function _injectStartupTab() {
        var appearPage = document.getElementById('p10-page-appearance');
        if (!appearPage || appearPage.querySelector('#p36-startup-section')) return false;

        var extraSection = document.createElement('div');
        extraSection.id = 'p36-startup-section';
        extraSection.className = 'p10-section';
        extraSection.innerHTML = [
            '<div class="p10-section-title">Startup</div>',
            '<div class="p10-row">',
            '  <div>',
            '    <div class="p10-row-lbl">Startup Tab</div>',
            '    <div class="p10-row-sub">Which tab opens when the app loads</div>',
            '  </div>',
            '  <select id="p36-startup-tab" class="p10-select"',
            '          onchange="_p36setStartupTab(this.value)">',
            '    <option value="">Last visited</option>',
            '    <option value="dashboard">Dashboard</option>',
            '    <option value="tasks">Tasks</option>',
            '    <option value="notes">Notes</option>',
            '    <option value="whiteboard">Whiteboard</option>',
            '    <option value="cards">Flashcards</option>',
            '    <option value="music">Music</option>',
            '  </select>',
            '</div>',
        ].join('');
        appearPage.appendChild(extraSection);

        var sel = document.getElementById('p36-startup-tab');
        if (sel) sel.value = _p36lsG('p36_startup_tab', '');
        return true;
    }

    /* ── 4c. Whiteboard default pen color ── */
    function _injectWbDefaults() {
        var wbPage = document.getElementById('p10-page-widgets');
        if (!wbPage || wbPage.querySelector('#p36-wb-section')) return false;

        var section = document.createElement('div');
        section.id = 'p36-wb-section';
        section.className = 'p10-section';
        section.innerHTML = [
            '<div class="p10-section-title">Whiteboard</div>',
            '<div class="p10-row">',
            '  <div>',
            '    <div class="p10-row-lbl">Default Pen Color</div>',
            '    <div class="p10-row-sub">Color when whiteboard opens</div>',
            '  </div>',
            '  <input type="color" id="p36-wb-pen-color"',
            '         style="width:32px;height:32px;border-radius:50%;padding:0;',
            '                border:2px solid rgba(255,255,255,.15);cursor:pointer;"',
            '         onchange="_p36setWbPenColor(this.value)">',
            '</div>',
            '<div class="p10-row">',
            '  <div>',
            '    <div class="p10-row-lbl">Default Canvas Background</div>',
            '    <div class="p10-row-sub">Starting background for new boards</div>',
            '  </div>',
            '  <select id="p36-wb-bg-default" class="p10-select"',
            '          onchange="_p36setWbBgDefault(this.value)">',
            '    <option value="#1a1a1a">Dark</option>',
            '    <option value="#ffffff">White</option>',
            '    <option value="#0f172a">Navy</option>',
            '    <option value="#1e1b4b">Indigo</option>',
            '    <option value="#f8fafc">Off-white</option>',
            '  </select>',
            '</div>',
        ].join('');
        wbPage.appendChild(section);

        var penCol = _p36lsG('p36_wb_pen_color', '#ffffff');
        var penInp = document.getElementById('p36-wb-pen-color');
        if (penInp) penInp.value = penCol;

        var bgSel = document.getElementById('p36-wb-bg-default');
        if (bgSel) bgSel.value = _p36lsG('p36_wb_bg_default', '#1a1a1a');
        return true;
    }

    function _tryAll() {
        var done1 = _injectNotesSidebarToggle();
        var done2 = _injectStartupTab();
        var done3 = _injectWbDefaults();
        if (!done1 || !done2 || !done3) setTimeout(_tryAll, 1000);
    }

    setTimeout(_tryAll, 1500);
    setTimeout(_tryAll, 3500);
})();

/* ── Handlers exposed globally ── */

window._p36toggleNotesSidebar = function() {
    var wasHidden = _p36lsG('os_notes_sidebar_hidden', false);
    var nowHidden = !wasHidden;
    _p36lsS('os_notes_sidebar_hidden', nowHidden);

    var tog = document.getElementById('p36-nst-tog');
    if (tog) tog.classList.toggle('on', !nowHidden);

    /* Apply layout class */
    var layout = document.querySelector('.notes-layout');
    if (layout) layout.classList.toggle('sidebar-hidden', nowHidden);

    /* Mirror to script.js variable */
    if (typeof window.notesSidebarHidden !== 'undefined') {
        window.notesSidebarHidden = nowHidden;
    }
};

window._p36setStartupTab = function(tab) {
    _p36lsS('p36_startup_tab', tab);
};

window._p36setWbPenColor = function(color) {
    _p36lsS('p36_wb_pen_color', color);
    if (typeof window.setPenColor === 'function') window.setPenColor(color);
};

window._p36setWbBgDefault = function(color) {
    _p36lsS('p36_wb_bg_default', color);
};

/* Apply startup tab on load (only once, only if preference is set) */
(function _p36_applyStartupTab() {
    _p36waitFor(function() {
        if (typeof window.switchTab !== 'function') return false;
        var tab = _p36lsG('p36_startup_tab', '');
        if (tab) {
            setTimeout(function() {
                /* Check we are on the default/first tab before switching */
                if (tab) window.switchTab(tab);
            }, 1400);
        }
        /* Apply saved whiteboard default pen color */
        var penColor = _p36lsG('p36_wb_pen_color', '');
        if (penColor && typeof window.setPenColor === 'function') {
            window.setPenColor(penColor);
        }
        return true;
    });
})();

/* ================================================================
   5.  TASK LIST STYLE — BODY-CLASS RELIABILITY FIX
   ================================================================ */

/*
 * patches13 injects CSS targeting .task-row, which should work but
 * can be overridden in edge cases by Tailwind CDN utility classes.
 *
 * We add a complementary body-class approach (patches36.css handles
 * the visual rules for body.p36-task-compact and
 * body.p36-task-comfortable) which provides higher specificity
 * (body.class .task-row > .py-2\.5).
 *
 * We wrap _p13applyTaskStyle to also toggle the body class.
 */

(function _p36_taskStyle() {
    var _classes = {
        compact:     'p36-task-compact',
        comfortable: 'p36-task-comfortable',
    };

    function _applyBodyClass(val) {
        Object.values(_classes).forEach(function(c) { document.body.classList.remove(c); });
        if (_classes[val]) document.body.classList.add(_classes[val]);
    }

    /* Wrap patches13's function as soon as it is available */
    _p36waitFor(function() {
        if (typeof window._p13applyTaskStyle !== 'function') return false;
        if (window._p36taskStyleDone) return true;
        window._p36taskStyleDone = true;

        var _orig = window._p13applyTaskStyle;
        window._p13applyTaskStyle = function(val) {
            _orig.apply(this, arguments);
            _applyBodyClass(val);
        };
        return true;
    });

    /* Also apply on page load from the saved value */
    var saved = _p36lsG('p13_task_style', 'default');
    if (saved && saved !== 'default') {
        /* DOM might not be ready yet — apply after a short delay */
        setTimeout(function() { _applyBodyClass(saved); }, 600);
    }
})();

/* ================================================================
   INIT
   ================================================================ */
console.log('[patches36] loaded — grid color, image resize fix, sidebar under tools, more settings, task style fix');
