/* ===== StudentOS — script.js ===== */

// ===== DATABASE =====
var DB = {
    get: function(key, def) {
        try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; } catch(e) { return def; }
    },
    set: function(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
    }
};

// ===== ALERT / CONFIRM =====
function showAlert(title, msg) {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-msg').innerText = msg;
    openModal('modal-alert');
}
function showConfirm(title, msg, cb) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-msg').innerText = msg;
    document.getElementById('confirm-btn-action').onclick = function() { closeModals(); cb(); };
    openModal('modal-confirm');
}

// ===== I18N =====
var i18n = {
    en: { status:'Current Status', status_txt:'Ready to learn', ql:'Quick Links', goals:'Daily Goals', up_next:'Up Next',
          tasks:'Tasks', clear_done:'Clear Done', calendar:'Calendar', sync_url:'Sync URL', remove_sync:'Remove Sync',
          open_tab:'Open in New Tab', notes:'Notes', new_note:'+ New Note', whiteboard:'Whiteboard', clear:'Clear',
          study_decks:'Study Decks', import:'Import', new_deck:'New Deck', grades:'Grades', new_subject:'+ Add Subject',
          settings:'Settings' },
    nl: { status:'Huidige Status', status_txt:'Klaar om te leren', ql:'Snelkoppelingen', goals:'Dagelijkse Doelen',
          up_next:'Volgende', tasks:'Taken', clear_done:'Klaar Wissen', calendar:'Kalender', sync_url:'URL Synchroniseren',
          remove_sync:'Sync Verwijderen', open_tab:'Open in Nieuw Tabblad', notes:'Notities', new_note:'+ Nieuwe Notitie',
          whiteboard:'Whiteboard', clear:'Wissen', study_decks:'Studiedecks', import:'Importeren', new_deck:'Nieuw Deck',
          grades:'Cijfers', new_subject:'+ Vak Toevoegen', settings:'Instellingen' }
};
var currentLang = DB.get('os_lang', 'en');
function setLanguage(lang) { currentLang = lang; DB.set('os_lang', lang); updateInterfaceText(); }
function updateInterfaceText() {
    var t = i18n[currentLang] || i18n.en;
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });
    var ls = document.getElementById('lang-select');
    if (ls) ls.value = currentLang;
}

// ===== STUDENT NAME =====
var studentName = DB.get('os_name', '');
function setStudentName(val) {
    studentName = val; DB.set('os_name', val);
    updateGreeting();
}
function syncSettingsName() {
    var si = document.getElementById('student-name-input');
    if (si) si.value = studentName;
}
function updateGreeting() {
    var h = new Date().getHours();
    var greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    if (currentLang === 'nl') greet = h < 12 ? 'Goedemorgen' : h < 17 ? 'Goedemiddag' : 'Goedenavond';
    var el = document.getElementById('dash-greeting');
    if (el) el.innerText = greet + (studentName ? ', ' + studentName : '') + ' 👋';
}
(function() {
    var ni = document.getElementById('student-name-input');
    var pi = document.getElementById('profile-name-input');
    if (ni) ni.value = studentName;
    if (pi) pi.value = studentName;
})();

// ===== CLOCK =====
function updateClock() {
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes();
    var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    var el = document.getElementById('clock-time');
    if (el) el.innerText = timeStr;
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dd = document.getElementById('date-display');
    if (dd) dd.innerText = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
    updateGreeting();
}
updateClock();
setInterval(updateClock, 30000);

// ===== THEME =====
var currentTheme = DB.get('os_theme', 'dark');
function applyTheme() {
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        var td = document.getElementById('theme-dot');
        if (td) td.style.transform = 'translateX(24px)';
    } else {
        document.documentElement.removeAttribute('data-theme');
        var td = document.getElementById('theme-dot');
        if (td) td.style.transform = '';
    }
}
function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    DB.set('os_theme', currentTheme); applyTheme();
}
applyTheme();

function setAccent(c) {
    document.documentElement.style.setProperty('--accent', c);
    DB.set('os_accent', c);
}
(function() { var a = DB.get('os_accent', '#3b82f6'); if (a) setAccent(a); })();

function setFontScale(s) {
    document.documentElement.style.setProperty('--font-scale', s);
    DB.set('os_font_scale', s);
}
(function() { var fs = DB.get('os_font_scale', 1); if (fs) setFontScale(fs); })();

function setClockColor(c) {
    document.documentElement.style.setProperty('--clock-color', c);
    DB.set('os_clock_color', c);
}
(function() { var cc = DB.get('os_clock_color', ''); if (cc) { setClockColor(cc); var cp = document.getElementById('clock-color-picker'); if (cp) cp.value = cc; } })();

function setBg(c) {
    var grad = 'radial-gradient(circle at 30% 20%, ' + c + '33, transparent 50%), radial-gradient(circle at 80% 80%, ' + c + '22, transparent 50%)';
    document.getElementById('ambient-bg').style.background = grad;
    DB.set('os_bg_color', c);
}
(function() { var bg = DB.get('os_bg_color', ''); if (bg) setBg(bg); })();

// ===== PROFILE =====
var profileData = DB.get('os_profile', { type: 'emoji', emoji: '🎓', bg: '#3b82f6' });
function renderProfileDisplay() {
    var pd = document.getElementById('profile-display');
    var ap = document.getElementById('avatar-preview');
    if (!pd) return;
    if (profileData.type === 'image' && profileData.img) {
        var html = '<img src="' + profileData.img + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">';
        pd.innerHTML = html;
        if (ap) { ap.innerHTML = '<img src="' + profileData.img + '" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">'; ap.style.background = ''; }
    } else {
        var em = profileData.emoji || '🎓';
        var bg = profileData.bg || '#3b82f6';
        pd.innerHTML = '<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:14px;background:' + bg + ';font-size:1.3rem;">' + em + '</span>';
        if (ap) { ap.innerHTML = em; ap.style.background = bg; ap.style.fontSize = '1.8rem'; }
    }
}
function setProfileEmoji(em) {
    profileData.type = 'emoji'; profileData.emoji = em;
    DB.set('os_profile', profileData); renderProfileDisplay();
    document.querySelectorAll('.emoji-opt').forEach(function(o) {
        o.classList.toggle('selected', o.innerText === em);
    });
}
function setAvatarBg(c) {
    profileData.bg = c; DB.set('os_profile', profileData); renderProfileDisplay();
}
function handleProfileImage(inp) {
    var f = inp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(e) {
        profileData.type = 'image'; profileData.img = e.target.result;
        DB.set('os_profile', profileData); renderProfileDisplay();
    };
    r.readAsDataURL(f);
}
renderProfileDisplay();

// ===== MODAL =====
function openModal(id) {
    var overlay = document.getElementById('modal-overlay');
    overlay.querySelectorAll('.modal-panel').forEach(function(p) { p.classList.add('hidden'); });
    document.getElementById(id).classList.remove('hidden');
    overlay.classList.remove('hidden');
}
function closeModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal-panel').forEach(function(p) { p.classList.add('hidden'); });
}
document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModals();
});

// ===== TAB NAVIGATION =====
var tabs = ['dashboard','tasks','calendar','notes','whiteboard','cards','grades','calc','focus'];
function switchTab(name) {
    tabs.forEach(function(t) {
        var v = document.getElementById('view-' + t);
        var b = document.getElementById('btn-' + t);
        if (v) v.classList.toggle('hidden', t !== name);
        if (b) b.classList.toggle('active', t === name);
    });
    if (name === 'cards') { showDeckList(); }
    if (name === 'dashboard') { updateDashWidgets(); }
    if (name === 'calendar') { renderCalendar(); }
}
// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.altKey) {
        var idx = parseInt(e.key);
        if (idx >= 1 && idx <= tabs.length) { switchTab(tabs[idx - 1]); return; }
        if (e.key === 't') { switchTab('tasks'); document.getElementById('task-input').focus(); }
        if (e.key === 'n') { switchTab('notes'); }
    }
    if (e.key === 'Escape') closeModals();
    if (e.key === ' ' && document.getElementById('cards-study-view') && !document.getElementById('cards-study-view').classList.contains('hidden')) {
        var wm = document.getElementById('study-write-mode');
        if (wm && wm.classList.contains('hidden')) { e.preventDefault(); flipCard(); }
    }
    if (e.key === 'ArrowLeft' && document.getElementById('cards-study-view') && !document.getElementById('cards-study-view').classList.contains('hidden')) {
        rateCard('hard');
    }
    if (e.key === 'ArrowRight' && document.getElementById('cards-study-view') && !document.getElementById('cards-study-view').classList.contains('hidden')) {
        rateCard('easy');
    }
});

// ===== STREAK =====
var streak = DB.get('os_streak', { count: 0, lastDate: '' });
(function() {
    var today = new Date().toDateString();
    var yesterday = new Date(Date.now() - 86400000).toDateString();
    if (streak.lastDate === today) {
        // already counted
    } else if (streak.lastDate === yesterday) {
        streak.count++; streak.lastDate = today; DB.set('os_streak', streak);
    } else if (streak.lastDate !== today) {
        streak.count = 1; streak.lastDate = today; DB.set('os_streak', streak);
    }
    var el = document.getElementById('dash-streak');
    if (el) el.innerText = streak.count;
})();

// ===== TIMER SOUND =====
var timerSoundOn = DB.get('os_timer_sound', true);
function toggleTimerSound() {
    timerSoundOn = !timerSoundOn; DB.set('os_timer_sound', timerSoundOn);
    var dot = document.getElementById('timer-sound-dot');
    if (dot) dot.style.transform = timerSoundOn ? 'translateX(24px)' : '';
}
(function() { var dot = document.getElementById('timer-sound-dot'); if (dot) dot.style.transform = timerSoundOn ? 'translateX(24px)' : ''; })();

function playBeep() {
    if (!timerSoundOn) return;
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
        osc.start(); osc.stop(ctx.currentTime + 1);
    } catch(e) {}
}

// ===== FOCUS TIMER =====
var tTime = 25 * 60, tLeft = tTime, tInt, tRun = false;
function updateTimer() {
    var m = Math.floor(tLeft / 60), s = tLeft % 60;
    var el = document.getElementById('timer-display');
    if (el) el.innerText = m + ':' + (s < 10 ? '0' : '') + s;
}
function toggleTimer() {
    if (tRun) {
        clearInterval(tInt);
        var ico = document.getElementById('icon-play');
        if (ico) ico.className = 'ph-fill ph-play';
    } else {
        tInt = setInterval(function() {
            if (tLeft > 0) { tLeft--; updateTimer(); } else { resetTimer(); playBeep(); openModal('modal-timer-done'); }
        }, 1000);
        var ico = document.getElementById('icon-play');
        if (ico) ico.className = 'ph-fill ph-pause';
    }
    tRun = !tRun;
}
function resetTimer() {
    clearInterval(tInt); tRun = false; tLeft = tTime;
    var ico = document.getElementById('icon-play');
    if (ico) ico.className = 'ph-fill ph-play';
    updateTimer();
}
function setMode(m, l) {
    resetTimer(); tTime = m * 60; tLeft = tTime;
    var lbl = document.getElementById('timer-label');
    if (lbl) lbl.innerText = l;
    updateTimer();
}
function setCustomPomodoro(val) {
    var mins = parseInt(val) || 25;
    setMode(mins, 'FOCUS');
}
updateTimer();

// ===== WIDGETS =====
var widgetConfig = DB.get('os_widgets', {
    links: { visible: true, color: '#3b82f6' },
    goals: { visible: true, color: '#22c55e' },
    upnext: { visible: true, color: '#f59e0b' },
    studystats: { visible: true },
    grades: { visible: true },
    minicalendar: { visible: true },
    quicknote: { visible: true }
});
function setWidgetVisible(name, vis) {
    if (!widgetConfig[name]) widgetConfig[name] = {};
    widgetConfig[name].visible = vis;
    DB.set('os_widgets', widgetConfig);
    var el = document.getElementById('widget-' + name);
    if (el) el.classList.toggle('widget-hidden', !vis);
}
function setWidgetColor(name, c) {
    if (!widgetConfig[name]) widgetConfig[name] = {};
    widgetConfig[name].color = c;
    DB.set('os_widgets', widgetConfig);
    var el = document.getElementById('widget-' + name);
    if (el) el.style.borderColor = c + '44';
}
function applyWidgetConfig() {
    Object.keys(widgetConfig).forEach(function(name) {
        var cfg = widgetConfig[name];
        var el = document.getElementById('widget-' + name);
        if (!el) return;
        if (!cfg.visible) el.classList.add('widget-hidden'); else el.classList.remove('widget-hidden');
        if (cfg.color) el.style.borderColor = cfg.color + '44';
        var chk = document.getElementById('wv-' + name);
        if (chk) chk.checked = cfg.visible !== false;
        var col = document.getElementById('wc-' + name);
        if (col && cfg.color) col.value = cfg.color;
    });
}
applyWidgetConfig();

// Widget drag-reorder
var dragSrc = null;
document.querySelectorAll('.widget-item').forEach(function(w) {
    w.addEventListener('dragstart', function(e) { dragSrc = this; this.classList.add('widget-dragging'); });
    w.addEventListener('dragend', function() { this.classList.remove('widget-dragging'); document.querySelectorAll('.widget-item').forEach(function(x) { x.classList.remove('widget-drag-over'); }); });
    w.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('widget-drag-over'); });
    w.addEventListener('dragleave', function() { this.classList.remove('widget-drag-over'); });
    w.addEventListener('drop', function(e) {
        e.preventDefault(); this.classList.remove('widget-drag-over');
        if (dragSrc && dragSrc !== this) {
            var grid = this.parentNode;
            var els = Array.from(grid.children);
            var si = els.indexOf(dragSrc), ti = els.indexOf(this);
            if (si < ti) grid.insertBefore(dragSrc, this.nextSibling);
            else grid.insertBefore(dragSrc, this);
        }
    });
});

// Quick Note
var quickNote = DB.get('os_quick_note', '');
(function() { var qn = document.getElementById('dash-quick-note'); if (qn) qn.value = quickNote; })();
function saveQuickNote() {
    var qn = document.getElementById('dash-quick-note');
    if (qn) { quickNote = qn.value; DB.set('os_quick_note', quickNote); }
}

function updateDashWidgets() {
    // Study stats
    var decks = DB.get('os_decks', []);
    var statDecks = document.getElementById('stat-decks');
    if (statDecks) statDecks.innerText = decks.length;
    var studyStats = DB.get('os_study_stats', { today: 0, bestStreak: 0 });
    var sct = document.getElementById('stat-cards-today');
    if (sct) sct.innerText = studyStats.today || 0;
    var sbs = document.getElementById('stat-best-streak');
    if (sbs) sbs.innerText = studyStats.bestStreak || streak.count;

    // Grades overview
    var subjects = DB.get('os_subjects', []);
    var allTests = [];
    subjects.forEach(function(s) { (s.tests || []).filter(function(t) { return !t.practice; }).forEach(function(t) { allTests.push(t); }); });
    var avgEl = document.getElementById('dash-grade-avg');
    var lblEl = document.getElementById('dash-grade-label');
    if (allTests.length > 0) {
        var totalScore = allTests.reduce(function(a, t) { return a + (t.score / t.max * 20); }, 0);
        var avg = totalScore / allTests.length;
        if (avgEl) avgEl.innerText = avg.toFixed(1) + '/20';
        if (lblEl) lblEl.innerText = getBeLabel(avg);
    } else {
        if (avgEl) avgEl.innerText = '--';
        if (lblEl) lblEl.innerText = 'No data';
    }

    // Upcoming events
    var calEvents = DB.get('os_events', {});
    var upcoming = document.getElementById('dash-upcoming-events');
    if (upcoming) {
        var today = new Date();
        var evList = [];
        for (var i = 0; i < 14; i++) {
            var d = new Date(today); d.setDate(today.getDate() + i);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (calEvents[key] && calEvents[key].length) {
                calEvents[key].forEach(function(ev) {
                    evList.push({ date: key, title: ev.title, color: ev.color, time: ev.time });
                });
            }
        }
        if (evList.length === 0) {
            upcoming.innerHTML = '<div class="text-xs text-[var(--text-muted)]">No upcoming events</div>';
        } else {
            upcoming.innerHTML = evList.slice(0, 5).map(function(ev) {
                return '<div class="flex items-center gap-2 py-1"><div style="width:8px;height:8px;border-radius:50%;background:' + (ev.color || '#3b82f6') + ';flex-shrink:0;"></div><span class="text-xs truncate">' + ev.title + '</span><span class="text-[10px] text-[var(--text-muted)] ml-auto">' + ev.date.slice(5) + '</span></div>';
            }).join('');
        }
    }

    // Up next task
    var tasks = DB.get('os_tasks', []);
    var pending = tasks.filter(function(t) { return !t.done; }).sort(function(a, b) {
        var pa = { high: 0, med: 1, low: 2 }[a.priority] || 2;
        var pb = { high: 0, med: 1, low: 2 }[b.priority] || 2;
        return pa - pb;
    });
    var dtt = document.getElementById('dash-top-task');
    var dtd = document.getElementById('dash-top-date');
    if (dtt) dtt.innerText = pending.length > 0 ? pending[0].text : 'No tasks queued';
    if (dtd) dtd.innerText = pending.length > 0 && pending[0].date ? pending[0].date : (pending.length > 0 ? (pending.length - 1) + ' more tasks' : 'Clear schedule');
}
updateDashWidgets();

// ===== QUICK LINKS =====
var quickLinks = DB.get('os_links', []);
function renderLinks() {
    var c = document.getElementById('quick-links-container');
    if (!c) return;
    c.innerHTML = '';
    quickLinks.forEach(function(l, i) {
        var div = document.createElement('div');
        div.className = 'link-card flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--glass-hover)] hover:bg-[var(--accent)] hover:text-white transition cursor-pointer group relative flex-shrink-0';
        div.innerHTML = '<div class="link-actions absolute top-1 right-1 flex gap-0.5">'
            + '<button onclick="event.stopPropagation();deleteLink(' + i + ')" class="text-[8px] w-4 h-4 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-red-500">\u00d7</button></div>'
            + '<i class="' + (l.icon || 'ph-fill ph-link') + ' text-lg"></i>'
            + '<span class="text-xs font-medium whitespace-nowrap">' + l.name + '</span>';
        div.addEventListener('click', function() {
            if (l.mode === 'iframe') {
                document.getElementById('browser-title').innerText = l.name;
                document.getElementById('browser-frame').src = l.url;
                document.getElementById('modal-browser').classList.remove('hidden');
            } else { window.open(l.url, '_blank'); }
        });
        c.appendChild(div);
    });
}
function openAddLinkModal() { openModal('modal-add-link'); }
function saveQuickLink() {
    var name = document.getElementById('link-name').value.trim();
    var url = document.getElementById('link-url').value.trim();
    var icon = document.getElementById('link-icon').value;
    var mode = document.querySelector('input[name="linkMode"]:checked');
    if (!name || !url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    quickLinks.push({ name: name, url: url, icon: icon, mode: mode ? mode.value : 'newtab' });
    DB.set('os_links', quickLinks);
    document.getElementById('link-name').value = '';
    document.getElementById('link-url').value = '';
    closeModals(); renderLinks();
}
function deleteLink(i) {
    quickLinks.splice(i, 1); DB.set('os_links', quickLinks); renderLinks();
}
renderLinks();

// ===== DAILY GOALS =====
var goals = DB.get('os_goals', []);
function renderGoals() {
    var c = document.getElementById('goals-container');
    if (!c) return;
    c.innerHTML = '';
    goals.forEach(function(g, i) {
        var div = document.createElement('div');
        div.className = 'flex items-center gap-2 py-1 group';
        div.innerHTML = '<input type="checkbox" ' + (g.done ? 'checked' : '') + ' onchange="toggleGoal(' + i + ')" class="w-3.5 h-3.5 flex-shrink-0">'
            + '<span class="text-sm flex-1 ' + (g.done ? 'line-through opacity-50' : '') + '">' + g.text + '</span>'
            + '<button onclick="deleteGoal(' + i + ')" class="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition text-xs">\u00d7</button>';
        c.appendChild(div);
    });
}
function addGoal() {
    var inp = document.getElementById('goal-input');
    var v = inp ? inp.value.trim() : '';
    if (!v) return;
    goals.push({ text: v, done: false }); DB.set('os_goals', goals);
    inp.value = ''; renderGoals();
}
function toggleGoal(i) {
    goals[i].done = !goals[i].done; DB.set('os_goals', goals); renderGoals();
}
function deleteGoal(i) {
    goals.splice(i, 1); DB.set('os_goals', goals); renderGoals();
}
renderGoals();

// ===== TASKS =====
var tasks = DB.get('os_tasks', []);
var taskColorValue = '#3b82f6';
function taskColorOff() {
    taskColorValue = null;
    var tc = document.getElementById('task-color');
    if (tc) tc.value = '#3b82f6';
}
(function() {
    var tc = document.getElementById('task-color');
    if (tc) tc.addEventListener('change', function() { taskColorValue = this.value; });
})();

function addTask() {
    var inp = document.getElementById('task-input');
    var prio = document.getElementById('task-prio');
    var date = document.getElementById('task-date');
    var v = inp ? inp.value.trim() : '';
    if (!v) return;
    tasks.push({ id: Date.now(), text: v, priority: prio ? prio.value : 'low', date: date ? date.value : '', done: false, color: taskColorValue, subtasks: [] });
    DB.set('os_tasks', tasks);
    if (inp) inp.value = '';
    renderTasks(); updateDashWidgets();
}
function dashAddTask() {
    var inp = document.getElementById('dash-quick-task');
    var v = inp ? inp.value.trim() : '';
    if (!v) return;
    tasks.push({ id: Date.now(), text: v, priority: 'low', date: '', done: false, subtasks: [] });
    DB.set('os_tasks', tasks);
    if (inp) inp.value = '';
    renderTasks(); updateDashWidgets();
}
function toggleTask(id) {
    var t = tasks.find(function(x) { return x.id === id; });
    if (t) { t.done = !t.done; DB.set('os_tasks', tasks); renderTasks(); updateDashWidgets(); }
}
function deleteTask(id) {
    tasks = tasks.filter(function(x) { return x.id !== id; }); DB.set('os_tasks', tasks); renderTasks(); updateDashWidgets();
}
function clearCompletedTasks() {
    showConfirm('Clear Done', 'Remove all completed tasks?', function() {
        tasks = tasks.filter(function(t) { return !t.done; }); DB.set('os_tasks', tasks); renderTasks(); updateDashWidgets();
    });
}

// Task edit
function startEditTask(id) {
    var t = tasks.find(function(x) { return x.id === id; });
    if (!t) return;
    var row = document.getElementById('task-row-' + id);
    if (!row) return;
    var form = row.querySelector('.task-edit-form');
    if (form) { form.classList.toggle('hidden'); return; }
    var ef = document.createElement('div');
    ef.className = 'task-edit-form';
    ef.innerHTML = '<input type="text" id="edit-task-text-' + id + '" value="' + t.text.replace(/"/g, '&quot;') + '" class="bare-input flex-1 text-sm">'
        + '<select id="edit-task-prio-' + id + '" class="bare-input text-xs bg-transparent w-24">'
        + '<option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>High</option>'
        + '<option value="med"' + (t.priority === 'med' ? ' selected' : '') + '>Medium</option>'
        + '<option value="low"' + (t.priority === 'low' ? ' selected' : '') + '>Low</option>'
        + '</select>'
        + '<input type="date" id="edit-task-date-' + id + '" value="' + (t.date || '') + '" class="bare-input text-xs w-32">'
        + '<button onclick="saveTaskEdit(' + id + ')" class="text-xs px-3 py-1 bg-[var(--accent)] text-white rounded-lg">Save</button>'
        + '<button onclick="cancelTaskEdit(' + id + ')" class="text-xs px-3 py-1 text-[var(--text-muted)] hover:text-[var(--text-main)]">Cancel</button>';
    row.appendChild(ef);
}
function saveTaskEdit(id) {
    var t = tasks.find(function(x) { return x.id === id; });
    if (!t) return;
    var textEl = document.getElementById('edit-task-text-' + id);
    var prioEl = document.getElementById('edit-task-prio-' + id);
    var dateEl = document.getElementById('edit-task-date-' + id);
    if (textEl) t.text = textEl.value.trim();
    if (prioEl) t.priority = prioEl.value;
    if (dateEl) t.date = dateEl.value;
    DB.set('os_tasks', tasks); renderTasks(); updateDashWidgets();
}
function cancelTaskEdit(id) {
    var row = document.getElementById('task-row-' + id);
    if (!row) return;
    var ef = row.querySelector('.task-edit-form');
    if (ef) ef.remove();
}

// Subtasks
function addSubtask(taskId) {
    var inp = document.getElementById('subtask-input-' + taskId);
    if (!inp) return;
    var v = inp.value.trim(); if (!v) return;
    var t = tasks.find(function(x) { return x.id === taskId; });
    if (!t) return;
    if (!t.subtasks) t.subtasks = [];
    t.subtasks.push({ id: Date.now(), text: v, done: false });
    DB.set('os_tasks', tasks); inp.value = ''; renderTasks();
}
function toggleSubtask(taskId, subId) {
    var t = tasks.find(function(x) { return x.id === taskId; });
    if (!t) return;
    var s = (t.subtasks || []).find(function(x) { return x.id === subId; });
    if (s) { s.done = !s.done; DB.set('os_tasks', tasks); renderTasks(); }
}
function deleteSubtask(taskId, subId) {
    var t = tasks.find(function(x) { return x.id === taskId; });
    if (!t) return;
    t.subtasks = (t.subtasks || []).filter(function(x) { return x.id !== subId; });
    DB.set('os_tasks', tasks); renderTasks();
}
function toggleSubtaskInput(taskId) {
    var row = document.getElementById('subtask-add-row-' + taskId);
    if (row) row.classList.toggle('hidden');
    var inp = document.getElementById('subtask-input-' + taskId);
    if (inp && !row.classList.contains('hidden')) inp.focus();
}

function renderTasks() {
    var c = document.getElementById('full-task-list');
    if (!c) return;
    c.innerHTML = '';
    var sorted = tasks.slice().sort(function(a, b) {
        var pa = { high: 0, med: 1, low: 2 }[a.priority] || 2;
        var pb = { high: 0, med: 1, low: 2 }[b.priority] || 2;
        return pa - pb || (a.done ? 1 : 0) - (b.done ? 1 : 0);
    });
    sorted.forEach(function(t) {
        var prioColors = { high: '#ef4444', med: '#f59e0b', low: '#22c55e' };
        var pColor = prioColors[t.priority] || '#6b7280';
        var row = document.createElement('div');
        row.id = 'task-row-' + t.id;
        row.className = 'task-row py-2.5';
        var colorBar = t.color ? 'border-l-4 pl-3' : '';
        var colorStyle = t.color ? 'border-color:' + t.color + ';' : '';
        var subtasksDone = (t.subtasks || []).filter(function(s) { return s.done; }).length;
        var subtasksTotal = (t.subtasks || []).length;
        var subtaskInfo = subtasksTotal > 0 ? '<span class="text-[10px] text-[var(--text-muted)] ml-2">' + subtasksDone + '/' + subtasksTotal + '</span>' : '';

        var subtaskList = '';
        if (subtasksTotal > 0) {
            subtaskList = '<div class="subtask-list" id="subtask-list-' + t.id + '">';
            (t.subtasks || []).forEach(function(s) {
                subtaskList += '<div class="subtask-item' + (s.done ? ' done' : '') + '">'
                    + '<input type="checkbox" ' + (s.done ? 'checked' : '') + ' onchange="toggleSubtask(' + t.id + ',' + s.id + ')" class="w-3 h-3 flex-shrink-0">'
                    + '<span>' + s.text + '</span>'
                    + '<button onclick="deleteSubtask(' + t.id + ',' + s.id + ')" class="ml-auto text-[var(--text-muted)] hover:text-red-400 text-[10px]">\u00d7</button></div>';
            });
            subtaskList += '</div>';
        }

        row.innerHTML = '<div class="flex items-center gap-3 ' + colorBar + '" style="' + colorStyle + '">'
            + '<input type="checkbox" ' + (t.done ? 'checked' : '') + ' onchange="toggleTask(' + t.id + ')" class="w-4 h-4 flex-shrink-0">'
            + '<div class="flex-1 min-w-0">'
            + '<div class="flex items-center gap-2">'
            + '<span class="text-sm ' + (t.done ? 'line-through opacity-50' : '') + ' break-words">' + t.text + '</span>'
            + subtaskInfo
            + '</div>'
            + (t.date ? '<div class="text-[10px] text-[var(--text-muted)] mt-0.5">📅 ' + t.date + '</div>' : '')
            + '</div>'
            + '<div class="flex items-center gap-1.5 flex-shrink-0">'
            + '<div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:' + pColor + '"></div>'
            + '<button onclick="toggleSubtaskInput(' + t.id + ')" class="text-[var(--text-muted)] hover:text-[var(--accent)] transition p-1" title="Subtasks"><i class="ph ph-list-plus text-xs"></i></button>'
            + '<button onclick="startEditTask(' + t.id + ')" class="text-[var(--text-muted)] hover:text-[var(--accent)] transition p-1" title="Edit"><i class="ph ph-pencil-simple text-xs"></i></button>'
            + '<button onclick="deleteTask(' + t.id + ')" class="text-[var(--text-muted)] hover:text-red-400 transition p-1" title="Delete"><i class="ph ph-trash text-xs"></i></button>'
            + '</div></div>'
            + subtaskList
            + '<div class="add-subtask-row hidden" id="subtask-add-row-' + t.id + '">'
            + '<input type="text" id="subtask-input-' + t.id + '" placeholder="Add subtask…" class="bg-transparent text-xs flex-1 outline-none border-b border-[var(--glass-border)] pb-1 focus:border-[var(--accent)] transition" onkeypress="if(event.key===\'Enter\')addSubtask(' + t.id + ')">'
            + '<button onclick="addSubtask(' + t.id + ')" class="text-[var(--accent)] text-xs"><i class="ph-bold ph-plus"></i></button>'
            + '</div>';
        c.appendChild(row);
    });
}
renderTasks();

// ===== DECK GROUPS =====
var deckGroups = DB.get('os_deck_groups', []);
function saveGroup() {
    var inp = document.getElementById('group-name');
    var v = inp ? inp.value.trim() : '';
    if (!v) return;
    deckGroups.push({ id: Date.now(), name: v, open: true });
    DB.set('os_deck_groups', deckGroups);
    if (inp) inp.value = '';
    closeModals(); renderDecks();
}
function deleteGroup(id) {
    showConfirm('Delete Group', 'Decks inside will become ungrouped.', function() {
        deckGroups = deckGroups.filter(function(g) { return g.id !== id; });
        var decks = DB.get('os_decks', []);
        decks.forEach(function(d) { if (d.groupId === id) d.groupId = null; });
        DB.set('os_decks', decks); DB.set('os_deck_groups', deckGroups); renderDecks();
    });
}
function toggleGroupOpen(id) {
    var g = deckGroups.find(function(x) { return x.id === id; });
    if (g) { g.open = !g.open; DB.set('os_deck_groups', deckGroups); renderDecks(); }
}
function populateGroupSelect() {
    var sel = document.getElementById('deck-group-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">No group</option>';
    deckGroups.forEach(function(g) {
        var opt = document.createElement('option');
        opt.value = g.id; opt.innerText = g.name;
        sel.appendChild(opt);
    });
}

// ===== FLASHCARDS =====
var decks = DB.get('os_decks', []);
var activeDeckId = null;
var studyQueue = [], studyIdx = 0, studyMode = 'all';
var cardFlipped = false;
var studyCorrect = 0, studyWrong = 0;
var cardStats = DB.get('os_card_stats', {});
var editingCardIndex = null;

function showDeckList() {
    document.getElementById('cards-deck-view').classList.remove('hidden');
    document.getElementById('cards-edit-view').classList.add('hidden');
    document.getElementById('cards-study-view').classList.add('hidden');
    document.getElementById('cards-match-view').classList.add('hidden');
    document.getElementById('cards-wordsearch-view').classList.add('hidden');
    renderDecks();
}
function showEditView() {
    document.getElementById('cards-deck-view').classList.add('hidden');
    document.getElementById('cards-edit-view').classList.remove('hidden');
    document.getElementById('cards-study-view').classList.add('hidden');
    document.getElementById('cards-match-view').classList.add('hidden');
    document.getElementById('cards-wordsearch-view').classList.add('hidden');
}
function openDeck(id) {
    activeDeckId = id;
    var deck = decks.find(function(d) { return d.id === id; });
    if (!deck) return;
    document.getElementById('edit-deck-title').innerText = deck.name;
    document.getElementById('edit-deck-stats').innerText = (deck.cards || []).length + ' cards';
    document.getElementById('add-card-deck-name').innerText = deck.name;
    renderCardList();
    showEditView();
}
function renderDecks() {
    var c = document.getElementById('decks-container');
    if (!c) return;
    c.innerHTML = '';
    var grouped = {};
    var ungrouped = [];
    decks.forEach(function(d) {
        if (d.groupId) {
            if (!grouped[d.groupId]) grouped[d.groupId] = [];
            grouped[d.groupId].push(d);
        } else { ungrouped.push(d); }
    });

    deckGroups.forEach(function(g) {
        var groupDecks = grouped[g.id] || [];
        var groupDiv = document.createElement('div');
        groupDiv.className = 'mb-3';
        groupDiv.innerHTML = '<div class="deck-group-header flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--glass-hover)] mb-1" onclick="toggleGroupOpen(' + g.id + ')">'
            + '<i class="ph ph-folder text-[var(--accent)] text-base"></i>'
            + '<span class="deck-group-name font-semibold text-sm flex-1">' + g.name + '</span>'
            + '<span class="text-xs text-[var(--text-muted)]">' + groupDecks.length + ' decks</span>'
            + '<i class="ph ph-caret-right text-xs text-[var(--text-muted)] deck-group-chevron' + (g.open ? ' open' : '') + '"></i>'
            + '<button onclick="event.stopPropagation();deleteGroup(' + g.id + ')" class="ml-2 text-[var(--text-muted)] hover:text-red-400 transition text-xs">\u00d7</button>'
            + '</div>'
            + '<div class="deck-group-children pl-4 grid grid-cols-1 md:grid-cols-3 gap-3 ' + (g.open ? '' : 'hidden') + '" id="group-children-' + g.id + '">'
            + groupDecks.map(function(d) { return deckCard(d); }).join('')
            + '</div>';
        c.appendChild(groupDiv);
    });

    if (ungrouped.length > 0) {
        var ug = document.createElement('div');
        ug.className = 'grid grid-cols-1 md:grid-cols-3 gap-3 mt-2';
        ug.innerHTML = ungrouped.map(function(d) { return deckCard(d); }).join('');
        c.appendChild(ug);
    }

    if (decks.length === 0) {
        c.innerHTML = '<div class="text-center py-20 text-[var(--text-muted)]"><i class="ph ph-cards text-4xl mb-3 block"></i><p class="text-sm">No decks yet. Create your first deck!</p></div>';
    }

    updateDashWidgets();
}
function deckCard(d) {
    var count = (d.cards || []).length;
    var hardCount = (d.cards || []).filter(function(c) { return (cardStats[d.id + '_' + c.id] || 0) > 0; }).length;
    return '<div class="min-card p-4 hover-effect cursor-pointer" onclick="openDeck(' + d.id + ')">'
        + '<div class="flex justify-between items-start mb-3">'
        + '<div class="text-2xl">' + (d.emoji || '📖') + '</div>'
        + '<button onclick="event.stopPropagation();deleteDeck(' + d.id + ')" class="text-[var(--text-muted)] hover:text-red-400 transition text-xs">\u00d7</button>'
        + '</div>'
        + '<h3 class="font-semibold text-sm mb-1 truncate">' + d.name + '</h3>'
        + '<div class="text-xs text-[var(--text-muted)]">' + count + ' cards'
        + (hardCount > 0 ? ' · <span class="text-red-400">' + hardCount + ' hard</span>' : '') + '</div>'
        + '</div>';
}
function saveDeck() {
    var name = document.getElementById('deck-name').value.trim();
    if (!name) return;
    var groupId = document.getElementById('deck-group-select').value;
    var emojis = ['📖','🔬','🌍','🎭','🏛️','💡','⚗️','🗺️','🧮','🎵'];
    decks.push({ id: Date.now(), name: name, groupId: groupId ? parseInt(groupId) : null, emoji: emojis[Math.floor(Math.random() * emojis.length)], cards: [] });
    DB.set('os_decks', decks);
    document.getElementById('deck-name').value = '';
    closeModals(); renderDecks();
}
function deleteDeck(id) {
    showConfirm('Delete Deck', 'This will remove the deck and all its cards.', function() {
        decks = decks.filter(function(d) { return d.id !== id; }); DB.set('os_decks', decks); renderDecks();
    });
}
function openAddCardModal() {
    editingCardIndex = null;
    document.getElementById('add-card-modal-title').innerText = 'Add Card';
    document.getElementById('card-q-input').value = '';
    document.getElementById('card-a-input').value = '';
    document.getElementById('card-tip-input').value = '';
    openModal('modal-add-card');
}
function saveFlashcard() {
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck) return;
    var q = document.getElementById('card-q-input').value.trim();
    var a = document.getElementById('card-a-input').value.trim();
    var tip = document.getElementById('card-tip-input').value.trim();
    if (!q || !a) return;
    if (!deck.cards) deck.cards = [];
    if (editingCardIndex !== null) {
        deck.cards[editingCardIndex] = { id: deck.cards[editingCardIndex].id, q: q, a: a, tip: tip };
    } else {
        deck.cards.push({ id: Date.now(), q: q, a: a, tip: tip });
    }
    DB.set('os_decks', decks);
    document.getElementById('edit-deck-stats').innerText = deck.cards.length + ' cards';
    closeModals(); renderCardList(); editingCardIndex = null;
}
function startCardEdit(idx) {
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck) return;
    var card = deck.cards[idx];
    editingCardIndex = idx;
    document.getElementById('add-card-modal-title').innerText = 'Edit Card';
    document.getElementById('card-q-input').value = card.q;
    document.getElementById('card-a-input').value = card.a;
    document.getElementById('card-tip-input').value = card.tip || '';
    openModal('modal-add-card');
}
function deleteCard(idx) {
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck) return;
    deck.cards.splice(idx, 1); DB.set('os_decks', decks);
    document.getElementById('edit-deck-stats').innerText = deck.cards.length + ' cards';
    renderCardList();
}
function renderCardList() {
    var c = document.getElementById('cards-list-container');
    if (!c) return;
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck) return;
    c.innerHTML = '';
    if (!deck.cards || deck.cards.length === 0) {
        c.innerHTML = '<div class="text-center py-10 text-[var(--text-muted)] text-sm">No cards yet. Add your first card!</div>';
        return;
    }
    deck.cards.forEach(function(card, i) {
        var div = document.createElement('div');
        div.className = 'flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[var(--glass-hover)] group transition';
        div.innerHTML = '<div class="flex-1 min-w-0">'
            + '<div class="text-sm font-medium truncate">' + card.q + '</div>'
            + '<div class="text-xs text-[var(--text-muted)] truncate">' + card.a + '</div>'
            + (card.tip ? '<div class="text-[10px] text-yellow-400/70 truncate">💡 ' + card.tip + '</div>' : '')
            + '</div>'
            + '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">'
            + '<button onclick="startCardEdit(' + i + ')" class="text-[var(--text-muted)] hover:text-[var(--accent)] p-1 text-xs"><i class="ph ph-pencil-simple"></i></button>'
            + '<button onclick="deleteCard(' + i + ')" class="text-[var(--text-muted)] hover:text-red-400 p-1 text-xs"><i class="ph ph-trash"></i></button>'
            + '</div>';
        c.appendChild(div);
    });
}
function populateGroupSelectForDeck() { populateGroupSelect(); }

// Study modes
function startStudy(mode) {
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck || !deck.cards || deck.cards.length === 0) { showAlert('No Cards', 'Add some cards to this deck first.'); return; }
    studyMode = mode;
    var cards = deck.cards.slice();
    if (mode === 'hard') cards = cards.filter(function(c) { return (cardStats[activeDeckId + '_' + c.id] || 0) > 0; });
    if (mode === 'starred') cards = cards.filter(function(c) { return c.starred; });
    if (cards.length === 0) { showAlert('None Found', 'No cards match this filter.'); return; }
    if (mode === 'shuffle') {
        cards.sort(function() { return Math.random() - .5; });
        studyMode = 'all';
    } else if (mode !== 'write' && mode !== 'reverse') {
        cards.sort(function() { return Math.random() - .5; });
    }
    if (mode === 'match') { startMatchGame(); return; }
    studyQueue = cards;
    studyIdx = 0; studyCorrect = 0; studyWrong = 0;
    document.getElementById('study-mode-label').innerText = { all: 'All Cards', write: 'Write Mode', reverse: 'Reverse Mode', hard: 'Hard Cards', starred: 'Starred', shuffle: 'Shuffled' }[mode] || 'Study';
    document.getElementById('cards-deck-view').classList.add('hidden');
    document.getElementById('cards-edit-view').classList.add('hidden');
    document.getElementById('cards-study-view').classList.remove('hidden');
    document.getElementById('cards-match-view').classList.add('hidden');
    var writeMode = document.getElementById('study-write-mode');
    var flipMode = document.getElementById('study-flip-mode');
    if (mode === 'write') {
        if (writeMode) writeMode.classList.remove('hidden');
        if (flipMode) flipMode.classList.add('hidden');
    } else {
        if (writeMode) writeMode.classList.add('hidden');
        if (flipMode) flipMode.classList.remove('hidden');
    }
    showStudyCard();
}
function showStudyCard() {
    if (studyIdx >= studyQueue.length) { finishStudy(); return; }
    var card = studyQueue[studyIdx];
    var isReverse = studyMode === 'reverse';
    var q = isReverse ? card.a : card.q;
    var a = isReverse ? card.q : card.a;
    cardFlipped = false;
    var fi = document.getElementById('flashcard-inner');
    if (fi) fi.classList.remove('rotate-y-180');
    document.getElementById('card-front').innerText = q;
    document.getElementById('card-back').innerText = a;
    document.getElementById('card-front-label').innerText = isReverse ? 'Answer' : 'Question';
    document.getElementById('card-back-label').innerText = isReverse ? 'Question' : 'Answer';
    var hintBtn = document.getElementById('hint-btn');
    var hintArea = document.getElementById('card-hint-area');
    if (hintBtn) hintBtn.classList.toggle('hidden', !card.tip);
    if (hintArea) { hintArea.innerHTML = ''; hintArea.classList.add('hidden'); }
    document.getElementById('write-question').innerText = q;
    var wai = document.getElementById('write-answer-input');
    if (wai) wai.value = '';
    var wf = document.getElementById('write-feedback');
    if (wf) { wf.className = 'mt-4 hidden'; wf.innerText = ''; }
    var wha = document.getElementById('write-hint-area');
    if (wha) { wha.innerHTML = ''; wha.classList.add('hidden'); }
    var whb = document.getElementById('write-hint-btn');
    if (whb) whb.classList.toggle('hidden', !card.tip);
    updateStudyProgress();
}
function flipCard() {
    cardFlipped = !cardFlipped;
    var fi = document.getElementById('flashcard-inner');
    if (fi) fi.classList.toggle('rotate-y-180', cardFlipped);
}
function rateCard(rating) {
    var card = studyQueue[studyIdx];
    if (!card) return;
    if (rating === 'hard') {
        studyWrong++;
        var key = activeDeckId + '_' + card.id;
        cardStats[key] = (cardStats[key] || 0) + 1;
        DB.set('os_card_stats', cardStats);
    } else {
        studyCorrect++;
        var key = activeDeckId + '_' + card.id;
        if (cardStats[key] > 0) cardStats[key]--;
        DB.set('os_card_stats', cardStats);
    }
    studyIdx++;
    var fi = document.getElementById('flashcard-inner');
    if (fi) fi.classList.remove('rotate-y-180');
    setTimeout(showStudyCard, 100);
}
function showHint() {
    var card = studyQueue[studyIdx];
    if (!card || !card.tip) return;
    var ha = document.getElementById('card-hint-area');
    if (ha) { ha.innerHTML = '<div class="hint-reveal">💡 ' + card.tip + '</div>'; ha.classList.remove('hidden'); }
}
function showWriteHint() {
    var card = studyQueue[studyIdx];
    if (!card || !card.tip) return;
    var ha = document.getElementById('write-hint-area');
    if (ha) { ha.innerHTML = '<div class="hint-reveal">💡 ' + card.tip + '</div>'; ha.classList.remove('hidden'); }
}
function checkWriteAnswer() {
    var card = studyQueue[studyIdx];
    if (!card) return;
    var wai = document.getElementById('write-answer-input');
    var userAnswer = wai ? wai.value.trim().toLowerCase() : '';
    var isReverse = studyMode === 'reverse';
    var correctAnswer = (isReverse ? card.q : card.a).toLowerCase().trim();
    var correct = userAnswer === correctAnswer || correctAnswer.includes(userAnswer) && userAnswer.length > 2;
    var wf = document.getElementById('write-feedback');
    if (wf) {
        wf.className = 'write-feedback ' + (correct ? 'correct' : 'wrong');
        wf.innerText = correct ? '✓ Correct!' : '✗ Correct answer: ' + (isReverse ? card.q : card.a);
        wf.classList.remove('hidden');
    }
    if (correct) studyCorrect++; else studyWrong++;
    var key = activeDeckId + '_' + card.id;
    if (!correct) cardStats[key] = (cardStats[key] || 0) + 1;
    DB.set('os_card_stats', cardStats);
    updateStudyProgress();
    setTimeout(function() {
        studyIdx++;
        showStudyCard();
    }, 1200);
}
function updateStudyProgress() {
    var total = studyQueue.length;
    var done = studyIdx;
    var pct = total > 0 ? (done / total * 100) : 0;
    var bar = document.getElementById('study-progress');
    if (bar) bar.style.width = pct + '%';
    var counter = document.getElementById('study-counter');
    if (counter) counter.innerText = Math.min(done + 1, total) + '/' + total;
    var sc = document.getElementById('study-correct');
    if (sc) sc.innerText = studyCorrect + ' ✓';
    var sw = document.getElementById('study-wrong');
    if (sw) sw.innerText = studyWrong + ' ✗';
    // Update study stats
    var ss = DB.get('os_study_stats', { today: 0, todayDate: '', bestStreak: 0 });
    var todayStr = new Date().toDateString();
    if (ss.todayDate !== todayStr) { ss.today = 0; ss.todayDate = todayStr; }
    ss.today++;
    if (streak.count > (ss.bestStreak || 0)) ss.bestStreak = streak.count;
    DB.set('os_study_stats', ss);
}
function finishStudy() {
    var total = studyQueue.length;
    var pct = total > 0 ? Math.round(studyCorrect / total * 100) : 0;
    spawnConfetti();
    showAlert('Session Complete! 🎉', 'Score: ' + studyCorrect + '/' + total + ' (' + pct + '%)');
    showEditView();
}

function spawnConfetti() {
    var colors = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
    for (var i = 0; i < 60; i++) {
        (function() {
            var el = document.createElement('div');
            el.className = 'confetti-piece';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.background = colors[Math.floor(Math.random() * colors.length)];
            el.style.animationDuration = (1 + Math.random()) + 's';
            el.style.animationDelay = (Math.random() * 0.5) + 's';
            el.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
            document.body.appendChild(el);
            setTimeout(function() { el.remove(); }, 2500);
        })();
    }
}

function triggerImportDeck() { document.getElementById('import-deck-input').click(); }
function exportDeck() {
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck) return;
    var blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = deck.name + '.json'; a.click();
}
function handleImportDeck(inp) {
    var f = inp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            if (data.name && Array.isArray(data.cards)) {
                data.id = Date.now();
                data.cards.forEach(function(c) { c.id = Date.now() + Math.random(); });
                decks.push(data); DB.set('os_decks', decks); renderDecks();
                showAlert('Imported!', 'Deck "' + data.name + '" added.');
            }
        } catch(err) { showAlert('Error', 'Invalid file format.'); }
    };
    r.readAsText(f);
    inp.value = '';
}

// ===== MATCH GAME =====
var matchSelected = null, matchPairs = [], matchMatched = 0;
function startMatchGame() {
    document.getElementById('cards-deck-view').classList.add('hidden');
    document.getElementById('cards-edit-view').classList.add('hidden');
    document.getElementById('cards-study-view').classList.add('hidden');
    document.getElementById('cards-match-view').classList.remove('hidden');
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck || !deck.cards) return;
    var sample = deck.cards.slice().sort(function() { return Math.random() - .5; }).slice(0, 6);
    matchPairs = sample; matchSelected = null; matchMatched = 0;
    document.getElementById('match-progress').innerText = '0/' + sample.length + ' matched';
    var qs = document.getElementById('match-questions');
    var as = document.getElementById('match-answers');
    qs.innerHTML = ''; as.innerHTML = '';
    var shuffledAnswers = sample.slice().sort(function() { return Math.random() - .5; });
    sample.forEach(function(c) {
        var qel = document.createElement('div');
        qel.className = 'match-card'; qel.innerText = c.q; qel.dataset.id = c.id; qel.dataset.type = 'q';
        qel.onclick = function() { matchClick(this); };
        qs.appendChild(qel);
    });
    shuffledAnswers.forEach(function(c) {
        var ael = document.createElement('div');
        ael.className = 'match-card'; ael.innerText = c.a; ael.dataset.id = c.id; ael.dataset.type = 'a';
        ael.onclick = function() { matchClick(this); };
        as.appendChild(ael);
    });
}
function matchClick(el) {
    if (el.classList.contains('matched')) return;
    if (matchSelected === null) {
        matchSelected = el; el.classList.add('selected');
    } else {
        if (matchSelected === el) { el.classList.remove('selected'); matchSelected = null; return; }
        if (matchSelected.dataset.type === el.dataset.type) {
            matchSelected.classList.remove('selected'); matchSelected = el; el.classList.add('selected');
            return;
        }
        if (matchSelected.dataset.id === el.dataset.id) {
            matchSelected.classList.remove('selected'); matchSelected.classList.add('matched');
            el.classList.add('matched'); matchMatched++;
            document.getElementById('match-progress').innerText = matchMatched + '/' + matchPairs.length + ' matched';
            if (matchMatched === matchPairs.length) { setTimeout(function() { spawnConfetti(); showAlert('You Win! 🎉', 'All pairs matched!'); }, 300); }
        } else {
            matchSelected.classList.add('wrong'); el.classList.add('wrong');
            var a = matchSelected, b = el;
            setTimeout(function() { a.classList.remove('wrong', 'selected'); b.classList.remove('wrong', 'selected'); }, 600);
        }
        matchSelected = null;
    }
}

// ===== WORD SEARCH =====
var wsGrid = [], wsSize = 13, wsPlacements = [], wsFound = [], wsFirstCell = null, wsWords = [];
var wsDirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

function startWordSearch() {
    var deck = decks.find(function(d) { return d.id === activeDeckId; });
    if (!deck || !deck.cards || deck.cards.length === 0) { showAlert('No Cards', 'Add some cards first.'); return; }
    document.getElementById('cards-deck-view').classList.add('hidden');
    document.getElementById('cards-edit-view').classList.add('hidden');
    document.getElementById('cards-study-view').classList.add('hidden');
    document.getElementById('cards-match-view').classList.add('hidden');
    document.getElementById('cards-wordsearch-view').classList.remove('hidden');
    generateWordSearch(deck.cards);
}

function generateWordSearch(cards) {
    wsWords = cards.map(function(c) { return c.q.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12); })
                   .filter(function(w) { return w.length >= 2; }).slice(0, 10);
    wsFound = []; wsFirstCell = null;
    wsGrid = [];
    for (var r = 0; r < wsSize; r++) {
        wsGrid.push([]);
        for (var c = 0; c < wsSize; c++) wsGrid[r].push('');
    }
    wsPlacements = [];
    wsWords.forEach(function(word) {
        var placed = false;
        for (var attempt = 0; attempt < 300 && !placed; attempt++) {
            var dir = wsDirs[Math.floor(Math.random() * wsDirs.length)];
            var startR = Math.floor(Math.random() * wsSize);
            var startC = Math.floor(Math.random() * wsSize);
            if (canPlaceWS(word, startR, startC, dir)) {
                placeWS(word, startR, startC, dir);
                wsPlacements.push({ word: word, r: startR, c: startC, dr: dir[0], dc: dir[1] });
                placed = true;
            }
        }
    });
    var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var r = 0; r < wsSize; r++) {
        for (var c = 0; c < wsSize; c++) {
            if (!wsGrid[r][c]) wsGrid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];
        }
    }
    renderWordSearch();
}

function canPlaceWS(word, r, c, dir) {
    for (var i = 0; i < word.length; i++) {
        var nr = r + dir[0] * i, nc = c + dir[1] * i;
        if (nr < 0 || nr >= wsSize || nc < 0 || nc >= wsSize) return false;
        if (wsGrid[nr][nc] && wsGrid[nr][nc] !== word[i]) return false;
    }
    return true;
}
function placeWS(word, r, c, dir) {
    for (var i = 0; i < word.length; i++) wsGrid[r + dir[0] * i][c + dir[1] * i] = word[i];
}

function renderWordSearch() {
    var container = document.getElementById('ws-grid-container');
    if (!container) return;
    container.style.gridTemplateColumns = 'repeat(' + wsSize + ', 1fr)';
    container.innerHTML = '';
    for (var r = 0; r < wsSize; r++) {
        for (var c = 0; c < wsSize; c++) {
            var cell = document.createElement('div');
            cell.className = 'ws-cell';
            cell.innerText = wsGrid[r][c];
            cell.dataset.r = r; cell.dataset.c = c;
            cell.onclick = (function(row, col) { return function() { handleWSClick(row, col); }; })(r, c);
            container.appendChild(cell);
        }
    }
    var wl = document.getElementById('ws-word-list');
    if (wl) {
        wl.innerHTML = wsWords.map(function(w) {
            var found = wsFound.indexOf(w) >= 0;
            return '<div class="' + (found ? 'line-through text-green-400' : 'text-[var(--text-muted)]') + ' text-xs py-0.5" id="ws-word-' + w + '">' + w + '</div>';
        }).join('');
    }
}

function handleWSClick(r, c) {
    if (wsFirstCell === null) {
        wsFirstCell = { r: r, c: c };
        getWSCell(r, c).classList.add('selected');
    } else {
        var start = wsFirstCell; wsFirstCell = null;
        getWSCell(start.r, start.c).classList.remove('selected');
        checkWSSelection(start.r, start.c, r, c);
    }
}

function getWSCell(r, c) {
    return document.querySelector('.ws-cell[data-r="' + r + '"][data-c="' + c + '"]');
}

function checkWSSelection(r1, c1, r2, c2) {
    var dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    if (dr === 0 && dc === 0) return;
    var letters = '';
    var cells = [];
    var cr = r1, cc = c1;
    while (true) {
        if (cr < 0 || cr >= wsSize || cc < 0 || cc >= wsSize) break;
        letters += wsGrid[cr][cc];
        cells.push({ r: cr, c: cc });
        if (cr === r2 && cc === c2) break;
        cr += dr; cc += dc;
    }
    var match = wsPlacements.find(function(p) {
        var pLetters = '';
        for (var i = 0; i < p.word.length; i++) pLetters += wsGrid[p.r + p.dr * i][p.c + p.dc * i];
        return pLetters === letters && p.r === r1 && p.c === c1 && p.dr === dr && p.dc === dc
            || pLetters === letters && p.r === r2 && p.c === c2 && p.dr === -dr && p.dc === -dc
            || (letters === p.word && cells.length === p.word.length && cells[0].r === p.r && cells[0].c === p.c && dr === p.dr && dc === p.dc)
            || (letters === p.word && cells.length === p.word.length);
    });
    if (match && wsFound.indexOf(match.word) < 0) {
        wsFound.push(match.word);
        // Mark found cells
        for (var i = 0; i < match.word.length; i++) {
            var fc = getWSCell(match.r + match.dr * i, match.c + match.dc * i);
            if (fc) { fc.classList.remove('selected'); fc.classList.add('found'); }
        }
        var wordEl = document.getElementById('ws-word-' + match.word);
        if (wordEl) { wordEl.className = 'line-through text-green-400 text-xs py-0.5'; }
        if (wsFound.length === wsPlacements.length) {
            setTimeout(function() { spawnConfetti(); showAlert('Word Search Complete! 🎉', 'You found all ' + wsFound.length + ' words!'); }, 300);
        }
    }
}

// ===== GRADES =====
var subjects = DB.get('os_subjects', []);
var activeSubjectId = null;

function getBeLabel(avg) {
    if (avg >= 18) return 'Excellent 🌟';
    if (avg >= 16) return 'Very Good';
    if (avg >= 14) return 'Good';
    if (avg >= 12) return 'Satisfactory';
    if (avg >= 10) return 'Sufficient';
    return 'Insufficient ⚠️';
}
function getBeColor(avg) {
    if (avg >= 16) return '#22c55e';
    if (avg >= 12) return '#f59e0b';
    return '#ef4444';
}

function saveSubject() {
    var inp = document.getElementById('subject-name');
    var v = inp ? inp.value.trim() : '';
    if (!v) return;
    subjects.push({ id: Date.now(), name: v, tests: [] });
    DB.set('os_subjects', subjects);
    if (inp) inp.value = '';
    closeModals(); renderGrades();
}
function deleteSubject(id) {
    showConfirm('Delete Subject', 'Remove this subject and all its tests?', function() {
        subjects = subjects.filter(function(s) { return s.id !== id; });
        DB.set('os_subjects', subjects); renderGrades();
    });
}
function openAddTestModal(subjectId) {
    activeSubjectId = subjectId;
    var sub = subjects.find(function(s) { return s.id === subjectId; });
    if (sub) document.getElementById('add-test-subject-name').innerText = sub.name;
    document.getElementById('test-score').value = '';
    document.getElementById('test-max').value = '20';
    document.getElementById('test-name').value = '';
    var tp = document.getElementById('test-practice');
    if (tp) tp.checked = false;
    openModal('modal-add-test');
}
function saveTest() {
    var sub = subjects.find(function(s) { return s.id === activeSubjectId; });
    if (!sub) return;
    var score = parseFloat(document.getElementById('test-score').value);
    var max = parseFloat(document.getElementById('test-max').value) || 20;
    var name = document.getElementById('test-name').value.trim();
    var practice = document.getElementById('test-practice').checked;
    if (isNaN(score)) return;
    if (!sub.tests) sub.tests = [];
    sub.tests.push({ id: Date.now(), score: score, max: max, name: name, practice: practice });
    DB.set('os_subjects', subjects);
    closeModals(); renderGrades(); updateDashWidgets();
}
function deleteTest(subId, testId) {
    var sub = subjects.find(function(s) { return s.id === subId; });
    if (!sub) return;
    sub.tests = sub.tests.filter(function(t) { return t.id !== testId; });
    DB.set('os_subjects', subjects); renderGrades(); updateDashWidgets();
}

function calcSubjectAvg(tests, practiceOnly) {
    var filtered = tests.filter(function(t) { return practiceOnly ? t.practice : !t.practice; });
    if (filtered.length === 0) return null;
    var total = filtered.reduce(function(a, t) { return a + (t.score / t.max * 20); }, 0);
    return total / filtered.length;
}

function renderGrades() {
    // Global averages
    var allRealTests = [];
    var allPracticeTests = [];
    subjects.forEach(function(s) {
        (s.tests || []).forEach(function(t) {
            if (t.practice) allPracticeTests.push(t); else allRealTests.push(t);
        });
    });

    function computeAvg(tests) {
        if (!tests.length) return null;
        return tests.reduce(function(a, t) { return a + (t.score / t.max * 20); }, 0) / tests.length;
    }

    var globalAvg = computeAvg(allRealTests);
    var practiceAvg = computeAvg(allPracticeTests);

    var gaEl = document.getElementById('global-average');
    var galEl = document.getElementById('global-avg-label');
    var gbEl = document.getElementById('global-bar');
    var gletEl = document.getElementById('global-letter');
    var gbeEl = document.getElementById('global-be-label');
    var gpEl = document.getElementById('global-practice-avg');

    if (gaEl) gaEl.innerText = globalAvg !== null ? globalAvg.toFixed(2) + '/20' : '--';
    if (galEl) galEl.innerText = globalAvg !== null ? getBeLabel(globalAvg) : 'No tests yet';
    if (gbEl) gbEl.style.width = (globalAvg !== null ? (globalAvg / 20 * 100) : 0) + '%';
    if (gletEl) { gletEl.innerText = globalAvg !== null ? globalAvg.toFixed(1) : '--'; gletEl.style.color = globalAvg !== null ? getBeColor(globalAvg) : 'var(--accent)'; }
    if (gbeEl) gbeEl.innerText = globalAvg !== null ? getBeLabel(globalAvg) : '--';
    if (gpEl) gpEl.innerText = practiceAvg !== null ? practiceAvg.toFixed(2) + '/20' : '--';

    var c = document.getElementById('subjects-container');
    if (!c) return;
    c.innerHTML = '';
    if (subjects.length === 0) {
        c.innerHTML = '<div class="col-span-2 text-center py-20 text-[var(--text-muted)]"><i class="ph ph-chart-bar text-4xl mb-3 block"></i><p class="text-sm">No subjects yet. Add your first subject!</p></div>';
        return;
    }

    subjects.forEach(function(sub) {
        var realTests = (sub.tests || []).filter(function(t) { return !t.practice; });
        var practTests = (sub.tests || []).filter(function(t) { return t.practice; });
        var avg = calcSubjectAvg(sub.tests || [], false);
        var pAvg = calcSubjectAvg(sub.tests || [], true);
        var pct = avg !== null ? (avg / 20 * 100) : 0;
        var color = avg !== null ? getBeColor(avg) : 'var(--accent)';

        var card = document.createElement('div');
        card.className = 'min-card p-5';

        var testsHTML = '';
        (sub.tests || []).forEach(function(t) {
            var sc20 = (t.score / t.max * 20).toFixed(2);
            testsHTML += '<div class="flex items-center justify-between py-1.5 border-b border-[var(--glass-border)] text-sm">'
                + '<div><span class="' + (t.practice ? 'text-yellow-400' : '') + '">' + (t.name || 'Test') + (t.practice ? ' (practice)' : '') + '</span></div>'
                + '<div class="flex items-center gap-3">'
                + '<span class="font-mono text-xs text-[var(--text-muted)]">' + t.score + '/' + t.max + '</span>'
                + '<span class="font-bold text-sm" style="color:' + getBeColor(parseFloat(sc20)) + '">' + sc20 + '/20</span>'
                + '<button onclick="deleteTest(' + sub.id + ',' + t.id + ')" class="text-[var(--text-muted)] hover:text-red-400 text-xs"><i class="ph ph-trash"></i></button>'
                + '</div></div>';
        });

        var practiceRow = pAvg !== null
            ? '<div class="practice-avg-row mt-3 flex justify-between items-center"><span>Practice Avg</span><span class="font-bold">' + pAvg.toFixed(2) + '/20</span></div>'
            : '';

        card.innerHTML = '<div class="flex justify-between items-start mb-4">'
            + '<div>'
            + '<h3 class="font-semibold text-base">' + sub.name + '</h3>'
            + (avg !== null ? '<div class="text-xs mt-0.5" style="color:' + color + '">' + getBeLabel(avg) + '</div>' : '<div class="text-xs text-[var(--text-muted)]">No tests</div>')
            + '</div>'
            + '<div class="text-right">'
            + '<div class="text-3xl font-light" style="color:' + color + '">' + (avg !== null ? avg.toFixed(2) : '--') + '</div>'
            + '<div class="text-xs text-[var(--text-muted)]">/ 20</div>'
            + '</div>'
            + '</div>'
            + '<div class="h-2 bg-[var(--glass-hover)] rounded-full overflow-hidden mb-4">'
            + '<div style="width:' + pct + '%;background:' + color + ';height:100%;border-radius:2px;transition:width .7s;"></div>'
            + '</div>'
            + practiceRow
            + (sub.tests && sub.tests.length ? '<div class="mt-3 max-h-40 overflow-y-auto">' + testsHTML + '</div>' : '')
            + '<button onclick="openAddTestModal(' + sub.id + ')" class="mt-3 w-full py-2 bg-[var(--glass-hover)] rounded-xl text-xs font-medium hover:bg-[var(--accent)] hover:text-white transition">+ Add Result</button>'
            + '<button onclick="deleteSubject(' + sub.id + ')" class="mt-1 w-full py-1 text-[var(--text-muted)] hover:text-red-400 transition text-xs">Delete subject</button>';

        c.appendChild(card);
    });
}
renderGrades();

// ===== CALENDAR =====
var calEvents = DB.get('os_events', {});
var curM = new Date().getMonth(), curY = new Date().getFullYear();
var curCalView = 'month';
var weekStartDate = new Date();
// Set to Monday of current week
(function() {
    var d = new Date();
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    weekStartDate = new Date(d.setDate(diff));
})();

function switchCalView(view) {
    curCalView = view;
    ['month','week','agenda'].forEach(function(v) {
        var btn = document.getElementById('cal-btn-' + v);
        var panel = document.getElementById('cal-view-' + v);
        if (btn) btn.classList.toggle('active', v === view);
        if (panel) { panel.classList.toggle('hidden', v !== view); panel.style.display = v === view ? 'flex' : 'none'; }
    });
    renderCalendar();
}

function calGoToday() {
    var now = new Date();
    curM = now.getMonth(); curY = now.getFullYear();
    var day = now.getDay();
    var diff = now.getDate() - day + (day === 0 ? -6 : 1);
    weekStartDate = new Date(new Date().setDate(diff));
    renderCalendar();
}

function renderCalendar() {
    if (curCalView === 'month') renderMonthView();
    else if (curCalView === 'week') renderWeekView();
    else renderAgendaView();
}

function changeMonth(d) {
    curM += d;
    if (curM > 11) { curM = 0; curY++; }
    if (curM < 0) { curM = 11; curY--; }
    renderMonthView();
}
function changeWeek(d) {
    weekStartDate = new Date(weekStartDate.getTime() + d * 7 * 86400000);
    renderWeekView();
}

function renderMonthView() {
    var g = document.getElementById('calendar-grid');
    if (!g) return;
    g.innerHTML = '';
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-month-name').innerText = months[curM] + ' ' + curY;
    var fd = new Date(curY, curM, 1).getDay();
    var dim = new Date(curY, curM + 1, 0).getDate();
    var tod = new Date();
    for (var i = 0; i < fd; i++) g.appendChild(document.createElement('div'));
    for (var i = 1; i <= dim; i++) {
        var k = curY + '-' + String(curM + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
        var isT = i === tod.getDate() && curM === tod.getMonth() && curY === tod.getFullYear();
        var evs = calEvents[k] || [];
        var el = document.createElement('div');
        el.className = 'cal-day' + (isT ? ' today' : '');
        var innerHTML = '<span class="cal-day-num">' + i + '</span>';
        evs.slice(0, 3).forEach(function(ev) {
            innerHTML += '<div class="cal-event-tag" style="background:' + (ev.color || 'var(--accent)') + '22;color:' + (ev.color || 'var(--accent)') + ';">' + ev.title + '</div>';
        });
        if (evs.length > 3) innerHTML += '<div class="text-[9px] text-[var(--text-muted)]">+' + (evs.length - 3) + ' more</div>';
        el.innerHTML = innerHTML;
        el.onclick = (function(date) { return function() { openEventModal(date); }; })(k);
        g.appendChild(el);
    }
}

function renderWeekView() {
    var con = document.getElementById('cal-week-container');
    if (!con) return;
    var days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    var today = new Date();
    var dates = [];
    for (var i = 0; i < 7; i++) {
        var d = new Date(weekStartDate.getTime() + i * 86400000);
        dates.push(d);
    }
    var ld = document.getElementById('cal-week-label');
    if (ld) ld.innerText = 'Week of ' + dates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' + dates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    var html = '<div class="cal-week-grid" style="height:100%;">';
    html += '<div class="cal-week-col-header"></div>';
    dates.forEach(function(d, i) {
        var isToday = d.toDateString() === today.toDateString();
        html += '<div class="cal-week-col-header' + (isToday ? ' today-col' : '') + '">' + days[i] + '<br><span style="font-size:.85rem;font-weight:300;">' + d.getDate() + '</span></div>';
    });
    var hours = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
    hours.forEach(function(h) {
        html += '<div class="cal-time-label">' + h + ':00</div>';
        dates.forEach(function(d) {
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            var evs = (calEvents[key] || []).filter(function(ev) {
                if (!ev.time) return h === 8;
                return parseInt(ev.time.split(':')[0]) === h;
            });
            var cellHTML = evs.map(function(ev) {
                return '<div class="cal-week-event" style="background:' + (ev.color || 'var(--accent)') + '">' + ev.title + '</div>';
            }).join('');
            html += '<div class="cal-week-cell" onclick="openEventModal(\'' + key + '\')">' + cellHTML + '</div>';
        });
    });
    html += '</div>';
    con.innerHTML = html;
}

function renderAgendaView() {
    var list = document.getElementById('cal-agenda-list');
    if (!list) return;
    var today = new Date();
    var items = [];
    for (var i = -7; i < 60; i++) {
        var d = new Date(today.getTime() + i * 86400000);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (calEvents[key] && calEvents[key].length) {
            items.push({ date: d, key: key, events: calEvents[key] });
        }
    }
    if (items.length === 0) {
        list.innerHTML = '<div class="text-center py-10 text-[var(--text-muted)] text-sm">No upcoming events in the next 60 days.</div>';
        return;
    }
    var html = '';
    items.forEach(function(item) {
        var dateStr = item.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
        var isToday = item.date.toDateString() === today.toDateString();
        html += '<div class="agenda-date-header' + (isToday ? ' text-[var(--accent)]' : '') + '">' + dateStr + (isToday ? ' · Today' : '') + '</div>';
        item.events.forEach(function(ev, i) {
            html += '<div class="agenda-item" style="border-color:' + (ev.color || 'var(--accent)') + '">'
                + '<div class="flex justify-between items-center">'
                + '<div><div class="text-sm font-medium">' + ev.title + '</div>'
                + (ev.time ? '<div class="text-xs text-[var(--text-muted)] mt-0.5">⏰ ' + ev.time + '</div>' : '')
                + '</div>'
                + '<button onclick="delEv(\'' + item.key + '\',' + i + ')" class="text-[var(--text-muted)] hover:text-red-400 text-xs"><i class="ph ph-trash"></i></button>'
                + '</div></div>';
        });
    });
    list.innerHTML = html;
}

function openEventModal(k) {
    document.getElementById('event-modal-date').innerText = k;
    var l = document.getElementById('event-list-day');
    l.innerHTML = '';
    (calEvents[k] || []).forEach(function(e, i) {
        l.innerHTML += '<div class="flex justify-between py-1.5 border-b border-[var(--glass-border)] text-sm"><span>' + e.title + (e.time ? ' (' + e.time + ')' : '') + '</span><button onclick="delEv(\'' + k + '\',' + i + ')"><i class="ph ph-trash text-sm"></i></button></div>';
    });
    openModal('modal-add-event');
    document.getElementById('event-input').dataset.date = k;
}
function saveCalEvent() {
    var k = document.getElementById('event-input').dataset.date;
    var v = document.getElementById('event-input').value.trim();
    var ti = document.getElementById('event-time').value;
    var rp = document.getElementById('event-repeat').value;
    var c = document.querySelector('input[name="eventColor"]:checked');
    var col = c ? c.value : '#3b82f6';
    if (!v || !k) return;
    if (!calEvents[k]) calEvents[k] = [];
    calEvents[k].push({ title: v, time: ti, color: col });
    if (rp === 'daily') {
        for (var i = 1; i <= 30; i++) {
            var d = new Date(k); d.setDate(d.getDate() + i);
            var nk = d.toISOString().split('T')[0];
            if (!calEvents[nk]) calEvents[nk] = [];
            calEvents[nk].push({ title: v, time: ti, recurring: true, color: col });
        }
    } else if (rp === 'weekly') {
        for (var i = 1; i <= 8; i++) {
            var d = new Date(k); d.setDate(d.getDate() + i * 7);
            var nk = d.toISOString().split('T')[0];
            if (!calEvents[nk]) calEvents[nk] = [];
            calEvents[nk].push({ title: v, time: ti, recurring: true, color: col });
        }
    }
    DB.set('os_events', calEvents);
    document.getElementById('event-input').value = '';
    document.getElementById('event-time').value = '';
    closeModals(); renderCalendar(); updateDashWidgets();
}
function delEv(k, i) {
    calEvents[k].splice(i, 1); DB.set('os_events', calEvents);
    openEventModal(k); renderCalendar();
}
function saveCalendarImport() {
    var u = document.getElementById('cal-url-input').value;
    if (u) {
        DB.set('os_cal_url', u);
        document.getElementById('cal-frame').src = u;
        document.getElementById('calendar-grid-view') && document.getElementById('calendar-grid-view').classList.add('hidden');
        document.getElementById('calendar-iframe-container').classList.remove('hidden');
        closeModals();
    }
}
function clearCalendar() {
    DB.set('os_cal_url', '');
    document.getElementById('calendar-iframe-container').classList.add('hidden');
}
function openCalNewTab() { var u = DB.get('os_cal_url', ''); if (u) window.open(u, '_blank'); }
(function() {
    var cUrl = DB.get('os_cal_url', '');
    if (cUrl) {
        document.getElementById('calendar-iframe-container').classList.remove('hidden');
        document.getElementById('cal-frame').src = cUrl;
    }
})();
switchCalView('month');

// ===== NOTES =====
var notes = DB.get('os_notes', [{ id: 1, title: 'Ideas', body: '' }]);
var activeNote = notes[0] ? notes[0].id : null;
var noteFontActive = 'font-sans';

function renderNotes() {
    var c = document.getElementById('notes-sidebar');
    if (!c) return;
    c.innerHTML = '';
    notes.forEach(function(n) {
        var isActive = n.id === activeNote;
        var div = document.createElement('div');
        div.className = 'flex items-center group rounded-lg ' + (isActive ? 'bg-[var(--glass-panel)]' : '') + ' pr-1';
        div.innerHTML = '<button onclick="loadNote(' + n.id + ')" class="flex-1 text-left p-3 text-sm hover:bg-[var(--glass-hover)] rounded-lg truncate ' + (isActive ? 'font-semibold' : '') + '">' + (n.title || 'Untitled') + '</button>'
            + '<button onclick="confirmDeleteNote(' + n.id + ')" class="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 transition rounded flex-shrink-0"><i class="ph-bold ph-trash text-xs"></i></button>';
        c.appendChild(div);
    });
}
function loadNote(id) {
    activeNote = id;
    var n = notes.find(function(x) { return x.id === id; });
    if (!n) return;
    document.getElementById('note-title').value = n.title || '';
    document.getElementById('note-editor').innerHTML = n.body || '';
    if (n.fontClass) {
        setNoteFont(n.font || 'Inter, sans-serif', n.fontClass, true);
    } else {
        setNoteFont('Inter, sans-serif', 'font-sans', true);
    }
    renderNotes(); updateNoteCount();
}
function saveNote() {
    var n = notes.find(function(x) { return x.id === activeNote; });
    if (!n) return;
    n.title = document.getElementById('note-title').value;
    n.body = document.getElementById('note-editor').innerHTML;
    n.font = document.getElementById('note-editor').style.fontFamily;
    n.fontClass = noteFontActive;
    DB.set('os_notes', notes); renderNotes(); updateNoteCount();
}
function createNewNote() {
    notes.unshift({ id: Date.now(), title: '', body: '' });
    DB.set('os_notes', notes); loadNote(notes[0].id);
}
function confirmDeleteNote(id) {
    showConfirm('Delete Note', 'This cannot be undone.', function() { deleteNote(id); });
}
function deleteCurrentNote() { if (activeNote) confirmDeleteNote(activeNote); }
function deleteNote(id) {
    notes = notes.filter(function(x) { return x.id !== id; });
    if (!notes.length) notes = [{ id: Date.now(), title: 'New Note', body: '' }];
    DB.set('os_notes', notes); activeNote = notes[0].id; loadNote(activeNote);
}
function formatDoc(cmd, value) {
    document.getElementById('note-editor').focus();
    if (value !== undefined) document.execCommand(cmd, false, value);
    else document.execCommand(cmd, false, null);
    saveNote();
}
function noteInsertCheckbox() {
    document.getElementById('note-editor').focus();
    document.execCommand('insertHTML', false,
        '<label style="display:flex;align-items:center;gap:8px;margin:4px 0;"><input type="checkbox" onchange="this.nextElementSibling.style.textDecoration=this.checked?\'line-through\':\'none\'"> <span>Task item</span></label><br>');
    saveNote();
}
function noteHighlight(c) {
    document.getElementById('note-editor').focus();
    document.execCommand('hiliteColor', false, c); saveNote();
}
function noteTextColor(c) {
    document.getElementById('note-editor').focus();
    document.execCommand('foreColor', false, c); saveNote();
}
function setNoteFont(font, cls, silent) {
    // Apply font to whole note editor
    document.getElementById('note-editor').style.fontFamily = font;
    noteFontActive = cls;
    document.querySelectorAll('.font-opt').forEach(function(b) { b.classList.remove('active-font'); });
    var btn = document.getElementById(cls);
    if (btn) btn.classList.add('active-font');
    if (!silent) { saveNote(); }
}

// Prevent Enter from creating new checkbox inside label
document.getElementById('note-editor').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        var sel = window.getSelection();
        if (sel && sel.focusNode) {
            var node = sel.focusNode;
            // Walk up to see if we're inside a label (checkbox row)
            var p = node;
            while (p && p !== this) {
                if (p.nodeName === 'LABEL') {
                    e.preventDefault();
                    document.execCommand('insertHTML', false, '<br>');
                    return;
                }
                p = p.parentNode;
            }
        }
    }
});

function updateNoteCount() {
    var tx = document.getElementById('note-editor').innerText;
    var w = tx.trim() ? tx.trim().split(/\s+/).length : 0;
    var el = document.getElementById('note-stats');
    if (el) el.innerText = w + ' words, ' + tx.length + ' chars';
}
document.getElementById('note-title').addEventListener('input', saveNote);
document.getElementById('note-editor').addEventListener('input', function() { saveNote(); updateNoteCount(); });

function noteInsertImage(inp) {
    var f = inp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(e) {
        document.getElementById('note-editor').focus();
        document.execCommand('insertHTML', false, '<img src="' + e.target.result + '" style="max-width:100%;border-radius:8px;margin:4px 0;" onclick="this.classList.toggle(\'selected-img\')">');
        saveNote();
    };
    r.readAsDataURL(f); inp.value = '';
}

// Sticker panel
var stickers = ['😀','😂','😍','🤔','😎','🥳','😢','😡','🤯','🥺',
    '👍','👎','✌️','🙌','💪','🤝','👏','🫶','❤️','🔥',
    '⭐','💡','📌','📎','🔖','✅','❌','⚡','🎉','🎨',
    '📚','✏️','📝','🔬','🧮','🗓️','⏰','🏆','🎯','🚀',
    '🌈','🌟','💫','🍀','🌺','🦋','🐉','🦊','🐱','🌙'];
(function() {
    var grid = document.getElementById('sticker-grid');
    if (!grid) return;
    stickers.forEach(function(s) {
        var span = document.createElement('span');
        span.className = 'sticker-item';
        span.innerText = s;
        span.onclick = function() { insertSticker(s); };
        grid.appendChild(span);
    });
})();

function toggleStickerPanel(btn) {
    var panel = document.getElementById('sticker-panel');
    if (!panel) return;
    panel.classList.toggle('open');
    document.addEventListener('click', function closeSP(e) {
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove('open');
            document.removeEventListener('click', closeSP);
        }
    });
}
function insertSticker(s) {
    document.getElementById('note-editor').focus();
    document.execCommand('insertText', false, s);
    saveNote();
    document.getElementById('sticker-panel').classList.remove('open');
}

renderNotes();
if (notes[0]) loadNote(notes[0].id);

// ===== WHITEBOARD =====
var canvas = document.getElementById('wb-canvas');
var ctx = canvas.getContext('2d');

// State
var wbTool = 'pen';
var wbPenColor = '#ffffff';
var wbDrawing = false;
var wbStartX = 0, wbStartY = 0;
var wbLastX = 0, wbLastY = 0;
var wbHistory = [];
var wbHistoryIndex = -1;
var wbGridOn = false;
var wbFull = false;
var wbSnapshot = null;          // ImageData snapshot for shape preview
var wbSelectStart = null;       // {x,y} of selection drag start
var wbSelectRect  = null;       // {x,y,w,h} of committed selection
var wbPreSelectData = null;     // full-canvas ImageData captured before selection drag
var wbBoards = DB.get('os_boards', [{ id: 1, name: 'Board 1', data: null }]);
var wbActiveBoardId = wbBoards[0].id;

// ── helpers ──────────────────────────────────────────────
function wbGetBg() {
    return DB.get('os_wb_bg_' + wbActiveBoardId, '#1a1a1a');
}
function wbFillBg() {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = wbGetBg();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (wbGridOn) wbDrawGrid();
}
function wbDrawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.5;
    for (var x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (var y = 0; y < canvas.height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    ctx.restore();
}
function wbPushHistory() {
    wbHistory = wbHistory.slice(0, wbHistoryIndex + 1);
    wbHistory.push(canvas.toDataURL());
    if (wbHistory.length > 50) { wbHistory.shift(); }
    wbHistoryIndex = wbHistory.length - 1;
}
function wbRestoreFromDataUrl(dataUrl, cb) {
    var img = new Image();
    img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        if (cb) cb();
    };
    img.src = dataUrl;
}

// ── resize ───────────────────────────────────────────────
function wbResizeCanvas() {
    var con = document.getElementById('wb-container');
    if (!con || con.clientWidth === 0) return;
    // Save current drawing as data URL before resize
    var saved = (canvas.width > 0 && canvas.height > 0) ? canvas.toDataURL() : null;
    canvas.width  = con.clientWidth;
    canvas.height = con.clientHeight;
    wbFillBg();
    if (saved) {
        var img = new Image();
        img.onload = function() { ctx.drawImage(img, 0, 0); };
        img.src = saved;
    }
}
window.addEventListener('resize', function() {
    // Only resize if whiteboard tab is visible
    if (!document.getElementById('view-whiteboard').classList.contains('hidden')) {
        wbResizeCanvas();
    }
});

// ── tool switching ────────────────────────────────────────
function wbSetTool(t) {
    wbTool = t;
    document.querySelectorAll('[id^="wb-tool-"]').forEach(function(b) {
        b.classList.remove('active-tool');
    });
    var btn = document.getElementById('wb-tool-' + t);
    if (btn) btn.classList.add('active-tool');
    var cursors = { pen: 'crosshair', eraser: 'cell', select: 'crosshair',
                    line: 'crosshair', rect: 'crosshair', circle: 'crosshair',
                    arrow: 'crosshair', text: 'text' };
    canvas.style.cursor = cursors[t] || 'crosshair';
    // Dismiss selection UI when switching away
    if (t !== 'select') wbClearSelection();
}
function setPenColor(c) { wbPenColor = c; }
function setWbBg(c) {
    DB.set('os_wb_bg_' + wbActiveBoardId, c);
    // Redraw: fill new bg then replay last history frame on top
    wbFillBg();
    if (wbHistoryIndex >= 0) {
        wbRestoreFromDataUrl(wbHistory[wbHistoryIndex]);
    }
    wbPushHistory();
    wbSaveBoard();
}

// ── undo / redo ───────────────────────────────────────────
function wbUndo() {
    if (wbHistoryIndex <= 0) return;
    wbHistoryIndex--;
    wbRestoreFromDataUrl(wbHistory[wbHistoryIndex]);
    wbSaveBoard();
}
function wbRedo() {
    if (wbHistoryIndex >= wbHistory.length - 1) return;
    wbHistoryIndex++;
    wbRestoreFromDataUrl(wbHistory[wbHistoryIndex]);
    wbSaveBoard();
}

// ── grid ──────────────────────────────────────────────────
function wbToggleGrid() {
    wbGridOn = !wbGridOn;
    var btn = document.getElementById('wb-grid-btn');
    if (btn) btn.classList.toggle('active-tool', wbGridOn);
    // Redraw bg (which calls drawGrid if on) then replay drawing
    var saved = (wbHistoryIndex >= 0) ? wbHistory[wbHistoryIndex] : null;
    wbFillBg();
    if (saved) {
        var img = new Image();
        img.onload = function() { ctx.drawImage(img, 0, 0); };
        img.src = saved;
    }
}

// ── pointer events ────────────────────────────────────────
function wbGetXY(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width  / rect.width;
    var scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY
    };
}

canvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    var p = wbGetXY(e);

    if (wbTool === 'text') {
        wbStartX = p.x; wbStartY = p.y;
        document.getElementById('wb-text-size').oninput = function() {
            document.getElementById('wb-text-size-disp').innerText = this.value + 'px';
        };
        openModal('modal-wb-text');
        return;
    }

    if (wbTool === 'select') {
        wbClearSelection();
        wbSelectStart = { x: p.x, y: p.y };
        wbPreSelectData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        wbDrawing = true;
        return;
    }

    wbDrawing = true;
    wbStartX = p.x; wbStartY = p.y;
    wbLastX  = p.x; wbLastY  = p.y;

    // For shapes, grab snapshot now so we can redraw clean each frame
    if (wbTool !== 'pen' && wbTool !== 'eraser') {
        wbSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    if (wbTool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        // Put a dot for single clicks
        ctx.arc(p.x, p.y, wbGetSize() / 2, 0, Math.PI * 2);
        ctx.fillStyle = wbPenColor;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }
});

canvas.addEventListener('pointermove', function(e) {
    if (!wbDrawing) return;
    e.preventDefault();
    var p = wbGetXY(e);
    var size = wbGetSize();

    // ── selection drag ──
    if (wbTool === 'select' && wbSelectStart) {
        var sx = Math.min(p.x, wbSelectStart.x);
        var sy = Math.min(p.y, wbSelectStart.y);
        var sw = Math.abs(p.x - wbSelectStart.x);
        var sh = Math.abs(p.y - wbSelectStart.y);
        // Show overlay div
        var ov = document.getElementById('wb-select-overlay');
        var con = document.getElementById('wb-container');
        var cRect = con.getBoundingClientRect();
        var scale = canvas.width / cRect.width;
        ov.style.display = 'block';
        ov.style.left   = (sx / scale) + 'px';
        ov.style.top    = (sy / scale) + 'px';
        ov.style.width  = (sw / scale) + 'px';
        ov.style.height = (sh / scale) + 'px';
        wbSelectRect = { x: sx, y: sy, w: sw, h: sh };
        return;
    }

    // ── pen ──
    if (wbTool === 'pen') {
        ctx.lineWidth   = size;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.strokeStyle = wbPenColor;
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        wbLastX = p.x; wbLastY = p.y;
        return;
    }

    // ── eraser – paint bg color, never transparent ──
    if (wbTool === 'eraser') {
        ctx.lineWidth   = size * 4;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.strokeStyle = wbGetBg();
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(wbLastX, wbLastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        wbLastX = p.x; wbLastY = p.y;
        return;
    }

    // ── shapes – restore snapshot each frame ──
    if (!wbSnapshot) return;
    ctx.putImageData(wbSnapshot, 0, 0);
    ctx.strokeStyle = wbPenColor;
    ctx.fillStyle   = wbPenColor;
    ctx.lineWidth   = size;
    ctx.lineCap     = 'round';
    ctx.globalCompositeOperation = 'source-over';

    ctx.beginPath();
    if (wbTool === 'line') {
        ctx.moveTo(wbStartX, wbStartY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    } else if (wbTool === 'rect') {
        ctx.strokeRect(wbStartX, wbStartY, p.x - wbStartX, p.y - wbStartY);
    } else if (wbTool === 'circle') {
        var rx = (p.x - wbStartX) / 2;
        var ry = (p.y - wbStartY) / 2;
        var cx = wbStartX + rx;
        var cy = wbStartY + ry;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, Math.abs(ry / (rx || 1)));
        ctx.arc(0, 0, Math.abs(rx), 0, Math.PI * 2);
        ctx.restore();
        ctx.stroke();
    } else if (wbTool === 'arrow') {
        var angle = Math.atan2(p.y - wbStartY, p.x - wbStartX);
        var headLen = Math.max(12, size * 4);
        ctx.moveTo(wbStartX, wbStartY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - headLen * Math.cos(angle - 0.4), p.y - headLen * Math.sin(angle - 0.4));
        ctx.lineTo(p.x - headLen * Math.cos(angle + 0.4), p.y - headLen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
    }
});

canvas.addEventListener('pointerup', function(e) {
    if (!wbDrawing) return;
    wbDrawing = false;
    ctx.globalCompositeOperation = 'source-over';
    wbSnapshot = null;

    if (wbTool === 'select' && wbSelectRect && wbSelectRect.w > 4 && wbSelectRect.h > 4) {
        // Show selection toolbar
        var tb = document.getElementById('wb-select-toolbar');
        var con = document.getElementById('wb-container');
        var cRect = con.getBoundingClientRect();
        var scale = canvas.width / cRect.width;
        if (tb) {
            tb.style.display = 'flex';
            tb.style.left = (wbSelectRect.x / scale) + 'px';
            tb.style.top  = ((wbSelectRect.y + wbSelectRect.h) / scale + 6) + 'px';
        }
        return; // don't push history yet
    }

    wbPushHistory();
    wbSaveBoard();
});

canvas.addEventListener('pointercancel', function() {
    wbDrawing = false;
    wbSnapshot = null;
    ctx.globalCompositeOperation = 'source-over';
});

// ── selection helpers ─────────────────────────────────────
function wbClearSelection() {
    wbSelectRect = null; wbSelectStart = null; wbPreSelectData = null;
    var ov = document.getElementById('wb-select-overlay');
    if (ov) ov.style.display = 'none';
    var tb = document.getElementById('wb-select-toolbar');
    if (tb) tb.style.display = 'none';
}
function wbDeleteSelection() {
    if (!wbSelectRect || !wbPreSelectData) return;
    // Restore canvas to pre-drag state, then erase the selected region with bg color
    ctx.putImageData(wbPreSelectData, 0, 0);
    ctx.fillStyle = wbGetBg();
    ctx.fillRect(wbSelectRect.x, wbSelectRect.y, wbSelectRect.w, wbSelectRect.h);
    wbClearSelection();
    wbPushHistory();
    wbSaveBoard();
}
function wbMoveSelection() {
    if (!wbSelectRect || !wbPreSelectData) return;
    // Copy the selected pixels
    var selData = ctx.getImageData(wbSelectRect.x, wbSelectRect.y, wbSelectRect.w, wbSelectRect.h);
    // Restore pre-drag state
    ctx.putImageData(wbPreSelectData, 0, 0);
    // Erase source area
    ctx.fillStyle = wbGetBg();
    ctx.fillRect(wbSelectRect.x, wbSelectRect.y, wbSelectRect.w, wbSelectRect.h);
    // Paste 20px offset
    ctx.putImageData(selData, wbSelectRect.x + 20, wbSelectRect.y + 20);
    wbClearSelection();
    wbPushHistory();
    wbSaveBoard();
}

// ── text ──────────────────────────────────────────────────
function confirmWbText() {
    var txt = document.getElementById('wb-text-input').value.trim();
    var sz  = parseInt(document.getElementById('wb-text-size').value) || 18;
    if (!txt) { closeModals(); return; }
    ctx.font      = sz + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = wbPenColor;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillText(txt, wbStartX, wbStartY + sz); // +sz so text appears below click point
    document.getElementById('wb-text-input').value = '';
    closeModals();
    wbPushHistory();
    wbSaveBoard();
}

// ── image insert ──────────────────────────────────────────
function wbInsertImage(inp) {
    var f = inp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var maxW = canvas.width  * 0.6;
            var maxH = canvas.height * 0.6;
            var ratio = Math.min(maxW / img.width, maxH / img.height, 1);
            ctx.drawImage(img, 20, 20, img.width * ratio, img.height * ratio);
            wbPushHistory();
            wbSaveBoard();
        };
        img.src = e.target.result;
    };
    r.readAsDataURL(f);
    inp.value = '';
}

// ── misc ──────────────────────────────────────────────────
function wbGetSize() {
    return parseInt(document.getElementById('wb-size').value) || 3;
}
function clearCanvas() {
    showConfirm('Clear Canvas', 'Erase everything on this board?', function() {
        wbFillBg();
        wbPushHistory();
        wbSaveBoard();
    });
}
function downloadWhiteboard() {
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'whiteboard.png';
    a.click();
}
function wbToggleFullscreen() {
    wbFull = !wbFull;
    var view = document.getElementById('view-whiteboard');
    var icon = document.getElementById('wb-fs-icon');
    if (wbFull) {
        view.style.cssText = 'position:fixed;inset:0;z-index:200;padding:12px;background:var(--bg-color);';
        if (icon) icon.className = 'ph-bold ph-arrows-in';
    } else {
        view.style.cssText = '';
        if (icon) icon.className = 'ph-bold ph-arrows-out';
    }
    setTimeout(wbResizeCanvas, 80);
}

// ── boards ────────────────────────────────────────────────
function wbSaveBoard() {
    var b = wbBoards.find(function(x) { return x.id === wbActiveBoardId; });
    if (b) {
        b.data = canvas.toDataURL();
        DB.set('os_boards', wbBoards);
    }
}
function wbRenderTabs() {
    var tc = document.getElementById('wb-tabs');
    if (!tc) return;
    tc.innerHTML = '';
    wbBoards.forEach(function(b) {
        var btn = document.createElement('button');
        btn.className = 'wb-tab' + (b.id === wbActiveBoardId ? ' active-tab' : '');
        btn.innerText = b.name;
        btn.onclick = (function(id) { return function() { wbSwitchBoard(id); }; })(b.id);
        tc.appendChild(btn);
    });
}
function wbSwitchBoard(id) {
    wbSaveBoard();
    wbActiveBoardId = id;
    wbHistory = []; wbHistoryIndex = -1;
    var b = wbBoards.find(function(x) { return x.id === id; });
    wbFillBg();
    if (b && b.data) {
        wbRestoreFromDataUrl(b.data, function() { wbPushHistory(); });
    } else {
        wbPushHistory();
    }
    wbRenderTabs();
}
function wbNewBoard() {
    wbSaveBoard();
    var b = { id: Date.now(), name: 'Board ' + (wbBoards.length + 1), data: null };
    wbBoards.push(b);
    DB.set('os_boards', wbBoards);
    wbActiveBoardId = b.id;
    wbHistory = []; wbHistoryIndex = -1;
    wbFillBg();
    wbPushHistory();
    wbRenderTabs();
}
function wbDeleteBoard() {
    if (wbBoards.length <= 1) { showAlert('Cannot Delete', 'You need at least one board.'); return; }
    showConfirm('Delete Board', 'Remove this board?', function() {
        wbBoards = wbBoards.filter(function(b) { return b.id !== wbActiveBoardId; });
        DB.set('os_boards', wbBoards);
        wbActiveBoardId = wbBoards[0].id;
        wbHistory = []; wbHistoryIndex = -1;
        var b = wbBoards[0];
        wbFillBg();
        if (b.data) {
            wbRestoreFromDataUrl(b.data, function() { wbPushHistory(); });
        } else {
            wbPushHistory();
        }
        wbRenderTabs();
    });
}

// Alias old function names used in HTML onclick attributes
var boards          = wbBoards;          // keep compat
function renderWbTabs()    { wbRenderTabs(); }
function switchBoard(id)   { wbSwitchBoard(id); }
function saveBoard()       { wbSaveBoard(); }

// Size slider live display
document.getElementById('wb-size').addEventListener('input', function() {
    document.getElementById('wb-size-display').innerText = this.value + 'px';
});

// ── initialise when whiteboard tab is first opened ────────
// We hook into switchTab to init the canvas at the right time
var _wbInitDone = false;
function wbInit() {
    if (_wbInitDone) return;
    _wbInitDone = true;
    wbResizeCanvas();
    var b = wbBoards.find(function(x) { return x.id === wbActiveBoardId; });
    if (b && b.data) {
        wbRestoreFromDataUrl(b.data, function() { wbPushHistory(); });
    } else {
        wbFillBg();
        wbPushHistory();
    }
    wbRenderTabs();
    // Set default tool active in toolbar
    wbSetTool('pen');
}

// Patch switchTab to call wbInit when whiteboard is opened
(function() {
    var _origSwitchTab = switchTab;
    switchTab = function(name) {
        _origSwitchTab(name);
        if (name === 'whiteboard') { setTimeout(wbInit, 30); }
    };
})();

// ===== CALCULATOR =====
var cExp = '';
var cSciMode = false;
function calcAppend(v) {
    cExp += v;
    document.getElementById('calc-result').innerText = cExp || '0';
}
function calcClear() {
    cExp = '';
    document.getElementById('calc-result').innerText = '0';
    document.getElementById('calc-history').innerText = '';
}
function calcBackspace() {
    cExp = cExp.slice(0, -1);
    document.getElementById('calc-result').innerText = cExp || '0';
}
function calcSolve() {
    try {
        document.getElementById('calc-history').innerText = cExp + ' =';
        // Replace math constants and functions
        var expr = cExp
            .replace(/π/g, 'Math.PI')
            .replace(/e(?!\d)/g, 'Math.E')
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/asin\(/g, 'Math.asin(')
            .replace(/acos\(/g, 'Math.acos(')
            .replace(/atan\(/g, 'Math.atan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/sqrt\(/g, 'Math.sqrt(')
            .replace(/abs\(/g, 'Math.abs(')
            .replace(/\^/g, '**');
        var result = Function('"use strict"; return (' + expr + ')')();
        var rounded = parseFloat(result.toPrecision(12));
        cExp = String(rounded);
        document.getElementById('calc-result').innerText = cExp;
    } catch(e) {
        document.getElementById('calc-result').innerText = 'Error';
    }
}
function calcSciFunc(fn) {
    var funcs = {
        sin: 'sin(', cos: 'cos(', tan: 'tan(',
        asin: 'asin(', acos: 'acos(', atan: 'atan(',
        log: 'log(', ln: 'ln(', sqrt: 'sqrt(',
        sq: '^2', pow: '^', abs: 'abs(',
        pi: 'π', e: 'e', open: '(', close: ')'
    };
    calcAppend(funcs[fn] || fn);
}
function calcToggleSci() {
    cSciMode = !cSciMode;
    var btn = document.getElementById('calc-sci-btn');
    if (btn) btn.classList.toggle('text-[var(--accent)]', cSciMode);
    document.querySelectorAll('.sci-btn').forEach(function(b) {
        b.classList.toggle('hidden', !cSciMode);
    });
}

// ===== DATA IMPORT / EXPORT =====
function exportAllData() {
    var data = {
        os_decks: DB.get('os_decks', []),
        os_tasks: DB.get('os_tasks', []),
        os_notes: DB.get('os_notes', []),
        os_goals: DB.get('os_goals', []),
        os_events: DB.get('os_events', {}),
        os_subjects: DB.get('os_subjects', []),
        os_links: DB.get('os_links', []),
        os_card_stats: DB.get('os_card_stats', {}),
        os_deck_groups: DB.get('os_deck_groups', []),
        os_streak: DB.get('os_streak', {}),
        os_quick_note: DB.get('os_quick_note', ''),
        exported: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'studentOS-backup-' + new Date().toISOString().split('T')[0] + '.json'; a.click();
}
function importAllData(inp) {
    var f = inp.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            Object.keys(data).forEach(function(k) { if (k !== 'exported') DB.set(k, data[k]); });
            showAlert('Imported!', 'All data restored. Reloading...');
            setTimeout(function() { location.reload(); }, 1200);
        } catch(err) { showAlert('Error', 'Invalid backup file.'); }
    };
    r.readAsText(f); inp.value = '';
}
function resetAllData() {
    showConfirm('Reset All Data', 'This will erase EVERYTHING permanently. Are you sure?', function() {
        localStorage.clear(); location.reload();
    });
}

// ===== FINAL INITS =====
updateInterfaceText();
renderDecks();
populateGroupSelect();

// Open deck modal: populate groups
var origOpenDeckModal = window.openModal;
// When opening modal-add-deck, also populate the group select
(function() {
    var origOpenModal = openModal;
    window.openModal = function(id) {
        origOpenModal(id);
        if (id === 'modal-add-deck') populateGroupSelect();
    };
})();
