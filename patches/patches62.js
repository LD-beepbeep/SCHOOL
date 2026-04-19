/* ================================================================
   StudentOS — patches62.js
   1.  Whiteboard settings in Appearance — injects a Whiteboard
       section into #p10-page-appearance with ID p62-wb-appearance
       (not targeted by patches60/61 removal logic).
   2.  Routine modal scrollable — adds max-height + overflow-y to
       #modal-routine-edit so the form scrolls on small screens.
   3.  Study habit widget fix — re-renders the habit grid after
       initApp() completes so Firebase-only data shows immediately
       without requiring the user to first click "Log today".
   ================================================================ */

(function _p62_init() {
    'use strict';

    /* ── tiny helpers ─────────────────────────────────────────── */
    var _lsG = function(k, d) { try { var v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch (_) { return d; } };
    var _lsS = function(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
    var _dbG = function(k, d) { try { return (window.DB && typeof window.DB.get === 'function') ? window.DB.get(k, d) : _lsG(k, d); } catch (_) { return d; } };
    var _dbS = function(k, v) { try { if (window.DB && typeof window.DB.set === 'function') window.DB.set(k, v); else _lsS(k, v); } catch (_) {} };

    function _wait(fn, interval, maxWait) {
        interval = interval || 100;
        maxWait  = maxWait  || 20000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  WHITEBOARD SETTINGS — inject into p10 Appearance page
           Uses ID p62-wb-appearance so patches60/61 won't remove it.
       ================================================================ */
    function _injectWbAppearance() {
        var appPage = document.getElementById('p10-page-appearance');
        if (!appPage) return false;
        if (document.getElementById('p62-wb-appearance')) return true;

        var sec = document.createElement('div');
        sec.id        = 'p62-wb-appearance';
        sec.className = 'p10-section';

        /* Section title */
        var title = document.createElement('div');
        title.className   = 'p10-section-title';
        title.textContent = 'Whiteboard';
        sec.appendChild(title);

        /* ── Default background row ─────────────────────────── */
        var PRESETS = [
            { hex: '#1a1a1a', label: 'Dark'     },
            { hex: '#0f172a', label: 'Navy'     },
            { hex: '#ffffff', label: 'White'    },
            { hex: '#fef9ef', label: 'Notebook' },
            { hex: '#1e3a5f', label: 'Ocean'    },
            { hex: '#14532d', label: 'Forest'   },
        ];

        var bgPicker = document.createElement('input');
        bgPicker.type  = 'color';
        bgPicker.id    = 'p62-wb-bg-picker';
        bgPicker.title = 'Custom colour';
        bgPicker.value = _dbG('os_wb_default_bg', '#1a1a1a');
        bgPicker.className = 'p62-wb-color-swatch';
        bgPicker.addEventListener('change', function() {
            _applyBg(bgPicker.value);
        });

        var bgSwatches = document.createElement('div');
        bgSwatches.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';

        PRESETS.forEach(function(p) {
            var btn = document.createElement('button');
            btn.type  = 'button';
            btn.title = p.label;
            btn.className = 'p62-wb-preset-btn';
            btn.style.background = p.hex;
            btn.addEventListener('click', function() {
                _applyBg(p.hex);
                bgPicker.value = p.hex;
            });
            bgSwatches.appendChild(btn);
        });
        bgSwatches.appendChild(bgPicker);

        function _applyBg(hex) {
            _dbS('os_wb_default_bg', hex);
            /* Sync other pickers that may exist */
            var p46 = document.getElementById('p46-wb-default-bg');
            if (p46) p46.value = hex;
            var mainPicker = document.getElementById('wb-default-bg-picker');
            if (mainPicker) mainPicker.value = hex;
            if (typeof window._setWbDefaultBg === 'function') window._setWbDefaultBg(hex);
        }

        var bgRow = document.createElement('div');
        bgRow.className = 'p10-row';
        var bgLeft = document.createElement('div');
        bgLeft.innerHTML = '<div class="p10-row-lbl">Default Background</div><div class="p10-row-sub">Colour when a new board opens</div>';
        bgRow.appendChild(bgLeft);
        bgRow.appendChild(bgSwatches);
        sec.appendChild(bgRow);

        /* ── Grid lines by default toggle ───────────────────── */
        var gridOn = _dbG('os_wb_grid_default', false);
        var gridToggle = document.createElement('div');
        gridToggle.id        = 'p62-wb-grid-toggle';
        gridToggle.className = 'p10-toggle' + (gridOn ? ' on' : '');
        gridToggle.style.cursor = 'pointer';
        gridToggle.setAttribute('role', 'switch');
        gridToggle.setAttribute('aria-checked', String(!!gridOn));
        gridToggle.addEventListener('click', function() {
            var next = !gridToggle.classList.contains('on');
            gridToggle.classList.toggle('on', next);
            gridToggle.setAttribute('aria-checked', String(next));
            _dbS('os_wb_grid_default', next);
            /* Sync main-modal toggle */
            var mainBtn = document.getElementById('wb-grid-default-toggle');
            if (mainBtn) {
                var dot = document.getElementById('wb-grid-default-dot');
                if (next) { mainBtn.style.background = 'var(--accent)'; if (dot) dot.style.transform = 'translateX(1.5rem)'; }
                else       { mainBtn.style.background = ''; if (dot) dot.style.transform = ''; }
            }
            /* Sync p46 toggle */
            var p46 = document.getElementById('p46-wb-grid-toggle');
            if (p46) p46.classList.toggle('on', next);
        });

        var gridRow = document.createElement('div');
        gridRow.className = 'p10-row';
        var gridLeft = document.createElement('div');
        gridLeft.innerHTML = '<div class="p10-row-lbl">Grid Lines by Default</div><div class="p10-row-sub">Show grid when whiteboard opens</div>';
        gridRow.appendChild(gridLeft);
        gridRow.appendChild(gridToggle);
        sec.appendChild(gridRow);

        /* ── Default pen colour row ─────────────────────────── */
        var penPicker = document.createElement('input');
        penPicker.type      = 'color';
        penPicker.id        = 'p62-wb-pen-picker';
        penPicker.title     = 'Default pen colour';
        penPicker.value     = _dbG('os_wb_pen_color', '#ffffff');
        penPicker.className = 'p62-wb-color-swatch';
        penPicker.addEventListener('change', function() {
            _dbS('os_wb_pen_color', penPicker.value);
            /* Sync p36 pen picker if present */
            var p36 = document.getElementById('p36-wb-pen-color');
            if (p36) p36.value = penPicker.value;
        });

        var penRow = document.createElement('div');
        penRow.className = 'p10-row';
        var penLeft = document.createElement('div');
        penLeft.innerHTML = '<div class="p10-row-lbl">Default Pen Colour</div><div class="p10-row-sub">Colour when whiteboard opens</div>';
        penRow.appendChild(penLeft);
        penRow.appendChild(penPicker);
        sec.appendChild(penRow);

        appPage.appendChild(sec);

        /* Sync toggle + picker values each time the settings panel opens */
        _wait(function() {
            if (typeof window.openModal !== 'function' || window._p62_omHooked) return true;
            window._p62_omHooked = true;
            var prev = window.openModal;
            window.openModal = function(id) {
                prev.apply(this, arguments);
                if (id === 'modal-settings') {
                    setTimeout(function() {
                        /* Re-read values in case they were changed from the whiteboard toolbar */
                        var bg  = _dbG('os_wb_default_bg', '#1a1a1a');
                        var grd = _dbG('os_wb_grid_default', false);
                        var pen = _dbG('os_wb_pen_color', '#ffffff');
                        var bp  = document.getElementById('p62-wb-bg-picker');
                        if (bp) bp.value = bg;
                        var gt  = document.getElementById('p62-wb-grid-toggle');
                        if (gt) { gt.classList.toggle('on', !!grd); gt.setAttribute('aria-checked', String(!!grd)); }
                        var pp  = document.getElementById('p62-wb-pen-picker');
                        if (pp) pp.value = pen;
                    }, 200);
                }
            };
            return true;
        }, 150, 10000);

        return true;
    }

    _wait(_injectWbAppearance, 200, 20000);

    /* ================================================================
       2.  ROUTINE MODAL — make scrollable
           Patches 16/17 inject #modal-routine-edit. We wait for it
           to appear then apply max-height + overflow-y so the form
           does not extend off-screen on small viewports.
       ================================================================ */
    function _makeRoutineModalScrollable() {
        var m = document.getElementById('modal-routine-edit');
        if (!m) return false;
        if (m.dataset.p62scroll) return true;
        m.dataset.p62scroll = '1';
        m.style.maxHeight   = '90vh';
        m.style.overflowY   = 'auto';
        return true;
    }

    _wait(_makeRoutineModalScrollable, 150, 20000);

    /* ================================================================
       3.  HABIT WIDGET — re-render after initApp (DB hydration)
           initApp() is always called after DB._hydrate(), so wrapping
           it guarantees _renderHabits runs with the full Firestore
           data available, fixing the issue where past studied days
           were invisible until the user clicked "Log today".
       ================================================================ */
    var _patchInitRetries = 0;
    function _patchInitApp() {
        if (typeof window.initApp !== 'function' || window._p62_initHooked) {
            if (!window._p62_initHooked && ++_patchInitRetries < 60) setTimeout(_patchInitApp, 300);
            return;
        }
        window._p62_initHooked = true;
        var orig = window.initApp;
        window.initApp = function() {
            orig.apply(this, arguments);
            /* DB is now hydrated — re-render habit widget so past days appear */
            setTimeout(function() {
                var inner = document.querySelector('#widget-habits .habit-inner');
                if (inner && typeof window._renderHabits === 'function') {
                    window._renderHabits(inner);
                }
            }, 200);
        };
    }
    _patchInitApp();

    console.log('[patches62] loaded — whiteboard appearance settings, routine modal scroll, habit widget fix');
}());
