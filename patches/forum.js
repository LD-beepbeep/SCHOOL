/* ================================================================
   StudentOS — Study Forum  (forum.js)  v2 — FIXED
   Fixes: reply error, upvotes, delete, FAB visibility, sort, mobile
   ================================================================ */

import { initializeApp, getApps }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore,
    collection, doc,
    addDoc, getDoc, getDocs, deleteDoc, updateDoc,
    onSnapshot,
    query, orderBy, where, limit,
    serverTimestamp, arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Reuse the existing Firebase app ── */
const _app  = getApps()[0];
const _auth = getAuth(_app);
const _db   = getFirestore(_app);

/* ── State ── */
let _uid         = null;
let _displayName = '';
let _unsubPosts  = null;
let _activePost  = null;
let _unsubReplies = null;
let _activeSubject = 'all';
let _activeSort    = 'new';

const SUBJECTS = [
    { id:'all',     label:'Alles',        icon:'fa-border-all',        color:'#6b7280' },
    { id:'math',    label:'Wiskunde',     icon:'fa-square-root-alt',   color:'#3b82f6' },
    { id:'science', label:'Wetenschappen',icon:'fa-flask',             color:'#22c55e' },
    { id:'english', label:'Engels',       icon:'fa-book-open',         color:'#f59e0b' },
    { id:'history', label:'Geschiedenis', icon:'fa-landmark',          color:'#8b5cf6' },
    { id:'it',      label:'IT & CS',      icon:'fa-code',              color:'#06b6d4' },
    { id:'other',   label:'Overig',       icon:'fa-circle-question',   color:'#ec4899' },
];

/* ================================================================
   BOOT
   ================================================================ */
onAuthStateChanged(_auth, user => {
    if (!user) return;
    _uid = user.uid;
    _displayName = user.displayName || user.email?.split('@')[0] || 'Student';
});

/* ================================================================
   HELPERS
   ================================================================ */
function _subjectMeta(id) {
    return SUBJECTS.find(s => s.id === id) || SUBJECTS[SUBJECTS.length - 1];
}
function _timeAgo(ts) {
    if (!ts) return '';
    const d   = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - d) / 1000);
    if (sec < 60)    return `${sec}s ago `;
    if (sec < 3600)  return `${Math.floor(sec/60)}min ago`;
    if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
    return d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' });
}
function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function _formatPostBody(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var out = [];
    lines.forEach(function(line) {
        if (line.startsWith('[Image: ') && lines[lines.indexOf(line)+1]?.startsWith('data:image')) {
            // skip — handled by next line
        } else if (line.startsWith('data:image')) {
            out.push('<img src="' + line + '" style="max-width:100%;max-height:320px;border-radius:8px;display:block;margin:8px 0;">');
        } else if (line.startsWith('[PDF: ')) {
            var name = line.replace(/^\[PDF: /, '').replace(/\].*$/, '');
            out.push('<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;font-size:.75rem;"><i class="fa-regular fa-file-pdf"></i> ' + _esc(name) + '</span>');
        } else {
            out.push(_esc(line));
        }
    });
    return out.join('<br>');
}

/* Build a post-card excerpt: strips image/PDF markers from the text
   and shows a small thumbnail when the post contains an image. */
function _excerptHtml(body) {
    if (!body) return '<p class="fpc-excerpt"></p>';
    var lines    = body.split('\n');
    var firstImg = null;
    var textParts = [];
    var i = 0;
    while (i < lines.length) {
        var line = lines[i];
        if (line.startsWith('[Image: ') && i + 1 < lines.length && lines[i + 1].startsWith('data:image')) {
            if (!firstImg) firstImg = lines[i + 1];
            i += 2;
        } else if (line.startsWith('data:image')) {
            if (!firstImg) firstImg = line;
            i++;
        } else if (line.startsWith('[PDF: ')) {
            i++;
        } else {
            var t = line.trim();
            if (t) textParts.push(t);
            i++;
        }
    }
    var text = textParts.join(' ');
    var html = '';
    if (firstImg) {
        html += '<img src="' + firstImg + '" class="fpc-thumb" alt="">';
    }
    if (text) {
        var short = text.length > 110 ? text.slice(0, 110) + '\u2026' : text;
        html += '<span>' + _esc(short) + '</span>';
    }
    if (!html) return '<p class="fpc-excerpt"></p>';
    return '<p class="fpc-excerpt' + (firstImg ? ' fpc-excerpt--media' : '') + '">' + html + '</p>';
}

function _avatar(name, color) {
    const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    return `<div class="forum-avatar" style="background:${color||'#3b82f6'};">${_esc(initials)}</div>`;
}
function _toast(msg, isErr = false) {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isErr ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background=''; }, 2500);
}

/* ── Silent update helper — won't surface errors to user ── */
async function _silentUpdate(ref, data) {
    try { await updateDoc(ref, data); } catch(e) { /* security-rule safe */ }
}

/* ================================================================
   RENDER — subject filter bar
   ================================================================ */
function _renderSubjectBar() {
    const bar = document.getElementById('forum-subject-bar');
    if (!bar) return;
    bar.innerHTML = SUBJECTS.map(s => `
        <button class="forum-subject-pill ${_activeSubject===s.id?'active':''}"
                style="--sc:${s.color}"
                onclick="forumSetSubject('${s.id}')">
            <i class="fa-solid ${s.icon}"></i> ${_esc(s.label)}
        </button>`).join('');
}

/* ================================================================
   RENDER — post list (live)
   ================================================================ */
function _listenPosts() {
    if (_unsubPosts) { _unsubPosts(); _unsubPosts = null; }

    const col = collection(_db, 'forum_posts');
    let q;
    if (_activeSubject === 'all') {
        q = query(col, orderBy('createdAt', 'desc'), limit(80));
    } else {
        q = query(col,
            where('subject', '==', _activeSubject),
            orderBy('createdAt', 'desc'),
            limit(80));
    }

    _unsubPosts = onSnapshot(q, snap => {
        let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (_activeSort === 'top') {
            posts = [...posts].sort((a,b) => (b.upvoteCount||0) - (a.upvoteCount||0));
        } else if (_activeSort === 'unsolved') {
            posts = posts.filter(p => !p.solved);
        }
        _renderPostList(posts);
        if (typeof window.renderForumWidget === 'function') window.renderForumWidget(posts);
    }, err => console.warn('Forum snapshot error:', err));
}

function _renderPostList(posts) {
    const list = document.getElementById('forum-post-list');
    if (!list) return;
    if (!posts || posts.length === 0) {
        list.innerHTML = `
            <div class="forum-empty">
                <i class="fa-solid fa-comments"></i>
                <p>No messageges yet - be the first one! </p>
            </div>`;
        return;
    }
    list.innerHTML = posts.map(p => {
        const sub   = _subjectMeta(p.subject);
        const voted = Array.isArray(p.upvotes) && p.upvotes.includes(_uid);
        const isOwn = p.uid === _uid;
        return `
        <div class="forum-post-card ${p.solved?'solved':''}"
             onclick="forumOpenPost('${p.id}')">
            <div class="fpc-left">
                <button class="fpc-vote ${voted?'voted':''}"
                        onclick="event.stopPropagation();forumVote('${p.id}',${voted})"
                        title="${voted?'Downvote':'Upvote'}">
                    <i class="fa-solid fa-arrow-up"></i>
                    <span>${p.upvoteCount||0}</span>
                </button>
                <div class="fpc-replies-count" title="${p.replyCount||0} replies">
                    <i class="fa-regular fa-comment"></i>
                    <span>${p.replyCount||0}</span>
                </div>
            </div>
            <div class="fpc-body">
                <div class="fpc-meta">
                    <span class="fpc-subject-tag" style="background:${sub.color}22;color:${sub.color}">
                        <i class="fa-solid ${sub.icon}"></i> ${_esc(sub.label)}
                    </span>
                    ${p.solved ? '<span class="fpc-solved-badge"><i class="fa-solid fa-circle-check"></i> Solved</span>' : ''}
                </div>
                <h3 class="fpc-title">${_esc(p.title)}</h3>
                ${_excerptHtml(p.body)}
                <div class="fpc-footer">
                    ${_avatar(p.displayName, sub.color)}
                    <span class="fpc-author">${_esc(p.displayName||'Anoniem')}</span>
                    <span class="fpc-dot">·</span>
                    <span class="fpc-time">${_timeAgo(p.createdAt)}</span>
                    ${isOwn ? `<button class="fpc-delete" title="Delete Post"
                        onclick="event.stopPropagation();forumDeletePost('${p.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ================================================================
   RENDER — single post / thread view
   ================================================================ */
window.forumOpenPost = async function(postId) {
    _activePost = postId;
    let p;
    try {
        const snap = await getDoc(doc(_db, 'forum_posts', postId));
        if (!snap.exists()) { _toast('Bericht niet gevonden.', true); return; }
        p = { id: snap.id, ...snap.data() };
    } catch(e) {
        _toast('Error loading this message.', true);
        return;
    }
    const sub = _subjectMeta(p.subject);

    document.getElementById('forum-list-view').classList.add('hidden');
    document.getElementById('forum-fab').classList.add('hidden');
    const tv = document.getElementById('forum-thread-view');
    tv.classList.remove('hidden');
    tv.scrollTop = 0;

    const voted = Array.isArray(p.upvotes) && p.upvotes.includes(_uid);
    const isOwn = p.uid === _uid;
    tv.querySelector('#forum-thread-content').innerHTML = `
        <div class="ft-header">
            <button class="ft-back" onclick="forumCloseThread()">
                <i class="fa-solid fa-arrow-left"></i> Back
            </button>
            <span class="fpc-subject-tag" style="background:${sub.color}22;color:${sub.color}">
                <i class="fa-solid ${sub.icon}"></i> ${_esc(sub.label)}
            </span>
            ${p.solved ? '<span class="fpc-solved-badge"><i class="fa-solid fa-circle-check"></i> Solved</span>' : ''}
        </div>
        <h2 class="ft-title">${_esc(p.title)}</h2>
        <div class="ft-post-body">${_formatPostBody(p.body)}</div>
        <div class="ft-post-meta">
            ${_avatar(p.displayName, sub.color)}
            <span class="fpc-author">${_esc(p.displayName||'Anonymous')}</span>
            <span class="fpc-dot">·</span>
            <span class="fpc-time">${_timeAgo(p.createdAt)}</span>
            <div class="ft-actions">
                <button class="ft-vote-btn ${voted?'voted':''}" id="ft-vote-btn-${postId}"
                        onclick="forumVote('${p.id}',${voted})" title="${voted?'Downvote':'Upvote'}">
                    <i class="fa-solid fa-arrow-up"></i> <span id="ft-vote-count">${p.upvoteCount||0}</span>
                </button>
                ${isOwn ? `
                    <button class="ft-action-btn ft-delete-btn"
                            onclick="forumDeletePost('${p.id}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                    ${!p.solved ? `<button class="ft-action-btn ft-solve-btn"
                            onclick="forumMarkSolved('${p.id}')">
                        <i class="fa-solid fa-circle-check"></i> Mark as solved
                    </button>` : ''}
                ` : ''}
            </div>
        </div>
        <div class="ft-replies-label" id="ft-replies-label">Loading replies…</div>
        <div id="ft-replies-list"></div>`;

    _listenReplies(postId);
};

window.forumCloseThread = function() {
    if (_unsubReplies) { _unsubReplies(); _unsubReplies = null; }
    _activePost = null;
    document.getElementById('forum-thread-view').classList.add('hidden');
    document.getElementById('forum-list-view').classList.remove('hidden');
    document.getElementById('forum-fab').classList.remove('hidden');
};

function _listenReplies(postId) {
    if (_unsubReplies) { _unsubReplies(); _unsubReplies = null; }
    const q = query(
        collection(_db, 'forum_posts', postId, 'replies'),
        orderBy('createdAt', 'asc')
    );
    _unsubReplies = onSnapshot(q, snap => {
        const replies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _renderReplies(replies, postId);
        // Update reply count label silently on parent post
        _silentUpdate(doc(_db, 'forum_posts', postId), { replyCount: replies.length });
    }, err => console.warn('Replies snapshot error:', err));
}

function _renderReplies(replies, postId) {
    const el    = document.getElementById('ft-replies-list');
    const label = document.getElementById('ft-replies-label');
    if (!el) return;
    if (label) label.textContent = `${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`;
    if (replies.length === 0) {
        el.innerHTML = `<p class="ft-no-replies">No answers yet - add one!</p>`;
        return;
    }
    el.innerHTML = replies.map(r => `
        <div class="ft-reply ${r.isAnswer?'is-answer':''}">
            <div class="ft-reply-header">
                ${_avatar(r.displayName, r.isAnswer?'#22c55e':'#6b7280')}
                <span class="fpc-author">${_esc(r.displayName||'Anonymous')}</span>
                ${r.isAnswer ? '<span class="ft-answer-badge"><i class="fa-solid fa-check"></i> Best answer</span>' : ''}
                <span class="fpc-dot">·</span>
                <span class="fpc-time">${_timeAgo(r.createdAt)}</span>
                ${r.uid === _uid ? `
                    <button class="ft-reply-delete"
                            onclick="forumDeleteReply('${postId}','${r.id}')"
                            title="Verwijderen">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
            </div>
            <div class="ft-reply-body">${_esc(r.body).replace(/\n/g,'<br>')}</div>
        </div>`).join('');
}

/* ================================================================
   ACTIONS
   ================================================================ */

/* ── Vote (robust: won't show error if counter update fails) ── */
window.forumVote = async function(postId, alreadyVoted) {
    if (!_uid) { _toast('Log in to vote', true); return; }
    const ref = doc(_db, 'forum_posts', postId);
    try {
        if (alreadyVoted) {
            await updateDoc(ref, {
                upvotes:     arrayRemove(_uid),
                upvoteCount: increment(-1)
            });
        } else {
            await updateDoc(ref, {
                upvotes:     arrayUnion(_uid),
                upvoteCount: increment(1)
            });
        }
        // Update vote button in thread view if open
        const btn = document.getElementById(`ft-vote-btn-${postId}`);
        if (btn) btn.classList.toggle('voted', !alreadyVoted);
        const cnt = document.getElementById('ft-vote-count');
        if (cnt) {
            const cur = parseInt(cnt.textContent) || 0;
            cnt.textContent = alreadyVoted ? Math.max(0, cur-1) : cur+1;
        }
    } catch(e) {
        console.warn('Vote error (check Firestore rules):', e);
        _toast('Vote could not be saved.', true);
    }
};

/* ── Submit post ── */
window.forumSubmitPost = async function() {
    const titleEl   = document.getElementById('forum-new-title');
    const bodyEl    = document.getElementById('forum-new-body');
    const subjectEl = document.getElementById('forum-new-subject');
    const errEl     = document.getElementById('forum-new-error');
    const btn       = document.getElementById('forum-submit-btn');

    const title   = titleEl.value.trim();
    const body    = bodyEl.value.trim();
    const subject = subjectEl.value;

    if (!title) { errEl.textContent = 'Add a title'; titleEl.focus(); return; }
    if (!body)  { errEl.textContent = 'Describe your question'; bodyEl.focus(); return; }
    errEl.textContent = '';

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting…';

    try {
        await addDoc(collection(_db, 'forum_posts'), {
            uid:         _uid,
            displayName: _displayName,
            title,
            body,
            subject:     subject || 'other',
            upvotes:     [],
            upvoteCount: 0,
            replyCount:  0,
            solved:      false,
            createdAt:   serverTimestamp()
        });
        titleEl.value = '';
        bodyEl.value  = '';
        _closeNewPost();
        _toast('Question posted ✓');
    } catch(e) {
        errEl.textContent = 'Post submit error - try again...';
        console.error('Post submit error:', e);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Place a question';
};

/* ── Submit reply (FIXED: counter update is now non-blocking) ── */
window.forumSubmitReply = async function() {
    if (!_activePost) return;
    const bodyEl = document.getElementById('forum-reply-input');
    const errEl  = document.getElementById('forum-reply-error');
    const btn    = document.getElementById('forum-reply-btn');
    const body   = bodyEl.value.trim();

    if (!body) { errEl.textContent = 'First type a reply.'; bodyEl.focus(); return; }
    errEl.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        // ① Write the reply — this is the critical operation
        await addDoc(
            collection(_db, 'forum_posts', _activePost, 'replies'),
            {
                uid:         _uid,
                displayName: _displayName,
                body,
                isAnswer:    false,
                createdAt:   serverTimestamp()
            }
        );
        // ② Update reply count silently — won't crash if rules block it
        _silentUpdate(doc(_db, 'forum_posts', _activePost), {
            replyCount: increment(1)
        });
        bodyEl.value = '';
        _toast('Answer submitted! ✓');
    } catch(e) {
        errEl.textContent = 'Reply could not be submitted - check your internet connection';
        console.error('Reply submit error:', e);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-reply"></i> Reply';
};

/* ── Delete post (FIXED: handles subcollection cleanup gracefully) ── */
window.forumDeletePost = async function(postId) {
    if (!confirm('Do you want to delete this post?')) return;
    try {
        // Delete replies (best-effort)
        try {
            const repliesSnap = await getDocs(
                collection(_db, 'forum_posts', postId, 'replies')
            );
            await Promise.all(repliesSnap.docs.map(d => deleteDoc(d.ref)));
        } catch(e) { console.warn('Could not delete all replies:', e); }

        await deleteDoc(doc(_db, 'forum_posts', postId));
        if (_activePost === postId) forumCloseThread();
        _toast('Bericht verwijderd.');
    } catch(e) {
        _toast('Post deletion failed', true);
        console.error('Delete post error:', e);
    }
};

/* ── Delete reply ── */
window.forumDeleteReply = async function(postId, replyId) {
    if (!confirm('Delete this answer?')) return;
    try {
        await deleteDoc(doc(_db, 'forum_posts', postId, 'replies', replyId));
        // Best-effort decrement
        _silentUpdate(doc(_db, 'forum_posts', postId), { replyCount: increment(-1) });
        _toast('Answer deleted!');
    } catch(e) {
        _toast('Deletion error.', true);
        console.error('Delete reply error:', e);
    }
};

/* ── Mark solved ── */
window.forumMarkSolved = async function(postId) {
    try {
        await updateDoc(doc(_db, 'forum_posts', postId), { solved: true });
        forumOpenPost(postId);
        _toast('Marked as solved ✓');
    } catch(e) {
        _toast('Could not mark as solved.', true);
        console.error('Mark solved error:', e);
    }
};

/* ================================================================
   FILTER / SORT
   ================================================================ */
window.forumSetSubject = function(sub) {
    _activeSubject = sub;
    _renderSubjectBar();
    _listenPosts();
};

window.forumSetSort = function(sort) {
    _activeSort = sort;
    document.querySelectorAll('.forum-sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === sort);
    });
    _listenPosts();
};

/* ================================================================
   NEW POST PANEL
   ================================================================ */
function _closeNewPost() {
    const panel = document.getElementById('forum-new-panel');
    const fab   = document.getElementById('forum-fab');
    if (panel) panel.classList.add('hidden');
    if (fab)   fab.classList.remove('hidden');
}

window.forumOpenNew = function() {
    const panel = document.getElementById('forum-new-panel');
    const fab   = document.getElementById('forum-fab');
    if (panel) { panel.classList.remove('hidden'); }
    if (fab)   { fab.classList.add('hidden'); }
    setTimeout(() => {
        const t = document.getElementById('forum-new-title');
        if (t) t.focus();
    }, 50);
};
window.forumCancelNew = _closeNewPost;

/* ── Ctrl+Enter to post ── */
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.id === 'forum-new-body')    window.forumSubmitPost();
        if (active && active.id === 'forum-reply-input') window.forumSubmitReply();
    }
});

/* ================================================================
   TAB INIT
   ================================================================ */
window.forumInit = function() {
    _renderSubjectBar();
    _listenPosts();
    const fab = document.getElementById('forum-fab');
    if (fab) fab.classList.remove('hidden');
};

/* ── Patch switchTab ── */
(function _waitForumPatch(){
    if(typeof window.switchTab === 'function'){
        const _orig = window.switchTab;
        window.switchTab = function(name){
            _orig && _orig(name);
            const fab = document.getElementById('forum-fab');
            if(name === 'forum') {
                setTimeout(window.forumInit, 50);
                if(fab) fab.classList.remove('hidden');
            } else {
                if(fab) fab.classList.add('hidden');
                if(_unsubPosts)   { _unsubPosts();   _unsubPosts   = null; }
                if(_unsubReplies) { _unsubReplies(); _unsubReplies = null; }
            }
        };
    } else {
        setTimeout(_waitForumPatch, 100);
    }
})();

/* ── Quick Post from dashboard widget ── */
window.forumQuickPost = async function(body, subject) {
    if (!_uid) throw new Error('Not logged in');
    if (!body?.trim()) throw new Error('Empty body');
    await addDoc(collection(_db, 'forum_posts'), {
        uid:         _uid,
        displayName: _displayName || 'Student',
        title:       body.trim().slice(0, 80) + (body.trim().length > 80 ? '…' : ''),
        body:        body.trim(),
        subject:     subject || 'other',
        upvotes:     [],
        upvoteCount: 0,
        replyCount:  0,
        solved:      false,
        createdAt:   serverTimestamp(),
    });
};

/* ── Pending post from widget ── */
(function _checkPending() {
    if (typeof window._pendingForumPost !== 'undefined') {
        const p = window._pendingForumPost;
        delete window._pendingForumPost;
        setTimeout(() => {
            const titleEl = document.getElementById('forum-new-title');
            const bodyEl  = document.getElementById('forum-new-body');
            const subjEl  = document.getElementById('forum-new-subject');
            if (titleEl) titleEl.value = p.body.slice(0, 80);
            if (bodyEl)  bodyEl.value  = p.body;
            if (subjEl && p.subject) subjEl.value = p.subject;
            if (typeof window.forumOpenNew === 'function') window.forumOpenNew();
        }, 700);
    }
})();
