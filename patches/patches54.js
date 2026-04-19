/* ================================================================
   StudentOS — patches54.js
   1.  Whiteboard Mind Map — complete overhaul of wbMmRender:
       a.  Left-click drag-and-drop that correctly distinguishes a
           click from a drag (uses a _didDrag flag set only after
           ≥5 px of movement, checked in the click handler).
       b.  Double-click → open the "Edit Node" modal (patches32
           already provides window._p32openEditNode; falls back to
           an inline prompt if unavailable).
       c.  Right-click → context menu (patches32 provides
           window._p32showMmCtx; gracefully absent otherwise).
       d.  SVG background left-click adds a node, but NOT when the
           click is the tail of a drag.
   2.  Flashcard deck overview — add a fire icon to the "X hard"
       counter on deck tiles so it visually matches the starred
       indicator.
   3.  Flashcard card list — wrap renderCardList so that starred
       cards also show a gold ★ Starred badge alongside the
       existing Hard badge in the deck-editor card list.
   ================================================================ */

(function _p54_init() {
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
       1.  MIND MAP — COMPLETE RENDER OVERHAUL
       ================================================================ */

    /* Module-level flag: did ANY node drag occur during the last
       pointer-down/up cycle?  Checked by the SVG background click
       handler to prevent an accidental "add node" after a drag. */
    var _p54mmAnyDrag = false;

    function _p54buildMmRender() {
        /* wbMmRender must exist before we can replace it */
        if (typeof window.wbMmRender !== 'function') return false;
        if (window._p54mmRenderInstalled) return true;
        window._p54mmRenderInstalled = true;

        window.wbMmRender = function() {
            var svg = document.getElementById('wb-mindmap-svg');
            if (!svg) return;

            /* Clear canvas */
            svg.innerHTML = '';

            /* Size the SVG overlay */
            var con = document.getElementById('wb-container');
            if (con) {
                svg.setAttribute('width',  con.clientWidth);
                svg.setAttribute('height', con.clientHeight);
            }

            /* ── Draw edges ─────────────────────────────────── */
            (window.wbMindMapEdges || []).forEach(function(edge) {
                var from = (window.wbMindMapNodes || []).find(function(n) {
                    return n.id === edge.from;
                });
                var to = (window.wbMindMapNodes || []).find(function(n) {
                    return n.id === edge.to;
                });
                if (!from || !to) return;

                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
                line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
                line.setAttribute('stroke', 'rgba(255,255,255,0.3)');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            });

            /* ── Draw nodes ─────────────────────────────────── */
            (window.wbMindMapNodes || []).forEach(function(node) {
                var isSelected = (node.id === window.wbMindMapSelected);

                var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform',
                    'translate(' + node.x + ',' + node.y + ')');
                g.style.cursor = 'pointer';

                var w = Math.max(80, node.text.length * 8 + 20);

                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x',      -(w / 2));
                rect.setAttribute('y',      '-18');
                rect.setAttribute('width',  w);
                rect.setAttribute('height', '36');
                rect.setAttribute('rx',     '10');
                rect.setAttribute('fill',   node.color || '#3b82f6');
                rect.setAttribute('stroke', isSelected ? '#fff' : 'none');
                rect.setAttribute('stroke-width', isSelected ? '2' : '0');

                var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('text-anchor',       'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('fill',              '#fff');
                text.setAttribute('font-size',         '13');
                text.setAttribute('font-family',       'Inter, sans-serif');
                text.textContent = node.text;

                g.appendChild(rect);
                g.appendChild(text);

                /* ── Per-node interaction (IIFE for closure) ── */
                (function(n) {
                    var _isDown  = false;
                    var _didDrag = false;   /* true once ≥5 px moved */
                    var _dsx = 0, _dsy = 0;
                    var _nsx = 0, _nsy = 0;

                    /* Left-click drag ───────────────────────── */
                    g.addEventListener('pointerdown', function(e) {
                        if (e.button !== 0) return;   /* left button only */
                        e.stopPropagation();
                        _isDown  = true;
                        _didDrag = false;
                        _dsx = e.clientX; _dsy = e.clientY;
                        _nsx = n.x;       _nsy = n.y;
                        g.setPointerCapture(e.pointerId);
                    });

                    g.addEventListener('pointermove', function(e) {
                        if (!_isDown) return;
                        var dx = e.clientX - _dsx;
                        var dy = e.clientY - _dsy;
                        /* Only start dragging after a 5-px threshold so
                           small wobbles on click do not move the node. */
                        if (!_didDrag &&
                                (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                            _didDrag = true;
                            _p54mmAnyDrag = true;
                        }
                        if (_didDrag) {
                            n.x = _nsx + dx;
                            n.y = _nsy + dy;
                            window.wbMmRender();
                        }
                    });

                    g.addEventListener('pointerup', function() {
                        if (!_isDown) return;
                        _isDown = false;
                        /* Save if we actually moved the node */
                        if (_didDrag &&
                                typeof window.wbMmSave === 'function') {
                            window.wbMmSave();
                        }
                        /* NOTE: _didDrag is intentionally NOT reset here.
                           The 'click' event fires after 'pointerup'; it
                           reads _didDrag to suppress the accidental
                           select/deselect triggered by drag-end. */
                    });

                    /* Click → select / deselect (suppressed after drag) */
                    g.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (_didDrag) {
                            _didDrag = false;   /* reset for next interaction */
                            return;
                        }
                        window.wbMindMapSelected =
                            (window.wbMindMapSelected === n.id) ? null : n.id;
                        window.wbMmRender();
                    });

                    /* Double-click → edit node */
                    g.addEventListener('dblclick', function(e) {
                        e.stopPropagation();
                        if (typeof window._p32openEditNode === 'function') {
                            /* patches32 edit modal (has Edit + Delete) */
                            window._p32openEditNode(n.id);
                        } else {
                            /* Fallback inline prompt */
                            var newText = window.prompt('Edit node label:', n.text);
                            if (newText && newText.trim()) {
                                n.text = newText.trim();
                                if (typeof window.wbMmSave === 'function') {
                                    window.wbMmSave();
                                }
                                window.wbMmRender();
                            }
                        }
                    });

                    /* Right-click → context menu */
                    g.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window._p32showMmCtx === 'function') {
                            window._p32showMmCtx(n.id, e.clientX, e.clientY);
                        }
                    });
                })(node);

                svg.appendChild(g);
            });

            /* ── SVG background: click to add node ─────────── */
            /* Use a click handler instead of onclick= so we can share
               the _p54mmAnyDrag guard. */
            svg.onclick = function(e) {
                if (e.target !== svg) return;
                /* Suppress click that is the tail of a node drag */
                if (_p54mmAnyDrag) {
                    _p54mmAnyDrag = false;
                    return;
                }
                var r  = svg.getBoundingClientRect();
                var cx = e.clientX - r.left;
                var cy = e.clientY - r.top;
                if (typeof window.wbMmAddNode === 'function') {
                    window.wbMmAddNode(cx, cy);
                }
            };
        };

        return true;
    }

    _wait(_p54buildMmRender, 120, 14000);

    /* Re-apply after mindmap mode is toggled (wbMmLoad calls wbMmRender
       which may have been overwritten again by re-initialisation). */
    _wait(function() {
        if (typeof window.wbToggleMindMap !== 'function') return false;
        if (window._p54mmToggleHooked) return true;
        window._p54mmToggleHooked = true;

        var _orig = window.wbToggleMindMap;
        window.wbToggleMindMap = function() {
            _orig.apply(this, arguments);
            /* Ensure our improved renderer is still in place */
            window._p54mmRenderInstalled = false;
            _p54buildMmRender();
        };
        return true;
    }, 150, 14000);

    /* ================================================================
       2.  FLASHCARD DECK OVERVIEW — ADD FIRE ICON TO HARD COUNT
           deckCard() already outputs "X hard" text; replace
           renderDecks so that the hard counter shows a fire icon
           matching the star icon used for the starred counter.
           We re-wrap deckCard via renderDecks so the change is
           self-contained.
       ================================================================ */
    _wait(function() {
        if (typeof window.deckCard !== 'function') return false;
        if (window._p54deckCardHooked) return true;
        window._p54deckCardHooked = true;

        var _origDeckCard = window.deckCard;
        window.deckCard = function(d) {
            var html = _origDeckCard.apply(this, arguments);
            /* Replace the plain "X hard" text with an icon-labelled span
               that mirrors the starred indicator style. */
            html = html.replace(
                /(<span class="text-red-400">)(\d+ hard)(<\/span>)/g,
                '$1<i class="fa-solid fa-fire" style="font-size:.55rem;margin-right:2px;"></i>$2$3'
            );
            return html;
        };
        return true;
    }, 150, 12000);

    /* ================================================================
       3.  FLASHCARD CARD LIST — ADD STARRED BADGE ON INDIVIDUAL CARDS
           renderCardList already shows a "Hard" badge; wrap it to
           also inject a gold "Starred" badge for starred cards.
       ================================================================ */
    _wait(function() {
        if (typeof window.renderCardList !== 'function') return false;
        if (window._p54cardListHooked) return true;
        window._p54cardListHooked = true;

        var _origRenderCardList = window.renderCardList;

        window.renderCardList = function() {
            /* Run original renderer */
            _origRenderCardList.apply(this, arguments);

            /* Inject starred badges */
            var container = document.getElementById('cards-list-container');
            if (!container) return;

            /* Resolve deck + cards */
            var decks = typeof window.decks !== 'undefined'
                ? window.decks
                : (typeof DB !== 'undefined'
                    ? DB.get('os_decks', [])
                    : []);
            var deckId = typeof window.activeDeckId !== 'undefined'
                ? window.activeDeckId : null;
            var deck = deckId
                ? decks.find(function(d) { return d.id === deckId; })
                : null;
            if (!deck || !deck.cards || deck.cards.length === 0) return;

            /* Match rendered rows to card data by index */
            var rows = container.querySelectorAll(
                '.flex.items-center.justify-between');
            deck.cards.forEach(function(card, i) {
                var row = rows[i];
                if (!row || !card.starred) return;
                /* Find the badge / question-label row */
                var badgeRow = row.querySelector('.flex.items-center.gap-2');
                if (!badgeRow) return;
                /* Avoid duplicate injection */
                if (badgeRow.querySelector('.card-diff-badge.starred')) return;
                var span = document.createElement('span');
                span.className = 'card-diff-badge starred';
                span.innerHTML =
                    '<i class="fa-solid fa-star" style="font-size:.55rem"></i>'
                    + ' Starred';
                badgeRow.appendChild(span);
            });
        };

        return true;
    }, 150, 12000);

    console.log('[patches54] loaded — mindmap overhaul, formula colour fix, flashcard indicators');
}());
