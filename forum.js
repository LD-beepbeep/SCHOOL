/* ================================================================
   StudentOS — Study Forum  (forum.js)
   Add as a second module script in index.html:
     <script type="module" src="forum.js"></script>
   ================================================================ */

import { initializeApp, getApps }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore,
    collection, doc,
    addDoc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
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
let _unsubPosts  = null;   // live listener teardown
let _activePost  = null;   // currently open post id
let _unsubReplies = null;
let _activeSubject = 'all';
let _activeSort    = 'new';

const SUBJECTS = [
    { id:'all',     label:'All',         icon:'fa-border-all',        color:'#6b7280' },
    { id:'math',    label:'Maths',        icon:'fa-square-root-alt',   color:'#3b82f6' },
    { id:'science', label:'Science',      icon:'fa-flask',             color:'#22c55e' },
    { id:'english', label:'English',      icon:'fa-book-open',         color:'#f59e0b' },
    { id:'history', label:'History',      icon:'fa-landmark',          color:'#8b5cf6' },
    { id:'it',      label:'IT & CS',      icon:'fa-code',              color:'#06b6d4' },
    { id:'other',   label:'Other',        icon:'fa-circle-question',   color:'#ec4899' },
];

/* ================================================================
   BOOT — wait for auth
   ================================================================ */
onAuthStateChanged(_auth, user => {
    if (!user) return;
    _uid = user.uid;
    _displayName = user.displayName || user.email.split('@')[0];
    /* Add forum to tabs if not already there */
    _registerTab();
});

function _registerTab() {
    if (typeof window.tabs !== 'undefined' && !window.tabs.includes('forum')) {
        window.tabs.push('forum');
    }
}

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
    if (sec < 60)   return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
    if (sec < 86400)return `${Math.floor(sec/3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
function _avatar(name, color) {
    const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const c = color || '#3b82f6';
    return `<div class="forum-avatar" style="background:${c};">${_esc(initials)}</div>`;
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
        q = query(col, orderBy('createdAt', 'desc'), limit(60));
    } else {
        q = query(col,
            where('subject', '==', _activeSubject),
            orderBy('createdAt', 'desc'),
            limit(60));
    }

    _unsubPosts = onSnapshot(q, snap => {
        let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (_activeSort === 'top') {
            posts = posts.sort((a,b) => (b.upvoteCount||0) - (a.upvoteCount||0));
        } else if (_activeSort === 'unsolved') {
            posts = posts.filter(p => !p.solved);
        }
        _renderPostList(posts);
        if (typeof window.renderForumWidget === 'function') window.renderForumWidget(posts);
    }, err => console.error('Forum listen error:', err));
}

function _renderPostList(posts) {
    const list = document.getElementById('forum-post-list');
    if (!list) return;
    if (posts.length === 0) {
        list.innerHTML = `
            <div class="forum-empty">
                <i class="fa-solid fa-comments"></i>
                <p>No posts yet — be the first to ask!</p>
            </div>`;
        return;
    }
    list.innerHTML = posts.map(p => {
        const sub  = _subjectMeta(p.subject);
        const voted = (p.upvotes||[]).includes(_uid);
        return `
        <div class="forum-post-card ${p.solved?'solved':''}"
             onclick="forumOpenPost('${p.id}')">
            <div class="fpc-left">
                <button class="fpc-vote ${voted?'voted':''}"
                        onclick="event.stopPropagation();forumVote('${p.id}',${voted})">
                    <i class="fa-solid fa-arrow-up"></i>
                    <span>${p.upvoteCount||0}</span>
                </button>
                <div class="fpc-replies-count">
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
                <p class="fpc-excerpt">${_esc((p.body||'').slice(0,120))}${(p.body||'').length>120?'…':''}</p>
                <div class="fpc-footer">
                    ${_avatar(p.displayName, sub.color)}
                    <span class="fpc-author">${_esc(p.displayName||'Anonymous')}</span>
                    <span class="fpc-dot">·</span>
                    <span class="fpc-time">${_timeAgo(p.createdAt)}</span>
                    ${p.uid===_uid ? `<button class="fpc-delete" title="Delete post"
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
    const snap = await getDoc(doc(_db, 'forum_posts', postId));
    if (!snap.exists()) return;
    const p   = { id: snap.id, ...snap.data() };
    const sub = _subjectMeta(p.subject);

    document.getElementById('forum-list-view').classList.add('hidden');
    const tv = document.getElementById('forum-thread-view');
    tv.classList.remove('hidden');

    const voted = (p.upvotes||[]).includes(_uid);
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
        <div class="ft-post-body">${_esc(p.body).replace(/\n/g,'<br>')}</div>
        <div class="ft-post-meta">
            ${_avatar(p.displayName, sub.color)}
            <span class="fpc-author">${_esc(p.displayName||'Anonymous')}</span>
            <span class="fpc-dot">·</span>
            <span class="fpc-time">${_timeAgo(p.createdAt)}</span>
            <div class="ft-actions">
                <button class="ft-vote-btn ${voted?'voted':''}"
                        onclick="forumVote('${p.id}',${voted});this.classList.toggle('voted')">
                    <i class="fa-solid fa-arrow-up"></i> ${p.upvoteCount||0}
                </button>
                ${p.uid===_uid ? `
                    <button class="ft-action-btn ft-delete-btn"
                            onclick="forumDeletePost('${p.id}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                    ${!p.solved ? `<button class="ft-action-btn ft-solve-btn"
                            onclick="forumMarkSolved('${p.id}')">
                        <i class="fa-solid fa-circle-check"></i> Mark Solved
                    </button>` : ''}
                ` : ''}
            </div>
        </div>
        <div class="ft-replies-label" id="ft-replies-label">Replies</div>
        <div id="ft-replies-list"></div>`;

    _listenReplies(postId);
};

window.forumCloseThread = function() {
    if (_unsubReplies) { _unsubReplies(); _unsubReplies = null; }
    _activePost = null;
    document.getElementById('forum-thread-view').classList.add('hidden');
    document.getElementById('forum-list-view').classList.remove('hidden');
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
    });
}

function _renderReplies(replies, postId) {
    const el = document.getElementById('ft-replies-list');
    const label = document.getElementById('ft-replies-label');
    if (!el) return;
    if (label) label.textContent = `${replies.length} ${replies.length===1?'Reply':'Replies'}`;
    if (replies.length === 0) {
        el.innerHTML = `<p class="ft-no-replies">No replies yet — add one below!</p>`;
        return;
    }
    el.innerHTML = replies.map(r => `
        <div class="ft-reply ${r.isAnswer?'is-answer':''}">
            <div class="ft-reply-header">
                ${_avatar(r.displayName, r.isAnswer?'#22c55e':'#6b7280')}
                <span class="fpc-author">${_esc(r.displayName||'Anonymous')}</span>
                ${r.isAnswer ? '<span class="ft-answer-badge"><i class="fa-solid fa-check"></i> Best Answer</span>' : ''}
                <span class="fpc-dot">·</span>
                <span class="fpc-time">${_timeAgo(r.createdAt)}</span>
                ${r.uid===_uid ? `
                    <button class="ft-reply-delete"
                            onclick="forumDeleteReply('${postId}','${r.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
            </div>
            <div class="ft-reply-body">${_esc(r.body).replace(/\n/g,'<br>')}</div>
        </div>`).join('');
}

/* ================================================================
   ACTIONS — vote, post, reply, delete, mark solved
   ================================================================ */
window.forumVote = async function(postId, alreadyVoted) {
    if (!_uid) return;
    const ref = doc(_db, 'forum_posts', postId);
    try {
        if (alreadyVoted) {
            await updateDoc(ref, {
                upvotes:      arrayRemove(_uid),
                upvoteCount:  increment(-1)
            });
        } else {
            await updateDoc(ref, {
                upvotes:      arrayUnion(_uid),
                upvoteCount:  increment(1)
            });
        }
    } catch(e) { console.error('Vote error:', e); }
};

window.forumSubmitPost = async function() {
    const title   = document.getElementById('forum-new-title').value.trim();
    const body    = document.getElementById('forum-new-body').value.trim();
    const subject = document.getElementById('forum-new-subject').value;
    const errEl   = document.getElementById('forum-new-error');

    if (!title) { errEl.textContent = 'Please add a title.'; return; }
    if (!body)  { errEl.textContent = 'Please describe your question.'; return; }
    errEl.textContent = '';

    const btn = document.getElementById('forum-submit-btn');
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
        document.getElementById('forum-new-title').value   = '';
        document.getElementById('forum-new-body').value    = '';
        _closeNewPost();
    } catch(e) {
        errEl.textContent = 'Failed to post. Try again.';
        console.error(e);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post Question';
};

window.forumSubmitReply = async function() {
    if (!_activePost) return;
    const body  = document.getElementById('forum-reply-input').value.trim();
    const errEl = document.getElementById('forum-reply-error');
    if (!body) { errEl.textContent = 'Write a reply first.'; return; }
    errEl.textContent = '';

    const btn = document.getElementById('forum-reply-btn');
    btn.disabled = true;

    try {
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
        await updateDoc(doc(_db, 'forum_posts', _activePost), {
            replyCount: increment(1)
        });
        document.getElementById('forum-reply-input').value = '';
    } catch(e) {
        errEl.textContent = 'Failed to reply.';
        console.error(e);
    }
    btn.disabled = false;
};

window.forumDeletePost = async function(postId) {
    if (!confirm('Delete this post and all its replies?')) return;
    try {
        /* delete replies subcollection first */
        const repliesSnap = await getDocs(
            collection(_db, 'forum_posts', postId, 'replies')
        );
        await Promise.all(repliesSnap.docs.map(d => deleteDoc(d.ref)));
        await deleteDoc(doc(_db, 'forum_posts', postId));
        if (_activePost === postId) forumCloseThread();
    } catch(e) { console.error('Delete post error:', e); }
};

window.forumDeleteReply = async function(postId, replyId) {
    if (!confirm('Delete this reply?')) return;
    try {
        await deleteDoc(doc(_db, 'forum_posts', postId, 'replies', replyId));
        await updateDoc(doc(_db, 'forum_posts', postId), {
            replyCount: increment(-1)
        });
    } catch(e) { console.error('Delete reply error:', e); }
};

window.forumMarkSolved = async function(postId) {
    try {
        await updateDoc(doc(_db, 'forum_posts', postId), { solved: true });
        /* re-open to refresh UI */
        forumOpenPost(postId);
    } catch(e) { console.error('Mark solved error:', e); }
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
    document.getElementById('forum-new-panel').classList.add('hidden');
    document.getElementById('forum-fab').classList.remove('hidden');
}
window.forumOpenNew  = function() {
    document.getElementById('forum-new-panel').classList.remove('hidden');
    document.getElementById('forum-fab').classList.add('hidden');
    document.getElementById('forum-new-title').focus();
};
window.forumCancelNew = _closeNewPost;

/* ================================================================
   TAB INIT — called when forum tab is opened
   ================================================================ */
window.forumInit = function() {
    _renderSubjectBar();
    _listenPosts();
};

// REPLACE the existing IIFE at the bottom of forum.js:
(function _waitForumPatch(){
    if(typeof window.switchTab === 'function'){
        const _orig = window.switchTab;
        window.switchTab = function(name){
            _orig && _orig(name);
            if(name === 'forum') setTimeout(window.forumInit, 50);
            if(name !== 'forum'){
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
    if (!body || !body.trim()) throw new Error('Empty body');
    const postRef = collection(_db, 'forum_posts');
    await addDoc(postRef, {
        uid:          _uid,
        displayName:  _displayName || 'Student',
        title:        body.trim().slice(0, 80) + (body.trim().length > 80 ? '…' : ''),
        body:         body.trim(),
        subject:      subject || '',
        upvotes:      [],
        upvoteCount:  0,
        replyCount:   0,
        solved:       false,
        createdAt:    serverTimestamp(),
    });
};

/* ── If a pending post was queued from the widget, auto-fill it ── */
(function _checkPending() {
    if (typeof window._pendingForumPost !== 'undefined') {
        const p = window._pendingForumPost;
        delete window._pendingForumPost;
        // Wait for forum init then auto-open new post
        setTimeout(() => {
            const titleEl = document.getElementById('forum-new-title');
            const bodyEl  = document.getElementById('forum-new-body');
            const subjEl  = document.getElementById('forum-new-subject');
            if (titleEl) titleEl.value = p.body.slice(0, 80);
            if (bodyEl)  bodyEl.value  = p.body;
            if (subjEl && p.subject) subjEl.value = p.subject;
            if (typeof window.forumOpenNew === 'function') window.forumOpenNew();
        }, 600);
    }
})();
