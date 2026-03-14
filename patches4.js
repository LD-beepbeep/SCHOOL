/* ================================================================
   StudentOS — patches4.js
   1. Simple math/symbol picker (Unicode, click-to-insert)
   2. Notes sidebar CSS fix (smooth hide)
   3. Notes toolbar: share button position fix
   4. Grades: small trash icon in card corner
   5. Per-deck flashcard quick import (paste comma/newline list)
   6. Collab avatar bar only shows on notes tab
   7. CSS fixes (search icon, alignment)
   ================================================================ */

/* ════════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════════ */
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
/* Math symbol panel */
.mp-wrap { position:relative; }
#p4-math-panel, .p4-math-panel {
    position:absolute;bottom:calc(100% + 8px);left:0;z-index:200;
    background:var(--bg-color);border:1px solid rgba(255,255,255,.12);
    border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.5);
    padding:12px;width:280px;display:none;flex-direction:column;gap:8px;
}
#p4-math-panel.open, .p4-math-panel.open { display:flex; }
.mp-tabs { display:flex;gap:4px;flex-wrap:wrap; }
.mp-tab { padding:3px 9px;border-radius:8px;border:none;cursor:pointer;
    font-size:.62rem;font-weight:700;background:rgba(255,255,255,.06);
    color:var(--text-muted);transition:all .12s; }
.mp-tab.active { background:var(--accent);color:#fff; }
.mp-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:3px; }
.mp-sym { aspect-ratio:1;border-radius:7px;border:1px solid rgba(255,255,255,.08);
    background:rgba(255,255,255,.05);color:var(--text-main);cursor:pointer;
    font-size:.88rem;display:flex;align-items:center;justify-content:center;
    transition:background .1s,transform .08s; }
.mp-sym:hover { background:var(--accent);color:#fff;transform:scale(1.1); }

/* Notes sidebar */
.notes-layout { transition:grid-template-columns .25s ease !important; }
.notes-layout.sidebar-hidden { grid-template-columns:0px 1fr !important; }
.notes-layout.sidebar-hidden #notes-left-panel {
    overflow:hidden !important;opacity:0 !important;
    pointer-events:none !important;min-width:0 !important; }
#notes-left-panel { transition:opacity .2s !important; }

/* Notes search icon */
#p3-note-search-wrap { position:relative !important; }
#p3-note-search-wrap > i { top:50% !important;transform:translateY(-50%) !important; }

/* Grades delete icon in corner */
.p4-del-sub {
    position:absolute;bottom:10px;right:10px;background:transparent;border:none;
    cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;
    border-radius:7px;opacity:0;transition:opacity .15s,color .15s;z-index:2; }
.p4-del-sub:hover { color:#f87171; }

/* Collab bar only on notes */
#collab-users-bar { display:none !important; }
#collab-users-bar.show { display:flex !important; }

/* Deck import btn */
.p4-deck-imp {
    display:flex;align-items:center;gap:5px;padding:5px 10px;
    border-radius:8px;background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.08);color:var(--text-muted);
    font-size:.68rem;font-weight:700;cursor:pointer;
    transition:background .12s,color .12s;margin-top:4px;width:100%; }
.p4-deck-imp:hover { background:rgba(255,255,255,.1);color:var(--text-main); }

/* Import modal */
#p4-imp-modal { position:fixed;inset:0;z-index:220;
    background:rgba(0,0,0,.65);backdrop-filter:blur(8px);
    display:flex;align-items:center;justify-content:center; }
#p4-imp-box { background:var(--bg-color);border:1px solid rgba(255,255,255,.1);
    border-radius:22px;padding:26px;width:min(460px,96vw);
    box-shadow:0 12px 48px rgba(0,0,0,.5);
    display:flex;flex-direction:column;gap:14px; }
#p4-imp-ta { width:100%;min-height:150px;resize:vertical;
    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
    border-radius:12px;padding:11px 13px;color:var(--text-main);
    font-size:.8rem;font-family:'JetBrains Mono',monospace;
    outline:none;box-sizing:border-box;line-height:1.6;
    transition:border-color .15s; }
#p4-imp-ta:focus { border-color:var(--accent); }
`}));


/* ════════════════════════════════════════════════════════════════
   1. MATH / SYMBOL PICKER
   ════════════════════════════════════════════════════════════════ */
(function symPicker() {
    const G = {
        'Basic':   ['+','−','×','÷','=','≠','≈','±','≤','≥','<','>',
                    '½','⅓','¼','⅔','¾','²','³','⁴','⁵','⁶','⁷','⁸','⁹',
                    '₁','₂','₃','₄','₅','₀','√','∛','∜','%','∞','°'],
        'Greek':   ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ',
                    'ν','ξ','π','ρ','σ','τ','υ','φ','χ','ψ','ω',
                    'Δ','Λ','Π','Σ','Φ','Ψ','Ω'],
        'Arrows':  ['→','←','↑','↓','↔','⇒','⇐','⇔','⟹','⟺','∴','∵'],
        'Sets':    ['∈','∉','⊂','⊃','⊆','⊇','∩','∪','∅','∀','∃','¬'],
        'Calc':    ['∫','∬','∮','∂','∇','∑','∏','lim','d/dx','Δx'],
    };

    let _g = 'Basic';

    function _ins(sym) {
        const el = document.activeElement;
        if (el && (el.tagName==='TEXTAREA'||el.tagName==='INPUT')) {
            const s=el.selectionStart, e=el.selectionEnd;
            el.value=el.value.slice(0,s)+sym+el.value.slice(e);
            el.setSelectionRange(s+sym.length,s+sym.length);
            el.focus();
            el.dispatchEvent(new Event('input',{bubbles:true}));
        } else if (el && el.contentEditable==='true') {
            el.focus(); document.execCommand('insertText',false,sym);
        } else {
            const ta = document.getElementById('formula-modal-formula') ||
                       document.getElementById('note-editor');
            if (!ta) return;
            ta.focus();
            if (ta.tagName==='TEXTAREA') {
                const s=ta.selectionStart;
                ta.value=ta.value.slice(0,s)+sym+ta.value.slice(ta.selectionEnd);
                ta.setSelectionRange(s+sym.length,s+sym.length);
                ta.dispatchEvent(new Event('input',{bubbles:true}));
            } else document.execCommand('insertText',false,sym);
        }
    }

    function _makePanel(id) {
        const panel = document.createElement('div');
        panel.id = id || '';
        panel.className = 'p4-math-panel';

        function _render() {
            panel.innerHTML = '';
            const tabs = document.createElement('div'); tabs.className='mp-tabs';
            Object.keys(G).forEach(gr => {
                const t=document.createElement('button'); t.className=`mp-tab ${gr===_g?'active':''}`;
                t.textContent=gr;
                t.onclick=e=>{e.stopPropagation();_g=gr;
                    panel.querySelectorAll('.mp-tab').forEach(b=>b.classList.toggle('active',b.textContent===gr));
                    renderGrid();};
                tabs.appendChild(t);
            });
            panel.appendChild(tabs);
            const grid=document.createElement('div'); grid.className='mp-grid';
            panel.appendChild(grid);
            renderGrid();
            function renderGrid() {
                grid.innerHTML='';
                G[_g].forEach(sym=>{
                    const b=document.createElement('button'); b.className='mp-sym';
                    b.textContent=sym; b.title=sym;
                    b.onclick=e=>{e.stopPropagation();_ins(sym);};
                    grid.appendChild(b);
                });
            }
        }
        _render();
        return panel;
    }

    /* Close all panels on outside click */
    document.addEventListener('click',()=>
        document.querySelectorAll('.p4-math-panel.open').forEach(p=>p.classList.remove('open'))
    );

    /* ── Inject into formula modal ── */
    function _addToFormulaModal() {
        const ta=document.getElementById('formula-modal-formula');
        if (!ta||ta.dataset.p4s) return;
        ta.dataset.p4s='1';

        const wrap=document.createElement('div'); wrap.className='mp-wrap';
        wrap.style.cssText='position:relative;margin-bottom:8px;';

        const btn=document.createElement('button');
        btn.style.cssText='display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:var(--text-muted);font-size:.72rem;font-weight:700;cursor:pointer;transition:background .12s,color .12s;width:100%;';
        btn.innerHTML='<i class="fa-solid fa-omega" style="color:var(--accent)"></i> Insert symbol…';
        btn.onmouseenter=()=>{btn.style.background='rgba(255,255,255,.1)';btn.style.color='var(--text-main)';};
        btn.onmouseleave=()=>{btn.style.background='rgba(255,255,255,.06)';btn.style.color='var(--text-muted)';};

        const panel=_makePanel();
        btn.onclick=e=>{e.stopPropagation();panel.classList.toggle('open');};
        wrap.appendChild(btn); wrap.appendChild(panel);
        ta.parentNode.insertBefore(wrap,ta);
    }

    /* ── Inject into notes toolbar ── */
    function _addToNotesToolbar() {
        const tb=document.getElementById('note-toolbar');
        if (!tb||tb.querySelector('#p4-sym-tb-btn')) return;

        const btn=document.createElement('button');
        btn.id='p4-sym-tb-btn'; btn.className='tbar-dropdown-btn mp-wrap';
        btn.style.position='relative';
        btn.innerHTML='<i class="fa-solid fa-omega" style="color:var(--accent);font-size:.7rem"></i> Ω';
        btn.title='Insert symbol';

        const panel=_makePanel();
        panel.style.left='0'; panel.style.transform='none';
        btn.appendChild(panel);

        btn.onclick=e=>{e.stopPropagation();panel.classList.toggle('open');};

        const groups=tb.querySelectorAll('.tbar-group');
        const last=groups[groups.length-1];
        if (last) { const d=document.createElement('div');d.className='note-section-divider';last.after(d);d.after(btn); }
    }

    function _patchOM(){
        if(typeof window.openModal!=='function'){setTimeout(_patchOM,200);return;}
        if(window._p4OMp) return; window._p4OMp=true;
        const _o=window.openModal;
        window.openModal=function(id){_o(id);if(id==='modal-formula')setTimeout(_addToFormulaModal,40);};
    }
    _patchOM();

    function _patchST(){
        if(typeof window.switchTab!=='function'){setTimeout(_patchST,200);return;}
        if(window._p4STsp) return; window._p4STsp=true;
        const _o=window.switchTab;
        window.switchTab=function(n){_o(n);if(n==='notes')setTimeout(_addToNotesToolbar,120);};
    }
    _patchST();
    setTimeout(_addToNotesToolbar,500);
})();


/* ════════════════════════════════════════════════════════════════
   2. NOTES SIDEBAR Ctrl+\ shortcut
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='\\'){e.preventDefault();window.toggleNotesSidebar?.();}
});
setTimeout(()=>{
    const b=document.getElementById('notes-sidebar-toggle-btn');
    if(b) b.title='Toggle sidebar (Ctrl+\\)';
},500);


/* ════════════════════════════════════════════════════════════════
   3. NOTES TOOLBAR — move collab share btn to rightmost position
   ════════════════════════════════════════════════════════════════ */
(function fixCollabBtnPosition(){
    function _fix(){
        const rightDiv=document.querySelector('#note-toolbar .ml-auto');
        const collabBtn=document.getElementById('notes-collab-btn');
        if(!rightDiv||!collabBtn) return;
        if(rightDiv.contains(collabBtn)) return;
        rightDiv.insertBefore(collabBtn,rightDiv.firstChild);
    }
    function _pt(){
        if(typeof window.switchTab!=='function'){setTimeout(_pt,200);return;}
        const _o=window.switchTab;
        window.switchTab=function(n){_o(n);if(n==='notes')setTimeout(_fix,150);};
    }
    _pt(); setTimeout(_fix,700);
})();


/* ════════════════════════════════════════════════════════════════
   4. GRADES — small trash in card corner, hide text delete button
   ════════════════════════════════════════════════════════════════ */
(function gradeTrash(){
    function _inject(){
        const c=document.getElementById('subjects-container'); if(!c) return;
        Array.from(c.children).forEach(card=>{
            if(card.querySelector('.p4-del-sub')) return;
            const textDel=card.querySelector('button[onclick*="deleteSubject"]');
            if(!textDel) return;
            const m=textDel.getAttribute('onclick')?.match(/deleteSubject\((\d+)\)/);
            if(!m) return;
            textDel.style.display='none';
            card.style.position='relative';
            const btn=document.createElement('button');
            btn.className='p4-del-sub'; btn.innerHTML='<i class="fa-solid fa-trash"></i>';
            btn.title='Delete subject';
            btn.onclick=e=>{e.stopPropagation();if(typeof window.deleteSubject==='function')window.deleteSubject(parseInt(m[1]));};
            card.onmouseenter=()=>btn.style.opacity='1';
            card.onmouseleave=()=>btn.style.opacity='0';
            card.appendChild(btn);
        });
    }
    function _pRG(){
        if(typeof window.renderGrades!=='function'){setTimeout(_pRG,200);return;}
        if(window._p4rgp) return; window._p4rgp=true;
        const _o=window.renderGrades;
        window.renderGrades=function(){_o.apply(this,arguments);setTimeout(_inject,40);};
        setTimeout(_inject,700);
    }
    _pRG();
})();


/* ════════════════════════════════════════════════════════════════
   5. PER-DECK QUICK IMPORT
   One card per line: term, definition  OR  term - definition  OR tab
   ════════════════════════════════════════════════════════════════ */
(function deckImport(){
    function _parse(text){
        return text.split('\n').map(l=>l.trim()).filter(Boolean).map(line=>{
            let q,a;
            if(line.includes('\t')){[q,...a]=line.split('\t');a=a.join('\t').trim();}
            else if(/ - /.test(line)){const i=line.indexOf(' - ');q=line.slice(0,i);a=line.slice(i+3);}
            else if(line.includes(',')){const i=line.indexOf(',');q=line.slice(0,i);a=line.slice(i+1);}
            else{q=line;a='';}
            return{q:q?.trim()||'',a:a?.trim()||''};
        }).filter(c=>c.q);
    }

    function _doImport(deckId,cards){
        try{
            let decks=typeof window.DB!=='undefined'
                ?window.DB.get('os_decks',[])
                :JSON.parse(localStorage.getItem('os_decks')||'[]');
            const deck=decks.find(d=>d.id===deckId); if(!deck) return;
            if(!deck.cards) deck.cards=[];
            const now=Date.now();
            cards.forEach((c,i)=>deck.cards.push({id:now+i,question:c.q,answer:c.a,hint:'',hard:false,starred:false}));
            if(typeof window.DB!=='undefined') window.DB.set('os_decks',decks);
            else localStorage.setItem('os_decks',JSON.stringify(decks));
            window.renderDecks?.(); window.updateDashWidgets?.();
        }catch(e){console.error('[p4]import',e);}
    }

    function _modal(deckId,deckName){
        document.getElementById('p4-imp-modal')?.remove();
        const m=document.createElement('div'); m.id='p4-imp-modal';
        m.innerHTML=`<div id="p4-imp-box">
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-file-import" style="color:var(--accent)"></i>
                <h3 style="font-size:.95rem;font-weight:700;margin:0;">Import into "${deckName}"</h3>
                <button id="p4-ic" style="margin-left:auto;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:.85rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:.72rem;color:var(--text-muted);margin:0;line-height:1.6;">One card per line. Separate term and definition with a <strong>comma</strong>, <strong> - </strong>, or <strong>tab</strong>.</p>
            <textarea id="p4-imp-ta" placeholder="Photosynthesis, process plants use to make food&#10;Mitosis - cell division&#10;DNA&#9;deoxyribonucleic acid"></textarea>
            <div id="p4-ip" style="font-size:.7rem;color:var(--text-muted);min-height:16px;"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button id="p4-ix" style="padding:8px 16px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--text-muted);font-size:.78rem;font-weight:600;cursor:pointer;">Cancel</button>
                <button id="p4-is" style="padding:8px 18px;border-radius:10px;background:var(--accent);color:#fff;font-size:.78rem;font-weight:700;border:none;cursor:pointer;">Import cards</button>
            </div>
        </div>`;
        document.body.appendChild(m);
        const ta=document.getElementById('p4-imp-ta');
        const prev=document.getElementById('p4-ip');
        ta.addEventListener('input',()=>{const n=_parse(ta.value).length;prev.textContent=n?`${n} card${n===1?'':'s'} detected`:'';});
        m.querySelector('#p4-ic').onclick=()=>m.remove();
        m.querySelector('#p4-ix').onclick=()=>m.remove();
        m.onclick=e=>{if(e.target===m)m.remove();};
        m.querySelector('#p4-is').onclick=()=>{
            const cards=_parse(ta.value);
            if(!cards.length){prev.textContent='No valid cards found.';prev.style.color='#f87171';return;}
            _doImport(deckId,cards);
            m.remove();
            window._toast?.(`Imported ${cards.length} card${cards.length===1?'':'s'} ✓`);
        };
        setTimeout(()=>ta.focus(),40);
    }

    function _injectBtns(){
        document.querySelectorAll('[onclick*="openDeck"]').forEach(card=>{
            if(card.querySelector('.p4-deck-imp')) return;
            const mm=card.getAttribute('onclick')?.match(/openDeck\((\d+)\)/); if(!mm) return;
            const deckId=parseInt(mm[1]);
            let deckName='Deck';
            try{
                const decks=typeof window.DB!=='undefined'?window.DB.get('os_decks',[]):JSON.parse(localStorage.getItem('os_decks')||'[]');
                deckName=decks.find(d=>d.id===deckId)?.name||'Deck';
            }catch(e){}
            const btn=document.createElement('button');
            btn.className='p4-deck-imp';
            btn.innerHTML='<i class="fa-solid fa-file-import"></i> Quick import';
            btn.onclick=e=>{e.stopPropagation();_modal(deckId,deckName);};
            card.appendChild(btn);
        });
    }

    function _pRD(){
        if(typeof window.renderDecks!=='function'){setTimeout(_pRD,200);return;}
        if(window._p4rdp) return; window._p4rdp=true;
        const _o=window.renderDecks;
        window.renderDecks=function(){_o.apply(this,arguments);setTimeout(_injectBtns,60);};
        setTimeout(_injectBtns,700);
    }
    _pRD();
})();


/* ════════════════════════════════════════════════════════════════
   6. COLLAB AVATAR BAR — only visible on notes tab
   ════════════════════════════════════════════════════════════════ */
(function collabVisibility(){
    function _upd(tab){
        const bar=document.getElementById('collab-users-bar'); if(!bar) return;
        bar.classList.toggle('show', tab==='notes' && !!window._collabId);
    }
    function _pt(){
        if(typeof window.switchTab!=='function'){setTimeout(_pt,200);return;}
        if(window._p4cvp) return; window._p4cvp=true;
        const _o=window.switchTab;
        window.switchTab=function(n){_o(n);_upd(n);};
    }
    _pt();
    setInterval(()=>{
        const hidden=document.getElementById('view-notes')?.classList.contains('hidden');
        const bar=document.getElementById('collab-users-bar'); if(!bar) return;
        bar.classList.toggle('show',!hidden&&!!window._collabId);
    },2000);
})();


/* ════════════════════════════════════════════════════════════════
   TOAST fallback
   ════════════════════════════════════════════════════════════════ */
if(!window._toast){
    window._toast=(msg,isErr=false)=>{
        const t=document.getElementById('sos-toast'); if(!t) return;
        t.textContent=msg;t.style.background=isErr?'#ef4444':'';
        t.classList.add('show');setTimeout(()=>{t.classList.remove('show');t.style.background='';},2200);
    };
}

console.log('[StudentOS patches4] ✓');
