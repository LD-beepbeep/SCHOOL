/* ================================================================
   StudentOS — Features Pack  v2
   ================================================================ */

function _fEsc(s) { const d=document.createElement('div');d.textContent=s||'';return d.innerHTML; }
function _fId()   { return Math.random().toString(36).slice(2,10); }
function _fGet(k,def){ return typeof DB!=='undefined'?DB.get(k,def):(JSON.parse(localStorage.getItem(k))??def); }
function _fSet(k,v)  { if(typeof DB!=='undefined')DB.set(k,v); else localStorage.setItem(k,JSON.stringify(v)); }

/* Wait for app ready */


/* ── ① MUSIC ── */
const PRESETS=[
    {id:'lofi',      label:'Lo-Fi Study',    icon:'fa-headphones',color:'#8b5cf6',url:'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&controls=1'},
    {id:'classical', label:'Classical Focus', icon:'fa-music',     color:'#3b82f6',url:'https://www.youtube.com/embed/y6TZHLAzg5o?autoplay=1&controls=1'},
    {id:'jazz',      label:'Jazz Cafe',       icon:'fa-guitar',    color:'#f59e0b',url:'https://www.youtube.com/embed/Dx5qFachd3A?autoplay=1&controls=1'},
    {id:'nature',    label:'Nature Sounds',   icon:'fa-leaf',      color:'#22c55e',url:'https://www.youtube.com/embed/eKFTSSKCzWA?autoplay=1&controls=1'},
    {id:'synthwave', label:'Synthwave',        icon:'fa-bolt',      color:'#ec4899',url:'https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1&controls=1'},
    {id:'piano',     label:'Piano Ambient',   icon:'fa-star',      color:'#06b6d4',url:'https://www.youtube.com/embed/1ZYbU82GVz4?autoplay=1&controls=1'},
];
let _activeId=null,_playing=false;

function _urlToEmbed(raw){
    const yt=raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if(yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&controls=1`;
    if(raw.includes('youtube.com/embed/')) return raw.includes('autoplay')?raw:raw+'?autoplay=1&controls=1';
    if(raw.includes('soundcloud.com')) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&auto_play=true`;
    return raw;
}

function initMusic(){ renderMusicGrid(); renderMusicCustomGrid(); }

function renderMusicGrid(){
    const g=document.getElementById('music-grid'); if(!g)return;
    g.innerHTML=PRESETS.map(p=>_mcHTML(p.id,p.label,p.icon,p.color,`musicPlay('${p.id}','preset')`)).join('');
}

function renderMusicCustomGrid(){
    const customs=_fGet('os_music_custom',[]);
    const g=document.getElementById('music-custom-grid');
    const lbl=document.getElementById('music-custom-label');
    if(!g)return;
    if(customs.length===0){g.innerHTML='';if(lbl)lbl.style.display='none';return;}
    if(lbl)lbl.style.display='';
    g.innerHTML=customs.map(c=>_mcHTML(c.id,c.name,'fa-globe','#64748b',
        `musicPlay('${c.id}','custom')`,
        `<button class="mc-delete-btn" onclick="event.stopPropagation();musicDeleteCustom('${c.id}')" title="Remove"><i class="fa-solid fa-xmark"></i></button>`
    )).join('');
}

function _mcHTML(id,label,icon,color,onclick,extra=''){
    const isActive=_activeId===id;
    return `<div class="music-card${isActive?' active':''}" style="--mc:${color}" onclick="${onclick}">
        <div class="mc-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="mc-info"><div class="mc-label">${_fEsc(label)}</div><div class="mc-sub">${id.startsWith('custom_')?'Custom station':'YouTube Stream'}</div></div>
        ${extra}
        <div class="mc-play-btn"><i class="fa-solid ${isActive&&_playing?'fa-pause':'fa-play'}"></i></div>
    </div>`;
}

window.musicPlay=function(id,type){
    if(_activeId===id&&_playing){musicStop();return;}
    let embedUrl,label,icon,color;
    if(type==='preset'){
        const p=PRESETS.find(x=>x.id===id);if(!p)return;
        embedUrl=p.url;label=p.label;icon=p.icon;color=p.color;
    } else {
        const c=_fGet('os_music_custom',[]).find(x=>x.id===id);if(!c)return;
        embedUrl=_urlToEmbed(c.url);label=c.name;icon='fa-globe';color='#64748b';
    }
    _activeId=id;_playing=true;
    const frame=document.getElementById('music-player-frame');
    if(frame)frame.src=embedUrl;
    const bar=document.getElementById('music-now-bar');
    if(bar){
        bar.classList.remove('hidden');
        const iEl=document.getElementById('mnb-icon');
        if(iEl){iEl.style.background=color+'22';iEl.style.color=color;iEl.innerHTML=`<i class="fa-solid ${icon}"></i>`;}
        const t=document.getElementById('mnb-title');if(t)t.textContent=label;
        const s=document.getElementById('mnb-sub');if(s)s.textContent='Now playing';
        const pi=document.getElementById('mnb-play-icon');if(pi)pi.className='fa-solid fa-pause';
    }
    renderMusicGrid();renderMusicCustomGrid();renderMusicWidget();
};

window.musicStop=function(){
    _playing=false;
    const frame=document.getElementById('music-player-frame');
    if(frame){const s=frame.src;frame.src='';frame.src=s;}
    const pi=document.getElementById('mnb-play-icon');if(pi)pi.className='fa-solid fa-play';
    renderMusicGrid();renderMusicCustomGrid();renderMusicWidget();
};
window.musicToggle=function(){
    if(_playing)musicStop();
    else if(_activeId)window.musicPlay(_activeId,PRESETS.find(p=>p.id===_activeId)?'preset':'custom');
};
window.musicClose=function(){
    _playing=false;_activeId=null;
    const frame=document.getElementById('music-player-frame');if(frame)frame.src='';
    const bar=document.getElementById('music-now-bar');if(bar)bar.classList.add('hidden');
    renderMusicGrid();renderMusicCustomGrid();renderMusicWidget();
};

window.musicOpenCustomModal=function(id){
    document.getElementById('music-custom-error').textContent='';
    if(id){
        const c=_fGet('os_music_custom',[]).find(x=>x.id===id);if(!c)return;
        document.getElementById('music-custom-edit-id').value=id;
        document.getElementById('music-custom-name').value=c.name;
        document.getElementById('music-custom-url').value=c.url;
    } else {
        document.getElementById('music-custom-edit-id').value='';
        document.getElementById('music-custom-name').value='';
        document.getElementById('music-custom-url').value='';
    }
    if(typeof openModal==='function')openModal('modal-music-custom');
};
window.musicSaveCustom=function(){
    const name=document.getElementById('music-custom-name').value.trim();
    const url=document.getElementById('music-custom-url').value.trim();
    const rawId=document.getElementById('music-custom-edit-id').value;
    const errEl=document.getElementById('music-custom-error');
    if(!name){errEl.textContent='Enter a station name.';return;}
    if(!url){errEl.textContent='Enter a URL.';return;}
    errEl.textContent='';
    let customs=_fGet('os_music_custom',[]);
    if(rawId) customs=customs.map(c=>c.id===rawId?{...c,name,url}:c);
    else      customs.push({id:'custom_'+_fId(),name,url});
    _fSet('os_music_custom',customs);
    if(typeof closeModals==='function')closeModals();
    renderMusicCustomGrid();
};
window.musicDeleteCustom=function(id){
    if(!confirm('Remove this station?'))return;
    if(_activeId===id)musicClose();
    _fSet('os_music_custom',_fGet('os_music_custom',[]).filter(c=>c.id!==id));
    renderMusicCustomGrid();
};

function renderMusicWidget(){
    const el=document.getElementById('widget-music-inner');if(!el)return;
    if(_activeId&&_playing){
        const p=PRESETS.find(x=>x.id===_activeId);
        const c=p||_fGet('os_music_custom',[]).find(x=>x.id===_activeId);
        const name=c?(p?p.label:c.name):'';
        const color=p?p.color:'#64748b';
        const icon=p?p.icon:'fa-globe';
        el.innerHTML=`<div class="wmb-playing" style="--wmc:${color}">
            <div class="wmb-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="wmb-info"><div class="wmb-name">${_fEsc(name)}</div><div class="wmb-status">Playing · <span style="color:var(--accent);cursor:pointer" onclick="switchTab('music')">controls</span></div></div>
            <button class="wmb-stop" onclick="musicClose()" title="Stop"><i class="fa-solid fa-stop"></i></button>
        </div>`;
    } else {
        el.innerHTML=`<div class="wmb-picks">
            ${PRESETS.slice(0,3).map(p=>`<button class="wmb-pick" style="--wmc:${p.color}" onclick="musicPlay('${p.id}','preset')" title="${_fEsc(p.label)}">
                <i class="fa-solid ${p.icon}"></i><span>${_fEsc(p.label)}</span>
            </button>`).join('')}
        </div>
        <div style="font-size:.7rem;color:var(--text-muted);margin-top:8px;">Click to start · <span style="color:var(--accent);cursor:pointer" onclick="switchTab('music')">all stations →</span></div>`;
    }
}

/* ── ② FORMULAS ── */
let _fSubject='all',_fSearch='';
window.initFormulas=function(){ renderFormulaSubjectBar(); renderFormulas(); };

function renderFormulaSubjectBar(){
    const bar=document.getElementById('formula-subject-bar');if(!bar)return;
    const items=_fGet('os_formulas',[]);
    const subjects=_fGet('os_subjects',[]);
    const names=new Set([...subjects.map(s=>s.name),...items.map(f=>f.subject).filter(Boolean)]);
    const pills=[{id:'all',name:'All'},...[...names].map(n=>({id:n,name:n}))];
    bar.innerHTML=pills.map(s=>`<button class="formula-pill${_fSubject===s.id?' active':''}" onclick="formulaSetSubject('${_fEsc(s.id)}')">${_fEsc(s.name)}</button>`).join('');
}

function renderFormulas(){
    const list=document.getElementById('formula-list');if(!list)return;
    let items=_fGet('os_formulas',[]);
    if(_fSubject!=='all')items=items.filter(f=>f.subject===_fSubject);
    if(_fSearch){const q=_fSearch.toLowerCase();items=items.filter(f=>(f.title||'').toLowerCase().includes(q)||(f.formula||'').toLowerCase().includes(q)||(f.note||'').toLowerCase().includes(q));}
    if(items.length===0){
        list.innerHTML=`<div class="formula-empty"><i class="fa-solid fa-square-root-alt"></i><p>${_fSearch?'No results.':'No formulas yet — add one!'}</p></div>`;
        return;
    }
    const subjects=_fGet('os_subjects',[]);
    list.innerHTML=items.map(f=>{
        const subj=subjects.find(s=>s.name===f.subject);
        const color=subj?(subj.color||'#3b82f6'):'#3b82f6';
        return `<div class="formula-card">
            <div class="formula-card-header">
                <div class="formula-subject-dot" style="background:${color}"></div>
                <span class="formula-card-title">${_fEsc(f.title)}</span>
                ${f.subject?`<span class="formula-subject-tag" style="background:${color}22;color:${color}">${_fEsc(f.subject)}</span>`:''}
                <div class="formula-card-actions">
                    <button onclick="formulaEdit('${f.id}')" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button onclick="formulaDelete('${f.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="formula-body">${_fEsc(f.formula)}</div>
            ${f.note?`<div class="formula-note">${_fEsc(f.note)}</div>`:''}
        </div>`;
    }).join('');
}

window.formulaSetSubject=s=>{_fSubject=s;renderFormulaSubjectBar();renderFormulas();};
window.formulaSearch    =q=>{_fSearch=q;renderFormulas();};

window.formulaOpenModal=function(id){
    const modal=document.getElementById('modal-formula');if(!modal)return;
    if(id){
        const f=_fGet('os_formulas',[]).find(x=>x.id===id);if(!f)return;
        document.getElementById('formula-modal-id').value=f.id;
        document.getElementById('formula-modal-title').value=f.title||'';
        document.getElementById('formula-modal-formula').value=f.formula||'';
        document.getElementById('formula-modal-note').value=f.note||'';
        document.getElementById('formula-modal-subject').value=f.subject||'';
        document.getElementById('formula-modal-heading').textContent='Edit Formula';
    } else {
        ['formula-modal-id','formula-modal-title','formula-modal-formula','formula-modal-note','formula-modal-subject'].forEach(id=>document.getElementById(id).value='');
        document.getElementById('formula-modal-heading').textContent='Add Formula';
    }
    document.getElementById('formula-modal-error').textContent='';
    if(typeof openModal==='function')openModal('modal-formula');
};
window.formulaEdit=id=>window.formulaOpenModal(id);

window.formulaSave=function(){
    const title=document.getElementById('formula-modal-title').value.trim();
    const formula=document.getElementById('formula-modal-formula').value.trim();
    const note=document.getElementById('formula-modal-note').value.trim();
    const subject=document.getElementById('formula-modal-subject').value.trim();
    const rawId=document.getElementById('formula-modal-id').value;
    const errEl=document.getElementById('formula-modal-error');
    if(!title||!formula){errEl.textContent='Title and formula are required.';return;}
    errEl.textContent='';
    let items=_fGet('os_formulas',[]);
    if(rawId) items=items.map(f=>f.id===rawId?{...f,title,formula,note,subject}:f);
    else      items.push({id:_fId(),title,formula,note,subject,createdAt:Date.now()});
    _fSet('os_formulas',items);
    if(typeof closeModals==='function')closeModals();
    renderFormulas();renderFormulaSubjectBar();
};
window.formulaDelete=function(id){
    if(!confirm('Delete this formula?'))return;
    _fSet('os_formulas',_fGet('os_formulas',[]).filter(f=>f.id!==id));
    renderFormulas();renderFormulaSubjectBar();
};

/* ── ③ EXAM COUNTDOWN ── */
function initExamCountdown(){ renderExamCountdown(); renderExamManageList(); setInterval(renderExamCountdown,60000); }

function renderExamCountdown(){
    const el=document.getElementById('widget-exams-list');if(!el)return;
    const today=new Date();today.setHours(0,0,0,0);
    const upcoming=_fGet('os_exams',[])
        .map(e=>{const d=new Date(e.date);d.setHours(0,0,0,0);return{...e,days:Math.round((d-today)/86400000)};})
        .filter(e=>e.days>=0).sort((a,b)=>a.days-b.days);
    if(upcoming.length===0){
        el.innerHTML=`<div class="text-xs text-[var(--text-muted)]">No upcoming exams. <button onclick="examOpenModal(null)" style="color:var(--accent);background:none;border:none;cursor:pointer;font-size:inherit;padding:0">Add one →</button></div>`;
        return;
    }
    el.innerHTML=upcoming.slice(0,5).map(e=>{
        const urg=e.days===0?'#ef4444':e.days<=3?'#f59e0b':e.days<=7?'#3b82f6':'#22c55e';
        return `<div class="exam-cd-item">
            <div class="exam-cd-dot" style="background:${urg}"></div>
            <div class="exam-cd-info"><div class="exam-cd-title">${_fEsc(e.title)}</div>${e.subject?`<div class="exam-cd-sub">${_fEsc(e.subject)}</div>`:''}</div>
            <div class="exam-cd-days" style="color:${urg}">${e.days===0?'Today!':e.days===1?'Tomorrow':e.days+'d'}</div>
        </div>`;
    }).join('');
}

window.examOpenModal=function(id){
    const errEl=document.getElementById('exam-modal-error');if(errEl)errEl.textContent='';
    const hdg=document.getElementById('exam-modal-heading');
    if(id){
        const e=_fGet('os_exams',[]).find(x=>x.id===id);if(!e)return;
        document.getElementById('exam-modal-id').value=e.id;
        document.getElementById('exam-modal-title').value=e.title;
        document.getElementById('exam-modal-date').value=e.date;
        document.getElementById('exam-modal-subject').value=e.subject||'';
        if(hdg)hdg.textContent='Edit Exam';
    } else {
        ['exam-modal-id','exam-modal-title','exam-modal-date','exam-modal-subject'].forEach(i=>document.getElementById(i).value='');
        if(hdg)hdg.textContent='Add Exam';
    }
    if(typeof openModal==='function')openModal('modal-exam');
};
window.examSave=function(){
    const title=document.getElementById('exam-modal-title').value.trim();
    const date=document.getElementById('exam-modal-date').value;
    const sub=document.getElementById('exam-modal-subject').value.trim();
    const rawId=document.getElementById('exam-modal-id').value;
    const errEl=document.getElementById('exam-modal-error');
    if(!title||!date){errEl.textContent='Title and date required.';return;}
    errEl.textContent='';
    let exams=_fGet('os_exams',[]);
    if(rawId) exams=exams.map(e=>e.id===rawId?{...e,title,date,subject:sub}:e);
    else      exams.push({id:_fId(),title,date,subject:sub});
    _fSet('os_exams',exams);
    if(typeof closeModals==='function')closeModals();
    renderExamCountdown();window.renderExamManageList();
};
window.examDelete=function(id){
    if(!confirm('Delete this exam?'))return;
    _fSet('os_exams',_fGet('os_exams',[]).filter(e=>e.id!==id));
    renderExamCountdown();window.renderExamManageList();
};
window.renderExamManageList=function(){
    const el=document.getElementById('exam-manage-list');if(!el)return;
    const exams=_fGet('os_exams',[]).sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(exams.length===0){el.innerHTML=`<div class="text-xs text-[var(--text-muted)] py-3">No exams added yet.</div>`;return;}
    const today=new Date();today.setHours(0,0,0,0);
    el.innerHTML=exams.map(e=>{
        const d=new Date(e.date);d.setHours(0,0,0,0);
        const days=Math.round((d-today)/86400000);
        const urg=days<0?'#6b7280':days===0?'#ef4444':days<=3?'#f59e0b':days<=7?'#3b82f6':'#22c55e';
        const dLbl=days<0?'Past':days===0?'Today':days===1?'Tomorrow':days+'d';
        return `<div class="flex items-center gap-3 py-2.5 border-b border-[var(--glass-border)]">
            <div style="width:8px;height:8px;border-radius:50%;background:${urg};flex-shrink:0"></div>
            <div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">${_fEsc(e.title)}</div>${e.subject?`<div class="text-xs text-[var(--text-muted)]">${_fEsc(e.subject)}</div>`:''}</div>
            <div class="text-xs font-bold shrink-0" style="color:${urg}">${dLbl}</div>
            <div class="text-xs text-[var(--text-muted)] shrink-0">${e.date}</div>
            <button onclick="examOpenModal('${e.id}')" class="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"><i class="fa-solid fa-pencil text-xs"></i></button>
            <button onclick="examDelete('${e.id}')" class="text-[var(--text-muted)] hover:text-red-400 p-1"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`;
    }).join('');
};

/* Also repopulate manage list when modal opens */
(function _waitOpenModal(){
    if(typeof window.openModal==='function'){
        const _orig=window.openModal;
        window.openModal=function(id){
            _orig(id);
            if(id==='modal-exam-manage') window.renderExamManageList();
        };
    } else { setTimeout(_waitOpenModal,200); }
})();

/* ── ④ TIMETABLE ── */
const TT_DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const TT_HOURS=[7,8,9,10,11,12,13,14,15,16,17,18,19];
window.renderTimetable=function(){
    const grid=document.getElementById('timetable-grid');if(!grid)return;
    const slots=_fGet('os_timetable',[]);
    let html=`<div class="tt-grid"><div class="tt-corner"></div>`;
    TT_DAYS.forEach(d=>{html+=`<div class="tt-day-header">${d.slice(0,3)}</div>`;});
    TT_HOURS.forEach(h=>{
        html+=`<div class="tt-hour-label">${h}:00</div>`;
        TT_DAYS.forEach((_,di)=>{
            const cs=slots.filter(s=>s.day===di&&s.startHour===h);
            html+=`<div class="tt-cell" onclick="ttOpenAdd(${di},${h})">`;
            cs.forEach(s=>{html+=`<div class="tt-slot" style="background:${s.color||'var(--accent)'}22;border-color:${s.color||'var(--accent)'};color:${s.color||'var(--accent)'};" onclick="event.stopPropagation();ttEditSlot('${s.id}')"><div class="tt-slot-name">${_fEsc(s.name)}</div>${s.room?`<div class="tt-slot-room">${_fEsc(s.room)}</div>`:''}</div>`;});
            html+=`</div>`;
        });
    });
    html+=`</div>`;grid.innerHTML=html;
};
window.ttOpenAdd=function(day,hour){_ttPop(null,day,hour);if(typeof openModal==='function')openModal('modal-timetable');};
window.ttEditSlot=function(id){const s=_fGet('os_timetable',[]).find(x=>x.id===id);if(!s)return;_ttPop(s,s.day,s.startHour);if(typeof openModal==='function')openModal('modal-timetable');};
function _ttPop(s,day,hour){
    document.getElementById('tt-modal-id').value=s?s.id:'';
    document.getElementById('tt-modal-name').value=s?s.name:'';
    document.getElementById('tt-modal-room').value=s?(s.room||''):'';
    document.getElementById('tt-modal-day').value=day!==undefined?day:0;
    document.getElementById('tt-modal-start').value=hour!==undefined?hour:8;
    document.getElementById('tt-modal-end').value=s?(s.endHour||(hour||8)+1):(hour||8)+1;
    document.getElementById('tt-modal-color').value=s?(s.color||'#3b82f6'):'#3b82f6';
    document.getElementById('tt-modal-error').textContent='';
}
window.ttSave=function(){
    const name=document.getElementById('tt-modal-name').value.trim();
    const room=document.getElementById('tt-modal-room').value.trim();
    const day=parseInt(document.getElementById('tt-modal-day').value);
    const start=parseInt(document.getElementById('tt-modal-start').value);
    const end=parseInt(document.getElementById('tt-modal-end').value);
    const color=document.getElementById('tt-modal-color').value;
    const rawId=document.getElementById('tt-modal-id').value;
    const errEl=document.getElementById('tt-modal-error');
    if(!name){errEl.textContent='Enter a class name.';return;}
    if(end<=start){errEl.textContent='End must be after start.';return;}
    let slots=_fGet('os_timetable',[]);
    if(rawId)slots=slots.map(s=>s.id===rawId?{...s,name,room,day,startHour:start,endHour:end,color}:s);
    else     slots.push({id:_fId(),name,room,day,startHour:start,endHour:end,color});
    _fSet('os_timetable',slots);
    if(typeof closeModals==='function')closeModals();
    window.renderTimetable();
};
window.ttDeleteSlot=function(){
    const id=document.getElementById('tt-modal-id').value;if(!id)return;
    if(!confirm('Remove?'))return;
    _fSet('os_timetable',_fGet('os_timetable',[]).filter(s=>s.id!==id));
    if(typeof closeModals==='function')closeModals();
    window.renderTimetable();
};

/* ── FORUM QUICK POST ── */
window.widgetForumPost=function(){
    const qEl=document.getElementById('widget-forum-q');
    const subEl=document.getElementById('widget-forum-subject');
    const statEl=document.getElementById('widget-forum-status');
    const q=qEl?qEl.value.trim():'';
    if(!q){if(statEl)statEl.textContent='Please enter a question.';return;}
    if(typeof window.forumQuickPost==='function'){
        window.forumQuickPost(q,subEl?subEl.value.trim():'').then(()=>{
            qEl.value='';if(subEl)subEl.value='';
            if(statEl){statEl.textContent='Posted! ✓';setTimeout(()=>statEl.textContent='',3000);}
        }).catch(()=>{if(statEl)statEl.textContent='Failed — try the Forum tab.';});
    } else {
        window._pendingForumPost={body:q,subject:subEl?subEl.value.trim():''};
        if(typeof window.switchTab==='function')window.switchTab('forum');
        qEl.value='';
    }
};

/* ── PATCHES ── */
function _patchSwitchTab(){
    const _orig=window.switchTab;
    window.switchTab=function(name){
        _orig&&_orig(name);
        if(name==='music')    setTimeout(()=>{renderMusicGrid();renderMusicCustomGrid();},50);
        if(name==='formulas') setTimeout(()=>window.initFormulas(),50);
    };
    if(typeof window.switchCalView==='function'){
        const _origCal=window.switchCalView;
        window.switchCalView=function(view){
            _origCal(view);
            const ttView=document.getElementById('cal-view-timetable');
            if(ttView){ttView.classList.toggle('hidden',view!=='timetable');if(view==='timetable')window.renderTimetable();}
        };
    }
}
function _patchUpdateDashWidgets(){
    const _orig=typeof window.updateDashWidgets==='function'?window.updateDashWidgets:null;
    window.updateDashWidgets=function(){_orig&&_orig();renderExamCountdown();renderMusicWidget();};
}

(function _waitReady(){
    if(typeof window.switchTab==='function' && !window.switchTab._sos_stub && document.getElementById('view-music')){
        _patchSwitchTab();
        _patchUpdateDashWidgets();
        initMusic();
        initExamCountdown();
        renderMusicWidget();
    } else {
        setTimeout(_waitReady,100);
    }
})();