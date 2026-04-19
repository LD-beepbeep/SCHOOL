/* ================================================================
   StudentOS — patches35.js
   1.  Worksheet sv-bar — remove empty hint text, collapse bar when
       no saved values exist so the dead-space hint is never shown.
   2.  PDF button removal — remove the patches21 "Export PDF" button
       from the worksheet toolbar on every render.
   3.  Print button fix — replace patches30's popup-based print with
       window.print() so the native browser print dialog captures
       the full rendered worksheet (all block types, current state).
   ================================================================ */

'use strict';

/* ── tiny helpers ─────────────────────────────────────────────── */
const _p35dbG = (k, d) => {
    try { return window.DB?.get ? window.DB.get(k, d) : JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; }
    catch { return d; }
};

function _p35waitFor(fn, interval) {
    (function _try() { if (!fn()) setTimeout(_try, interval || 300); })();
}

/* ================================================================
   1.  SV-BAR — REMOVE EMPTY HINT TEXT
   ================================================================ */

/*
 * patches19 renders a span with the text
 * "Saved values from formula steps appear here as @name references"
 * inside #p19-ws-sv-bar when there are no saved values.
 * This hint is confusing noise; remove it and collapse the bar so it
 * takes no vertical space when empty.
 */
function _p35_svBarClean() {
    const svBar = document.getElementById('p19-ws-sv-bar');
    if (!svBar) return;

    /* Remove any text-only hint spans (no data-p19action attribute
       and only contain a text node — the hint span) */
    svBar.querySelectorAll('span').forEach(s => {
        if (!s.dataset.p19action && !s.querySelector('[data-p19action]')) {
            s.remove();
        }
    });

    /* Toggle empty class so CSS collapses the bar */
    const hasChips = svBar.querySelector('.p19-ws-sv-chip');
    svBar.classList.toggle('p35-sv-empty', !hasChips);
}

function _p35_hookSvBar() {
    let _retries = 0;
    (function _try() {
        if (typeof window.p19_wbRender !== 'function' || window._p35svHookDone) {
            if (!window._p35svHookDone && ++_retries < 80) setTimeout(_try, 300);
            return;
        }
        window._p35svHookDone = true;

        const _orig = window.p19_wbRender;
        window.p19_wbRender = function() {
            _orig.apply(this, arguments);
            /* Run after the render cycle so patches19 has filled the bar */
            requestAnimationFrame(_p35_svBarClean);
        };

        /* Also clean the bar right now in case it already exists */
        requestAnimationFrame(_p35_svBarClean);
    })();
}

/* ================================================================
   2.  PDF BUTTON — REMOVE
   ================================================================ */

/*
 * patches21 injects a button with id="p21-ws-print-btn" labelled
 * "Export PDF" into the worksheet toolbar.  The CSS in patches35.css
 * already hides it via display:none; this JS removes the DOM node
 * entirely so it cannot be un-hidden by other scripts.
 */
function _p35_removePdfBtn() {
    const btn = document.getElementById('p21-ws-print-btn');
    if (btn) btn.remove();
    /* Also remove the patches25 PDF/export button */
    const pdfBtn = document.getElementById('p25-ws-pdf-btn');
    if (pdfBtn) pdfBtn.remove();
}

function _p35_watchPdfBtn() {
    /* patches21 uses a MutationObserver to re-inject the button if it
       disappears.  Setting up a counter-observer that removes it again
       creates an infinite DOM-mutation loop between the two observers,
       which saturates the main thread and freezes the browser.
       The CSS rule  #p21-ws-print-btn { display:none !important }  in
       patches35.css is the correct mechanism for hiding the button.
       We only do a single one-shot removal here so the DOM is clean on
       first load; patches21 will re-inject it once, then CSS keeps it
       hidden with no further mutations. */
    let _retries = 0;
    (function _findView() {
        const view = document.getElementById('view-worksheet');
        if (!view) {
            if (++_retries < 40) setTimeout(_findView, 600);
            return;
        }
        _p35_removePdfBtn(); /* One-shot removal — CSS hides any re-injection */
    })();
}

/* ================================================================
   3.  PRINT BUTTON — REPLACE POPUP WITH window.print()
   ================================================================ */

/*
 * patches30 builds a custom HTML popup to "print" the worksheet.
 * This misses real-time block state (computed values that have not
 * been persisted, styling nuances, new block types, etc.).
 *
 * We replace the click handler on the "Print worksheet" toolbar
 * button so it instead calls window.print(), which captures the
 * live DOM.  The @media print rules in patches30.css and
 * patches35.css hide all chrome and make the worksheet fill the
 * page cleanly.
 */
function _p35_fixPrintBtn() {
    let _retries = 0;
    (function _try() {
        const toolbar = document.getElementById('p19-ws-toolbar');
        if (!toolbar) { if (++_retries < 60) setTimeout(_try, 400); return; }

        const btn = toolbar.querySelector('.p19-ws-tb-btn[title="Print worksheet"]');
        if (!btn) { if (++_retries < 60) setTimeout(_try, 400); return; }

        /* Guard: already patched */
        if (btn.dataset.p35print) return;
        btn.dataset.p35print = '1';

        /* Clone to strip all existing listeners from patches30 */
        const fresh = btn.cloneNode(true);
        fresh.dataset.p35print = '1';
        fresh.innerHTML = '<i class="fa-solid fa-print"></i> Print';
        fresh.addEventListener('click', () => {
            /* Switch to worksheet view first (just in case) */
            const view = document.getElementById('view-worksheet');
            if (view && view.classList.contains('hidden')) return;
            window.print();
        });
        btn.parentNode.replaceChild(fresh, btn);
    })();
}

/* Re-apply when the user navigates to the worksheet tab */
function _p35_hookSwitchTab() {
    _p35waitFor(function() {
        if (typeof window.switchTab !== 'function' || window._p35stHookDone) {
            return !!window._p35stHookDone;
        }
        window._p35stHookDone = true;

        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            if (name === 'worksheet') {
                /* Give patches30 time to inject its button first */
                setTimeout(_p35_fixPrintBtn, 400);
                setTimeout(_p35_removePdfBtn,  300);
                /* Remove p25 PDF button after it may have been re-injected */
                setTimeout(() => {
                    const pdfBtn = document.getElementById('p25-ws-pdf-btn');
                    if (pdfBtn) pdfBtn.remove();
                }, 500);
                setTimeout(_p35_svBarClean,    300);
            }
        };
        return true;
    });
}

/* ================================================================
   INIT
   ================================================================ */
(function _p35_init() {
    function _go() {
        _p35_hookSvBar();
        _p35_watchPdfBtn();
        _p35_fixPrintBtn();
        _p35_hookSwitchTab();
        console.log('[patches35] loaded — sv-bar hint removed, PDF button removed, print via window.print()');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(_go, 900));
    } else {
        setTimeout(_go, 900);
    }
})();
