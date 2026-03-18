/* ================================================================
   StudentOS — patches8.js   v2
   ---------------------------------------------------------------
   Five surgical fixes (improved in v2):

   1. Formula preview  — clears KaTeX div on open so preview never
      shows before you type; live render 260ms after each keystroke
   2. Forum nested reply visual — hard indent right with blue
      left-border thread line + "Replying to NAME" quote header
   3. Sticker categories — mousedown+stopPropagation so switching
      category no longer accidentally closes the picker
   4. localStorage offline mode — saves on EVERY DB.set call AND
      every 2 seconds via interval; restores on next offline session
   5. Banned words — loads list from Firestore, shows a big shaking
      red error box AND a toast when a word is blocked

   Add after patches7.js:
   <script type="module" src="patches8.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    getFirestore, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _auth, _db, _uid = null;
(function _boot() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_boot, 150); return; }
    _auth = getAuth(apps[0]);
    _db   = getFirestore(apps[0]);
    onAuthStateChanged(_auth, u => { _uid = u ? u.uid : null; });
})();

/* helpers */
function _css(txt) {
    const s = document.createElement('style');
    s.textContent = txt;
    document.head.appendChild(s);
}
function _toast(msg, err) {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = err ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 3400);
}
function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}
function _lsGet(k, def) {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; }
    catch (e) { return def; }
}
function _lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}

/* ================================================================
   CSS  (all fixes in one block)
   ================================================================ */
_css([
/* Formula: keep preview below the input */
'#formula-modal-preview, #katex-preview {',
'    order: 99 !important;',
'    margin-top: 12px !important;',
'    margin-bottom: 0 !important;',
'}',

/* Nested reply: strong visual indent */
'#ft-replies-list .ft-reply.p8-is-nested {',
'    margin-left: 32px !important;',
'    padding-left: 14px !important;',
'    border-left: 3px solid var(--accent) !important;',
'    border-radius: 0 12px 12px 0 !important;',
'    margin-top: 4px !important;',
'    background: rgba(59,130,246,.03) !important;',
'    position: relative;',
'}',

'#ft-replies-list .ft-reply.p8-is-nested::before {',
'    content: "";',
'    position: absolute;',
'    left: -3px; top: 0; bottom: 0; width: 3px;',
'    background: linear-gradient(to bottom, var(--accent) 0%, rgba(59,130,246,.2) 100%);',
'    border-radius: 3px;',
'}',

'.p8-quote-bar {',
'    display: flex;',
'    align-items: center;',
'    gap: 6px;',
'    font-size: .63rem;',
'    font-weight: 700;',
'    color: var(--accent);',
'    margin-bottom: 8px;',
'    padding: 4px 10px;',
'    background: rgba(59,130,246,.09);',
'    border-radius: 6px;',
'    width: fit-content;',
'}',
'.p8-quote-bar i { font-size: .58rem; opacity: .8; }',
'.p8-quote-bar strong { font-weight: 800; }',

/* Banned word error box */
'#forum-new-error.p8-err {',
'    display: block !important;',
'    background: rgba(239,68,68,.13) !important;',
'    border: 1px solid rgba(239,68,68,.4) !important;',
'    border-radius: 10px !important;',
'    color: #fca5a5 !important;',
'    font-size: .8rem !important;',
'    font-weight: 600 !important;',
'    padding: 10px 14px !important;',
'    margin-bottom: 12px !important;',
'    line-height: 1.45 !important;',
'    animation: p8shake .3s ease !important;',
'}',
'@keyframes p8shake {',
'    0%,100% { transform: translateX(0); }',
'    20%      { transform: translateX(-8px); }',
'    60%      { transform: translateX(8px); }',
'    80%      { transform: translateX(-4px); }',
'}',

/* Offline badge */
'#p8-offline-badge {',
'    position: fixed;',
'    top: 12px; left: 50%; transform: translateX(-50%);',
'    z-index: 9000;',
'    background: rgba(245,158,11,.16);',
'    border: 1px solid rgba(245,158,11,.38);',
'    border-radius: 20px;',
'    padding: 5px 16px;',
'    font-size: .7rem; font-weight: 700; color: #fbbf24;',
'    display: flex; align-items: center; gap: 7px;',
'    pointer-events: none;',
'    backdrop-filter: blur(10px);',
'    white-space: nowrap;',
'}',
].join('\n'));

/* ================================================================
   FIX 1 — FORMULA PREVIEW
   Root cause: patches5 moves #katex-preview above the textarea and
   it re-renders the previous formula on every open.
   ================================================================ */
(function fixFormulaPreview() {

    var PLACEHOLDER =
        '<div style="font-size:.72rem;color:var(--text-muted);' +
        'font-style:italic;padding:6px 2px;text-align:center;">' +
        'Start typing a formula to see preview...</div>';

    function _getEl() {
        return document.getElementById('formula-modal-preview') ||
               document.getElementById('katex-preview');
    }

    function _wipe() {
        var el = _getEl();
        if (!el) return;
        el.innerHTML = PLACEHOLDER;
        el.style.opacity = '0.5';
        el.querySelectorAll('.katex, .katex-display, .katex-html').forEach(function(n) { n.remove(); });
    }

    function _attachInput() {
        var inp = document.getElementById('formula-modal-formula');
        if (!inp || inp.dataset.p8live) return;
        inp.dataset.p8live = '1';

        var _t;
        inp.addEventListener('input', function () {
            clearTimeout(_t);
            var val = this.value.trim();
            var el  = _getEl();
            if (!el) return;

            if (!val) { _wipe(); return; }

            el.style.opacity = '1';
            _t = setTimeout(function() {
                if (window.katex) {
                    try {
                        el.innerHTML = window.katex.renderToString(val, {
                            throwOnError: false,
                            displayMode: true,
                        });
                    } catch (e) { el.textContent = val; }
                } else if (window.renderMathInElement) {
                    el.textContent = val;
                    try {
                        window.renderMathInElement(el, {
                            delimiters: [
                                { left: '$$', right: '$$', display: true },
                                { left: '$',  right: '$',  display: false },
                            ],
                            throwOnError: false,
                        });
                    } catch (e) { el.textContent = val; }
                } else {
                    el.textContent = val;
                }
            }, 260);
        });
    }

    function _patchFOM() {
        var orig = window.formulaOpenModal;
        if (!orig || orig._p8) { setTimeout(_patchFOM, 200); return; }
        window.formulaOpenModal = function(editId) {
            orig.apply(this, arguments);
            if (!editId) {
                _wipe();
                setTimeout(_wipe,  50);
                setTimeout(_wipe, 180);
                setTimeout(_wipe, 500);
            }
            setTimeout(_attachInput, 80);
        };
        window.formulaOpenModal._p8 = true;
    }

    function _patchOM() {
        var orig = window.openModal;
        if (!orig || orig._p8form) { setTimeout(_patchOM, 200); return; }
        window.openModal = function(id) {
            orig.apply(this, arguments);
            if (id !== 'modal-formula') return;
            var inp = document.getElementById('formula-modal-formula');
            if (!inp || !inp.value.trim()) {
                _wipe(); setTimeout(_wipe, 80); setTimeout(_wipe, 280);
            }
            setTimeout(_attachInput, 100);
        };
        window.openModal._p8form = true;
    }

    setTimeout(_patchFOM, 300);
    setTimeout(_patchOM,  400);
})();

/* ================================================================
   FIX 2 — NESTED REPLY VISUAL
   ================================================================ */
(function fixNestedReplyVisual() {

    var _postId = null;
    var _cache  = {};

    function _patchOpen() {
        var orig = window.forumOpenPost;
        if (!orig || orig._p8vis) { setTimeout(_patchOpen, 200); return; }
        window.forumOpenPost = async function(postId) {
            _postId = postId;
            await orig.apply(this, arguments);
            setTimeout(function() { _enhance(postId); }, 150);
            setTimeout(function() { _enhance(postId); }, 600);
        };
        window.forumOpenPost._p8vis = true;
    }
    setTimeout(_patchOpen, 400);

    function _patchClose() {
        var orig = window.forumCloseThread;
        if (!orig || orig._p8vis) { setTimeout(_patchClose, 200); return; }
        window.forumCloseThread = function() {
            _postId = null;
            orig.apply(this, arguments);
        };
        window.forumCloseThread._p8vis = true;
    }
    setTimeout(_patchClose, 400);

    var _obs = null;
    function _watchList() {
        var list = document.getElementById('ft-replies-list');
        if (!list) { setTimeout(_watchList, 400); return; }
        if (_obs) _obs.disconnect();
        _obs = new MutationObserver(function() { if (_postId) _enhance(_postId); });
        _obs.observe(list, { childList: true });
        _enhance(_postId);
    }
    setTimeout(_watchList, 900);

    async function _enhance(postId) {
        if (!postId || !_db) return;
        var list = document.getElementById('ft-replies-list');
        if (!list || !list.children.length) return;

        if (!_cache[postId]) {
            try {
                var fsModule = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
                var snap = await fsModule.getDocs(
                    fsModule.query(
                        fsModule.collection(_db, 'forum_posts', postId, 'replies'),
                        fsModule.orderBy('createdAt', 'asc')
                    )
                );
                var map = {};
                snap.docs.forEach(function(d) {
                    map[d.id] = {
                        parentReplyId: d.data().parentReplyId || null,
                        displayName:   d.data().displayName   || 'User',
                    };
                });
                _cache[postId] = map;
            } catch (e) { return; }
        }

        var map = _cache[postId];

        list.querySelectorAll('.ft-reply').forEach(function(row) {
            if (row.dataset.p8vis) return;
            row.dataset.p8vis = '1';

            var delBtn = row.querySelector('[onclick*="forumDeleteReply"]');
            if (!delBtn) return;
            var m = (delBtn.getAttribute('onclick') || '')
                      .match(/forumDeleteReply\('[^']+',\s*'([^']+)'\)/);
            if (!m) return;
            var replyId = m[1];

            var info = map[replyId];
            if (!info || !info.parentReplyId) return;

            var parentName = (map[info.parentReplyId] || {}).displayName || 'someone';

            row.classList.add('p8-is-nested');

            if (!row.querySelector('.p8-quote-bar')) {
                var bar = document.createElement('div');
                bar.className = 'p8-quote-bar';
                bar.innerHTML =
                    '<i class="fa-solid fa-reply fa-flip-horizontal"></i>' +
                    ' Replying to <strong>' + _esc(parentName) + '</strong>';
                var anchor = row.querySelector('.ft-reply-header') ||
                             row.querySelector('.ft-reply-body');
                if (anchor) row.insertBefore(bar, anchor);
                else row.prepend(bar);
            }
        });
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest && e.target.closest('.ft-back')) { _cache = {}; }
    });
})();

/* ================================================================
   FIX 3 — STICKER PANEL CATEGORY SWITCH
   ================================================================ */
(function fixStickerPanel() {

    var CATS = {
        'Study':   ['star','fire','bulb','pin','target','rocket','books','check','brain','muscle','pencil','search'],
        '_emoji_Study':   ['\u2B50','\uD83D\uDD25','\uD83D\uDCA1','\uD83D\uDCCC','\uD83C\uDFAF','\uD83D\uDE80','\uD83D\uDCDA','\u2705','\uD83E\uDDE0','\uD83D\uDCAA','\uD83D\uDCDD','\uD83D\uDD0D'],
        'Faces':   ['\uD83D\uDE0A','\uD83D\uDE0E','\uD83E\uDD14','\uD83E\uDD73','\uD83D\uDE02','\uD83D\uDE4C','\uD83D\uDC4D','\u2764\uFE0F','\uD83D\uDCAF','\uD83E\uDD29','\uD83D\uDE05','\uD83E\uDEB6'],
        'Nature':  ['\uD83C\uDF38','\uD83C\uDF3B','\uD83C\uDF3F','\uD83C\uDF40','\u2600\uFE0F','\uD83C\uDF19','\u26A1','\uD83C\uDF0A','\uD83C\uDF08','\u2744\uFE0F','\uD83C\uDF3A','\uD83E\uDD8B'],
        'Things':  ['\u23F0','\uD83D\uDD14','\uD83D\uDCCA','\uD83C\uDFC6','\uD83C\uDFB5','\uD83C\uDFA8','\uD83D\uDCF1','\uD83D\uDCBB','\uD83C\uDFAF','\uD83D\uDCC5','\uD83D\uDCAC','\uD83C\uDF89'],
    };

    var STICKERS = {
        'Study':  CATS['_emoji_Study'],
        'Faces':  CATS['Faces'],
        'Nature': CATS['Nature'],
        'Things': CATS['Things'],
    };

    window.toggleStickerPanel = function(triggerEl) {
        var ids = ['p8-sticker-panel','p7-sticker-panel','p6-sticker-panel'];
        var hadOpen = ids.some(function(id) { return !!document.getElementById(id); });
        ids.forEach(function(id) { document.getElementById(id) && document.getElementById(id).remove(); });
        if (hadOpen) return;

        var activeCat = 'Study';

        var panel = document.createElement('div');
        panel.id = 'p8-sticker-panel';
        panel.style.cssText =
            'position:fixed;z-index:9999;' +
            'background:var(--bg-color);' +
            'border:1px solid rgba(255,255,255,.13);' +
            'border-radius:18px;padding:12px;' +
            'box-shadow:0 12px 40px rgba(0,0,0,.5);' +
            'width:264px;';

        function _draw() {
            var cats = Object.keys(STICKERS);
            var tabsHTML = cats.map(function(c) {
                var isActive = c === activeCat;
                return '<button style="font-size:.58rem;font-weight:800;' +
                    'padding:3px 9px;border-radius:6px;' +
                    'background:' + (isActive ? 'var(--accent)' : 'rgba(255,255,255,.06)') + ';' +
                    'color:'      + (isActive ? '#fff'          : 'var(--text-muted)') + ';' +
                    'border:none;cursor:pointer;letter-spacing:.03em;text-transform:uppercase;"' +
                    ' onmousedown="event.stopPropagation();event.preventDefault();' +
                    'window._p8Cat(\'' + c + '\')">' + c + '</button>';
            }).join('');

            var sticks = STICKERS[activeCat] || [];
            var gridHTML = sticks.map(function(s) {
                var safe = s.replace(/'/g, "\\'");
                return '<button style="font-size:1.2rem;background:none;border:none;' +
                    'cursor:pointer;border-radius:7px;padding:3px 0;line-height:1.3;"' +
                    ' onmouseenter="this.style.background=\'var(--glass-hover)\'"' +
                    ' onmouseleave="this.style.background=\'none\'"' +
                    ' onmousedown="event.stopPropagation();event.preventDefault();' +
                    'window.insertSticker(\'' + safe + '\')">' + s + '</button>';
            }).join('');

            panel.innerHTML =
                '<div style="display:flex;gap:4px;margin-bottom:9px;flex-wrap:wrap;">' +
                tabsHTML + '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;">' +
                gridHTML + '</div>';
        }

        window._p8Cat = function(cat) { activeCat = cat; _draw(); };
        _draw();

        var ref = (triggerEl instanceof Element)
            ? triggerEl
            : document.querySelector('[onclick*="toggleStickerPanel"]') ||
              document.getElementById('note-toolbar');
        if (ref) {
            var r = ref.getBoundingClientRect();
            panel.style.top  = Math.min(r.bottom + 6, window.innerHeight - 220) + 'px';
            panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 276)) + 'px';
        } else {
            panel.style.top  = '120px';
            panel.style.left = '20px';
        }

        document.body.appendChild(panel);

        setTimeout(function() {
            function _close(e) {
                var el = e.target;
                while (el) {
                    if (el.id === 'p8-sticker-panel') return;
                    el = el.parentElement;
                }
                document.getElementById('p8-sticker-panel') && document.getElementById('p8-sticker-panel').remove();
                document.removeEventListener('mousedown', _close);
                delete window._p8Cat;
            }
            document.addEventListener('mousedown', _close);
        }, 10);
    };

    window.insertSticker = function(emoji) {
        ['p8-sticker-panel','p7-sticker-panel','p6-sticker-panel'].forEach(function(id) {
            document.getElementById(id) && document.getElementById(id).remove();
        });
        var editor = document.getElementById('note-editor');
        if (!editor) return;
        editor.focus();
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0 &&
            editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            document.execCommand('insertText', false, emoji + '\u00A0');
        } else {
            editor.innerHTML += emoji + '\u00A0';
        }
        setTimeout(function() { if (window.saveNote) window.saveNote(); }, 60);
    };

    setInterval(function() {
        document.getElementById('p6-sticker-panel') && document.getElementById('p6-sticker-panel').remove();
        document.getElementById('p7-sticker-panel') && document.getElementById('p7-sticker-panel').remove();
    }, 1500);
})();

/* ================================================================
   FIX 4 — OFFLINE LOCALSTORAGE PERSISTENCE
   ================================================================ */
(function fixOfflinePersistence() {

    var _offline = false;

    var LS_KEYS = [
        'os_tasks','os_notes','os_decks','os_goals','os_events',
        'os_subjects','os_links','os_streak','os_card_stats',
        'os_deck_groups','os_note_groups','os_quick_note',
        'os_pomo_times','os_pomo_today','os_widgets',
        'os_theme','os_accent','os_font_scale','os_name',
        'os_formulas','os_exams','os_music_custom','os_clock_color',
    ];

    /* Wrap DB.set so every write also goes to localStorage */
    function _wrapDB() {
        if (!window.DB || typeof window.DB.set !== 'function' || window.DB._p8wrapped) {
            setTimeout(_wrapDB, 250);
            return;
        }
        window.DB._p8wrapped = true;
        var origSet = window.DB.set.bind(window.DB);
        window.DB.set = function(key, val) {
            origSet(key, val);
            _lsSet(key, val);   /* always mirror — works for both online and offline */
        };
        console.log('[p8] DB.set patched for localStorage mirroring');
    }
    _wrapDB();

    /* 2-second interval full snapshot */
    setInterval(function() {
        if (!window.DB || typeof window.DB.get !== 'function') return;
        LS_KEYS.forEach(function(k) {
            var v = window.DB.get(k, null);
            if (v !== null) _lsSet(k, v);
        });
    }, 2000);

    /* Intercept offline button */
    function _watchBtn() {
        var overlay = document.getElementById('login-overlay');
        if (!overlay) { setTimeout(_watchBtn, 300); return; }
        var btns = Array.from(overlay.querySelectorAll('button'));
        var btn = btns.find(function(b) { return /offline/i.test(b.textContent); });
        if (!btn || btn.dataset.p8off) { setTimeout(_watchBtn, 400); return; }
        btn.dataset.p8off = '1';

        btn.addEventListener('click', function() {
            _offline = true;
            window._p8_offline = true;
            window._p6_offlineMode = true;

            setTimeout(function() {
                if (window.DB && typeof window.DB._hydrate === 'function') {
                    var data = {};
                    LS_KEYS.forEach(function(k) {
                        var v = _lsGet(k, null);
                        if (v !== null) data[k] = v;
                    });
                    if (Object.keys(data).length > 0) {
                        window.DB._hydrate(data);
                        console.log('[p8] Offline restored', Object.keys(data).length, 'keys from localStorage');
                    }
                }
                _showBadge();
            }, 200);
        }, { once: true });
    }
    _watchBtn();

    function _patchInitApp() {
        var orig = window.initApp;
        if (!orig || orig._p8off) { setTimeout(_patchInitApp, 200); return; }
        window.initApp = function() {
            orig.apply(this, arguments);
            setTimeout(function() {
                if (!_uid) { _offline = true; window._p8_offline = true; _wrapDB(); }
            }, 1500);
        };
        window.initApp._p8off = true;
    }
    _patchInitApp();



    /* Developer tip */
    setTimeout(function() {
        if (!window.DB) {
            console.info('[StudentOS] For best offline support, add this to script.js after the DB definition:\n   window.DB = DB;');
        }
    }, 3000);
})();

/* ================================================================
   FIX 5 — BANNED WORDS: load from Firestore, unmissable error
   ================================================================ */
(function fixBannedWords() {

    var _banned = [];
    var _loaded = false;

    async function _loadBanned() {
        if (!_db || _loaded) return;
        try {
            var snap = await getDoc(doc(_db, 'config', 'moderation'));
            if (snap.exists()) {
                _banned = (snap.data().bannedWords || [])
                    .map(function(w) { return w.toLowerCase().trim(); })
                    .filter(Boolean);
                _lsSet('_p8_banned', _banned);
                _loaded = true;
                console.log('[p8] Banned words loaded:', _banned.length);
            }
        } catch (e) {
            _banned = _lsGet('_p8_banned', []);
        }
    }

    var origAdd = window.p6AddBannedWord;
    if (origAdd) {
        window.p6AddBannedWord = async function() {
            await origAdd.apply(this, arguments);
            _loaded = false;
            setTimeout(_loadBanned, 300);
        };
    }

    function _hit(text) {
        var lower = (text || '').toLowerCase();
        return _banned.find(function(w) { return w && lower.includes(w); }) || null;
    }

    function _showPostError(word) {
        var errEl = document.getElementById('forum-new-error');
        if (errEl) {
            errEl.textContent =
                '\uD83D\uDEAB One or multiple words of this post are banned, please try again.' +
                ' (Word: "' + _esc(word) + '")';
            errEl.className = 'p8-err';
            errEl.style.cssText =
                'display:block!important;' +
                'background:rgba(239,68,68,.13)!important;' +
                'border:1px solid rgba(239,68,68,.4)!important;' +
                'border-radius:10px!important;' +
                'color:#fca5a5!important;' +
                'font-size:.8rem!important;' +
                'font-weight:600!important;' +
                'padding:10px 14px!important;' +
                'margin-bottom:12px!important;' +
                'animation:p8shake .3s ease!important;';
            clearTimeout(errEl._p8t);
            errEl._p8t = setTimeout(function() {
                errEl.className = '';
                errEl.style.cssText = '';
                errEl.textContent = '';
            }, 9000);
        }
        _toast('\uD83D\uDEAB Post blocked \u2014 "' + _esc(word) + '" is a banned word.', true);
    }

    function _patchPost() {
        var fn = window.forumSubmitPost;
        if (!fn || fn._p8bw) { setTimeout(_patchPost, 300); return; }
        window.forumSubmitPost = async function() {
            var title = (document.getElementById('forum-new-title') || {}).value || '';
            var body  = (document.getElementById('forum-new-body')  || {}).value || '';
            var word  = _hit(title + ' ' + body);
            if (word) { _showPostError(word); return; }
            await fn.apply(this, arguments);
        };
        window.forumSubmitPost._p8bw = true;
    }

    function _patchReply() {
        var fn = window.forumSubmitReply;
        if (!fn || fn._p8bw) { setTimeout(_patchReply, 400); return; }
        window.forumSubmitReply = async function() {
            var body = (document.getElementById('forum-reply-input') || {}).value || '';
            var word = _hit(body);
            if (word) {
                var errEl = document.getElementById('forum-reply-error');
                if (errEl) {
                    errEl.textContent = '\uD83D\uDEAB One or multiple words of this reply are banned ("' + _esc(word) + '").';
                    errEl.style.color = '#fca5a5';
                    errEl.style.fontWeight = '600';
                    setTimeout(function() {
                        errEl.textContent = '';
                        errEl.style.color = '';
                        errEl.style.fontWeight = '';
                    }, 7000);
                }
                _toast('\uD83D\uDEAB Reply blocked \u2014 "' + _esc(word) + '" is a banned word.', true);
                return;
            }
            await fn.apply(this, arguments);
        };
        window.forumSubmitReply._p8bw = true;
    }

    function _patchForumInit() {
        var orig = window.forumInit;
        if (!orig || orig._p8bw) { setTimeout(_patchForumInit, 300); return; }
        window.forumInit = function() {
            orig.apply(this, arguments);
            _loadBanned();
        };
        window.forumInit._p8bw = true;
    }

    setTimeout(_loadBanned,      600);
    setTimeout(_loadBanned,     2500);
    setTimeout(_patchPost,       700);
    setTimeout(_patchPost,      1800);
    setTimeout(_patchReply,      800);
    setTimeout(_patchReply,     1900);
    setTimeout(_patchForumInit,  900);
})();

console.log('[StudentOS patches8 v2] Loaded \u2713');
