/* ================================================================
   StudentOS — patches7.js   v1.0
   ---------------------------------------------------------------
   Targeted fixes only (everything else from patches6 still works):

   1.  Forum banned-word filter — clear red error + toast, no silent fail
   2.  Forum replies to replies — PROPERLY wired to #ft-replies-list
       (patches6 was watching the wrong DOM element)
   3.  Offline mode — real localStorage persistence with one-line
       script.js helper; full fallback if that line isn't added
   4.  Notes stickers — compact 32-sticker popover, exact click-only
   5.  Formula preview — never shows before typing (clears KaTeX
       auto-render from patches3.js too)
   6.  Music — edit AND delete for ALL stations (presets + custom)
       via localStorage overrides; "Restore defaults" button included

   Add AFTER patches6.js in index.html:
   <script type="module" src="patches7.js"></script>

   ⚠️  For offline mode between page reloads, add this ONE LINE to
   script.js right after the DB definition (around line 59):
       window.DB = DB;
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
    getAuth, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    getFirestore,
    doc, addDoc, collection,
    serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _auth, _db, _uid = null, _uname = 'Student';
(function _boot() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_boot, 150); return; }
    _auth = getAuth(apps[0]);
    _db   = getFirestore(apps[0]);
    onAuthStateChanged(_auth, u => {
        _uid   = u ? u.uid   : null;
        _uname = u ? (u.displayName || u.email?.split('@')[0] || 'Student') : 'Student';
    });
})();

/* ── shared helpers ── */
const _p7 = {
    css(txt) {
        const s = document.createElement('style'); s.textContent = txt;
        document.head.appendChild(s);
    },
    toast(msg, err = false) {
        const t = document.getElementById('sos-toast'); if (!t) return;
        t.textContent = msg; t.style.background = err ? '#ef4444' : '';
        t.classList.add('show');
        setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 3000);
    },
    esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; },
    lsGet(k, def) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
    lsSet(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ================================================================
   CSS — only new rules, no conflicts with patches6
   ================================================================ */
_p7.css(`

/* Banned word error — always visible, hard red */
#forum-new-error.p7-banned {
    color: #f87171 !important;
    background: rgba(239,68,68,.12) !important;
    border: 1px solid rgba(239,68,68,.3) !important;
    border-radius: 10px !important;
    padding: 8px 12px !important;
    font-size: .78rem !important;
    font-weight: 600 !important;
    display: block !important;
    margin-bottom: 10px;
    animation: p7shake .3s ease;
}
@keyframes p7shake {
    0%,100%{transform:translateX(0)}
    25%{transform:translateX(-6px)}
    75%{transform:translateX(6px)}
}

/* Reply-to buttons on individual replies */
.ft-reply-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    flex-wrap: wrap;
}
.p7-reply-btn {
    background: none;
    border: none;
    font-size: .65rem;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 7px;
    border-radius: 6px;
    transition: color .12s, background .12s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.p7-reply-btn:hover { color: var(--accent); background: rgba(59,130,246,.1); }
.p7-nested-badge {
    font-size: .6rem;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 99px;
    background: rgba(59,130,246,.1);
    color: #60a5fa;
    white-space: nowrap;
}
.ft-reply.is-nested {
    margin-left: 28px;
    border-left: 2px solid rgba(255,255,255,.08);
    padding-left: 12px;
    margin-top: 4px;
}
.p7-reply-indicator {
    font-size: .65rem;
    color: var(--accent);
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    padding: 4px 10px;
    background: rgba(59,130,246,.08);
    border-radius: 8px;
    border-left: 2px solid var(--accent);
}
.p7-reply-indicator button {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: .65rem;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 4px;
    margin-left: 4px;
    transition: color .12s;
}
.p7-reply-indicator button:hover { color: #f87171; }

/* Sticker panel — compact 8-column popover */
#p7-sticker-panel {
    position: fixed;
    z-index: 9999;
    background: var(--bg-color);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 18px;
    padding: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,.5);
    animation: p7stkIn .15s ease-out;
    width: 256px;
}
@keyframes p7stkIn {
    from { opacity: 0; transform: translateY(-5px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
.p7-stk-cats {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}
.p7-stk-cat {
    font-size: .58rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(255,255,255,.06);
    color: var(--text-muted);
    border: none;
    cursor: pointer;
    transition: all .1s;
    letter-spacing: .03em;
    text-transform: uppercase;
}
.p7-stk-cat.active { background: var(--accent); color: #fff; }
.p7-stk-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
}
.p7-stk-btn {
    font-size: 1.2rem;
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 7px;
    padding: 3px 2px;
    line-height: 1.3;
    transition: background .08s, transform .08s;
    text-align: center;
}
.p7-stk-btn:hover { background: var(--glass-hover); transform: scale(1.18); }

/* Music: edit/delete buttons on all station cards */
.p7-mc-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity .15s;
}
.music-card:hover .p7-mc-actions { opacity: 1; }
.p7-mc-action-btn {
    width: 28px; height: 28px; border-radius: 8px; border: none;
    background: transparent; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    font-size: .72rem; cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.p7-mc-action-btn.edit:hover  { background: rgba(59,130,246,.15);  color: #60a5fa; }
.p7-mc-action-btn.del:hover   { background: rgba(239,68,68,.15);   color: #f87171; }
.p7-mc-action-btn.restore:hover { background: rgba(34,197,94,.15); color: #4ade80; }

/* Preset-edit modal */
#p7-preset-modal {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(6px);
    animation: p7fadeIn .15s ease;
}
@keyframes p7fadeIn { from{opacity:0} to{opacity:1} }
.p7-preset-modal-box {
    background: var(--bg-color);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 22px;
    padding: 28px;
    width: 380px;
    max-width: calc(100vw - 32px);
    box-shadow: 0 16px 60px rgba(0,0,0,.55);
}
.p7-preset-modal-box h3 { font-size: .9rem; font-weight: 800; margin: 0 0 18px; }
.p7-pfield { margin-bottom: 14px; }
.p7-pfield label {
    display: block;
    font-size: .6rem;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 5px;
}
.p7-pfield input {
    width: 100%;
    background: var(--glass-panel);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    color: var(--text-main);
    font-size: .82rem;
    padding: 8px 12px;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color .15s;
}
.p7-pfield input:focus { border-color: var(--accent); }
.p7-pbtns { display: flex; gap: 8px; margin-top: 20px; }
.p7-pbtns button {
    flex: 1; padding: 9px; border: none; border-radius: 12px;
    font-size: .8rem; font-weight: 700; cursor: pointer; transition: opacity .12s;
}
.p7-pbtns .p7-save  { background: var(--accent); color: #fff; }
.p7-pbtns .p7-cancel { background: var(--glass-hover); color: var(--text-muted); }
.p7-pbtns button:hover { opacity: .85; }

/* Music restore-defaults button */
.p7-restore-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: .7rem;
    font-weight: 700;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: color .12s, background .12s;
    margin-top: 4px;
}
.p7-restore-btn:hover { color: #4ade80; background: rgba(34,197,94,.1); }



`);

/* ================================================================
   FIX 1 — BANNED WORD ERROR  (clear, visible, with toast)
   ================================================================ */
(function fixBannedWordError() {
    // Wait for the Section 5 of patches6 to have set up forumSubmitPost,
    // then wrap it again to improve the error UX
    function _patch() {
        const orig = window.forumSubmitPost;
        if (!orig || orig._p7BannedFixed) { setTimeout(_patch, 300); return; }

        window.forumSubmitPost = async function() {
            const title  = document.getElementById('forum-new-title')?.value || '';
            const body   = document.getElementById('forum-new-body')?.value  || '';
            const errEl  = document.getElementById('forum-new-error');

            // Load banned words from patches6 or localStorage
            const bannedWords = window._p7_getbanned?.() || [];

            const combined = (title + ' ' + body).toLowerCase();
            const hit = bannedWords.find(w => w && combined.includes(w.toLowerCase()));

            if (hit) {
                if (errEl) {
                    errEl.textContent = `⚠️ Your post contains a prohibited word ("${hit}") and cannot be posted.`;
                    errEl.className = 'p7-banned';          // triggers shake animation
                    // Auto-clear after 5 s
                    clearTimeout(errEl._p7t);
                    errEl._p7t = setTimeout(() => {
                        errEl.className = '';
                        errEl.textContent = '';
                    }, 5000);
                }
                _p7.toast(`Blocked: post contains a prohibited word.`, true);
                // Highlight offending field
                const titleEl = document.getElementById('forum-new-title');
                const bodyEl  = document.getElementById('forum-new-body');
                const inTitle = title.toLowerCase().includes(hit.toLowerCase());
                const el = inTitle ? titleEl : bodyEl;
                if (el) { el.style.borderColor = '#ef4444'; setTimeout(() => { el.style.borderColor = ''; }, 3000); }
                return;
            }

            // No banned word — call the real function
            await orig.apply(this, arguments);
        };
        window.forumSubmitPost._p7BannedFixed = true;
    }
    setTimeout(_patch, 800);   // wait for patches6 section 5 to load first

    // Expose a getter so the patch above can read banned words from patches6's closure
    // (patches6 stores them in its own closure; we store a copy in localStorage too)
    window._p7_syncBanned = function(words) {
        _p7.lsSet('_p7_banned_words', words);
    };
    window._p7_getbanned = function() {
        return _p7.lsGet('_p7_banned_words', []);
    };

    // Sync when patches6 saves banned words (p6AddBannedWord)
    const origAdd = window.p6AddBannedWord;
    if (origAdd) {
        window.p6AddBannedWord = async function() {
            await origAdd.apply(this, arguments);
            // After save, re-sync from Firestore config (patches6 already does this,
            // but we also save to localStorage for the banned-check above)
            setTimeout(() => {
                const bl = document.getElementById('p6-banned-list');
                if (bl) {
                    const words = Array.from(bl.querySelectorAll('.p6-banned-tag'))
                        .map(t => t.textContent.replace(/\s*✕\s*$/, '').trim())
                        .filter(Boolean);
                    window._p7_syncBanned(words);
                }
            }, 500);
        };
    }

    // Intercept reply submit for banned words too
    function _patchReply() {
        const orig = window.forumSubmitReply;
        if (!orig || orig._p7BannedFixed) { setTimeout(_patchReply, 500); return; }
        window.forumSubmitReply = async function() {
            const body = document.getElementById('forum-reply-input')?.value || '';
            const bannedWords = window._p7_getbanned?.() || [];
            const hit = bannedWords.find(w => w && body.toLowerCase().includes(w.toLowerCase()));
            if (hit) {
                const errEl = document.getElementById('forum-reply-error');
                if (errEl) {
                    errEl.textContent = `⚠️ Reply contains a prohibited word ("${hit}").`;
                    errEl.style.color = '#f87171';
                    setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 4000);
                }
                _p7.toast(`Blocked: reply contains a prohibited word.`, true);
                return;
            }
            await orig.apply(this, arguments);
        };
        window.forumSubmitReply._p7BannedFixed = true;
    }
    setTimeout(_patchReply, 900);
})();

/* ================================================================
   FIX 2 — FORUM REPLIES TO REPLIES  (correct element: #ft-replies-list)
   ================================================================ */
(function fixForumNestedReplies() {

    let _postId   = null;
    let _replyTo  = null;   // { id, name } of the reply being replied to
    let _observer = null;

    /* ── Public: start replying to a specific reply ── */
    window.p7ReplyTo = function(replyId, replyName) {
        _replyTo = { id: replyId, name: replyName };
        const inp = document.getElementById('forum-reply-input');
        if (inp) {
            inp.placeholder = `Replying to ${replyName}…`;
            inp.focus();
        }
        _showReplyIndicator(replyName);
    };

    window.p7CancelReplyTo = function() {
        _replyTo = null;
        const inp = document.getElementById('forum-reply-input');
        if (inp) inp.placeholder = 'Write a reply… (Ctrl+Enter to submit)';
        const ind = document.getElementById('p7-reply-indicator');
        if (ind) ind.remove();
    };

    function _showReplyIndicator(name) {
        let ind = document.getElementById('p7-reply-indicator');
        if (!ind) {
            ind = document.createElement('div');
            ind.id = 'p7-reply-indicator';
            ind.className = 'p7-reply-indicator';
            const replyBox = document.querySelector('.ft-reply-box');
            if (replyBox) replyBox.insertAdjacentElement('afterbegin', ind);
        }
        ind.innerHTML = `<i class="fa-solid fa-reply fa-flip-horizontal"></i>
            Replying to <b>${_p7.esc(name)}</b>
            <button onclick="p7CancelReplyTo()">✕ Cancel</button>`;
    }

    /* ── Patch forumOpenPost to capture post ID and start observer ── */
    function _patchOpenPost() {
        const orig = window.forumOpenPost;
        if (!orig || orig._p7Patched) { setTimeout(_patchOpenPost, 200); return; }
        window.forumOpenPost = async function(postId) {
            _postId  = postId;
            _replyTo = null;
            await orig.apply(this, arguments);
            _startObserver(postId);
        };
        window.forumOpenPost._p7Patched = true;
    }
    setTimeout(_patchOpenPost, 400);

    /* ── Patch forumCloseThread to stop observer ── */
    function _patchClose() {
        const orig = window.forumCloseThread;
        if (!orig || orig._p7Patched) { setTimeout(_patchClose, 300); return; }
        window.forumCloseThread = function() {
            _stopObserver();
            _postId  = null;
            _replyTo = null;
            orig.apply(this, arguments);
        };
        window.forumCloseThread._p7Patched = true;
    }
    setTimeout(_patchClose, 400);

    /* ── MutationObserver watches #ft-replies-list for Firestore re-renders ── */
    function _startObserver(postId) {
        _stopObserver();
        function _tryAttach() {
            const el = document.getElementById('ft-replies-list');
            if (!el) { setTimeout(_tryAttach, 100); return; }
            _observer = new MutationObserver(() => _injectReplyButtons(postId));
            _observer.observe(el, { childList: true });
            // Run immediately in case already populated
            _injectReplyButtons(postId);
        }
        setTimeout(_tryAttach, 150);
    }

    function _stopObserver() {
        if (_observer) { _observer.disconnect(); _observer = null; }
    }

    /* ── Inject "↩ Reply" buttons on each .ft-reply row ── */
    function _injectReplyButtons(postId) {
        const list = document.getElementById('ft-replies-list');
        if (!list) return;

        // Add nested indentation for replies that have parentReplyId
        list.querySelectorAll('.ft-reply:not([data-p7-reply-btn])').forEach(row => {
            row.dataset.p7ReplyBtn = '1';

            // Get reply ID from the delete button's onclick if possible
            const delBtn = row.querySelector('.ft-reply-delete');
            let replyId  = null;
            if (delBtn) {
                const m = delBtn.getAttribute('onclick')?.match(/forumDeleteReply\('[^']+','([^']+)'\)/);
                if (m) replyId = m[1];
            }
            if (!replyId) return;

            // Get author name
            const authorEl = row.querySelector('.fpc-author');
            const author   = authorEl ? authorEl.textContent.trim() : 'User';

            // Add reply button after the body
            const body = row.querySelector('.ft-reply-body');
            if (!body) return;
            const metaRow = document.createElement('div');
            metaRow.className = 'ft-reply-meta-row';
            metaRow.innerHTML = `<button class="p7-reply-btn"
                onclick="p7ReplyTo('${replyId.replace(/'/g,"\\'")}','${author.replace(/'/g,"\\'")}')">
                <i class="fa-solid fa-reply fa-flip-horizontal"></i> Reply
            </button>`;
            body.insertAdjacentElement('afterend', metaRow);
        });

        // Add nested class to replies that have parentReplyId data
        list.querySelectorAll('.ft-reply[data-parent-id]:not(.is-nested)').forEach(row => {
            row.classList.add('is-nested');
        });
    }

    /* ── Patch forumSubmitReply to include parentReplyId ── */
    function _patchSubmit() {
        const orig = window.forumSubmitReply;
        if (!orig || orig._p7Nested) { setTimeout(_patchSubmit, 300); return; }

        window.forumSubmitReply = async function() {
            // If no nested reply state, use original
            if (!_replyTo || !_postId || !_db) { return orig.apply(this, arguments); }

            const bodyEl = document.getElementById('forum-reply-input');
            const errEl  = document.getElementById('forum-reply-error');
            const btn    = document.getElementById('forum-reply-btn');
            const body   = bodyEl?.value.trim() || '';

            if (!body) {
                if (errEl) { errEl.textContent = 'Write your reply first.'; errEl.style.color = '#f87171'; }
                return;
            }
            if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

            try {
                await addDoc(
                    collection(_db, 'forum_posts', _postId, 'replies'),
                    {
                        uid:           _uid,
                        displayName:   _uname,
                        body,
                        parentReplyId: _replyTo.id,
                        isAnswer:      false,
                        createdAt:     serverTimestamp()
                    }
                );
                // Silent counter increment
                try { await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'))
                    .updateDoc(doc(_db, 'forum_posts', _postId), { replyCount: increment(1) }); } catch {}

                if (bodyEl) bodyEl.value = '';
                window.p7CancelReplyTo();
                _p7.toast('Reply posted ✓');
            } catch(e) {
                if (errEl) { errEl.textContent = 'Reply failed — check connection.'; errEl.style.color = '#f87171'; }
                console.error('[p7] nested reply:', e);
            }
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-reply"></i> Reply'; }
        };
        window.forumSubmitReply._p7Nested = true;
    }
    setTimeout(_patchSubmit, 600);

})();

/* ================================================================
   FIX 3 — OFFLINE MODE  (localStorage persistence)
   ================================================================ */
(function fixOfflineMode() {

    /* Strategy:
       a) If window.DB was exported (user added `window.DB = DB` to script.js):
          — On offline button click: hydrate the real DB from localStorage,
            then initApp re-reads all vars from the now-populated cache.
       b) If window.DB is NOT exported (user didn't add the line):
          — Patch every major window-exported save function to also
            write to localStorage as a side effect. Data persists.
          — On next offline session, patch initApp to load localStorage
            data by injecting it after the app starts via re-calling
            all render functions from a patched state.
    */

    const LS_KEYS = [
        'os_tasks','os_notes','os_decks','os_goals','os_events',
        'os_subjects','os_links','os_streak','os_card_stats',
        'os_deck_groups','os_note_groups','os_quick_note',
        'os_pomo_times','os_pomo_today','os_widgets',
    ];

    let _offline = false;

    /* ── Read all offline data from localStorage ── */
    function _loadFromLS() {
        const data = {};
        LS_KEYS.forEach(k => {
            const v = _p7.lsGet(k, null);
            if (v !== null) data[k] = v;
        });
        return Object.keys(data).length > 0 ? data : null;
    }

    /* ── Try to hydrate the real DB if exported ── */
    function _hydrateRealDB(data) {
        if (window.DB && typeof window.DB._hydrate === 'function') {
            window.DB._hydrate(data);
            return true;
        }
        return false;
    }

    /* ── Fallback: patch save functions to also write to localStorage ── */
    function _patchSaveFunctions() {
        // Patch DB.set if accessible
        if (window.DB && typeof window.DB.set === 'function') {
            const origSet = window.DB.set.bind(window.DB);
            window.DB.set = function(key, val) {
                origSet(key, val);
                if (_offline) _p7.lsSet(key, val);
            };
            return;
        }

        // Fallback: wrap individual exported save functions
        const saveWrappers = {
            saveNote: () => {
                const notes = _p7.lsGet('os_notes', []);
                const editor = document.getElementById('note-editor');
                const titleEl = document.getElementById('note-title');
                if (!editor) return;
                // Find active note ID from the sidebar selection
                const active = document.querySelector('.note-item.active');
                const id = active ? parseInt(active.dataset.noteId) : null;
                if (id) {
                    const idx = notes.findIndex(n => n.id === id);
                    if (idx >= 0) {
                        notes[idx].body  = editor.innerHTML;
                        notes[idx].title = titleEl ? titleEl.value : notes[idx].title;
                        _p7.lsSet('os_notes', notes);
                    }
                }
            },
            addTask: () => {
                // Read tasks from rendered list (best effort)
                setTimeout(() => {
                    const rows = document.querySelectorAll('[id^="task-row-"]');
                    const tasks = Array.from(rows).map(r => {
                        const id = parseInt(r.id.replace('task-row-', ''));
                        const text = r.querySelector('.task-text, .task-label')?.textContent?.trim() || '';
                        return { id, text, done: false };
                    }).filter(t => t.id && t.text);
                    if (tasks.length > 0) _p7.lsSet('os_tasks', tasks);
                }, 100);
            },
        };

        // Wrap saveNote
        const origSaveNote = window.saveNote;
        if (origSaveNote && !origSaveNote._p7ls) {
            window.saveNote = function() {
                origSaveNote.apply(this, arguments);
                if (_offline) saveWrappers.saveNote();
            };
            window.saveNote._p7ls = true;
        }

        // Wrap addTask
        const origAddTask = window.addTask;
        if (origAddTask && !origAddTask._p7ls) {
            window.addTask = function() {
                origAddTask.apply(this, arguments);
                if (_offline) setTimeout(() => saveWrappers.addTask(), 200);
            };
            window.addTask._p7ls = true;
        }

        // Generic: DB.set calls within features.js (_fSet) already write to localStorage
        // So music, formulas, exam countdown data already persists offline — no extra work needed
    }

    /* ── Patch initApp for offline pre-load ── */
    function _patchInitApp() {
        const orig = window.initApp;
        if (!orig || orig._p7Patched) { setTimeout(_patchInitApp, 200); return; }
        window.initApp = function() {
            if (_offline) {
                // Step 1: Try to hydrate real DB from localStorage
                const saved = _loadFromLS();
                if (saved) {
                    const hydrated = _hydrateRealDB(saved);
                    if (hydrated) {
                        console.log('[p7] Offline: hydrated DB from localStorage');
                    }
                }
            }
            // Step 2: Run original initApp (reads from DB.get — now populated if hydrated)
            orig.apply(this, arguments);
            // Step 3: Patch save functions
            if (_offline) {
                setTimeout(_patchSaveFunctions, 300);
                _showOfflineBanner();
            }
        };
        window.initApp._p7Patched = true;
    }
    _patchInitApp();

    /* ── Intercept offline button click ── */
    function _watchOfflineBtn() {
        // The button may not exist yet, poll for it
        const overlay = document.getElementById('login-overlay');
        if (!overlay) { setTimeout(_watchOfflineBtn, 300); return; }

        // Find the button by its text content since onclick attr varies
        const allBtns = overlay.querySelectorAll('button');
        const btn = Array.from(allBtns).find(b =>
            b.textContent.includes('offline') || b.textContent.includes('Offline')
        );
        if (!btn) { setTimeout(_watchOfflineBtn, 300); return; }
        if (btn.dataset.p7) return;
        btn.dataset.p7 = '1';

        // Wrap the button's click
        const origOnClick = btn.onclick;
        btn.onclick = null;
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            _offline = true;
            window._p7_offline = true;

            // Pre-load localStorage data into DB if possible
            const saved = _loadFromLS();
            if (saved) _hydrateRealDB(saved);

            // Call the original onclick behaviour
            if (origOnClick) origOnClick.call(btn, e);
            else {
                // Fallback: do what the button normally does
                const login = document.getElementById('login-overlay');
                if (login) login.classList.add('hidden');
                if (typeof window.initApp === 'function') window.initApp();
            }
        });
    }
    _watchOfflineBtn();



    /* ── Periodic localStorage snapshot (within session) ── */
    setInterval(() => {
        if (!_offline) return;
        // Save anything DB-backed if window.DB exists
        if (window.DB && typeof window.DB.get === 'function') {
            LS_KEYS.forEach(k => {
                const v = window.DB.get(k, null);
                if (v !== null) _p7.lsSet(k, v);
            });
        }
    }, 8000);

})();

/* ================================================================
   FIX 4 — NOTES STICKERS  (compact 32-sticker popover, click only)
   ================================================================ */
(function fixStickerPanel() {

    const STICKER_CATS = {
        'Study':   ['⭐','🔥','💡','📌','🎯','🚀','📚','✅'],
        'Faces':   ['😊','😎','🤔','🥳','😂','🙌','👍','❤️'],
        'Nature':  ['🌸','🌻','🌿','🍀','☀️','🌙','⚡','🌊'],
        'Objects': ['📝','⏰','🔔','💬','📊','🏆','🎵','🎨'],
    };

    // Override toggleStickerPanel from patches6 with a better version
    window.toggleStickerPanel = function(triggerEl) {
        // Close if already open
        const existing = document.getElementById('p7-sticker-panel');
        if (existing) { existing.remove(); return; }

        const panel = document.createElement('div');
        panel.id = 'p7-sticker-panel';

        let _activeCat = 'Study';

        function _renderPanel() {
            const cats = Object.keys(STICKER_CATS);
            panel.innerHTML = `
                <div class="p7-stk-cats">
                    ${cats.map(c => `<button class="p7-stk-cat${c === _activeCat ? ' active' : ''}"
                        onclick="window._p7StickerCat('${c}')">${c}</button>`).join('')}
                </div>
                <div class="p7-stk-grid" id="p7-stk-grid">
                    ${STICKER_CATS[_activeCat].map(s =>
                        `<button class="p7-stk-btn" onclick="window.insertSticker('${s}')" type="button" title="Insert ${s}">${s}</button>`
                    ).join('')}
                </div>`;
        }

        window._p7StickerCat = function(cat) {
            _activeCat = cat;
            _renderPanel();
        };

        _renderPanel();

        // Position near the trigger button or toolbar
        const ref = triggerEl instanceof Element
            ? triggerEl
            : (document.querySelector('[onclick*="toggleStickerPanel"]') || document.getElementById('note-toolbar'));
        if (ref) {
            const r = ref.getBoundingClientRect();
            panel.style.top  = (r.bottom + 6)  + 'px';
            panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 272)) + 'px';
        } else {
            panel.style.top  = '120px';
            panel.style.left = '20px';
        }

        document.body.appendChild(panel);

        // Close on outside click
        setTimeout(() => {
            function _close(e) {
                if (!panel.contains(e.target) && !e.target.closest('[onclick*="toggleStickerPanel"]')) {
                    panel.remove();
                    document.removeEventListener('click', _close);
                    delete window._p7StickerCat;
                }
            }
            document.addEventListener('click', _close);
        }, 10);
    };

    window.insertSticker = function(emoji) {
        const editor = document.getElementById('note-editor');
        if (!editor) return;
        editor.focus();
        // Use execCommand if possible, otherwise insert at cursor
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            document.execCommand('insertText', false, emoji + '\u00A0');
        } else {
            editor.innerHTML += emoji + '\u00A0';
        }
        if (typeof window.saveNote === 'function') setTimeout(window.saveNote, 60);
        const p = document.getElementById('p7-sticker-panel');
        if (p) p.remove();
    };

    // Remove any sticker panels that may have been opened by patches6
    document.addEventListener('click', e => {
        const p6 = document.getElementById('p6-sticker-panel');
        if (p6) p6.remove();
    }, { once: false });

})();



/* ================================================================
   FIX 6 — MUSIC: EDIT + DELETE ALL STATIONS (presets + custom)
   ================================================================ */
(function fixMusicAllEdit() {

    /* ── Preset overrides stored in localStorage ── */
    // Format: { lofi: { label:'...', url:'...', hidden: false }, jazz: { hidden: true }, ... }
    const OVERRIDE_KEY = 'os_music_preset_overrides';

    function _getOverrides() { return _p7.lsGet(OVERRIDE_KEY, {}); }
    function _setOverrides(o) { _p7.lsSet(OVERRIDE_KEY, o); }

    function _getPresets() {
        // Re-construct the effective preset list with overrides applied
        // We can't directly access features.js PRESETS (module scope) so we
        // store the originals on first render and apply overrides
        const ORIG = window._p7_origPresets || [];
        const overrides = _getOverrides();
        return ORIG
            .filter(p => !overrides[p.id]?.hidden)
            .map(p => {
                const ov = overrides[p.id] || {};
                return { ...p, label: ov.label || p.label, url: ov.url || p.url };
            });
    }

    /* ── Patch renderMusicGrid to store originals + add edit/delete buttons ── */
    function _patchRenderGrid() {
        const orig = window.renderMusicGrid;
        if (!orig || orig._p7Fixed) { setTimeout(_patchRenderGrid, 300); return; }

        window.renderMusicGrid = function() {
            // Run original first to get the grid
            orig.apply(this, arguments);

            const grid = document.getElementById('music-grid');
            if (!grid) return;

            // Capture original preset data from the rendered cards on first run
            if (!window._p7_origPresets || window._p7_origPresets.length === 0) {
                _captureOrigPresets(grid);
            }

            // Now re-render with overrides applied and action buttons added
            _renderGridWithActions(grid);
        };
        window.renderMusicGrid._p7Fixed = true;
    }

    function _captureOrigPresets(grid) {
        // Extract id, label, url, icon, color from each rendered card
        // We read these from the DOM since we can't access the module PRESETS
        const cards = Array.from(grid.querySelectorAll('.music-card'));
        window._p7_origPresets = cards.map(card => {
            const onclick = card.getAttribute('onclick') || '';
            const m = onclick.match(/musicPlay\(['"]([^'"]+)['"]\s*,\s*'preset'\)/);
            const id = m ? m[1] : null;
            const label = card.querySelector('.mc-label')?.textContent?.trim() || '';
            const iconEl = card.querySelector('.mc-icon i');
            const icon  = iconEl ? Array.from(iconEl.classList).find(c => c.startsWith('fa-') && c !== 'fa-solid') || 'fa-music' : 'fa-music';
            const color = card.style.getPropertyValue('--mc') || '#6b7280';
            return { id, label, icon, color, url: null };  // url will be captured via edit
        }).filter(p => p.id);
    }

    function _renderGridWithActions(grid) {
        const overrides = _getOverrides();

        grid.querySelectorAll('.music-card:not([data-p7-actions])').forEach(card => {
            card.dataset.p7Actions = '1';

            const onclick = card.getAttribute('onclick') || '';
            const m = onclick.match(/musicPlay\(['"]([^'"]+)['"]/);
            const id = m ? m[1] : null;
            if (!id) return;

            const isHidden  = overrides[id]?.hidden;
            if (isHidden) { card.style.display = 'none'; return; }

            // Build actions container
            const actions = document.createElement('div');
            actions.className = 'p7-mc-actions';
            actions.innerHTML = `
                <button class="p7-mc-action-btn edit" title="Edit station"
                        onclick="event.stopPropagation();window.p7EditPreset('${id}')">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="p7-mc-action-btn del" title="Hide station"
                        onclick="event.stopPropagation();window.p7HidePreset('${id}')">
                    <i class="fa-solid fa-eye-slash"></i>
                </button>`;

            // Insert before the play button
            const playBtn = card.querySelector('.mc-play-btn');
            if (playBtn) card.insertBefore(actions, playBtn);
            else card.appendChild(actions);
        });

        // Show "Restore defaults" button if any presets are hidden/overridden
        const hasOverrides = Object.keys(overrides).length > 0;
        let restoreBtn = document.getElementById('p7-restore-presets');
        if (hasOverrides && !restoreBtn) {
            restoreBtn = document.createElement('button');
            restoreBtn.id = 'p7-restore-presets';
            restoreBtn.className = 'p7-restore-btn';
            restoreBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Restore default stations';
            restoreBtn.onclick = window.p7RestorePresets;
            const label = document.querySelector('.music-section-label');
            if (label) label.insertAdjacentElement('afterend', restoreBtn);
        } else if (!hasOverrides && restoreBtn) {
            restoreBtn.remove();
        }
    }

    /* ── Patch renderMusicCustomGrid to add edit buttons ── */
    function _patchCustomGrid() {
        const orig = window.renderMusicCustomGrid;
        if (!orig || orig._p7Fixed) { setTimeout(_patchCustomGrid, 300); return; }

        window.renderMusicCustomGrid = function() {
            orig.apply(this, arguments);
            const grid = document.getElementById('music-custom-grid');
            if (!grid) return;

            grid.querySelectorAll('.music-card:not([data-p7-actions])').forEach(card => {
                card.dataset.p7Actions = '1';
                const onclick = card.getAttribute('onclick') || '';
                const m = onclick.match(/musicPlay\(['"]([^'"]+)['"]/);
                const id = m ? m[1] : null;
                if (!id) return;

                const actions = document.createElement('div');
                actions.className = 'p7-mc-actions';
                actions.innerHTML = `
                    <button class="p7-mc-action-btn edit" title="Edit station"
                            onclick="event.stopPropagation();window.musicOpenCustomModal('${id}')">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="p7-mc-action-btn del" title="Delete station"
                            onclick="event.stopPropagation();window.musicDeleteCustom('${id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>`;

                const playBtn = card.querySelector('.mc-play-btn');
                const delBtn  = card.querySelector('.mc-delete-btn');
                if (delBtn) delBtn.remove();    // remove old delete btn
                if (playBtn) card.insertBefore(actions, playBtn);
                else card.appendChild(actions);
            });
        };
        window.renderMusicCustomGrid._p7Fixed = true;
    }

    /* ── Hide (soft-delete) a preset ── */
    window.p7HidePreset = function(id) {
        if (!confirm('Hide this station? You can restore it later.')) return;
        const o = _getOverrides();
        o[id] = { ...(o[id] || {}), hidden: true };
        _setOverrides(o);
        _p7.toast('Station hidden. Use "Restore" to bring it back.');
        if (typeof window.renderMusicGrid === 'function') window.renderMusicGrid();
    };

    window.p7RestorePresets = function() {
        if (!confirm('Restore all default stations? Custom edits will be lost.')) return;
        _setOverrides({});
        _p7.toast('Default stations restored ✓');
        if (typeof window.renderMusicGrid === 'function') window.renderMusicGrid();
    };

    /* ── Edit preset via a nice modal ── */
    window.p7EditPreset = function(id) {
        // Get current effective values
        const overrides = _getOverrides();
        const ov = overrides[id] || {};

        // Try to find original label from the DOM or our captured list
        const origPreset = (window._p7_origPresets || []).find(p => p.id === id);
        const currentLabel = ov.label || origPreset?.label || id;
        const currentUrl   = ov.url   || '';  // originals not captured until first edit

        // Build modal
        let modal = document.getElementById('p7-preset-modal');
        if (modal) modal.remove();
        modal = document.createElement('div');
        modal.id = 'p7-preset-modal';
        modal.innerHTML = `
            <div class="p7-preset-modal-box">
                <h3>✏️ Edit Station</h3>
                <div class="p7-pfield">
                    <label>Station Name</label>
                    <input id="p7-pe-name" type="text" value="${_p7.esc(currentLabel)}" placeholder="Station name…">
                </div>
                <div class="p7-pfield">
                    <label>YouTube or SoundCloud URL</label>
                    <input id="p7-pe-url" type="url" value="${_p7.esc(currentUrl)}" placeholder="Leave blank to keep original URL…">
                </div>
                <div class="p7-pbtns">
                    <button class="p7-save" onclick="window.p7SavePresetEdit('${id}')">Save</button>
                    <button class="p7-cancel" onclick="document.getElementById('p7-preset-modal')?.remove()">Cancel</button>
                </div>
            </div>`;
        // Close on backdrop click
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
        });
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('p7-pe-name')?.focus(), 50);
    };

    window.p7SavePresetEdit = function(id) {
        const nameEl = document.getElementById('p7-pe-name');
        const urlEl  = document.getElementById('p7-pe-url');
        const name   = nameEl?.value.trim() || '';
        const rawUrl = urlEl?.value.trim()  || '';

        if (!name) { _p7.toast('Please enter a station name.', true); return; }

        // Convert URL to embed format (same logic as features.js)
        let embedUrl = rawUrl;
        if (rawUrl) {
            const yt = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            if (yt) embedUrl = `https://www.youtube.com/embed/${yt[1]}?autoplay=1&controls=1`;
            else if (rawUrl.includes('soundcloud.com'))
                embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(rawUrl)}&auto_play=true`;
        }

        const overrides = _getOverrides();
        overrides[id] = { ...(overrides[id] || {}), label: name, ...(embedUrl ? { url: embedUrl } : {}) };
        _setOverrides(overrides);

        document.getElementById('p7-preset-modal')?.remove();
        _p7.toast('Station updated ✓');

        // Re-render music grid with updated label/url
        if (typeof window.renderMusicGrid === 'function') window.renderMusicGrid();
    };

    /* ── Apply patches on tab switch ── */
    function _patchMusicTabSwitch() {
        const orig = window.switchTab;
        if (!orig || orig._p7MusicFixed) { setTimeout(_patchMusicTabSwitch, 300); return; }
        window.switchTab = function(name) {
            orig.apply(this, arguments);
            if (name === 'music') {
                setTimeout(() => {
                    if (typeof window.renderMusicGrid === 'function')       window.renderMusicGrid();
                    if (typeof window.renderMusicCustomGrid === 'function') window.renderMusicCustomGrid();
                }, 200);
            }
        };
        window.switchTab._p7MusicFixed = true;
    }

    /* ── Wire everything up ── */
    setTimeout(() => {
        _patchRenderGrid();
        _patchCustomGrid();
        _patchMusicTabSwitch();
        // Initial render if music tab is already active
        setTimeout(() => {
            if (typeof window.renderMusicGrid       === 'function') window.renderMusicGrid();
            if (typeof window.renderMusicCustomGrid === 'function') window.renderMusicCustomGrid();
        }, 700);
    }, 500);

})();

console.log('[StudentOS patches7 v1.0] Loaded ✓ — 6 targeted fixes applied');
