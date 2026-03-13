/* ================================================================
   StudentOS — patches3.js  (v3 — complete)

   Includes:
   1.  KaTeX math rendering (fixed, uses auto-render extension)
   2.  Real-time collaborative notes (cursor-preserving live sync)
   3.  "Opgeslagen ✓" save chip + Ctrl+S
   4.  Sidebar note search filter
   5.  Smooth tab transitions + thin scrollbars
   6.  Auto-resize textareas (forum, formula modal)
   7.  Grade subject edit pencil (no data-attribute dependency)
   8.  Formula card: one-click copy button
   9.  Focus timer countdown in browser tab title
   10. Escape closes toolbar dropdowns / panels
   11. Task checkbox fade animation
   12. Formula Ctrl+F focuses search bar
   13. Dashboard streak tooltip
   14. Auto-open last note on tab switch
   15. Word count fires on paste/cut too
   16. Global _toast() helper

   Add LAST in index.html, after collab_fix.js:
   <script type="module" src="patches3.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const _app  = getApps()[0];
const _auth = getAuth(_app);
const _db   = getFirestore(_app);
let _uid = null, _uname = '';
onAuthStateChanged(_auth, u => {
    if (!u) return;
    _uid   = u.uid;
    _uname = u.displayName || u.email?.split('@')[0] || 'Student';
});

/* ════════════════════════════════════════════════════════════════
   1. KATEX — reliable load + auto-render (fixes HTML-escaping bug)
   ════════════════════════════════════════════════════════════════ */
(function fixKaTeX() {
    function _load(cb) {
        if (window.katex && window.renderMathInElement) { cb(); return; }
        if (!document.getElementById('katex-css3')) {
            const l = Object.assign(document.createElement('link'), {
                id: 'katex-css3', rel: 'stylesheet',
                href: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
            });
            document.head.appendChild(l);
        }
        let pending = 2;
        const done = () => { if (--pending === 0) setTimeout(cb, 40); };
        if (!window.katex) {
            const s = Object.assign(document.createElement('script'), {
                src: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js', async: true,
            });
            s.onload = done; document.head.appendChild(s);
        } else done();
        if (!window.renderMathInElement) {
            const s2 = Object.assign(document.createElement('script'), {
                src: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js', async: true,
            });
            s2.onload = done; document.head.appendChild(s2);
        } else done();
    }

    const DELIMS = [
        { left:'$$', right:'$$', display:true  },
        { left:'$',  right:'$',  display:false },
        { left:'\\(', right:'\\)', display:false },
        { left:'\\[', right:'\\]', display:true  },
    ];

    function _renderEl(el) {
        if (el.dataset.kr === '1') return;
        const raw = el.getAttribute('data-raw') || el.textContent.trim();
        if (!raw) return;
        el.setAttribute('data-raw', raw);
        try {
            if (window.renderMathInElement) {
                el.textContent = raw;
                window.renderMathInElement(el, { delimiters: DELIMS, throwOnError: false });
            } else {
                const parts = raw.split(/((?:\$\$[\s\S]+?\$\$)|(?:\$[^\n$]+?\$))/g);
                el.innerHTML = parts.map(p => {
                    const dm = p.match(/^\$\$([\s\S]+)\$\$$/);
                    const im = p.match(/^\$([^$]+)\$$/);
                    if (dm) return window.katex.renderToString(dm[1].trim(), { displayMode:true,  throwOnError:false });
                    if (im) return window.katex.renderToString(im[1].trim(), { displayMode:false, throwOnError:false });
                    return p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                }).join('');
            }
            el.dataset.kr = '1';
        } catch(e) { el.textContent = raw; }
    }

    function _renderAll() {
        ['.formula-body','.formula-formula','[data-formula]',
         '.formula-card code','.formula-card pre'].forEach(sel =>
            document.querySelectorAll(sel).forEach(_renderEl));
        document.getElementById('formula-list')?.querySelectorAll('p,span').forEach(el => {
            if (el.children.length > 1) return;
            if (/[\\^_{}$]/.test(el.textContent)) _renderEl(el);
        });
    }

    window.renderMathInFormulas = () => _load(_renderAll);

    function _patchRF() {
        if (typeof window.renderFormulas !== 'function') { setTimeout(_patchRF, 150); return; }
        const _o = window.renderFormulas;
        window.renderFormulas = (...a) => {
            document.querySelectorAll('[data-kr]').forEach(el => el.removeAttribute('data-kr'));
            _o(...a);
            setTimeout(() => _load(_renderAll), 60);
        };
        setTimeout(() => _load(_renderAll), 300);
    }
    _patchRF();

    /* Live preview in modal */
    function _setupPreview() {
        const ta = document.getElementById('formula-modal-formula');
        if (!ta || ta.dataset.p3) return;
        ta.dataset.p3 = '1';
        document.getElementById('formula-math-preview')?.remove();
        document.getElementById('formula-math-preview-v2')?.remove();
        document.getElementById('katex-preview')?.remove();
        const prev = Object.assign(document.createElement('div'), { id:'katex-preview' });
        prev.style.cssText = 'padding:12px 16px;margin:8px 0 12px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.22);border-radius:12px;min-height:44px;display:none;overflow-x:auto;';
        ta.after(prev);
        let _t;
        ta.addEventListener('input', function() {
            clearTimeout(_t);
            _t = setTimeout(() => {
                const raw = this.value.trim();
                if (!raw) { prev.style.display='none'; return; }
                _load(() => {
                    prev.style.display = 'block';
                    prev.innerHTML = '<span style="font-size:.58rem;color:var(--text-muted);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;">Voorbeeld</span>';
                    const d = document.createElement('div');
                    d.setAttribute('data-raw', raw);
                    prev.appendChild(d);
                    _renderEl(d);
                });
            }, 100);
        });
    }
    new MutationObserver(() => {
        const m = document.getElementById('modal-formula');
        if (m && !m.classList.contains('hidden')) setTimeout(_setupPreview, 30);
    }).observe(document.body, { attributes:true, subtree:true, attributeFilter:['class'] });

    /* Render on formula tab switch */
    (function _wt() {
        if (typeof window.switchTab !== 'function') { setTimeout(_wt, 200); return; }
        const _o = window.switchTab;
        window.switchTab = n => { _o(n); if (n==='formulas') setTimeout(()=>_load(_renderAll), 200); };
    })();
})();


/* ════════════════════════════════════════════════════════════════
   2. REAL-TIME COLLABORATIVE NOTES
   Writes every 150 ms; updates remote editor preserving cursor pos
   ════════════════════════════════════════════════════════════════ */
(function realtimeCollab() {

    /* ── Cursor helpers for contenteditable ── */
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
            if (n.nodeType === Node.TEXT_NODE) {
                if (n.length >= rem) { range.setStart(n, rem); range.setEnd(n, rem); rem = -1; return true; }
                rem -= n.length; return false;
            }
            for (const c of n.childNodes) { if (walk(c)) return true; }
            return false;
        }
        try { if (!walk(el)) range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range); }
        catch(e) {}
    }

    /* ── Fast write patch (replaces collab_fix.js 700 ms debounce) ── */
    function _patchWrite() {
        if (typeof window.saveNote !== 'function' || window._p3WritePatched) { setTimeout(_patchWrite, 200); return; }
        window._p3WritePatched = true;
        const _orig = window.saveNote;
        let _wt;
        window.saveNote = function() {
            _orig.apply(this, arguments);
            const shareId = window._collabId;
            if (!shareId || !_uid) return;
            window._p3Writing = true;
            clearTimeout(_wt);
            _wt = setTimeout(async () => {
                try {
                    await setDoc(doc(_db, 'shared_notes', shareId), {
                        title: document.getElementById('note-title')?.value || '',
                        body:  document.getElementById('note-editor')?.innerHTML || '',
                        updatedAt: serverTimestamp(),
                        updatedBy: _uname,
                    }, { merge: true });
                } catch(e) { console.warn('[p3 collab] write:', e); }
                setTimeout(() => { window._p3Writing = false; }, 250);
            }, 150);
        };
        console.log('[p3] Fast collab write patched ✓');
    }
    _patchWrite();

    /* ── Start fast listener once collab becomes active ── */
    let _listening = null;
    setInterval(() => {
        const id = window._collabId;
        if (!id || id === _listening) return;
        _listening = id;
        _startListener(id);
    }, 400);

    function _startListener(shareId) {
        console.log('[p3] Fast collab listener:', shareId);
        let _prevBody = '', _prevTitle = '';

        onSnapshot(doc(_db, 'shared_notes', shareId), snap => {
            if (!snap.exists() || window._p3Writing) return;
            const data = snap.data();

            const editor  = document.getElementById('note-editor');
            const titleEl = document.getElementById('note-title');
            const focused = document.activeElement === editor;

            if (editor && data.body !== undefined && data.body !== _prevBody && data.body !== editor.innerHTML) {
                _prevBody = data.body;
                const offset = focused ? _saveCursor(editor) : null;
                const scroll = editor.scrollTop;
                editor.innerHTML = data.body;
                editor.scrollTop = scroll;
                if (focused && offset !== null) _restoreCursor(editor, offset);
            }

            if (titleEl && data.title !== undefined &&
                data.title !== _prevTitle && document.activeElement !== titleEl) {
                _prevTitle = data.title;
                titleEl.value = data.title;
            }

            if (data.updatedBy && data.updatedBy !== _uname) _showTyping(data.updatedBy);
            _renderAvatars(data.activeUsers || []);
        }, e => console.warn('[p3 collab] listen err:', e));
    }

    let _typTimer;
    function _showTyping(name) {
        let el = document.getElementById('p3-typing');
        if (!el) {
            el = Object.assign(document.createElement('div'), { id:'p3-typing' });
            el.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:var(--glass-panel);border:var(--glass-border);border-radius:20px;padding:5px 14px;font-size:.7rem;color:var(--text-muted);z-index:55;pointer-events:none;backdrop-filter:blur(8px);transition:opacity .3s;';
            document.body.appendChild(el);
        }
        el.textContent = `${name} typt…`;
        el.style.opacity = '1';
        clearTimeout(_typTimer);
        _typTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
    }

    function _renderAvatars(users) {
        let bar = document.getElementById('collab-users-bar');
        if (!bar) {
            bar = Object.assign(document.createElement('div'), { id:'collab-users-bar' });
            bar.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:60;display:flex;flex-direction:row-reverse;pointer-events:none;';
            document.body.appendChild(bar);
        }
        bar.innerHTML = users.slice(0,6).map((u,i) => {
            const h = (u.charCodeAt(0)*53)%360;
            return `<div title="${u}" style="width:30px;height:30px;border-radius:50%;background:hsl(${h},55%,48%);border:2px solid var(--bg-color);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:800;color:#fff;margin-left:${i>0?'-8px':'0'};box-shadow:0 2px 8px rgba(0,0,0,.3);">${u[0].toUpperCase()}</div>`;
        }).join('');
    }
})();


/* ════════════════════════════════════════════════════════════════
   3. NOTES — "Opgeslagen ✓" chip + Ctrl+S
   ════════════════════════════════════════════════════════════════ */
(function saveChip() {
    function _inject() {
        if (document.getElementById('p3-chip')) return;
        const right = document.querySelector('#note-toolbar .ml-auto');
        if (!right) { setTimeout(_inject, 250); return; }
        const chip = Object.assign(document.createElement('div'), { id:'p3-chip' });
        chip.style.cssText = 'font-size:.6rem;font-weight:700;letter-spacing:.04em;color:var(--text-muted);display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:transparent;transition:color .25s,background .25s,opacity .3s;opacity:0;white-space:nowrap;user-select:none;';
        chip.innerHTML = '<i class="fa-solid fa-check" style="font-size:.55rem"></i> Saved';
        right.insertBefore(chip, right.querySelector('#note-stats') || right.firstChild);
    }
    let _ft;
    window._p3ShowSaved = () => {
        const c = document.getElementById('p3-chip');
        if (!c) return;
        clearTimeout(_ft);
        c.innerHTML = '<i class="fa-solid fa-check" style="font-size:.55rem"></i> Opgeslagen';
        c.style.color = '#22c55e'; c.style.background = 'rgba(34,197,94,.1)'; c.style.opacity = '1';
        _ft = setTimeout(() => { c.style.opacity='0'; c.style.background='transparent'; }, 1800);
    };
    (function _p() {
        if (typeof window.saveNote !== 'function' || window._p3ChipPatched) { setTimeout(_p, 200); return; }
        window._p3ChipPatched = true;
        const _o = window.saveNote;
        window.saveNote = function() { _o.apply(this, arguments); setTimeout(window._p3ShowSaved, 120); };
    })();
    /* Ctrl+S */
    document.addEventListener('keydown', e => {
        if (!(e.ctrlKey||e.metaKey) || e.key !== 's') return;
        if (!document.getElementById('view-notes')?.classList.contains('hidden')) {
            e.preventDefault();
            window.saveNote?.();
            window._p3ShowSaved?.();
        }
    });
    setTimeout(_inject, 450);
})();


/* ════════════════════════════════════════════════════════════════
   4. SIDEBAR NOTE SEARCH
   ════════════════════════════════════════════════════════════════ */
(function noteSearch() {
    function _inject() {
        const sidebar = document.getElementById('notes-sidebar');
        if (!sidebar || document.getElementById('p3-nsearch')) return;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:0 0 6px;position:relative;flex-shrink:0;';
        wrap.innerHTML = `
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.62rem;pointer-events:none;"></i>
            <input id="p3-nsearch" placeholder="Zoeken…" type="text" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px 10px 6px 28px;font-size:.72rem;color:var(--text-main);outline:none;box-sizing:border-box;font-family:inherit;transition:border-color .15s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.08)'">
        `;
        sidebar.parentNode.insertBefore(wrap, sidebar);
        document.getElementById('p3-nsearch').addEventListener('input', function() {
            const q = this.value.toLowerCase().trim();
            sidebar.querySelectorAll('button').forEach(btn => {
                const row = btn.closest('div');
                if (row) row.style.display = (!q || btn.textContent.toLowerCase().includes(q)) ? '' : 'none';
            });
        });
    }
    const o = new MutationObserver(() => { if (document.getElementById('notes-sidebar')) { _inject(); o.disconnect(); } });
    o.observe(document.body, { childList:true, subtree:true });
    setTimeout(_inject, 600);
})();


/* ════════════════════════════════════════════════════════════════
   5. STYLE POLISH — transitions, scrollbars, misc
   ════════════════════════════════════════════════════════════════ */
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
    .fade-in { animation: p3fi .18s ease-out forwards !important; }
    @keyframes p3fi { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

    #main-scroll::-webkit-scrollbar,
    #note-editor::-webkit-scrollbar,
    #notes-sidebar::-webkit-scrollbar,
    #forum-post-list::-webkit-scrollbar,
    #formula-list::-webkit-scrollbar { width:4px; }
    #main-scroll::-webkit-scrollbar-track,
    #note-editor::-webkit-scrollbar-track { background:transparent; }
    #main-scroll::-webkit-scrollbar-thumb,
    #note-editor::-webkit-scrollbar-thumb,
    #notes-sidebar::-webkit-scrollbar-thumb,
    #forum-post-list::-webkit-scrollbar-thumb,
    #formula-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1);border-radius:4px; }
    #main-scroll::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.2); }

    #flashcard-inner { transition-duration:.32s !important; }
    .modal-panel { border-radius:24px !important; }
    #note-editor:focus { box-shadow:inset 0 0 0 1px rgba(59,130,246,.12); }

    #p3-typing { transition:opacity .35s; }

    #dash-streak-wrap { position:relative; display:inline-flex; align-items:center; }
    #dash-streak-wrap:hover .p3-stip { opacity:1; }
    .p3-stip { position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
        background:var(--glass-panel);border:var(--glass-border);border-radius:10px;
        padding:6px 10px;font-size:.65rem;color:var(--text-muted);white-space:nowrap;
        opacity:0;transition:opacity .15s;backdrop-filter:blur(8px);z-index:10;pointer-events:none; }
` }));


/* ════════════════════════════════════════════════════════════════
   6. AUTO-RESIZE TEXTAREAS
   ════════════════════════════════════════════════════════════════ */
(function autoResize() {
    const IDS = ['forum-reply-input','forum-new-body','formula-modal-note','widget-forum-q'];
    const setup = id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.ar) return;
        el.dataset.ar = '1';
        el.addEventListener('input', () => { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,320)+'px'; });
    };
    IDS.forEach(setup);
    new MutationObserver(() => IDS.forEach(setup)).observe(document.body, { childList:true, subtree:true });
})();


/* ════════════════════════════════════════════════════════════════
   7. GRADE SUBJECT EDIT PENCIL
   ════════════════════════════════════════════════════════════════ */
(function gradeEdit() {
    function _getSubs() {
        if (typeof window.DB !== 'undefined') return window.DB.get('os_subjects',[]);
        try { return JSON.parse(localStorage.getItem('os_subjects')||'[]'); } catch(e){ return []; }
    }
    function _setSubs(arr) {
        if (typeof window.DB !== 'undefined') window.DB.set('os_subjects', arr);
        else localStorage.setItem('os_subjects', JSON.stringify(arr));
    }

    function _inject() {
        const c = document.getElementById('subjects-container');
        if (!c) return;
        const subs = _getSubs();
        Array.from(c.children).forEach((card, i) => {
            if (card.querySelector('.p3-edit-btn')) return;
            const sub = subs[i]; if (!sub) return;
            card.style.position = 'relative';
            const btn = document.createElement('button');
            btn.className = 'p3-edit-btn';
            btn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            btn.title = 'Vak bewerken';
            btn.style.cssText = 'position:absolute;top:10px;right:10px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;border-radius:7px;opacity:0;z-index:2;transition:opacity .15s,color .15s,background .15s;';
            btn.onmouseenter = () => { btn.style.color='var(--accent)'; btn.style.background='rgba(59,130,246,.12)'; };
            btn.onmouseleave = () => { btn.style.color='var(--text-muted)'; btn.style.background='transparent'; };
            card.onmouseenter = () => btn.style.opacity='1';
            card.onmouseleave = () => btn.style.opacity='0';
            btn.onclick = e => { e.stopPropagation(); _edit(sub); };
            card.appendChild(btn);
        });
    }

    function _edit(sub) {
        document.getElementById('p3-sm')?.remove();
        const m = document.createElement('div');
        m.id = 'p3-sm';
        m.style.cssText = 'position:fixed;inset:0;z-index:210;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
        m.innerHTML = `<div style="background:var(--bg-color);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:28px 26px;width:320px;box-shadow:0 12px 48px rgba(0,0,0,.5);animation:p3fi .15s;">
            <h3 style="font-size:.95rem;font-weight:700;margin-bottom:18px;"><i class="fa-solid fa-pencil" style="color:var(--accent);margin-right:6px;"></i>Vak bewerken</h3>
            <label style="font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:5px;">Naam</label>
            <input id="p3-sn" value="${sub.name}" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 13px;color:var(--text-main);font-size:.88rem;outline:none;box-sizing:border-box;margin-bottom:18px;font-family:inherit;transition:border-color .15s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'" onkeydown="if(event.key==='Enter')document.getElementById('p3-ss').click()">
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button id="p3-sc" style="padding:8px 16px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--text-muted);font-size:.78rem;font-weight:600;cursor:pointer;">Annuleren</button>
                <button id="p3-ss" style="padding:8px 18px;border-radius:10px;background:var(--accent);color:#fff;font-size:.78rem;font-weight:700;border:none;cursor:pointer;">Opslaan</button>
            </div>
        </div>`;
        document.body.appendChild(m);
        m.querySelector('#p3-sn').select();
        m.querySelector('#p3-sc').onclick = () => m.remove();
        m.onclick = e => { if (e.target===m) m.remove(); };
        m.querySelector('#p3-ss').onclick = () => {
            const name = m.querySelector('#p3-sn').value.trim();
            if (!name) return;
            _setSubs(_getSubs().map(x => x.id===sub.id ? {...x, name} : x));
            m.remove();
            window.renderGrades?.(); window.updateDashWidgets?.();
        };
    }

    new MutationObserver(() => {
        if (document.getElementById('subjects-container')?.children.length) setTimeout(_inject, 50);
    }).observe(document.body, { childList:true, subtree:true });
    setTimeout(_inject, 800);
})();


/* ════════════════════════════════════════════════════════════════
   8. FORMULA CARD — copy button
   ════════════════════════════════════════════════════════════════ */
(function formulaCopy() {
    function _inject() {
        document.querySelectorAll('#formula-list [class*="formula-card"]').forEach(card => {
            if (card.querySelector('.p3-copy')) return;
            card.style.position = 'relative';
            const btn = document.createElement('button');
            btn.className = 'p3-copy';
            btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            btn.title = 'Kopiëren';
            btn.style.cssText = 'position:absolute;top:10px;right:10px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;border-radius:7px;opacity:0;z-index:2;transition:opacity .15s,color .15s;';
            btn.onmouseenter = () => btn.style.color='var(--accent)';
            btn.onmouseleave = () => btn.style.color='var(--text-muted)';
            card.onmouseenter = () => btn.style.opacity='1';
            card.onmouseleave = () => btn.style.opacity='0';
            btn.onclick = e => {
                e.stopPropagation();
                const el = card.querySelector('[data-raw],[class*="formula-body"],code,pre');
                navigator.clipboard.writeText(el?.getAttribute('data-raw')||el?.textContent||'').then(() => {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    btn.style.color = '#22c55e';
                    setTimeout(() => { btn.innerHTML='<i class="fa-regular fa-copy"></i>'; btn.style.color='var(--text-muted)'; }, 1600);
                });
            };
            card.appendChild(btn);
        });
    }
    new MutationObserver(() => {
        if (document.getElementById('formula-list')?.children.length) setTimeout(_inject, 80);
    }).observe(document.body, { childList:true, subtree:true });
})();


/* ════════════════════════════════════════════════════════════════
   9. FOCUS TIMER — tab title countdown
   ════════════════════════════════════════════════════════════════ */
(function timerTitle() {
    const orig = document.title; let iv;
    (function _p() {
        if (typeof window.toggleTimer !== 'function') { setTimeout(_p, 300); return; }
        const _o = window.toggleTimer;
        window.toggleTimer = function() {
            _o();
            clearInterval(iv);
            if (document.getElementById('icon-play')?.classList.contains('fa-pause')) {
                iv = setInterval(() => {
                    const t = document.getElementById('timer-display')?.textContent?.trim();
                    const l = document.getElementById('timer-label')?.textContent?.replace(/\s+/g,' ').trim().slice(0,14) || 'Focus';
                    if (t) document.title = `${t} — ${l} | StudentOS`;
                }, 1000);
            } else { clearInterval(iv); document.title = orig; }
        };
    })();
})();


/* ════════════════════════════════════════════════════════════════
   10. ESC — close dropdowns + panels
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.tbar-dropdown-menu').forEach(m => m.style.display='none');
    document.getElementById('collab-panel')?.remove();
    document.getElementById('p3-sm')?.remove();
});


/* ════════════════════════════════════════════════════════════════
   11. TASK CHECKBOX ANIMATION
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('change', e => {
    const cb = e.target.closest('input[type="checkbox"]');
    if (!cb) return;
    const row = cb.closest('li,[class*="task-item"],.task-row');
    if (!row) return;
    row.style.transition = 'opacity .3s';
    row.style.opacity = cb.checked ? '.38' : '1';
});


/* ════════════════════════════════════════════════════════════════
   12. FORMULA Ctrl+F → focus search
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (!(e.ctrlKey||e.metaKey) || e.key !== 'f') return;
    const view = document.getElementById('view-formulas');
    if (!view || view.classList.contains('hidden')) return;
    e.preventDefault();
    view.querySelector('input[type="text"]')?.focus();
});


/* ════════════════════════════════════════════════════════════════
   13. STREAK TOOLTIP
   ════════════════════════════════════════════════════════════════ */
(function streakTip() {
    setTimeout(() => {
        const el = document.getElementById('dash-streak');
        if (!el || el.closest('#dash-streak-wrap')) return;
        const p = el.parentElement;
        const wrap = document.createElement('div');
        wrap.id = 'dash-streak-wrap';
        p.insertBefore(wrap, el);
        wrap.appendChild(el);
        const tip = document.createElement('div');
        tip.className = 'p3-stip';
        tip.textContent = `${el.textContent} dag${el.textContent==='1'?'':'en'} op rij! 🔥`;
        wrap.appendChild(tip);
    }, 900);
})();


/* ════════════════════════════════════════════════════════════════
   14. AUTO-OPEN LAST NOTE on tab switch
   ════════════════════════════════════════════════════════════════ */
(function autoOpenNote() {
    (function _p() {
        if (typeof window.switchTab !== 'function') { setTimeout(_p, 200); return; }
        const _o = window.switchTab;
        window.switchTab = function(n) {
            _o(n);
            if (n === 'notes') setTimeout(() => {
                const editor = document.getElementById('note-editor');
                if (editor && !editor.innerHTML.trim() && window.notes?.[0]) {
                    window.loadNote?.(window.notes[0].id);
                }
            }, 100);
        };
    })();
})();


/* ════════════════════════════════════════════════════════════════
   15. WORD COUNT — also fires on paste/cut
   ════════════════════════════════════════════════════════════════ */
(function wcFix() {
    const ed = document.getElementById('note-editor');
    if (!ed) return;
    ['paste','cut'].forEach(ev =>
        ed.addEventListener(ev, () => setTimeout(() => window.updateNoteCount?.(), 15))
    );
})();


/* ════════════════════════════════════════════════════════════════
   16. GLOBAL TOAST HELPER
   ════════════════════════════════════════════════════════════════ */
window._toast = (msg, isErr=false) => {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isErr ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background=''; }, 2200);
};


console.log('[StudentOS patches3 v3] Loaded ✓');
