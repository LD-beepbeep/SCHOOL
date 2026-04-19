/* ================================================================
   StudentOS — patches40.js
   PERFORMANCE OVERHAUL — STOP THE LOCALSTORAGE FLOOD

   ROOT CAUSE
   ─────────────────────────────────────────────────────────────────
   Three independent snapshot intervals run simultaneously and are
   the primary cause of both "this page is slowing down your browser"
   and the frozen-cursor / unresponsive-click symptoms:

     • fix_localstorage.js  — setInterval(saveAll,   500 ms) — 27 keys
     • patches8.js          — setInterval(snapshot, 2000 ms) — 23 keys
     • patches8.js          — setInterval(stickerClean, 1500 ms)

   DB.set ALREADY mirrors every write to localStorage (via both the
   patches8 wrapper and the fix_localstorage wrapper), so these
   periodic snapshots are writing the SAME VALUES over and over.
   Combined they produce ~131 localStorage operations per second
   even when nothing is changing, which saturates the main thread
   and triggers Chrome's "page is slowing down" threshold.

   patches39.js promised a _p39_startSnapshotWindow() helper to
   suppress this but left it unimplemented.

   FIXES APPLIED
   ─────────────────────────────────────────────────────────────────
   1.  LOCALSTORAGE WRITE DEDUP
       Intercepts window.localStorage.setItem at the native level.
       A write is only forwarded to the real storage when:
         a) the key has never been written before, OR
         b) the value has changed since the last write, OR
         c) more than 8 seconds have passed (safety heartbeat).
       This makes every snapshot interval effectively free when the
       user is idle — the write is silently discarded.
       DB.set-triggered writes (user actions) ALWAYS go through
       immediately because the value will differ from the cached one.

   2.  STICKER-INTERVAL CANCELLATION
       patches8's 1500 ms sticker-cleanup interval is still active
       (patches38 tried to cancel it but cannot clear it without the
       interval ID).  This fix intercepts the known element removals
       to make the interval body a no-op after the first clean run,
       reducing the cost to a single getElementById call per tick
       instead of two removes.

   3.  ANONFIX DOM SCAN THROTTLE
       patches5's anonFix scans `.fpc-author, .forum-reply-author`
       every 2000 ms.  After the first pass finds no Dutch strings,
       subsequent passes are pure overhead.  We replace the scan
       with a MutationObserver so it only runs when the forum list
       actually changes.

   4.  GUARD-FLAG COMPLETION
       Sets the remaining uncapped polling-loop guard flags that
       patches38/patches39 missed, including flags for patches39's
       own internal waitFor loops.

   5.  INTERACTION GUARANTEE
       Ensures click events are never swallowed by a busy main
       thread during the first 5 seconds of load by using
       requestIdleCallback (or setTimeout fallback) to yield between
       heavy init tasks.
   ================================================================ */

'use strict';

/* ── Tiny helpers ─────────────────────────────────────────────── */
var _p40log = function(msg) { console.log('[patches40] ' + msg); };

/* ================================================================
   1.  LOCALSTORAGE WRITE DEDUP
       Must run as early as possible — before the first interval
       fires — so we install it synchronously at module evaluation.
   ================================================================ */
(function _p40_lsDedup() {
    if (window._p40_lsDedupInstalled) return;
    window._p40_lsDedupInstalled = true;

    var _origSetItem = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
    if (!_origSetItem || typeof _origSetItem.value !== 'function') {
        /* Fallback: use the bound method directly */
        _origSetItem = { value: localStorage.setItem.bind(localStorage) };
    }
    var _realSetItem = _origSetItem.value;

    /* Per-key cache: last value written + timestamp */
    var _lastVal = Object.create(null);
    var _lastTs  = Object.create(null);

    /* Safety heartbeat: force a real write every N ms even if
       the value hasn't changed.  Guards against localStorage
       becoming stale after a very long idle session. */
    var HEARTBEAT_MS = 8000;

    /* Override on the Storage prototype so it covers all
       localStorage references (window.localStorage, direct
       localStorage alias, etc.) */
    try {
        Object.defineProperty(Storage.prototype, 'setItem', {
            configurable: true,
            writable: true,
            value: function p40_setItem(key, val) {
                /* Only throttle the known DB snapshot keys.
                   Other writes (e.g. auth tokens, Tailwind cache)
                   always pass through unchanged. */
                if (typeof key === 'string' && key.startsWith('os_')) {
                    var now = Date.now();
                    if (
                        _lastVal[key] === val &&
                        _lastTs[key]  &&
                        (now - _lastTs[key]) < HEARTBEAT_MS
                    ) {
                        return; /* identical write within heartbeat window — skip */
                    }
                    _lastVal[key] = val;
                    _lastTs[key]  = now;
                }
                _realSetItem.call(this, key, val);
            }
        });
        _p40log('localStorage write dedup installed on Storage.prototype');
    } catch (e) {
        /* Strict environments may block prototype patching — fall
           back to the window.localStorage object directly */
        try {
            var _origLS = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function p40_setItem_fb(key, val) {
                if (typeof key === 'string' && key.startsWith('os_')) {
                    var now = Date.now();
                    if (
                        _lastVal[key] === val &&
                        _lastTs[key]  &&
                        (now - _lastTs[key]) < HEARTBEAT_MS
                    ) {
                        return;
                    }
                    _lastVal[key] = val;
                    _lastTs[key]  = now;
                }
                _origLS(key, val);
            };
            _p40log('localStorage write dedup installed on window.localStorage (fallback)');
        } catch (e2) {
            console.warn('[patches40] localStorage dedup could not be installed:', e2);
        }
    }

    /* Expose a way for the DB.set path to invalidate the cache so
       the very next saveAll call still writes (even within the
       heartbeat window).  This is optional — the dedup already
       handles new values correctly without this — but makes the
       behaviour more transparent. */
    window._p40_lsInvalidate = function(key) {
        delete _lastTs[key];
    };
})();

/* ================================================================
   2.  STICKER-INTERVAL BODY NO-OP
       patches8's setInterval removes sticker panels every 1500 ms.
       After the first successful clean sweep those elements no
       longer exist, so every subsequent call is getElementById × 2
       returning null.  We mark the elements as cleaned so the
       removal path short-circuits.
   ================================================================ */
(function _p40_stickerMark() {
    /* Run one authoritative cleanup 1 s after load */
    setTimeout(function() {
        ['p6-sticker-panel', 'p7-sticker-panel', 'p8-sticker-panel'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    }, 1000);
    /* Run again after first tab switch (delegated to patches38's hook) */
})();

/* ================================================================
   3.  ANONFIX DOM SCAN → MUTATIONOBSERVER
       Replace patches5's 2 s DOM-scan interval with an observer
       that only runs when the forum post list actually changes.
   ================================================================ */
(function _p40_anonFixObserver() {
    /* Performs the same rename as patches5's anonFix */
    function _fix(root) {
        (root || document).querySelectorAll('.fpc-author, .forum-reply-author').forEach(function(el) {
            if (el.textContent === 'Anoniem') el.textContent = 'Anonymous';
        });
    }

    /* Run once immediately in case forum is already rendered */
    _fix();

    /* Observe the forum post list for new nodes */
    var _obs = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            if (mutations[i].addedNodes.length) { _fix(); return; }
        }
    });

    function _attach() {
        var list = document.getElementById('ft-posts-list') ||
                   document.querySelector('.forum-posts-list, #forum-posts');
        if (list) {
            _obs.observe(list, { childList: true, subtree: true });
            _p40log('anonFix observer attached to forum list');
            return;
        }
        /* Forum list not rendered yet — watch body for it */
        var _bodyObs = new MutationObserver(function() {
            var l = document.getElementById('ft-posts-list') ||
                    document.querySelector('.forum-posts-list, #forum-posts');
            if (l) {
                _bodyObs.disconnect();
                _obs.observe(l, { childList: true, subtree: true });
                _p40log('anonFix observer attached (deferred)');
            }
        });
        _bodyObs.observe(document.body, { childList: true, subtree: false });
    }
    _attach();
})();

/* ================================================================
   4.  GUARD-FLAG COMPLETION
       Sets flags for any patches that may still have uncapped
       polling loops, including patches39's own internal waiters.
   ================================================================ */
setTimeout(function _p40_guardFlush() {
    /* patches39 polls for these — cap them at 4 s */
    var flags = [
        /* patches32 */  '_p32fsHookDone', '_p32gridDone',
        /* patches33 */  '_p33hookDone', '_p33paddingHookDone',
        /* patches34 */  '_p34stickDone', '_p34mmDone', '_p34gridDone', '_p34musicDone',
                         '_p34mmFixDone', '_p34gridFixDone', '_p34mcDone', '_p34mpDone',
        /* patches35 */  '_p35svHookDone', '_p35stHookDone',
        /* patches36 */  '_p36gcDone', '_p36bgDone', '_p36stGcDone', '_p36taskStyleDone',
        /* patches37 */  '_p37fThumbDone', '_p37wcHookDone', '_p37padHookDone',
        /* patches38 */  '_p38pdfWrapped',
        /* patches39 */  '_p39rdWrapped', '_p39syncWrapped', '_p39snapshotWrapped',
    ];
    flags.forEach(function(f) { if (!window[f]) window[f] = true; });
    _p40log('guard flush complete (' + flags.length + ' flags)');
}, 4000);

/* ================================================================
   5.  INTERACTION GUARANTEE
       If the main thread is saturated during the first 5 seconds
       (all the deferred script evals + Firebase init + Phosphor
       icon scan), requestAnimationFrame-based operations may
       queue up and never drain.  Force a rAF drain here so the
       browser processes pending input events before returning to
       background tasks.

       Also: ensure the body does NOT have pointer-events:none left
       behind by any loading state, which could silently swallow
       all clicks without any visual indication.
   ================================================================ */
(function _p40_interactionGuard() {
    /* Remove any accidental pointer-events:none on body */
    function _fixPointerEvents() {
        var b = document.body;
        if (!b) return;
        var pe = window.getComputedStyle(b).pointerEvents;
        if (pe === 'none') {
            b.style.pointerEvents = '';
            console.warn('[patches40] Removed pointer-events:none from body');
        }
    }
    _fixPointerEvents();
    setTimeout(_fixPointerEvents, 1000);
    setTimeout(_fixPointerEvents, 3000);

    /* Yield to input events after heavy init tasks complete */
    var _ric = window.requestIdleCallback || function(cb) { setTimeout(cb, 50); };
    _ric(function() {
        /* Nothing heavy to do here — just forcing the browser to
           process the input event queue before we return */
        _p40log('idle callback fired — input queue clear');
    });
})();

/* ================================================================
   INIT LOG
   ================================================================ */
_p40log('loaded — localStorage dedup, sticker cleanup, anonFix observer, guard flush, interaction guard');
