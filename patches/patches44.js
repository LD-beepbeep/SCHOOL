/* ================================================================
   StudentOS — patches44.js
   1.  Worksheet picker deduplication — remove legacy p27/p28
       block-type sections whenever the unified p42 section is
       present so each block type only appears once.
   2.  "Custom Formula" rename — the Formula block type in the
       worksheet picker is labelled "Custom Formula", and the
       Formula Sheets view heading / nav tooltip are updated.
   3.  Deck overview hard & starred — always show both counts on
       every deck card (even when the counts are zero).
   4.  Notes per-letter font — preserve the editor selection when
       a toolbar font button is clicked so the font applies to the
       selected characters rather than the whole note.
   ================================================================ */

(function _p44_init() {

    /* ── tiny helpers ───────────────────────────────────────── */
    function _p44waitFor(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 6000;
        var elapsed = 0;
        var id = setInterval(function () {
            elapsed += interval;
            if (fn() || elapsed >= maxWait) clearInterval(id);
        }, interval);
    }

    /* ================================================================
       1.  WORKSHEET PICKER DEDUPLICATION
           patches27 adds #p27-picker-sec (6 block types)
           patches28 adds #p28-new-types-sec (2 block types)
           patches42 adds #p42-picker-sec (all 8 types unified)
           → whenever p42's section is in the sheet, remove the older
             partial sections so each type only appears once.
       ================================================================ */

    function _p44cleanPicker() {
        var sheet = document.getElementById('p19-ws-picker-sheet');
        if (!sheet) return false;

        /* Watch for future mutations (p28 injects at 240 ms) */
        if (!sheet._p44observed) {
            sheet._p44observed = true;
            var mo = new MutationObserver(function () {
                _p44removeLegacySections(sheet);
            });
            mo.observe(sheet, { childList: true, subtree: false });
        }

        _p44removeLegacySections(sheet);
        return true;
    }

    function _p44removeLegacySections(sheet) {
        if (!sheet.querySelector('#p42-picker-sec')) return;
        var legacy = ['#p27-picker-sec', '#p28-new-types-sec'];
        legacy.forEach(function (sel) {
            var el = sheet.querySelector(sel);
            if (el) el.remove();
        });
    }

    /* Patch p19_wbOpenPicker once it exists */
    _p44waitFor(function () {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p44pickerDone) return true;
        window._p44pickerDone = true;

        var _orig = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function () {
            _orig.apply(this, arguments);
            /* Run after all patch timeouts (longest is p28 at ~240 ms) */
            setTimeout(_p44cleanPicker, 350);
        };
        return true;
    });

    /* ================================================================
       2.  "CUSTOM FORMULA" RENAME
           a) Worksheet block-type button: patch _p42addBlock /
              p42-picker-sec to show "Custom Formula" instead of
              "Formula".
           b) Formula Sheets nav tooltip → "Custom Formula".
           c) Formula Sheets view h1 → "Custom Formula".
       ================================================================ */

    /* Rename the "Formula" button label inside the p42 picker section */
    function _p44renameFormulaBtn(sheet) {
        var sec = sheet && sheet.querySelector('#p42-picker-sec');
        if (!sec) return;
        sec.querySelectorAll('.p19-picker-type-btn').forEach(function (btn) {
            if (btn.textContent.trim() === 'Formula') {
                /* Keep the icon, replace just the text node */
                var icon = btn.querySelector('i');
                btn.textContent = 'Custom Formula';
                if (icon) btn.insertBefore(icon, btn.firstChild);
            }
        });
    }

    /* Also rename p27's button (in case p42 section hasn't loaded yet) */
    function _p44renameAllFormulaBtns() {
        document.querySelectorAll('.p19-picker-type-btn').forEach(function (btn) {
            if (btn.textContent.trim() === 'Formula') {
                var icon = btn.querySelector('i');
                btn.textContent = 'Custom Formula';
                if (icon) btn.insertBefore(icon, btn.firstChild);
            }
        });
    }

    /* Patch picker to rename on each open */
    _p44waitFor(function () {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p44formulaRenameDone) return true;
        window._p44formulaRenameDone = true;

        var _origPicker = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function () {
            _origPicker.apply(this, arguments);
            setTimeout(function () {
                var sheet = document.getElementById('p19-ws-picker-sheet');
                _p44renameFormulaBtn(sheet);
                _p44renameAllFormulaBtns();
            }, 360);
        };
        return true;
    });

    /* Nav tooltip */
    _p44waitFor(function () {
        var btn = document.getElementById('btn-formulas');
        if (!btn) return false;
        if (btn.dataset.tooltip !== 'Formulas') return true; /* already patched */
        btn.dataset.tooltip = 'Custom Formula';
        return true;
    });

    /* View h1 */
    _p44waitFor(function () {
        var view = document.getElementById('view-formulas');
        if (!view) return false;
        var h1 = view.querySelector('h1');
        if (!h1) return false;
        h1.innerHTML = 'Custom <span>Formula</span>';
        return true;
    });

    /* ================================================================
       3.  DECK OVERVIEW — ALWAYS SHOW HARD & STARRED COUNTS
           Patch window.deckCard so both counters always render,
           even when their values are zero.
       ================================================================ */

    _p44waitFor(function () {
        if (typeof window.deckCard !== 'function') return false;
        if (window._p44deckCardDone) return true;
        window._p44deckCardDone = true;

        window.deckCard = function (d) {
            var count        = (d.cards || []).length;
            var cardStats    = (typeof window.cardStats !== 'undefined') ? window.cardStats : {};
            var hardCount    = (d.cards || []).filter(function (c) {
                return (cardStats[d.id + '_' + c.id] || 0) > 0;
            }).length;
            var starredCount = (d.cards || []).filter(function (c) {
                return c.starred;
            }).length;

            var hardSpan    = '<span class="' + (hardCount    > 0 ? 'text-red-400'    : 'p44-muted') + '">'
                            + hardCount + ' hard</span>';
            var starSpan    = '<span class="' + (starredCount > 0 ? 'text-yellow-400' : 'p44-muted') + '">'
                            + '<i class="fa-solid fa-star" style="font-size:.55rem"></i> '
                            + starredCount + ' starred</span>';

            var deckName = d.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            return '<div class="min-card p-4 hover-effect cursor-pointer" onclick="openDeck(' + d.id + ')">'
                + '<div class="flex justify-between items-start mb-3">'
                + '<div class="text-2xl">' + (d.emoji || '📖') + '</div>'
                + '<button onclick="event.stopPropagation();deleteDeck(' + d.id + ')" class="text-[var(--text-muted)] hover:text-red-400 transition text-xs">\u00d7</button>'
                + '</div>'
                + '<h3 class="font-semibold text-sm mb-1 truncate">' + d.name + '</h3>'
                + '<div class="text-xs text-[var(--text-muted)]">'
                + count + ' card' + (count !== 1 ? 's' : '')
                + ' · ' + hardSpan
                + ' · ' + starSpan
                + '</div>'
                + '<button onclick="event.stopPropagation();p4OpenImport(' + d.id + ',\'' + deckName + '\')"'
                + ' style="margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;gap:5px;padding:5px 0;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:var(--text-muted);font-size:.68rem;font-weight:700;cursor:pointer;"'
                + ' onmouseenter="this.style.background=\'rgba(255,255,255,.1)\';this.style.color=\'var(--text-main)\'"'
                + ' onmouseleave="this.style.background=\'rgba(255,255,255,.05)\';this.style.color=\'var(--text-muted)\'">'
                + '<i class="fa-solid fa-file-import"></i> Import</button>'
                + '</div>';
        };

        /* Re-render decks immediately so the new format takes effect */
        if (typeof window.renderDecks === 'function') window.renderDecks();

        return true;
    });

    /* ================================================================
       4.  NOTES PER-LETTER FONT — PRESERVE SELECTION
           When a toolbar font button is clicked, the editor may lose
           focus (mousedown blur). Save the selection on mousedown so
           setNoteFont can restore and apply it to just the selected
           characters.
       ================================================================ */

    var _p44savedRange = null;

    /* Save selection when the editor loses focus */
    _p44waitFor(function () {
        var editor = document.getElementById('note-editor');
        if (!editor) return false;
        if (editor._p44blurWired) return true;
        editor._p44blurWired = true;

        editor.addEventListener('mouseup', function () {
            var sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                _p44savedRange = sel.getRangeAt(0).cloneRange();
            }
        });

        editor.addEventListener('keyup', function () {
            var sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                _p44savedRange = sel.getRangeAt(0).cloneRange();
            }
        });

        return true;
    });

    /* Patch setNoteFont to restore the saved range before applying */
    _p44waitFor(function () {
        if (typeof window.setNoteFont !== 'function') return false;
        if (window._p44fontDone) return true;
        window._p44fontDone = true;

        var _origSetFont = window.setNoteFont;
        window.setNoteFont = function (font, cls, silent) {
            var editor = document.getElementById('note-editor');

            /* If there is a saved non-collapsed range, restore it so the
               font applies to just the selected characters */
            if (!silent && _p44savedRange && editor && !_p44savedRange.collapsed) {
                try {
                    editor.focus();
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(_p44savedRange);
                } catch (e) { /* Range restoration can fail if DOM changed since save; fall through to original behaviour */ }
            }

            _origSetFont.apply(this, arguments);
        };

        return true;
    });

    console.log('[patches44] loaded — picker dedup, Custom Formula rename, deck stats, notes font fix');

}());
