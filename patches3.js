/* ================================================================
   StudentOS — patches3.js  (lean rewrite — zero body observers)

   Strategy: hook into existing functions (renderGrades, renderFormulas,
   openModal, switchTab) instead of MutationObservers on document.body.
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _auth = null, _db = null;
let _uid = null, _uname = '';
(function _init() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_init, 150); return; }
    _auth = getAuth(apps[0]);
    _db   = getFirestore(apps[0]);
    onAuthStateChanged(_auth, u => {
    if (!u) return;
    _uid   = u.uid;
    _uname = u.displayName || u.email?.split('@')[0] || 'Student';
});

/* ════════════════════════════════════════════════════════════════
   1. KATEX — load once, hook into renderFormulas + openModal
   ════════════════════════════════════════════════════════════════ */
(function fixKaTeX() {
    let _loaded = false;
    const _queue = [];

    function _load(cb) {
        if (_loaded && window.katex) { cb(); return; }
        if (window.katex && window.renderMathInElement) { _loaded = true; cb(); return; }
        _queue.push(cb);
        if (document.getElementById('katex-js')) return; // already loading

        const link = Object.assign(document.createElement('link'), {
            id:'katex-css', rel:'stylesheet',
            href:'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css'
        });
        document.head.appendChild(link);

        const s = Object.assign(document.createElement('script'), {
            id:'katex-js',
            src:'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js'
        });
        s.onload = () => {
            const s2 = Object.assign(document.createElement('script'), {
                src:'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js'
            });
            s2.onload = () => {
                _loaded = true;
                _queue.splice(0).forEach(f => f());
            };
            document.head.appendChild(s2);
        };
        document.head.appendChild(s);
    }

    const DELIMS = [
        {left:'$$',right:'$$',display:true},
        {left:'$', right:'$', display:false},
        {left:'\\(',right:'\\)',display:false},
        {left:'\\[',right:'\\]',display:true},
    ];

    function _renderEl(el) {
        if (el.dataset.kr) return;
        const raw = el.getAttribute('data-raw') || el.textContent.trim();
        if (!raw) return;
        el.setAttribute('data-raw', raw);
        try {
            if (window.renderMathInElement) {
                el.textContent = raw;
                window.renderMathInElement(el, {delimiters:DELIMS, throwOnError:false});
            } else {
                el.innerHTML = raw.split(/((?:\$\$[\s\S]+?\$\$)|(?:\$[^\n$]+?\$))/g).map(p => {
                    const dm = p.match(/^\$\$([\s\S]+)\$\$$/);
                    const im = p.match(/^\$([^$]+)\$$/);
                    if (dm) return window.katex.renderToString(dm[1].trim(),{displayMode:true, throwOnError:false});
                    if (im) return window.katex.renderToString(im[1].trim(),{displayMode:false,throwOnError:false});
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
    }

    window.renderMathInFormulas = () => _load(_renderAll);

    /* Hook into renderFormulas (call after it runs) */
    function _patchRF() {
        if (typeof window.renderFormulas !== 'function') { setTimeout(_patchRF,200); return; }
        const _o = window.renderFormulas;
        window.renderFormulas = (...a) => {
            document.querySelectorAll('[data-kr]').forEach(el => el.removeAttribute('data-kr'));
            _o(...a);
            _load(_renderAll);
        };
        _load(_renderAll); // render whatever is currently shown
    }
    _patchRF();

    /* Hook into openModal for formula preview — no MutationObserver */
    function _patchOpenModal() {
        if (typeof window.openModal !== 'function') { setTimeout(_patchOpenModal,200); return; }
        const _o = window.openModal;
        window.openModal = function(id) {
            _o(id);
            if (id === 'modal-formula') setTimeout(_setupModalPreview, 30);
        };
    }
    _patchOpenModal();

    function _setupModalPreview() {
        const ta = document.getElementById('formula-modal-formula');
        if (!ta || ta.dataset.p3) return;
        ta.dataset.p3 = '1';
        // Remove any old preview divs from previous patch versions
        ['formula-math-preview','formula-math-preview-v2','katex-preview'].forEach(id =>
            document.getElementById(id)?.remove()
        );
        const prev = Object.assign(document.createElement('div'), {id:'katex-preview'});
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
                    prev.innerHTML = '<span style="font-size:.58rem;color:var(--text-muted);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;">Preview</span>';
                    const d = document.createElement('div');
                    // Auto-wrap in $$ if user hasn't added delimiters themselves
                    const hasDelim = /\$|\\\(|\\\[/.test(raw);
                    d.setAttribute('data-raw', hasDelim ? raw : '$$' + raw + '$$');
                    prev.appendChild(d);
                    _renderEl(d);
                });
            }, 120);
        });
    }

function _patchST() {
        if (typeof window.switchTab !== 'function' || window.switchTab._sos_stub) { setTimeout(_patchST,200); return; }
        const _o = window.switchTab;
        window.switchTab = n => { _o(n); if (n==='formulas') _load(_renderAll); };
    }
    _patchST();
})();


/* ════════════════════════════════════════════════════════════════
   2. REAL-TIME COLLAB — cursor-preserving, 150ms write debounce
   ════════════════════════════════════════════════════════════════ */
(function realtimeCollab() {
    function _saveCursor(el) {
        const sel = window.getSelection();
        if (!sel||!sel.rangeCount) return null;
        const r = sel.getRangeAt(0).cloneRange();
        r.selectNodeContents(el);
        r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
        return r.toString().length;
    }
    function _restoreCursor(el, offset) {
        if (offset===null) return;
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        let rem = offset;
        function walk(n) {
            if (rem<0) return true;
            if (n.nodeType===3) {
                if (n.length>=rem){range.setStart(n,rem);range.setEnd(n,rem);rem=-1;return true;}
                rem-=n.length; return false;
            }
            for (const c of n.childNodes) if(walk(c)) return true;
            return false;
        }
        try { if(!walk(el)) range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range); }
        catch(e) {}
    }

    /* Fast write — patches saveNote once */
    function _patchWrite() {
        if (typeof window.saveNote!=='function'||window._p3WritePatched) { setTimeout(_patchWrite,200); return; }
        window._p3WritePatched = true;
        const _o = window.saveNote;
        let _wt;
        window.saveNote = function() {
            _o.apply(this,arguments);
            const id = window._collabId;
            if (!id||!_uid) return;
            window._p3Writing = true;
            clearTimeout(_wt);
            _wt = setTimeout(async()=>{
                try {
                    await setDoc(doc(_db,'shared_notes',id),{
                        title:document.getElementById('note-title')?.value||'',
                        body: document.getElementById('note-editor')?.innerHTML||'',
                        updatedAt:serverTimestamp(), updatedBy:_uname,
                    },{merge:true});
                } catch(e){console.warn('[p3]write',e);}
                setTimeout(()=>{window._p3Writing=false;},250);
            },150);
        };
    }
    _patchWrite();

    /* Start listener when collab becomes active */
    let _listeningTo = null;
    function _checkCollab() {
        const id = window._collabId;
        if (id && id!==_listeningTo) {
            _listeningTo = id;
            _startListener(id);
        }
    }
    // Check every second (cheap — just compares two strings)
    setInterval(_checkCollab, 1000);

    function _startListener(shareId) {
        let _prevBody='', _prevTitle='';
        onSnapshot(doc(_db,'shared_notes',shareId), snap => {
            if (!snap.exists()||window._p3Writing) return;
            const d = snap.data();
            const editor  = document.getElementById('note-editor');
            const titleEl = document.getElementById('note-title');
            const focused = document.activeElement===editor;

            if (editor && d.body!==undefined && d.body!==_prevBody && d.body!==editor.innerHTML) {
                _prevBody = d.body;
                const offset = focused ? _saveCursor(editor) : null;
                const scroll = editor.scrollTop;
                editor.innerHTML = d.body;
                editor.scrollTop = scroll;
                if (focused&&offset!==null) _restoreCursor(editor,offset);
            }
            if (titleEl && d.title!==undefined && d.title!==_prevTitle && document.activeElement!==titleEl) {
                _prevTitle=d.title; titleEl.value=d.title;
            }
            if (d.updatedBy && d.updatedBy!==_uname) _showTyping(d.updatedBy);
            _renderAvatars(d.activeUsers||[]);
        });
    }

    let _tt;
    function _showTyping(name) {
        let el = document.getElementById('p3-typing');
        if (!el) {
            el = Object.assign(document.createElement('div'),{id:'p3-typing'});
            el.style.cssText='position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:var(--glass-panel);border:var(--glass-border);border-radius:20px;padding:5px 14px;font-size:.7rem;color:var(--text-muted);z-index:55;pointer-events:none;backdrop-filter:blur(8px);transition:opacity .3s;';
            document.body.appendChild(el);
        }
        el.textContent=`${name} is typing…`; el.style.opacity='1';
        clearTimeout(_tt); _tt=setTimeout(()=>{el.style.opacity='0';},2200);
    }

    function _renderAvatars(users) {
        let bar = document.getElementById('collab-users-bar');
        if (!bar) {
            bar=Object.assign(document.createElement('div'),{id:'collab-users-bar'});
            bar.style.cssText='position:fixed;bottom:24px;right:24px;z-index:60;display:flex;flex-direction:row-reverse;pointer-events:none;';
            document.body.appendChild(bar);
        }
        bar.innerHTML = users.slice(0,6).map((u,i)=>{
            const h=(u.charCodeAt(0)*53)%360;
            return `<div title="${u}" style="width:30px;height:30px;border-radius:50%;background:hsl(${h},55%,48%);border:2px solid var(--bg-color);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:800;color:#fff;margin-left:${i>0?'-8px':'0'};box-shadow:0 2px 8px rgba(0,0,0,.3);">${u[0].toUpperCase()}</div>`;
        }).join('');
    }
})();


/* ════════════════════════════════════════════════════════════════
   3. NOTES — save chip + Ctrl+S
   ════════════════════════════════════════════════════════════════ */
(function saveChip() {
    /* Inject chip once when notes tab opens */
    function _inject() {
        if (document.getElementById('p3-chip')) return;
        const right = document.querySelector('#note-toolbar .ml-auto');
        if (!right) return;
        const chip = Object.assign(document.createElement('div'),{id:'p3-chip'});
        chip.style.cssText='font-size:.6rem;font-weight:700;color:var(--text-muted);display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:transparent;transition:color .25s,background .25s,opacity .3s;opacity:0;white-space:nowrap;user-select:none;';
        chip.innerHTML='<i class="fa-solid fa-check" style="font-size:.55rem"></i> Saved';
        right.insertBefore(chip, right.querySelector('#note-stats')||right.firstChild);
    }

    let _ft;
    window._p3ShowSaved = () => {
        const c=document.getElementById('p3-chip'); if(!c) return;
        clearTimeout(_ft);
        c.innerHTML='<i class="fa-solid fa-check" style="font-size:.55rem"></i> Saved';
        c.style.color='#22c55e'; c.style.background='rgba(34,197,94,.1)'; c.style.opacity='1';
        _ft=setTimeout(()=>{c.style.opacity='0';c.style.background='transparent';},1800);
    };

    function _patchSave() {
        if (typeof window.saveNote!=='function'||window._p3ChipPatched){setTimeout(_patchSave,200);return;}
        window._p3ChipPatched=true;
        const _o=window.saveNote;
        window.saveNote=function(){_o.apply(this,arguments);setTimeout(window._p3ShowSaved,120);};
    }
    _patchSave();

    document.addEventListener('keydown', e => {
        if (!(e.ctrlKey||e.metaKey)||e.key!=='s') return;
        if (!document.getElementById('view-notes')?.classList.contains('hidden')) {
            e.preventDefault(); window.saveNote?.(); window._p3ShowSaved?.();
        }
    });

function _patchST() {
        if (typeof window.switchTab!=='function'||window.switchTab._sos_stub){setTimeout(_patchST,200);return;}
        const _o=window.switchTab;
        window.switchTab=function(n){_o(n); if(n==='notes') setTimeout(_inject,100);};
    }
    _patchST();
    setTimeout(_inject, 500);
})();


/* ════════════════════════════════════════════════════════════════
   4. NOTES SIDEBAR SEARCH — injected once via switchTab hook
   ════════════════════════════════════════════════════════════════ */



/* ════════════════════════════════════════════════════════════════
   5. STYLE POLISH
   ════════════════════════════════════════════════════════════════ */
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:`
    .fade-in{animation:p3fi .18s ease-out forwards!important;}
    @keyframes p3fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    #main-scroll::-webkit-scrollbar,#note-editor::-webkit-scrollbar,
    #notes-sidebar::-webkit-scrollbar,#forum-post-list::-webkit-scrollbar{width:4px;}
    #main-scroll::-webkit-scrollbar-track,#note-editor::-webkit-scrollbar-track{background:transparent;}
    #main-scroll::-webkit-scrollbar-thumb,#note-editor::-webkit-scrollbar-thumb,
    #notes-sidebar::-webkit-scrollbar-thumb,#forum-post-list::-webkit-scrollbar-thumb
        {background:rgba(255,255,255,.1);border-radius:4px;}
    #flashcard-inner{transition-duration:.32s!important;}
    .modal-panel{border-radius:24px!important;}
    #p3-typing{transition:opacity .35s;}
    .notes-layout{transition:grid-template-columns .25s ease;}
    .notes-layout.sidebar-hidden #notes-left-panel{opacity:0;pointer-events:none;overflow:hidden;}
    #notes-left-panel{transition:opacity .2s ease;}
`}));


/* ════════════════════════════════════════════════════════════════
   6. AUTO-RESIZE TEXTAREAS — attach once at load, no observer
   ════════════════════════════════════════════════════════════════ */
function _setupResize(id) {
    const el = document.getElementById(id);
    if (!el||el.dataset.ar) return;
    el.dataset.ar='1';
    el.addEventListener('input',()=>{el.style.height='auto';el.style.height=Math.min(el.scrollHeight,320)+'px';});
}
// Run at load for static elements
setTimeout(()=>['forum-reply-input','forum-new-body','formula-modal-note','widget-forum-q'].forEach(_setupResize),400);
// Run when formula modal opens (for formula-modal-note which may not exist yet)
function _patchOpenModalResize(){
    if(typeof window.openModal!=='function'){setTimeout(_patchOpenModalResize,200);return;}
    const _o=window.openModal;
    window.openModal=function(id){
        _o(id);
        if(id==='modal-formula') setTimeout(()=>_setupResize('formula-modal-note'),50);
    };
}
_patchOpenModalResize();


/* ════════════════════════════════════════════════════════════════
   7. GRADE SUBJECT EDIT — hook into renderGrades, no observer
   ════════════════════════════════════════════════════════════════ */
(function gradeEdit(){
    function _getSubs(){
        if(typeof window.DB!=='undefined') return window.DB.get('os_subjects',[]);
        try{return JSON.parse(localStorage.getItem('os_subjects')||'[]');}catch(e){return[];}
    }
    function _setSubs(arr){
        if(typeof window.DB!=='undefined') window.DB.set('os_subjects',arr);
        else localStorage.setItem('os_subjects',JSON.stringify(arr));
    }
    function _inject(){
        const c=document.getElementById('subjects-container'); if(!c) return;
        const subs=_getSubs();
        Array.from(c.children).forEach((card,i)=>{
            if(card.querySelector('.p3-eb')) return;
            const sub=subs[i]; if(!sub) return;
            card.style.position='relative';
            const btn=document.createElement('button');
            btn.className='p3-eb';
            btn.innerHTML='<i class="fa-solid fa-pencil"></i>';
            btn.title='Edit subject';
            btn.style.cssText='position:absolute;top:10px;right:10px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;border-radius:7px;opacity:0;z-index:2;transition:opacity .15s,color .15s,background .15s;';
            btn.onmouseenter=()=>{btn.style.color='var(--accent)';btn.style.background='rgba(59,130,246,.12)';};
            btn.onmouseleave=()=>{btn.style.color='var(--text-muted)';btn.style.background='transparent';};
            card.onmouseenter=()=>btn.style.opacity='1';
            card.onmouseleave=()=>btn.style.opacity='0';
            btn.onclick=e=>{e.stopPropagation();_edit(sub);};
            card.appendChild(btn);
        });
    }
    function _edit(sub){
        document.getElementById('p3-sm')?.remove();
        const m=document.createElement('div');
        m.id='p3-sm';
        m.style.cssText='position:fixed;inset:0;z-index:210;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
        m.innerHTML=`<div style="background:var(--bg-color);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:28px 26px;width:320px;box-shadow:0 12px 48px rgba(0,0,0,.5);animation:p3fi .15s;"><h3 style="font-size:.95rem;font-weight:700;margin-bottom:18px;"><i class="fa-solid fa-pencil" style="color:var(--accent);margin-right:6px;"></i>Edit Subject</h3><label style="font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:5px;">Name</label><input id="p3-sn" value="${sub.name}" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 13px;color:var(--text-main);font-size:.88rem;outline:none;box-sizing:border-box;margin-bottom:18px;font-family:inherit;transition:border-color .15s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'" onkeydown="if(event.key==='Enter')document.getElementById('p3-ss').click()"><div style="display:flex;gap:8px;justify-content:flex-end;"><button id="p3-sc" style="padding:8px 16px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--text-muted);font-size:.78rem;font-weight:600;cursor:pointer;">Cancel</button><button id="p3-ss" style="padding:8px 18px;border-radius:10px;background:var(--accent);color:#fff;font-size:.78rem;font-weight:700;border:none;cursor:pointer;">Save</button></div></div>`;
        document.body.appendChild(m);
        m.querySelector('#p3-sn').select();
        m.querySelector('#p3-sc').onclick=()=>m.remove();
        m.onclick=e=>{if(e.target===m)m.remove();};
        m.querySelector('#p3-ss').onclick=()=>{
            const name=m.querySelector('#p3-sn').value.trim(); if(!name) return;
            _setSubs(_getSubs().map(x=>x.id===sub.id?{...x,name}:x));
            m.remove(); window.renderGrades?.(); window.updateDashWidgets?.();
        };
    }
    /* Hook into renderGrades instead of MutationObserver */
    function _patchRG(){
        if(typeof window.renderGrades!=='function'){setTimeout(_patchRG,200);return;}
        const _o=window.renderGrades;
        window.renderGrades=function(){_o.apply(this,arguments);setTimeout(_inject,30);};
        setTimeout(_inject,600);
    }
    _patchRG();
})();


/* ════════════════════════════════════════════════════════════════
   8. FORMULA COPY — hook into renderFormulas, no observer
   ════════════════════════════════════════════════════════════════ */
(function formulaCopy(){
    function _inject(){
        document.querySelectorAll('#formula-list [class*="formula-card"]').forEach(card=>{
            if(card.querySelector('.p3-copy')) return;
            card.style.position='relative';
            const btn=document.createElement('button');
            btn.className='p3-copy';
            btn.innerHTML='<i class="fa-regular fa-copy"></i>';
            btn.title='Kopiëren';
            btn.style.cssText='position:absolute;top:10px;right:10px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;border-radius:7px;opacity:0;z-index:2;transition:opacity .15s,color .15s;';
            btn.onmouseenter=()=>btn.style.color='var(--accent)';
            btn.onmouseleave=()=>btn.style.color='var(--text-muted)';
            card.onmouseenter=()=>btn.style.opacity='1';
            card.onmouseleave=()=>btn.style.opacity='0';
            btn.onclick=e=>{
                e.stopPropagation();
                const el=card.querySelector('[data-raw],[class*="formula-body"],code,pre');
                navigator.clipboard.writeText(el?.getAttribute('data-raw')||el?.textContent||'').then(()=>{
                    btn.innerHTML='<i class="fa-solid fa-check"></i>'; btn.style.color='#22c55e';
                    setTimeout(()=>{btn.innerHTML='<i class="fa-regular fa-copy"></i>';btn.style.color='var(--text-muted)';},1600);
                });
            };
            card.appendChild(btn);
        });
    }
    /* Already hooked into renderFormulas above — just call inject after render */
    function _patchRF(){
        if(typeof window.renderFormulas!=='function'){setTimeout(_patchRF,200);return;}
        const _o=window.renderFormulas;
        window.renderFormulas=function(...a){_o(...a);setTimeout(_inject,80);};
    }
    _patchRF();
})();


/* ════════════════════════════════════════════════════════════════
   9. FOCUS TIMER TAB TITLE
   ════════════════════════════════════════════════════════════════ */
(function timerTitle(){
    const orig=document.title; let iv;
    function _p(){
        if(typeof window.toggleTimer!=='function'){setTimeout(_p,300);return;}
        const _o=window.toggleTimer;
        window.toggleTimer=function(){
            _o();
            clearInterval(iv);
            if(document.getElementById('icon-play')?.classList.contains('fa-pause')){
                iv=setInterval(()=>{
                    const t=document.getElementById('timer-display')?.textContent?.trim();
                    const l=document.getElementById('timer-label')?.textContent?.replace(/\s+/g,' ').trim().slice(0,14)||'Focus';
                    if(t) document.title=`${t} — ${l} | StudentOS`;
                },1000);
            } else { clearInterval(iv); document.title=orig; }
        };
    }
    _p();
})();


/* ════════════════════════════════════════════════════════════════
   10. MISC QoL
   ════════════════════════════════════════════════════════════════ */
// Escape closes dropdowns
document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    document.querySelectorAll('.tbar-dropdown-menu').forEach(m=>m.style.display='none');
    document.getElementById('collab-panel')?.remove();
    document.getElementById('p3-sm')?.remove();
    window._mathKbClose?.();
});

// Ctrl+\ toggle sidebar
document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='\\'){
        e.preventDefault(); window.toggleNotesSidebar?.();
    }
});

// Task checkbox animation
document.addEventListener('change',e=>{
    const cb=e.target.closest('input[type="checkbox"]'); if(!cb) return;
    const row=cb.closest('li,[class*="task-item"]'); if(!row) return;
    row.style.transition='opacity .3s';
    row.style.opacity=cb.checked?'.38':'1';
});

// Word count on paste/cut
const _ed=document.getElementById('note-editor');
if(_ed) ['paste','cut'].forEach(ev=>_ed.addEventListener(ev,()=>setTimeout(()=>window.updateNoteCount?.(),15)));

// Global toast helper
window._toast=(msg,isErr=false)=>{
    const t=document.getElementById('sos-toast'); if(!t) return;
    t.textContent=msg; t.style.background=isErr?'#ef4444':'';
    t.classList.add('show');
    setTimeout(()=>{t.classList.remove('show');t.style.background='';},2200);
};

// Ctrl+F in formulas → focus search
document.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey)||e.key!=='f') return;
    const view=document.getElementById('view-formulas');
    if(!view||view.classList.contains('hidden')) return;
    e.preventDefault();
    view.querySelector('input[type="text"]')?.focus();
});

console.log('[StudentOS patches3 lean] ✓');
})();
