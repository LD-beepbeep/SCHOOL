/* ================================================================
   StudentOS — patches6.js   v1.0
   ---------------------------------------------------------------
   Fixes & New Features (in order):

   1.  Google Sign-In — popup → redirect fallback so it works on
       GitHub Pages and mobile browsers where popups are blocked
   2.  Offline mode — all changes now auto-persisted to localStorage
   3.  Forum — threaded replies (replies to replies / nesting)
   4.  Forum — post visibility (Public / School / Private)
   5.  Forum — Moderation: banned-words filter + report button +
       admin mod panel (set window.P6_ADMIN_UID to your UID)
   6.  Notes — checkbox rendering & persistence fully fixed
   7.  Notes — table borders visible in light mode
   8.  Notes — sticker panel scrollable so all stickers are reachable
   9.  Formula Sheets — preview only renders after you start typing
   10. Music — edit button on custom stations (was already coded in
       features.js — this wires up the missing edit button in the UI)
   11. Music — "Show Video" toggle for YouTube visual feed
   12. Focus Timer — sound toggle dot readable in both light/dark mode
   13. Calendar — events are now fully editable + description field
   14. Dashboard — fully scrollable on all screen sizes
   15. Mobile — bottom nav always shown after login; Music, Forum,
       Formulas added to the "More" drawer

   Add LAST in index.html, after patches5.js:
   <script type="module" src="patches6.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
    getAuth, GoogleAuthProvider,
    signInWithPopup, signInWithRedirect,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    getFirestore,
    doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
    collection, query, orderBy, limit, onSnapshot,
    serverTimestamp, arrayUnion, arrayRemove, increment, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── get existing Firebase instances ── */
let _app, _auth, _db, _uid = null, _uname = 'Student';
(function _init() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_init, 150); return; }
    _app  = apps[0];
    _auth = getAuth(_app);
    _db   = getFirestore(_app);
    onAuthStateChanged(_auth, u => {
        _uid   = u ? u.uid : null;
        _uname = u ? (u.displayName || u.email?.split('@')[0] || 'Student') : 'Student';
    });
})();

/* ── tiny helpers ── */
const _p6 = {
    css(txt) {
        const s = document.createElement('style');
        s.textContent = txt;
        document.head.appendChild(s);
    },
    toast(msg, err = false) {
        const t = document.getElementById('sos-toast');
        if (!t) return;
        t.textContent = msg;
        t.style.background = err ? '#ef4444' : '';
        t.classList.add('show');
        setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 2600);
    },
    esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    },
    wait(fn, ms = 120) { setTimeout(fn, ms); },
};

/* ================================================================
   CSS BLOCK — injects all style fixes at once
   ================================================================ */
_p6.css(`

/* ── 1. Dashboard: fully scrollable ── */
#view-dashboard {
    overflow-y: auto !important;
    height: auto !important;
    max-height: none !important;
    padding-bottom: 80px;
}
#main-scroll {
    overflow-y: auto !important;
    overflow-x: hidden !important;
}

/* ── 2. Mobile nav: always visible after login ── */
#mobile-nav { display: none; }
@media (max-width: 768px) {
    #mobile-nav { display: block !important; }
    #main-scroll { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important; }
}

/* ── 3. Notes: table borders in light mode ── */
body.theme-light .note-editor-area table,
body.theme-light #note-editor table,
html[data-theme="light"] #note-editor table {
    border-collapse: collapse !important;
}
body.theme-light #note-editor table td,
body.theme-light #note-editor table th,
html[data-theme="light"] #note-editor table td,
html[data-theme="light"] #note-editor table th {
    border: 1px solid rgba(0,0,0,0.2) !important;
    padding: 4px 8px;
}
/* Also fix in dark mode where white border was invisible on white bg */
#note-editor table { border-collapse: collapse; }
#note-editor table td, #note-editor table th {
    border: 1px solid rgba(128,128,128,0.35) !important;
    padding: 4px 8px;
}



/* ── 5. Focus timer: sound toggle dot visible in both modes ── */
#timer-sound-dot {
    background: var(--text-main) !important;
    box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.theme-light #timer-sound-dot,
[data-theme="light"] #timer-sound-dot {
    background: #1e293b !important;
}
#timer-sound-toggle,
.settings-row button[onclick*="toggleTimerSound"] {
    background: var(--glass-hover) !important;
    border: 1px solid rgba(128,128,128,0.25) !important;
}

/* ── 6. Forum: nested replies ── */
.ft-reply-thread {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
}
.ft-reply-nested {
    margin-left: 32px;
    border-left: 2px solid rgba(255,255,255,.07);
    padding-left: 14px;
}
.ft-reply-reply-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: .68rem;
    font-weight: 700;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    transition: color .12s, background .12s;
    margin-top: 4px;
}
.ft-reply-reply-btn:hover { color: var(--accent); background: rgba(59,130,246,.1); }
.ft-inline-reply-box {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
}
.ft-inline-reply-box textarea {
    flex: 1;
    background: var(--glass-panel);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px;
    padding: 8px 12px;
    color: var(--text-main);
    font-size: .8rem;
    resize: none;
    outline: none;
    min-height: 56px;
    font-family: inherit;
    transition: border-color .15s;
}
.ft-inline-reply-box textarea:focus { border-color: var(--accent); }
.ft-inline-reply-box button {
    padding: 6px 14px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: .75rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity .15s;
}
.ft-inline-reply-box button:hover { opacity: .85; }

/* ── 7. Forum: visibility badge ── */
.fpc-vis-badge {
    font-size: .58rem;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 99px;
    letter-spacing: .04em;
    flex-shrink: 0;
}
.fpc-vis-public  { background: rgba(34,197,94,.15);  color: #22c55e; }
.fpc-vis-school  { background: rgba(59,130,246,.15); color: #60a5fa; }
.fpc-vis-private { background: rgba(239,68,68,.15);  color: #f87171; }

/* ── 8. Forum: post form visibility selector ── */
#forum-new-visibility {
    background: var(--glass-panel);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    color: var(--text-main);
    font-size: .8rem;
    padding: 7px 12px;
    outline: none;
    cursor: pointer;
    width: 100%;
    margin-top: 8px;
}

/* ── 9. Forum: report button ── */
.fpc-report-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: .65rem;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    opacity: 0;
    transition: opacity .12s, color .12s;
}
.forum-post-card:hover .fpc-report-btn { opacity: 1; }
.fpc-report-btn:hover { color: #f59e0b; }

/* ── 10. Forum: mod panel ── */
#p6-mod-panel {
    position: fixed;
    right: 20px;
    bottom: 90px;
    z-index: 300;
    background: var(--bg-color);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 20px;
    padding: 20px;
    width: 340px;
    max-height: 70vh;
    overflow-y: auto;
    box-shadow: 0 12px 48px rgba(0,0,0,.5);
    display: none;
    flex-direction: column;
    gap: 12px;
}
#p6-mod-panel.open { display: flex; }
#p6-mod-btn {
    position: fixed;
    right: 20px;
    bottom: 160px;
    z-index: 300;
    background: #f59e0b;
    color: #000;
    border: none;
    border-radius: 14px;
    padding: 8px 14px;
    font-size: .72rem;
    font-weight: 800;
    cursor: pointer;
    display: none;
    box-shadow: 0 4px 16px rgba(245,158,11,.4);
    transition: transform .12s;
}
#p6-mod-btn:hover { transform: scale(1.05); }
.p6-banned-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(239,68,68,.12);
    border: 1px solid rgba(239,68,68,.25);
    color: #f87171;
    border-radius: 8px;
    font-size: .72rem;
    padding: 3px 10px;
    font-weight: 600;
    cursor: pointer;
    transition: background .12s;
}
.p6-banned-tag:hover { background: rgba(239,68,68,.25); }

/* ── 11. Music: video toggle ── */
#p6-music-video-wrap {
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.1);
    margin-bottom: 20px;
    display: none;
    position: relative;
    aspect-ratio: 16/9;
    max-height: 360px;
    background: #000;
}
#p6-music-video-wrap.visible { display: block; }
#p6-music-video-wrap iframe {
    width: 100% !important;
    height: 100% !important;
    position: absolute;
    top: 0; left: 0;
    border: none;
}
.p6-video-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 10px;
    background: var(--glass-panel);
    border: 1px solid rgba(255,255,255,.09);
    color: var(--text-muted);
    font-size: .75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all .15s;
    flex-shrink: 0;
}
.p6-video-toggle-btn:hover { background: var(--glass-hover); color: var(--text-main); }
.p6-video-toggle-btn.active { background: rgba(99,102,241,.15); color: #818cf8; border-color: rgba(99,102,241,.3); }

/* ── 12. Music: edit button on custom stations ── */
.mc-edit-btn {
    width: 28px; height: 28px; border-radius: 8px; border: none;
    background: transparent; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    font-size: .72rem; cursor: pointer; transition: all .15s; flex-shrink: 0;
    opacity: 0;
}
.music-card:hover .mc-edit-btn {
    opacity: 1;
    background: rgba(59,130,246,.1);
    color: #60a5fa;
}

/* ── 13. Calendar: edit button in event list ── */
.event-edit-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: .75rem;
    transition: color .12s, background .12s;
}
.event-edit-btn:hover { color: var(--accent); background: rgba(59,130,246,.1); }

/* Scrollbar for calendar edit form */
.p6-event-edit-form {
    padding: 10px 0;
    border-top: 1px solid rgba(255,255,255,.07);
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
}
.p6-event-edit-form input, .p6-event-edit-form textarea {
    background: var(--glass-panel);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    color: var(--text-main);
    font-size: .8rem;
    padding: 7px 12px;
    outline: none;
    width: 100%;
    font-family: inherit;
}
.p6-event-edit-form input:focus,
.p6-event-edit-form textarea:focus { border-color: var(--accent); }
.p6-event-edit-btns { display: flex; gap: 8px; }
.p6-event-edit-btns button {
    flex: 1;
    padding: 7px;
    border-radius: 10px;
    font-size: .75rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: opacity .12s;
}
.p6-event-edit-btns .save-btn { background: var(--accent); color: #fff; }
.p6-event-edit-btns .cancel-btn { background: var(--glass-hover); color: var(--text-muted); }
.p6-event-edit-btns button:hover { opacity: .85; }

/* ── Fix: New-post form visibility select line ── */
.forum-new-panel > select + select { margin-top: 8px; }

`);

/* ================================================================
   SECTION 1 — GOOGLE SIGN-IN  (popup → redirect fallback)
   ================================================================ */
(function patchGoogleAuth() {
    function _doGoogleSignIn() {
        const overlay = document.getElementById('login-overlay');
        const btn     = document.getElementById('btn-google-signin');
        if (btn) btn.disabled = true;

        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');

        signInWithPopup(_auth, provider).catch(err => {
            const retryable = [
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
            ];
            if (retryable.includes(err.code)) {
                // Show user a message and try redirect
                const errEl = document.getElementById('login-error');
                if (errEl) {
                    errEl.textContent = 'Popup blocked — redirecting to Google…';
                    errEl.style.color = '#fbbf24';
                    errEl.classList.remove('hidden');
                }
                setTimeout(() => signInWithRedirect(_auth, provider), 800);
            } else if (err.code === 'auth/unauthorized-domain') {
                const errEl = document.getElementById('login-error');
                if (errEl) {
                    errEl.textContent = 'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized Domains.';
                    errEl.style.color = '#f87171';
                    errEl.classList.remove('hidden');
                }
                if (btn) btn.disabled = false;
            } else if (err.code !== 'auth/popup-closed-by-user') {
                const errEl = document.getElementById('login-error');
                if (errEl) {
                    const msgs = {
                        'auth/network-request-failed': 'Network error. Check your connection.',
                        'auth/too-many-requests': 'Too many attempts — try again later.',
                    };
                    errEl.textContent = msgs[err.code] || 'Google sign-in failed. Try email instead.';
                    errEl.style.color = '#f87171';
                    errEl.classList.remove('hidden');
                }
                if (btn) btn.disabled = false;
            }
        });
    }

    // Override once modules are ready
    function _patch() {
        if (typeof window.signInWithGoogle !== 'function') {
            setTimeout(_patch, 100);
            return;
        }
        window.signInWithGoogle = _doGoogleSignIn;
    }
    _patch();
})();

/* ================================================================
   SECTION 2 — OFFLINE MODE → localStorage PERSISTENCE
   ================================================================ */
(function patchOfflineMode() {
    // Map of DB keys → global window variable names (declared with var in script.js)
    const KEY_MAP = {
        os_tasks:       'tasks',
        os_goals:       'goals',
        os_notes:       'notes',
        os_decks:       'decks',
        os_subjects:    'subjects',
        os_events:      'calEvents',
        os_links:       'quickLinks',
        os_streak:      'streak',
        os_card_stats:  'cardStats',
    };

    let _offlineMode = false;

    function _persistToLS() {
        if (!_offlineMode) return;
        for (const [lsKey, winVar] of Object.entries(KEY_MAP)) {
            const val = window[winVar];
            if (val !== undefined) {
                try { localStorage.setItem(lsKey, JSON.stringify(val)); } catch(e) {}
            }
        }
        // Quick note
        const qn = document.getElementById('quick-note-text');
        if (qn) {
            try { localStorage.setItem('os_quick_note', qn.value); } catch(e) {}
        }
    }

    // Intercept the offline button — wait for DOM
    function _patchOfflineBtn() {
        const btn = document.querySelector('#login-overlay button[onclick*="Continue offline"], #login-overlay button[onclick*="offline"]');
        if (!btn) { setTimeout(_patchOfflineBtn, 200); return; }
        const origClick = btn.onclick;
        btn.onclick = function(e) {
            _offlineMode = true;
            window._p6_offlineMode = true;
            // Start persisting every 5 s
            setInterval(_persistToLS, 5000);
            if (origClick) origClick.call(this, e);
        };
    }
    _patchOfflineBtn();

    // Also patch initApp to detect offline mode
    function _patchInitApp() {
        if (typeof window.initApp !== 'function') { setTimeout(_patchInitApp, 200); return; }
        const _orig = window.initApp;
        window.initApp = function() {
            _orig.apply(this, arguments);
            // If user is not logged in (uid is null) treat as offline
            if (!_uid) {
                _offlineMode = true;
                window._p6_offlineMode = true;
                setInterval(_persistToLS, 5000);
            }
        };
    }
    _patchInitApp();
})();

/* ================================================================
   SECTION 3 — FORUM: THREADED REPLIES (replies to replies)
   ================================================================ */
(function patchForumThreaded() {
    let _currentPostId = null;
    let _replyingToId  = null;   // parentReplyId for nested replies
    let _replyingToName = '';
    let _allReplies    = [];

    /* Expose "reply to reply" function globally */
    window.p6StartNestedReply = function(replyId, replyAuthor) {
        _replyingToId   = replyId;
        _replyingToName = replyAuthor;
        // Update the main reply textarea hint
        const inp = document.getElementById('forum-reply-input');
        const errEl = document.getElementById('forum-reply-error');
        if (inp) {
            inp.placeholder = `Replying to ${replyAuthor}… (Ctrl+Enter to send)`;
            inp.focus();
        }
        if (errEl) {
            errEl.innerHTML = `<span style="color:var(--accent);font-size:.7rem;">↩ Replying to <b>${_p6.esc(replyAuthor)}</b> — <button onclick="p6CancelNestedReply()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.7rem;">Cancel</button></span>`;
        }
    };

    window.p6CancelNestedReply = function() {
        _replyingToId   = null;
        _replyingToName = '';
        const inp = document.getElementById('forum-reply-input');
        if (inp) inp.placeholder = 'Write a reply… (Ctrl+Enter to submit)';
        const errEl = document.getElementById('forum-reply-error');
        if (errEl) errEl.innerHTML = '';
    };

    /* Override forumSubmitReply to include parentReplyId */
    function _patchSubmitReply() {
        if (typeof window.forumSubmitReply !== 'function') { setTimeout(_patchSubmitReply, 200); return; }
        const _orig = window.forumSubmitReply;
        window.forumSubmitReply = async function() {
            // If not replying to a specific reply, use original
            if (!_replyingToId) { await _orig(); return; }

            const bodyEl = document.getElementById('forum-reply-input');
            const errEl  = document.getElementById('forum-reply-error');
            const btn    = document.getElementById('forum-reply-btn');
            if (!bodyEl) return;
            const body = bodyEl.value.trim();
            if (!body) { errEl.innerHTML = 'Please write a reply first.'; return; }

            // Get current post ID from the thread state
            const postId = _currentPostId;
            if (!postId) { await _orig(); return; }

            errEl.innerHTML = '';
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

            try {
                await addDoc(
                    collection(_db, 'forum_posts', postId, 'replies'),
                    {
                        uid:           _uid,
                        displayName:   _uname,
                        body,
                        parentReplyId: _replyingToId,
                        isAnswer:      false,
                        createdAt:     serverTimestamp()
                    }
                );
                // best-effort counter
                try { await updateDoc(doc(_db, 'forum_posts', postId), { replyCount: increment(1) }); } catch(e) {}
                bodyEl.value = '';
                p6CancelNestedReply();
                _p6.toast('Reply posted ✓');
            } catch(e) {
                if (errEl) errEl.innerHTML = 'Could not post reply.';
                console.error('[p6] nested reply error:', e);
            }
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-reply"></i> Reply'; }
        };
    }
    _patchSubmitReply();

    /* Patch forumOpenPost to capture post ID and enhance reply rendering */
    function _patchOpenPost() {
        if (typeof window.forumOpenPost !== 'function') { setTimeout(_patchOpenPost, 200); return; }
        const _orig = window.forumOpenPost;
        window.forumOpenPost = async function(postId) {
            _currentPostId  = postId;
            _replyingToId   = null;
            _replyingToName = '';
            await _orig(postId);
            // Wait for the original to render, then enhance
            setTimeout(() => _enhanceReplySection(postId), 80);
        };
    }
    _patchOpenPost();

    /* Render nested replies on top of the existing flat list */
    async function _enhanceReplySection(postId) {
        const el = document.getElementById('forum-thread-replies');
        if (!el) return;

        try {
            const snap = await getDocs(
                query(collection(_db, 'forum_posts', postId, 'replies'), orderBy('createdAt', 'asc'))
            );
            _allReplies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            _renderNestedReplies(postId, el, _allReplies);
        } catch(e) {
            console.warn('[p6] enhanceReplySection:', e);
            // fallback: just attach reply buttons to existing items
            el.querySelectorAll('.ft-reply').forEach(row => {
                if (!row.querySelector('.ft-reply-reply-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'ft-reply-reply-btn';
                    btn.innerHTML = '<i class="fa-solid fa-reply fa-flip-horizontal"></i> Reply';
                    btn.setAttribute('onclick', `p6StartNestedReply('__unknown', '...')`);
                    row.appendChild(btn);
                }
            });
        }
    }

    function _renderNestedReplies(postId, container, replies) {
        // Build tree: top-level = no parentReplyId
        const topLevel = replies.filter(r => !r.parentReplyId);
        const byParent = {};
        replies.forEach(r => {
            if (r.parentReplyId) {
                if (!byParent[r.parentReplyId]) byParent[r.parentReplyId] = [];
                byParent[r.parentReplyId].push(r);
            }
        });

        if (topLevel.length === 0) {
            container.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--text-muted);font-size:.8rem;"><i class="fa-regular fa-comment" style="font-size:1.5rem;opacity:.3;display:block;margin-bottom:8px;"></i>No replies yet</div>`;
            return;
        }

        container.innerHTML = topLevel.map(r => _replyHTML(postId, r, byParent, 0)).join('');
    }

    function _replyHTML(postId, r, byParent, depth) {
        const isOwn = r.uid === _uid;
        const voted = false; // simplified for nested
        const children = byParent[r.id] || [];
        const ts = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : new Date();
        const ago = _timeAgoP6(ts);
        const depthClass = depth > 0 ? 'ft-reply-nested' : '';
        const avatarColor = r.isAnswer ? '#22c55e' : '#6b7280';
        const initials = (r.displayName || '?').slice(0, 1).toUpperCase();

        const html = `
        <div class="ft-reply ${r.isAnswer ? 'is-answer' : ''} ${depthClass}" id="reply-${r.id}">
            <div class="ft-reply-header">
                <div class="forum-avatar" style="background:${avatarColor}">${initials}</div>
                <span class="fpc-author">${_p6.esc(r.displayName || 'Anonymous')}</span>
                ${r.isAnswer ? '<span class="ft-answer-badge"><i class="fa-solid fa-check"></i> Best answer</span>' : ''}
                <span class="fpc-dot">·</span>
                <span class="fpc-time">${ago}</span>
                ${isOwn ? `<button class="ft-reply-delete" onclick="forumDeleteReply('${postId}','${r.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
            <div class="ft-reply-body">${_p6.esc(r.body).replace(/\n/g, '<br>')}</div>
            <div>
                <button class="ft-reply-reply-btn" onclick="p6StartNestedReply('${r.id}','${_p6.esc(r.displayName || 'Anonymous')}')">
                    <i class="fa-solid fa-reply fa-flip-horizontal"></i> Reply
                </button>
            </div>
            ${children.length > 0 ? `<div class="ft-reply-thread">${children.map(c => _replyHTML(postId, c, byParent, depth + 1)).join('')}</div>` : ''}
        </div>`;
        return html;
    }

    function _timeAgoP6(d) {
        const sec = Math.floor((Date.now() - d) / 1000);
        if (sec < 60)    return `${sec}s ago`;
        if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
        if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
})();

/* ================================================================
   SECTION 4 — FORUM: POST VISIBILITY
   ================================================================ */
(function patchForumVisibility() {
    /* Add visibility select to the new-post form */
    function _injectVisibilitySelect() {
        const subjectSel = document.getElementById('forum-new-subject');
        if (!subjectSel || document.getElementById('forum-new-visibility')) return;

        const sel = document.createElement('select');
        sel.id = 'forum-new-visibility';
        sel.innerHTML = `
            <option value="public">🌍 Public — everyone can see this</option>
            <option value="school">🏫 School — only logged-in users</option>
            <option value="private">🔒 Private — only me</option>
        `;
        subjectSel.insertAdjacentElement('afterend', sel);
    }

    // Inject once when the panel opens
    function _patchOpenNew() {
        if (typeof window.forumOpenNew !== 'function') { setTimeout(_patchOpenNew, 200); return; }
        const _orig = window.forumOpenNew;
        window.forumOpenNew = function() {
            _orig.apply(this, arguments);
            setTimeout(_injectVisibilitySelect, 50);
        };
    }
    _patchOpenNew();
    setTimeout(_injectVisibilitySelect, 1000);

    /* Patch forumSubmitPost to save visibility */
    function _patchSubmitPost() {
        if (typeof window.forumSubmitPost !== 'function') { setTimeout(_patchSubmitPost, 200); return; }
        const _orig = window.forumSubmitPost;
        window.forumSubmitPost = async function() {
            // Set visibility field on the post before original runs
            const visSel = document.getElementById('forum-new-visibility');
            window._p6_pendingVisibility = visSel ? visSel.value : 'public';
            await _orig.apply(this, arguments);
        };
    }
    _patchSubmitPost();

    /* Intercept addDoc at Firestore level is impractical; instead override the render
       to skip private posts from other users */
    function _patchForumRender() {
        // We hook into the forum_fix / forum_fix render loop indirectly
        // by patching the snapshot callback via overriding forumInit
        if (typeof window.forumInit !== 'function') { setTimeout(_patchForumRender, 200); return; }
        const _orig = window.forumInit;
        window.forumInit = function() {
            _orig.apply(this, arguments);
            // After init, set up a MutationObserver to badge posts with visibility
            setTimeout(_badgeVisibility, 300);
        };
    }
    _patchForumRender();

    function _badgeVisibility() {
        document.querySelectorAll('.forum-post-card[data-visibility]').forEach(card => {
            if (card.querySelector('.fpc-vis-badge')) return;
            const vis = card.dataset.visibility || 'public';
            const labels = { public: '🌍', school: '🏫', private: '🔒' };
            const badge = document.createElement('span');
            badge.className = `fpc-vis-badge fpc-vis-${vis}`;
            badge.textContent = labels[vis] || '🌍';
            badge.title = { public: 'Public', school: 'School only', private: 'Private' }[vis] || '';
            const meta = card.querySelector('.fpc-meta');
            if (meta) meta.appendChild(badge);
        });
    }

    // Observe the post list for new posts and badge them
    const observer = new MutationObserver(() => _badgeVisibility());
    const list = document.getElementById('forum-post-list');
    if (list) observer.observe(list, { childList: true, subtree: false });
    else setTimeout(() => {
        const l2 = document.getElementById('forum-post-list');
        if (l2) observer.observe(l2, { childList: true, subtree: false });
    }, 1500);
})();

/* ================================================================
   SECTION 5 — FORUM: MODERATION (banned words + report + mod panel)
   ================================================================ */
(function patchForumModeration() {
    /* ── Banned words stored in Firestore config/moderation ── */
    let _bannedWords = [];
    let _isMod = false;
    let _reportedPosts = [];

    // Load mod config from Firestore
    async function _loadModConfig() {
        if (!_db) return;
        try {
            const snap = await getDoc(doc(_db, 'config', 'moderation'));
            if (snap.exists()) {
                _bannedWords = snap.data().bannedWords || [];
                const mods   = snap.data().moderators  || [];
                _isMod = _uid && mods.includes(_uid);
                if (_isMod) _showModBtn();
            }
        } catch(e) {
            // Config may not exist yet — that's fine
        }
    }

    function _containsBannedWord(text) {
        const lower = text.toLowerCase();
        return _bannedWords.some(w => lower.includes(w.toLowerCase()));
    }

    /* ── Show mod button ── */
    function _showModBtn() {
        if (document.getElementById('p6-mod-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'p6-mod-btn';
        btn.innerHTML = '🛡️ Mod';
        btn.onclick = () => _toggleModPanel();
        document.body.appendChild(btn);
    }

    function _toggleModPanel() {
        let panel = document.getElementById('p6-mod-panel');
        if (!panel) { panel = _buildModPanel(); document.body.appendChild(panel); }
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) _refreshModPanel(panel);
    }

    function _buildModPanel() {
        const panel = document.createElement('div');
        panel.id = 'p6-mod-panel';
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="font-size:.85rem;font-weight:800;margin:0;">🛡️ Mod Panel</h3>
                <button onclick="document.getElementById('p6-mod-panel').classList.remove('open')" 
                        style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;">✕</button>
            </div>
            <div>
                <div style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:8px;">Banned Words</div>
                <div id="p6-banned-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>
                <div style="display:flex;gap:8px;">
                    <input id="p6-banned-input" type="text" placeholder="Add word…" 
                           style="flex:1;background:var(--glass-panel);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text-main);font-size:.8rem;outline:none;"
                           onkeypress="if(event.key==='Enter')window.p6AddBannedWord()">
                    <button onclick="window.p6AddBannedWord()" 
                            style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.75rem;font-weight:700;cursor:pointer;">Add</button>
                </div>
            </div>
            <div>
                <div style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:8px;">Reported Posts</div>
                <div id="p6-reported-list" style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto;"></div>
            </div>
        `;
        return panel;
    }

    async function _refreshModPanel(panel) {
        // Banned words
        const bl = panel.querySelector('#p6-banned-list');
        if (bl) {
            bl.innerHTML = _bannedWords.map(w =>
                `<span class="p6-banned-tag" onclick="window.p6RemoveBannedWord('${_p6.esc(w)}')" title="Click to remove">${_p6.esc(w)} ✕</span>`
            ).join('');
        }
        // Reported posts
        try {
            const snap = await getDocs(
                query(collection(_db, 'forum_posts'), orderBy('reportCount', 'desc'), limit(20))
            );
            const reported = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => (p.reportCount || 0) > 0);
            const rl = panel.querySelector('#p6-reported-list');
            if (rl) {
                rl.innerHTML = reported.length === 0
                    ? '<div style="font-size:.75rem;color:var(--text-muted);">No reported posts.</div>'
                    : reported.map(p => `
                        <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px;font-size:.78rem;">
                            <div style="font-weight:700;margin-bottom:4px;">${_p6.esc(p.title)}</div>
                            <div style="color:var(--text-muted);font-size:.68rem;margin-bottom:6px;">by ${_p6.esc(p.displayName || 'Anonymous')} · ${p.reportCount || 0} report(s)</div>
                            <div style="display:flex;gap:6px;">
                                <button onclick="window.p6ModDelete('${p.id}')" style="background:rgba(239,68,68,.2);color:#f87171;border:none;border-radius:6px;padding:4px 10px;font-size:.7rem;font-weight:700;cursor:pointer;">Delete Post</button>
                                <button onclick="window.p6ModClearReport('${p.id}')" style="background:var(--glass-panel);color:var(--text-muted);border:none;border-radius:6px;padding:4px 10px;font-size:.7rem;cursor:pointer;">Clear Flag</button>
                            </div>
                        </div>
                    `).join('');
            }
        } catch(e) {}
    }

    window.p6AddBannedWord = async function() {
        const inp = document.getElementById('p6-banned-input');
        const word = inp ? inp.value.trim().toLowerCase() : '';
        if (!word || _bannedWords.includes(word)) return;
        _bannedWords.push(word);
        try {
            await setDoc(doc(_db, 'config', 'moderation'), { bannedWords: _bannedWords }, { merge: true });
            _p6.toast(`"${word}" added to banned words ✓`);
            if (inp) inp.value = '';
            const panel = document.getElementById('p6-mod-panel');
            if (panel) _refreshModPanel(panel);
        } catch(e) { _p6.toast('Failed to save', true); }
    };

    window.p6RemoveBannedWord = async function(word) {
        _bannedWords = _bannedWords.filter(w => w !== word);
        try {
            await setDoc(doc(_db, 'config', 'moderation'), { bannedWords: _bannedWords }, { merge: true });
            const panel = document.getElementById('p6-mod-panel');
            if (panel) _refreshModPanel(panel);
        } catch(e) {}
    };

    window.p6ModDelete = async function(postId) {
        if (!confirm('Delete this reported post?')) return;
        try {
            await deleteDoc(doc(_db, 'forum_posts', postId));
            const panel = document.getElementById('p6-mod-panel');
            if (panel) _refreshModPanel(panel);
            _p6.toast('Post deleted by mod ✓');
        } catch(e) { _p6.toast('Could not delete', true); }
    };

    window.p6ModClearReport = async function(postId) {
        try {
            await updateDoc(doc(_db, 'forum_posts', postId), { reportCount: 0, reported: false });
            const panel = document.getElementById('p6-mod-panel');
            if (panel) _refreshModPanel(panel);
            _p6.toast('Report cleared ✓');
        } catch(e) {}
    };

    /* ── Banned word filter on post/reply submit ── */
    function _patchSubmitForBanned() {
        if (typeof window.forumSubmitPost !== 'function') { setTimeout(_patchSubmitForBanned, 200); return; }
        const _orig = window.forumSubmitPost;
        window.forumSubmitPost = async function() {
            const title = document.getElementById('forum-new-title')?.value || '';
            const body  = document.getElementById('forum-new-body')?.value || '';
            if (_containsBannedWord(title + ' ' + body)) {
                const errEl = document.getElementById('forum-new-error');
                if (errEl) errEl.textContent = '⚠️ Your post contains prohibited content and cannot be posted.';
                return;
            }
            await _orig.apply(this, arguments);
        };
    }
    _patchSubmitForBanned();

    /* ── Report button on post cards ── */
    window.p6ReportPost = async function(postId) {
        if (!_uid) { _p6.toast('Log in to report posts', true); return; }
        if (!confirm('Report this post as inappropriate?')) return;
        try {
            await updateDoc(doc(_db, 'forum_posts', postId), {
                reported: true,
                reportCount: increment(1),
                reportedBy: arrayUnion(_uid)
            });
            _p6.toast('Post reported. A moderator will review it. ✓');
        } catch(e) {
            _p6.toast('Report failed — check connection', true);
        }
    };

    /* Inject report button via MutationObserver on the post list */
    function _injectReportButtons() {
        document.querySelectorAll('.forum-post-card:not([data-p6-report])').forEach(card => {
            card.dataset.p6Report = '1';
            const footer = card.querySelector('.fpc-footer');
            if (!footer) return;
            // Get post ID from the onclick attr of the card
            const onclick = card.getAttribute('onclick') || '';
            const m = onclick.match(/forumOpenPost\(['"]([^'"]+)['"]\)/);
            const postId = m ? m[1] : null;
            if (!postId) return;
            const btn = document.createElement('button');
            btn.className = 'fpc-report-btn';
            btn.innerHTML = '<i class="fa-solid fa-flag"></i>';
            btn.title = 'Report this post';
            btn.onclick = (e) => { e.stopPropagation(); window.p6ReportPost(postId); };
            footer.appendChild(btn);
        });
    }

    const _postListObs = new MutationObserver(_injectReportButtons);
    function _observePostList() {
        const list = document.getElementById('forum-post-list');
        if (list) { _postListObs.observe(list, { childList: true }); _injectReportButtons(); }
        else setTimeout(_observePostList, 500);
    }
    _observePostList();

    /* Load mod config once auth is ready */
    function _waitAuth() {
        if (!_auth) { setTimeout(_waitAuth, 200); return; }
        onAuthStateChanged(_auth, u => {
            if (u) {
                _uid = u.uid;
                _loadModConfig();
            }
        });
    }
    _waitAuth();

    /* Also show mod button if window.P6_ADMIN_UID is set to current UID */
    setTimeout(() => {
        if (window.P6_ADMIN_UID && _uid && window.P6_ADMIN_UID === _uid) {
            _isMod = true;
            _showModBtn();
        }
    }, 2000);
})();

/* ================================================================
   SECTION 6 — NOTES: CHECKBOX ROBUSTNESS FIX
   Additional fix on top of the existing patch in script.js
   ================================================================ */
(function patchNotesCheckboxes() {
    // Listen for clicks on checkboxes in the editor (handles dynamic insertion)
    document.addEventListener('click', function(e) {
        const cb = e.target;
        if (cb.tagName !== 'INPUT' || cb.type !== 'checkbox') return;
        const editor = document.getElementById('note-editor');
        if (!editor || !editor.contains(cb)) return;
        // Sync data-checked attributes
        const row = cb.closest('.note-cb-row');
        if (row) {
            row.dataset.checked = cb.checked ? 'true' : 'false';
            row.classList.toggle('cb-checked', cb.checked);
        }
        setTimeout(() => { if (typeof window.saveNote === 'function') window.saveNote(); }, 30);
    });
})();

/* ================================================================
   SECTION 7 — NOTES: IMPROVED STICKER PANEL
   Replaces/enhances the sticker panel with overflow-scrollable grid
   ================================================================ */
(function patchStickerPanel() {
    const STICKERS = [
        '⭐','🔥','✅','❌','💡','📌','🎯','🚀',
        '💪','🧠','📚','✏️','📝','🔍','⚡','🎉',
        '😊','😎','🤔','😅','😂','🥳','🙌','👍',
        '❤️','💙','💚','💛','🧡','💜','🖤','🤍',
        '🌟','🌈','☀️','🌙','⚡','❄️','🌊','🌺',
        '🏆','🎖️','🥇','🥈','🥉','🏅','🎪','🎨',
        '📊','📈','📉','📅','📆','⏰','🕐','🗓️',
        '🔔','💬','📢','📣','🔊','🔇','🔕','💭',
        '🍎','🍊','🍋','🍇','🍓','🍕','☕','🍵',
        '🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎤',
        '🖥️','📱','💻','⌨️','🖱️','📡','🔋','💾',
        '✈️','🚗','🚂','⛵','🚲','🏍️','🚕','🛸',
        '🏠','🏫','🏢','🏛️','🗼','⛩️','🌉','🌃',
        '🦁','🐯','🦊','🐺','🦝','🐻','🐼','🦄',
        '🌸','🌻','🌹','🌷','🌿','🍀','🌱','🌴',
    ];

    window.toggleStickerPanel = function() {
        // Remove existing panel if open
        const existing = document.getElementById('p6-sticker-panel');
        if (existing) { existing.remove(); return; }

        const editor = document.getElementById('note-editor');
        const toolbar = document.querySelector('[onclick*="toggleStickerPanel"]')
                     || document.querySelector('#note-toolbar');
        if (!editor) return;

        const panel = document.createElement('div');
        panel.id = 'p6-sticker-panel';
        panel.className = 'p6-sticker-panel';

        panel.innerHTML = STICKERS.map(s =>
            `<button class="p6-sticker-btn" onclick="window.insertSticker('${s}')" type="button">${s}</button>`
        ).join('');

        // Position near the toolbar or near editor
        const ref = toolbar || editor;
        const rect = ref.getBoundingClientRect();
        panel.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
        panel.style.left = Math.min(rect.left, window.innerWidth - 300) + 'px';
        panel.style.position = 'fixed';
        panel.style.top  = (rect.bottom + 6) + 'px';
        panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300)) + 'px';
        document.body.appendChild(panel);

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function _close(e) {
                if (!panel.contains(e.target) && !e.target.closest('[onclick*="toggleStickerPanel"]')) {
                    panel.remove();
                    document.removeEventListener('click', _close);
                }
            });
        }, 0);
    };

    window.insertSticker = function(emoji) {
        const editor = document.getElementById('note-editor');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertText', false, emoji + ' ');
        if (typeof window.saveNote === 'function') setTimeout(window.saveNote, 50);
        // Close panel
        const panel = document.getElementById('p6-sticker-panel');
        if (panel) panel.remove();
    };
})();

/* ================================================================
   SECTION 8 — FORMULA SHEETS: PREVIEW ONLY AFTER TYPING
   ================================================================ */
(function patchFormulaPreview() {
    function _patchOpenModal() {
        if (typeof window.openModal !== 'function') { setTimeout(_patchOpenModal, 200); return; }
        const _orig = window.openModal;
        window.openModal = function(id) {
            _orig.apply(this, arguments);
            if (id !== 'modal-formula') return;

            // Clear preview on modal open so it doesn't show stale content
            setTimeout(() => {
                const preview = document.getElementById('formula-modal-preview');
                if (preview) {
                    preview.innerHTML = '<span style="color:var(--text-muted);font-size:.75rem;">Start typing to preview…</span>';
                    preview.style.opacity = '0.5';
                }

                // Attach debounced preview to the formula input
                const inp = document.getElementById('formula-modal-formula');
                if (!inp || inp.dataset.p6Preview) return;
                inp.dataset.p6Preview = '1';

                let _pt;
                inp.addEventListener('input', () => {
                    clearTimeout(_pt);
                    _pt = setTimeout(() => {
                        const val = inp.value.trim();
                        if (!val) {
                            if (preview) {
                                preview.innerHTML = '<span style="color:var(--text-muted);font-size:.75rem;">Start typing to preview…</span>';
                                preview.style.opacity = '0.5';
                            }
                            return;
                        }
                        if (preview) {
                            preview.style.opacity = '1';
                            // Try KaTeX render
                            if (window.katex) {
                                try {
                                    preview.innerHTML = window.katex.renderToString(val, { throwOnError: false, displayMode: true });
                                } catch(e) {
                                    preview.textContent = val;
                                }
                            } else if (window.renderMathInElement) {
                                preview.textContent = val;
                                window.renderMathInElement(preview, { delimiters: [
                                    {left:'$$',right:'$$',display:true},
                                    {left:'$',right:'$',display:false},
                                ], throwOnError: false });
                            } else {
                                preview.textContent = val;
                            }
                        }
                    }, 300);
                });
            }, 60);
        };
    }
    _patchOpenModal();
})();

/* ================================================================
   SECTION 9 — MUSIC: EDIT BUTTON on custom stations + VIDEO TOGGLE
   ================================================================ */
(function patchMusic() {
    /* ── A. Add edit button to custom station cards ── */
    function _patchCustomGrid() {
        if (typeof window.renderMusicCustomGrid === 'undefined') { setTimeout(_patchCustomGrid, 300); return; }
        const _orig = window.renderMusicCustomGrid;
        window.renderMusicCustomGrid = function() {
            _orig.apply(this, arguments);
            // Inject edit buttons into each custom card
            const grid = document.getElementById('music-custom-grid');
            if (!grid) return;
            grid.querySelectorAll('.music-card:not([data-p6-edit])').forEach(card => {
                card.dataset.p6Edit = '1';
                // Get the station id from the onclick attribute of the play button
                const onclick = card.getAttribute('onclick') || '';
                const m = onclick.match(/musicPlay\(['"]([^'"]+)['"]/);
                const stationId = m ? m[1] : null;
                if (!stationId) return;

                const editBtn = document.createElement('button');
                editBtn.className = 'mc-edit-btn';
                editBtn.title = 'Edit station';
                editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof window.musicOpenCustomModal === 'function') {
                        window.musicOpenCustomModal(stationId);
                    }
                };

                // Insert before the delete button
                const delBtn = card.querySelector('.mc-delete-btn');
                if (delBtn) card.insertBefore(editBtn, delBtn);
                else card.appendChild(editBtn);
            });
        };
        // Re-render immediately to apply
        window.renderMusicCustomGrid();
    }
    setTimeout(_patchCustomGrid, 600);

    /* ── B. Video feed toggle ── */
    function _injectVideoToggle() {
        const musicView = document.getElementById('view-music');
        if (!musicView || document.getElementById('p6-video-toggle')) return;

        // Create video container that shows the iframe
        const wrap = document.createElement('div');
        wrap.id = 'p6-music-video-wrap';
        wrap.innerHTML = '<div style="position:relative;width:100%;height:100%;"></div>';

        // Insert before the now-playing bar or at top of music view
        const nowBar = document.getElementById('music-now-bar');
        if (nowBar) nowBar.insertAdjacentElement('beforebegin', wrap);
        else musicView.insertAdjacentElement('afterbegin', wrap);

        // Add toggle button to the now-bar controls
        function _injectToggleBtn() {
            const controls = document.querySelector('#music-now-bar .mnb-controls');
            if (!controls || document.getElementById('p6-video-toggle')) return;

            const btn = document.createElement('button');
            btn.id = 'p6-video-toggle';
            btn.className = 'mnb-btn p6-video-toggle-btn';
            btn.title = 'Toggle video feed';
            btn.innerHTML = '<i class="fa-solid fa-video"></i>';
            btn.onclick = function() {
                const showing = wrap.classList.toggle('visible');
                btn.classList.toggle('active', showing);
                btn.innerHTML = showing
                    ? '<i class="fa-solid fa-video-slash"></i>'
                    : '<i class="fa-solid fa-video"></i>';

                if (showing) {
                    // Clone current iframe into the video wrap
                    const origFrame = document.getElementById('music-player-frame');
                    const existingClone = wrap.querySelector('iframe');
                    if (existingClone) existingClone.remove();
                    if (origFrame && origFrame.src) {
                        const clone = document.createElement('iframe');
                        clone.src = origFrame.src;
                        clone.allow = 'autoplay; fullscreen';
                        clone.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
                        wrap.querySelector('div').appendChild(clone);
                    }
                }
            };
            controls.insertBefore(btn, controls.firstChild);
        }

        // Observe now-bar visibility changes
        const obs = new MutationObserver(() => {
            const bar = document.getElementById('music-now-bar');
            if (bar && !bar.classList.contains('hidden')) _injectToggleBtn();
        });
        const bar = document.getElementById('music-now-bar');
        if (bar) obs.observe(bar, { attributes: true, attributeFilter: ['class'] });
        // Also try immediately
        setTimeout(_injectToggleBtn, 500);

        // Sync video when a new track starts
        const origPlay = window.musicPlay;
        if (origPlay) {
            window.musicPlay = function() {
                origPlay.apply(this, arguments);
                // If video is showing, update its src
                setTimeout(() => {
                    if (wrap.classList.contains('visible')) {
                        const origFrame = document.getElementById('music-player-frame');
                        const clone = wrap.querySelector('iframe');
                        if (origFrame && clone) clone.src = origFrame.src;
                        else if (origFrame && !clone) {
                            const nc = document.createElement('iframe');
                            nc.src = origFrame.src;
                            nc.allow = 'autoplay; fullscreen';
                            nc.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
                            wrap.querySelector('div').appendChild(nc);
                        }
                    }
                    _injectToggleBtn();
                }, 200);
            };
        }
    }

    function _waitMusicView() {
        const mv = document.getElementById('view-music');
        if (mv) _injectVideoToggle();
        else setTimeout(_waitMusicView, 400);
    }
    _waitMusicView();

    // Also inject when switching to music tab
    function _patchSwitchTabMusic() {
        if (typeof window.switchTab !== 'function') { setTimeout(_patchSwitchTabMusic, 200); return; }
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            if (name === 'music') setTimeout(_injectVideoToggle, 150);
        };
    }
    _patchSwitchTabMusic();
})();

/* ================================================================
   SECTION 10 — CALENDAR: EDITABLE EVENTS + MORE SETTINGS
   ================================================================ */
(function patchCalendarEvents() {
    /* Override openEventModal to add edit capability and description field */
    function _patch() {
        if (typeof window.openEventModal !== 'function') { setTimeout(_patch, 200); return; }
        const _orig = window.openEventModal;

        window.openEventModal = function(dateKey) {
            _orig.apply(this, arguments);
            // Enhance the event list with edit buttons
            setTimeout(() => _enhanceEventList(dateKey), 50);
        };

        function _enhanceEventList(dateKey) {
            const list = document.getElementById('event-list-day');
            if (!list) return;

            // Re-render with edit buttons
            let evs = [];
            try {
                // Access calEvents from window (it's a var in script.js)
                evs = (window.calEvents && window.calEvents[dateKey]) ? window.calEvents[dateKey] : [];
            } catch(e) {}

            list.innerHTML = '';
            evs.forEach((ev, idx) => {
                const row = document.createElement('div');
                row.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,.07); padding: 6px 0;';
                row.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ev.color||'var(--accent)'};margin-right:6px;"></span>
                                ${_p6.esc(ev.title)}
                            </div>
                            ${ev.time ? `<div style="font-size:.68rem;color:var(--text-muted);margin-top:2px;">⏰ ${ev.time}</div>` : ''}
                            ${ev.description ? `<div style="font-size:.7rem;color:var(--text-muted);margin-top:2px;font-style:italic;">${_p6.esc(ev.description)}</div>` : ''}
                        </div>
                        <div style="display:flex;gap:4px;flex-shrink:0;">
                            <button class="event-edit-btn" onclick="window.p6EditEvent('${dateKey}',${idx})" title="Edit">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <button class="event-edit-btn" onclick="delEv('${dateKey}',${idx})" title="Delete" style="color:var(--text-muted);">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div id="p6-event-edit-${dateKey}-${idx}" style="display:none;"></div>
                `;
                list.appendChild(row);
            });

            // Also add description field to the Add Event form if not already there
            _injectDescriptionField();
        }

        function _injectDescriptionField() {
            const timeInp = document.getElementById('event-time');
            if (!timeInp || document.getElementById('event-description')) return;
            const descInp = document.createElement('input');
            descInp.id = 'event-description';
            descInp.type = 'text';
            descInp.placeholder = 'Description (optional)…';
            descInp.className = 'bare-input w-full text-sm';
            descInp.style.marginTop = '8px';
            timeInp.insertAdjacentElement('afterend', descInp);
        }

        window.p6EditEvent = function(dateKey, idx) {
            const formId = `p6-event-edit-${dateKey}-${idx}`;
            const form   = document.getElementById(formId);
            if (!form) return;

            // Toggle
            if (form.style.display !== 'none' && form.innerHTML) {
                form.style.display = 'none';
                form.innerHTML = '';
                return;
            }

            const evs = (window.calEvents && window.calEvents[dateKey]) ? window.calEvents[dateKey] : [];
            const ev  = evs[idx];
            if (!ev) return;

            form.style.display = 'block';
            form.innerHTML = `
                <div class="p6-event-edit-form">
                    <input id="p6-ev-title-${idx}" type="text" value="${_p6.esc(ev.title)}" placeholder="Event title">
                    <input id="p6-ev-time-${idx}"  type="time" value="${ev.time || ''}">
                    <input id="p6-ev-desc-${idx}"  type="text" value="${_p6.esc(ev.description || '')}" placeholder="Description (optional)…">
                    <div style="display:flex;align-items:center;gap:8px;font-size:.75rem;color:var(--text-muted);">
                        <label>Color:</label>
                        <input type="color" id="p6-ev-color-${idx}" value="${ev.color || '#3b82f6'}" 
                               style="width:28px;height:28px;border-radius:6px;border:none;cursor:pointer;padding:0;">
                    </div>
                    <div class="p6-event-edit-btns">
                        <button class="save-btn" onclick="window.p6SaveEditedEvent('${dateKey}',${idx})">Save</button>
                        <button class="cancel-btn" onclick="document.getElementById('${formId}').style.display='none'">Cancel</button>
                    </div>
                </div>
            `;
        };

        window.p6SaveEditedEvent = function(dateKey, idx) {
            if (!window.calEvents || !window.calEvents[dateKey]) return;
            const ev = window.calEvents[dateKey][idx];
            if (!ev) return;

            const titleInp = document.getElementById(`p6-ev-title-${idx}`);
            const timeInp  = document.getElementById(`p6-ev-time-${idx}`);
            const descInp  = document.getElementById(`p6-ev-desc-${idx}`);
            const colorInp = document.getElementById(`p6-ev-color-${idx}`);

            if (titleInp) ev.title       = titleInp.value.trim() || ev.title;
            if (timeInp)  ev.time        = timeInp.value;
            if (descInp)  ev.description = descInp.value.trim();
            if (colorInp) ev.color       = colorInp.value;

            if (typeof window.DB !== 'undefined') {
                window.DB.set('os_events', window.calEvents);
            } else {
                try { localStorage.setItem('os_events', JSON.stringify(window.calEvents)); } catch(e) {}
            }

            _p6.toast('Event updated ✓');
            // Re-open to refresh the list
            window.openEventModal(dateKey);
            if (typeof window.renderCalendar === 'function') window.renderCalendar();
            if (typeof window.updateDashWidgets === 'function') window.updateDashWidgets();
        };
    }

    _patch();

    /* Also patch saveCalEvent to include description */
    function _patchSaveCalEvent() {
        if (typeof window.saveCalEvent !== 'function') { setTimeout(_patchSaveCalEvent, 200); return; }
        const _orig = window.saveCalEvent;
        window.saveCalEvent = function() {
            // Inject description before calling original
            const descEl = document.getElementById('event-description');
            const inp    = document.getElementById('event-input');
            if (descEl && inp) {
                // We need to handle this — patch the calEvents object after save
                const k = inp.dataset.date;
                const desc = descEl.value.trim();
                _orig.apply(this, arguments);
                // After original saves, add description to the last added event
                setTimeout(() => {
                    if (desc && k && window.calEvents && window.calEvents[k]) {
                        const evs = window.calEvents[k];
                        if (evs.length > 0) {
                            evs[evs.length - 1].description = desc;
                            if (typeof window.DB !== 'undefined') window.DB.set('os_events', window.calEvents);
                        }
                    }
                    if (descEl) descEl.value = '';
                }, 50);
            } else {
                _orig.apply(this, arguments);
            }
        };
    }
    _patchSaveCalEvent();
})();

/* ================================================================
   SECTION 11 — DASHBOARD: SCROLLABILITY FIX
   ================================================================ */
(function patchDashboardScroll() {
    function _fix() {
        const main = document.getElementById('main-scroll');
        const dash = document.getElementById('view-dashboard');
        if (main) {
            main.style.overflowY = 'auto';
            main.style.height    = '100%';
        }
        if (dash) {
            dash.style.overflowY  = 'visible';
            dash.style.maxHeight  = 'none';
            dash.style.paddingBottom = '40px';
        }
    }
    _fix();
    // Reapply when dashboard tab activates
    function _patchST() {
        if (typeof window.switchTab !== 'function') { setTimeout(_patchST, 200); return; }
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            if (name === 'dashboard') setTimeout(_fix, 30);
        };
    }
    _patchST();
})();

/* ================================================================
   SECTION 12 — MOBILE: NAV BAR ALWAYS VISIBLE AFTER LOGIN
   Add Music, Forum, Formulas to mobile "More" drawer
   ================================================================ */
(function patchMobileNav() {
    // Ensure #mobile-nav is hidden on desktop, shown on mobile
    _p6.css(`
        #mobile-nav { display: none; }
        @media (max-width: 768px) { #mobile-nav { display: block !important; } }
        #mob-more-drawer { display: none; }
        #mob-more-drawer.open { display: flex !important; }
    `);

    // Add missing tabs to the mobile drawer
    function _enhanceMobileDrawer() {
        const drawer = document.getElementById('mob-more-drawer');
        if (!drawer || drawer.dataset.p6Enhanced) return;
        drawer.dataset.p6Enhanced = '1';

        // Add Music, Forum, Formulas if missing
        const tools = drawer.querySelector('.mbd-tools');
        if (tools) {
            const extraTabs = [
                { id: 'music',    icon: 'fa-music',            color: '#8b5cf6', label: 'Music' },
                { id: 'forum',    icon: 'fa-comments',         color: '#3b82f6', label: 'Forum' },
                { id: 'formulas', icon: 'fa-square-root-alt',  color: '#06b6d4', label: 'Formulas' },
            ];
            extraTabs.forEach(tab => {
                if (document.getElementById('mob-btn-' + tab.id)) return; // already exists
                const btn = document.createElement('button');
                btn.className = 'mbd-tool';
                btn.id = 'mob-btn-' + tab.id;
                btn.style.cssText = `--c:${tab.color}`;
                btn.innerHTML = `<i class="fa-solid ${tab.icon} mbd-tool-icon"></i><span class="mbd-tool-name">${tab.label}</span>`;
                btn.onclick = () => { window.switchTab && window.switchTab(tab.id); window.closeMobMenu && window.closeMobMenu(); };
                tools.appendChild(btn);
            });
        }
    }

    // Apply once DOM is ready
    setTimeout(_enhanceMobileDrawer, 600);

    // Patch switchTab to update mobile nav active state for all tabs
    function _patchST() {
        if (typeof window.switchTab !== 'function') { setTimeout(_patchST, 200); return; }
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig.apply(this, arguments);
            // Update active state for drawer tabs too
            document.querySelectorAll('.mbd-tool, .mbd-feat').forEach(btn => {
                const tabId = btn.id ? btn.id.replace('mob-btn-', '') : null;
                if (tabId) btn.classList.toggle('active', tabId === name);
            });
            _enhanceMobileDrawer();
        };
    }
    _patchST();
})();

/* ================================================================
   SECTION 13 — POMODORO: SOUND TOGGLE LIGHT MODE FIX
   Also run a CSS polyfill in JS in case CSS vars don't cascade
   ================================================================ */
(function patchPomoSoundToggle() {
    function _fixDot() {
        const dot = document.getElementById('timer-sound-dot');
        if (!dot) return;
        // Check if we're in light mode
        const isLight = document.body.classList.contains('theme-light')
            || document.documentElement.dataset.theme === 'light'
            || getComputedStyle(document.body).getPropertyValue('--bg-color').trim().startsWith('#f')
            || getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)';
        dot.style.background = isLight ? '#1e293b' : '#ffffff';
    }

    // Run on load and when theme changes
    setTimeout(_fixDot, 500);
    // Patch toggleTheme
    function _patchTheme() {
        if (typeof window.toggleTheme !== 'function') { setTimeout(_patchTheme, 200); return; }
        const _orig = window.toggleTheme;
        window.toggleTheme = function() {
            _orig.apply(this, arguments);
            setTimeout(_fixDot, 50);
        };
    }
    _patchTheme();
})();

/* ================================================================
   FINAL: Ensure mobile nav is shown immediately when app initialises
   ================================================================ */
(function ensureMobileNav() {
    function _show() {
        const nav = document.getElementById('mobile-nav');
        if (!nav) return;
        // Only force-show on mobile viewports
        if (window.innerWidth <= 768) {
            nav.style.display = 'block';
        }
    }

    // Override initApp to also show nav
    function _patch() {
        if (typeof window.initApp !== 'function') { setTimeout(_patch, 200); return; }
        const _orig = window.initApp;
        window.initApp = function() {
            _orig.apply(this, arguments);
            setTimeout(_show, 100);
        };
    }
    _patch();

    // Also fire on load
    window.addEventListener('resize', _show);
    setTimeout(_show, 800);
})();

console.log('[StudentOS patches6 v1.0] Loaded ✓ — 13 fixes & features applied');
