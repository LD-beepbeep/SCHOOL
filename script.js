// ===== FIREBASE IMPORTS =====
import { initializeApp }                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signInWithRedirect, getRedirectResult,
         signInWithEmailAndPassword, createUserWithEmailAndPassword,
         sendPasswordResetEmail, sendEmailVerification,
         onAuthStateChanged, signOut }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCN79mExeAMLpL6XTgGzyN9LUAgTEdZOUg",
    authDomain: "student-os-e0962.firebaseapp.com",
    projectId: "student-os-e0962",
    storageBucket: "student-os-e0962.firebasestorage.app",
    messagingSenderId: "1074050160438",
    appId: "1:1074050160438:web:0ba8fd5ebd3ab0c5a64597"
};
const _fbApp  = initializeApp(firebaseConfig);
const _auth   = getAuth(_fbApp);
const _db     = getFirestore(_fbApp);
let   _uid    = null;

// ===== DATABASE (cache-backed, Firestore-synced) =====
// All DB.get/set calls in the rest of the file stay synchronous.
// The cache is populated from Firestore once on login, then every
// DB.set also schedules a debounced write back to Firestore.
var DB = (function() {
    var _cache = {};
    var _saveTimer = null;

    function _persistToFirestore() {
        if (!_uid) return;
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(async function() {
            try {
                await setDoc(doc(_db, 'users', _uid), _cache, { merge: true });
            } catch(e) {
                console.error('Firestore write failed:', e);
            }
        }, 800); // debounce: batch rapid saves into one write
    }

    return {
        // Called once after Firestore data is fetched — seeds the cache
        _hydrate: function(data) {
            _cache = data || {};
        },

        get: function(key, def) {
            return (key in _cache) ? _cache[key] : def;
        },

        set: function(key, val) {
            _cache[key] = val;
            _persistToFirestore();
        }
    };
})();

window.DB = DB;

// ===== AUTH FUNCTIONS =====

async function signInWithGoogle() {
    _setLoginLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(_auth, provider);
        // onAuthStateChanged fires next and boots the app
    } catch(e) {
        _setLoginLoading(false);
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            showLoginError(_friendlyAuthError(e.code));
        }
    }
}

onAuthStateChanged(_auth, async function(user) {
    const overlay = document.getElementById('login-overlay');

// ✅ REPLACE WITH
if (!user) {
    _uid = null;
    if (overlay) overlay.classList.remove('hidden');
    _setLoginLoading(false);
    return;
}

_uid = user.uid;

    // Show loading spinner
    if (overlay) overlay.innerHTML = `
        <div class="absolute inset-0" style="background:var(--bg-color);"></div>
        <div class="relative z-10 flex flex-col items-center gap-4">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style="background:var(--accent);box-shadow:0 8px 24px rgba(59,130,246,0.4);">
                <i class="ph-bold ph-student text-3xl text-white"></i>
            </div>
            <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"
                 stroke="var(--accent)" stroke-width="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
            <p class="text-sm" style="color:var(--text-muted);">Loading your workspace…</p>
        </div>`;

    try {
        const userRef = doc(_db, 'users', _uid);
        // ✅ ONE getDoc — reused everywhere below, no second fetch
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            // New user — try to migrate localStorage, else write defaults
            const localData = _collectLocalStorage();
            if (localData) {
                localData._migratedFromLocal = true;
                localData._migratedAt = new Date().toISOString();
                await setDoc(userRef, localData);
                DB._hydrate(localData);           // ✅ hydrate from memory, no 3rd fetch
                _clearLocalStorage();
                console.log('✅ Migrated localStorage → Firestore');
            } else {
                const defaults = _defaultUserDoc();
                await setDoc(userRef, defaults);
                DB._hydrate(defaults);            // ✅ hydrate from memory, no 3rd fetch
            }
        } else {
            const data = snap.data();
            // Returning user who hasn't been migrated yet
            if (!data._migratedFromLocal) {
                const localData = _collectLocalStorage();
                if (localData) {
                    // Merge local into existing cloud data (cloud wins on conflict)
                    const merged = Object.assign({}, localData, data);
                    merged._migratedFromLocal = true;
                    merged._migratedAt = new Date().toISOString();
                    await setDoc(userRef, merged, { merge: true });
                    DB._hydrate(merged);          // ✅ hydrate from memory, no 3rd fetch
                    _clearLocalStorage();
                    console.log('✅ Merged localStorage into existing Firestore doc');
                } else {
                    // No local data, just mark as checked so we never run this branch again
                    await setDoc(userRef, { _migratedFromLocal: true }, { merge: true });
                    DB._hydrate(Object.assign({}, data, { _migratedFromLocal: true }));
                }
            } else {
                // ✅ Happy path — returning user, already migrated: just hydrate
                DB._hydrate(data);
            }
        }

    } catch(e) {
        console.error('Firestore bootstrap failed:', e);
        DB._hydrate({});
    }

    if (overlay) overlay.classList.add('hidden');
    initApp();
});

async function signInWithEmail() {
    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) return showLoginError('Please enter your email and password.');
    _setLoginLoading(true);
    try {
        await signInWithEmailAndPassword(_auth, email, password);
    } catch(e) {
        _setLoginLoading(false);
        showLoginError(_friendlyAuthError(e.code));
    }
}

async function signUpWithEmail() {
    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) return showLoginError('Please enter your email and password.');
    if (password.length < 6)  return showLoginError('Password must be at least 6 characters.');
    _setLoginLoading(true);
    try {
        const cred = await createUserWithEmailAndPassword(_auth, email, password);
        // Send verification email immediately after sign-up
        await sendEmailVerification(cred.user);
        showLoginSuccess('Account created! Check your inbox to verify your email.');
    } catch(e) {
        _setLoginLoading(false);
        showLoginError(_friendlyAuthError(e.code));
    }
}

async function resetPassword() {
    const email = document.getElementById('login-email')?.value.trim();
    if (!email) return showLoginError('Enter your email address above first.');
    try {
        await sendPasswordResetEmail(_auth, email);
        showLoginSuccess('Password reset email sent! Check your inbox.');
    } catch(e) {
        showLoginError(_friendlyAuthError(e.code));
    }
}

async function resendVerificationEmail() {
    const user = _auth.currentUser;
    if (!user) return;
    try {
        await sendEmailVerification(user);
        showLoginSuccess('Verification email sent!');
    } catch(e) {
        showLoginError(_friendlyAuthError(e.code));
    }
}

function showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.style.color = '#f87171';
    el.classList.remove('hidden');
}

function showLoginSuccess(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.style.color = '#4ade80';
    el.classList.remove('hidden');
}

function _setLoginLoading(on) {
    const btn     = document.getElementById('btn-google-signin');
    const spinner = document.getElementById('login-spinner');
    if (btn) btn.disabled = on;
    if (spinner) spinner.classList.toggle('hidden', !on);
}

function _friendlyAuthError(code) {
    const map = {
        'auth/user-not-found':         'No account found with that email.',
        'auth/wrong-password':         'Incorrect password.',
        'auth/invalid-credential':     'Incorrect email or password.',
        'auth/email-already-in-use':   'An account with this email already exists. Try signing in.',
        'auth/invalid-email':          'Please enter a valid email address.',
        'auth/weak-password':          'Password must be at least 6 characters.',
        'auth/popup-closed-by-user':   'Sign-in cancelled.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/too-many-requests':      'Too many attempts. Try again later.',
    };
    return map[code] || 'Something went wrong. Please try again.';
}
// ===== DEFAULT USER DOCUMENT =====
function _defaultUserDoc() {
    return {
        os_tasks:       [],
        os_notes:       [],
        os_decks:       [],
        os_goals:       [],
        os_events:      {},
        os_subjects:    [],
        os_links:       [],
        os_note_groups: [],
        os_deck_groups: [],
        os_card_stats:  {},
        os_streak:      { count: 0, lastDate: '' },
        os_quick_note:  '',
        os_theme:       'dark',
        os_lang:        'en',
        os_accent:      '#3b82f6',
        os_font_scale:  1,
        _createdAt:     new Date().toISOString()
    };
}
// Collects all localStorage keys into one object. Returns null if nothing found.
function _collectLocalStorage() {
    const keys = [
        'os_tasks','os_notes','os_decks','os_goals','os_events','os_subjects',
        'os_links','os_note_groups','os_deck_groups','os_card_stats','os_streak',
        'os_quick_note','os_study_stats','os_theme','os_lang','os_accent',
        'os_font_scale','os_clock_color','os_bg_color','os_name','os_profile',
        'os_widgets','os_wb_boards','os_wb_active','os_boards','os_cal_url',
        'os_pomo_times','os_pomo_autobreak','os_pomo_session','os_pomo_today',
        'os_timer_sound','os_notif_cal','os_notif_tasks'
    ];
    const data = {};
    let found = false;
    keys.forEach(function(k) {
        const raw = localStorage.getItem(k);
        if (raw !== null) {
            try { data[k] = JSON.parse(raw); } catch(e) { data[k] = raw; }
            found = true;
        }
    });
    // Also grab dynamic whiteboard keys
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('os_wb_bg_') || k.startsWith('os_mm_'))) {
            try { data[k] = JSON.parse(localStorage.getItem(k)); }
            catch(e) { data[k] = localStorage.getItem(k); }
            found = true;
        }
    }
    return found ? data : null;
}

function _clearLocalStorage() {
    const keys = [
        'os_tasks','os_notes','os_decks','os_goals','os_events','os_subjects',
        'os_links','os_note_groups','os_deck_groups','os_card_stats','os_streak',
        'os_quick_note','os_study_stats','os_theme','os_lang','os_accent',
        'os_font_scale','os_clock_color','os_bg_color','os_name','os_profile',
        'os_widgets','os_wb_boards','os_wb_active','os_boards','os_cal_url',
        'os_pomo_times','os_pomo_autobreak','os_pomo_session','os_pomo_today',
        'os_timer_sound','os_notif_cal','os_notif_tasks'
    ];
    keys.forEach(k => localStorage.removeItem(k));
}

// Handle Google redirect result on page load
(async function() {
    try {
        await getRedirectResult(_auth);
        // If successful, onAuthStateChanged fires automatically
    } catch(e) {
        showLoginError(_friendlyAuthError(e.code));
    }
})();

onAuthStateChanged(_auth, async function(user) {
    const overlay = document.getElementById('login-overlay');

    if (!user) {
        _uid = null;
        if (overlay) overlay.classList.remove('hidden');
        _setLoginLoading(false);
        return;
    }

    // User is signed in — show loading state
    _uid = user.uid;
    if (overlay) overlay.innerHTML = `
        <div class="absolute inset-0" style="background:var(--bg-color);"></div>
        <div class="relative z-10 flex flex-col items-center gap-4">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style="background:var(--accent);box-shadow:0 8px 24px rgba(59,130,246,0.4);">
                <i class="ph-bold ph-student text-3xl text-white"></i>
            </div>
            <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"
                 stroke="var(--accent)" stroke-width="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
            <p class="text-sm" style="color:var(--text-muted);">Loading your workspace…</p>
        </div>`;

    try {
        const userRef = doc(_db, 'users', _uid);
        const snap    = await getDoc(userRef);

        if (!snap.exists()) {
            // Brand new user — check for localStorage data to migrate first
            console.log('New user detected.');
            const didMigrate = await migrateLocalToCloud(_uid);
            if (!didMigrate) {
                // No local data either — create blank defaults
                const defaults = _defaultUserDoc();
                await setDoc(userRef, defaults);
                DB._hydrate(defaults);
            } else {
                // Migration wrote the data — re-fetch it
                const fresh = await getDoc(userRef);
                DB._hydrate(fresh.exists() ? fresh.data() : {});
            }
        } else {
            // Returning user — but still check for unsynced local data
            if (!snap.data()._migratedFromLocal) {
                await migrateLocalToCloud(_uid);
                const fresh = await getDoc(userRef);
                DB._hydrate(fresh.exists() ? fresh.data() : snap.data());
            } else {
                DB._hydrate(snap.data());
            }
        }

    } catch(e) {
        console.error('Firestore bootstrap failed:', e);
        DB._hydrate({});
    }

    if (overlay) overlay.classList.add('hidden');
    initApp();
});

async function logOut() {
    try {
        await signOut(_auth);
        // onAuthStateChanged will fire with user=null and show the overlay
    } catch(e) {
        console.error('Sign out failed:', e);
    }
}

// The single entry point — runs after Firestore data is loaded
function initApp() {
    // Re-read all top-level variables that depend on DB now that the
    // cache is hydrated (mirrors what used to run at parse time).
    currentLang   = DB.get('os_lang',         'en');
    studentName   = DB.get('os_name',         '');
    currentTheme  = DB.get('os_theme',        'dark');
    streak        = DB.get('os_streak',       { count: 0, lastDate: '' });
    profileData   = DB.get('os_profile',      { type: 'emoji', emoji: '🎓', bg: '#3b82f6' });
    quickLinks    = DB.get('os_links',        []);
    goals         = DB.get('os_goals',        []);
    tasks         = DB.get('os_tasks',        []);
    notes         = DB.get('os_notes',        []);
    noteGroups    = DB.get('os_note_groups',  []);
    decks         = DB.get('os_decks',        []);
    deckGroups    = DB.get('os_deck_groups',  []);
    calEvents     = DB.get('os_events',       {});
    subjects      = DB.get('os_subjects',     []);
    widgetConfig  = DB.get('os_widgets', {
        links: { visible: true, color: '#3b82f6' },
        goals: { visible: true, color: '#22c55e' },
        upnext: { visible: true, color: '#f59e0b' },
        studystats: { visible: true },
        grades: { visible: true },
        minicalendar: { visible: true },
        quicknote: { visible: true }
    });
    pomodoroTimes       = DB.get('os_pomo_times',    { focus: 25, short: 5, long: 15 });
    pomodoroAutoBreak   = DB.get('os_pomo_autobreak', false);
    pomodoroSession     = DB.get('os_pomo_session',  1);
    pomodoroSessionsToday = DB.get('os_pomo_today',  { date: '', count: 0 });
    timerSoundOn        = DB.get('os_timer_sound',   true);
    quickNote           = DB.get('os_quick_note',    '');
    wbBoards            = DB.get('os_wb_boards',     []);
    wbActiveBoardId     = DB.get('os_wb_active',     null);
    cardStats           = DB.get('os_card_stats',    {});

    // Apply accent / font / clock / bg that were previously self-invoking
    var accent = DB.get('os_accent', '#3b82f6');
    if (accent) setAccent(accent);
    var fs = DB.get('os_font_scale', 1);
    if (fs) setFontScale(fs);
    var cc = DB.get('os_clock_color', '');
    if (cc) { setClockColor(cc); var cp = document.getElementById('clock-color-picker'); if (cp) cp.value = cc; }
    var bg = DB.get('os_bg_color', '');
    if (bg) setBg(bg);

    // --- Run all inits that previously scattered at parse-time ---
    updateInterfaceText();
    applyTheme();
    applyWidgetConfig();
    renderProfileDisplay();
    updateGreeting();
    updateDashWidgets();
    renderLinks();
    renderGoals();
    renderTasks();
    renderDecks();
    populateGroupSelect();
    renderNotes();
    renderCalendar();
    renderGrades();
    initPomoTimer();
    updateNotifButtons();
    checkEventNotifications();
    checkTaskNotifications();
    initFormulas();
    

    // Streak update
    (function() {
        var today = new Date().toDateString();
        var yesterday = new Date(Date.now() - 86400000).toDateString();
        if (streak.lastDate === today) {
            // already counted
        } else if (streak.lastDate === yesterday) {
            streak.count++; streak.lastDate = today; DB.set('os_streak', streak);
        } else {
            streak.count = 1; streak.lastDate = today; DB.set('os_streak', streak);
        }
        var el = document.getElementById('dash-streak');
        if (el) el.innerText = streak.count;
    })();

    // Profile name inputs
    var ni = document.getElementById('student-name-input');
    var pi = document.getElementById('profile-name-input');
    if (ni) ni.value = studentName;
    if (pi) pi.value = studentName;

    // Quick note
    var qn = document.getElementById('dash-quick-note');
    if (qn) qn.value = quickNote;

    // Timer sound dot
    var dot = document.getElementById('timer-sound-dot');
    if (dot) dot.style.transform = timerSoundOn ? 'translateX(24px)' : '';
}


// ===== FORWARD-DECLARED DATA VARS =====
// initApp() will re-assign these from the Firestore cache.
var currentLang   = 'en';
var studentName   = '';
var currentTheme  = 'dark';
var streak        = { count: 0, lastDate: '' };
var profileData   = { type: 'emoji', emoji: '🎓', bg: '#3b82f6' };
var quickLinks    = [];
var goals         = [];
var tasks         = [];
var notes         = [];
var noteGroups    = [];
var decks         = [];
var deckGroups    = [];
var calEvents     = {};
var subjects      = [];
var widgetConfig  = {};
var pomodoroTimes = { focus: 25, short: 5, long: 15 };
var pomodoroAutoBreak      = false;
var pomodoroSession        = 1;
var pomodoroSessionsToday  = { date: '', count: 0 };
var timerSoundOn  = true;
var quickNote     = '';
var wbBoards      = [];
var wbActiveBoardId = null;

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
        if (em.indexOf('__fa:') === 0) {
            var iconClass = em.slice(5).replace(/[^a-zA-Z0-9\- ]/g, '');
            pd.innerHTML = '';
            var span = document.createElement('span');
            span.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:14px;background:' + bg + ';';
            var icon = document.createElement('i');
            icon.className = iconClass + ' text-xl text-white';
            icon.setAttribute('aria-hidden', 'true');
            span.appendChild(icon);
            pd.appendChild(span);
            if (ap) {
                ap.innerHTML = '';
                var icon2 = document.createElement('i');
                icon2.className = iconClass + ' text-4xl text-white';
                icon2.setAttribute('aria-hidden', 'true');
                ap.appendChild(icon2);
                ap.style.background = bg;
                ap.style.fontSize = '';
            }
        } else {
            pd.innerHTML = '<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:14px;background:' + bg + ';font-size:1.3rem;">' + em + '</span>';
            if (ap) { ap.innerHTML = em; ap.style.background = bg; ap.style.fontSize = '1.8rem'; }
        }
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
var tabs = ['dashboard','tasks','calendar','notes','whiteboard','cards','grades','calc','focus','forum','music','formulas',];
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
    if (name === 'focus') { populateFocusTasks(); }
}
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

// ===== POMODORO FOCUS TIMER =====
var pomodoroMode = 'focus'; // 'focus' | 'short' | 'long'
var pomodoroTimes = DB.get('os_pomo_times', { focus: 25, short: 5, long: 15 });
var pomodoroAutoBreak = DB.get('os_pomo_autobreak', false);
var pomodoroSession = DB.get('os_pomo_session', 1); // 1-4
var pomodoroSessionsToday = DB.get('os_pomo_today', { date: '', count: 0 });

// Legacy compat vars
var tTime = pomodoroTimes.focus * 60;
var tLeft = tTime;
var tInt = null;
var tRun = false;

function initPomoTimer() {
    // Sync inputs
    var pw = document.getElementById('pomo-custom-work');
    var ps = document.getElementById('pomo-custom-short');
    var pl = document.getElementById('pomo-custom-long');
    if (pw) pw.value = pomodoroTimes.focus;
    if (ps) ps.value = pomodoroTimes.short;
    if (pl) pl.value = pomodoroTimes.long;
    // Also sync the old settings-modal input
    var cp = document.getElementById('custom-pomodoro');
    if (cp) cp.value = pomodoroTimes.focus;

    // Check sessions today reset
    var today = new Date().toDateString();
    if (pomodoroSessionsToday.date !== today) {
        pomodoroSessionsToday = { date: today, count: 0 };
        DB.set('os_pomo_today', pomodoroSessionsToday);
    }

    renderSessionDots();
    updatePomoModeButtons();
    updatePomoSessionInfo();
    updatePomoAutoBreakBtn();

    var abLabel = document.getElementById('pomo-autobreak-label');
    if (abLabel) abLabel.innerText = pomodoroAutoBreak ? 'ON' : 'OFF';

    var stToday = document.getElementById('pomo-sessions-today');
    if (stToday) stToday.innerText = pomodoroSessionsToday.count;

    // Set time based on current mode
    tTime = pomodoroTimes[pomodoroMode] * 60;
    tLeft = tTime;
    updateTimer();
}

function updateTimer() {
    var m = Math.floor(tLeft / 60), s = tLeft % 60;
    var el = document.getElementById('timer-display');
    if (el) el.innerText = m + ':' + (s < 10 ? '0' : '') + s;
    // Update top bar
    var bar = document.getElementById('pomo-top-bar');
    if (bar) {
        var pct = tTime > 0 ? ((tTime - tLeft) / tTime * 100) : 0;
        bar.style.width = pct + '%';
    }
}

function toggleTimer() {
    if (tRun) {
        clearInterval(tInt);
        var ico = document.getElementById('icon-play');
        if (ico) ico.className = 'ph-fill ph-play';
    } else {
        tInt = setInterval(function() {
            if (tLeft > 0) { tLeft--; updateTimer(); } else {
                clearInterval(tInt); tRun = false;
                var ico = document.getElementById('icon-play');
                if (ico) ico.className = 'ph-fill ph-play';
                onPomodoroComplete();
            }
        }, 1000);
        var ico = document.getElementById('icon-play');
        if (ico) ico.className = 'ph-fill ph-pause';
    }
    tRun = !tRun;
}

function resetTimer() {
    clearInterval(tInt); tRun = false;
    tTime = pomodoroTimes[pomodoroMode] * 60;
    tLeft = tTime;
    var ico = document.getElementById('icon-play');
    if (ico) ico.className = 'ph-fill ph-play';
    updateTimer();
}

function skipPomodoroSession() {
    clearInterval(tInt); tRun = false;
    var ico = document.getElementById('icon-play');
    if (ico) ico.className = 'ph-fill ph-play';
    onPomodoroComplete();
}

function onPomodoroComplete() {
    playBeep();
    var _sess = 4;
    try { var _sv = localStorage.getItem('p9_pomo_sessions'); if (_sv) _sess = parseInt(JSON.parse(_sv)) || 4; } catch(_) {}
    // Count completed focus sessions
    if (pomodoroMode === 'focus') {
        pomodoroSession = (pomodoroSession % _sess) + 1;
        DB.set('os_pomo_session', pomodoroSession);
        var today = new Date().toDateString();
        if (pomodoroSessionsToday.date !== today) {
            pomodoroSessionsToday = { date: today, count: 0 };
        }
        pomodoroSessionsToday.count++;
        DB.set('os_pomo_today', pomodoroSessionsToday);
        var stToday = document.getElementById('pomo-sessions-today');
        if (stToday) stToday.innerText = pomodoroSessionsToday.count;
        renderSessionDots();
    }

    // Determine next mode
    var nextMode = 'focus';
    if (pomodoroMode === 'focus') {
        nextMode = (pomodoroSession === 1) ? 'long' : 'short'; // after N sessions → long
        // Simple logic: every N focus sessions, suggest long break
        if (pomodoroSessionsToday.count > 0 && pomodoroSessionsToday.count % _sess === 0) {
            nextMode = 'long';
        } else {
            nextMode = 'short';
        }
    } else {
        nextMode = 'focus';
    }

    var nextLabels = { focus: '🍅 Focus', short: '☕ Short Break', long: '🌿 Long Break' };
    var doneTitle = document.getElementById('timer-done-title');
    var doneMsg = document.getElementById('timer-done-msg');
    var doneNext = document.getElementById('timer-done-next');
    var doneAction = document.getElementById('timer-done-action');

    if (doneTitle) doneTitle.innerText = pomodoroMode === 'focus' ? 'Focus Done! 🎉' : 'Break Over!';
    if (doneMsg) doneMsg.innerText = pomodoroMode === 'focus' ? 'Great work! Take a breather.' : 'Ready to focus again?';
    if (doneNext) doneNext.innerText = 'Up next: ' + nextLabels[nextMode];
    if (doneAction) {
        doneAction.innerText = pomodoroAutoBreak ? 'Starting ' + nextLabels[nextMode] + '…' : 'Start ' + nextLabels[nextMode];
        doneAction.onclick = function() {
            closeModals();
            setPomoMode(nextMode);
            if (pomodoroAutoBreak) { setTimeout(toggleTimer, 300); }
        };
    }

    openModal('modal-timer-done');

    if (pomodoroAutoBreak) {
        setTimeout(function() {
            closeModals();
            setPomoMode(nextMode);
            setTimeout(toggleTimer, 200);
        }, 3000);
    }
}

function autoStartBreak() {
    // Called from modal button fallback
}

function setPomoMode(mode) {
    pomodoroMode = mode;
    resetTimer();
    updatePomoModeButtons();
    updatePomoSessionInfo();
    var lbl = document.getElementById('timer-label');
    var labels = { focus: 'FOCUS SESSION', short: 'SHORT BREAK', long: 'LONG BREAK' };
    if (lbl) lbl.innerText = labels[mode] || 'FOCUS SESSION';
}

function updatePomoModeButtons() {
    ['focus','short','long'].forEach(function(m) {
        var btn = document.getElementById('pomo-btn-' + m);
        if (btn) btn.classList.toggle('active', m === pomodoroMode);
    });
}

function updatePomoTimes() {
    var pw = document.getElementById('pomo-custom-work');
    var ps = document.getElementById('pomo-custom-short');
    var pl = document.getElementById('pomo-custom-long');
    if (pw) pomodoroTimes.focus = parseInt(pw.value) || 25;
    if (ps) pomodoroTimes.short = parseInt(ps.value) || 5;
    if (pl) pomodoroTimes.long = parseInt(pl.value) || 15;
    DB.set('os_pomo_times', pomodoroTimes);
    if (!tRun) resetTimer();
}

function toggleAutoBreak() {
    pomodoroAutoBreak = !pomodoroAutoBreak;
    DB.set('os_pomo_autobreak', pomodoroAutoBreak);
    var lbl = document.getElementById('pomo-autobreak-label');
    if (lbl) lbl.innerText = pomodoroAutoBreak ? 'ON' : 'OFF';
    updatePomoAutoBreakBtn();
}

function updatePomoAutoBreakBtn() {
    var btn = document.getElementById('pomo-autobreak');
    if (btn) btn.classList.toggle('active', pomodoroAutoBreak);
}

function renderSessionDots() {
    var c = document.getElementById('session-dots');
    if (!c) return;
    c.innerHTML = '';
    var _sess = 4;
    try { var _sv = localStorage.getItem('p9_pomo_sessions'); if (_sv) _sess = parseInt(JSON.parse(_sv)) || 4; } catch(_) {}
    for (var i = 1; i <= _sess; i++) {
        var dot = document.createElement('div');
        var today = new Date().toDateString();
        var todayCount = (pomodoroSessionsToday.date === today) ? pomodoroSessionsToday.count : 0;
        var filled = todayCount >= i;
        var isCurrent = (pomodoroMode === 'focus') && ((todayCount % _sess) + 1 === i) && !filled;
        dot.className = 'session-dot' + (filled ? ' filled' : '') + (isCurrent ? ' current' : '');
        c.appendChild(dot);
    }
}

function updatePomoSessionInfo() {
    var el = document.getElementById('pomo-session-info');
    if (!el) return;
    var today = new Date().toDateString();
    var count = (pomodoroSessionsToday.date === today) ? pomodoroSessionsToday.count : 0;
    var _sess = 4;
    try { var _sv = localStorage.getItem('p9_pomo_sessions'); if (_sv) _sess = parseInt(JSON.parse(_sv)) || 4; } catch(_) {}
    var next = (count % _sess) + 1;
    el.innerText = 'Session ' + next + ' of ' + _sess;
}

function populateFocusTasks() {
    var sel = document.getElementById('focus-task-select');
    if (!sel) return;
    var pending = (DB.get('os_tasks', [])).filter(function(t) { return !t.done; });
    sel.innerHTML = '<option value="">Select a Task to Focus On</option>';
    pending.forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t.id; opt.innerText = t.text;
        sel.appendChild(opt);
    });
}

// Legacy setMode / setCustomPomodoro compat
function setMode(m, l) {
    resetTimer(); tTime = m * 60; tLeft = tTime;
    var lbl = document.getElementById('timer-label');
    if (lbl) lbl.innerText = l;
    updateTimer();
}
function setCustomPomodoro(val) {
    var mins = parseInt(val) || 25;
    pomodoroTimes.focus = mins;
    DB.set('os_pomo_times', pomodoroTimes);
    if (pomodoroMode === 'focus' && !tRun) resetTimer();
}

// ===== NOTIFICATIONS =====
function requestCalNotifications() {
    if (!('Notification' in window)) { showAlert('Not Supported', 'Notifications are not supported in this browser.'); return; }
    Notification.requestPermission().then(function(perm) {
        DB.set('os_notif_cal', perm === 'granted');
        updateNotifButtons();
        if (perm === 'granted') {
            showAlert('Notifications Enabled', 'You\'ll be notified before calendar events.');
        } else {
            showAlert('Permission Denied', 'Enable notifications in your browser settings.');
        }
    });
}

function requestTaskNotifications() {
    if (!('Notification' in window)) { showAlert('Not Supported', 'Notifications are not supported in this browser.'); return; }
    Notification.requestPermission().then(function(perm) {
        DB.set('os_notif_tasks', perm === 'granted');
        updateNotifButtons();
        if (perm === 'granted') {
            showAlert('Reminders Enabled', 'You\'ll be reminded about due tasks.');
        } else {
            showAlert('Permission Denied', 'Enable notifications in your browser settings.');
        }
    });
}

function updateNotifButtons() {
    var calBtn = document.getElementById('cal-notif-btn');
    var taskBtn = document.getElementById('tasks-notif-btn');
    var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
    if (calBtn) {
        calBtn.classList.toggle('granted', perm === 'granted');
        calBtn.classList.toggle('denied', perm === 'denied');
    }
    if (taskBtn) {
        taskBtn.classList.toggle('granted', perm === 'granted');
        taskBtn.classList.toggle('denied', perm === 'denied');
    }
}

function sendSystemNotification(title, body, icon) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(title, { body: body || '', icon: icon || '' });
    } catch(e) {}
}

function scheduleNotification(title, body, atTime) {
    var delay = atTime - Date.now();
    if (delay < 0) return;
    setTimeout(function() { sendSystemNotification(title, body); }, delay);
}

function checkEventNotifications() {
    if (!DB.get('os_notif_cal', false)) return;
    var events = DB.get('os_events', {});
    var now = new Date();
    var todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var todayEvs = events[todayKey] || [];
    todayEvs.forEach(function(ev) {
        if (ev.time) {
            var parts = ev.time.split(':');
            var evTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(parts[0]), parseInt(parts[1]));
            var reminderTime = new Date(evTime.getTime() - 15 * 60000); // 15 min before
            if (reminderTime > now) {
                scheduleNotification('Upcoming: ' + ev.title, 'Starts at ' + ev.time + ' (15 min reminder)', '');
            }
        }
    });
}

function checkTaskNotifications() {
    if (!DB.get('os_notif_tasks', false)) return;
    var tasks = DB.get('os_tasks', []);
    var today = new Date().toISOString().split('T')[0];
    tasks.filter(function(t) { return !t.done && t.date === today; }).forEach(function(t) {
        sendSystemNotification('Task Due Today', t.text);
    });
}

// Run checks on load
(function() {
    updateNotifButtons();
    checkEventNotifications();
    checkTaskNotifications();
})();

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
function quickNoteToNotes() {
    var qn = document.getElementById('dash-quick-note');
    if (!qn || !qn.value.trim()) { showAlert('Empty Note', 'Write something first.'); return; }
    var text = qn.value.trim();
    var newNote = {
        id: Date.now(),
        title: text.split('\n')[0].slice(0, 40) || 'Quick Note',
        body: '<p>' + text.replace(/\n/g, '</p><p>') + '</p>'
    };
    notes.unshift(newNote);
    DB.set('os_notes', notes);
    qn.value = ''; quickNote = '';
    DB.set('os_quick_note', '');
    switchTab('notes');
    loadNote(newNote.id);
    showAlert('Sent to Notes ✅', 'Your note was saved!');
}

function updateDashWidgets() {
    var decks = DB.get('os_decks', []);
    var statDecks = document.getElementById('stat-decks');
    if (statDecks) statDecks.innerText = decks.length;
    var studyStats = DB.get('os_study_stats', { today: 0, bestStreak: 0 });
    var sct = document.getElementById('stat-cards-today');
    if (sct) sct.innerText = studyStats.today || 0;
    var sbs = document.getElementById('stat-best-streak');
    if (sbs) sbs.innerText = studyStats.bestStreak || streak.count;

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
    var task = { id: Date.now(), text: v, priority: prio ? prio.value : 'low', date: date ? date.value : '', done: false, color: taskColorValue, subtasks: [] };
    tasks.push(task);
    DB.set('os_tasks', tasks);
    // Schedule notification if date is today
    if (task.date && task.date === new Date().toISOString().split('T')[0]) {
        if (DB.get('os_notif_tasks', false)) {
            sendSystemNotification('Task Added for Today', task.text);
        }
    }
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
            + (t.date ? '<div class="text-[10px] text-[var(--text-muted)] mt-0.5">' + t.date + '</div>' : '')
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
var selectedDeckEmoji = '📖';

var deckEmojiList = ['📖','🔬','🌍','🎭','🏛️','💡','⚗️','🗺️','🧮','🎵',
                     '🧬','🔭','📐','📊','🎨','🏆','🚀','🧩','📝','🌱',
                     '⚡','🦋','🐉','🌙','🔥','💎','🎯','🎸','🌺','🧠'];

function initDeckEmojiPicker() {
    var grid = document.getElementById('deck-emoji-grid');
    if (!grid) return;
    grid.innerHTML = '';
    deckEmojiList.forEach(function(em) {
        var span = document.createElement('span');
        span.className = 'deck-emoji-opt' + (em === selectedDeckEmoji ? ' selected' : '');
        span.innerText = em;
        span.onclick = function() { setDeckEmoji(em); };
        grid.appendChild(span);
    });
    var custom = document.getElementById('deck-emoji-custom');
    if (custom) custom.value = '';
}

function setDeckEmoji(em) {
    selectedDeckEmoji = em;
    document.querySelectorAll('.deck-emoji-opt').forEach(function(o) {
        o.classList.toggle('selected', o.innerText === em);
    });
    var custom = document.getElementById('deck-emoji-custom');
    if (custom && !deckEmojiList.includes(em)) custom.value = em;
}

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

window.p4OpenImport = function(deckId, deckName) {
    document.getElementById('p4-imp-modal')?.remove();
    var m = document.createElement('div');
    m.id = 'p4-imp-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:220;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
    m.innerHTML = '<div style="background:var(--bg-color);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:26px;width:min(460px,96vw);box-shadow:0 12px 48px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:14px;">'
        + '<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-file-import" style="color:var(--accent)"></i><h3 style="font-size:.95rem;font-weight:700;margin:0;">Import into "' + deckName + '"</h3><button id="p4ic" style="margin-left:auto;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:.85rem;"><i class="fa-solid fa-xmark"></i></button></div>'
        + '<p style="font-size:.72rem;color:var(--text-muted);margin:0;line-height:1.6;">One card per line. Separate term and definition with a <strong>comma</strong>, <strong> - </strong>, or <strong>tab</strong>.</p>'
        + '<textarea id="p4-imp-ta" style="width:100%;min-height:150px;resize:vertical;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:11px 13px;color:var(--text-main);font-size:.82rem;font-family:\'JetBrains Mono\',monospace;outline:none;box-sizing:border-box;line-height:1.6;" placeholder="Photosynthesis, process plants use to make food&#10;Mitosis - cell division&#10;DNA&#9;deoxyribonucleic acid"></textarea>'
        + '<div id="p4ip" style="font-size:.7rem;color:var(--text-muted);min-height:16px;"></div>'
        + '<div style="display:flex;gap:8px;justify-content:flex-end;"><button id="p4ix" style="padding:8px 16px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--text-muted);font-size:.78rem;font-weight:600;cursor:pointer;">Cancel</button><button id="p4is" style="padding:8px 18px;border-radius:10px;background:var(--accent);color:#fff;font-size:.78rem;font-weight:700;border:none;cursor:pointer;">Import cards</button></div>'
        + '</div>';
    document.body.appendChild(m);
    var ta = m.querySelector('#p4-imp-ta');
    var prev = m.querySelector('#p4ip');
    function parse(txt) {
        return txt.split('\n').map(function(line) {
            line = line.trim(); if (!line) return null;
            var sep = line.includes('\t') ? '\t' : line.includes(' - ') ? ' - ' : ',';
            var parts = line.split(sep); var q = parts[0]?.trim(), a = parts.slice(1).join(sep).trim();
            return (q) ? { q: q, a: a || '' } : null;
        }).filter(Boolean);
    }
    ta.addEventListener('input', function() { var n=parse(ta.value).length; prev.textContent = n ? n+' card'+(n===1?'':'s')+' detected' : ''; });
    m.querySelector('#p4ic').onclick = function() { m.remove(); };
    m.querySelector('#p4ix').onclick = function() { m.remove(); };
    m.onclick = function(e) { if (e.target===m) m.remove(); };
    m.querySelector('#p4is').onclick = function() {
        var cards = parse(ta.value);
        if (!cards.length) { prev.textContent='No valid cards found.'; prev.style.color='#f87171'; return; }
        var deck = decks.find(function(d) { return d.id===deckId; });
        if (!deck) return;
        if (!deck.cards) deck.cards = [];
        var now = Date.now();
        cards.forEach(function(c,i) { deck.cards.push({id:now+i,q:c.q,a:c.a,tip:'',hard:false,starred:false}); });
        DB.set('os_decks', decks); m.remove(); renderDecks();
        var t=document.getElementById('sos-toast'); if(t){t.textContent='Imported '+cards.length+' cards ✓';t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2200);}
    };
    setTimeout(function(){ta.focus();},40);
};

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
    var starredCount = (d.cards || []).filter(function(c) { return c.starred; }).length;
    return '<div class="min-card p-4 hover-effect cursor-pointer" onclick="openDeck(' + d.id + ')">'
        + '<div class="flex justify-between items-start mb-3">'
        + '<div class="text-2xl">' + (d.emoji || '📖') + '</div>'
        + '<button onclick="event.stopPropagation();deleteDeck(' + d.id + ')" class="text-[var(--text-muted)] hover:text-red-400 transition text-xs">\u00d7</button>'
        + '</div>'
        + '<h3 class="font-semibold text-sm mb-1 truncate">' + d.name + '</h3>'
        + '<div class="text-xs text-[var(--text-muted)]">' + count + ' cards'
        + (hardCount > 0 ? ' · <span class="text-red-400">' + hardCount + ' hard</span>' : '')
        + (starredCount > 0 ? ' · <span class="text-yellow-400"><i class="fa-solid fa-star" style="font-size:.55rem"></i> ' + starredCount + ' starred</span>' : '') + '</div>'
        + '<button onclick="event.stopPropagation();p4OpenImport(' + d.id + ',\'' + d.name.replace(/'/g,"\\'") + '\')" style="margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;gap:5px;padding:5px 0;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:var(--text-muted);font-size:.68rem;font-weight:700;cursor:pointer;" onmouseenter="this.style.background=\'rgba(255,255,255,.1)\';this.style.color=\'var(--text-main)\'" onmouseleave="this.style.background=\'rgba(255,255,255,.05)\';this.style.color=\'var(--text-muted)\'"><i class="fa-solid fa-file-import"></i> Import</button>'
        + '</div>';
}
function saveDeck() {
    var name = document.getElementById('deck-name').value.trim();
    if (!name) return;
    var groupId = document.getElementById('deck-group-select').value;
    decks.push({ id: Date.now(), name: name, groupId: groupId ? parseInt(groupId) : null, emoji: selectedDeckEmoji || '📖', cards: [] });
    DB.set('os_decks', decks);
    document.getElementById('deck-name').value = '';
    selectedDeckEmoji = '📖';
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
        var statKey = activeDeckId + '_' + card.id;
        var hardCount = cardStats[statKey] || 0;
        var diffBadge = '';
        if (hardCount >= 3) {
            diffBadge = '<span class="card-diff-badge hard">Hard</span>';
        } else if (hardCount === 0 && i > 0) {
            // Only show Easy if card has been studied (not brand new)
            // We skip showing Easy badge for unseen cards
        }
        // Show hard badge if failed 2+ times
        if (hardCount >= 2) {
            diffBadge = '<span class="card-diff-badge hard">Hard</span>';
        }

        var div = document.createElement('div');
        div.className = 'flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[var(--glass-hover)] group transition';
        div.innerHTML = '<div class="flex-1 min-w-0">'
            + '<div class="flex items-center gap-2">'
            + '<div class="text-sm font-medium truncate">' + card.q + '</div>'
            + diffBadge
            + '</div>'
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
    (window.showStudyCard || showStudyCard)();
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

    /* Show starred / hard / easy badges on the study card */
    var badgeContainer = document.getElementById('study-card-badges');
    if (!badgeContainer) {
        var frontLabel = document.getElementById('card-front-label');
        if (frontLabel) {
            badgeContainer = document.createElement('div');
            badgeContainer.id = 'study-card-badges';
            badgeContainer.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-bottom:6px;flex-wrap:wrap;';
            frontLabel.parentElement.insertBefore(badgeContainer, frontLabel);
        }
    }
    if (badgeContainer) {
        badgeContainer.innerHTML = '';
        var statKey = activeDeckId + '_' + card.id;
        var hardCount = cardStats[statKey] || 0;
        var cardEasySet = typeof _cardEasySet !== 'undefined' ? _cardEasySet : (typeof DB !== 'undefined' ? DB.get('os_card_easy', {}) : {});
        var isEasy = cardEasySet[statKey] === true;
        if (card.starred) {
            badgeContainer.innerHTML += '<span class="card-diff-badge starred"><i class="fa-solid fa-star" style="font-size:.55rem"></i> Starred</span>';
        }
        if (hardCount >= 2) {
            badgeContainer.innerHTML += '<span class="card-diff-badge hard"><i class="fa-solid fa-fire" style="font-size:.55rem"></i> Hard</span>';
        } else if (isEasy) {
            badgeContainer.innerHTML += '<span class="card-diff-badge easy"><i class="fa-solid fa-check" style="font-size:.55rem"></i> Easy</span>';
        }
    }

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
    var key = activeDeckId + '_' + card.id;
    if (rating === 'hard') {
        studyWrong++;
        cardStats[key] = (cardStats[key] || 0) + 1;
        DB.set('os_card_stats', cardStats);
    } else {
        studyCorrect++;
        if (cardStats[key] > 0) cardStats[key]--;
        DB.set('os_card_stats', cardStats);
    }
    studyIdx++;
    var fi = document.getElementById('flashcard-inner');
    if (fi) fi.classList.remove('rotate-y-180');
    setTimeout(function() { (window.showStudyCard || showStudyCard)(); }, 100);
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
    var correct = userAnswer === correctAnswer || (correctAnswer.includes(userAnswer) && userAnswer.length > 2);
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
        (window.showStudyCard || showStudyCard)();
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
        return (letters === p.word && cells.length === p.word.length && cells[0].r === p.r && cells[0].c === p.c && dr === p.dr && dc === p.dc)
            || (letters === p.word && cells.length === p.word.length);
    });
    if (match && wsFound.indexOf(match.word) < 0) {
        wsFound.push(match.word);
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
    if (avg >= 18) return 'Excellent';
    if (avg >= 16) return 'Very Good';
    if (avg >= 14) return 'Good';
    if (avg >= 12) return 'Satisfactory';
    if (avg >= 10) return 'Sufficient';
    return 'Insufficient';
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
    if (gbEl) {
        gbEl.style.width = (globalAvg !== null ? (globalAvg / 20 * 100) : 0) + '%';
        gbEl.style.background = globalAvg !== null ? getBeColor(globalAvg) : 'var(--accent)';
    }
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
        var avg = calcSubjectAvg(sub.tests || [], false);
        var pAvg = calcSubjectAvg(sub.tests || [], true);
        var pct = avg !== null ? (avg / 20 * 100) : 0;
        var color = avg !== null ? getBeColor(avg) : 'var(--accent)';
        var card = document.createElement('div');
        card.className = 'min-card p-5';
        card.style.cssText = 'position:relative;';
        card.addEventListener('mouseenter', function() {
            var a = card.querySelector('.sub-card-actions');
            if (a) a.style.opacity = '1';
        });
        card.addEventListener('mouseleave', function() {
            var a = card.querySelector('.sub-card-actions');
            if (a) a.style.opacity = '0';
        });
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
            + '<div class="text-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">'
            + '<div class="text-3xl font-light" style="color:' + color + '">' + (avg !== null ? avg.toFixed(2) : '--') + '</div>'
            + '<div class="text-xs text-[var(--text-muted)]">/ 20</div>'
            + '<div style="display:flex;gap:2px;margin-top:4px;opacity:0;transition:opacity .15s;" class="sub-card-actions">'
            + '<button onclick="openEditSubject(' + sub.id + ')" style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:4px 6px;border-radius:6px;" title="Edit"><i class="fa-solid fa-pencil"></i></button>'
            + '<button onclick="deleteSubject(' + sub.id + ')" style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:4px 6px;border-radius:6px;" title="Delete"><i class="fa-solid fa-trash"></i></button>'
            + '</div>'
            + '</div></div>'
            + '<div class="h-2 bg-[var(--glass-hover)] rounded-full overflow-hidden mb-4">'
            + '<div style="width:' + pct + '%;background:' + color + ';height:100%;border-radius:2px;transition:width .7s;"></div>'
            + '</div>'
            + practiceRow
            + (sub.tests && sub.tests.length ? '<div class="mt-3 max-h-40 overflow-y-auto">' + testsHTML + '</div>' : '')
            + '<button onclick="openAddTestModal(' + sub.id + ')" class="mt-3 w-full py-2 bg-[var(--glass-hover)] rounded-xl text-xs font-medium hover:bg-[var(--accent)] hover:text-white transition">+ Add Result</button>'
            + `<button onclick="openEditSubject(${sub.id})" style="position:absolute;top:10px;right:36px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;border-radius:7px;opacity:0;transition:opacity .15s;" class="p-sub-edit" title="Edit subject"><i class="fa-solid fa-pencil"></i></button>
            <button onclick="deleteSubject(${sub.id})" style="position:absolute;top:10px;right:10px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.7rem;padding:5px 7px;border-radius:7px;opacity:0;transition:opacity .15s;" class="p-sub-del" title="Delete subject"><i class="fa-solid fa-trash"></i></button>`
        c.appendChild(card);
    });
}
renderGrades();

// ===== CALENDAR =====
var calEvents = DB.get('os_events', {});
var curM = new Date().getMonth(), curY = new Date().getFullYear();
var curCalView = 'month';
var weekStartDate = new Date();
(function() {
    var d = new Date();
    var day = d.getDay();
    var wkStart = 'mon';
    try { var _v = localStorage.getItem('p9_week_start'); if (_v) wkStart = JSON.parse(_v); } catch(_) {}
    var diff = (wkStart === 'sun') ? d.getDate() - day : d.getDate() - day + (day === 0 ? -6 : 1);
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
    var wkStart = 'mon';
    try { var _v = localStorage.getItem('p9_week_start'); if (_v) wkStart = JSON.parse(_v); } catch(_) {}
    var diff = (wkStart === 'sun') ? now.getDate() - day : now.getDate() - day + (day === 0 ? -6 : 1);
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
    var notifyChk = document.getElementById('event-notify');
    var shouldNotify = notifyChk ? notifyChk.checked : false;
    var c = document.querySelector('input[name="eventColor"]:checked');
    var col = c ? c.value : '#3b82f6';
    if (!v || !k) return;
    if (!calEvents[k]) calEvents[k] = [];
    var evObj = { title: v, time: ti, color: col };
    calEvents[k].push(evObj);
    // Schedule notification if requested
    if (shouldNotify && ti && DB.get('os_notif_cal', false)) {
        var parts = ti.split(':');
        var evDate = new Date(k + 'T' + ti);
        var reminderTime = new Date(evDate.getTime() - 15 * 60000);
        if (reminderTime > Date.now()) {
            scheduleNotification('Upcoming: ' + v, 'In 15 minutes at ' + ti, '');
        }
    }
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
var noteGroups = DB.get('os_note_groups', []);
var selectedNoteGroupColor = '#3b82f6';
var notesSidebarHidden = false;

function renderNotes() {
    var c = document.getElementById('notes-sidebar');
    if (!c) return;
    c.innerHTML = '';

    // Render groups
    noteGroups.forEach(function(g) {
        var groupNotes = notes.filter(function(n) { return n.groupId === g.id; });
        var groupDiv = document.createElement('div');
        groupDiv.className = 'mb-1';
        var header = document.createElement('div');
        header.className = 'flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--glass-hover)] cursor-pointer group';
        header.innerHTML = '<div style="width:8px;height:8px;border-radius:50%;background:' + (g.color || 'var(--accent)') + ';flex-shrink:0;"></div>'
            + '<span class="note-group-name text-xs font-bold flex-1">' + g.name + '</span>'
            + '<span class="text-[10px] text-[var(--text-muted)]">' + groupNotes.length + '</span>'
            + '<i class="ph ph-caret-right text-[10px] text-[var(--text-muted)]' + (g.open !== false ? ' rotate-90' : '') + '"></i>'
            + '<button onclick="event.stopPropagation();deleteNoteGroup(' + g.id + ')" class="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 text-xs px-1">\u00d7</button>';
        header.onclick = function() {
            g.open = (g.open === false) ? true : false;
            DB.set('os_note_groups', noteGroups);
            renderNotes();
        };
        header.addEventListener('dragover', function(e) {
            e.preventDefault();
            header.style.outline = '2px dashed var(--accent)';
            header.style.borderRadius = '8px';
        });
        header.addEventListener('dragleave', function() { header.style.outline = ''; });
        header.addEventListener('drop', function(e) {
            e.preventDefault();
            header.style.outline = '';
            var noteId = parseInt(e.dataTransfer.getData('noteId'));
            if (!noteId) return;
            var note = notes.find(function(x) { return x.id === noteId; });
            if (note) { note.groupId = g.id; DB.set('os_notes', notes); renderNotes(); }
        });
        var children = document.createElement('div');
        children.className = 'note-group-children pl-3' + (g.open === false ? ' hidden' : '');
        groupNotes.forEach(function(n) {
            children.appendChild(noteItem(n));
        });
        groupDiv.appendChild(header);
        groupDiv.appendChild(children);
        c.appendChild(groupDiv);
    });

    // Render ungrouped notes
    var ungrouped = notes.filter(function(n) { return !n.groupId; });
    ungrouped.forEach(function(n) {
        c.appendChild(noteItem(n));
    });
}

function noteItem(n) {
    var isActive = n.id === activeNote;
    var div = document.createElement('div');
    div.className = 'flex items-center group rounded-lg ' + (isActive ? 'bg-[var(--glass-panel)]' : '') + ' pr-1';
    div.draggable = true;
    div.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('noteId', String(n.id));
        e.dataTransfer.effectAllowed = 'move';
    });
    div.innerHTML = '<button onclick="loadNote(' + n.id + ')" class="flex-1 text-left p-3 text-sm hover:bg-[var(--glass-hover)] rounded-lg truncate ' + (isActive ? 'font-semibold' : '') + '">' + (n.title || 'Untitled') + '</button>'
        + '<button onclick="confirmDeleteNote(' + n.id + ')" class="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 transition rounded flex-shrink-0"><i class="ph-bold ph-trash text-xs"></i></button>';
    return div;
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
    var editor = document.getElementById('note-editor');
    var sel = window.getSelection();
    /* If there is a text selection inside the editor, apply font to selection only */
    if (!silent && sel && sel.rangeCount > 0 && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
        editor.focus();
        document.execCommand('fontName', false, font.split(',')[0].trim().replace(/'/g, ''));
    } else {
        editor.style.fontFamily = font;
    }
    noteFontActive = cls;
    document.querySelectorAll('.font-opt').forEach(function(b) { b.classList.remove('active-font'); });
    var btn = document.getElementById(cls);
    if (btn) btn.classList.add('active-font');
    if (!silent) { saveNote(); }
}

function noteIndent() {
    document.getElementById('note-editor').focus();
    document.execCommand('indent', false, null);
    saveNote();
}
function noteOutdent() {
    document.getElementById('note-editor').focus();
    document.execCommand('outdent', false, null);
    saveNote();
}

function toggleNotesSidebar() {
    notesSidebarHidden = !notesSidebarHidden;
    var layout = document.getElementById('notes-layout');
    var btn = document.getElementById('notes-sidebar-toggle-btn');
    if (layout) layout.classList.toggle('sidebar-hidden', notesSidebarHidden);
    if (btn) btn.classList.toggle('active-tool', notesSidebarHidden);
}

// Table Picker
var tablePickerHoverRow = 0, tablePickerHoverCol = 0;
function initTablePicker() {
    var grid = document.getElementById('table-picker-grid');
    if (!grid || grid.children.length > 0) return;
    grid.style.gridTemplateColumns = 'repeat(6,1fr)';
    for (var r = 1; r <= 6; r++) {
        for (var c = 1; c <= 6; c++) {
            (function(row, col) {
                var cell = document.createElement('div');
                cell.className = 'table-picker-cell';
                cell.dataset.r = row; cell.dataset.c = col;
                cell.addEventListener('mouseenter', function() {
                    tablePickerHoverRow = row; tablePickerHoverCol = col;
                    document.querySelectorAll('.table-picker-cell').forEach(function(x) {
                        x.classList.toggle('hover', parseInt(x.dataset.r) <= row && parseInt(x.dataset.c) <= col);
                    });
                    var lbl = document.getElementById('table-picker-label');
                    if (lbl) lbl.innerText = row + ' × ' + col;
                });
                cell.addEventListener('click', function() {
                    noteInsertTable(row, col);
                    var popup = document.getElementById('table-picker-popup');
                    if (popup) popup.classList.remove('open');
                });
                grid.appendChild(cell);
            })(r, c);
        }
    }
}
function toggleTablePicker(btn) {
    initTablePicker();
    var popup = document.getElementById('table-picker-popup');
    if (!popup) return;
    popup.classList.toggle('open');
    document.addEventListener('click', function closeTP(e) {
        if (!popup.contains(e.target) && e.target !== btn) {
            popup.classList.remove('open');
            document.removeEventListener('click', closeTP);
        }
    });
}
function noteInsertTable(rows, cols) {
    document.getElementById('note-editor').focus();
    var html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
    html += '<thead><tr>';
    for (var c = 0; c < cols; c++) {
        html += '<th style="border:1px solid var(--glass-border);padding:6px 10px;background:var(--glass-hover);text-align:left;font-size:.85em;">Header</th>';
    }
    html += '</tr></thead><tbody>';
    for (var r = 0; r < rows - 1; r++) {
        html += '<tr>';
        for (var c = 0; c < cols; c++) {
            html += '<td style="border:1px solid var(--glass-border);padding:6px 10px;font-size:.85em;" contenteditable="true"></td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    saveNote();
}

// Note Groups
function saveNoteGroup() {
    var inp = document.getElementById('note-group-name');
    var v = inp ? inp.value.trim() : '';
    if (!v) return;
    noteGroups.push({ id: Date.now(), name: v, color: selectedNoteGroupColor, open: true });
    DB.set('os_note_groups', noteGroups);
    if (inp) inp.value = '';
    closeModals(); renderNotes();
}
function setNoteGroupColor(c) {
    selectedNoteGroupColor = c;
    document.querySelectorAll('[id^="ngc-"]').forEach(function(btn) {
        btn.style.outline = 'none';
    });
    var ids = { '#3b82f6': 'ngc-blue', '#22c55e': 'ngc-green', '#ef4444': 'ngc-red', '#8b5cf6': 'ngc-purple', '#f59e0b': 'ngc-amber', '#ec4899': 'ngc-pink' };
    var btnId = ids[c];
    if (btnId) {
        var b = document.getElementById(btnId);
        if (b) b.style.outline = '2px solid white';
    }
}
function deleteNoteGroup(id) {
    showConfirm('Delete Group', 'Notes inside will become ungrouped.', function() {
        noteGroups = noteGroups.filter(function(g) { return g.id !== id; });
        notes.forEach(function(n) { if (n.groupId === id) n.groupId = null; });
        DB.set('os_note_groups', noteGroups);
        DB.set('os_notes', notes);
        renderNotes();
    });
}

// Prevent Enter from creating new checkbox inside label
document.getElementById('note-editor').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        var sel = window.getSelection();
        if (sel && sel.focusNode) {
            var p = sel.focusNode;
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

var wbTool = 'pen';
var wbPenColor = '#ffffff';
var wbDrawing = false;
var wbStartX = 0, wbStartY = 0;
var wbLastX = 0, wbLastY = 0;
var wbHistory = [];
var wbHistoryIndex = -1;
var wbGridOn = false;
var wbFull = false;
var wbSnapshot = null;
var wbSelectStart = null;
var wbSelectRect  = null;
var wbPreSelectData = null;
var wbBoards = DB.get('os_boards', [{ id: 1, name: 'Board 1', data: null }]);
var wbActiveBoardId = wbBoards[0].id;

// Mind map state
var wbMindMapMode = false;
var wbMindMapNodes = [];  // loaded per board
var wbMindMapEdges = [];
var wbMindMapSelected = null;  // id of selected node
var wbMmPendingColor = '#3b82f6';
var wbMmDragging = null;  // {nodeId, offsetX, offsetY}

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

function wbResizeCanvas() {
    var con = document.getElementById('wb-container');
    if (!con || con.clientWidth === 0) return;
    var saved = (canvas.width > 0 && canvas.height > 0) ? canvas.toDataURL() : null;
    canvas.width  = con.clientWidth;
    canvas.height = con.clientHeight;
    wbFillBg();
    if (saved) {
        var img = new Image();
        img.onload = function() { ctx.drawImage(img, 0, 0); };
        img.src = saved;
    }
    // Resize mind map SVG
    var svg = document.getElementById('wb-mindmap-svg');
    if (svg) {
        svg.setAttribute('width', canvas.width);
        svg.setAttribute('height', canvas.height);
    }
}
window.addEventListener('resize', function() {
    if (!document.getElementById('view-whiteboard').classList.contains('hidden')) {
        wbResizeCanvas();
    }
});

function wbSetTool(t) {
    wbTool = t;
    document.querySelectorAll('[id^="wb-tool-"]').forEach(function(b) {
        b.classList.remove('active-tool');
    });
    var btn = document.getElementById('wb-tool-' + t);
    if (btn) btn.classList.add('active-tool');
    var cursors = { pen: 'crosshair', eraser: 'cell', select: 'crosshair',
                    line: 'crosshair', rect: 'crosshair', circle: 'crosshair',
                    arrow: 'crosshair', text: 'text', highlighter: 'crosshair' };
    canvas.style.cursor = cursors[t] || 'crosshair';
    if (t !== 'select') wbClearSelection();
}
function setPenColor(c) { wbPenColor = c; }
function setWbBg(c) {
    DB.set('os_wb_bg_' + wbActiveBoardId, c);
    wbFillBg();
    if (wbHistoryIndex >= 0) {
        wbRestoreFromDataUrl(wbHistory[wbHistoryIndex]);
    }
    wbPushHistory();
    wbSaveBoard();
}

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

function wbToggleGrid() {
    wbGridOn = !wbGridOn;
    var btn = document.getElementById('wb-grid-btn');
    if (btn) btn.classList.toggle('active-tool', wbGridOn);
    var saved = (wbHistoryIndex >= 0) ? wbHistory[wbHistoryIndex] : null;
    wbFillBg();
    if (saved) {
        var img = new Image();
        img.onload = function() { ctx.drawImage(img, 0, 0); };
        img.src = saved;
    }
}

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

    if (wbTool !== 'pen' && wbTool !== 'eraser' && wbTool !== 'highlighter') {
        wbSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    if (wbTool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, wbGetSize() / 2, 0, Math.PI * 2);
        ctx.fillStyle = wbPenColor;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }

    if (wbTool === 'highlighter') {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(p.x, p.y, wbGetSize() * 5, 0, Math.PI * 2);
        ctx.fillStyle = wbPenColor;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.restore();
    }
});

canvas.addEventListener('pointermove', function(e) {
    if (!wbDrawing) return;
    e.preventDefault();
    var p = wbGetXY(e);
    var size = wbGetSize();

    if (wbTool === 'select' && wbSelectStart) {
        var sx = Math.min(p.x, wbSelectStart.x);
        var sy = Math.min(p.y, wbSelectStart.y);
        var sw = Math.abs(p.x - wbSelectStart.x);
        var sh = Math.abs(p.y - wbSelectStart.y);
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

    if (wbTool === 'pen') {
        ctx.lineWidth   = size;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.strokeStyle = wbPenColor;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        wbLastX = p.x; wbLastY = p.y;
        return;
    }

    if (wbTool === 'highlighter') {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth   = size * 10;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.strokeStyle = wbPenColor;
        ctx.beginPath();
        ctx.moveTo(wbLastX, wbLastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
        wbLastX = p.x; wbLastY = p.y;
        return;
    }

    if (wbTool === 'eraser') {
        ctx.lineWidth   = size * 4;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.strokeStyle = wbGetBg();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(wbLastX, wbLastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        wbLastX = p.x; wbLastY = p.y;
        return;
    }

    if (!wbSnapshot) return;
    ctx.putImageData(wbSnapshot, 0, 0);
    ctx.strokeStyle = wbPenColor;
    ctx.fillStyle   = wbPenColor;
    ctx.lineWidth   = size;
    ctx.lineCap     = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

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
    ctx.globalAlpha = 1;
    wbSnapshot = null;

    if (wbTool === 'select' && wbSelectRect && wbSelectRect.w > 4 && wbSelectRect.h > 4) {
        var tb = document.getElementById('wb-select-toolbar');
        var con = document.getElementById('wb-container');
        var cRect = con.getBoundingClientRect();
        var scale = canvas.width / cRect.width;
        if (tb) {
            tb.style.display = 'flex';
            tb.style.left = (wbSelectRect.x / scale) + 'px';
            tb.style.top  = ((wbSelectRect.y + wbSelectRect.h) / scale + 6) + 'px';
        }
        return;
    }

    wbPushHistory();
    wbSaveBoard();
});

canvas.addEventListener('pointercancel', function() {
    wbDrawing = false;
    wbSnapshot = null;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
});

function wbClearSelection() {
    wbSelectRect = null; wbSelectStart = null; wbPreSelectData = null;
    var ov = document.getElementById('wb-select-overlay');
    if (ov) ov.style.display = 'none';
    var tb = document.getElementById('wb-select-toolbar');
    if (tb) tb.style.display = 'none';
}
function wbDeleteSelection() {
    if (!wbSelectRect || !wbPreSelectData) return;
    ctx.putImageData(wbPreSelectData, 0, 0);
    ctx.fillStyle = wbGetBg();
    ctx.fillRect(wbSelectRect.x, wbSelectRect.y, wbSelectRect.w, wbSelectRect.h);
    wbClearSelection();
    wbPushHistory();
    wbSaveBoard();
}
function wbMoveSelection() {
    if (!wbSelectRect || !wbPreSelectData) return;
    var selData = ctx.getImageData(wbSelectRect.x, wbSelectRect.y, wbSelectRect.w, wbSelectRect.h);
    ctx.putImageData(wbPreSelectData, 0, 0);
    ctx.fillStyle = wbGetBg();
    ctx.fillRect(wbSelectRect.x, wbSelectRect.y, wbSelectRect.w, wbSelectRect.h);
    ctx.putImageData(selData, wbSelectRect.x + 20, wbSelectRect.y + 20);
    wbClearSelection();
    wbPushHistory();
    wbSaveBoard();
}

function confirmWbText() {
    var txt = document.getElementById('wb-text-input').value.trim();
    var sz  = parseInt(document.getElementById('wb-text-size').value) || 18;
    if (!txt) { closeModals(); return; }
    ctx.font      = sz + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = wbPenColor;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillText(txt, wbStartX, wbStartY + sz);
    document.getElementById('wb-text-input').value = '';
    closeModals();
    wbPushHistory();
    wbSaveBoard();
}

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

// Boards
function wbSaveBoard() {
    var b = wbBoards.find(function(x) { return x.id === wbActiveBoardId; });
    if (b) {
        b.data = canvas.toDataURL();
        DB.set('os_boards', wbBoards);
    }
    wbMmSave();
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
    wbMmLoad();
    var b = wbBoards.find(function(x) { return x.id === id; });
    wbFillBg();
    if (b && b.data) {
        wbRestoreFromDataUrl(b.data, function() { wbPushHistory(); });
    } else {
        wbPushHistory();
    }
    wbRenderTabs();
    if (wbMindMapMode) (window.wbMmRender || wbMmRender)();
}
function wbNewBoard() {
    wbSaveBoard();
    var b = { id: Date.now(), name: 'Board ' + (wbBoards.length + 1), data: null };
    wbBoards.push(b);
    DB.set('os_boards', wbBoards);
    wbActiveBoardId = b.id;
    wbHistory = []; wbHistoryIndex = -1;
    wbMindMapNodes = []; wbMindMapEdges = [];
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
        wbMmLoad();
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

// Aliases for backward compat
var boards = wbBoards;
function renderWbTabs() { wbRenderTabs(); }
function switchBoard(id) { wbSwitchBoard(id); }
function saveBoard() { wbSaveBoard(); }

document.getElementById('wb-size').addEventListener('input', function() {
    document.getElementById('wb-size-display').innerText = this.value + 'px';
});

// ===== MIND MAP =====
function wbToggleMindMap() {
    wbMindMapMode = !wbMindMapMode;
    var svg = document.getElementById('wb-mindmap-svg');
    var statusBar = document.getElementById('mm-status');
    var mmBtn = document.getElementById('wb-tool-mindmap');

    if (wbMindMapMode) {
        wbMmLoad();
        if (svg) svg.style.display = 'block';
        if (statusBar) statusBar.style.display = 'flex';
        if (mmBtn) mmBtn.classList.add('active-tool');
    } else {
        if (svg) svg.style.display = 'none';
        if (statusBar) statusBar.style.display = 'none';
        if (mmBtn) mmBtn.classList.remove('active-tool');
        wbMindMapSelected = null;
    }
}

function wbMmLoad() {
    var saved = DB.get('os_mm_' + wbActiveBoardId, { nodes: [], edges: [] });
    wbMindMapNodes = saved.nodes || [];
    wbMindMapEdges = saved.edges || [];
    if (wbMindMapMode) (window.wbMmRender || wbMmRender)();
}

function wbMmSave() {
    DB.set('os_mm_' + wbActiveBoardId, { nodes: wbMindMapNodes, edges: wbMindMapEdges });
}

function wbMmRender() {
    var svg = document.getElementById('wb-mindmap-svg');
    if (!svg) return;
    svg.innerHTML = '';

    // Set SVG size to canvas size
    var con = document.getElementById('wb-container');
    if (con) {
        svg.setAttribute('width', con.clientWidth);
        svg.setAttribute('height', con.clientHeight);
    }

    // Draw edges first
    wbMindMapEdges.forEach(function(edge) {
        var from = wbMindMapNodes.find(function(n) { return n.id === edge.from; });
        var to   = wbMindMapNodes.find(function(n) { return n.id === edge.to; });
        if (!from || !to) return;
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
        line.setAttribute('stroke', 'rgba(255,255,255,0.3)');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
    });

    // Draw nodes
    wbMindMapNodes.forEach(function(node) {
        var isSelected = node.id === wbMindMapSelected;
        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');
        g.style.cursor = 'pointer';

        var w = Math.max(80, node.text.length * 8 + 20);
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -(w/2)); rect.setAttribute('y', '-18');
        rect.setAttribute('width', w); rect.setAttribute('height', '36');
        rect.setAttribute('rx', '10');
        rect.setAttribute('fill', node.color || '#3b82f6');
        rect.setAttribute('stroke', isSelected ? '#fff' : 'none');
        rect.setAttribute('stroke-width', isSelected ? '2' : '0');

        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', '#fff');
        text.setAttribute('font-size', '13');
        text.setAttribute('font-family', 'Inter, sans-serif');
        text.textContent = node.text;

        g.appendChild(rect);
        g.appendChild(text);

        // Click handler
        (function(n) {
            g.addEventListener('click', function(e) {
                e.stopPropagation();
                if (wbMindMapSelected === n.id) {
                    // Double-click-like: deselect
                    wbMindMapSelected = null;
                } else {
                    wbMindMapSelected = n.id;
                }
                wbMmRender();
            });
            // Context menu / long press for delete
            g.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                wbMmDeleteNode(n.id);
            });
            // Drag
            var isDragging = false, dragStartX = 0, dragStartY = 0, nodeStartX = 0, nodeStartY = 0;
            g.addEventListener('pointerdown', function(e) {
                e.stopPropagation();
                isDragging = true;
                dragStartX = e.clientX; dragStartY = e.clientY;
                nodeStartX = n.x; nodeStartY = n.y;
                g.setPointerCapture(e.pointerId);
            });
            g.addEventListener('pointermove', function(e) {
                if (!isDragging) return;
                var dx = e.clientX - dragStartX;
                var dy = e.clientY - dragStartY;
                n.x = nodeStartX + dx;
                n.y = nodeStartY + dy;
                wbMmRender();
            });
            g.addEventListener('pointerup', function(e) {
                if (isDragging) {
                    isDragging = false;
                    wbMmSave();
                }
            });
        })(node);

        svg.appendChild(g);
    });

    // SVG click on empty area
    svg.onclick = function(e) {
        if (e.target === svg) {
            var rect2 = svg.getBoundingClientRect();
            var clickX = e.clientX - rect2.left;
            var clickY = e.clientY - rect2.top;
            wbMmAddNode(clickX, clickY);
        }
    };
}

function wbMmAddNode(x, y) {
    // Store pending position and open modal
    wbMindMapMode_pendingX = x;
    wbMindMapMode_pendingY = y;
    wbMmPendingColor = '#3b82f6';
    var inp = document.getElementById('mm-node-text-input');
    if (inp) inp.value = '';
    // Reset color highlights
    document.querySelectorAll('[id^="mm-color-"]').forEach(function(b) { b.style.borderColor = 'transparent'; });
    var blueBtn = document.getElementById('mm-color-blue');
    if (blueBtn) blueBtn.style.borderColor = '#fff';
    openModal('modal-mm-node');
}

var wbMindMapMode_pendingX = 0, wbMindMapMode_pendingY = 0;

function confirmMmNode() {
    var inp = document.getElementById('mm-node-text-input');
    var text = inp ? inp.value.trim() : '';
    if (!text) { closeModals(); return; }

    var newNode = {
        id: Date.now(),
        x: wbMindMapMode_pendingX,
        y: wbMindMapMode_pendingY,
        text: text,
        color: wbMmPendingColor || '#3b82f6',
        parentId: wbMindMapSelected
    };
    wbMindMapNodes.push(newNode);

    // Create edge if there's a selected parent
    if (wbMindMapSelected) {
        wbMindMapEdges.push({ from: wbMindMapSelected, to: newNode.id });
    }

    wbMindMapSelected = newNode.id;
    wbMmSave();
    closeModals();
    (window.wbMmRender || wbMmRender)();
}

function setMmNodeColor(c) {
    wbMmPendingColor = c;
    document.querySelectorAll('[id^="mm-color-"]').forEach(function(b) { b.style.borderColor = 'transparent'; });
    var colorMap = { '#3b82f6': 'blue', '#22c55e': 'green', '#ef4444': 'red', '#8b5cf6': 'purple', '#f59e0b': 'amber' };
    var name = colorMap[c];
    if (name) {
        var btn = document.getElementById('mm-color-' + name);
        if (btn) btn.style.borderColor = '#fff';
    }
}

function wbMmDeleteNode(id) {
    showConfirm('Delete Node', 'Remove this node?', function() {
        wbMindMapNodes = wbMindMapNodes.filter(function(n) { return n.id !== id; });
        wbMindMapEdges = wbMindMapEdges.filter(function(e) { return e.from !== id && e.to !== id; });
        if (wbMindMapSelected === id) wbMindMapSelected = null;
        wbMmSave();
        (window.wbMmRender || wbMmRender)();
    });
}

function wbMindMapExport() {
    // Stamp mind map SVG onto canvas
    var svg = document.getElementById('wb-mindmap-svg');
    if (!svg) return;
    var svgData = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0);
        wbPushHistory();
        wbSaveBoard();
        showAlert('Stamped!', 'Mind map exported to canvas.');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// ===== PDF ANNOTATION =====
var pdfState = {
    doc: null,
    currentPage: 1,
    totalPages: 0,
    tool: 'highlight',
    color: '#fde04788',
    penSize: 10,
    annotations: [],   // array of {page, tool, color, size, points[]}
    currentStroke: null,
    noteId: null       // which note opened this
};

function openPdfAnnotator() {
    pdfState.noteId = activeNote;
    document.getElementById('pdf-annotator-overlay').style.display = 'flex';
    document.getElementById('pdf-upload-prompt').style.display = 'flex';
    document.getElementById('pdf-render-container').classList.add('hidden');
}
function closePdfAnnotator() {
    document.getElementById('pdf-annotator-overlay').style.display = 'none';
    pdfState.doc = null;
    pdfState.annotations = [];
    pdfState.currentPage = 1;
    pdfState.totalPages = 0;
}
function setPdfTool(t) {
    pdfState.tool = t;
    document.querySelectorAll('.pdf-tool-btn').forEach(function(b) { b.classList.remove('active-pdf-tool'); });
    var btn = document.getElementById('pdf-tool-' + t);
    if (btn) btn.classList.add('active-pdf-tool');
}
function setPdfColor(c) {
    pdfState.color = c;
}
function pdfUndo() {
    if (pdfState.annotations.length === 0) return;
    pdfState.annotations.pop();
    pdfRenderCurrentPage();
}

function loadPdfForAnnotation(inp) {
    var f = inp.files[0]; if (!f) return;
    if (!window.pdfjsLib) {
        showAlert('PDF.js not loaded', 'Please check your internet connection.'); return;
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var r = new FileReader();
    r.onload = function(e) {
        var typedArray = new Uint8Array(e.target.result);
        window.pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
            pdfState.doc = pdf;
            pdfState.totalPages = pdf.numPages;
            pdfState.currentPage = 1;
            pdfState.annotations = [];
            document.getElementById('pdf-upload-prompt').style.display = 'none';
            document.getElementById('pdf-render-container').classList.remove('hidden');
            pdfRenderCurrentPage();
        }).catch(function(err) {
            showAlert('PDF Error', 'Could not load this PDF.');
        });
    };
    r.readAsArrayBuffer(f);
    inp.value = '';
}

function pdfRenderCurrentPage() {
    if (!pdfState.doc) return;
    var container = document.getElementById('pdf-render-container');
    container.innerHTML = '';

    var pageInfo = document.getElementById('pdf-page-info');
    if (pageInfo) pageInfo.innerText = 'Page ' + pdfState.currentPage + '/' + pdfState.totalPages;

    for (var pg = 1; pg <= pdfState.totalPages; pg++) {
        (function(pageNum) {
            pdfState.doc.getPage(pageNum).then(function(page) {
                var viewport = page.getViewport({ scale: 1.4 });
                var wrapper = document.createElement('div');
                wrapper.className = 'pdf-page-wrapper';
                wrapper.id = 'pdf-page-wrapper-' + pageNum;

                var renderCanvas = document.createElement('canvas');
                renderCanvas.className = 'pdf-page-canvas';
                renderCanvas.width = viewport.width;
                renderCanvas.height = viewport.height;

                var annotCanvas = document.createElement('canvas');
                annotCanvas.className = 'pdf-annot-canvas';
                annotCanvas.width = viewport.width;
                annotCanvas.height = viewport.height;
                annotCanvas.style.position = 'absolute';
                annotCanvas.style.top = '0'; annotCanvas.style.left = '0';
                annotCanvas.style.cursor = 'crosshair';

                wrapper.style.position = 'relative';
                wrapper.style.width = viewport.width + 'px';
                wrapper.appendChild(renderCanvas);
                wrapper.appendChild(annotCanvas);
                container.appendChild(wrapper);

                page.render({ canvasContext: renderCanvas.getContext('2d'), viewport: viewport });

                // Redraw saved annotations for this page
                pdfRedrawAnnotations(annotCanvas, pageNum);

                // Drawing events
                var isDrawing = false;
                var stroke = null;

                annotCanvas.addEventListener('pointerdown', function(e) {
                    isDrawing = true;
                    annotCanvas.setPointerCapture(e.pointerId);
                    var rect = annotCanvas.getBoundingClientRect();
                    var x = (e.clientX - rect.left) * (annotCanvas.width / rect.width);
                    var y = (e.clientY - rect.top) * (annotCanvas.height / rect.height);
                    stroke = { page: pageNum, tool: pdfState.tool, color: pdfState.color, size: parseInt(document.getElementById('pdf-pen-size').value) || 10, points: [[x, y]] };
                });

                annotCanvas.addEventListener('pointermove', function(e) {
                    if (!isDrawing || !stroke) return;
                    var rect = annotCanvas.getBoundingClientRect();
                    var x = (e.clientX - rect.left) * (annotCanvas.width / rect.width);
                    var y = (e.clientY - rect.top) * (annotCanvas.height / rect.height);
                    stroke.points.push([x, y]);
                    pdfDrawStroke(annotCanvas.getContext('2d'), stroke);
                });

                annotCanvas.addEventListener('pointerup', function() {
                    if (!isDrawing || !stroke) return;
                    isDrawing = false;
                    if (stroke.points.length > 0) {
                        pdfState.annotations.push(stroke);
                    }
                    stroke = null;
                    pdfRedrawAnnotations(annotCanvas, pageNum);
                });
            });
        })(pg);
    }
}

function pdfDrawStroke(actx, stroke) {
    actx.save();
    actx.lineCap = 'round';
    actx.lineJoin = 'round';
    if (stroke.tool === 'highlight') {
        actx.globalAlpha = 0.4;
        actx.strokeStyle = stroke.color;
        actx.lineWidth = stroke.size * 2;
    } else if (stroke.tool === 'pen') {
        actx.globalAlpha = 1;
        actx.strokeStyle = stroke.color;
        actx.lineWidth = stroke.size / 2;
    } else if (stroke.tool === 'erase') {
        actx.globalCompositeOperation = 'destination-out';
        actx.globalAlpha = 1;
        actx.strokeStyle = 'rgba(0,0,0,1)';
        actx.lineWidth = stroke.size;
    } else if (stroke.tool === 'text') {
        // Text annotations are handled separately
        actx.restore();
        return;
    }
    actx.beginPath();
    var pts = stroke.points;
    if (pts.length === 1) {
        actx.arc(pts[0][0], pts[0][1], actx.lineWidth / 2, 0, Math.PI * 2);
        actx.fill();
    } else {
        actx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) {
            actx.lineTo(pts[i][0], pts[i][1]);
        }
        actx.stroke();
    }
    actx.restore();
}

function pdfRedrawAnnotations(annotCanvas, pageNum) {
    var actx = annotCanvas.getContext('2d');
    actx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
    pdfState.annotations.filter(function(s) { return s.page === pageNum; }).forEach(function(s) {
        pdfDrawStroke(actx, s);
    });
}

function savePdfAnnotations() {
    if (!pdfState.doc) return;
    // Stamp all pages as images into the current note
    var container = document.getElementById('pdf-render-container');
    var pages = container.querySelectorAll('.pdf-page-wrapper');
    var htmlParts = [];
    var processed = 0;

    if (pages.length === 0) {
        closePdfAnnotator();
        return;
    }

    pages.forEach(function(wrapper, idx) {
        var renderCanvas = wrapper.querySelector('.pdf-page-canvas');
        var annotCanvas = wrapper.querySelector('.pdf-annot-canvas');
        if (!renderCanvas || !annotCanvas) { processed++; return; }

        // Composite: draw render canvas then annotation canvas
        var merged = document.createElement('canvas');
        merged.width = renderCanvas.width;
        merged.height = renderCanvas.height;
        var mctx = merged.getContext('2d');
        mctx.drawImage(renderCanvas, 0, 0);
        mctx.drawImage(annotCanvas, 0, 0);

        var dataUrl = merged.toDataURL('image/jpeg', 0.85);
        htmlParts[idx] = '<img src="' + dataUrl + '" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;" alt="PDF page ' + (idx + 1) + '">';
        processed++;

        if (processed === pages.length) {
            var n = notes.find(function(x) { return x.id === pdfState.noteId; });
            if (n) {
                n.body = (n.body || '') + '<hr style="margin:16px 0;opacity:.3;"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px;">📄 PDF Annotation</div>' + htmlParts.join('');
                DB.set('os_notes', notes);
                if (pdfState.noteId === activeNote) {
                    document.getElementById('note-editor').innerHTML = n.body;
                }
            }
            closePdfAnnotator();
            showAlert('Saved ✅', 'Annotated PDF added to note.');
        }
    });
}

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
        os_note_groups: DB.get('os_note_groups', []),
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
        if (_uid) {
            deleteDoc(doc(_db, 'users', _uid))
                .then(function() { location.reload(); })
                .catch(function() { location.reload(); });
        } else {
            location.reload();
        }
    });
}

// ✅ KEEP this one
// switchTab whiteboard patch — safe to run immediately
(function() {
    var _origSwitchTab = switchTab;
    switchTab = function(name) {
        _origSwitchTab(name);
        if (name === 'whiteboard') { setTimeout(wbInit, 30); }
    };
})();

var _wbInitDone = false;
function wbInit() {
    if (_wbInitDone) return;
    _wbInitDone = true;
    wbResizeCanvas();
    wbMmLoad();
    var b = wbBoards.find(function(x) { return x.id === wbActiveBoardId; });
    if (b && b.data) {
        wbRestoreFromDataUrl(b.data, function() { wbPushHistory(); });
    } else {
        wbFillBg();
        wbPushHistory();
    }
    wbRenderTabs();
    wbSetTool('pen');
}

// ===== GLOBAL EXPORTS =====
// Auth
window.initApp                  = initApp;
window.logOut                   = logOut;
window.signInWithGoogle         = signInWithGoogle;
window.signInWithEmail          = signInWithEmail;
window.signUpWithEmail          = signUpWithEmail;
window.showLoginError           = showLoginError;

// Navigation
window.switchTab                = switchTab;
window.openModal                = openModal;
window.closeModals              = closeModals;

// Tasks
window.addTask                  = addTask;
window.dashAddTask              = dashAddTask;
window.toggleTask               = toggleTask;
window.deleteTask               = deleteTask;
window.startEditTask            = startEditTask;
window.saveTaskEdit             = saveTaskEdit;
window.cancelTaskEdit           = cancelTaskEdit;
window.clearCompletedTasks      = clearCompletedTasks;
window.taskColorOff             = taskColorOff;
window.addSubtask               = addSubtask;
window.toggleSubtask            = toggleSubtask;
window.deleteSubtask            = deleteSubtask;
window.toggleSubtaskInput       = toggleSubtaskInput;

// Goals
window.addGoal                  = addGoal;
window.toggleGoal               = toggleGoal;
window.deleteGoal               = deleteGoal;

// Quick links
window.saveQuickLink            = saveQuickLink;
window.openAddLinkModal         = openAddLinkModal;
window.deleteLink               = deleteLink;

// Dashboard
window.saveQuickNote            = saveQuickNote;
window.quickNoteToNotes         = quickNoteToNotes;
window.updateDashWidgets        = updateDashWidgets;

// Settings / Theme
window.toggleTheme              = toggleTheme;
window.setAccent                = setAccent;
window.setFontScale             = setFontScale;
window.setClockColor            = setClockColor;
window.setBg                    = setBg;
window.setLanguage              = setLanguage;
window.setStudentName           = setStudentName;
window.syncSettingsName         = syncSettingsName;

// Profile
window.setProfileEmoji          = setProfileEmoji;
window.setAvatarBg              = setAvatarBg;
window.handleProfileImage       = handleProfileImage;
window.renderProfileDisplay     = renderProfileDisplay;

// Data
window.exportAllData            = exportAllData;
window.importAllData            = importAllData;
window.resetAllData             = resetAllData;

// Decks / Flashcards
window.renderDecks              = renderDecks;
window.populateGroupSelect      = populateGroupSelect;
window.showDeckList             = showDeckList;
window.showEditView             = showEditView;
window.openDeck                 = openDeck;
window.saveDeck                 = saveDeck;
window.deleteDeck               = deleteDeck;
window.saveGroup                = saveGroup;
window.deleteGroup              = deleteGroup;
window.toggleGroupOpen          = toggleGroupOpen;
window.setDeckEmoji             = setDeckEmoji;
window.openAddCardModal         = openAddCardModal;
window.saveFlashcard            = saveFlashcard;
window.startCardEdit            = startCardEdit;
window.deleteCard               = deleteCard;
window.triggerImportDeck        = triggerImportDeck;
window.exportDeck               = exportDeck;
window.handleImportDeck         = handleImportDeck;

// Study
window.startStudy               = startStudy;
window.flipCard                 = flipCard;
window.rateCard                 = rateCard;
window.showHint                 = showHint;
window.showWriteHint            = showWriteHint;
window.checkWriteAnswer         = checkWriteAnswer;
window.startMatchGame           = startMatchGame;
window.matchClick               = matchClick;
window.startWordSearch          = startWordSearch;
window.showStudyCard            = showStudyCard;
// Export flashcard internals so patches can access and hook shared state
Object.defineProperty(window, 'decks',        { configurable: true, enumerable: true, get: function() { return decks; },        set: function(v) { decks = v; } });
Object.defineProperty(window, 'activeDeckId', { configurable: true, enumerable: true, get: function() { return activeDeckId; }, set: function(v) { activeDeckId = v; } });
Object.defineProperty(window, 'studyQueue',   { configurable: true, enumerable: true, get: function() { return studyQueue; },   set: function(v) { studyQueue = v; } });
Object.defineProperty(window, 'studyIdx',     { configurable: true, enumerable: true, get: function() { return studyIdx; },     set: function(v) { studyIdx = v; } });

// Grades
window.renderGrades             = renderGrades;          // ✅ was renderSubjects
window.saveSubject              = saveSubject;
window.deleteSubject            = deleteSubject;
window.openAddTestModal         = openAddTestModal;
window.saveTest                 = saveTest;
window.deleteTest               = deleteTest;

// Calendar
window.renderCalendar           = renderCalendar;
window.switchCalView            = switchCalView;
window.calGoToday               = calGoToday;
window.changeMonth              = changeMonth;
window.changeWeek               = changeWeek;
window.openEventModal           = openEventModal;
window.saveCalEvent             = saveCalEvent;
window.delEv                    = delEv;
window.saveCalendarImport       = saveCalendarImport;
window.clearCalendar            = clearCalendar;
window.openCalNewTab            = openCalNewTab;
window.requestCalNotifications  = requestCalNotifications;
window.requestTaskNotifications = requestTaskNotifications;

// Notes
window.renderNotes              = renderNotes;           // ✅ was renderNoteGroups
window.createNewNote            = createNewNote;
window.loadNote                 = loadNote;
window.saveNote                 = saveNote;
window.deleteNote               = deleteNote;
window.deleteCurrentNote        = deleteCurrentNote;
window.confirmDeleteNote        = confirmDeleteNote;
window.formatDoc                = formatDoc;
window.noteInsertCheckbox       = noteInsertCheckbox;
window.noteHighlight            = noteHighlight;
window.noteTextColor            = noteTextColor;
window.setNoteFont              = setNoteFont;
window.noteIndent               = noteIndent;
window.noteOutdent              = noteOutdent;
window.noteInsertImage          = noteInsertImage;
window.noteInsertTable          = noteInsertTable;
window.toggleNotesSidebar       = toggleNotesSidebar;
window.toggleTablePicker        = toggleTablePicker;
window.toggleStickerPanel       = toggleStickerPanel;
window.insertSticker            = insertSticker;
window.saveNoteGroup            = saveNoteGroup;
window.setNoteGroupColor        = setNoteGroupColor;
window.deleteNoteGroup          = deleteNoteGroup;
window.openPdfAnnotator         = openPdfAnnotator;

// Whiteboard
window.wbSetTool                = wbSetTool;
window.wbSetColor               = setPenColor;           // ✅ was wbSetColor (doesn't exist)
window.setPenColor              = setPenColor;
window.setWbBg                  = setWbBg;
window.wbClear                  = clearCanvas;           // ✅ was wbClear (doesn't exist)
window.clearCanvas              = clearCanvas;
window.wbUndo                   = wbUndo;
window.wbRedo                   = wbRedo;
window.wbInsertImage            = wbInsertImage;
window.wbSaveBoard              = wbSaveBoard;
window.wbAddBoard               = wbNewBoard;            // ✅ was wbAddBoard (doesn't exist)
window.wbNewBoard               = wbNewBoard;
window.wbDeleteBoard            = wbDeleteBoard;
window.wbSwitchBoard            = wbSwitchBoard;
window.wbToggleGrid             = wbToggleGrid;
window.wbToggleFullscreen       = wbToggleFullscreen;
window.wbToggleMindMap          = wbToggleMindMap;
window.wbClearSelection         = wbClearSelection;
window.wbDeleteSelection        = wbDeleteSelection;
window.wbMoveSelection          = wbMoveSelection;
window.confirmWbText            = confirmWbText;
window.downloadWhiteboard       = downloadWhiteboard;
window.wbMmLoad                 = wbMmLoad;
window.wbMindMapExport          = wbMindMapExport;
window.confirmMmNode            = confirmMmNode;
window.setMmNodeColor           = setMmNodeColor;
// Export mindmap internals so patches can replace wbMmRender and access shared state
window.wbMmRender               = wbMmRender;
window.wbMmSave                 = wbMmSave;
window.wbMmDeleteNode           = wbMmDeleteNode;
window.wbMmAddNode              = wbMmAddNode;
Object.defineProperty(window, 'wbMindMapNodes',    { configurable: true, enumerable: true, get: function() { return wbMindMapNodes; },    set: function(v) { wbMindMapNodes = v; } });
Object.defineProperty(window, 'wbMindMapEdges',    { configurable: true, enumerable: true, get: function() { return wbMindMapEdges; },    set: function(v) { wbMindMapEdges = v; } });
Object.defineProperty(window, 'wbMindMapSelected', { configurable: true, enumerable: true, get: function() { return wbMindMapSelected; }, set: function(v) { wbMindMapSelected = v; } });

// Focus / Pomodoro
window.toggleTimer              = toggleTimer;
window.resetTimer               = resetTimer;
window.setPomoMode              = setPomoMode;
window.toggleAutoBreak          = toggleAutoBreak;
window.updatePomoTimes          = updatePomoTimes;
window.skipPomodoroSession      = skipPomodoroSession;
window.toggleTimerSound         = toggleTimerSound;
window.autoStartBreak           = autoStartBreak;
window.setCustomPomodoro        = setCustomPomodoro;

// Widgets
window.setWidgetVisible         = setWidgetVisible;
window.setWidgetColor           = setWidgetColor;

// Calculator
window.calcAppend               = calcAppend;
window.calcClear                = calcClear;
window.calcBackspace            = calcBackspace;
window.calcSolve                = calcSolve;
window.calcSciFunc              = calcSciFunc;
window.calcToggleSci            = calcToggleSci;

// PDF
window.setPdfTool               = setPdfTool;
window.setPdfColor              = setPdfColor;
window.closePdfAnnotator        = closePdfAnnotator;
window.savePdfAnnotations       = savePdfAnnotations;
window.pdfUndo                  = pdfUndo;
window.loadPdfForAnnotation     = loadPdfForAnnotation;

// Password reset / verification
window.resetPassword            = resetPassword;
window.resendVerificationEmail  = resendVerificationEmail;
window.showLoginSuccess         = showLoginSuccess;



// ===== openModal PATCH — populates deck groups when modal opens =====
(function() {
    var _origOpenModal = openModal;
    window.openModal = function(id) {
        _origOpenModal(id);
        if (id === 'modal-add-deck') {
            populateGroupSelect();
            initDeckEmojiPicker();
        }
        if (id === 'modal-mm-node') {
            setTimeout(function() {
                var inp = document.getElementById('mm-node-text-input');
                if (inp) inp.focus();
            }, 100);
        }
    };
})();

// ============================================================
// ===== STUDENTOS UPDATE — ALL NEW FEATURES PATCH =====
// ============================================================

// ===== TOOLBAR DROPDOWN TOGGLE =====
function toggleToolbarDropdown(id) {
    var menu = document.getElementById(id);
    if (!menu) return;
    var isOpen = menu.classList.contains('open');
    // Close all open menus first
    document.querySelectorAll('.tbar-dropdown-menu.open').forEach(function(m) {
        m.classList.remove('open');
    });
    if (!isOpen) {
        menu.classList.add('open');
        // Close on outside click
        setTimeout(function() {
            document.addEventListener('click', function _close(e) {
                if (!menu.contains(e.target) && !e.target.closest('.tbar-group')) {
                    menu.classList.remove('open');
                    document.removeEventListener('click', _close);
                }
            });
        }, 0);
    }
}
window.toggleToolbarDropdown = toggleToolbarDropdown;

// ===== TOAST =====
function sosToast(msg, duration) {
    var el = document.getElementById('sos-toast');
    if (!el) { el = document.createElement('div'); el.id = 'sos-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.classList.remove('show'); }, duration || 2200);
}
window.sosToast = sosToast;

// ===== FIXED CHECKBOX PERSISTENCE =====
(function() {
    // Override noteInsertCheckbox to use data-attribute based checkboxes
    window.noteInsertCheckbox = function() {
        var editor = document.getElementById('note-editor');
        if (!editor) return;
        editor.focus();
        var cbId = 'cb-' + Date.now() + '-' + Math.floor(Math.random()*9999);
        var html = '<div class="note-cb-row" data-cb-id="' + cbId + '" data-checked="false" contenteditable="false">'
            + '<input type="checkbox" onchange="sosToggleCb(this,\'' + cbId + '\')">'
            + '<span class="cb-text" contenteditable="true">Task item</span>'
            + '</div><p><br></p>';
        document.execCommand('insertHTML', false, html);
        // Don't call saveNote yet — let the input event handle it
        setTimeout(function() {
            var newRow = editor.querySelector('[data-cb-id="' + cbId + '"] .cb-text');
            if (newRow) { newRow.focus(); selectAll(newRow); }
            saveNote();
        }, 50);
    };

    function selectAll(el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    window.sosToggleCb = function(checkbox, cbId) {
        var row = document.querySelector('[data-cb-id="' + cbId + '"]');
        if (!row) return;
        var checked = checkbox.checked;
        row.dataset.checked = checked ? 'true' : 'false';
        row.classList.toggle('cb-checked', checked);
        saveNote();
    };

    // Patch saveNote to capture checkbox state before serializing
    var _origSaveNote = window.saveNote;
    window.saveNote = function() {
        var editor = document.getElementById('note-editor');
        if (!editor) { if (_origSaveNote) _origSaveNote(); return; }
        // Sync all checkboxes to their data-checked attribute BEFORE innerHTML is read
        editor.querySelectorAll('.note-cb-row').forEach(function(row) {
            var cb = row.querySelector('input[type=checkbox]');
            if (cb) {
                row.dataset.checked = cb.checked ? 'true' : 'false';
                row.classList.toggle('cb-checked', cb.checked);
            }
        });
        if (_origSaveNote) _origSaveNote();
    };

    // Patch loadNote to restore checkbox checked states after innerHTML is set
    var _origLoadNote = window.loadNote;
    window.loadNote = function(id) {
        if (_origLoadNote) _origLoadNote(id);
        setTimeout(function() {
            var editor = document.getElementById('note-editor');
            if (!editor) return;
            editor.querySelectorAll('.note-cb-row').forEach(function(row) {
                var cb = row.querySelector('input[type=checkbox]');
                if (cb && row.dataset.checked === 'true') {
                    cb.checked = true;
                    row.classList.add('cb-checked');
                }
            });
        }, 30);
    };
})();

// ===== FLASHCARD EASY/HARD BADGES FIX =====
// Track easy ratings separately
var _cardEasySet = DB.get('os_card_easy', {});

(function() {
    // Override rateCard to track easy ratings
    var _origRateCard = window.rateCard;
    window.rateCard = function(rating) {
        var card = studyQueue[studyIdx];
        if (card && activeDeckId) {
            var key = activeDeckId + '_' + card.id;
            if (rating === 'easy') {
                _cardEasySet[key] = true;
                DB.set('os_card_easy', _cardEasySet);
            } else {
                // Mark as hard - remove easy tag
                delete _cardEasySet[key];
                DB.set('os_card_easy', _cardEasySet);
            }
        }
        if (_origRateCard) _origRateCard(rating);
    };

    // Override renderCardList to show proper badges
    var _origRenderCardList = window.renderCardList;
    window.renderCardList = function() {
        var c = document.getElementById('cards-list-container');
        if (!c) return;
        var deck = decks.find(function(d) { return d.id === activeDeckId; });
        if (!deck) { if (_origRenderCardList) _origRenderCardList(); return; }
        c.innerHTML = '';
        if (!deck.cards || deck.cards.length === 0) {
            c.innerHTML = '<div class="text-center py-10 text-[var(--text-muted)] text-sm">No cards yet. Add your first card!</div>';
            return;
        }
        deck.cards.forEach(function(card, i) {
            var statKey = activeDeckId + '_' + card.id;
            var hardCount = cardStats[statKey] || 0;
            var isEasy = _cardEasySet[statKey] === true;
            var diffBadge = '';
            if (hardCount >= 2) {
                diffBadge = '<span class="card-diff-badge hard"><i class="fa-solid fa-fire" style="font-size:.55rem"></i> Hard</span>';
            } else if (isEasy) {
                diffBadge = '<span class="card-diff-badge easy"><i class="fa-solid fa-check" style="font-size:.55rem"></i> Easy</span>';
            }
            var starBadge = '';
            if (card.starred) {
                starBadge = '<span class="card-diff-badge starred"><i class="fa-solid fa-star" style="font-size:.55rem"></i> Starred</span>';
            }
            var div = document.createElement('div');
            div.className = 'flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[var(--glass-hover)] group transition';
            div.innerHTML = '<div class="flex-1 min-w-0">'
                + '<div class="flex items-center gap-2">'
                + '<div class="text-sm font-medium truncate">' + card.q + '</div>'
                + diffBadge
                + starBadge
                + '</div>'
                + '<div class="text-xs text-[var(--text-muted)] truncate">' + card.a + '</div>'
                + (card.tip ? '<div class="text-[10px] text-yellow-400/70 truncate"><i class="fa-solid fa-lightbulb" style="font-size:.6rem"></i> ' + card.tip + '</div>' : '')
                + '</div>'
                + '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">'
                + '<button onclick="startCardEdit(' + i + ')" class="text-[var(--text-muted)] hover:text-[var(--accent)] p-1 text-xs"><i class="fa-solid fa-pencil"></i></button>'
                + '<button onclick="deleteCard(' + i + ')" class="text-[var(--text-muted)] hover:text-red-400 p-1 text-xs"><i class="fa-solid fa-trash"></i></button>'
                + '</div>';
            c.appendChild(div);
        });
    };
})();

// ===== WHITEBOARD BACKGROUND ONE-CLICK FIX (pixel swap) =====
(function() {
    var _origSetWbBg = window.setWbBg;
    window.setWbBg = function(newColor) {
        var prevBg = wbGetBg();
        DB.set('os_wb_bg_' + wbActiveBoardId, newColor);
        // Update active button indicator
        _updateWbBgButtons(newColor);

        if (wbHistoryIndex < 0) {
            // No history yet — just fill
            wbFillBg();
            wbPushHistory();
            wbSaveBoard();
            return;
        }

        // Load the latest snapshot, then pixel-swap old bg color to new color
        var dataUrl = wbHistory[wbHistoryIndex];
        var img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            // Pixel swap
            try {
                var prevRGB = _hexToRGB(prevBg);
                var newRGB  = _hexToRGB(newColor);
                var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var d = imgData.data;
                var tol = 25;
                for (var i = 0; i < d.length; i += 4) {
                    if (Math.abs(d[i]   - prevRGB[0]) < tol &&
                        Math.abs(d[i+1] - prevRGB[1]) < tol &&
                        Math.abs(d[i+2] - prevRGB[2]) < tol) {
                        d[i]   = newRGB[0];
                        d[i+1] = newRGB[1];
                        d[i+2] = newRGB[2];
                    }
                }
                ctx.putImageData(imgData, 0, 0);
            } catch(e) {
                // Fallback to fill
                ctx.fillStyle = newColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            if (wbGridOn) wbDrawGrid();
            wbPushHistory();
            wbSaveBoard();
        };
        img.onerror = function() {
            wbFillBg();
            wbPushHistory();
            wbSaveBoard();
        };
        img.src = dataUrl;
    };

    function _hexToRGB(hex) {
        var h = hex.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    }

    function _updateWbBgButtons(activeColor) {
        var bgMap = {
            '#ffffff': 'wbbg-white',
            '#09090b': 'wbbg-dark',
            '#fef3c7': 'wbbg-cream',
            '#f0fdf4': 'wbbg-green',
            '#eff6ff': 'wbbg-blue'
        };
        Object.keys(bgMap).forEach(function(c) {
            var btn = document.getElementById(bgMap[c]);
            if (btn) btn.classList.toggle('wb-bg-active', c === activeColor);
        });
    }
    window._updateWbBgButtons = _updateWbBgButtons;

    // Set initial active bg button state
    (function() {
        var existingBg = DB.get('os_wb_bg_' + (typeof wbActiveBoardId !== 'undefined' ? wbActiveBoardId : ''), '#09090b');
        _updateWbBgButtons(existingBg);
    })();
})();

// ===== MULTI-CALENDAR SUPPORT =====
(function() {
    // Migrate legacy single URL to array
    var _legacyUrl = DB.get('os_cal_url', '');
    var _calUrls = DB.get('os_cal_urls', null);
    if (_calUrls === null) {
        if (_legacyUrl) {
            _calUrls = [{ id: Date.now(), label: 'My Calendar', url: _legacyUrl }];
        } else {
            _calUrls = [];
        }
        DB.set('os_cal_urls', _calUrls);
    }
    var _activeCalIdx = 0;

    function renderCalendarUrls() {
        var list = document.getElementById('cal-url-list');
        if (!list) return;
        _calUrls = DB.get('os_cal_urls', []);
        if (_calUrls.length === 0) {
            list.innerHTML = '<div class="text-xs text-center text-[var(--text-muted)] py-3">No calendars added yet.</div>';
            return;
        }
        list.innerHTML = _calUrls.map(function(cal, i) {
            return '<div class="cal-url-item">'
                + '<span class="cal-url-label">' + (cal.label || 'Calendar') + '</span>'
                + '<span class="cal-url-link">' + cal.url.slice(0, 40) + '…</span>'
                + '<button onclick="removeCalendarUrl(' + cal.id + ')" class="text-[var(--text-muted)] hover:text-red-400 text-xs" title="Remove"><i class="fa-solid fa-times"></i></button>'
                + '</div>';
        }).join('');
    }

    function addCalendarUrl() {
        var labelEl = document.getElementById('cal-label-input');
        var urlEl   = document.getElementById('cal-url-input');
        var label = labelEl ? labelEl.value.trim() : '';
        var url   = urlEl   ? urlEl.value.trim()   : '';
        if (!url) { sosToast('Please enter a URL'); return; }
        _calUrls = DB.get('os_cal_urls', []);
        _calUrls.push({ id: Date.now(), label: label || 'Calendar ' + (_calUrls.length + 1), url: url });
        DB.set('os_cal_urls', _calUrls);
        if (labelEl) labelEl.value = '';
        if (urlEl) urlEl.value = '';
        renderCalendarUrls();
        _applyCalendarFrames();
        sosToast('Calendar added!');
    }

    function removeCalendarUrl(id) {
        _calUrls = DB.get('os_cal_urls', []).filter(function(c) { return c.id !== id; });
        DB.set('os_cal_urls', _calUrls);
        renderCalendarUrls();
        _applyCalendarFrames();
    }

    function _applyCalendarFrames() {
        _calUrls = DB.get('os_cal_urls', []);
        var container = document.getElementById('calendar-iframe-container');
        var frame = document.getElementById('cal-frame');
        var tabsEl = document.getElementById('cal-url-tabs');
        if (!container || !frame) return;

        if (_calUrls.length === 0) {
            container.classList.add('hidden');
            if (tabsEl) tabsEl.innerHTML = '';
            return;
        }
        container.classList.remove('hidden');
        if (_activeCalIdx >= _calUrls.length) _activeCalIdx = 0;
        frame.src = _calUrls[_activeCalIdx].url;

        // Render tabs if multiple calendars
        if (tabsEl) {
            if (_calUrls.length > 1) {
                tabsEl.innerHTML = _calUrls.map(function(c, i) {
                    return '<button class="cal-url-tab' + (i === _activeCalIdx ? ' active' : '') + '" onclick="_switchCalTab(' + i + ')">' + c.label + '</button>';
                }).join('');
            } else {
                tabsEl.innerHTML = '';
            }
        }
    }

    window._switchCalTab = function(idx) {
        _activeCalIdx = idx;
        _applyCalendarFrames();
    };

    // Override the old saveCalendarImport (kept for backwards compat HTML references)
    window.saveCalendarImport = function() {
        addCalendarUrl();
    };

    // Override clearCalendar
    var _origClearCal = window.clearCalendar;
    window.clearCalendar = function() {
        _calUrls = [];
        DB.set('os_cal_urls', []);
        DB.set('os_cal_url', '');
        var container = document.getElementById('calendar-iframe-container');
        if (container) container.classList.add('hidden');
        sosToast('All calendars removed');
    };

    // Override openCalNewTab
    window.openCalNewTab = function() {
        _calUrls = DB.get('os_cal_urls', []);
        if (_calUrls.length > 0 && _calUrls[_activeCalIdx]) {
            window.open(_calUrls[_activeCalIdx].url, '_blank');
        }
    };

    // Run on load
    _applyCalendarFrames();

    // Expose functions
    window.addCalendarUrl    = addCalendarUrl;
    window.removeCalendarUrl = removeCalendarUrl;
    window.renderCalendarUrls = renderCalendarUrls;

    // Patch openModal to render cal URL list when modal opens
    var _origOM = window.openModal;
    window.openModal = function(id) {
        _origOM(id);
        if (id === 'modal-import-cal') renderCalendarUrls();
    };
})();

// ===== POMODORO FOCUS MODE =====
var _pomoFocusMode = false;
function togglePomoFocusMode() {
    _pomoFocusMode = !_pomoFocusMode;
    document.body.classList.toggle('pomo-focus-mode', _pomoFocusMode);
    var btn = document.getElementById('pomo-focus-btn');
    if (btn) {
        btn.classList.toggle('active', _pomoFocusMode);
        btn.innerHTML = _pomoFocusMode
            ? '<i class="fa-solid fa-compress"></i> Exit Focus'
            : '<i class="fa-solid fa-expand"></i> Focus Mode';
    }
}
window.togglePomoFocusMode = togglePomoFocusMode;

function togglePomoSettings() {
    var panel = document.getElementById('pomo-settings-panel');
    var chevron = document.getElementById('pomo-settings-chevron');
    if (!panel) return;
    panel.classList.toggle('open');
    if (chevron) chevron.style.transform = panel.classList.contains('open') ? 'rotate(180deg)' : '';
}
window.togglePomoSettings = togglePomoSettings;

// ===== MOBILE NAV =====
var _mobTabs = ['dashboard','tasks','notes','cards','calendar','whiteboard','grades','calc','focus'];

function setMobActive(tab) {
    _mobTabs.forEach(function(t) {
        var btn = document.getElementById('mob-btn-' + t);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    // Also show "more" as active if tab is in drawer
    var drawerTabs = ['calendar','whiteboard','grades','calc','focus'];
    var moreBtn = document.getElementById('mob-btn-more');
    if (moreBtn) moreBtn.classList.toggle('active', drawerTabs.includes(tab));
}

function toggleMobMenu() {
    var drawer = document.getElementById('mob-more-drawer');
    var backdrop = document.getElementById('mob-drawer-backdrop');
    if (!drawer) return;
    var isOpen = drawer.classList.contains('open');
    if (isOpen) {
        drawer.classList.remove('open');
        if (backdrop) backdrop.style.display = 'none';
    } else {
        drawer.classList.add('open');
        if (backdrop) backdrop.style.display = 'block';
    }
}

function closeMobMenu() {
    var drawer = document.getElementById('mob-more-drawer');
    var backdrop = document.getElementById('mob-drawer-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.style.display = 'none';
}
window.setMobActive = setMobActive;
window.toggleMobMenu = toggleMobMenu;
window.closeMobMenu = closeMobMenu;

// Patch switchTab to also update mobile nav
(function() {
    var _origSwitchTab = window.switchTab;
    window.switchTab = function(name) {
        if (_origSwitchTab) _origSwitchTab(name);
        setMobActive(name);
        closeMobMenu();
    };
})();

// ===== QoL: Ctrl+S saves current note =====
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        var notesView = document.getElementById('view-notes');
        if (notesView && !notesView.classList.contains('hidden')) {
            e.preventDefault();
            saveNote();
            sosToast('Note saved');
        }
    }
});

// ===== QoL: Keyboard shortcut hints =====
// Alt+F → Focus
document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key === 'f') { switchTab('focus'); }
    if (e.altKey && e.key === 'w') { switchTab('whiteboard'); }
    if (e.altKey && e.key === 'c') { switchTab('cards'); }
    if (e.altKey && e.key === 'g') { switchTab('grades'); }
});

// ===== QoL: Auto-save notes every 30 seconds =====
setInterval(function() {
    var notesView = document.getElementById('view-notes');
    if (notesView && !notesView.classList.contains('hidden') && activeNote) {
        var n = notes.find(function(x) { return x.id === activeNote; });
        if (n) saveNote();
    }
}, 30000);

// ===== QoL: Note character/word count live =====
(function() {
    var editor = document.getElementById('note-editor');
    if (!editor) return;
    var origInput = editor.oninput;
    editor.addEventListener('input', function() {
        var tx = editor.innerText;
        var w = tx.trim() ? tx.trim().split(/\s+/).length : 0;
        var statsEl = document.getElementById('note-stats');
        if (statsEl) statsEl.innerText = w + ' words · ' + tx.length + ' chars';
    });
})();

// ===== QoL: Pomodoro timer - fix icon-play for FA =====
(function() {
    // Override toggleTimer to use FA icons
    var _origToggleTimer = window.toggleTimer;
    window.toggleTimer = function() {
        if (_origToggleTimer) _origToggleTimer();
        var ico = document.getElementById('icon-play');
        if (ico) {
            ico.className = tRun ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        }
    };
    var _origResetTimer = window.resetTimer;
    window.resetTimer = function() {
        if (_origResetTimer) _origResetTimer();
        var ico = document.getElementById('icon-play');
        if (ico) ico.className = 'fa-solid fa-play';
    };
})();

// ===== QoL: Pomodoro - show sessions today on load =====
(function() {
    var el = document.getElementById('pomo-sessions-today');
    if (el) {
        var pst = DB.get('os_pomo_today', { date: '', count: 0 });
        var today = new Date().toDateString();
        el.innerText = (pst.date === today) ? pst.count : 0;
    }
})();

// ===== QoL: Whiteboard fullscreen - fix FA icon =====
(function() {
    var _origWbFs = window.wbToggleFullscreen;
    window.wbToggleFullscreen = function() {
        if (_origWbFs) _origWbFs();
        var icon = document.getElementById('wb-fs-icon');
        if (icon) icon.className = wbFull ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    };
})();

// ===== QoL: Set initial WB bg button state after wbInit =====
(function() {
    var _origWbInit = window.wbInit;
    window.wbInit = function() {
        if (_origWbInit) _origWbInit();
        var bg = wbGetBg ? wbGetBg() : '#09090b';
        if (window._updateWbBgButtons) _updateWbBgButtons(bg);
    };
})();

if ('serviceWorker' in navigator) {
    fetch('./sw.js', { method: 'HEAD' })
        .then(function(r) { if (r.ok) navigator.serviceWorker.register('./sw.js'); })
        .catch(function() {});
}

window.openEditSubject = function(id) {
    const subs = DB.get('os_subjects', []);
    const sub = subs.find(s => s.id === id);
    if (!sub) return;
    const name = prompt('Edit subject name:', sub.name);
    if (!name || !name.trim()) return;
    sub.name = name.trim();
    DB.set('os_subjects', subs);
    renderGrades();
};

window._dropNoteOnGroup = function(e, groupId) {
    e.preventDefault();
    const noteId = parseInt(e.dataTransfer.getData('noteId'));
    if (!noteId) return;
    let notes = DB.get('os_notes', []);
    const note = notes.find(n => n.id === noteId);
    if (note) { note.groupId = groupId; DB.set('os_notes', notes); renderNotes(); }
};

// Drain calls that were queued by stubs before modules loaded
(function(){
  var q = window._sos_queue || {};
  Object.keys(q).forEach(function(n){
    if(typeof window[n] === 'function' && Array.isArray(q[n])){
      q[n].forEach(function(args){ 
        try { window[n].apply(null, args); } catch(e) {} 
      });
    }
  });
  window._sos_queue = {};
})();
