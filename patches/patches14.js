/* ================================================================
   StudentOS — patches14.js (Final Unified Version)
   ================================================================ */

import { getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, updateDoc, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _db = null, _uid = null;
(function _boot() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_boot, 200); return; }
    _db = getFirestore(apps[0]);
    onAuthStateChanged(getAuth(apps[0]), u => { _uid = u ? u.uid : null; });
})();

/* ── helpers ── */
const _lsG = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const _lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _dbG = (k, d) => { try { return window.DB?.get ? window.DB.get(k, d) : _lsG(k, d); } catch { return d; } };
const _dbS = (k, v) => { window.DB?.set ? window.DB.set(k, v) : _lsS(k, v); };
const _toast = msg => { const t=document.getElementById('sos-toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); };
const _localDate = (d = new Date()) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

/* ================================================================
   1. SIDEBAR SEARCH
   ================================================================ */
function _fixSearch() {
    document.getElementById('p12-nav-search')?.remove();
    if (document.getElementById('p14-nav-search')) return;
    const col = document.querySelector('nav .flex.flex-col');
    if (!col) return;
    const btn = document.createElement('button');
    btn.id = 'p14-nav-search';
    btn.setAttribute('data-tooltip','Search');
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
    btn.onclick = () => typeof window._p11openSearch==='function' ? window._p11openSearch() : document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
    col.insertBefore(btn, col.firstChild);
}



/* ================================================================
   3. AVATAR
   ================================================================ */
function _fixAvatarSize(el) {
    if (!el) return;
    el.style.setProperty('width',  '96px','important');
    el.style.setProperty('height', '96px','important');
    el.style.setProperty('border-radius','22px','important');
    el.style.setProperty('overflow','hidden','important');
    el.style.setProperty('flex-shrink','0','important');
    if (!el.querySelector('img')) el.style.setProperty('font-size','2.8rem','important');
}
function _patchAvatarSync() {
    function _try() {
        if (typeof window._p10syncAvatar !== 'function' || window._p14_avPatch) { setTimeout(_try,400); return; }
        window._p14_avPatch = true;
        const _orig = window._p10syncAvatar;
        window._p10syncAvatar = function() { _orig(); _fixAvatarSize(document.getElementById('avatar-preview')); _fixAvatarSize(document.getElementById('p10-avatar-preview-tab')); };
    }
    _try();
    function _tryRPD() {
        if (typeof window.renderProfileDisplay !== 'function' || window._p14_rpdPatch) { setTimeout(_tryRPD,400); return; }
        window._p14_rpdPatch = true;
        const _orig = window.renderProfileDisplay;
        window.renderProfileDisplay = function() {
            _orig(); _fixAvatarSize(document.getElementById('avatar-preview'));
            const src=document.getElementById('avatar-preview'), dest=document.getElementById('p10-avatar-preview-tab');
            if (src && dest) { dest.innerHTML=src.innerHTML; dest.style.background=src.style.background||''; _fixAvatarSize(dest); }
        };
        window.renderProfileDisplay();
    }
    _tryRPD();
}

/* ================================================================
   4. FORUM DISPLAY NAME
   ================================================================ */
function _getDisplayName() { return _dbG('os_name','').trim() || document.querySelector('#profile-name-input')?.value?.trim() || 'Student'; }
function _replaceForumSubmitPost() {
    function _try() {
        if (typeof window.forumSubmitPost!=='function'||window._p14_fspDone){ setTimeout(_try,500); return; }
        window._p14_fspDone = true;
        window.forumSubmitPost = async function() {
            if (!_db||!_uid) { _toast('Not logged in'); return; }
            const tEl=document.getElementById('forum-new-title'), bEl=document.getElementById('forum-new-body'), sEl=document.getElementById('forum-new-subject'), errEl=document.getElementById('forum-new-error'), btn=document.getElementById('forum-submit-btn');
            const title=(tEl?.value||'').trim(), body=(bEl?.value||'').trim();
            if(!title){if(errEl)errEl.textContent='Add a title'; tEl?.focus(); return;}
            if(!body) {if(errEl)errEl.textContent='Describe your question'; bEl?.focus(); return;}
            if(errEl) errEl.textContent='';
            if(btn){btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Posting…';}
            try {
                await addDoc(collection(_db,'forum_posts'),{ uid:_uid, displayName:_getDisplayName(), title, body, subject:sEl?.value||'other', upvotes:[], upvoteCount:0, replyCount:0, solved:false, createdAt:serverTimestamp() });
                if(tEl) tEl.value=''; if(bEl) bEl.value='';
                document.getElementById('forum-new-panel')?.classList.add('hidden');
                document.getElementById('forum-fab')?.classList.remove('hidden');
                _toast('Question posted ✓');
            } catch(e) { if(errEl) errEl.textContent='Post failed.'; }
            if(btn){btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Place a question';}
        };
    }
    _try();
}
function _replaceForumSubmitReply() {
    function _try() {
        if (typeof window.forumSubmitReply!=='function'||window._p14_fsrDone){ setTimeout(_try,500); return; }
        window._p14_fsrDone = true;
        window.forumSubmitReply = async function() {
            if (!_db||!_uid) { _toast('Not logged in'); return; }
            const postId = window._p14_activePost; if (!postId) return;
            const bEl=document.getElementById('forum-reply-input'), errEl=document.getElementById('forum-reply-error'), btn=document.getElementById('forum-reply-btn');
            const body=(bEl?.value||'').trim();
            if(!body){if(errEl)errEl.textContent='Write something first.'; bEl?.focus(); return;}
            if(errEl)errEl.textContent='';
            if(btn){btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';}
            try {
                await addDoc(collection(_db,'forum_posts',postId,'replies'),{ uid:_uid, displayName:_getDisplayName(), body, isAnswer:false, createdAt:serverTimestamp() });
                updateDoc(doc(_db,'forum_posts',postId),{replyCount:increment(1)}).catch(()=>{});
                if(bEl) bEl.value=''; _toast('Reply posted ✓');
            } catch(e) { if(errEl) errEl.textContent='Reply failed.'; }
            if(btn){btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-reply"></i> Reply';}
        };
    }
    _try();
}
function _trackActivePost() {
    function _try() {
        if (typeof window.forumOpenPost!=='function'||window._p14_fopDone){ setTimeout(_try,500); return; }
        window._p14_fopDone = true;
        const _orig = window.forumOpenPost;
        window.forumOpenPost = function(postId) { window._p14_activePost = postId; return _orig(postId); };
    }
    _try();
}
function _replaceSrSubmit() {
    function _try() {
        if (typeof window._srSubmit!=='function'||window._p14_srDone){ setTimeout(_try,600); return; }
        window._p14_srDone = true;
        window._srSubmit = async function(postId, parentReplyId) {
            if (!_db||!_uid) { alert('Please log in.'); return; }
            const ta=document.getElementById('srta-'+parentReplyId), btn=document.getElementById('srbtn-'+parentReplyId);
            if (!ta) return; const body = ta.value.trim(); if (!body) { ta.focus(); return; }
            if (btn) { btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>'; }
            try {
                await addDoc(collection(_db,'forum_posts',postId,'replies'),{ uid:_uid, displayName:_getDisplayName(), body, parentReplyId, isAnswer:false, createdAt:serverTimestamp() });
                updateDoc(doc(_db,'forum_posts',postId),{replyCount:increment(1)}).catch(()=>{});
                ta.value=''; document.querySelectorAll('[id^="srbox-"]').forEach(b=>b.style.display='none');
            } catch(e) { alert('Reply failed.'); }
            if (btn) { btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Reply'; }
        };
    }
    _try();
}
function _forumNameHint() {
    function _try() {
        const panel=document.getElementById('forum-new-panel');
        if(!panel||document.getElementById('p14-fhint')){ setTimeout(_try,800); return; }
        const h=document.createElement('div'); h.id='p14-fhint';
        h.style.cssText='font-size:.72rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;';
        h.innerHTML=`<i class="fa-solid fa-user" style="color:var(--accent);font-size:.7rem;"></i> Posting as <strong id="p14-fhint-name" style="color:var(--text-main);margin-left:2px;">${_getDisplayName()}</strong>`;
        document.getElementById('forum-new-title')?.insertAdjacentElement('beforebegin',h);
    }
    setTimeout(_try,1500);
    document.addEventListener('click',e=>{ if(e.target?.closest?.('#forum-fab')) setTimeout(_forumNameHint,200); });
}

/* ================================================================
   5. TASK DRAG & DROP
   ================================================================ */
let _dragSrc = null;
function _addHandles() {
    document.querySelectorAll('#full-task-list .task-row').forEach(row => {
        if (row.dataset.p14h) return;
        row.dataset.p14h = '1'; row.draggable = true;
        const inner = row.querySelector('.flex.items-center.gap-3');
        if (inner && !inner.querySelector('.task-drag-handle')) {
            const h=document.createElement('span'); h.className='task-drag-handle'; h.innerHTML='<i class="fa-solid fa-grip-vertical"></i>'; inner.insertBefore(h,inner.firstChild);
        }
        row.addEventListener('dragstart',e=>{_dragSrc=row; row.classList.add('p14-dragging'); e.dataTransfer.effectAllowed='move';});
        row.addEventListener('dragend',()=>{ row.classList.remove('p14-dragging'); document.querySelectorAll('.task-row').forEach(r=>r.classList.remove('p14-drag-over')); _dragSrc=null; _saveOrder(); });
        row.addEventListener('dragover',e=>{ e.preventDefault(); if(_dragSrc&&_dragSrc!==row) row.classList.add('p14-drag-over'); });
        row.addEventListener('dragleave',()=>row.classList.remove('p14-drag-over'));
        row.addEventListener('drop',e=>{ e.preventDefault(); row.classList.remove('p14-drag-over'); if(!_dragSrc||_dragSrc===row)return; const p=row.parentNode,kids=[...p.children]; if(kids.indexOf(_dragSrc)<kids.indexOf(row)) p.insertBefore(_dragSrc,row.nextSibling); else p.insertBefore(_dragSrc,row); });
    });
}
function _saveOrder() {
    const list=document.getElementById('full-task-list'); if(!list)return;
    const order=[...list.querySelectorAll('.task-row')].map(r=>parseInt(r.id.replace('task-row-',''))).filter(n=>!isNaN(n));
    if(order.length) _dbS('os_task_order',order);
}
function _patchRenderTasks() {
    function _try() {
        if(typeof window.renderTasks!=='function'||window._p14_rtDone){ setTimeout(_try,400); return; }
        window._p14_rtDone = true;
        const _orig=window.renderTasks;
        window.renderTasks = function() {
            const order=_dbG('os_task_order',null);
            if(order?.length && typeof tasks!=='undefined'){
                const m={}; tasks.forEach(t=>m[t.id]=t);
                const s=[]; order.forEach(id=>{if(m[id])s.push(m[id]);}); tasks.forEach(t=>{if(!order.includes(t.id))s.push(t);});
                tasks.length=0; s.forEach(t=>tasks.push(t));
            }
            _orig(); setTimeout(_addHandles,40);
        };
    }
    setTimeout(_try,900);
}

/* ================================================================
   6. STUDY HABITS (Restored logic + CSS injection)
   ================================================================ */
function _getHabits() { return _dbG('os_habit_log',null) || _lsG('p9_habits',[]); }
function _streak(data) {
    if(!data.length) return 0;
    let s=0, check=_localDate();
    for(const d of [...data].sort().reverse()){
        if(d===check){ s++; const dt=new Date(check+'T12:00:00'); dt.setDate(dt.getDate()-1); check=_localDate(dt); }
        else if(d<check) break;
    }
    return s;
}
function _renderHabits(el) {
    if(!el) return;
    const data=_getHabits(), today=_localDate(), done=data.includes(today), s=_streak(data);
    const ws=_lsG('p9_week_start','mon'), sdow=ws==='sun'?0:1;
    const labels=ws==='sun'?['Su','Mo','Tu','We','Th','Fr','Sa']:['Mo','Tu','We','Th','Fr','Sa','Su'];
    const now=new Date(), dayOfWeek=now.getDay(), back=(dayOfWeek-sdow+7)%7;
    const start=new Date(now); start.setDate(now.getDate()-back);
    const week=Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); const ds=_localDate(d); return{ds,done:data.includes(ds),isToday:ds===today,lbl:labels[i]}; });
    const wDone=week.filter(d=>d.done).length;
    let mx=0,cur=0;
    [...data].sort().forEach((d,i,a)=>{ cur = i&&Math.round((new Date(d+'T12:00:00')-new Date(a[i-1]+'T12:00:00'))/86400000)===1?cur+1:1; mx=Math.max(mx,cur); });
    el.innerHTML=`
        <div class="p14-hstats">
            <div class="p14-hstat"><span class="p14-hnum">${s}</span><span class="p14-hlbl">streak</span></div>
            <div class="p14-hstat"><span class="p14-hnum">${mx}</span><span class="p14-hlbl">best</span></div>
            <div class="p14-hstat"><span class="p14-hnum">${data.length}</span><span class="p14-hlbl">total</span></div>
        </div>
        <div class="p14-hweek">${week.map(d=>`<div class="p14-hwcol"><div class="p14-hwdot${d.done?' done':''}${d.isToday?' today':''}" title="${d.ds}"></div><span class="p14-hwlbl">${d.lbl}</span></div>`).join('')}</div>
        <div class="p14-hprog"><div class="p14-htrack"><div class="p14-hfill" style="width:${Math.round(wDone/7*100)}%"></div></div><span class="p14-hplbl">${wDone}/7 this week</span></div>
        <button class="p14-hbtn${done?' done':''}" onclick="_p14hcheck(this)" ${done?'disabled':''}>
            ${done?'<i class="fa-solid fa-circle-check"></i> Studied today':'<i class="fa-solid fa-circle-plus"></i> Log today as studied'}
        </button>`;
}
window._p14hcheck = function(btn) {
    const today=_localDate(), data=_getHabits();
    if(data.includes(today)) return;
    data.push(today); _lsS('p9_habits',data); _dbS('os_habit_log',data);
    const inner=btn.closest('#widget-habits')?.querySelector('.habit-inner');
    if(inner) _renderHabits(inner);
    _toast(`Day ${_streak(data)} — keep it up!`);
};
window._p9HabitCheck = window._p14hcheck;

function _upgradeHabits() {
    // Force habit CSS to load to prevent widget glitch
    if (!document.getElementById('p14-habits-style')) {
        const style = document.createElement('style');
        style.id = 'p14-habits-style';
        style.innerHTML = `
            .p14-hstats { display:flex; gap:6px; }
            .p14-hstat  { flex:1; padding:9px 10px; border-radius:10px; display:flex; flex-direction:column; gap:2px; background:color-mix(in srgb,var(--accent) 8%,transparent); border:1px solid color-mix(in srgb,var(--accent) 16%,transparent); }
            .p14-hnum   { font-size:1.3rem; font-weight:800; color:var(--accent); line-height:1; }
            .p14-hlbl   { font-size:.58rem; color:var(--text-muted); font-weight:600; }
            .p14-hweek  { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
            .p14-hwcol  { display:flex; flex-direction:column; align-items:center; gap:3px; }
            .p14-hwlbl  { font-size:.55rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; }
            .p14-hwdot  { width:100%; aspect-ratio:1; border-radius:5px; background:var(--glass-hover); border:1px solid rgba(255,255,255,.06); transition:all .2s; }
            .p14-hwdot.done   { background:var(--accent); border-color:transparent; }
            .p14-hwdot.today  { border:2px solid var(--accent) !important; }
            .p14-hprog { display:flex; align-items:center; gap:8px; }
            .p14-htrack{ flex:1; height:4px; border-radius:99px; background:var(--glass-hover); overflow:hidden; }
            .p14-hfill { height:100%; border-radius:99px; background:var(--accent); transition:width .4s; }
            .p14-hplbl { font-size:.62rem; font-weight:700; color:var(--text-muted); white-space:nowrap; }
            .p14-hbtn  { width:100%; padding:9px; border-radius:10px; background:color-mix(in srgb,var(--accent) 10%,transparent); border:1px solid color-mix(in srgb,var(--accent) 20%,transparent); color:var(--accent); font-size:.78rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
            .p14-hbtn.done { background:rgba(34,197,94,.09); border-color:rgba(34,197,94,.2); color:#22c55e; cursor:default; }
        `;
        document.head.appendChild(style);
    }

    function _try(){ const w=document.getElementById('widget-habits'); if(!w){setTimeout(_try,900);return;} let inner=w.querySelector('.habit-inner'); if(!inner){inner=w.querySelector('[style*="flex:1"]'); if(inner){inner.className='habit-inner';inner.removeAttribute('style');}} if(inner)_renderHabits(inner); }
    setTimeout(_try,1200);
    function _pDash(){ if(typeof window.updateDashWidgets!=='function'||window._p14_ddp){setTimeout(_pDash,500);return;} window._p14_ddp=true; const o=window.updateDashWidgets; window.updateDashWidgets=function(){o();const i=document.querySelector('#widget-habits .habit-inner');if(i)(window._renderHabits||_renderHabits)(i);}; }
    _pDash();
}

/* ================================================================
   7. RE-RENDERS
   ================================================================ */
function _patchRerenders() {
    function _tryName(){ if(typeof window.setStudentName!=='function'||window._p14_snDone){setTimeout(_tryName,400);return;} window._p14_snDone=true; const o=window.setStudentName; window.setStudentName=function(v){o(v);if(typeof window.updateGreeting==='function')window.updateGreeting();const s=document.getElementById('p14-fhint-name');if(s)s.textContent=v||'Student';}; }
    _tryName();
    function _trySwitch(){ if(typeof window.switchTab!=='function'||window._p14_stDone){setTimeout(_trySwitch,400);return;} window._p14_stDone=true; const o=window.switchTab; window.switchTab=function(n){o(n);document.body.className=document.body.className.replace(/\bp11-tab-\S+/g,'').trim();document.body.classList.add('p11-tab-'+n);if(n==='dashboard'){setTimeout(()=>{const i=document.querySelector('#widget-habits .habit-inner');if(i)(window._renderHabits||_renderHabits)(i);},80);}if(n==='settings')setTimeout(()=>{_fixAvatarSize(document.getElementById('avatar-preview'));_fixAvatarSize(document.getElementById('p10-avatar-preview-tab'));},300);}; }
    _trySwitch();
}

/* ================================================================
   8. SETTINGS & CONFETTI
   ================================================================ */
let _syncT=null;
function _qSync(){clearTimeout(_syncT);_syncT=setTimeout(()=>{if(!window.DB?.set)return;const b={};['p12_confetti_task','p12_confirm_task','p12_greeting_name','p12_clock_fmt','p12_hide_clock','p12_hide_streak','p12_radius','p12_sidebar_pos','p12_nav_size','p12_widget_gap','p12_status_msg','p12_custom_css','p13_font','p13_line_height','p13_bg_image','p13_bg_opacity','p13_widget_border','p13_task_style','p13_blur','p13_shadow','p13_confetti_style'].forEach(k=>{try{const v=localStorage.getItem(k);if(v!==null)b[k]=JSON.parse(v);}catch{}});if(Object.keys(b).length)window.DB.set('os_personalise',b);},1500);}
function _restorePersonalise(){function _t(){if(!window.DB?.get){setTimeout(_t,800);return;}const b=window.DB.get('os_personalise',null);if(!b)return;let n=0;Object.entries(b).forEach(([k,v])=>{if(localStorage.getItem(k)===null){try{localStorage.setItem(k,JSON.stringify(v));n++;}catch{}}});}_setTimeout(_t,1800);}
function _wrapLS(){if(window._p14_lsw)return;window._p14_lsw=true;const o=localStorage.setItem.bind(localStorage);localStorage.setItem=function(k,v){o(k,v);if(typeof k==='string'&&(k.startsWith('p12_')||k.startsWith('p13_')||k.startsWith('wp_')))_qSync();};}
function _patchConfetti(){function _t(){if(typeof window._p11fireConfetti!=='function'||window._p14_cfDone){setTimeout(_t,600);return;}window._p14_cfDone=true;window._p11fireConfetti=function(){let c=document.getElementById('p11-confetti-canvas');if(!c){c=document.createElement('canvas');c.id='p11-confetti-canvas';document.body.appendChild(c);}const ctx=c.getContext('2d');c.width=window.innerWidth;c.height=window.innerHeight;const acc=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#3b82f6';const cols=[acc,'#22c55e','#f59e0b','#ec4899','#8b5cf6','#fff'];const style=_lsG('p13_confetti_style','circles');const n=style==='emoji'?50:140;const ps=Array.from({length:n},()=>({x:Math.random()*c.width,y:-(Math.random()*200+20),r:Math.random()*7+3,sp:Math.random()*3+1.5,col:cols[Math.floor(Math.random()*cols.length)],ta:0,ts:Math.random()*.12+.04,vx:(Math.random()-.5)*3,em:['🎉','✨','🌟','🥳'][Math.floor(Math.random()*4)]}));let f=0;function draw(){ctx.clearRect(0,0,c.width,c.height);ps.forEach(p=>{ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.ta);if(style==='stars'){ctx.fillStyle=p.col;ctx.beginPath();for(let i=0;i<5;i++){const a1=i*4*Math.PI/5-Math.PI/2,a2=(i*4+2)*Math.PI/5-Math.PI/2;if(i===0)ctx.moveTo(Math.cos(a1)*p.r*1.4,Math.sin(a1)*p.r*1.4);else ctx.lineTo(Math.cos(a1)*p.r*1.4,Math.sin(a1)*p.r*1.4);ctx.lineTo(Math.cos(a2)*p.r*.55,Math.sin(a2)*p.r*.55);}ctx.closePath();ctx.fill();}else if(style==='emoji'){ctx.font=`${Math.floor(p.r*3.2)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.em,0,0);}else if(style==='bubbles'){ctx.strokeStyle=p.col;ctx.lineWidth=1.8;ctx.globalAlpha=.75;ctx.beginPath();ctx.arc(0,0,p.r*1.2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}else{ctx.fillStyle=p.col;ctx.beginPath();ctx.ellipse(0,0,p.r,p.r*.5,0,0,Math.PI*2);ctx.fill();}ctx.restore();p.y+=p.sp;p.x+=p.vx;p.ta+=p.ts;if(p.y>c.height+30){p.y=-30;p.x=Math.random()*c.width;}});f++;if(f<200)requestAnimationFrame(draw);else ctx.clearRect(0,0,c.width,c.height);}draw();};}_t();}

function _setTimeout(fn, ms) { setTimeout(fn, ms); }

/* ================================================================
   INIT
   ================================================================ */
(function init() {
    const go = () => {
        _fixSearch();
        setTimeout(_fixSearch, 800);
        _watchWgtModal();
        _patchAvatarSync();
        _replaceForumSubmitPost();
        _replaceForumSubmitReply();
        _trackActivePost();
        _replaceSrSubmit();
        _forumNameHint();
        _patchRenderTasks();
        _upgradeHabits();
        _patchRerenders();
        _patchConfetti();
        _wrapLS();
        _restorePersonalise();
        setTimeout(()=>{ if(window.DB?.get&&!window.DB.get('os_habit_log',null)){const d=_lsG('p9_habits',[]); if(d.length)window.DB.set('os_habit_log',d);}},2500);
    };
    document.readyState==='loading' ? document.addEventListener('DOMContentLoaded',()=>setTimeout(go,700)) : setTimeout(go,700);
})();
