/* ================================================================
   fix_banned.js — Banned word check for StudentOS forum
   ================================================================
   HOW IT WORKS:
   Uses a capturing click listener on the submit button — this runs
   BEFORE onclick, BEFORE any function wrapper, BEFORE everything.
   No function wrapping at all. Cannot be broken by other patches.

   Add to index.html LAST, after all other scripts:
   <script type="module" src="fix_banned.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ── */
var _db = null;
(function boot() {
    var apps = getApps();
    if (!apps.length) { setTimeout(boot, 150); return; }
    _db = getFirestore(apps[0]);
    loadBanned();
})();

/* ── Banned word list ── */
var BANNED = [];

async function loadBanned() {
    if (!_db) return;
    try {
        var snap = await getDoc(doc(_db, 'config', 'moderation'));
        if (snap.exists()) {
            BANNED = (snap.data().bannedWords || [])
                .map(function(w) { return w.toLowerCase().trim(); })
                .filter(Boolean);
            /* keep a local copy for offline */
            try { localStorage.setItem('_sos_banned', JSON.stringify(BANNED)); } catch(e) {}
        }
    } catch(e) {
        /* fallback to last known list */
        try { BANNED = JSON.parse(localStorage.getItem('_sos_banned') || '[]'); } catch(e2) {}
    }
}

/* reload when mod panel saves */
setInterval(function() {
    var bl = document.getElementById('p6-banned-list');
    if (!bl) return;
    var words = Array.from(bl.querySelectorAll('.p6-banned-tag'))
        .map(function(t) { return t.textContent.replace(/\s*✕\s*$/, '').trim().toLowerCase(); })
        .filter(Boolean);
    if (words.length > 0) BANNED = words;
}, 3000);

/* ── Check text ── */
function findBanned(text) {
    var lower = (text || '').toLowerCase();
    for (var i = 0; i < BANNED.length; i++) {
        if (BANNED[i] && lower.indexOf(BANNED[i]) !== -1) return BANNED[i];
    }
    return null;
}

/* ── Show error ── */
function showError(word) {
    /* 1. Show in the form error element */
    var errEl = document.getElementById('forum-new-error');
    if (errEl) {
        errEl.textContent =
            '\uD83D\uDEAB One or multiple words of this post are banned, please try again.' +
            ' (word: "' + word + '")';
        errEl.style.cssText =
            'display:block!important;' +
            'background:rgba(239,68,68,.15)!important;' +
            'border:1px solid rgba(239,68,68,.45)!important;' +
            'border-radius:10px!important;' +
            'color:#fca5a5!important;' +
            'font-size:.82rem!important;' +
            'font-weight:600!important;' +
            'padding:10px 14px!important;' +
            'margin-bottom:12px!important;' +
            'line-height:1.5!important;' +
            'box-shadow:0 0 0 3px rgba(239,68,68,.15)!important;';
        /* shake animation */
        errEl.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-8px)' },
            { transform: 'translateX(8px)' },
            { transform: 'translateX(-6px)' },
            { transform: 'translateX(0)' }
        ], { duration: 320, easing: 'ease' });

        clearTimeout(errEl._bt);
        errEl._bt = setTimeout(function() {
            errEl.textContent = '';
            errEl.style.cssText = '';
        }, 9000);
    }

    /* 2. Toast */
    var toast = document.getElementById('sos-toast');
    if (toast) {
        toast.textContent = '\uD83D\uDEAB Post blocked — "' + word + '" is a banned word.';
        toast.style.background = '#ef4444';
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
            toast.style.background = '';
        }, 4000);
    }
}

function showReplyError(word) {
    var errEl = document.getElementById('forum-reply-error');
    if (errEl) {
        errEl.textContent =
            '\uD83D\uDEAB Reply blocked — "' + word + '" is a banned word.';
        errEl.style.color = '#fca5a5';
        errEl.style.fontWeight = '600';
        errEl.style.fontSize = '.8rem';
        clearTimeout(errEl._bt);
        errEl._bt = setTimeout(function() {
            errEl.textContent = '';
            errEl.style.color = '';
            errEl.style.fontWeight = '';
        }, 7000);
    }
    var toast = document.getElementById('sos-toast');
    if (toast) {
        toast.textContent = '\uD83D\uDEAB Reply blocked — "' + word + '" is a banned word.';
        toast.style.background = '#ef4444';
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
            toast.style.background = '';
        }, 4000);
    }
}

/* ── Intercept submit button with CAPTURING click listener ──
   capture:true means this fires BEFORE the button's own onclick.
   We call event.stopImmediatePropagation() to prevent the post. */
function attachInterceptors() {
    /* Post submit button */
    var postBtn = document.getElementById('forum-submit-btn');
    if (postBtn && !postBtn.dataset.bannedHook) {
        postBtn.dataset.bannedHook = '1';
        postBtn.addEventListener('click', function(e) {
            var title = (document.getElementById('forum-new-title') || {}).value || '';
            var body  = (document.getElementById('forum-new-body')  || {}).value || '';
            var word  = findBanned(title + ' ' + body);
            if (word) {
                e.stopImmediatePropagation();
                e.preventDefault();
                showError(word);
            }
        }, true /* capturing */);
    }

    /* Reply submit button */
    var replyBtn = document.getElementById('forum-reply-btn');
    if (replyBtn && !replyBtn.dataset.bannedHook) {
        replyBtn.dataset.bannedHook = '1';
        replyBtn.addEventListener('click', function(e) {
            var body = (document.getElementById('forum-reply-input') || {}).value || '';
            var word = findBanned(body);
            if (word) {
                e.stopImmediatePropagation();
                e.preventDefault();
                showReplyError(word);
            }
        }, true);
    }

    /* Also intercept Ctrl+Enter on the textareas */
    var postBody = document.getElementById('forum-new-body');
    if (postBody && !postBody.dataset.bannedHook) {
        postBody.dataset.bannedHook = '1';
        postBody.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                var title = (document.getElementById('forum-new-title') || {}).value || '';
                var word  = findBanned(title + ' ' + this.value);
                if (word) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    showError(word);
                }
            }
        }, true);
    }

    var replyInput = document.getElementById('forum-reply-input');
    if (replyInput && !replyInput.dataset.bannedHook) {
        replyInput.dataset.bannedHook = '1';
        replyInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                var word = findBanned(this.value);
                if (word) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    showReplyError(word);
                }
            }
        }, true);
    }
}

/* Run now and whenever the forum tab opens */
setInterval(function() {
    var forumView = document.getElementById('view-forum');
    if (forumView && !forumView.classList.contains('hidden')) {
        attachInterceptors();
    }
}, 800);

/* Also re-hook when new post panel appears (it starts hidden) */
var _obs = new MutationObserver(function() { attachInterceptors(); });
var forumView = document.getElementById('view-forum');
if (forumView) {
    _obs.observe(forumView, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
} else {
    setTimeout(function() {
        var fv = document.getElementById('view-forum');
        if (fv) _obs.observe(fv, { childList: true, subtree: true });
    }, 1500);
}

console.log('[fix_banned] Loaded — capturing click interceptor active');
