/* ================================================================
   StudentOS — patches43.js
   1.  Settings inline profile — keep the settings-embedded profile
       editor in sync with profile state (avatar, emoji, name).
       Also inject collapsible Emoji + Icon sections (matching
       patches42's profile modal upgrade).
   2.  Font Awesome brands preload — ensure FA webfont files are
       fetched early so brand icons render on first paint.
   ================================================================ */

(function _p43_init() {

    /* ── Helpers ────────────────────────────────────────── */
    function _p43dbG(key, fallback) {
        try {
            var v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch (_) { return fallback; }
    }

    function _p43safeIconClass(raw) {
        return (raw || '').replace(/[^a-zA-Z0-9\- ]/g, '');
    }

    /* Poll until a condition is met (like patches42's _p42waitFor) */
    function _p43waitFor(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 5000;
        var elapsed = 0;
        var id = setInterval(function() {
            elapsed += interval;
            if (fn() || elapsed >= maxWait) clearInterval(id);
        }, interval);
    }

    /* Collapsible section builder (same UX as patches42) */
    function _p43buildCollapsible(title, iconHTML, startOpen) {
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

    /* Same emoji + icon data as patches42 */
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

    /* ================================================================
       1A.  INJECT COLLAPSIBLE EMOJI + ICON SECTIONS IN SETTINGS
       ================================================================ */

    _p43waitFor(function() {
        var settingsGrid = document.getElementById('settings-emoji-grid');
        if (!settingsGrid) return false;
        if (document.getElementById('p43-settings-profile-sections')) return true;

        var profile = _p43dbG('os_profile', {});
        var currentEmoji = profile.emoji || '';

        var wrapper = document.createElement('div');
        wrapper.id = 'p43-settings-profile-sections';

        /* -- Emoji section -- */
        var emojiSection = _p43buildCollapsible('Emojis', '<i class="fa-solid fa-face-smile" style="font-size:.7rem;"></i>', true);
        var emojiGrid = document.createElement('div');
        emojiGrid.className = 'p42-emoji-grid';

        EMOJIS.forEach(function(em) {
            var opt = document.createElement('div');
            opt.className = 'emoji-opt' + (currentEmoji === em ? ' selected' : '');
            opt.textContent = em;
            opt.addEventListener('click', function() {
                if (typeof window.setProfileEmoji === 'function') {
                    window.setProfileEmoji(em);
                }
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
        var iconSection = _p43buildCollapsible('Icons', '<i class="fa-solid fa-icons" style="font-size:.7rem;"></i>', false);
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

        /* Replace the plain emoji grid with the enhanced version */
        settingsGrid.parentNode.insertBefore(wrapper, settingsGrid);
        settingsGrid.style.display = 'none';

        return true;
    }, 80, 5000);

    /* ================================================================
       1B.  SETTINGS INLINE PROFILE SYNC
       ================================================================ */

    /*
     * Whenever the settings modal opens, sync the inline profile
     * editor to match the current profile data (avatar preview,
     * selected emoji, name input).
     */
    _p43waitFor(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p43modalHooked) return true;
        window._p43modalHooked = true;

        var _origOpen = window.openModal;
        window.openModal = function(id) {
            _origOpen.apply(this, arguments);
            if (id === 'modal-settings') {
                _p43syncSettingsProfile();
            }
        };
        return true;
    });

    /* Sync the inline profile editor inside settings */
    function _p43syncSettingsProfile() {
        var profile = _p43dbG('os_profile', { type: 'emoji', emoji: '🎓', bg: '#3b82f6' });
        var name    = _p43dbG('os_name', '');

        /* Name input */
        var nameInp = document.getElementById('student-name-input');
        if (nameInp && name) nameInp.value = name;

        /* Avatar preview */
        var ap = document.getElementById('settings-avatar-preview');
        if (ap) {
            var emoji = profile.emoji || '🎓';
            var bg    = profile.bg || profile.avatarBg || '#3b82f6';

            if (profile.type === 'image' && profile.img) {
                var img = document.createElement('img');
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:16px;';
                img.alt = '';
                /* Only allow safe image data: URIs and https: URLs */
                var imgSrc = String(profile.img || '');
                var safeDataUri = /^data:image\/(png|jpeg|jpg|gif|webp|bmp)(;base64)?,/.test(imgSrc);
                if (safeDataUri || imgSrc.indexOf('https://') === 0) {
                    img.src = imgSrc;
                }
                ap.innerHTML = '';
                ap.appendChild(img);
                ap.style.background = '';
            } else if (typeof emoji === 'string' && emoji.indexOf('__fa:') === 0) {
                var iconClass = _p43safeIconClass(emoji.slice(5));
                ap.innerHTML = '';
                var icon = document.createElement('i');
                icon.className = iconClass + ' text-2xl text-white';
                icon.setAttribute('aria-hidden', 'true');
                ap.appendChild(icon);
                ap.style.background = bg;
            } else {
                ap.textContent = emoji;
                ap.style.background = bg;
                ap.style.fontSize = '1.6rem';
            }
        }

        /* Highlight selected emoji/icon in settings sections */
        var wrapper = document.getElementById('p43-settings-profile-sections');
        if (wrapper) {
            var currentEmoji = profile.emoji || '🎓';
            wrapper.querySelectorAll('.emoji-opt').forEach(function(opt) {
                opt.classList.toggle('selected', opt.textContent.trim() === currentEmoji);
            });
            wrapper.querySelectorAll('.p42-icon-opt').forEach(function(opt) {
                var iEl = opt.querySelector('i');
                if (iEl) {
                    var cls = iEl.className.replace(/\s*text-.*$/, '').trim();
                    opt.classList.toggle('selected', currentEmoji === '__fa:' + cls);
                }
            });
        }
    }

    /* Also update settings avatar when profile changes */
    _p43waitFor(function() {
        if (typeof window.renderProfileDisplay !== 'function') return false;
        if (window._p43renderHooked) return true;
        window._p43renderHooked = true;

        var _origRender = window.renderProfileDisplay;
        window.renderProfileDisplay = function() {
            _origRender.apply(this, arguments);
            /* Also update the settings inline avatar */
            _p43syncSettingsProfile();
        };
        return true;
    });

    /* ================================================================
       2.  FONT AWESOME BRANDS — EARLY WEBFONT FETCH
       ================================================================ */

    /*
     * Font Awesome loads webfonts lazily — the CSS is fetched first,
     * then the browser downloads the .woff2 files only when an icon
     * is first painted.  Pre-fetching the brands font file ensures
     * fa-brands icons render on first paint without a blank flash.
     *
     * We do this by creating a hidden element with fa-brands class,
     * which forces the browser to request the brands webfont early.
     */
    (function _prefetchFaBrands() {
        var probe = document.createElement('i');
        probe.className = 'fa-brands fa-font-awesome';
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;';
        document.body.appendChild(probe);
        /* Remove after fonts have had time to load */
        setTimeout(function() {
            if (probe.parentNode) probe.parentNode.removeChild(probe);
        }, 5000);
    })();

    /* ================================================================
       3.  WORKSHEET — ADD .p43-has-height CLASS FOR RESIZED BLOCKS
       ================================================================ */

    /*
     * patches28.js sets el.style.minHeight on resized blocks.
     * We observe the board and tag blocks that have a custom height
     * with .p43-has-height so CSS can apply overflow:hidden.
     */
    _p43waitFor(function() {
        var board = document.getElementById('p19-ws-board');
        if (!board) return false;
        if (window._p43heightObsDone) return true;
        window._p43heightObsDone = true;

        function _tagResizedBlocks() {
            board.querySelectorAll('.p19-ws-block').forEach(function(block) {
                block.classList.toggle('p43-has-height', !!block.style.minHeight);
            });
        }

        var obs = new MutationObserver(_tagResizedBlocks);
        obs.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        _tagResizedBlocks();
        return true;
    }, 200, 10000);

    /* ================================================================
       4.  SETTINGS NAME → PROFILE NAME SYNC
       ================================================================ */

    _p43waitFor(function() {
        var inp = document.getElementById('student-name-input');
        if (!inp) return false;
        if (window._p43nameSyncDone) return true;
        window._p43nameSyncDone = true;

        inp.addEventListener('input', function() {
            var pi = document.getElementById('profile-name-input');
            if (pi) pi.value = inp.value;
        });
        return true;
    });

    console.log('[patches43] loaded — settings profile sync, FA brands preload');
})();
