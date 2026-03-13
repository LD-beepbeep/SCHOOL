/* ================================================================
   StudentOS — collab_fix.js
   Fixes the missing share button in Notes toolbar.
   Replace patches2.js's collab section, or add this as a
   separate script AFTER patches2.js.

   Add to index.html:
   <script type="module" src="collab_fix.js"></script>
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

/* ── State ── */
let _collabId    = null;
let _collabUnsub = null;
let _collabLocal = false;
let _writeTimer  = null;

/* ================================================================
   INJECT BUTTON — targets the correct container div
   ================================================================ */
function _injectShareButton() {
    /* Already injected? */
    if (document.getElementById('notes-collab-btn')) return;

    /* The toolbar right-side container holds sidebar-toggle + delete.
       It's the div with class "ml-auto flex gap-1 items-center flex-shrink-0" */
    const toggleBtn = document.getElementById('notes-sidebar-toggle-btn');
    if (!toggleBtn) {
        /* Toolbar not in DOM yet — retry */
        setTimeout(_injectShareButton, 200);
        return;
    }

    /* The container is toggleBtn's direct parent */
    const container = toggleBtn.parentNode;
    if (!container) return;

    const btn = document.createElement('button');
    btn.id        = 'notes-collab-btn';
    btn.className = 'nt-btn';
    btn.title     = 'Samenwerken (deel deze notitie live)';
    btn.innerHTML = '<i class="fa-solid fa-user-group" style="font-size:.75rem;"></i>';

    /* Insert BEFORE the sidebar-toggle button */
    container.insertBefore(btn, toggleBtn);

    btn.onclick = _openCollabPanel;
    console.log('[collab_fix] Share button injected ✓');
}

/* ================================================================
   COLLAB PANEL
   ================================================================ */
function _openCollabPanel() {
    /* Toggle: if panel open, close it */
    const existing = document.getElementById('collab-panel');
    if (existing) { existing.remove(); return; }

    const shareUrl = _collabId ? _buildShareUrl(_collabId) : '';
    const isActive = !!_collabId;

    const panel = document.createElement('div');
    panel.id    = 'collab-panel';
    panel.style.cssText = `
        background: var(--glass-panel);
        border-bottom: var(--glass-border);
        padding: 12px 18px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        animation: fadeIn .15s;
        flex-shrink: 0;
    `;

    if (isActive) {
        panel.innerHTML = `
            <i class="fa-solid fa-user-group" style="color:#22c55e;font-size:.9rem;flex-shrink:0;"></i>
            <div style="flex:1;min-width:120px;">
                <div style="font-size:.7rem;font-weight:700;color:#22c55e;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;animation:musicPulse 1.2s ease-in-out infinite;"></span>
                    Live samenwerken actief
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
                <i class="fa-regular fa-copy"></i> Kopiëren
            </button>
            <button id="collab-stop-btn"
                style="padding:6px 12px;border-radius:8px;background:rgba(239,68,68,.1);
                       border:1px solid rgba(239,68,68,.2);color:#f87171;
                       font-size:.72rem;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;">
                <i class="fa-solid fa-stop"></i> Stoppen
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
                Werk samen aan deze notitie — deel een live link.
            </div>
            <button id="collab-start-btn"
                style="padding:7px 16px;border-radius:10px;background:var(--accent);
                       color:#fff;font-size:.78rem;font-weight:700;border:none;
                       cursor:pointer;flex-shrink:0;display:flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-share-nodes"></i> Samenwerken starten
            </button>
            <button id="collab-close-panel-btn"
                style="padding:5px 7px;border-radius:7px;background:transparent;border:none;
                       color:var(--text-muted);cursor:pointer;font-size:.8rem;flex-shrink:0;">
                <i class="fa-solid fa-xmark"></i>
            </button>`;
    }

    /* Insert panel between toolbar and editor */
    const editor  = document.getElementById('note-editor');
    const toolbar = document.getElementById('note-toolbar');
    if (editor && toolbar) {
        /* Insert after toolbar (before editor) */
        toolbar.parentNode.insertBefore(panel, editor);
    }

    /* Wire up buttons */
    document.getElementById('collab-close-panel-btn')?.addEventListener('click', () => panel.remove());

    document.getElementById('collab-start-btn')?.addEventListener('click', async () => {
        panel.remove();
        await _startCollab();
        _openCollabPanel(); /* re-open to show link */
    });

    document.getElementById('collab-stop-btn')?.addEventListener('click', () => {
        _stopCollab();
        panel.remove();
        _openCollabPanel();
    });

    document.getElementById('collab-copy-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('collab-link-input');
        if (!inp) return;
        navigator.clipboard.writeText(inp.value).then(() => {
            const btn = document.getElementById('collab-copy-btn');
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Gekopieerd!';
                btn.style.color = '#22c55e';
                setTimeout(() => {
                    if (btn) {
                        btn.innerHTML = '<i class="fa-regular fa-copy"></i> Kopiëren';
                        btn.style.color = '';
                    }
                }, 2000);
            }
        }).catch(() => {
            /* Fallback for browsers without clipboard API */
            inp.select();
            document.execCommand('copy');
            _toast('Gekopieerd!');
        });
    });
}

/* ================================================================
   COLLAB LOGIC
   ================================================================ */
function _buildShareUrl(shareId) {
    return `${location.origin}${location.pathname}?collab=${shareId}`;
}

async function _startCollab() {
    if (!_uid) { _toast('Log eerst in om samen te werken.', true); return; }

    const noteId  = window.activeNote || Date.now();
    _collabId     = `note_${noteId}_${Math.random().toString(36).slice(2,8)}`;

    const title = document.getElementById('note-title')?.value || '';
    const body  = document.getElementById('note-editor')?.innerHTML || '';

    try {
        await setDoc(doc(_db, 'shared_notes', _collabId), {
            title,
            body,
            createdBy:   _uid,
            createdName: _uname,
            updatedAt:   serverTimestamp(),
            activeUsers: [_uname],
        });
        _listenCollab(_collabId);
        _updateCollabBtnStyle(true);
        _toast('Samenwerken gestart! Kopieer de link. ✓');
    } catch(e) {
        console.error('[collab] start error:', e);
        _toast('Kon niet starten — controleer je verbinding.', true);
        _collabId = null;
    }
}

function _stopCollab() {
    if (_collabUnsub) { _collabUnsub(); _collabUnsub = null; }
    _collabId = null;
    _updateCollabBtnStyle(false);
    /* Remove active users indicator */
    document.getElementById('collab-users-bar')?.remove();
    _toast('Samenwerken gestopt.');
}

function _listenCollab(shareId) {
    if (_collabUnsub) { _collabUnsub(); _collabUnsub = null; }

    _collabUnsub = onSnapshot(doc(_db, 'shared_notes', shareId), snap => {
        if (!snap.exists() || _collabLocal) return;
        const data = snap.data();

        const editor  = document.getElementById('note-editor');
        const titleEl = document.getElementById('note-title');

        if (editor && data.body !== undefined && editor.innerHTML !== data.body) {
            /* Preserve scroll + cursor roughly */
            const scrollTop = editor.scrollTop;
            editor.innerHTML = data.body;
            editor.scrollTop = scrollTop;
        }
        if (titleEl && data.title !== undefined && titleEl.value !== data.title) {
            titleEl.value = data.title;
        }
        _renderUsersBar(data.activeUsers || []);
    }, err => console.warn('[collab] listener error:', err));
}

function _renderUsersBar(users) {
    let bar = document.getElementById('collab-users-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'collab-users-bar';
        bar.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 60;
            display: flex;
            flex-direction: row-reverse;
            align-items: center;
            gap: 0;
            pointer-events: none;
        `;
        document.body.appendChild(bar);
    }
    bar.innerHTML = users.slice(0,6).map((u, i) => {
        const hue = (u.charCodeAt(0) * 53) % 360;
        return `<div title="${u}" style="
            width:30px;height:30px;border-radius:50%;
            background:hsl(${hue},55%,48%);
            border:2px solid var(--bg-color);
            display:flex;align-items:center;justify-content:center;
            font-size:.65rem;font-weight:800;color:#fff;
            margin-left:${i>0?'-8px':'0'};
            box-shadow:0 2px 8px rgba(0,0,0,.35);
        ">${u.slice(0,1).toUpperCase()}</div>`;
    }).join('');
}

function _updateCollabBtnStyle(active) {
    const btn = document.getElementById('notes-collab-btn');
    if (!btn) return;
    if (active) {
        btn.style.color      = '#22c55e';
        btn.style.background = 'rgba(34,197,94,.12)';
        btn.style.border     = '1px solid rgba(34,197,94,.25)';
        btn.title            = 'Samenwerken actief — klik om te beheren';
    } else {
        btn.style.color      = '';
        btn.style.background = '';
        btn.style.border     = '';
        btn.title            = 'Samenwerken starten';
        document.getElementById('collab-users-bar')?.remove();
    }
}

/* ================================================================
   PATCH saveNote to sync when collab is active
   ================================================================ */
function _patchSaveNote() {
    if (typeof window.saveNote !== 'function') {
        setTimeout(_patchSaveNote, 200);
        return;
    }
    const _orig = window.saveNote;
    window.saveNote = function() {
        _orig.apply(this, arguments);
        if (!_collabId || !_uid) return;

        /* Debounce writes — 700ms after last keystroke */
        _collabLocal = true;
        clearTimeout(_writeTimer);
        _writeTimer = setTimeout(async () => {
            const title = document.getElementById('note-title')?.value || '';
            const body  = document.getElementById('note-editor')?.innerHTML || '';
            try {
                await setDoc(doc(_db, 'shared_notes', _collabId), {
                    title, body,
                    updatedAt: serverTimestamp(),
                    updatedBy: _uname,
                }, { merge: true });
            } catch(e) {
                console.warn('[collab] write error:', e);
            }
            setTimeout(() => { _collabLocal = false; }, 400);
        }, 700);
    };
    console.log('[collab_fix] saveNote patched ✓');
}

/* ================================================================
   JOIN via URL: ?collab=...
   ================================================================ */
function _checkCollabParam() {
    const params  = new URLSearchParams(location.search);
    const shareId = params.get('collab');
    if (!shareId) return;

    function _tryJoin() {
        if (!_uid) { setTimeout(_tryJoin, 300); return; }
        _collabId = shareId;
        _listenCollab(shareId);
        _updateCollabBtnStyle(true);
        /* Register presence */
        setDoc(doc(_db, 'shared_notes', shareId), {
            activeUsers: [_uname],
        }, { merge: true }).catch(() => {});
        _toast('Gedeelde notitie geopend! ✓');
        if (typeof window.switchTab === 'function') window.switchTab('notes');
    }
    _tryJoin();
}

/* ================================================================
   TOAST helper
   ================================================================ */
function _toast(msg, isErr = false) {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent        = msg;
    t.style.background   = isErr ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 2500);
}

/* ================================================================
   BOOT
   ================================================================ */
/* Toolbar is in the HTML from the start, so inject immediately on DOMContentLoaded */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectShareButton);
} else {
    /* DOM already ready — inject after a short tick so script.js runs first */
    setTimeout(_injectShareButton, 100);
}

_patchSaveNote();
_checkCollabParam();

console.log('[collab_fix] Loaded ✓');
