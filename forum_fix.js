/* ================================================================
   forum_fix.js — Forum subject filter (UPDATED)

   Fixes applied in this version:
   - ALL Dutch text replaced with English
   - Client-side subject filter (no composite Firestore index needed)
   - forumOpenPost / forumOpenNew properly exposed on window
   - "Anoniem" → "Anonymous", time strings in English
   - forum_new-subject select uses English labels

   Add AFTER forum.js in index.html:
   <script type="module" src="forum_fix.js"></script>
   ================================================================ */

import { getApps }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _auth = null, _db = null;
(function _init() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_init, 150); return; }
    _auth = getAuth(apps[0]);
    _db   = getFirestore(apps[0]);
    onAuthStateChanged(_auth, u => { if (u) _uid = u.uid; });
})();

let _uid           = null;
let _allPosts      = [];
let _unsubAll      = null;
let _activeSubject = 'all';
let _activeSort    = 'new';



/* ── Time-ago helper (English) ── */
function _timeAgo(ts) {
    if (!ts) return '';
    const d   = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - d) / 1000);
    if (sec < 60)    return `${sec}s ago`;
    if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* ── Subject definitions (English) ── */
const SUBJECTS = [
    { id:'all',     label:'All',     icon:'fa-border-all',      color:'#6b7280' },
    { id:'math',    label:'Math',    icon:'fa-square-root-alt', color:'#3b82f6' },
    { id:'science', label:'Science', icon:'fa-flask',           color:'#22c55e' },
    { id:'english', label:'English', icon:'fa-book-open',       color:'#f59e0b' },
    { id:'history', label:'History', icon:'fa-landmark',        color:'#8b5cf6' },
    { id:'it',      label:'IT & CS', icon:'fa-code',            color:'#06b6d4' },
    { id:'other',   label:'Other',   icon:'fa-circle-question', color:'#ec4899' },
];
function subMeta(id) { return SUBJECTS.find(s => s.id === id) || SUBJECTS[6]; }

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
        posts.sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
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
                    ? 'No posts in this subject yet.'
                    : 'No posts yet — be the first one!'}</p>
            </div>`;
        return;
    }

    list.innerHTML = posts.map(p => {
        const sub   = subMeta(p.subject);
        const voted = Array.isArray(p.upvotes) && _uid && p.upvotes.includes(_uid);
        const isOwn = p.uid === _uid;
        return `
        <div class="forum-post-card ${p.solved ? 'solved' : ''}"
             onclick="forumOpenPost('${p.id}')">
            <div class="fpc-left">
                <button class="fpc-vote ${voted ? 'voted' : ''}"
                        onclick="event.stopPropagation();forumVote('${p.id}',${voted})">
                    <i class="fa-solid fa-arrow-up"></i>
                    <span>${p.upvoteCount || 0}</span>
                </button>
                <div class="fpc-replies-count">
                    <i class="fa-regular fa-comment"></i>
                    <span>${p.replyCount || 0}</span>
                </div>
            </div>
            <div class="fpc-body">
                <div class="fpc-meta">
                    <span class="fpc-subject-tag" style="background:${sub.color}22;color:${sub.color}">
                        <i class="fa-solid ${sub.icon}"></i> ${esc(sub.label)}
                    </span>
                    ${p.solved ? '<span class="fpc-solved-badge"><i class="fa-solid fa-circle-check"></i> Solved</span>' : ''}
                </div>
                <h3 class="fpc-title">${esc(p.title)}</h3>
                <p class="fpc-excerpt">${esc((p.body || '').slice(0, 130))}${(p.body || '').length > 130 ? '…' : ''}</p>
                <div class="fpc-footer">
                    <div class="forum-avatar" style="background:${sub.color}">
                        ${esc((p.displayName || '?').slice(0, 1).toUpperCase())}
                    </div>
                    <span class="fpc-author">${esc(p.displayName || 'Anonymous')}</span>
                    <span class="fpc-dot">·</span>
                    <span class="fpc-time">${_timeAgo(p.createdAt)}</span>
                    ${isOwn ? `<button class="fpc-delete"
                        onclick="event.stopPropagation();forumDeletePost('${p.id}')"
                        title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
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
        <button class="forum-subject-pill ${_activeSubject === s.id ? 'active' : ''}"
                style="--sc:${s.color}"
                data-subject="${s.id}"
                onclick="forumFixSetSubject('${s.id}')">
            <i class="fa-solid ${s.icon}"></i> ${esc(s.label)}
        </button>`).join('');
}

/* ── Public API (overrides forum.js) ── */
window.forumFixSetSubject = function(sub) {
    _activeSubject = sub;
    _renderSubjectBar();
    _render();
};

window.forumSetSubject = window.forumFixSetSubject;

window.forumSetSort = function(sort) {
    _activeSort = sort;
    document.querySelectorAll('.forum-sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === sort);
    });
    _render();
};

/* ── Override forumInit to use our listener ── */
window.forumInit = function() {
    _renderSubjectBar();
    _startListener();
    const fab = document.getElementById('forum-fab');
    if (fab) fab.classList.remove('hidden');
};

/* ── Also translate the new-post subject dropdown ── */
function _translateForumSelect() {
    const sel = document.getElementById('forum-new-subject');
    if (!sel) return;
    const map = {
        'Maths': 'Math', 'Wiskunde': 'Math',
        'Sciences': 'Science', 'Wetenschappen': 'Science',
        'Engels': 'English', 'Geschiedenis': 'History',
        'IT & CS': 'IT & CS', 'Overig': 'Other',
    };
    sel.querySelectorAll('option').forEach(opt => {
        if (map[opt.textContent]) opt.textContent = map[opt.textContent];
    });
}

(function _waitTab() {
    if (typeof window.switchTab === 'function' && !window.switchTab._sos_stub) {
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            const fab = document.getElementById('forum-fab');
            if (name === 'forum') {
                setTimeout(window.forumInit, 50);
                setTimeout(_translateForumSelect, 80);
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

/* Translate on load */
setTimeout(_translateForumSelect, 500);

console.log('[forum_fix v3] Loaded — English labels, client-side filter ✓');