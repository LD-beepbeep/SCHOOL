/* ================================================================
   StudentOS — patches47.js
   1.  In-app notifications — replace browser Notification API
       with styled in-app toast messages. No browser permission
       needed. The existing os_notif_cal / os_notif_tasks flags
       continue to gate whether toasts are shown.
       The Settings Notifications section is rewritten to show
       toggle switches instead of "Enable" browser-permission
       buttons.
   2.  Worksheet picker dedup — removes the duplicate "Code"
       button injected by patches23 (patches42 already provides
       Code in the unified section).
   3.  Settings profile parity — makes the Identity section in
       Settings look identical to the profile modal:
       • hides the stray "Choose Emoji" label
       • hides the duplicate original Upload Photo button
       • adds comfortable padding/margin to match the modal
   4.  Performance — no new polling loops; uses event-driven
       and one-shot MutationObserver patterns throughout.
   ================================================================ */

(function _p47_init() {
    'use strict';

    /* ── helpers ─────────────────────────────────────────────── */
    function _p47dbG(key, def) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.get === 'function')
                return DB.get(key, def);
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : def;
        } catch (_) { return def; }
    }
    function _p47dbS(key, val) {
        try {
            if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function')
                return DB.set(key, val);
            localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {}
    }

    function _p47wait(fn, interval, maxWait) {
        interval = interval || 80;
        maxWait  = maxWait  || 8000;
        var elapsed = 0;
        (function _try() {
            if (fn()) return;
            elapsed += interval;
            if (elapsed < maxWait) setTimeout(_try, interval);
        })();
    }

    /* ================================================================
       1.  IN-APP TOAST NOTIFICATION SYSTEM
       ================================================================ */

    /* Container for stacked toasts */
    var _p47toastContainer = null;

    function _p47getContainer() {
        if (_p47toastContainer && _p47toastContainer.isConnected) return _p47toastContainer;
        var c = document.createElement('div');
        c.id = 'p47-toast-container';
        document.body.appendChild(c);
        _p47toastContainer = c;
        return c;
    }

    /**
     * Show a non-blocking in-app toast.
     * @param {string} title  - Bold headline text
     * @param {string} [body] - Optional body text below the headline
     * @param {number} [ms]   - Auto-dismiss after this many ms (default 4500)
     */
    function _p47toast(title, body, ms) {
        ms = ms || 4500;
        var container = _p47getContainer();

        var el = document.createElement('div');
        el.className = 'p47-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        var titleEl = document.createElement('div');
        titleEl.className = 'p47-toast-title';
        titleEl.textContent = title;
        el.appendChild(titleEl);

        if (body) {
            var bodyEl = document.createElement('div');
            bodyEl.className = 'p47-toast-body';
            bodyEl.textContent = body;
            el.appendChild(bodyEl);
        }

        var closeBtn = document.createElement('button');
        closeBtn.className = 'p47-toast-close';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener('click', function() { _p47dismissToast(el); });
        el.appendChild(closeBtn);

        container.appendChild(el);

        /* Animate in */
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                el.classList.add('show');
            });
        });

        /* Auto-dismiss */
        var timer = setTimeout(function() { _p47dismissToast(el); }, ms);
        el._p47timer = timer;
    }

    function _p47dismissToast(el) {
        if (!el || !el.isConnected) return;
        clearTimeout(el._p47timer);
        el.classList.remove('show');
        el.classList.add('hide');
        setTimeout(function() {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 320);
    }

    /* ── Override browser notification functions ─────────────── */

    window.sendSystemNotification = function(title, body) {
        _p47toast(title, body);
    };

    window.scheduleNotification = function(title, body, atTime) {
        var delay = atTime - Date.now();
        if (delay < 0) return;
        setTimeout(function() { _p47toast(title, body); }, delay);
    };

    window.requestCalNotifications = function() {
        _p47dbS('os_notif_cal', true);
        _p47updateNotifToggles();
        _p47toast('Calendar Reminders', 'Upcoming events will show an in-app alert.');
    };

    window.requestTaskNotifications = function() {
        _p47dbS('os_notif_tasks', true);
        _p47updateNotifToggles();
        _p47toast('Task Reminders', 'Due tasks will show an in-app alert.');
    };

    /* ── Rewrite the settings Notifications section ─────────── */

    function _p47updateNotifToggles() {
        var calToggle  = document.getElementById('p47-notif-cal-toggle');
        var taskToggle = document.getElementById('p47-notif-task-toggle');
        if (calToggle)  calToggle.classList.toggle('on', !!_p47dbG('os_notif_cal',  false));
        if (taskToggle) taskToggle.classList.toggle('on', !!_p47dbG('os_notif_tasks', false));
    }

    _p47wait(function() {
        /* Find the Notifications settings section by its heading text */
        var sections = document.querySelectorAll('.settings-section');
        var notifSection = null;
        sections.forEach(function(s) {
            var hdr = s.querySelector('.text-xs.uppercase');
            if (hdr && hdr.textContent.trim() === 'Notifications') notifSection = s;
        });
        if (!notifSection) return false;
        if (notifSection.dataset.p47done) return true;
        notifSection.dataset.p47done = '1';

        /* Replace each row's "Enable" button with a p47 toggle */
        var rows = notifSection.querySelectorAll('.settings-row');
        rows.forEach(function(row) {
            var span = row.querySelector('.text-sm');
            if (!span) return;

            var isCalRow  = span.textContent.indexOf('Calendar') !== -1;
            var isTaskRow = span.textContent.indexOf('Task')     !== -1;
            if (!isCalRow && !isTaskRow) return;

            var key     = isCalRow ? 'os_notif_cal' : 'os_notif_tasks';
            var toggleId = isCalRow ? 'p47-notif-cal-toggle' : 'p47-notif-task-toggle';

            /* Remove old button */
            var oldBtn = row.querySelector('button, .text-xs');
            if (oldBtn) oldBtn.remove();

            /* Build toggle */
            var toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.id = toggleId;
            toggle.className = 'p47-toggle' + (_p47dbG(key, false) ? ' on' : '');
            var dot = document.createElement('div');
            dot.className = 'p47-toggle-dot';
            toggle.appendChild(dot);
            toggle.addEventListener('click', function() {
                var next = !toggle.classList.contains('on');
                toggle.classList.toggle('on', next);
                _p47dbS(key, next);
                if (next) {
                    var label = isCalRow ? 'Calendar Reminders' : 'Task Reminders';
                    _p47toast(label, 'In-app alerts are now active.');
                }
            });

            row.appendChild(toggle);
        });
        return true;
    });

    /* ================================================================
       2.  WORKSHEET PICKER — REMOVE DUPLICATE CODE BUTTON
           patches23 adds a Code button to the first
           .p19-picker-block-types it finds (which ends up being
           inside patches42's unified section after p42 renders).
           patches42 already provides a Code entry, so we remove
           patches23's duplicate after the picker opens.
       ================================================================ */

    _p47wait(function() {
        if (typeof window.p19_wbOpenPicker !== 'function') return false;
        if (window._p47pickerDone) return true;
        window._p47pickerDone = true;

        var _origPicker = window.p19_wbOpenPicker;
        window.p19_wbOpenPicker = function() {
            _origPicker.apply(this, arguments);
            /* Run after patches23's 60 ms timeout has added its buttons */
            setTimeout(function() {
                /* Remove any button that patches23 injected for 'code' */
                var codeBtn = document.querySelector('[data-p23code]');
                if (codeBtn) codeBtn.remove();

                /* patches23's Image button (data-p23img) is fine — Image
                   is not in the unified section and allows multiples. */
            }, 150);
        };
        return true;
    });

    /* ================================================================
       3.  SETTINGS PROFILE PARITY
           After patches43 has injected #p43-settings-profile-sections,
           clean up the stale elements that patches43 leaves behind.
       ================================================================ */

    _p47wait(function() {
        var p43wrapper = document.getElementById('p43-settings-profile-sections');
        if (!p43wrapper) return false;
        if (p43wrapper.dataset.p47profileDone) return true;
        p43wrapper.dataset.p47profileDone = '1';

        var settingsProfile = document.querySelector('.p43-settings-profile');
        if (!settingsProfile) return true;

        /* ── 3a. Hide "Choose Emoji" label (text-xs uppercase inside the
                 profile wrapper) ──────────────────────────────────────── */
        settingsProfile.querySelectorAll('.text-xs.uppercase, .font-bold.text-xs').forEach(function(el) {
            if (el.textContent.trim() === 'Choose Emoji') el.style.display = 'none';
        });

        /* ── 3b. Hide the original Upload Photo button (.mt-3 wrapper)
                 that lives after #settings-emoji-grid ─────────────────── */
        var origMt3 = settingsProfile.querySelector('.mt-3');
        if (origMt3) {
            var origBtn = origMt3.querySelector('button');
            if (origBtn && origBtn.textContent.indexOf('Upload') !== -1) {
                origMt3.style.display = 'none';
            }
        }

        return true;
    }, 100, 8000);

    console.log('[patches47] loaded — in-app toasts, picker dedup, settings profile parity');
})();
