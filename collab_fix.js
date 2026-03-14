/* ================================================================
   StudentOS — collab_fix.js
   Collaborative notes via Firestore shared_notes collection.
   
   KEY FIX: exposes window._collabId so patches3.js can read it.
   KEY FIX: cursor-preserving live sync (no innerHTML clobber).
   KEY FIX: uses actual user profile (emoji/image) in avatar bar.
   ================================================================ */

import { getApps }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, doc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const _app  = getApps()[0];
const _auth = getAuth(_app);
const _db   = getFirestore(_app);
let _uid    = null;
let _uname  = '';

onAuthStateChanged(_auth, u => {
    if (!u) return;
    _uid   = u.uid;
    _uname = u.displayName || u.email?.split('@')[0] || 'Student';
});

/* ── Module state ── */
let _collabUnsub  = null;
let _collabLocal  = false;
let _writeTimer   = null;

/* ── Expose collabId on window so patches3.js can read it ── */
Object.defineProperty(window, '_collabId', {
    get: () => _collabIdValue,
    set: v  => { _collabIdValue = v; },
    configurable: true,
});
let _collabIdValue = null;

/* ── Cursor helpers ── */
function _saveCursor(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.selectNodeContents(el);
    r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    return r.toString().length;
}
function _restoreCursor(el, offset) {
    if (offset === null) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let rem = offset;
    function walk(n) {
        if (rem < 0) return true;
        if (n.nodeType === 3) {
            if (n.length >= rem) { range.setStart(n, rem); range.setEnd(n, rem); rem = -1; return true; }
            rem -= n.length; return false;
        }
        for (const c of n.childNodes) if (walk(c)) return true;
        return false;
    }
    try {
        if (!walk(el)) range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
    } catch(e) {}
}

/* ── Get current user's avatar for the bar ── */
function _getMyAvatar() {
    /* Read from DB if available, else localStorage */
    let pd = null;
    try {
        if (typeof window.DB !== 'undefined') {
            pd = window.DB.get('os_profile', null);
        }
        if (!pd) {
            pd = JSON.parse(localStorage.getItem('os_profile') || 'null');
        }
    } catch(e) {}

    if (!pd) return { type: 'emoji', emoji: '🎓', bg: '#3b82f6' };
    return pd;
}

function _avatarHTML(username, avatarData, index) {
    const ml = index > 0 ? '-8px' : '0';
    if (avatarData?.type === 'image' && avatarData?.img) {
        return `<div title="${username}" style="
            width:30px;height:30px;border-radius:50%;
            border:2px solid var(--bg-color);
            overflow:hidden;margin-left:${ml};
            box-shadow:0 2px 8px rgba(0,0,0,.35);flex-shrink:0;
        "><img src="${avatarData.img}" style="width:100%;height:100%;object-fit:cover;"></div>`;
    }
    if (avatarData?.type === 'emoji' && avatarData?.emoji) {
        return `<div title="${username}" style="
            width:30px;height:30px;border-radius:50%;
            background:${avatarData.bg || '#3b82f6'};
            border:2px solid var(--bg-color);
            display:flex;align-items:center;justify-content:center;
            font-size:.9rem;margin-left:${ml};
            box-shadow:0 2px 8px rgba(0,0,0,.35);flex-shrink:0;
        ">${avatarData.emoji}</div>`;
    }
    /* Fallback: initial letter */
    const hue = (username.charCodeAt(0) * 53) % 360;
    return `<div title="${username}" style="
        width:30px;height:30px;border-radius:50%;
        background:hsl(${hue},55%,48%);
        border:2px solid var(--bg-color);
        display:flex;align-items:center;justify-content:center;
        font-size:.65rem;font-weight:800;color:#fff;
        margin-left:${ml};box-shadow:0 2px 8px rgba(0,0,0,.35);flex-shrink:0;
    ">${username.slice(0,1).toUpperCase()}</div>`;
}

/* ── Inject share button into notes toolbar ── */
function _injectShareButton() {
    if (document.getElementById('notes-collab-btn')) return;

    const toggleBtn = document.getElementById('notes-sidebar-toggle-btn');
    if (!toggleBtn) { setTimeout(_injectShareButton, 200); return; }

    const container = toggleBtn.parentNode;
    if (!container) return;

    const btn = document.createElement('button');
    btn.id        = 'notes-collab-btn';
    btn.className = 'nt-btn';
    btn.title     = 'Share note & collaborate';
    btn.innerHTML = '<i class="fa-solid fa-user-group" style="font-size:.75rem;"></i>';
    container.insertBefore(btn, toggleBtn);
    btn.onclick = _openCollabPanel;
    console.log('[collab_fix] Share button injected ✓');
}

/* ── Collab panel ── */
function _openCollabPanel() {
    const existing = document.getElementById('collab-panel');
    if (existing) { existing.remove(); return; }

    const shareUrl  = _collabIdValue ? _buildShareUrl(_collabIdValue) : '';
    const isActive  = !!_collabIdValue;

    const panel = document.createElement('div');
    panel.id    = 'collab-panel';
    panel.style.cssText = `
        background:var(--glass-panel);border-bottom:var(--glass-border);
        padding:12px 18px;display:flex;flex-wrap:wrap;align-items:center;
        gap:10px;animation:fadeIn .15s;flex-shrink:0;
    `;

    if (isActive) {
        panel.innerHTML = `
            <i class="fa-solid fa-user-group" style="color:#22c55e;font-size:.9rem;flex-shrink:0;"></i>
            <div style="flex:1;min-width:120px;">
                <div style="font-size:.7rem;font-weight:700;color:#22c55e;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;"></span>
                    Collaborating live
                </div>
                <input id="collab-link-input" readonly value="${shareUrl}"
                    style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
                           border-radius:8px;padding:6px 10px;font-size:.7rem;color:var(--text-muted);
                           outline:none;box-sizing:border-box;cursor:text;font-family:monospace;"
                    onclick="this.select()">
            </div>
            <button id="collab-copy-btn"
                style="padding:6px 12px;border-radius:8px;background:var(--glass-hover);
                       border:1px solid rgba(255,255,255,.1);color:var(--text-muted);
                       font-size:.72rem;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;">
                <i class="fa-regular fa-copy"></i> Copy link
            </button>
            <button id="collab-stop-btn"
                style="padding:6px 12px;border-radius:8px;background:rgba(239,68,68,.1);
                       border:1px solid rgba(239,68,68,.2);color:#f87171;
                       font-size:.72rem;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;">
                <i class="fa-solid fa-stop"></i> Stop
            </button>
            <button id="collab-close-panel-btn"
                style="padding:5px 7px;border-radius:7px;background:transparent;border:none;
                       color:var(--text-muted);cursor:pointer;font-size:.8rem;flex-shrink:0;">
                <i class="fa-solid fa-xmark"></i>
            </button>`;
    } else {
        panel.innerHTML = `
            <i class="fa-solid fa-user-group" style="color:var(--accent);font-size:.9rem;flex-shrink:0;"></i>
            <div style="flex:1;font-size:.78rem;color:var(--text-muted);">
                Share this note and edit it together in real time.
            </div>
            <button id="collab-start-btn"
                style="padding:7px 16px;border-radius:10px;background:var(--accent);
                       color:#fff;font-size:.78rem;font-weight:700;border:none;
                       cursor:pointer;flex-shrink:0;display:flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-share-nodes"></i> Start sharing
            </button>
            <button id="collab-close-panel-btn"
                style="padding:5px 7px;border-radius:7px;background:transparent;border:none;
                       color:var(--text-muted);cursor:pointer;font-size:.8rem;flex-shrink:0;">
                <i class="fa-solid fa-xmark"></i>
            </button>`;
    }

    const editor  = document.getElementById('note-editor');
    const toolbar = document.getElementById('note-toolbar');
    if (editor && toolbar) toolbar.parentNode.insertBefore(panel, editor);

    panel.querySelector('#collab-close-panel-btn')?.addEventListener('click', () => panel.remove());

    panel.querySelector('#collab-start-btn')?.addEventListener('click', async () => {
        panel.remove();
        await _startCollab();
        _openCollabPanel();
    });

    panel.querySelector('#collab-stop-btn')?.addEventListener('click', () => {
        _stopCollab();
        panel.remove();
        _openCollabPanel();
    });

    panel.querySelector('#collab-copy-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('collab-link-input');
        if (!inp) return;
        navigator.clipboard.writeText(inp.value).then(() => {
            const btn = document.getElementById('collab-copy-btn');
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                btn.style.color = '#22c55e';
                setTimeout(() => {
                    if (btn) { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy link'; btn.style.color = ''; }
                }, 2000);
            }
        }).catch(() => { inp.select(); document.execCommand('copy'); });
    });
}

function _buildShareUrl(shareId) {
    return `${location.origin}${location.pathname}?collab=${shareId}`;
}

/* ── Start collaboration ── */
async function _startCollab() {
    if (!_uid) { _toast('Please sign in to collaborate.', true); return; }

    const noteId    = window.activeNote || Date.now();
    const shareId   = `note_${noteId}_${Math.random().toString(36).slice(2,8)}`;
    const title     = document.getElementById('note-title')?.value || '';
    const body      = document.getElementById('note-editor')?.innerHTML || '';
    const myAvatar  = _getMyAvatar();

    try {
        await setDoc(doc(_db, 'shared_notes', shareId), {
            title,
            body,
            createdBy:   _uid,
            createdName: _uname,
            updatedAt:   serverTimestamp(),
            activeUsers: [_uname],
            avatars:     { [_uname]: myAvatar },
        });
        /* !! Expose on window BEFORE starting listener !! */
        window._collabId = shareId;
        _listenCollab(shareId);
        _updateCollabBtnStyle(true);
        _toast('Sharing started! Copy the link. ✓');
    } catch(e) {
        console.error('[collab] start error:', e);
        _toast('Could not start — check your connection.', true);
        window._collabId = null;
    }
}

/* ── Stop collaboration ── */
function _stopCollab() {
    if (_collabUnsub) { _collabUnsub(); _collabUnsub = null; }
    window._collabId = null;
    _updateCollabBtnStyle(false);
    document.getElementById('collab-users-bar')?.remove();
    _toast('Sharing stopped.');
}

/* ── Live Firestore listener — cursor-preserving ── */
function _listenCollab(shareId) {
    if (_collabUnsub) { _collabUnsub(); _collabUnsub = null; }

    _collabUnsub = onSnapshot(doc(_db, 'shared_notes', shareId), snap => {
        if (!snap.exists() || _collabLocal) return;
        const data = snap.data();

        const editor  = document.getElementById('note-editor');
        const titleEl = document.getElementById('note-title');
        const focused = document.activeElement === editor;

        /* ── Update body with cursor preservation ── */
        if (editor && data.body !== undefined && editor.innerHTML !== data.body) {
            const offset = focused ? _saveCursor(editor) : null;
            const scroll = editor.scrollTop;
            editor.innerHTML = data.body;
            editor.scrollTop = scroll;
            if (focused && offset !== null) _restoreCursor(editor, offset);
        }

        /* ── Update title only when user isn't in it ── */
        if (titleEl && data.title !== undefined &&
            titleEl.value !== data.title &&
            document.activeElement !== titleEl) {
            titleEl.value = data.title;
        }

        /* ── Render avatar bar ── */
        _renderUsersBar(data.activeUsers || [], data.avatars || {});

    }, err => console.warn('[collab] listener error:', err));
}

/* ── Avatar bar — uses actual stored avatars ── */
function _renderUsersBar(users, avatars) {
    /* Only show when on notes tab */
    const notesView = document.getElementById('view-notes');
    if (!notesView || notesView.classList.contains('hidden')) {
        document.getElementById('collab-users-bar')?.remove();
        return;
    }

    let bar = document.getElementById('collab-users-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'collab-users-bar';
        bar.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:60;
            display:flex;flex-direction:row-reverse;align-items:center;
            pointer-events:none;
        `;
        document.body.appendChild(bar);
    }

    bar.innerHTML = users.slice(0, 6).map((u, i) =>
        _avatarHTML(u, avatars[u] || null, i)
    ).join('');
}

/* ── Patch saveNote for collab writes ── */
function _patchSaveNote() {
    if (typeof window.saveNote !== 'function') { setTimeout(_patchSaveNote, 200); return; }
    if (window._collabSavePatched) return;
    window._collabSavePatched = true;

    const _orig = window.saveNote;
    window.saveNote = function() {
        _orig.apply(this, arguments);
        if (!window._collabId || !_uid) return;

        _collabLocal = true;
        clearTimeout(_writeTimer);
        _writeTimer = setTimeout(async () => {
            const title    = document.getElementById('note-title')?.value || '';
            const body     = document.getElementById('note-editor')?.innerHTML || '';
            const myAvatar = _getMyAvatar();
            try {
                await setDoc(doc(_db, 'shared_notes', window._collabId), {
                    title, body,
                    updatedAt: serverTimestamp(),
                    updatedBy: _uname,
                    [`avatars.${_uname}`]: myAvatar,
                }, { merge: true });
            } catch(e) {
                console.warn('[collab] write error:', e);
            }
            setTimeout(() => { _collabLocal = false; }, 350);
        }, 200); /* 200ms debounce — fast enough to feel live */
    };
    console.log('[collab_fix] saveNote patched ✓');
}

/* ── Join via URL: ?collab=... ── */
function _checkCollabParam() {
    const params  = new URLSearchParams(location.search);
    const shareId = params.get('collab');
    if (!shareId) return;

    function _tryJoin() {
        if (!_uid) { setTimeout(_tryJoin, 300); return; }
        window._collabId = shareId;
        _listenCollab(shareId);
        _updateCollabBtnStyle(true);

        /* Register own avatar */
        const myAvatar = _getMyAvatar();
        setDoc(doc(_db, 'shared_notes', shareId), {
            activeUsers: [_uname],
            avatars:     { [_uname]: myAvatar },
        }, { merge: true }).catch(() => {});

        _toast('Shared note opened! ✓');
        if (typeof window.switchTab === 'function') window.switchTab('notes');
    }
    _tryJoin();
}

function _updateCollabBtnStyle(active) {
    const btn = document.getElementById('notes-collab-btn');
    if (!btn) return;
    if (active) {
        btn.style.color      = '#22c55e';
        btn.style.background = 'rgba(34,197,94,.12)';
        btn.style.border     = '1px solid rgba(34,197,94,.25)';
        btn.title            = 'Collaborating — click to manage';
    } else {
        btn.style.color      = '';
        btn.style.background = '';
        btn.style.border     = '';
        btn.title            = 'Share note & collaborate';
        document.getElementById('collab-users-bar')?.remove();
    }
}

function _toast(msg, isErr = false) {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent      = msg;
    t.style.background = isErr ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 2500);
}

/* ── Boot ── */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectShareButton);
} else {
    setTimeout(_injectShareButton, 100);
}
_patchSaveNote();
_checkCollabParam();

/* Re-inject when switching to notes tab */
(function _wt() {
    if (typeof window.switchTab !== 'function') { setTimeout(_wt, 200); return; }
    const _o = window.switchTab;
    window.switchTab = function(name) {
        _o(name);
        if (name === 'notes') setTimeout(_injectShareButton, 80);
        /* Hide avatar bar when leaving notes */
        if (name !== 'notes') {
            document.getElementById('collab-users-bar')?.remove();
        }
    };
})();

window._collabNotes = { start: _startCollab, stop: _stopCollab };
console.log('[collab_fix v2] Loaded ✓');
