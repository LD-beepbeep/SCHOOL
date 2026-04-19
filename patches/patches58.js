/* ================================================================
   StudentOS — patches58.js
   1.  Whiteboard settings — remove all whiteboard-related nodes
       from the settings modal on every open (belt-and-braces on
       top of patches55.js).
   2.  Flashcard study view — inject a ★ Star button in the study
       header so users can star / unstar the current card without
       leaving the study session.
   3.  Flashcard card list — override renderCardList to include a
       ★ star toggle button on every row so users can star cards
       from the deck-editor view.
   ================================================================ */

(function _p58_init() {
    'use strict';

    /* ── helpers ──────────────────────────────────────────────── */
    function _wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 15000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    function _db(key, def) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function')
                return DB.get(key, def);
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }

    function _dbSet(key, val) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function')
                return DB.set(key, val);
            localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {}
    }

    /* ================================================================
       1.  WHITEBOARD SETTINGS — AGGRESSIVE REMOVAL
           Remove every whiteboard-related settings node that may have
           survived earlier patches.  Runs each time the settings modal
           opens, and once on page load.
       ================================================================ */

    function _removeWbSettingsNodes() {
        /* Known whiteboard section IDs */
        ['p48-whiteboard-section', 'p53-wb-appearance-section'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });

        /* If patches48 didn't extract the whiteboard rows, they may
           still be inside #p46-widgets-section as the sub-label and
           everything after it.  Remove them now. */
        var widgetSec = document.getElementById('p46-widgets-section');
        if (widgetSec) {
            var subLabel = widgetSec.querySelector('.p46-sub-label');
            if (subLabel) {
                /* Collect the sub-label and all its following siblings */
                var toRemove = [];
                var node = subLabel;
                while (node) {
                    toRemove.push(node);
                    node = node.nextElementSibling;
                }
                toRemove.forEach(function(el) { el.remove(); });
            }
        }
    }

    /* Run once on load */
    _wait(function() {
        _removeWbSettingsNodes();
        /* Return true only once p46-widgets-section has been created
           (otherwise there is nothing to clean yet). */
        return !!document.getElementById('p46-widgets-section');
    }, 200, 15000);

    /* Re-run every time the settings modal opens */
    _wait(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p58openModalHooked) return true;
        window._p58openModalHooked = true;

        var _prev = window.openModal;
        window.openModal = function(id) {
            _prev.apply(this, arguments);
            if (id === 'modal-settings') {
                setTimeout(_removeWbSettingsNodes, 300);
                setTimeout(_removeWbSettingsNodes, 800);
            }
        };
        return true;
    });

    /* ================================================================
       2.  FLASHCARD STUDY VIEW — STAR BUTTON IN HEADER
           Injects a ★ button next to the close button in the study
           header.  Clicking it toggles card.starred on the active
           card and persists the change to DB.
       ================================================================ */

    function _injectStudyStarBtn() {
        /* Only proceed when the study header exists */
        var header = document.querySelector('#cards-study-view .flex.items-center.justify-between');
        if (!header) return false;
        if (document.getElementById('p58-study-star-btn')) return true;

        /* Build the button */
        var btn = document.createElement('button');
        btn.id        = 'p58-study-star-btn';
        btn.type      = 'button';
        btn.title     = 'Star this card';
        btn.innerHTML = '<i class="fa-solid fa-star"></i>';

        /* Insert after the close-button group */
        var leftGroup = header.querySelector('.flex.items-center.gap-4');
        if (leftGroup) {
            leftGroup.appendChild(btn);
        } else {
            header.insertBefore(btn, header.firstChild);
        }

        /* Click handler */
        btn.addEventListener('click', function() {
            _toggleCurrentCardStar();
        });

        return true;
    }

    function _toggleCurrentCardStar() {
        var deckId = typeof window.activeDeckId !== 'undefined' ? window.activeDeckId : null;
        var queue  = typeof window.studyQueue   !== 'undefined' ? window.studyQueue   : null;
        var idx    = typeof window.studyIdx     !== 'undefined' ? window.studyIdx     : 0;
        if (!deckId || !queue || idx >= queue.length) return;

        var card = queue[idx];
        if (!card) return;

        /* Toggle starred on the card object */
        card.starred = !card.starred;

        /* Persist: find the card in the real deck and update it */
        var decksArr = typeof window.decks !== 'undefined' ? window.decks : null;
        if (decksArr) {
            var deck = decksArr.find(function(d) { return d.id === deckId; });
            if (deck && deck.cards) {
                var real = deck.cards.find(function(c) { return c.id === card.id; });
                if (real) real.starred = card.starred;
                _dbSet('os_decks', decksArr);
            }
        }

        /* Update button appearance */
        _syncStudyStarBtn();

        /* Refresh the badge on the current study card */
        if (typeof window.showStudyCard === 'function') {
            /* Re-run showStudyCard to refresh badges without advancing the queue */
            var origIdx = window.studyIdx;
            window.showStudyCard();
            /* showStudyCard advances state only through studyIdx;
               we haven't changed it so the same card stays displayed. */
        }
    }

    function _syncStudyStarBtn() {
        var btn   = document.getElementById('p58-study-star-btn');
        if (!btn) return;
        var queue = typeof window.studyQueue !== 'undefined' ? window.studyQueue : null;
        var idx   = typeof window.studyIdx   !== 'undefined' ? window.studyIdx   : 0;
        var card  = (queue && idx < queue.length) ? queue[idx] : null;
        btn.classList.toggle('starred', !!(card && card.starred));
        btn.title = (card && card.starred) ? 'Unstar this card' : 'Star this card';
    }

    /* Inject once the study view DOM is present */
    _wait(function() {
        return _injectStudyStarBtn();
    }, 150, 15000);

    /* Sync star button state whenever a new card is shown */
    _wait(function() {
        if (typeof window.showStudyCard !== 'function') return false;
        if (window._p58showHooked) return true;
        window._p58showHooked = true;

        var _orig = window.showStudyCard;
        window.showStudyCard = function() {
            _orig.apply(this, arguments);
            /* Ensure button exists (study view may not have been open yet) */
            _injectStudyStarBtn();
            setTimeout(_syncStudyStarBtn, 0);
        };
        return true;
    });

    /* ================================================================
       3.  FLASHCARD CARD LIST — STAR TOGGLE BUTTON ON EACH ROW
           Wraps renderCardList so that every card row has a ★ button
           the user can click to toggle starred status.
       ================================================================ */

    /* Global function so the inline onclick can reach it */
    window._p58toggleCardStar = function(cardIndex) {
        var deckId   = typeof window.activeDeckId !== 'undefined' ? window.activeDeckId : null;
        var decksArr = typeof window.decks        !== 'undefined' ? window.decks        : null;
        if (!deckId || !decksArr) return;

        var deck = decksArr.find(function(d) { return d.id === deckId; });
        if (!deck || !deck.cards || !deck.cards[cardIndex]) return;

        deck.cards[cardIndex].starred = !deck.cards[cardIndex].starred;
        _dbSet('os_decks', decksArr);

        /* Re-render the card list to reflect the change */
        if (typeof window.renderCardList === 'function') {
            window.renderCardList();
        }
    };

    _wait(function() {
        if (typeof window.renderCardList !== 'function') return false;
        if (window._p58cardListHooked)   return true;
        window._p58cardListHooked = true;

        var _orig = window.renderCardList;

        window.renderCardList = function() {
            /* Run the upstream renderer (which may itself be a wrapper
               installed by script.js or patches54) */
            _orig.apply(this, arguments);

            /* Now add / ensure star toggle buttons are present on each row */
            var container = document.getElementById('cards-list-container');
            if (!container) return;

            var deckId   = typeof window.activeDeckId !== 'undefined' ? window.activeDeckId : null;
            var decksArr = typeof window.decks        !== 'undefined' ? window.decks        : null;
            if (!deckId || !decksArr) return;

            var deck = decksArr.find(function(d) { return d.id === deckId; });
            if (!deck || !deck.cards || deck.cards.length === 0) return;

            /* Each top-level child of the container corresponds to one card */
            var rows = container.children;
            deck.cards.forEach(function(card, i) {
                var row = rows[i];
                if (!row) return;

                /* Avoid double-injection */
                if (row.querySelector('.p58-card-star-btn')) return;

                /* Find the action-button group (opacity-0 group-hover row) */
                var actionsDiv = row.querySelector('.flex.gap-1');
                if (!actionsDiv) return;

                var starBtn = document.createElement('button');
                starBtn.type      = 'button';
                starBtn.className = 'p58-card-star-btn' + (card.starred ? ' starred' : '');
                starBtn.title     = card.starred ? 'Unstar card' : 'Star card';
                starBtn.innerHTML = '<i class="fa-' + (card.starred ? 'solid' : 'regular') + ' fa-star"></i>';
                starBtn.setAttribute('onclick', '_p58toggleCardStar(' + i + ')');

                /* Insert as first button in the actions group */
                actionsDiv.insertBefore(starBtn, actionsDiv.firstChild);
            });
        };

        return true;
    }, 150, 15000);

    console.log('[patches58] loaded — formula colour fix, flashcard star, whiteboard section removed');
}());
