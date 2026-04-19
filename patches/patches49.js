/* ================================================================
   StudentOS — patches49.js
   1.  Profile modal — hide "Background" colour row when an FA icon
       is the active pfp (the colour option has no visible effect
       on icon-type profiles so we hide it to reduce confusion).
   2.  Settings Identity section — replace the inline emoji/icon
       grids (injected by patches43) with a compact "Edit Profile"
       button that opens modal-profile.  All changes to avatar,
       emoji, and icon are made exclusively via that modal or via
       the sidebar profile button.
   3.  Worksheet picker — merge "Content blocks" and
       "Utilities & Study Tools" into a single "Blocks" section
       and remove the duplicate "Checklists & Code" section
       injected by patches28 (#p28-new-types-sec).
   ================================================================ */

(function _p49_init() {
    'use strict';

    /* ── helpers ─────────────────────────────────────────────── */
    function _db(key, def) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.get === 'function')
                return DB.get(key, def);
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }

    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 10000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  PROFILE MODAL — HIDE COLOUR ROW FOR FA ICON PROFILES
       ================================================================ */

    function _p49isIconProfile() {
        var profile = _db('os_profile', {});
        return typeof profile.emoji === 'string' && profile.emoji.indexOf('__fa:') === 0;
    }

    /**
     * Show or hide the "Background:" colour row inside modal-profile
     * based on whether the current pfp is an FA icon.
     */
    function _p49updateColorRow() {
        var modal = document.getElementById('modal-profile');
        if (!modal) return;
        var isIcon = _p49isIconProfile();
        /* The colour row contains a <span> with text "Background:" */
        var divs = modal.querySelectorAll('div');
        for (var i = 0; i < divs.length; i++) {
            var span = divs[i].querySelector(':scope > span');
            if (span && span.textContent.trim() === 'Background:') {
                divs[i].style.display = isIcon ? 'none' : '';
            }
        }
    }

    /* ================================================================
       2.  SETTINGS — COMPACT IDENTITY: REPLACE CLUTTER WITH BUTTON
       ================================================================ */

    function _p49simplifySettings() {
        var settingsProfile = document.querySelector('.p43-settings-profile');
        if (!settingsProfile) return false;

        /* Hide background colour row (contains a span "Background:") */
        var allDivs = settingsProfile.querySelectorAll('div');
        for (var i = 0; i < allDivs.length; i++) {
            var sp = allDivs[i].querySelector(':scope > span');
            if (sp && sp.textContent.trim() === 'Background:') {
                allDivs[i].style.display = 'none';
            }
        }

        /* Hide emoji/icon sections injected by patches43 */
        var p43wrapper = document.getElementById('p43-settings-profile-sections');
        if (p43wrapper) p43wrapper.style.display = 'none';

        /* Hide the original emoji grid */
        var emojiGrid = document.getElementById('settings-emoji-grid');
        if (emojiGrid) emojiGrid.style.display = 'none';

        /* Hide the "Choose Emoji" heading label (if patches47 missed it) */
        var allSmall = settingsProfile.querySelectorAll('.text-xs, .font-bold');
        for (var j = 0; j < allSmall.length; j++) {
            if (allSmall[j].textContent.trim() === 'Choose Emoji') {
                allSmall[j].style.display = 'none';
            }
        }

        /* Hide the original "Upload Photo" button wrapper */
        var mt3s = settingsProfile.querySelectorAll('.mt-3');
        for (var k = 0; k < mt3s.length; k++) {
            var uploadBtn = mt3s[k].querySelector('button');
            if (uploadBtn && uploadBtn.textContent.indexOf('Upload') !== -1) {
                mt3s[k].style.display = 'none';
            }
        }

        /* Add the "Edit Profile" button once */
        if (!document.getElementById('p49-edit-profile-btn')) {
            var editBtn = document.createElement('button');
            editBtn.id        = 'p49-edit-profile-btn';
            editBtn.type      = 'button';
            editBtn.className = 'p49-edit-profile-btn';
            editBtn.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Edit Profile';
            editBtn.addEventListener('click', function() {
                if (typeof window.openModal === 'function') window.openModal('modal-profile');
            });

            /* Insert after the avatar + name row */
            var firstRow = settingsProfile.querySelector('.flex.items-center.gap-4');
            if (firstRow) {
                firstRow.parentNode.insertBefore(editBtn, firstRow.nextSibling);
            } else {
                settingsProfile.appendChild(editBtn);
            }
        }

        return true;
    }

    /* Run once the settings profile container exists in the DOM */
    _wait(function() {
        return _p49simplifySettings();
    }, 200, 10000);

    /* ================================================================
       SHARED openModal HOOK
       Handles profile-modal colour row AND settings simplification.
       ================================================================ */

    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p49modalHooked) return true;
        window._p49modalHooked = true;

        var _orig = window.openModal;
        window.openModal = function(id) {
            _orig.apply(this, arguments);
            if (id === 'modal-profile') {
                /* Update colour row visibility after the modal is shown */
                setTimeout(_p49updateColorRow, 0);
            }
            if (id === 'modal-settings') {
                /* Re-run simplification after patches43 has synced its sections */
                setTimeout(_p49simplifySettings, 250);
            }
        };
        return true;
    });

    /* Also update the colour row whenever profile state changes */
    _wait(function() {
        if (typeof window.renderProfileDisplay !== 'function') return false;
        if (window._p49renderHooked) return true;
        window._p49renderHooked = true;

        var _orig = window.renderProfileDisplay;
        window.renderProfileDisplay = function() {
            _orig.apply(this, arguments);
            _p49updateColorRow();
        };
        return true;
    });

    /* ================================================================
       3.  WORKSHEET PICKER — ONE UNIFIED "BLOCKS" CATEGORY
           Runs at 400 ms — after patches28 (240 ms) and
           patches42 (100 ms) have both injected their sections.
       ================================================================ */

    _wait(function() {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p49pickerDone) return true;
        window._p49pickerDone = true;

        var _orig = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            _orig.apply(this, arguments);
            setTimeout(function() {
                var sheet = document.getElementById('p19-ws-picker-sheet');
                if (!sheet) return;

                /* 1. Remove duplicate p28 "Checklists & Code" section */
                var p28dup = sheet.querySelector('#p28-new-types-sec');
                if (p28dup) p28dup.remove();

                /* 2. Locate the patches42 unified section */
                var p42sec  = sheet.querySelector('#p42-picker-sec');
                if (!p42sec) return;

                /* 3. Rename its header from "Utilities & Study Tools" → "Blocks" */
                var p42hdr  = p42sec.querySelector('.p19-picker-section-hdr');
                if (p42hdr) p42hdr.textContent = 'Blocks';

                var p42grid = p42sec.querySelector('.p19-picker-block-types');
                if (!p42grid) return;

                /* 4. Find the original p19 "Content blocks" section (no ID,
                      contains Heading / Text note / Divider buttons) */
                var sections = sheet.querySelectorAll('.p19-picker-section');
                var contentSec = null;
                for (var i = 0; i < sections.length; i++) {
                    var hdr = sections[i].querySelector('.p19-picker-section-hdr');
                    if (hdr && hdr.textContent.trim() === 'Content blocks') {
                        contentSec = sections[i];
                        break;
                    }
                }

                if (contentSec) {
                    /* Move heading/text/divider buttons to the top of #p42-picker-sec */
                    var contentGrid = contentSec.querySelector('.p19-picker-block-types');
                    if (contentGrid) {
                        var btns = Array.from(contentGrid.querySelectorAll('.p19-picker-type-btn'));
                        var firstChild = p42grid.firstChild;
                        btns.reverse().forEach(function(btn) {
                            p42grid.insertBefore(btn, firstChild);
                            firstChild = btn;
                        });
                    }
                    contentSec.remove();
                }

                /* 5. Remove the patches22 duplicate Checklist button — patches22 added
                      it to the content-blocks grid at 60 ms; after the merge above it
                      ends up inside p42grid alongside patches42's own Checklist entry. */
                var p22cl = p42grid.querySelector('[data-p22cl]');
                if (p22cl) p22cl.remove();
            }, 400);
        };

        return true;
    });

    console.log('[patches49] loaded — icon colour row, settings edit button, unified picker, checklist dedup');
}());
