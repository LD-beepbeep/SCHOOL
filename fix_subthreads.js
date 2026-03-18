/* ================================================================
   fix_subthreads.js — Reddit / Threads-style nested replies
   ================================================================
   REPLACES the forum reply renderer entirely with a tree view:

   ┌─ Alice: "What is photosynthesis?"
   │    [↩ Reply]
   │
   ├─ Bob: "It's how plants make food from sunlight"
   │    [↩ Reply]
   │  └─ Alice: "Thanks! Does it need water?"
   │        [↩ Reply]
   │       └─ Bob: "Yes, water + CO2 + light = glucose"
   │             [↩ Reply]
   │
   └─ Carol: "Also check chapter 4"
        [↩ Reply]

   - Click "↩ Reply" under any reply → reply box pops up inline
   - Sub-replies are indented, have a coloured thread line, and show
     a "↩ to Bob" chip so you always know who they're replying to
   - All replies real-time via Firestore onSnapshot

   Add to index.html LAST, after all scripts:
   <script type="module" src="fix_subthreads.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    getFirestore,
    doc, getDoc, addDoc, deleteDoc, updateDoc, increment,
    collection, query, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Bootstrap Firebase ── */
var _db = null, _auth = null, _uid = null, _uname = 'Student';
(function boot() {
    var apps = getApps();
    if (!apps.length) { setTimeout(boot, 150); return; }
    _db   = getFirestore(apps[0]);
    _auth = getAuth(apps[0]);
    onAuthStateChanged(_auth, function(u) {
        _uid   = u ? u.uid  : null;
        _uname = u ? (u.displayName || u.email.split('@')[0] || 'Student') : 'Student';
    });
})();

/* ================================================================
   STYLES
   ================================================================ */
var _style = document.createElement('style');
_style.textContent = '\n' +
/* ── Thread container ── */
'.sr-thread { display:flex; flex-direction:column; gap:0; }\n' +

/* ── Single reply card ── */
'.sr-reply {\n' +
'    position: relative;\n' +
'    margin-bottom: 2px;\n' +
'}\n' +

/* ── Reply card inner box ── */
'.sr-card {\n' +
'    background: var(--glass-panel);\n' +
'    border: 1px solid rgba(255,255,255,.07);\n' +
'    border-radius: 14px;\n' +
'    padding: 12px 16px;\n' +
'    transition: border-color .15s;\n' +
'}\n' +
'.sr-card:hover { border-color: rgba(255,255,255,.14); }\n' +
'.sr-card.is-answer {\n' +
'    border-color: rgba(34,197,94,.3);\n' +
'    background: rgba(34,197,94,.04);\n' +
'}\n' +

/* ── Reply to chip (shows on sub-replies) ── */
'.sr-reply-to {\n' +
'    display: inline-flex;\n' +
'    align-items: center;\n' +
'    gap: 5px;\n' +
'    font-size: .62rem;\n' +
'    font-weight: 700;\n' +
'    color: var(--accent);\n' +
'    background: rgba(59,130,246,.1);\n' +
'    border-radius: 6px;\n' +
'    padding: 2px 8px;\n' +
'    margin-bottom: 8px;\n' +
'    width: fit-content;\n' +
'}\n' +
'.sr-reply-to i { font-size:.55rem; opacity:.8; }\n' +

/* ── Header row ── */
'.sr-header {\n' +
'    display: flex;\n' +
'    align-items: center;\n' +
'    gap: 8px;\n' +
'    margin-bottom: 7px;\n' +
'    flex-wrap: wrap;\n' +
'}\n' +
'.sr-author { font-size:.82rem; font-weight:700; }\n' +
'.sr-dot    { font-size:.5rem; color:var(--text-muted); }\n' +
'.sr-time   { font-size:.7rem; color:var(--text-muted); }\n' +
'.sr-answer-badge {\n' +
'    font-size:.6rem; font-weight:800;\n' +
'    padding:2px 8px; border-radius:99px;\n' +
'    background:rgba(34,197,94,.15); color:#22c55e;\n' +
'    display:flex; align-items:center; gap:4px;\n' +
'}\n' +
'.sr-del-btn {\n' +
'    margin-left:auto; background:none; border:none;\n' +
'    color:var(--text-muted); cursor:pointer;\n' +
'    font-size:.72rem; padding:2px 6px; border-radius:6px;\n' +
'    transition:color .12s, background .12s;\n' +
'}\n' +
'.sr-del-btn:hover { color:#ef4444; background:rgba(239,68,68,.1); }\n' +

/* ── Body text ── */
'.sr-body {\n' +
'    font-size:.88rem;\n' +
'    line-height:1.65;\n' +
'    color:var(--text-main);\n' +
'    margin-bottom:8px;\n' +
'    white-space:pre-wrap;\n' +
'    word-break:break-word;\n' +
'}\n' +

/* ── Action row (Reply button etc) ── */
'.sr-actions {\n' +
'    display:flex;\n' +
'    align-items:center;\n' +
'    gap:6px;\n' +
'    margin-top:2px;\n' +
'}\n' +
'.sr-reply-btn {\n' +
'    display:inline-flex;\n' +
'    align-items:center;\n' +
'    gap:4px;\n' +
'    background:none;\n' +
'    border:none;\n' +
'    color:var(--text-muted);\n' +
'    font-size:.72rem;\n' +
'    font-weight:700;\n' +
'    cursor:pointer;\n' +
'    padding:3px 8px;\n' +
'    border-radius:7px;\n' +
'    transition:color .12s, background .12s;\n' +
'}\n' +
'.sr-reply-btn:hover { color:var(--accent); background:rgba(59,130,246,.08); }\n' +
'.sr-reply-btn i { font-size:.65rem; }\n' +

/* ── Inline reply box ── */
'.sr-inline-box {\n' +
'    display:flex;\n' +
'    gap:8px;\n' +
'    align-items:flex-start;\n' +
'    margin-top:10px;\n' +
'    padding:10px;\n' +
'    background:rgba(255,255,255,.03);\n' +
'    border-radius:12px;\n' +
'    border:1px solid rgba(255,255,255,.08);\n' +
'}\n' +
'.sr-inline-box textarea {\n' +
'    flex:1;\n' +
'    background:transparent;\n' +
'    border:none;\n' +
'    outline:none;\n' +
'    color:var(--text-main);\n' +
'    font-size:.85rem;\n' +
'    font-family:inherit;\n' +
'    resize:none;\n' +
'    min-height:52px;\n' +
'    line-height:1.5;\n' +
'}\n' +
'.sr-inline-submit {\n' +
'    flex-shrink:0;\n' +
'    background:var(--accent);\n' +
'    border:none;\n' +
'    border-radius:10px;\n' +
'    color:#fff;\n' +
'    font-size:.75rem;\n' +
'    font-weight:700;\n' +
'    padding:7px 14px;\n' +
'    cursor:pointer;\n' +
'    transition:opacity .15s;\n' +
'    white-space:nowrap;\n' +
'}\n' +
'.sr-inline-submit:hover { opacity:.85; }\n' +
'.sr-inline-submit:disabled { opacity:.5; cursor:not-allowed; }\n' +

/* ── Children container — indented with thread line ── */
'.sr-children {\n' +
'    position:relative;\n' +
'    margin-left:24px;\n' +
'    margin-top:3px;\n' +
'    padding-left:16px;\n' +
'    display:flex;\n' +
'    flex-direction:column;\n' +
'    gap:0;\n' +
'}\n' +
/* The vertical thread line */
'.sr-children::before {\n' +
'    content:"";\n' +
'    position:absolute;\n' +
'    left:0; top:10px; bottom:10px;\n' +
'    width:2px;\n' +
'    background:rgba(59,130,246,.25);\n' +
'    border-radius:2px;\n' +
'}\n' +
'.sr-children:hover::before {\n' +
'    background:rgba(59,130,246,.5);\n' +
'}\n' +

/* Deep nesting — gets slightly more muted */
'.sr-children .sr-children::before {\n' +
'    background:rgba(139,92,246,.2);\n' +
'}\n' +
'.sr-children .sr-children:hover::before {\n' +
'    background:rgba(139,92,246,.4);\n' +
'}\n' +

/* Mobile */
'@media(max-width:600px){\n' +
'    .sr-children { margin-left:12px; padding-left:10px; }\n' +
'}\n';
document.head.appendChild(_style);

/* ================================================================
   STATE
   ================================================================ */
var _postId   = null;
var _unsub    = null;          /* Firestore onSnapshot unsub */
var _allReplies = [];          /* latest snapshot */
var _openBoxes  = {};          /* replyId -> true if inline box is open */

/* ================================================================
   HELPERS
   ================================================================ */
function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}
function ago(ts) {
    if (!ts) return '';
    var d   = ts.toDate ? ts.toDate() : new Date(ts);
    var sec = Math.floor((Date.now() - d) / 1000);
    if (sec < 60)    return sec + 's ago';
    if (sec < 3600)  return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
function avatar(name, color) {
    return '<div class="forum-avatar" style="background:' + (color || '#6b7280') + ';flex-shrink:0;">' +
           esc((name || '?').slice(0,1).toUpperCase()) + '</div>';
}

/* ================================================================
   TREE BUILD
   ================================================================ */
function buildTree(replies) {
    /* Map id -> node */
    var nodes = {};
    replies.forEach(function(r) {
        nodes[r.id] = { r: r, children: [] };
    });
    /* Root nodes (no parent) and children */
    var roots = [];
    replies.forEach(function(r) {
        if (r.parentReplyId && nodes[r.parentReplyId]) {
            nodes[r.parentReplyId].children.push(nodes[r.id]);
        } else {
            roots.push(nodes[r.id]);
        }
    });
    return roots;
}

/* ================================================================
   RENDER TREE → HTML STRING
   ================================================================ */
function renderNode(node, depth, parentName) {
    var r    = node.r;
    var pid  = _postId;
    var isOwn = r.uid && r.uid === _uid;
    var aColor = r.isAnswer ? '#22c55e' : '#6b7280';

    /* "Replying to NAME" chip — only when it has a parent */
    var replyToChip = (r.parentReplyId && parentName)
        ? '<div class="sr-reply-to">' +
          '<i class="fa-solid fa-reply fa-flip-horizontal"></i>' +
          ' replying to <strong style="margin-left:2px;">' + esc(parentName) + '</strong>' +
          '</div>'
        : '';

    var deleteBtn = isOwn
        ? '<button class="sr-del-btn" title="Delete"' +
          ' onclick="window._srDeleteReply(\'' + esc(pid) + '\',\'' + esc(r.id) + '\')">' +
          '<i class="fa-solid fa-trash"></i></button>'
        : '';

    var answerBadge = r.isAnswer
        ? '<span class="sr-answer-badge"><i class="fa-solid fa-check"></i>Best answer</span>'
        : '';

    /* Inline reply box (rendered collapsed; toggled by JS) */
    var inlineBox =
        '<div class="sr-inline-box" id="srbox-' + r.id + '" style="display:none;">' +
        '<textarea id="srta-' + r.id + '" placeholder="Replying to ' +
            esc(r.displayName || 'Anonymous') + '… (Ctrl+Enter to send)"></textarea>' +
        '<button class="sr-inline-submit" id="srbtn-' + r.id + '"' +
        ' onclick="window._srSubmit(\'' + esc(pid) + '\',\'' + esc(r.id) + '\')">' +
        '<i class="fa-solid fa-paper-plane"></i> Reply</button>' +
        '</div>';

    /* Render children */
    var childrenHTML = '';
    if (node.children.length > 0) {
        var cName = r.displayName || 'Anonymous';
        childrenHTML =
            '<div class="sr-children">' +
            node.children.map(function(child) { return renderNode(child, depth + 1, cName); }).join('') +
            '</div>';
    }

    return '<div class="sr-reply" id="sr-' + r.id + '">' +
           '<div class="sr-card' + (r.isAnswer ? ' is-answer' : '') + '">' +
           replyToChip +
           '<div class="sr-header">' +
           avatar(r.displayName, aColor) +
           '<span class="sr-author">' + esc(r.displayName || 'Anonymous') + '</span>' +
           answerBadge +
           '<span class="sr-dot">•</span>' +
           '<span class="sr-time">' + ago(r.createdAt) + '</span>' +
           deleteBtn +
           '</div>' +
           '<div class="sr-body">' + esc(r.body).replace(/\n/g, '<br>') + '</div>' +
           '<div class="sr-actions">' +
           '<button class="sr-reply-btn" onclick="window._srToggleBox(\'' + esc(r.id) + '\')">' +
           '<i class="fa-solid fa-reply fa-flip-horizontal"></i> Reply</button>' +
           '</div>' +
           inlineBox +
           '</div>' +
           childrenHTML +
           '</div>';
}

/* ================================================================
   RENDER FULL REPLY SECTION
   ================================================================ */
function renderAll() {
    var el    = document.getElementById('ft-replies-list');
    var label = document.getElementById('ft-replies-label');
    if (!el) return;

    var count = _allReplies.length;
    if (label) label.textContent = count + (count === 1 ? ' Reply' : ' Replies');

    if (count === 0) {
        el.innerHTML = '<p class="ft-no-replies">No answers yet — be the first!</p>';
        return;
    }

    var roots = buildTree(_allReplies);
    el.innerHTML = '<div class="sr-thread">' +
        roots.map(function(n) { return renderNode(n, 0, ''); }).join('') +
        '</div>';

    /* Restore any open inline boxes */
    Object.keys(_openBoxes).forEach(function(rid) {
        var box = document.getElementById('srbox-' + rid);
        if (box) box.style.display = 'flex';
    });
}

/* ================================================================
   ACTIONS (exposed on window so onclick= attrs work)
   ================================================================ */

/* Toggle inline reply box */
window._srToggleBox = function(replyId) {
    var box = document.getElementById('srbox-' + replyId);
    if (!box) return;
    var isOpen = box.style.display !== 'none';
    /* Close all other boxes */
    Object.keys(_openBoxes).forEach(function(rid) {
        var b = document.getElementById('srbox-' + rid);
        if (b) b.style.display = 'none';
    });
    _openBoxes = {};
    if (!isOpen) {
        box.style.display = 'flex';
        _openBoxes[replyId] = true;
        var ta = document.getElementById('srta-' + replyId);
        if (ta) { ta.focus(); }
        /* Ctrl+Enter shortcut inside inline box */
        if (ta && !ta.dataset.srke) {
            ta.dataset.srke = '1';
            ta.addEventListener('keydown', function(e) {
                if (e.ctrlKey && e.key === 'Enter') {
                    window._srSubmit(_postId, replyId);
                }
            });
        }
    }
};

/* Submit an inline sub-reply */
window._srSubmit = async function(postId, parentReplyId) {
    if (!_uid) { alert('Please log in to reply.'); return; }
    var ta  = document.getElementById('srta-' + parentReplyId);
    var btn = document.getElementById('srbtn-' + parentReplyId);
    if (!ta) return;
    var body = ta.value.trim();
    if (!body) { ta.focus(); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    try {
        await addDoc(
            collection(_db, 'forum_posts', postId, 'replies'),
            {
                uid:           _uid,
                displayName:   _uname,
                body:          body,
                parentReplyId: parentReplyId,
                isAnswer:      false,
                createdAt:     serverTimestamp()
            }
        );
        /* Silent counter increment */
        try {
            await updateDoc(doc(_db, 'forum_posts', postId), { replyCount: increment(1) });
        } catch(e) {}

        ta.value = '';
        delete _openBoxes[parentReplyId];
        /* onSnapshot will re-render automatically */
    } catch(e) {
        console.error('[fix_subthreads] submit error:', e);
        alert('Reply failed — check your internet connection.');
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Reply'; }
};

/* Delete a reply */
window._srDeleteReply = async function(postId, replyId) {
    if (!confirm('Delete this reply?')) return;
    try {
        await deleteDoc(doc(_db, 'forum_posts', postId, 'replies', replyId));
        try {
            await updateDoc(doc(_db, 'forum_posts', postId), { replyCount: increment(-1) });
        } catch(e) {}
    } catch(e) {
        alert('Could not delete reply.');
        console.error('[fix_subthreads] delete error:', e);
    }
};

/* ================================================================
   OVERRIDE forumOpenPost — start our own Firestore listener
   ================================================================ */
function patchForumOpenPost() {
    var orig = window.forumOpenPost;
    if (!orig || orig._sr) { setTimeout(patchForumOpenPost, 200); return; }

    window.forumOpenPost = async function(postId) {
        /* Let forum.js run to render the post header + HTML shell */
        _postId    = postId;
        _openBoxes = {};
        await orig.apply(this, arguments);

        /* forum.js starts _listenReplies which renders flat.
           We start OUR listener a tick later and take over #ft-replies-list */
        setTimeout(function() { _startListener(postId); }, 100);
    };
    window.forumOpenPost._sr = true;
}
setTimeout(patchForumOpenPost, 300);

/* ================================================================
   OVERRIDE forumCloseThread — clean up our listener
   ================================================================ */
function patchForumClose() {
    var orig = window.forumCloseThread;
    if (!orig || orig._sr) { setTimeout(patchForumClose, 200); return; }
    window.forumCloseThread = function() {
        if (_unsub) { _unsub(); _unsub = null; }
        _postId     = null;
        _allReplies = [];
        _openBoxes  = {};
        orig.apply(this, arguments);
    };
    window.forumCloseThread._sr = true;
}
setTimeout(patchForumClose, 300);

/* ================================================================
   ALSO OVERRIDE the main reply box submit button
   so top-level replies use forumSubmitReply from forum.js (no parent)
   and we don't need to touch that logic.
   ================================================================ */

/* ================================================================
   FIRESTORE LISTENER
   ================================================================ */
function _startListener(postId) {
    /* Kill previous listener (from forum.js or from us) */
    if (_unsub) { _unsub(); _unsub = null; }

    var q = query(
        collection(_db, 'forum_posts', postId, 'replies'),
        orderBy('createdAt', 'asc')
    );

    _unsub = onSnapshot(q, function(snap) {
        _allReplies = snap.docs.map(function(d) {
            return Object.assign({ id: d.id }, d.data());
        });
        renderAll();
    }, function(err) {
        console.warn('[fix_subthreads] snapshot error:', err);
    });
}

console.log('[fix_subthreads] Loaded — Reddit-style subthreads active');
