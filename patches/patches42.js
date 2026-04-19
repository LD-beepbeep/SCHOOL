/* ================================================================
   StudentOS -- patches42.js
   1.  SETTINGS — Grade System Configuration
       Adds a "Grades" section to the settings modal where users can
       pick their grading scale: /20 (Belgian), /10, Percentage, or
       Letter grades. The chosen scale is applied throughout the app
       (renderGrades, dashboard widgets, test display).

   2.  WORKSHEET — Unified Block Picker
       Merges the block-type lists from patches27 (table, callout,
       flashcard, calc, timer, formula) and patches28 (checklist,
       code) into a single picker section so all 8 block types
       always appear.

   3.  PROFILE — Collapsible Dropdown Sections
       Replaces the flat emoji/icon grids with collapsible dropdown
       sections (Emoji ▾ / Icons ▾). Fixes margins between them.
       Also ensures FA icons render when clicking the sidebar pfp.

   4.  MINDMAP — ResizeObserver for SVG Container
       Adds a ResizeObserver so the mindmap SVG resizes correctly
       when the viewport or container changes.

   5.  QoL — Minor improvements
   ================================================================ */

'use strict';

/* -- helpers --------------------------------------------------- */
var _p42dbG = function(k, d) {
    try { return window.DB && window.DB.get ? window.DB.get(k, d) : (JSON.parse(localStorage.getItem(k) || 'null') || d); }
    catch(e) { return d; }
};
var _p42dbS = function(k, v) {
    try { if (window.DB && window.DB.set) window.DB.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); }
    catch(e) {}
};

var _p42toast = function(msg) {
    var t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 3000);
};

function _p42waitFor(fn, maxAttempts, interval) {
    maxAttempts = maxAttempts || 60;
    interval = interval || 300;
    var n = 0;
    (function _try() {
        if (fn()) return;
        if (++n < maxAttempts) setTimeout(_try, interval);
    })();
}

/* Sanitize FA icon class — only safe chars */
function _p42safeIconClass(raw) {
    return (raw || '').replace(/[^a-zA-Z0-9\- ]/g, '');
}


/* ================================================================
   1.  SETTINGS — GRADE SYSTEM CONFIGURATION
   ================================================================ */
(function _p42_gradeSettings() {

    var GRADE_KEY = 'os_grade_system';

    /* Grade system definitions */
    var GRADE_SYSTEMS = [
        { id: 'twenty',  label: 'Out of 20',            desc: 'Belgian system (0–20)',     example: '14.5 / 20', scale: 20 },
        { id: 'ten',     label: 'Out of 10',            desc: 'Common 10-point scale',     example: '7.2 / 10',  scale: 10 },
        { id: 'pct',     label: 'Percentage',            desc: '0–100% scale',              example: '85%',       scale: 100 },
        { id: 'letter',  label: 'Letter Grades (A–F)',   desc: 'American letter system',    example: 'B+',        scale: 100 },
    ];

    window._p42getGradeSystem = function() {
        return _p42dbG(GRADE_KEY, 'twenty');
    };

    window._p42setGradeSystem = function(id) {
        _p42dbS(GRADE_KEY, id);
        /* Also sync the legacy p9 key */
        _p42dbS('p9_grade_scale', id);
        _p42renderGradeOptions();
        /* Re-render grades if available */
        if (typeof window.renderGrades === 'function') window.renderGrades();
        if (typeof window.updateDashWidgets === 'function') window.updateDashWidgets();
        _p42toast('Grade system updated');
    };

    function _p42renderGradeOptions() {
        var container = document.getElementById('p42-grade-options');
        if (!container) return;
        var current = window._p42getGradeSystem();

        container.innerHTML = '';
        GRADE_SYSTEMS.forEach(function(gs) {
            var opt = document.createElement('div');
            opt.className = 'p42-grade-system-option' + (gs.id === current ? ' active' : '');
            opt.innerHTML =
                '<input type="radio" name="p42-grade-sys" value="' + gs.id + '"' + (gs.id === current ? ' checked' : '') + '>'
                + '<div>'
                + '<div class="p42-gs-label">' + gs.label + '</div>'
                + '<div class="p42-gs-desc">' + gs.desc + '</div>'
                + '</div>'
                + '<span class="p42-gs-example">' + gs.example + '</span>';
            opt.addEventListener('click', function() {
                window._p42setGradeSystem(gs.id);
            });
            container.appendChild(opt);
        });
    }

    /* A. Inject grade settings section into the settings modal */
    _p42waitFor(function() {
        var settingsScroll = document.querySelector('#modal-settings .overflow-y-auto');
        if (!settingsScroll) return false;
        if (document.getElementById('p42-grade-section')) return true;

        /* Find the Notifications section to insert before it */
        var sections = settingsScroll.querySelectorAll('.settings-section');
        var notifSection = null;
        for (var i = 0; i < sections.length; i++) {
            var title = sections[i].querySelector('.text-xs.uppercase');
            if (title && title.textContent.trim() === 'Focus Timer') {
                notifSection = sections[i];
                break;
            }
        }

        var section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'p42-grade-section';

        var header = document.createElement('div');
        header.className = 'text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-3';
        header.textContent = 'Grades';
        section.appendChild(header);

        var desc = document.createElement('div');
        desc.className = 'text-xs text-[var(--text-muted)] mb-3';
        desc.style.opacity = '0.7';
        desc.textContent = 'Choose how grades are displayed throughout the app.';
        section.appendChild(desc);

        var optionsContainer = document.createElement('div');
        optionsContainer.id = 'p42-grade-options';
        optionsContainer.className = 'p42-grade-section';
        section.appendChild(optionsContainer);

        if (notifSection) {
            notifSection.parentElement.insertBefore(section, notifSection);
        } else {
            settingsScroll.appendChild(section);
        }

        _p42renderGradeOptions();
        return true;
    });

    /* B. Override grade display functions to respect the chosen system */
    _p42waitFor(function() {
        if (typeof window.renderGrades !== 'function') return false;
        if (window._p42gradePatched) return true;
        window._p42gradePatched = true;

        /* Grade formatting helpers based on system */
        window._p42formatGrade = function(score, max) {
            var sys = window._p42getGradeSystem();
            var raw = score / max;
            switch (sys) {
                case 'ten':
                    return (raw * 10).toFixed(2) + ' / 10';
                case 'pct':
                    return (raw * 100).toFixed(1) + '%';
                case 'letter':
                    return _p42toLetter(raw * 100);
                case 'twenty':
                default:
                    return (raw * 20).toFixed(2) + ' / 20';
            }
        };

        window._p42formatAvg = function(avg, sys) {
            sys = sys || window._p42getGradeSystem();
            if (avg === null || avg === undefined) return '--';
            /* avg is always stored as /20 internally */
            var pct = avg / 20 * 100;
            switch (sys) {
                case 'ten':
                    return (avg / 2).toFixed(2) + ' / 10';
                case 'pct':
                    return pct.toFixed(1) + '%';
                case 'letter':
                    return _p42toLetter(pct);
                case 'twenty':
                default:
                    return avg.toFixed(2) + ' / 20';
            }
        };

        window._p42getScaleLabel = function() {
            var sys = window._p42getGradeSystem();
            switch (sys) {
                case 'ten':    return '/ 10';
                case 'pct':    return '%';
                case 'letter': return 'Letter';
                case 'twenty':
                default:       return '/ 20';
            }
        };

        window._p42avgToDisplay = function(avg) {
            if (avg === null || avg === undefined) return '--';
            var sys = window._p42getGradeSystem();
            var pct = avg / 20 * 100;
            switch (sys) {
                case 'ten':    return (avg / 2).toFixed(2);
                case 'pct':    return pct.toFixed(1) + '%';
                case 'letter': return _p42toLetter(pct);
                case 'twenty':
                default:       return avg.toFixed(2);
            }
        };

        window._p42barPct = function(avg) {
            if (avg === null) return 0;
            return (avg / 20 * 100);
        };

        function _p42toLetter(pct) {
            if (pct >= 93) return 'A';
            if (pct >= 90) return 'A-';
            if (pct >= 87) return 'B+';
            if (pct >= 83) return 'B';
            if (pct >= 80) return 'B-';
            if (pct >= 77) return 'C+';
            if (pct >= 73) return 'C';
            if (pct >= 70) return 'C-';
            if (pct >= 67) return 'D+';
            if (pct >= 63) return 'D';
            if (pct >= 60) return 'D-';
            return 'F';
        }

        /* Override renderGrades to use the system */
        var _origRenderGrades = window.renderGrades;
        window.renderGrades = function() {
            _origRenderGrades.apply(this, arguments);

            var sys = window._p42getGradeSystem();

            /* Fix the global average display */
            var gaEl = document.getElementById('global-average');
            var gpEl = document.getElementById('global-practice-avg');
            var gscaleEl = document.querySelector('#view-grades .text-xs.text-\\[var\\(--text-muted\\)\\]');

            /* Recalculate from subjects data */
            var subjects = _p42dbG('os_subjects', []);
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

            if (gaEl && globalAvg !== null) {
                gaEl.innerText = window._p42avgToDisplay(globalAvg);
            }
            if (gpEl && practiceAvg !== null) {
                gpEl.innerText = window._p42avgToDisplay(practiceAvg);
            }

            /* Fix scale label under the big number */
            var scaleLabel = document.querySelector('#view-grades #global-average');
            if (scaleLabel) {
                var scaleSibling = scaleLabel.parentElement.querySelector('.text-xs.text-\\[var\\(--text-muted\\)\\]');
                /* Look for "/ 20" label in the sidebar stat */
                var statDiv = document.querySelector('#view-grades .col-span-2');
                if (statDiv) {
                    var scaleEls = statDiv.querySelectorAll('.text-xs');
                    scaleEls.forEach(function(el) {
                        if (el.textContent.trim() === '/ 20') {
                            el.textContent = window._p42getScaleLabel();
                        }
                    });
                }
            }

            /* Fix individual subject cards */
            var container = document.getElementById('subjects-container');
            if (!container) return;
            var cards = container.children;
            for (var ci = 0; ci < cards.length && ci < subjects.length; ci++) {
                var sub = subjects[ci];
                var card = cards[ci];
                if (!card) continue;

                var avg = window.calcSubjectAvg ? window.calcSubjectAvg(sub.tests || [], false) : null;
                var pAvg = window.calcSubjectAvg ? window.calcSubjectAvg(sub.tests || [], true) : null;

                /* Fix the big average number */
                var avgNum = card.querySelector('.text-3xl');
                if (avgNum && avg !== null) {
                    avgNum.textContent = window._p42avgToDisplay(avg);
                }

                /* Fix the "/ 20" scale label under the average number */
                var scaleDivs = card.querySelectorAll('.text-xs');
                for (var si = 0; si < scaleDivs.length; si++) {
                    var txt = scaleDivs[si].textContent.trim();
                    if (txt === '/ 20' || txt === '/ 10' || txt === '%' || txt === 'Letter') {
                        scaleDivs[si].textContent = window._p42getScaleLabel();
                        break;
                    }
                }

                /* Fix individual test scores */
                var testRows = card.querySelectorAll('.border-b');
                var tests = (sub.tests || []);
                for (var ti = 0; ti < testRows.length && ti < tests.length; ti++) {
                    var boldSpan = testRows[ti].querySelector('.font-bold');
                    if (boldSpan) {
                        boldSpan.textContent = window._p42formatGrade(tests[ti].score, tests[ti].max);
                    }
                }

                /* Fix practice avg row */
                var practiceRow = card.querySelector('.practice-avg-row');
                if (practiceRow && pAvg !== null) {
                    var prSpan = practiceRow.querySelector('.font-bold');
                    if (prSpan) {
                        prSpan.textContent = window._p42formatAvg(pAvg);
                    }
                }
            }
        };

        /* Also patch dashboard widget grade display */
        _p42waitFor(function() {
            if (typeof window.updateDashWidgets !== 'function') return false;
            if (window._p42dashPatched) return true;
            window._p42dashPatched = true;

            var _origDashUpdate = window.updateDashWidgets;
            window.updateDashWidgets = function() {
                _origDashUpdate.apply(this, arguments);
                /* Fix the dashboard grade average display */
                var avgEl = document.getElementById('dash-grade-avg');
                var lblEl = document.getElementById('dash-grade-label');
                if (avgEl) {
                    var subjects = _p42dbG('os_subjects', []);
                    var allReal = [];
                    subjects.forEach(function(s) {
                        (s.tests || []).forEach(function(t) { if (!t.practice) allReal.push(t); });
                    });
                    if (allReal.length) {
                        var avg = allReal.reduce(function(a, t) { return a + (t.score / t.max * 20); }, 0) / allReal.length;
                        avgEl.innerText = window._p42avgToDisplay(avg);
                    }
                }
            };
            return true;
        });

        return true;
    });

    /* C. Migrate legacy p9_grade_scale to our key */
    (function() {
        var legacy = _p42dbG('p9_grade_scale', null);
        var current = _p42dbG(GRADE_KEY, null);
        if (!current && legacy) {
            _p42dbS(GRADE_KEY, legacy);
        }
    })();

})();


/* ================================================================
   2.  WORKSHEET — UNIFIED BLOCK PICKER
       patches27 and patches28 each inject their own picker sections.
       This patch merges them into a single "All Blocks" section so
       users always see all 8 block types.
   ================================================================ */
(function _p42_unifiedPicker() {

    _p42waitFor(function() {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p42pickerDone) return true;
        window._p42pickerDone = true;

        var _origPicker = window.p19_wbOpenPicker;

        window.p19_wbOpenPicker = function() {
            _origPicker.apply(this, arguments);

            setTimeout(function() {
                var sheet = document.getElementById('p19-ws-picker-sheet');
                if (!sheet) return;

                /* Remove the separate p27 and p28 sections */
                var p27sec = sheet.querySelector('#p27-picker-sec');
                var p28sec = sheet.querySelector('#p28-picker-sec');
                if (p27sec) p27sec.remove();
                if (p28sec) p28sec.remove();

                /* Also remove any existing unified section */
                var existing = sheet.querySelector('#p42-picker-sec');
                if (existing) existing.remove();

                var sec = document.createElement('div');
                sec.className = 'p19-picker-section';
                sec.id = 'p42-picker-sec';

                var hdr = document.createElement('div');
                hdr.className = 'p19-picker-section-hdr';
                hdr.textContent = 'Utilities & Study Tools';
                sec.appendChild(hdr);

                var grid = document.createElement('div');
                grid.className = 'p19-picker-block-types';

                /* All 8 block types in one place */
                var allTypes = [
                    { type: 'table',     icon: 'table',                label: 'Table'      },
                    { type: 'callout',   icon: 'circle-info',          label: 'Callout'    },
                    { type: 'flashcard', icon: 'layer-group',          label: 'Flashcards' },
                    { type: 'calc',      icon: 'calculator',           label: 'Calculator' },
                    { type: 'timer',     icon: 'stopwatch',            label: 'Timer'      },
                    { type: 'formula',   icon: 'square-root-variable', label: 'Formula'    },
                    { type: 'checklist', icon: 'list-check',           label: 'Checklist'  },
                    { type: 'code',      icon: 'code',                 label: 'Code'       },
                ];

                allTypes.forEach(function(item) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'p19-picker-type-btn';
                    btn.innerHTML = '<i class="fa-solid fa-' + item.icon + '"></i>' + item.label;
                    btn.addEventListener('click', function() {
                        _p42addBlock(item.type);
                    });
                    grid.appendChild(btn);
                });

                sec.appendChild(grid);
                sheet.appendChild(sec);
            }, 100);
        };

        return true;
    });

    /* Unified add block function that delegates to the right patch */
    function _p42addBlock(type) {
        var ws = _p42dbG('os_worksheet', { blocks: [], savedValues: {} });
        ws.blocks = ws.blocks || [];
        if (ws.blocks.some(function(b) { return b.type === type; })) return;
        var id = Math.random().toString(36).slice(2, 10);

        var defaults = {
            table:     { id: id, type: 'table',     rows: [['Column A', 'Column B'], ['', '']], hasHeader: true },
            callout:   { id: id, type: 'callout',   content: '', variant: 'info' },
            flashcard: { id: id, type: 'flashcard', cards: [{ front: '', back: '' }] },
            calc:      { id: id, type: 'calc',      lines: [{ expr: '', result: null }] },
            timer:     { id: id, type: 'timer',     label: 'Focus', duration: 1500 },
            formula:   { id: id, type: 'formula',   formulaId: null, title: 'New Formula', formula: '', vars: [], solveFor: '', result: null, savedAs: '' },
            checklist: { id: id, type: 'checklist',  title: '', items: [] },
            code:      { id: id, type: 'code',       content: '', language: 'text' },
        };

        if (defaults[type]) {
            ws.blocks.push(defaults[type]);
            _p42dbS('os_worksheet', ws);

            /* Close the picker */
            var picker = document.getElementById('p19-ws-picker');
            if (picker) picker.classList.add('hidden');
            var sheet = document.getElementById('p19-ws-picker-sheet');
            if (sheet) sheet.classList.add('hidden');

            /* Re-render */
            if (typeof window.p19_wbRender === 'function') {
                window.p19_wbRender();
            }

            /* Mirror to active worksheet if multi-ws is enabled */
            if (typeof window._p41wsSaveActive === 'function') {
                window._p41wsSaveActive();
            }
        }
    }

})();


/* ================================================================
   3.  PROFILE — COLLAPSIBLE DROPDOWN SECTIONS + FA ICON FIX
   ================================================================ */
(function _p42_profileDropdowns() {

    var FA_AVATARS = [
        ['fa-user-graduate', 'Graduate'],   ['fa-book',          'Reader'],
        ['fa-laptop-code',   'Coder'],       ['fa-pen-nib',       'Writer'],
        ['fa-flask',         'Scientist'],   ['fa-music',         'Musician'],
        ['fa-palette',       'Artist'],      ['fa-chess',         'Strategist'],
        ['fa-rocket',        'Explorer'],    ['fa-brain',         'Thinker'],
        ['fa-star',          'Star'],        ['fa-fire',          'On fire'],
        ['fa-trophy',        'Champion'],    ['fa-dumbbell',      'Athlete'],
        ['fa-gamepad',       'Gamer'],       ['fa-guitar',        'Guitarist'],
        ['fa-headphones',    'Listener'],    ['fa-leaf',          'Nature'],
        ['fa-mountain',      'Hiker'],       ['fa-paw',           'Animal lover'],
        ['fa-camera',        'Photographer'],['fa-code',          'Developer'],
        ['fa-atom',          'Physicist'],   ['fa-infinity',      'Math'],
        ['fa-crow',          'Night owl'],   ['fa-sun',           'Morning person'],
        ['fa-heart',         'Kind'],        ['fa-bolt',          'Fast'],
        ['fa-shield-halved', 'Defender'],    ['fa-crown',         'Leader'],
    ];

    var EMOJIS = [
        '🎓', '📚', '🧑‍💻', '✏️',
        '🦊', '🐱', '🐼', '🦁',
        '🌟', '🚀', '🎯', '💡',
        '🎮', '🔥', '⚡', '🧠',
        '🎸', '🌈', '🦋', '🌺',
        '🐉', '🦄', '🏆', '🎨',
        '🧩', '🎭', '🌙', '☀️',
        '🍀', '🦅', '🐬', '🌵',
    ];

    _p42waitFor(function() {
        var modal = document.getElementById('modal-profile');
        if (!modal) return false;
        /* Wait for both patches39 and patches41 to have run */
        var emojiArea = modal.querySelector('.px-6.pt-4.pb-2');
        if (!emojiArea) return false;
        if (document.getElementById('p42-profile-sections')) return true;

        /* Build collapsible sections to replace the flat content */
        var wrapper = document.createElement('div');
        wrapper.id = 'p42-profile-sections';
        wrapper.style.padding = '10px 16px 6px';

        /* -- Emoji section -- */
        var emojiSection = _buildCollapsible('Emojis', '<i class="fa-solid fa-face-smile" style="font-size:.7rem;"></i>', true);
        var emojiGrid = document.createElement('div');
        emojiGrid.className = 'p42-emoji-grid';

        var profile = _p42dbG('os_profile', {});
        var currentEmoji = profile.emoji || '';

        EMOJIS.forEach(function(em) {
            var opt = document.createElement('div');
            opt.className = 'emoji-opt' + (currentEmoji === em ? ' selected' : '');
            opt.textContent = em;
            opt.addEventListener('click', function() {
                if (typeof window.setProfileEmoji === 'function') {
                    window.setProfileEmoji(em);
                }
                /* Update selected state */
                emojiGrid.querySelectorAll('.emoji-opt').forEach(function(o) {
                    o.classList.toggle('selected', o.textContent === em);
                });
                iconGrid.querySelectorAll('.p42-icon-opt').forEach(function(o) {
                    o.classList.remove('selected');
                });
            });
            emojiGrid.appendChild(opt);
        });
        emojiSection.body.appendChild(emojiGrid);

        /* -- Icon section -- */
        var iconSection = _buildCollapsible('Icons', '<i class="fa-solid fa-icons" style="font-size:.7rem;"></i>', false);
        var iconGrid = document.createElement('div');
        iconGrid.className = 'p42-icon-grid';

        FA_AVATARS.forEach(function(av) {
            var opt = document.createElement('button');
            opt.className = 'p42-icon-opt' + (currentEmoji === '__fa:fa-solid ' + av[0] ? ' selected' : '');
            opt.title = av[1];
            opt.type = 'button';
            opt.innerHTML = '<i class="fa-solid ' + av[0] + '"></i>';
            opt.addEventListener('click', function() {
                var iconClass = 'fa-solid ' + av[0];
                if (typeof window._p39setFaAvatar === 'function') {
                    window._p39setFaAvatar(iconClass);
                }
                /* Update selected state */
                iconGrid.querySelectorAll('.p42-icon-opt').forEach(function(o) {
                    o.classList.toggle('selected', o === opt);
                });
                emojiGrid.querySelectorAll('.emoji-opt').forEach(function(o) {
                    o.classList.remove('selected');
                });
            });
            iconGrid.appendChild(opt);
        });
        iconSection.body.appendChild(iconGrid);

        wrapper.appendChild(emojiSection.el);
        wrapper.appendChild(iconSection.el);

        /* Replace the original emoji area */
        emojiArea.parentElement.insertBefore(wrapper, emojiArea);
        emojiArea.style.display = 'none';

        /* Also hide patches41's section if present */
        var p41section = modal.querySelector('.p41-avatar-section');
        if (p41section) p41section.style.display = 'none';

        return true;
    }, 80, 400);

    function _buildCollapsible(title, iconHTML, startOpen) {
        var section = document.createElement('div');
        section.className = 'p42-profile-section';

        var header = document.createElement('div');
        header.className = 'p42-profile-section-header';
        header.innerHTML =
            '<span class="p42-section-title">' + iconHTML + ' ' + title + '</span>'
            + '<i class="fa-solid fa-chevron-down p42-chevron' + (startOpen ? ' open' : '') + '"></i>';

        var body = document.createElement('div');
        body.className = 'p42-profile-section-body' + (startOpen ? ' open' : '');

        header.addEventListener('click', function() {
            var isOpen = body.classList.contains('open');
            body.classList.toggle('open', !isOpen);
            header.querySelector('.p42-chevron').classList.toggle('open', !isOpen);
        });

        section.appendChild(header);
        section.appendChild(body);

        return { el: section, header: header, body: body };
    }

    /* B. Fix sidebar profile display for FA icons */
    _p42waitFor(function() {
        if (typeof window.renderProfileDisplay !== 'function') return false;
        if (window._p42profileFixed) return true;
        window._p42profileFixed = true;

        var _origRender = window.renderProfileDisplay;
        window.renderProfileDisplay = function() {
            var profile = _p42dbG('os_profile', {});
            /* If it's an FA icon, handle it ourselves */
            if (profile.emoji && typeof profile.emoji === 'string' && profile.emoji.indexOf('__fa:') === 0) {
                var iconClass = _p42safeIconClass(profile.emoji.slice(5));
                var bg = profile.bg || profile.avatarBg || '#3b82f6';

                var pd = document.getElementById('profile-display');
                if (pd) {
                    pd.innerHTML = '';
                    var span = document.createElement('span');
                    span.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:14px;background:' + bg + ';';
                    var icon = document.createElement('i');
                    icon.className = iconClass + ' text-xl text-white';
                    icon.setAttribute('aria-hidden', 'true');
                    span.appendChild(icon);
                    pd.appendChild(span);
                }

                var ap = document.getElementById('avatar-preview');
                if (ap) {
                    ap.innerHTML = '';
                    var icon2 = document.createElement('i');
                    icon2.className = iconClass + ' text-4xl text-white';
                    icon2.setAttribute('aria-hidden', 'true');
                    ap.appendChild(icon2);
                    ap.style.background = bg;
                }
                return;
            }
            /* Otherwise use original */
            _origRender.apply(this, arguments);
        };

        /* Re-render to apply fix immediately */
        window.renderProfileDisplay();
        return true;
    });

    /* C. Sync profile selection state when modal opens */
    _p42waitFor(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p42modalHooked) return true;
        window._p42modalHooked = true;

        var _origOpen = window.openModal;
        window.openModal = function(id) {
            _origOpen.apply(this, arguments);

            if (id === 'modal-profile') {
                setTimeout(function() {
                    var profile = _p42dbG('os_profile', {});
                    var currentEmoji = profile.emoji || '';

                    /* Sync emoji selection */
                    var emojiGrid = document.querySelector('#p42-profile-sections .p42-emoji-grid');
                    if (emojiGrid) {
                        emojiGrid.querySelectorAll('.emoji-opt').forEach(function(o) {
                            o.classList.toggle('selected', o.textContent === currentEmoji);
                        });
                    }

                    /* Sync icon selection */
                    var iconGrid = document.querySelector('#p42-profile-sections .p42-icon-grid');
                    if (iconGrid) {
                        iconGrid.querySelectorAll('.p42-icon-opt').forEach(function(o) {
                            var iconEl = o.querySelector('i');
                            if (iconEl) {
                                var expected = '__fa:' + iconEl.className.replace(/\s*text-.*$/, '').trim();
                                o.classList.toggle('selected', expected === currentEmoji);
                            }
                        });
                    }
                }, 50);
            }
        };
        return true;
    });

})();


/* ================================================================
   4.  MINDMAP — RESIZE OBSERVER + EDGE FIX
   ================================================================ */
(function _p42_mindmapResize() {

    _p42waitFor(function() {
        var container = document.getElementById('wb-container');
        if (!container) return false;
        if (window._p42mmResizeObserved) return true;
        window._p42mmResizeObserved = true;

        /* Use ResizeObserver to keep SVG sized correctly */
        if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(function(entries) {
                var svg = document.getElementById('wb-mindmap-svg');
                if (!svg) return;
                /* Only resize if mindmap is visible */
                if (svg.style.display === 'none') return;
                var entry = entries[0];
                if (entry) {
                    var w = entry.contentRect.width;
                    var h = entry.contentRect.height;
                    if (w > 0 && h > 0) {
                        svg.setAttribute('width', w);
                        svg.setAttribute('height', h);
                    }
                }
            });
            ro.observe(container);
        }

        /* Also handle window resize as fallback */
        window.addEventListener('resize', function() {
            var svg = document.getElementById('wb-mindmap-svg');
            if (!svg || svg.style.display === 'none') return;
            if (container.clientWidth > 0 && container.clientHeight > 0) {
                svg.setAttribute('width', container.clientWidth);
                svg.setAttribute('height', container.clientHeight);
            }
        });

        return true;
    });

    /* Fix: Re-render mindmap when switching to whiteboard mindmap mode */
    _p42waitFor(function() {
        if (typeof window.wbMmRender !== 'function') return false;
        if (window._p42mmModeHooked) return true;
        window._p42mmModeHooked = true;

        /* Watch for mindmap SVG becoming visible */
        var svg = document.getElementById('wb-mindmap-svg');
        if (svg) {
            var mo = new MutationObserver(function(mutations) {
                mutations.forEach(function(m) {
                    if (m.type === 'attributes' && m.attributeName === 'style') {
                        if (svg.style.display !== 'none') {
                            /* Re-size and re-render when made visible */
                            var con = document.getElementById('wb-container');
                            if (con && con.clientWidth > 0 && con.clientHeight > 0) {
                                svg.setAttribute('width', con.clientWidth);
                                svg.setAttribute('height', con.clientHeight);
                            }
                            window.wbMmRender();
                        }
                    }
                });
            });
            mo.observe(svg, { attributes: true, attributeFilter: ['style'] });
        }

        return true;
    });

})();


/* ================================================================
   5.  QoL — MINOR IMPROVEMENTS
   ================================================================ */
(function _p42_qol() {

    /* A. Settings modal: sync grade system on open */
    _p42waitFor(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p42settingsHooked) return true;
        window._p42settingsHooked = true;

        /* We already hooked openModal in the profile section,
           so just add logic to the existing hook */
        var _prevOpen = window.openModal;
        window.openModal = function(id) {
            _prevOpen.apply(this, arguments);

            if (id === 'modal-settings') {
                /* Sync grade system selection */
                var container = document.getElementById('p42-grade-options');
                if (container) {
                    var current = window._p42getGradeSystem ? window._p42getGradeSystem() : 'twenty';
                    container.querySelectorAll('.p42-grade-system-option').forEach(function(opt) {
                        var radio = opt.querySelector('input[type="radio"]');
                        if (radio) {
                            var isActive = radio.value === current;
                            opt.classList.toggle('active', isActive);
                            radio.checked = isActive;
                        }
                    });
                }
            }
        };
        return true;
    });

    /* B. Auto-focus on subject name when adding subject */
    _p42waitFor(function() {
        var inp = document.getElementById('subject-name');
        if (!inp) return false;
        if (inp.dataset.p42focus) return true;
        inp.dataset.p42focus = '1';

        /* Watch for modal becoming visible */
        var modal = document.getElementById('modal-add-subject');
        if (modal) {
            new MutationObserver(function() {
                if (!modal.classList.contains('hidden')) {
                    setTimeout(function() { inp.focus(); }, 50);
                }
            }).observe(modal, { attributes: true, attributeFilter: ['class'] });
        }
        return true;
    });

    /* C. Auto-focus on test score when adding test */
    _p42waitFor(function() {
        var inp = document.getElementById('test-score');
        if (!inp) return false;
        if (inp.dataset.p42focus) return true;
        inp.dataset.p42focus = '1';

        var modal = document.getElementById('modal-add-test');
        if (modal) {
            new MutationObserver(function() {
                if (!modal.classList.contains('hidden')) {
                    setTimeout(function() { inp.focus(); }, 50);
                }
            }).observe(modal, { attributes: true, attributeFilter: ['class'] });
        }
        return true;
    });

})();


/* ================================================================
   INIT
   ================================================================ */
console.log('[patches42] loaded — grade system config, unified block picker, profile dropdowns, mindmap resize, QoL');
