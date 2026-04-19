/* ================================================================
   StudentOS — patches56.js
   1.  Profile modal — hide Text Size, Language, Reduce Motion,
       Compact Mode and Startup Tab rows.  These settings are already
       accessible in Settings > Appearance; duplicating them in the
       profile sidebar adds clutter.
   2.  Flashcard card list — inject a persistent star-toggle button
       on every card row so users can star / un-star cards directly
       from the deck editor without having to enter study mode.
   ================================================================ */

(function _p56_init() {
    'use strict';

    /* ── tiny wait helper ─────────────────────────────────────── */
    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 14000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  PROFILE MODAL — HIDE DUPLICATE PREFERENCE ROWS
           CSS (patches56.css) already hides them via :has() and IDs;
           this JS pass is a belt-and-braces fallback for browsers
           that do not yet support :has() in selector context.
       ================================================================ */

    function _hideProfileRows() {
        /* Language row added by patches52 */
        var langRow = document.getElementById('p52-lang-row');
        if (langRow) langRow.style.display = 'none';

        /* Reduce Motion / Compact Mode / Startup Tab block added by patches55 */
        var extraRows = document.getElementById('p55-extra-rows');
        if (extraRows) extraRows.style.display = 'none';

        /* Text Size (Font Scale) row added by patches51 — no stable ID,
           locate it by the .p51-scale-group it contains. */
        var prefs = document.getElementById('p51-profile-prefs');
        if (prefs) {
            var scaleGroup = prefs.querySelector('.p51-scale-group');
            if (scaleGroup) {
                var scaleRow = scaleGroup.closest('.p51-pref-row');
                if (scaleRow) scaleRow.style.display = 'none';
            }
        }
    }

    /* Run as soon as the Quick Preferences section exists */
    _wait(function() {
        if (!document.getElementById('p51-profile-prefs')) return false;
        _hideProfileRows();
        return true;
    }, 100, 12000);

    /* Re-run every time the profile modal opens (rows may be re-built) */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p56openModalHooked) return true;
        window._p56openModalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-profile') {
                /* Give patches51/52/55 time to (re-)build their rows,
                   then hide them. */
                setTimeout(_hideProfileRows, 150);
                setTimeout(_hideProfileRows, 400);
            }
        };
        return true;
    }, 100, 12000);

    /* ================================================================
       2.  FLASHCARD CARD LIST — STAR TOGGLE BUTTON
           After renderCardList has built (and any earlier patch has
           post-processed) the card rows, inject a small star button
           before the existing hover-only edit/delete buttons.
       ================================================================ */

    /**
     * Toggle the starred flag on card at index `idx` in the active deck,
     * persist to DB, then re-render the card list and deck overview.
     */
    window._p56toggleCardStar = function(idx) {
        var decks = window.decks;
        var deckId = window.activeDeckId;
        if (!Array.isArray(decks) || !deckId) return;

        var deck = decks.find(function(d) { return d.id === deckId; });
        if (!deck || !deck.cards || idx < 0 || idx >= deck.cards.length) return;

        deck.cards[idx].starred = !deck.cards[idx].starred;

        if (typeof DB !== 'undefined') DB.set('os_decks', decks);
        if (typeof window.renderCardList === 'function') window.renderCardList();
        /* Refresh the deck overview so the starred-count badge updates */
        if (typeof window.renderDecks === 'function') window.renderDecks();
    };

    /**
     * Post-process the card list DOM to inject star toggle buttons.
     * Called after the original renderCardList (and any earlier patch
     * wrappers) have built the rows.
     */
    function _injectStarButtons() {
        var container = document.getElementById('cards-list-container');
        if (!container) return;

        var decks  = window.decks;
        var deckId = window.activeDeckId;
        if (!Array.isArray(decks) || !deckId) return;

        var deck = decks.find(function(d) { return d.id === deckId; });
        if (!deck || !deck.cards || deck.cards.length === 0) return;

        /* Select card rows — mirrors the selector used by patches54 */
        var rows = container.querySelectorAll('.flex.items-center.justify-between');
        deck.cards.forEach(function(card, i) {
            var row = rows[i];
            if (!row) return;

            /* Avoid duplicate injection on re-renders */
            if (row.querySelector('.p56-star-btn')) return;

            var isStarred = !!card.starred;
            var btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = 'p56-star-btn' + (isStarred ? ' on' : '');
            btn.title     = isStarred ? 'Remove star' : 'Star this card';
            btn.innerHTML = isStarred
                ? '<i class="fa-solid fa-star"></i>'
                : '<i class="fa-regular fa-star"></i>';

            /* Capture index by value so the async click closure is correct */
            btn.addEventListener('click', (function(idx) {
                return function(e) {
                    e.stopPropagation();
                    window._p56toggleCardStar(idx);
                };
            })(i));

            /* Insert the star button immediately before the
               hover-only edit/delete action group */
            var actionDiv = row.querySelector('.flex.gap-1');
            if (actionDiv) {
                row.insertBefore(btn, actionDiv);
            } else {
                /* Fallback: append to row */
                row.appendChild(btn);
            }
        });
    }

    /* Wrap renderCardList so star buttons are added after every render */
    _wait(function() {
        if (typeof window.renderCardList !== 'function') return false;
        if (window._p56cardListHooked) return true;
        window._p56cardListHooked = true;

        var _orig = window.renderCardList;
        window.renderCardList = function() {
            _orig.apply(this, arguments);
            _injectStarButtons();
        };
        return true;
    }, 200, 14000);

    /* Also inject buttons into any card list that was already rendered
       before this patch loaded (e.g. deck was open on page load). */
    _wait(function() {
        var c = document.getElementById('cards-list-container');
        if (!c) return false;
        _injectStarButtons();
        return true;
    }, 300, 8000);

    console.log('[patches56] loaded — profile modal cleaned up, flashcard star-toggle added');
}());
