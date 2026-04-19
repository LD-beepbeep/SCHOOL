/* ================================================================
   StudentOS — patches64.js
   Settings sync fixes:
   1.  Extend _p10syncSettingsValues to read short/long break
       durations from DB (not just localStorage) so the correct
       saved values are shown when the settings panel opens.
   2.  Fix grade scale, week start, exam warn, daily goal, and
       sessions-before-long-break displays to read from their
       localStorage keys (consistent with how they are saved).
   ================================================================ */

(function _p64_init() {
    'use strict';

    /* ── tiny helper — reads from DB or localStorage ─────────── */
    function _db(key, def) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.get === 'function')
                return DB.get(key, def);
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }

    function _ls(key, def) {
        try {
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }

    function _wait(fn, interval, maxWait) {
        interval = interval || 100;
        maxWait  = maxWait  || 20000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  Extend _p10syncSettingsValues
           Wraps the function (patched by p10 and p63) to also fix:
           • p10-pomo-short  — was reading from localStorage; now reads DB
           • p10-pomo-long   — same
           • p10-pomo-sessions, p10-daily-goal — localStorage (correct source)
           • p10-grade-scale, p10-week-start, p10-exam-warn — localStorage
       ================================================================ */
    _wait(function() {
        if (typeof window._p10syncSettingsValues !== 'function') return false;
        if (window._p64syncPatched) return true;
        window._p64syncPatched = true;

        var _orig = window._p10syncSettingsValues;
        window._p10syncSettingsValues = function() {
            _orig.apply(this, arguments);
            try {
                var times = _db('os_pomo_times', { focus: 25, short: 5, long: 15 });

                /* Short break */
                var ps = document.getElementById('p10-pomo-short');
                if (ps && times) ps.value = times.short || 5;

                /* Long break */
                var pl = document.getElementById('p10-pomo-long');
                if (pl && times) pl.value = times.long || 15;

                /* Sessions before long break */
                var pss = document.getElementById('p10-pomo-sessions');
                if (pss) pss.value = _ls('p9_pomo_sessions', 4);

                /* Daily goal */
                var dg = document.getElementById('p10-daily-goal');
                if (dg) dg.value = _ls('p9_daily_goal', 4);

                /* Grade scale */
                var gs = document.getElementById('p10-grade-scale');
                if (gs) gs.value = _ls('p9_grade_scale', 'pct');

                /* Week starts on */
                var ws = document.getElementById('p10-week-start');
                if (ws) ws.value = _ls('p9_week_start', 'mon');

                /* Exam warning days */
                var ew = document.getElementById('p10-exam-warn');
                if (ew) ew.value = _ls('p9_exam_warn_days', 14);

            } catch (e) { console.warn('[p64] settings sync error:', e); }
        };
        return true;
    }, 100, 15000);

    console.log('[patches64] loaded — settings sync fixes for short/long break and academic settings');
}());
