/* ================================================================
   forum_fix.js — Forum subject filter, standalone fix
   
   The subject filter was broken because Firestore requires a
   *composite index* for queries that combine where() + orderBy().
   
   This file patches forum.js's _listenPosts to always fetch ALL posts
   (just orderBy createdAt) and then filter/sort in the browser.
   That means no index needed and filtering is instant.

   Add AFTER forum.js in index.html:
   <script type="module" src="forum_fix.js"></script>
   ================================================================ */

import { getApps }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, collection, query, orderBy, limit, onSnapshot, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const _app = getApps()[0];
const _auth = getAuth(_app);
const _db   = getFirestore(_app);

let _uid           = null;
let _allPosts      = [];
let _unsubAll      = null;
let _activeSubject = 'all';
let _activeSort    = 'new';
let _ready         = false;

onAuthStateChanged(_auth, u => { if (u) _uid = u.uid; });

/* ── Helpers ── */
function _subjectLabel(id) {
    const map = {
        all:     'Alles',
        math:    'Math',
        science: 'Science',
        english: 'English',
        history: 'History',
        it:      'IT & CS',
        other:   'Other',
    };
    return map[id] || id;
}

function _timeAgo(ts) {
    if (!ts) return '';
    const d   = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - d) / 1000);
    if (sec < 60)    return `${sec}s geleden`;
    if (sec < 3600)  return `${Math.floor(sec/60)}m geleden`;
    if (sec < 86400) return `${Math.floor(sec/3600)}u geleden`;
    return d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' });
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* Subject meta */
const SUBJECTS = [
    { id:'all',     label:'All',          icon:'fa-border-all',      color:'#6b7280' },
    { id:'math',    label:'Math',        icon:'fa-square-root-alt', color:'#3b82f6' },
    { id:'science', label:'Science',   icon:'fa-flask',           color:'#22c55e' },
    { id:'english', label:'English',          icon:'fa-book-open',       color:'#f59e0b' },
    { id:'history', label:'History',    icon:'fa-landmark',        color:'#8b5cf6' },
    { id:'it',      label:'IT & CS',         icon:'fa-code',            color:'#06b6d4' },
    { id:'other',   label:'Other',          icon:'fa-circle-question', color:'#ec4899' },
];
function subMeta(id) { return SUBJECTS.find(s=>s.id===id) || SUBJECTS[6]; }

/* ── Start live listener — fetches ALL posts, no compound query ── */
function _startListener() {
    if (_unsubAll) { _unsubAll(); _unsubAll = null; }
    const q = query(
        collection(_db, 'forum_posts'),
        orderBy('createdAt', 'desc'),
        limit(100)
    );
    _unsubAll = onSnapshot(q, snap => {
        _allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _render();
    }, err => {
        console.warn('[forum_fix] snapshot error:', err);
    });
}

/* ── Client-side filter + sort ── */
function _getFiltered() {
    let posts = [..._allPosts];
    if (_activeSubject !== 'all') {
        posts = posts.filter(p => p.subject === _activeSubject);
    }
    if (_activeSort === 'top') {
        posts.sort((a,b) => (b.upvoteCount||0) - (a.upvoteCount||0));
    } else if (_activeSort === 'unsolved') {
        posts = posts.filter(p => !p.solved);
    }
    return posts;
}

/* ── Render post list ── */
function _render() {
    const list = document.getElementById('forum-post-list');
    if (!list) return;
    const posts = _getFiltered();

    if (posts.length === 0) {
        list.innerHTML = `
            <div class="forum-empty">
                <i class="fa-solid fa-comments"></i>
                <p>${_activeSubject !== 'all'
                    ? 'Geen berichten in dit vak.'
                    : 'Nog geen berichten — wees de eerste!'}</p>
            </div>`;
        return;
    }

    list.innerHTML = posts.map(p => {
        const sub   = subMeta(p.subject);
        const voted = Array.isArray(p.upvotes) && _uid && p.upvotes.includes(_uid);
        const isOwn = p.uid === _uid;
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
                        <i class="fa-solid ${sub.icon}"></i> ${esc(sub.label)}
                    </span>
                    ${p.solved?'<span class="fpc-solved-badge"><i class="fa-solid fa-circle-check"></i> Opgelost</span>':''}
                </div>
                <h3 class="fpc-title">${esc(p.title)}</h3>
                <p class="fpc-excerpt">${esc((p.body||'').slice(0,130))}${(p.body||'').length>130?'…':''}</p>
                <div class="fpc-footer">
                    <div class="forum-avatar" style="background:${sub.color}">
                        ${esc((p.displayName||'?').slice(0,1).toUpperCase())}
                    </div>
                    <span class="fpc-author">${esc(p.displayName||'Anoniem')}</span>
                    <span class="fpc-dot">·</span>
                    <span class="fpc-time">${_timeAgo(p.createdAt)}</span>
                    ${isOwn?`<button class="fpc-delete"
                        onclick="event.stopPropagation();forumDeletePost('${p.id}')"
                        title="Verwijderen">
                        <i class="fa-solid fa-trash"></i>
                    </button>`:''}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ── Render subject filter bar ── */
function _renderSubjectBar() {
    const bar = document.getElementById('forum-subject-bar');
    if (!bar) return;
    bar.innerHTML = SUBJECTS.map(s => `
        <button class="forum-subject-pill ${_activeSubject===s.id?'active':''}"
                style="--sc:${s.color}"
                data-subject="${s.id}"
                onclick="forumFixSetSubject('${s.id}')">
            <i class="fa-solid ${s.icon}"></i> ${esc(s.label)}
        </button>`).join('');
}

/* ── Public API (overrides forum.js's versions) ── */
window.forumFixSetSubject = function(sub) {
    _activeSubject = sub;
    _renderSubjectBar();
    _render();
};

window.forumSetSubject = window.forumFixSetSubject; // override forum.js

window.forumSetSort = function(sort) {
    _activeSort = sort;
    document.querySelectorAll('.forum-sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === sort);
    });
    _render();
};

/* ── Override forumInit to use our listener ── */
const _origInit = window.forumInit;
window.forumInit = function() {
    _renderSubjectBar();
    _startListener();
    const fab = document.getElementById('forum-fab');
    if (fab) fab.classList.remove('hidden');
};

/* ── Patch switchTab ── */
(function _waitTab(){
    if (typeof window.switchTab === 'function') {
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            const fab = document.getElementById('forum-fab');
            if (name === 'forum') {
                setTimeout(window.forumInit, 50);
                if (fab) fab.classList.remove('hidden');
            } else {
                if (fab) fab.classList.add('hidden');
                if (_unsubAll) { _unsubAll(); _unsubAll = null; }
            }
        };
    } else {
        setTimeout(_waitTab, 100);
    }
})();

console.log('[forum_fix] Loaded — client-side subject filter active ✓');
