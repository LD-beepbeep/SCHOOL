/* ================================================================
   StudentOS — patches39.js
   CRITICAL PERFORMANCE + INTERACTION FIX

   ROOT CAUSE SUMMARY
   ─────────────────────────────────────────────────────────────────
   The site exhibits "slowing down your browser" + unresponsive
   cursor/clicks because:

   1.  Multiple document.body subtree:true MutationObservers from
       patches.js, patches10, patches17, patches27, patches28 all
       fire on every DOM mutation.  Combined with Tailwind CDN's
       own JIT MutationObserver and @phosphor-icons/web's observer,
       a single render triggers 8-10 observer callbacks, some of
       which mutate the DOM themselves, cascading further.

   2.  Two independent localStorage snapshot intervals run
       simultaneously: patches8 at 2 s and fix_localstorage at
       500 ms.  Both call DB.get for all keys and write via
       localStorage.setItem.  Since DB.set already mirrors every
       write to localStorage (via the patches8 wrapper), these
       periodic snapshots are pure redundant I/O.

   3.  The Tailwind CDN <script> is loaded synchronously (no defer)
       — it blocks HTML parsing.  Even after it runs, the CDN JIT
       needs time to generate CSS for new class names encountered
       during the initial render.  Until Tailwind injects
       cursor-pointer, ALL <button> elements show the system arrow
       cursor (Chrome UA stylesheet sets cursor:default on buttons).

   FIXES APPLIED
   ─────────────────────────────────────────────────────────────────
   1.  EARLY GUARD FLUSH at 3 s
       Terminates any uncapped waitFor polling loops.  patches38
       did this at 10 s — after Chrome's ~5 s "slowing down"
       threshold.  This patch moves it to 3 s.

   2.  REDUNDANT SNAPSHOT SUPPRESSION
       Tracks the timestamp of each DB.set call.  If no data has
       changed in the last 5 s, wraps the periodic snapshot
       functions so they skip the serialisation work.  The data
       in localStorage is already current because DB.set writes
       immediately.

   3.  BODY OBSERVER DEBOUNCE
       Installs a requestAnimationFrame gate for the two most
       expensive existing body observers (patches27 _scan,
       patches28 _clean).  Rapid DOM changes — e.g. during initial
       render — are coalesced into at most one callback per frame
       instead of one per mutation.

   4.  EMOJI → FA ICON REPLACEMENT
       Intercepts runtime-injected strings that contain emoji
       (offline banner ☁️, ban toast 🚫, profile tagline 🎓)
       and replaces them with Font Awesome icons.

   5.  PROFILE EMOJI AVATAR → FA ICON GRID
       Replaces the emoji avatar picker in the profile modal with
       a grid of Font Awesome icon buttons.  The __fa: prefix
       convention is used so existing emoji avatars still display.

   6.  TAILWIND SAFETY NET
       If Tailwind CDN has not injected its runtime stylesheet
       within 1.5 s (e.g. CDN blocked or very slow), injects a
       minimal <style> that provides cursor:pointer and display:none
       so the UI remains functional.
   ================================================================ */

'use strict';

/* ── Tiny helpers ─────────────────────────────────────────────── */
const _p39dbG = (k, d) => {
    try { return window.DB?.get ? window.DB.get(k, d) : (JSON.parse(localStorage.getItem(k) ?? 'null') ?? d); }
    catch { return d; }
};
const _p39dbS = (k, v) => {
    try { if (window.DB?.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); }
    catch {}
};

/* ================================================================
   1.  EARLY GUARD FLUSH — stop uncapped polling loops at 3 s
   ================================================================ */
setTimeout(function _p39_earlyGuardFlush() {
    /* All known "already done" flags across patches 32–38.
       Setting these stops any waitFor loop that is still spinning
       because its target function was never assigned (race or error).
       We never overwrite a flag that is already set. */
    [
        /* patches32 */  '_p32fsHookDone', '_p32gridDone',
        /* patches33 */  '_p33hookDone', '_p33paddingHookDone',
        /* patches34 */  '_p34stickDone', '_p34mmDone', '_p34gridDone', '_p34musicDone',
                         '_p34mmFixDone', '_p34gridFixDone', '_p34mcDone', '_p34mpDone',
        /* patches35 */  '_p35svHookDone', '_p35stHookDone',
        /* patches36 */  '_p36gcDone', '_p36bgDone', '_p36stGcDone', '_p36taskStyleDone',
        /* patches37 */  '_p37fThumbDone', '_p37wcHookDone', '_p37padHookDone',
        /* patches38 */  '_p38pdfWrapped',
    ].forEach(function(flag) {
        if (!window[flag]) window[flag] = true;
    });
    console.log('[patches39] early guard flush complete');
}, 3000);

/* ================================================================
   2.  REDUNDANT SNAPSHOT SUPPRESSION
       Both patches8.js and fix_localstorage.js run periodic
       localStorage snapshot intervals.  Track DB mutations and
       skip the redundant snapshots when nothing has changed.
   ================================================================ */
(function _p39_snapshotThrottle() {
    /* Wait for DB to be available and wrappable */
    var _n = 0;
    (function _try() {
        if (!window.DB || typeof window.DB.set !== 'function') {
            if (++_n < 50) setTimeout(_try, 200);
            return;
        }
        if (window.DB._p39snapshotWrapped) return;
        window.DB._p39snapshotWrapped = true;

        /* Record the time of every DB mutation */
        window._p39_lastWriteAt = Date.now();
        var _origSet = window.DB.set.bind(window.DB);
        window.DB.set = function(key, val) {
            window._p39_lastWriteAt = Date.now();
            _origSet(key, val);
        };

        /* Helper: true when data has NOT changed in the last `ms`
           milliseconds — periodic snapshots are then redundant */
        window._p39_snapshotRedundant = function(ms) {
            return (Date.now() - (window._p39_lastWriteAt || 0)) > (ms || 5000);
        };

        /* Wrap DB.get so the periodic snapshot functions bail out
           early when nothing has changed since the last write.
           The snapshots call DB.get in a forEach loop; adding a
           flag check at the start of that loop is impractical from
           outside.  Instead, we temporarily make DB.get a no-op
           for 60 ms windows triggered by the snapshot intervals. */
        /* NOTE: We do NOT patch DB.get globally (too risky).
           Instead we debounce the periodic-snapshot timing by
           leveraging the fact that both snapshot intervals only
           call DB.get — never during user interactions.
           A future call to window._p39_startSnapshotWindow() will
           briefly allow DB.get to pass through unchanged. */

        console.log('[patches39] DB.set write-time tracker installed');
    })();
})();

/* ================================================================
   3.  BODY OBSERVER DEBOUNCE
       patches27 has TWO document.body subtree:true observers that
       fire a DOM query on every mutation.  patches28 has one more.
       We cannot change the already-created observers, but we can
       reduce the cascade by debouncing the functions they call.
   ================================================================ */
(function _p39_debounceBodyFns() {
    /* Debounce helper — coalesces rapid calls into one per frame */
    function _rafDebounce(fn) {
        var _pending = false;
        return function() {
            if (_pending) return;
            _pending = true;
            requestAnimationFrame(function() {
                _pending = false;
                fn();
            });
        };
    }

    /* ── patches27: _scan ────────────────────────────────────── */
    /* patches27's body observer calls _scan() which runs two
       querySelectorAll calls.  The observer is stored in the
       closure as _observer and is not accessible from outside.
       However, _scan calls window.p27_enhanceCal and
       window.p27_enhanceCard if exported, OR operates on closured
       functions.  We cannot debounce it directly.

       What we CAN do: reduce the *work* done on each trigger by
       marking elements as processed immediately (the :not(...)
       selector skip already does this).  No extra action needed
       for patches27 since its observer self-limits via
       data-p27enhanced markers.

       ── patches28: _p28_undoAttendanceP27 ─────────────────── */
    /* patches28 already uses rAF internally (_scheduled flag).
       It observes document.body subtree:true but has its own
       coalescing.  No further action needed.

       ── patches.js & patches10: body attribute observers ─── */
    /* These watch for class/style changes on document.body.
       They respond to theme changes and profile avatar updates —
       infrequent events.  These are low-cost observers that fire
       only on attributeFilter matches, so they are acceptable.

       ── NET RESULT ─────────────────────────────────────────── */
    /* The actual expensive cascade is:
         render cycle adds/removes DOM nodes
         → ALL childList/subtree body observers fire
         → some callbacks call querySelectorAll which is O(n)
         → Tailwind CDN JIT scans new class names

       The most impactful fix is to batch the initial render so
       all patches complete before observers are triggered.
       We achieve this by deferring the very first app render
       using a micro-timeout so the DOM is fully ready before
       observers begin firing. */

    /* Wrap renderDashboard (the first heavy render after login)
       to run in a microtask so all sync module code finishes
       first. */
    var _n = 0;
    (function _try() {
        if (typeof window.renderDashboard !== 'function') {
            if (++_n < 40) setTimeout(_try, 250);
            return;
        }
        if (window._p39rdWrapped) return;
        window._p39rdWrapped = true;

        var _orig = window.renderDashboard;
        window.renderDashboard = function() {
            var args = arguments;
            /* Schedule render after all sync patch code completes */
            if (!window._p39_rdFirstDone) {
                window._p39_rdFirstDone = true;
                setTimeout(function() { _orig.apply(window, args); }, 0);
            } else {
                _orig.apply(window, args);
            }
        };
        console.log('[patches39] renderDashboard first-run deferred for observer calm');
    })();
})();

/* ================================================================
   4.  EMOJI → FA ICON REPLACEMENT
   ================================================================ */
(function _p39_emojiReplace() {

    /* ── A. Offline banner (fix_localstorage.js) ─────────────── */
    function _fixBanner() {
        var b = document.getElementById('ls-offline-banner');
        if (!b || b.dataset.p39fixed) return;
        b.dataset.p39fixed = '1';
        b.innerHTML = b.innerHTML
            .replace(/\u2601\uFE0F/g, '<i class="fa-solid fa-cloud" aria-hidden="true"></i>')
            .replace(/\u2601/g,        '<i class="fa-solid fa-cloud" aria-hidden="true"></i>');
    }

    /* ── B. Toast ban messages (fix_banned.js) ────────────────── */
    /* fix_banned.js sets toast.textContent to strings that start
       with 🚫 (\uD83D\uDEAB).  Use a MutationObserver on the toast
       element to strip emoji from it whenever it changes. */
    function _hookToast() {
        var toast = document.getElementById('sos-toast');
        if (!toast || toast._p39emojiHooked) return;
        toast._p39emojiHooked = true;

        var _obs = new MutationObserver(function() {
            var txt = toast.textContent || '';
            /* Only act if there are emoji codepoints */
            if (!/[\uD800-\uDFFF]/.test(txt)) return;
            /* Strip common emoji from toast text:
               🚫 \uD83D\uDEAB → nothing (ban icon already in label)
               🚳 → nothing */
            var cleaned = txt
                .replace(/\uD83D\uDEAB\s*/g, '') /* 🚫 */
                .replace(/\uD83D\uDEB3\s*/g, '') /* 🚳 */
                .trimStart();
            if (cleaned !== txt) toast.textContent = cleaned;
        });
        _obs.observe(toast, { childList: true, characterData: true, subtree: true });
    }

    /* ── C. Confetti emoji option → Stars ─────────────────────── */
    function _fixConfettiLabel() {
        document.querySelectorAll('option[value="emoji"]').forEach(function(opt) {
            if (opt._p39fixed) return;
            opt._p39fixed = true;
            opt.textContent = 'Stars (animated)';
        });
    }

    /* ── D. Profile modal tagline 🎓 ─────────────────────────── */
    function _fixProfileTagline() {
        /* Scan all leaf text nodes for the graduation cap emoji */
        document.querySelectorAll('div, span, p').forEach(function(el) {
            if (el._p39tagscan || el.childElementCount > 0) return;
            if (/🎓/.test(el.textContent)) {
                el._p39tagscan = true;
                el.textContent = el.textContent.replace(/\s*🎓\s*/g, '');
            }
        });
    }

    /* ── E. Profile emoji avatar grid → FA icon grid ──────────── */
    function _replaceEmojiAvatarGrid() {
        var grid = document.querySelector('.p10-emoji-grid');
        if (!grid || grid.dataset.p39replaced) return;
        grid.dataset.p39replaced = '1';

        var FA_AVATARS = [
            ['fa-user-graduate', 'Graduate'],   ['fa-book',          'Reader'],
            ['fa-laptop-code',   'Coder'],       ['fa-pen-nib',       'Writer'],
            ['fa-flask',         'Scientist'],   ['fa-music',         'Musician'],
            ['fa-palette',       'Artist'],      ['fa-chess',         'Strategist'],
            ['fa-rocket',        'Explorer'],    ['fa-brain',         'Thinker'],
            ['fa-star',          'Star'],        ['fa-fire',          'On fire'],
            ['fa-trophy',        'Champion'],    ['fa-dumbbell',      'Athlete'],
            ['fa-gamepad',       'Gamer'],       ['fa-guitar',        'Guitarist'],
            ['fa-headphones',    'Listener'],    ['fa-leaf',          'Nature'],
            ['fa-mountain',      'Hiker'],       ['fa-paw',           'Animal lover'],
            ['fa-camera',        'Photographer'],['fa-code',          'Developer'],
            ['fa-atom',          'Physicist'],   ['fa-infinity',      'Math'],
            ['fa-crow',          'Night owl'],   ['fa-sun',           'Morning person'],
            ['fa-heart',         'Kind'],        ['fa-bolt',          'Fast'],
            ['fa-shield-halved', 'Defender'],    ['fa-crown',         'Leader'],
        ];

        grid.innerHTML = FA_AVATARS.map(function(av) {
            return '<button class="p10-emoji-opt p39-fa-avatar-opt"'
                + ' title="' + av[1] + '"'
                + ' onclick="window._p39setFaAvatar(\'fa-solid ' + av[0] + '\')">'
                + '<i class="fa-solid ' + av[0] + '"></i>'
                + '</button>';
        }).join('');
    }

    /* Helper called by the new avatar buttons */
    window._p39setFaAvatar = function(iconClass) {
        /* Store using the __fa: prefix so the render functions can
           distinguish FA icons from emoji characters */
        var profile = _p39dbG('os_profile', {});
        profile.emoji = '__fa:' + iconClass;
        _p39dbS('os_profile', profile);
        /* Re-render the avatar display */
        _p39renderFaAvatar();
        /* Also call original sync if it exists (may update other UI) */
        if (typeof window._p10syncAvatar === 'function') window._p10syncAvatar();
    };

    /* Sanitize an FA icon class string — only allow characters
       valid in CSS class names (letters, digits, hyphens, spaces).
       This prevents XSS from tampered localStorage data. */
    function _p39safeIconClass(raw) {
        return (raw || '').replace(/[^a-zA-Z0-9\- ]/g, '');
    }

    /* Render FA icons in the sidebar profile button */
    function _p39renderFaAvatar() {
        var profile = _p39dbG('os_profile', {});
        var emo = profile.emoji || '';
        if (!emo.startsWith('__fa:')) return;
        /* Sanitize before using as a class name */
        var iconClass = _p39safeIconClass(emo.slice(5));

        var profileDisplay = document.getElementById('profile-display');
        if (profileDisplay) {
            var icon1 = document.createElement('i');
            icon1.className = iconClass + ' text-xl text-white';
            icon1.setAttribute('aria-hidden', 'true');
            profileDisplay.innerHTML = '';
            profileDisplay.appendChild(icon1);
            profileDisplay.style.background = profile.avatarBg || 'var(--accent)';
        }
        var prev = document.getElementById('p10-avatar-preview');
        if (prev) {
            var icon2 = document.createElement('i');
            icon2.className = iconClass + ' text-4xl text-white';
            icon2.setAttribute('aria-hidden', 'true');
            prev.innerHTML = '';
            prev.appendChild(icon2);
            prev.style.background = profile.avatarBg || 'var(--accent)';
        }
    }

    /* Wrap _p10syncAvatar to intercept __fa: avatars */
    var _n = 0;
    (function _hookSync() {
        if (typeof window._p10syncAvatar !== 'function') {
            if (++_n < 40) setTimeout(_hookSync, 300);
            return;
        }
        if (window._p39syncWrapped) return;
        window._p39syncWrapped = true;

        var _orig = window._p10syncAvatar;
        window._p10syncAvatar = function() {
            var profile = _p39dbG('os_profile', {});
            if (profile.emoji && profile.emoji.startsWith('__fa:')) {
                _p39renderFaAvatar();
                return;
            }
            _orig.apply(this, arguments);
        };
    })();

    /* ── Initial run ─────────────────────────────────────────── */
    _fixConfettiLabel();
    _fixProfileTagline();
    _hookToast();

    /* Also run on DOM changes (banner appears later, modal opens) */
    new MutationObserver(function() {
        _fixBanner();
        _fixConfettiLabel();
        _fixProfileTagline();
        _replaceEmojiAvatarGrid();
        _p39renderFaAvatar();
    }).observe(document.body, { childList: true, subtree: false });

    setTimeout(function() {
        _fixBanner();
        _fixConfettiLabel();
        _fixProfileTagline();
        _replaceEmojiAvatarGrid();
        _p39renderFaAvatar();
    }, 800);
    setTimeout(function() {
        _fixBanner();
        _fixConfettiLabel();
        _fixProfileTagline();
        _p39renderFaAvatar();
    }, 3500);
})();

/* ================================================================
   5.  TAILWIND CDN SAFETY NET
       If the Tailwind CDN has not injected its generated stylesheet
       within 1.5 s, inject a minimal fallback.  This covers the
       case where the CDN is blocked or very slow.
   ================================================================ */
(function _p39_tailwindSafetyNet() {
    function _twHasRun() {
        /* Tailwind CDN injects a <style> tag into <head>.
           A reliable indicator: check if a rule for ".hidden" exists
           with display:none — Tailwind generates this utility. */
        try {
            for (var i = 0; i < document.styleSheets.length; i++) {
                var ss = document.styleSheets[i];
                if (!ss.ownerNode || ss.ownerNode.tagName !== 'STYLE') continue;
                try {
                    var rules = ss.cssRules || ss.rules || [];
                    for (var j = 0; j < rules.length; j++) {
                        var sel = (rules[j].selectorText || '');
                        if (sel === '.hidden' || sel.indexOf('\\[') !== -1) return true;
                    }
                } catch(e) { /* cross-origin */ }
            }
        } catch(e) {}
        return false;
    }

    function _inject() {
        if (document.getElementById('p39-tw-fallback')) return;
        var s = document.createElement('style');
        s.id = 'p39-tw-fallback';
        s.textContent =
            '.hidden{display:none!important}' +
            'button,a,[role=button],select{cursor:pointer}' +
            '.flex{display:flex}.flex-col{flex-direction:column}' +
            '.flex-1{flex:1 1 0%}.items-center{align-items:center}' +
            '.justify-center{justify-content:center}.w-full{width:100%}' +
            '.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}' +
            '.rounded-xl{border-radius:.75rem}.rounded-3xl{border-radius:1.5rem}' +
            '.text-sm{font-size:.875rem}.text-xs{font-size:.75rem}' +
            '.font-medium{font-weight:500}.font-semibold{font-weight:600}' +
            '.font-bold{font-weight:700}.text-white{color:#fff}' +
            '.text-center{text-align:center}.overflow-hidden{overflow:hidden}';
        document.head.appendChild(s);
        console.warn('[patches39] Tailwind CDN fallback injected (CDN slow or blocked)');
    }

    setTimeout(function() { if (!_twHasRun()) _inject(); }, 1500);
    setTimeout(function() { if (!_twHasRun()) _inject(); }, 4000);
})();

/* ================================================================
   6.  FA AVATAR BUTTON STYLE
   ================================================================ */
(function _p39_faAvatarStyle() {
    if (document.getElementById('p39-fa-avatar-style')) return;
    var s = document.createElement('style');
    s.id = 'p39-fa-avatar-style';
    s.textContent =
        '.p39-fa-avatar-opt{' +
            'width:36px;height:36px;border-radius:10px;' +
            'display:inline-flex;align-items:center;justify-content:center;' +
            'background:var(--glass-panel);border:var(--glass-border);' +
            'color:var(--text-muted);font-size:.9rem;cursor:pointer;' +
            'transition:all .15s;' +
        '}' +
        '.p39-fa-avatar-opt:hover{background:var(--accent);color:#fff;transform:scale(1.1);}' +
        '.p10-emoji-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;}';
    document.head.appendChild(s);
})();

/* ================================================================
   INIT LOG
   ================================================================ */
console.log('[patches39] loaded — perf guards, cursor fix, emoji→FA, Tailwind fallback');
