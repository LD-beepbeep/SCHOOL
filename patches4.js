/* ================================================================
   StudentOS — patches4.js  (lean)
   1. Math keyboard — slide-up panel, organised groups, Alt+M
   2. Forum search + bookmarks + filter chips
   3. Collab heartbeat + join toast + copy-link button
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, arrayUnion }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const _app  = getApps()[0];
const _auth = getAuth(_app);
const _db   = getFirestore(_app);
let _uid=null, _uname='';
onAuthStateChanged(_auth,u=>{if(!u)return;_uid=u.uid;_uname=u.displayName||u.email?.split('@')[0]||'Student';});

/* ════════════════════════════════════════════════════════════════
   SHARED CSS
   ════════════════════════════════════════════════════════════════ */
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:`
#math-kb{position:fixed;bottom:0;left:50%;transform:translateX(-50%);z-index:300;
    width:min(700px,98vw);background:var(--bg-color);
    border:1px solid rgba(255,255,255,.12);border-bottom:none;
    border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.5);
    padding:14px 16px 20px;display:none;flex-direction:column;gap:10px;
    backdrop-filter:blur(20px);}
#math-kb.open{display:flex;animation:mkbUp .2s ease-out;}
@keyframes mkbUp{from{transform:translateX(-50%) translateY(30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
.mkb-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07);}
.mkb-title{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);display:flex;align-items:center;gap:6px;}
.mkb-tabs{display:flex;gap:4px;flex-wrap:wrap;}
.mkb-tab{padding:4px 10px;border-radius:8px;border:none;cursor:pointer;font-size:.65rem;font-weight:700;background:rgba(255,255,255,.06);color:var(--text-muted);transition:all .12s;}
.mkb-tab.active{background:var(--accent);color:#fff;}
.mkb-keys{display:flex;flex-wrap:wrap;gap:5px;}
.mkb-btn{min-width:40px;height:36px;padding:0 8px;border-radius:9px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.06);color:var(--text-main);cursor:pointer;font-size:.82rem;font-weight:600;font-family:'JetBrains Mono',monospace;transition:background .1s,color .1s,transform .08s;display:flex;align-items:center;justify-content:center;white-space:nowrap;}
.mkb-btn:hover{background:var(--accent);color:#fff;transform:scale(1.05);}
.mkb-btn:active{transform:scale(.96);}
.mkb-btn.wide{min-width:60px;}
.mkb-prev{min-height:34px;padding:6px 12px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.2);border-radius:10px;font-size:.82rem;color:var(--text-main);display:flex;align-items:center;gap:8px;overflow-x:auto;}
.mkb-foot{display:flex;gap:5px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);}
.mkb-close{background:transparent;border:none;cursor:pointer;color:var(--text-muted);padding:4px 7px;border-radius:6px;font-size:.85rem;transition:color .12s;}
.mkb-close:hover{color:var(--text-main);}

/* Forum */
#forum-search-wrap{position:relative;margin-bottom:10px;}
#forum-search-wrap i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.7rem;pointer-events:none;}
#forum-search-inp{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:9px 12px 9px 34px;font-size:.8rem;color:var(--text-main);outline:none;box-sizing:border-box;font-family:inherit;transition:border-color .15s;}
#forum-search-inp:focus{border-color:var(--accent);}
.forum-filter-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
.ffc-chip{padding:4px 12px;border-radius:20px;font-size:.68rem;font-weight:700;border:1px solid rgba(255,255,255,.1);background:transparent;color:var(--text-muted);cursor:pointer;transition:all .12s;}
.ffc-chip.active{background:var(--accent);color:#fff;border-color:var(--accent);}
.fpc-bookmark{background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.75rem;padding:3px 5px;border-radius:5px;transition:color .12s;margin-left:auto;}
.fpc-bookmark:hover,.fpc-bookmark.saved{color:#f59e0b;}

/* Collab join toast */
@keyframes cjt{0%{transform:translateX(-50%) translateY(20px);opacity:0}15%{transform:translateX(-50%) translateY(0);opacity:1}80%{opacity:1}100%{transform:translateX(-50%) translateY(-8px);opacity:0}}
.collab-join-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:20px;padding:7px 16px;font-size:.75rem;font-weight:700;z-index:70;animation:cjt 3s ease forwards;pointer-events:none;white-space:nowrap;}
`}));


/* ════════════════════════════════════════════════════════════════
   1. MATH KEYBOARD
   ════════════════════════════════════════════════════════════════ */
(function mathKeyboard(){
    const GROUPS = {
        'Basis':[
            {l:'+',x:'+'},{l:'−',x:'-'},{l:'×',x:'\\times'},{l:'÷',x:'\\div'},
            {l:'=',x:'='},{l:'≠',x:'\\neq'},{l:'≈',x:'\\approx'},
            {l:'≤',x:'\\leq'},{l:'≥',x:'\\geq'},{l:'±',x:'\\pm'},
            {l:'( )',x:'\\left(  \\right)',c:-9,w:1},{l:'[ ]',x:'\\left[  \\right]',c:-9,w:1},
            {l:'|x|',x:'\\left|  \\right|',c:-9,w:1},{l:'∞',x:'\\infty'},
        ],
        'Machten':[
            {l:'x²',x:'^{2}'},{l:'x³',x:'^{3}'},{l:'xⁿ',x:'^{n}',c:-1},
            {l:'x₁',x:'_{1}'},{l:'xₙ',x:'_{n}',c:-1},
            {l:'√x',x:'\\sqrt{x}',c:-2,w:1},{l:'∛x',x:'\\sqrt[3]{x}',c:-2,w:1},
            {l:'a/b',x:'\\frac{a}{b}',c:-2,w:1},
            {l:'√(x²+y²)',x:'\\sqrt{x^2+y^2}',w:1},
        ],
        'Grieks':[
            {l:'α',x:'\\alpha'},{l:'β',x:'\\beta'},{l:'γ',x:'\\gamma'},
            {l:'δ',x:'\\delta'},{l:'ε',x:'\\epsilon'},{l:'θ',x:'\\theta'},
            {l:'λ',x:'\\lambda'},{l:'μ',x:'\\mu'},{l:'π',x:'\\pi'},
            {l:'σ',x:'\\sigma'},{l:'φ',x:'\\phi'},{l:'ω',x:'\\omega'},
            {l:'Δ',x:'\\Delta'},{l:'Σ',x:'\\Sigma'},{l:'Ω',x:'\\Omega'},
            {l:'Π',x:'\\Pi'},{l:'Λ',x:'\\Lambda'},
        ],
        'Trig':[
            {l:'sin',x:'\\sin',w:1},{l:'cos',x:'\\cos',w:1},{l:'tan',x:'\\tan',w:1},
            {l:'sin⁻¹',x:'\\arcsin',w:1},{l:'cos⁻¹',x:'\\arccos',w:1},{l:'tan⁻¹',x:'\\arctan',w:1},
            {l:'°',x:'^{\\circ}'},{l:'log',x:'\\log',w:1},{l:'ln',x:'\\ln',w:1},
            {l:'log₂',x:'\\log_2',w:1},{l:'eˣ',x:'e^{x}',w:1},
        ],
        'Analyse':[
            {l:'∫',x:'\\int_{a}^{b}',c:-2,w:1},{l:'d/dx',x:'\\frac{d}{dx}',w:1},
            {l:'∂/∂x',x:'\\frac{\\partial}{\\partial x}',w:1},
            {l:'∑',x:'\\sum_{i=1}^{n}',c:-2,w:1},{l:'∏',x:'\\prod_{i=1}^{n}',c:-2,w:1},
            {l:'lim',x:'\\lim_{x\\to\\infty}',w:1},
            {l:'→',x:'\\rightarrow'},{l:'⇒',x:'\\Rightarrow'},{l:'⟺',x:'\\Leftrightarrow',w:1},
            {l:'∀',x:'\\forall'},{l:'∃',x:'\\exists'},{l:'∈',x:'\\in'},{l:'∉',x:'\\notin'},
            {l:'⊂',x:'\\subset'},{l:'∩',x:'\\cap'},{l:'∪',x:'\\cup'},
        ],
    };

    let _group='Basis', _target=null;

    function _build(){
        if(document.getElementById('math-kb')) return;
        const kb=document.createElement('div'); kb.id='math-kb';
        kb.innerHTML=`
            <div class="mkb-header">
                <div class="mkb-title"><i class="fa-solid fa-square-root-alt" style="color:var(--accent)"></i> Wiskunde Toetsenbord <span style="opacity:.4;font-weight:400;text-transform:none">Alt+M</span></div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="mkb-tabs" id="mkb-tabs"></div>
                    <button class="mkb-close" onclick="window._mathKbClose()"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="mkb-prev" id="mkb-prev"><span style="font-size:.6rem;color:var(--text-muted);flex-shrink:0;">Klik een symbool →</span></div>
            <div class="mkb-keys" id="mkb-keys"></div>
            <div class="mkb-foot">
                <button class="mkb-btn wide" onclick="window._mathKbIns('$$  $$',-3)">$$ blok</button>
                <button class="mkb-btn" onclick="window._mathKbIns('$  $',-2)">$ inline</button>
                <button class="mkb-btn wide" onclick="window._mathKbIns('\\\\begin{cases}  \\\\end{cases}',-13)">cases</button>
                <button class="mkb-btn wide" onclick="window._mathKbIns('\\\\begin{pmatrix}a&b\\\\\\\\c&d\\\\end{pmatrix}')">matrix</button>
                <div style="flex:1"></div>
                <button class="mkb-btn wide" style="background:rgba(239,68,68,.1);color:#f87171;border-color:rgba(239,68,68,.2);" onclick="window._mathKbDel()"><i class="fa-solid fa-delete-left"></i> Del</button>
            </div>`;
        document.body.appendChild(kb);
        _tabs(); _keys();
    }

    function _tabs(){
        const el=document.getElementById('mkb-tabs'); if(!el) return;
        el.innerHTML=Object.keys(GROUPS).map(g=>`<button class="mkb-tab ${g===_group?'active':''}" onclick="window._mathKbGrp('${g}')">${g}</button>`).join('');
    }
    function _keys(){
        const el=document.getElementById('mkb-keys'); if(!el) return;
        el.innerHTML=GROUPS[_group].map(s=>`<button class="mkb-btn${s.w?' wide':''}" title="${s.x}" onclick="window._mathKbIns('${s.x.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}',${s.c||0})">${s.l}</button>`).join('');
    }
    function _preview(latex){
        const p=document.getElementById('mkb-prev'); if(!p||!window.katex) return;
        try{p.innerHTML=`<span style="font-size:.6rem;color:var(--text-muted);flex-shrink:0;">Voorbeeld:</span>`+window.katex.renderToString(latex.replace(/\\\\/g,'\\'),{throwOnError:false,displayMode:false});}
        catch(e){p.textContent=latex;}
    }

    window._mathKbGrp=g=>{_group=g;_tabs();_keys();};
    window._mathKbIns=(x,c=0)=>{
        // Show preview
        try{_preview(x.replace(/\\\\/g,'\\'));}catch(e){}
        if(!_target) return;
        if(_target.tagName==='TEXTAREA'||_target.tagName==='INPUT'){
            const s=_target.selectionStart,e2=_target.selectionEnd,v=_target.value;
            _target.value=v.slice(0,s)+x+v.slice(e2);
            const pos=s+x.length+(c||0);
            _target.setSelectionRange(pos,pos); _target.focus();
            _target.dispatchEvent(new Event('input',{bubbles:true}));
        } else if(_target.contentEditable==='true'){
            _target.focus();
            document.execCommand('insertText',false,`$${x}$`);
        }
    };
    window._mathKbDel=()=>{
        if(!_target) return;
        if(_target.tagName==='TEXTAREA'||_target.tagName==='INPUT'){
            const s=_target.selectionStart; if(!s) return;
            _target.value=_target.value.slice(0,s-1)+_target.value.slice(_target.selectionEnd);
            _target.setSelectionRange(s-1,s-1);
            _target.dispatchEvent(new Event('input',{bubbles:true}));
        } else { _target.focus(); document.execCommand('delete'); }
    };
    window._mathKbClose=()=>{document.getElementById('math-kb')?.classList.remove('open');};
    window._mathKbOpen=(t)=>{
        _build(); if(t) _target=t;
        document.getElementById('math-kb')?.classList.add('open');
    };

    // Track focus
    document.addEventListener('focusin',e=>{
        const el=e.target;
        if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'||el.contentEditable==='true') _target=el;
    });

    // Alt+M shortcut
    document.addEventListener('keydown',e=>{
        if(!e.altKey||e.key.toLowerCase()!=='m') return;
        e.preventDefault();
        const kb=document.getElementById('math-kb');
        if(kb?.classList.contains('open')) window._mathKbClose();
        else window._mathKbOpen(_target||document.getElementById('formula-modal-formula')||document.getElementById('note-editor'));
    });

    // Inject button into notes toolbar + formula modal
    function _injectNoteBtn(){
        const toolbar=document.getElementById('note-toolbar');
        if(!toolbar||toolbar.querySelector('#mkb-note-btn')) return;
        const btn=document.createElement('button');
        btn.id='mkb-note-btn'; btn.className='tbar-dropdown-btn';
        btn.innerHTML='<i class="fa-solid fa-square-root-alt" style="color:var(--accent)"></i> Wiskunde';
        btn.title='Wiskunde toetsenbord (Alt+M)';
        btn.onclick=()=>{
            const ed=document.getElementById('note-editor'); _target=ed;
            const kb=document.getElementById('math-kb');
            if(kb?.classList.contains('open')) window._mathKbClose(); else window._mathKbOpen(ed);
        };
        const div=document.createElement('div'); div.className='note-section-divider';
        const groups=toolbar.querySelectorAll('.tbar-group');
        const last=groups[groups.length-1];
        if(last){last.after(div);div.after(btn);}else{toolbar.append(div,btn);}
    }

    // Hook into openModal to show keyboard for formula modal
    function _patchModal(){
        if(typeof window.openModal!=='function'){setTimeout(_patchModal,200);return;}
        const _o=window.openModal;
        window.openModal=function(id){
            _o(id);
            if(id==='modal-formula'){
                _build();
                setTimeout(()=>{
                    const ta=document.getElementById('formula-modal-formula');
                    if(ta) _target=ta;
                },50);
            }
        };
    }
    _patchModal();

    // Hook into switchTab
    function _patchST(){
        if(typeof window.switchTab!=='function'){setTimeout(_patchST,200);return;}
        const _o=window.switchTab;
        window.switchTab=function(n){
            _o(n);
            if(n==='notes') setTimeout(_injectNoteBtn,100);
            if(n!=='notes'&&n!=='formulas') window._mathKbClose();
        };
    }
    _patchST();
    setTimeout(()=>{_build();_injectNoteBtn();},400);
})();


/* ════════════════════════════════════════════════════════════════
   2. FORUM — search + bookmarks + filter chips
   ════════════════════════════════════════════════════════════════ */
(function forumEnhancements(){
    function _getBM(){try{return JSON.parse(localStorage.getItem('forum_bm')||'[]');}catch(e){return[];}}
    function _setBM(arr){localStorage.setItem('forum_bm',JSON.stringify(arr));}
    window._forumBM=(postId,btn)=>{
        const bm=_getBM();
        const i=bm.indexOf(postId);
        if(i===-1) bm.push(postId); else bm.splice(i,1);
        _setBM(bm);
        const saved=bm.includes(postId);
        btn.classList.toggle('saved',saved);
        btn.innerHTML=`<i class="fa-${saved?'solid':'regular'} fa-bookmark"></i>`;
        window._toast?.(saved?'Post bewaard 🔖':'Bladwijzer verwijderd');
        if(window._forumFilter==='bookmarks') _applyFilters();
    };

    window._forumFilter='all';
    window._forumQ='';

    function _applyFilters(){
        const list=document.getElementById('forum-post-list'); if(!list) return;
        const bm=_getBM();
        let any=false;
        list.querySelectorAll('.forum-post-card').forEach(card=>{
            const title=card.querySelector('.fpc-title')?.textContent?.toLowerCase()||'';
            const body =card.querySelector('.fpc-excerpt')?.textContent?.toLowerCase()||'';
            const id   =card.dataset.pid||'';
            const own  =card.dataset.own==='1';
            const solved=card.classList.contains('solved');
            let show=true;
            const q=window._forumQ;
            if(q&&!title.includes(q)&&!body.includes(q)) show=false;
            if(window._forumFilter==='mine'&&!own)        show=false;
            if(window._forumFilter==='bookmarks'&&!bm.includes(id)) show=false;
            if(window._forumFilter==='unsolved'&&solved)  show=false;
            card.style.display=show?'':'none';
            if(show) any=true;
        });
        // empty state
        let empty=list.querySelector('.p4-empty');
        if(!any&&list.querySelectorAll('.forum-post-card').length){
            if(!empty){empty=document.createElement('div');empty.className='forum-empty p4-empty';list.appendChild(empty);}
            empty.innerHTML=window._forumQ?`<i class="fa-solid fa-magnifying-glass"></i><p>Geen resultaten</p>`:`<i class="fa-solid fa-filter"></i><p>Geen berichten</p>`;
        } else empty?.remove();
    }

    window._forumSetFilter=f=>{
        window._forumFilter=f;
        document.querySelectorAll('.ffc-chip').forEach(c=>c.classList.toggle('active',c.dataset.f===f));
        _applyFilters();
    };

    function _decorateCards(){
        const list=document.getElementById('forum-post-list'); if(!list) return;
        const bm=_getBM();
        list.querySelectorAll('.forum-post-card').forEach(card=>{
            // extract post id
            if(!card.dataset.pid){
                const m=(card.getAttribute('onclick')||'').match(/forumOpenPost\('([^']+)'\)/);
                if(m) card.dataset.pid=m[1];
            }
            // own post?
            if(!card.dataset.ownChecked&&_uid){
                card.dataset.ownChecked='1';
                if(card.querySelector('.fpc-delete')) card.dataset.own='1';
            }
            // bookmark button
            const footer=card.querySelector('.fpc-footer');
            if(footer&&!footer.querySelector('.fpc-bookmark')){
                const pid=card.dataset.pid||'';
                const saved=bm.includes(pid);
                const b=document.createElement('button');
                b.className=`fpc-bookmark${saved?' saved':''}`;
                b.title=saved?'Verwijder bladwijzer':'Bewaar post';
                b.innerHTML=`<i class="fa-${saved?'solid':'regular'} fa-bookmark"></i>`;
                b.onclick=e=>{e.stopPropagation();window._forumBM(pid,b);};
                footer.appendChild(b);
            }
        });
        _applyFilters();
    }

    function _injectUI(){
        const lv=document.getElementById('forum-list-view');
        if(!lv||document.getElementById('forum-search-wrap')) return;
        // Search bar
        const sw=document.createElement('div'); sw.id='forum-search-wrap';
        sw.innerHTML=`<i class="fa-solid fa-magnifying-glass"></i><input id="forum-search-inp" placeholder="Zoek berichten… (druk /)" type="text">`;
        // Filter chips
        const fc=document.createElement('div'); fc.className='forum-filter-chips';
        fc.innerHTML=`
            <button class="ffc-chip active" data-f="all"       onclick="window._forumSetFilter('all')">Alles</button>
            <button class="ffc-chip"        data-f="mine"      onclick="window._forumSetFilter('mine')">Mijn posts</button>
            <button class="ffc-chip"        data-f="bookmarks" onclick="window._forumSetFilter('bookmarks')"><i class="fa-solid fa-bookmark" style="font-size:.6rem;margin-right:3px"></i>Bewaard</button>
            <button class="ffc-chip"        data-f="unsolved"  onclick="window._forumSetFilter('unsolved')">Onopgelost</button>`;
        const subBar=document.getElementById('forum-subject-bar');
        if(subBar){lv.insertBefore(fc,subBar);lv.insertBefore(sw,fc);}
        document.getElementById('forum-search-inp').addEventListener('input',function(){
            window._forumQ=this.value.toLowerCase().trim(); _applyFilters();
        });
    }

    // Hook into forumInit (from forum_fix.js) — runs after it populates the list
    function _patchForumInit(){
        if(typeof window.forumInit!=='function'){setTimeout(_patchForumInit,200);return;}
        const _o=window.forumInit;
        window.forumInit=function(){
            _o();
            _injectUI();
            // After list renders (snapshot is async), decorate cards
            // Use a ONE-SHOT observer on the specific list element only
            const list=document.getElementById('forum-post-list');
            if(list){
                const obs=new MutationObserver(()=>{_decorateCards();});
                obs.observe(list,{childList:true}); // only direct children, no subtree
            }
        };
    }
    _patchForumInit();

    // / to focus search
    document.addEventListener('keydown',e=>{
        if(e.key!=='/'||e.ctrlKey||e.metaKey) return;
        const view=document.getElementById('view-forum');
        if(!view||view.classList.contains('hidden')) return;
        const inp=document.getElementById('forum-search-inp');
        if(inp&&document.activeElement!==inp){e.preventDefault();inp.focus();}
    });

    setTimeout(()=>{_injectUI();_decorateCards();},800);
})();


/* ════════════════════════════════════════════════════════════════
   3. COLLAB — heartbeat + join toast + copy-link button
   ════════════════════════════════════════════════════════════════ */
(function collabPolish(){
    let _hb=null, _prevUsers=[], _lastShareId=null;

    // Single interval — cheap check, only does work when collab is active
    setInterval(async()=>{
        const id=window._collabId;
        if(!id||!_uid) {
            if(_hb){ clearInterval(_hb); _hb=null; _lastShareId=null; }
            document.getElementById('p4-copy-btn')?.style.setProperty('display','none');
            return;
        }
        // Show copy button
        const cb=document.getElementById('p4-copy-btn');
        if(cb) cb.style.display='';

        // Heartbeat every ~20s
        if(_lastShareId!==id){ _lastShareId=id; _sendHeartbeat(id); }
    },3000);

    async function _sendHeartbeat(id){
        if(!_uid||!id) return;
        try{
            await setDoc(doc(_db,'shared_notes',id),{
                activeUsers:arrayUnion(_uname),
            },{merge:true});
        }catch(e){}
        // Re-schedule heartbeat
        clearTimeout(_hb);
        _hb=setTimeout(()=>_sendHeartbeat(id),20000);
    }

    // Join toast — triggered by patches3's avatar bar changes
    // We watch just the avatar bar (small, cheap)
    function _watchAvatarBar(){
        const bar=document.getElementById('collab-users-bar');
        if(!bar){ setTimeout(_watchAvatarBar,1000); return; }
        new MutationObserver(()=>{
            const users=[...bar.querySelectorAll('div[title]')].map(d=>d.title);
            const joined=users.filter(u=>u!==_uname&&!_prevUsers.includes(u));
            joined.forEach(u=>{
                const t=document.createElement('div');
                t.className='collab-join-toast';
                t.innerHTML=`<i class="fa-solid fa-user-plus" style="margin-right:6px"></i>${u} heeft de notitie geopend`;
                document.body.appendChild(t);
                setTimeout(()=>t.remove(),3200);
            });
            _prevUsers=[...users];
        }).observe(bar,{childList:true}); // only direct children — very cheap
    }
    _watchAvatarBar();

    // Copy-link button next to collab btn
    function _injectCopyBtn(){
        const collabBtn=document.getElementById('notes-collab-btn');
        if(!collabBtn||document.getElementById('p4-copy-btn')) return;
        const btn=document.createElement('button');
        btn.id='p4-copy-btn'; btn.className='nt-btn';
        btn.title='Kopieer deellink';
        btn.innerHTML='<i class="fa-regular fa-copy" style="font-size:.7rem"></i>';
        btn.style.display='none';
        btn.onclick=()=>{
            const id=window._collabId; if(!id) return;
            const url=`${location.origin}${location.pathname}?collab=${id}`;
            navigator.clipboard.writeText(url).then(()=>{
                window._toast?.('Link gekopieerd! 🔗');
                btn.innerHTML='<i class="fa-solid fa-check" style="color:#22c55e;font-size:.7rem"></i>';
                setTimeout(()=>btn.innerHTML='<i class="fa-regular fa-copy" style="font-size:.7rem"></i>',1800);
            });
        };
        collabBtn.after(btn);
    }

    function _patchST(){
        if(typeof window.switchTab!=='function'){setTimeout(_patchST,200);return;}
        const _o=window.switchTab;
        window.switchTab=function(n){_o(n);if(n==='notes') setTimeout(_injectCopyBtn,200);};
    }
    _patchST();
    setTimeout(_injectCopyBtn,700);
})();


console.log('[StudentOS patches4 lean] ✓');
