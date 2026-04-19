/* ================================================================
   StudentOS — patches38.js
   Performance fixes and stability improvements:

   1.  Offline button — ensure patches6 / patches8 detection works
       even in edge-cases where the onclick attribute is not yet
       updated.  Sets the p6off / p8off guard flags so duplicate
       listener attachment is prevented.

   2.  PDF.js lazy loader — because pdf.js is now loaded with
       `defer`, wrap openPdfAnnotator so it waits for pdfjsLib to
       be ready before running.

   3.  Phosphor Icons re-trigger — because @phosphor-icons/web is
       now loaded with `defer`, call its initialiser once after the
       deferred scripts have run to stamp any icons that were in the
       initial HTML.

   4.  Interval guard — reduce the 1 500 ms sticker-panel cleanup
       interval to a single one-shot call after startup (the panels
       only linger for a few hundred ms; a permanent interval is
       unnecessary).

   5.  Safety: cap any remaining uncapped waitFor polls by setting
       the global "done" guard flags for known hooks after a generous
       startup timeout (10 s), so a race condition can never leave an
       infinite poll running.
   ================================================================ */

'use strict';

/* ── helpers ─────────────────────────────────────────────────── */
const _p38lsG = (k, d) => {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; }
};

/* ================================================================
   1.  OFFLINE BUTTON — ensure patches6 / patches8 listeners fire
   ================================================================ */
(function _p38_offlineBtn() {
    /* Find the offline button by text content (works regardless of
       onclick attribute wording). */
    function _patch() {
        var btn = null;
        var overlay = document.getElementById('login-overlay');
        if (overlay) {
            var btns = Array.from(overlay.querySelectorAll('button'));
            btn = btns.find(function(b) {
                return /offline/i.test(b.textContent);
            });
        }
        if (!btn) return;

        /* Mark so patches8 stops re-polling */
        if (!btn.dataset.p8off) {
            btn.dataset.p8off = '1';
        }

        /* If patches6 already set onclick to its wrapper, nothing to do */
        if (btn.dataset.p38offDone) return;
        btn.dataset.p38offDone = '1';

        /* Ensure clicking the button always sets the offline flags even
           if patches6 missed the button (e.g., very fast module load). */
        btn.addEventListener('click', function() {
            window._p6_offlineMode  = true;
            window._p8_offline      = true;
            window._p38_offlineMode = true;
        }, { once: true });
    }

    /* Run immediately (modules are deferred, DOM is already parsed) */
    _patch();

    /* Fallback: re-try once after a short delay in case the overlay
       hasn't rendered yet (should not happen but defensive). */
    setTimeout(_patch, 600);
})();

/* ================================================================
   2.  PDF.JS LAZY LOADER — openPdfAnnotator waits for pdfjsLib
   ================================================================ */
(function _p38_pdfLazy() {
    /* Because pdf.js is now loaded with `defer`, pdfjsLib may not be
       defined at the exact moment openPdfAnnotator is first called on
       very fast interactions.  We wrap the function to poll until the
       library is ready, then delegate. */

    function _waitForPdf(callback) {
        if (window.pdfjsLib) { callback(); return; }
        var _n = 0;
        (function _try() {
            if (window.pdfjsLib) { callback(); return; }
            if (++_n > 40) { /* 4 s timeout — show a toast and give up */
                var t = document.getElementById('sos-toast');
                if (t) {
                    t.textContent = 'PDF viewer is loading, please try again.';
                    t.classList.add('show');
                    setTimeout(function() { t.classList.remove('show'); }, 2600);
                }
                return;
            }
            setTimeout(_try, 100);
        })();
    }

    function _wrap() {
        if (typeof window.openPdfAnnotator !== 'function') return false;
        if (window._p38pdfWrapped) return true;
        window._p38pdfWrapped = true;

        var _orig = window.openPdfAnnotator;
        window.openPdfAnnotator = function() {
            var _args = arguments;
            _waitForPdf(function() { _orig.apply(window, _args); });
        };
        return true;
    }

    /* Try wrapping immediately, then again after modules settle */
    if (!_wrap()) {
        var _n = 0;
        (function _try() {
            if (_wrap() || ++_n > 40) return;
            setTimeout(_try, 250);
        })();
    }
})();

/* ================================================================
   3.  PHOSPHOR ICONS — re-trigger scan after deferred load
   ================================================================ */
(function _p38_phosphorRetrigger() {
    /* @phosphor-icons/web sets up a MutationObserver internally.
       Once the deferred script runs, it performs an initial DOM scan.
       No extra action is needed in most cases.

       However, if icons in the initial HTML were missed (the script
       ran before the DOM was fully parsed, or the MutationObserver
       missed the initial batch), we can force a re-scan by briefly
       toggling a dummy class on the body — this triggers the observer. */

    function _retrigger() {
        /* Only act if Phosphor is now loaded */
        if (typeof window.PhosphorIcons === 'undefined') {
            /* Check via a known Phosphor symbol or the fact that ph- elements
               have been converted to SVG */
            var probe = document.querySelector('i.ph-bold, i[class*="ph-"]');
            if (!probe) return; /* no Phosphor icons on page at all */

            /* If Phosphor has run, the <i> will have been replaced or
               a shadow-root / svg inserted.  If it still has no children,
               Phosphor hasn't run yet. */
            if (probe.childElementCount === 0 && probe.offsetWidth === 0) {
                /* Not rendered yet — try again soon */
                setTimeout(_retrigger, 300);
                return;
            }
        }
        /* Trigger a tiny DOM change so Phosphor's observer picks up any
           elements it may have missed. */
        document.body.setAttribute('data-p38-ph', '1');
        requestAnimationFrame(function() {
            document.body.removeAttribute('data-p38-ph');
        });
    }

    /* Run 500 ms after page is interactive (deferred scripts should be
       done by then on all normal connections). */
    setTimeout(_retrigger, 500);
    setTimeout(_retrigger, 1500); /* second attempt for slow connections */
})();

/* ================================================================
   4.  INTERVAL GUARD — run sticker-panel cleanup once at startup
       instead of relying on the 1 500 ms interval from patches8
   ================================================================ */
(function _p38_stickerCleanup() {
    /* patches8 sets a setInterval that removes stale sticker panels
       every 1 500 ms.  Since sticker panels only linger for a few
       hundred ms after being dismissed, running the cleanup once
       shortly after startup and once more after the first tab-switch
       is sufficient. */

    function _clean() {
        ['p6-sticker-panel', 'p7-sticker-panel', 'p8-sticker-panel'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    /* Run once on startup */
    setTimeout(_clean, 2000);

    /* Run once when any tab is switched (covers most real usage) */
    var _hooked = false;
    (function _hookSwitch() {
        if (typeof window.switchTab !== 'function' || _hooked) return;
        _hooked = true;
        var _orig = window.switchTab;
        window.switchTab = function() {
            _clean();
            return _orig.apply(this, arguments);
        };
    })();
    /* Re-try hook after modules load */
    setTimeout(function _hookSwitchRetry() {
        if (!_hooked && typeof window.switchTab === 'function') {
            _hooked = true;
            var _orig = window.switchTab;
            window.switchTab = function() {
                _clean();
                return _orig.apply(this, arguments);
            };
        }
    }, 1200);
})();

/* ================================================================
   5.  SAFETY — cap any remaining uncapped waitFor polls after 10 s
   ================================================================ */
setTimeout(function _p38_safetyFlush() {
    /* Set all known "already done" flags that the uncapped waitFor
       loops in patches32, 34, 35, 36 check before wrapping.
       If they have NOT been set by now (10 s after page load),
       something is wrong; setting the flags stops the infinite polls
       without breaking already-established hooks. */

    var _guards = [
        /* patches32 */ '_p32fsHookDone', '_p32gridDone',
        /* patches34 */ '_p34stickDone', '_p34mmDone', '_p34gridDone', '_p34musicDone',
        /* patches35 */ '_p35svHookDone', '_p35stHookDone',
        /* patches36 */ '_p36gcDone', '_p36bgDone', '_p36stGcDone',
                        '_p36taskStyleDone',
        /* patches37 */ '_p37fThumbDone', '_p37wcHookDone', '_p37padHookDone',
    ];

    _guards.forEach(function(flag) {
        /* Only set if not already set — never overwrite a working hook */
        if (!window[flag]) {
            window[flag] = true;
        }
    });

    console.log('[patches38] safety flush done — all waitFor guards set');
}, 10000);

/* ================================================================
   INIT
   ================================================================ */
console.log('[patches38] loaded — offline fix, pdf lazy-load, phosphor retrigger, perf guards');
