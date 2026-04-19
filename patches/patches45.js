/* ================================================================
   StudentOS — patches45.js
   1.  Profile FA icon — fix immediate rendering on page load.
       Wraps window.renderProfileDisplay so FA-icon profiles (stored
       with the __fa: prefix) render as an icon element instead of
       raw text, with no startup delay.
   2.  Mindmap double-click edit — debounce the single-click
       re-render so the dblclick event fires on a live DOM node.
   3.  Settings profile layout — ensure the collapsible profile
       sections injected by patches43 match the profile modal
       layout (padding, upload button, avatar sync for FA icons).
   ================================================================ */

(function _p45_init() {

    /* ── helpers ────────────────────────────────────────────── */
    function _p45dbG(key, fallback) {
        try {
            var v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch (_) { return fallback; }
    }

    function _p45safeIconClass(raw) {
        return (raw || '').replace(/[^a-zA-Z0-9\- ]/g, '');
    }

    function _p45waitFor(fn, interval, maxWait) {
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
       1.  FIX PROFILE FA-ICON RENDERING
           renderProfileDisplay() in script.js doesn't handle the
           __fa: prefix, so FA-icon profiles show as raw text until
           patches39's 800 ms timeout fires.
           Fix: wrap window.renderProfileDisplay so __fa: profiles are
           rendered immediately, then re-call it once on load.
       ================================================================ */

    _p45waitFor(function() {
        if (typeof window.renderProfileDisplay !== 'function') return false;
        if (window._p45profileFixed) return true;
        window._p45profileFixed = true;

        var _orig = window.renderProfileDisplay;

        window.renderProfileDisplay = function() {
            var profile = _p45dbG('os_profile', {});
            var emo     = typeof profile.emoji === 'string' ? profile.emoji : '';

            if (emo.indexOf('__fa:') === 0) {
                /* FA icon profile — render icon elements directly */
                var iconClass = _p45safeIconClass(emo.slice(5));
                var bg = profile.bg || profile.avatarBg || '#3b82f6';

                /* Sidebar profile button */
                var pd = document.getElementById('profile-display');
                if (pd) {
                    pd.innerHTML = '';
                    var span = document.createElement('span');
                    span.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;' +
                        'justify-content:center;border-radius:14px;background:' + bg + ';';
                    var icon1 = document.createElement('i');
                    icon1.className = iconClass + ' text-xl text-white';
                    icon1.setAttribute('aria-hidden', 'true');
                    span.appendChild(icon1);
                    pd.appendChild(span);
                }

                /* Profile modal avatar preview */
                var ap = document.getElementById('avatar-preview');
                if (ap) {
                    ap.innerHTML = '';
                    var icon2 = document.createElement('i');
                    icon2.className = iconClass + ' text-4xl text-white';
                    icon2.setAttribute('aria-hidden', 'true');
                    ap.appendChild(icon2);
                    ap.style.background = bg;
                    ap.style.fontSize   = '';
                }

                /* Settings avatar preview */
                var sap = document.getElementById('settings-avatar-preview');
                if (sap) {
                    sap.innerHTML = '';
                    var icon3 = document.createElement('i');
                    icon3.className = iconClass + ' text-3xl text-white';
                    icon3.setAttribute('aria-hidden', 'true');
                    sap.appendChild(icon3);
                    sap.style.background = bg;
                    sap.style.fontSize   = '';
                }
                return;
            }

            /* Not an FA icon — use the original renderer, then also
               mirror the result to the settings avatar */
            _orig.apply(this, arguments);

            /* Mirror updated emoji/image to settings avatar */
            var sap2 = document.getElementById('settings-avatar-preview');
            if (sap2) {
                if (profile.type === 'image' && profile.img) {
                    var imgSrc    = String(profile.img);
                    var safeData  = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/]+=*$/.test(imgSrc);
                    var safeHttps = imgSrc.indexOf('https://') === 0;
                    if (safeData || safeHttps) {
                        sap2.innerHTML = '';
                        var simg = document.createElement('img');
                        simg.src   = imgSrc;
                        simg.alt   = '';
                        simg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:16px;';
                        sap2.appendChild(simg);
                        sap2.style.background = '';
                        sap2.style.fontSize   = '';
                    }
                } else {
                    sap2.textContent      = profile.emoji || '🎓';
                    sap2.style.background = profile.bg || '#3b82f6';
                    sap2.style.fontSize   = '1.6rem';
                }
            }
        };

        /* Apply the fix immediately so the navbar icon is correct */
        window.renderProfileDisplay();
        return true;
    });

    /* ================================================================
       2.  MINDMAP DOUBLE-CLICK EDIT — DEBOUNCE CLICK RE-RENDER
           patches41 replaced wbMmRender and calls wbMmRender() on
           every single click, which destroys and rebuilds the SVG.
           The dblclick event therefore fires on a detached <g> and
           window._p32openEditNode is never called.
           Fix: wrap wbMmRender to produce a version where node clicks
           wait 220 ms before re-rendering, giving dblclick time to
           cancel the pending re-render and open the edit modal.
       ================================================================ */

    _p45waitFor(function() {
        if (typeof window.wbMmRender !== 'function') return false;
        if (window._p45mmFixed) return true;
        window._p45mmFixed = true;

        var _mmSave    = window.wbMmSave;
        var _mmAddNode = typeof window.wbMmAddNode === 'function' ? window.wbMmAddNode : null;

        /* Constants used inside wbMmRender */
        var DRAG_THRESHOLD   = 4;   /* px before a move is counted as a drag */
        var CLICK_DEBOUNCE   = 220; /* ms to wait before a single-click re-renders,
                                       giving dblclick time to cancel it */

        window.wbMmRender = function() {
            var svg = document.getElementById('wb-mindmap-svg');
            if (!svg) return;

            svg.innerHTML = '';

            /* Size SVG to container */
            var con = document.getElementById('wb-container');
            if (con && con.clientWidth > 0 && con.clientHeight > 0) {
                svg.setAttribute('width',  con.clientWidth);
                svg.setAttribute('height', con.clientHeight);
            }

            var nodes      = window.wbMindMapNodes || [];
            var edges      = window.wbMindMapEdges || [];
            var selectedId = window.wbMindMapSelected;

            /* Draw edges first */
            edges.forEach(function(edge) {
                var from = nodes.find(function(n) { return n.id === edge.from; });
                var to   = nodes.find(function(n) { return n.id === edge.to;   });
                if (!from || !to) return;
                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', from.x);
                line.setAttribute('y1', from.y);
                line.setAttribute('x2', to.x);
                line.setAttribute('y2', to.y);
                line.setAttribute('stroke', 'rgba(255,255,255,0.3)');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            });

            /* Draw nodes */
            nodes.forEach(function(node) {
                var isSelected = (node.id === selectedId);
                var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');
                g.style.cursor = 'pointer';

                var w    = Math.max(80, (node.text || '').length * 8 + 24);
                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x',            -(w / 2));
                rect.setAttribute('y',            '-18');
                rect.setAttribute('width',         w);
                rect.setAttribute('height',       '36');
                rect.setAttribute('rx',           '10');
                rect.setAttribute('fill',          node.color || '#3b82f6');
                rect.setAttribute('stroke',        isSelected ? '#fff' : 'none');
                rect.setAttribute('stroke-width',  isSelected ? '2' : '0');

                var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('text-anchor',      'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('fill',             '#fff');
                text.setAttribute('font-size',        '13');
                text.setAttribute('font-family',      'Inter, sans-serif');
                text.textContent = node.text || '';

                g.appendChild(rect);
                g.appendChild(text);

                /* ── Per-node event handling ──────────────────────── */
                (function(n) {
                    var _isDragging = false;
                    var _didMove    = false;
                    var _dsx = 0, _dsy = 0, _nsx = 0, _nsy = 0;

                    /* Debounce token: cancel single-click re-render when
                       dblclick fires on the same node. */
                    var _clickTimer = null;

                    g.addEventListener('pointerdown', function(e) {
                        e.stopPropagation();
                        _isDragging = true;
                        _didMove    = false;
                        _dsx = e.clientX; _dsy = e.clientY;
                        _nsx = n.x;       _nsy = n.y;
                        g.setPointerCapture(e.pointerId);
                    });

                    g.addEventListener('pointermove', function(e) {
                        if (!_isDragging) return;
                        var dx = e.clientX - _dsx;
                        var dy = e.clientY - _dsy;
                        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
                            _didMove = true;
                        }
                        n.x = _nsx + dx;
                        n.y = _nsy + dy;
                        g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
                        _updateEdges(svg, nodes, edges);
                    });

                    g.addEventListener('pointerup', function() {
                        if (_isDragging) {
                            _isDragging = false;
                            if (_didMove && _mmSave) _mmSave();
                        }
                    });

                    g.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (_didMove) { _didMove = false; return; }
                        /* Defer re-render by CLICK_DEBOUNCE ms so a following
                           dblclick can cancel it before the DOM is rebuilt. */
                        clearTimeout(_clickTimer);
                        var nid = n.id;
                        _clickTimer = setTimeout(function() {
                            window.wbMindMapSelected =
                                (window.wbMindMapSelected === nid) ? null : nid;
                            window.wbMmRender();
                        }, CLICK_DEBOUNCE);
                    });

                    g.addEventListener('dblclick', function(e) {
                        e.stopPropagation();
                        /* Cancel the pending single-click re-render so the
                           edit modal opens on the current DOM node. */
                        clearTimeout(_clickTimer);
                        if (typeof window._p32openEditNode === 'function') {
                            window._p32openEditNode(n.id);
                        }
                    });

                    g.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        clearTimeout(_clickTimer);
                        if (typeof window._p32showMmCtx === 'function') {
                            window._p32showMmCtx(n.id, e.clientX, e.clientY);
                        }
                    });
                })(node);

                svg.appendChild(g);
            });

            /* Click on empty SVG area to add a node */
            svg.onclick = function(e) {
                if (e.target === svg) {
                    var r = svg.getBoundingClientRect();
                    if (_mmAddNode) _mmAddNode(e.clientX - r.left, e.clientY - r.top);
                }
            };
        };

        /* Edge-position helper (unchanged from patches41) */
        function _updateEdges(svg, nodes, edges) {
            var lines    = svg.querySelectorAll('line');
            var lineIdx  = 0;
            edges.forEach(function(edge) {
                var from = nodes.find(function(n) { return n.id === edge.from; });
                var to   = nodes.find(function(n) { return n.id === edge.to;   });
                if (!from || !to) return;
                if (lineIdx < lines.length) {
                    lines[lineIdx].setAttribute('x1', from.x);
                    lines[lineIdx].setAttribute('y1', from.y);
                    lines[lineIdx].setAttribute('x2', to.x);
                    lines[lineIdx].setAttribute('y2', to.y);
                }
                lineIdx++;
            });
        }

        console.log('[patches45] mindmap render replaced — dblclick edit fixed');
        return true;
    });

    /* ================================================================
       3.  SETTINGS PROFILE — UPLOAD BUTTON + LAYOUT
           patches43 already injects collapsible emoji/icon sections
           into the settings modal, but the Upload Photo button is
           missing from that context and the avatar sync for FA icons
           relies on renderProfileDisplay being on window (now fixed).
           Here we ensure:
           a) An "Upload Photo" button appears below the sections.
           b) The settings avatar preview is synced when the settings
              modal opens (handles FA icons correctly).
       ================================================================ */

    /* a) Ensure Upload Photo button exists inside settings profile */
    _p45waitFor(function() {
        var wrapper = document.getElementById('p43-settings-profile-sections');
        if (!wrapper) return false;
        if (wrapper.querySelector('.p45-upload-btn')) return true;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p45-upload-btn';
        btn.innerHTML = '<i class="ph-bold ph-upload"></i> Upload Photo';
        btn.addEventListener('click', function() {
            var inp = document.getElementById('profile-img-input');
            if (inp) inp.click();
        });
        wrapper.appendChild(btn);
        return true;
    });

    /* b) Sync settings avatar on modal open */
    _p45waitFor(function() {
        if (typeof window.openModal !== 'function') return false;
        if (window._p45modalHooked) return true;
        window._p45modalHooked = true;

        var _prevOpen = window.openModal;
        window.openModal = function(id) {
            _prevOpen.apply(this, arguments);
            if (id === 'modal-settings') {
                /* Re-render so settings avatar picks up the current
                   profile state (including FA icons). */
                if (typeof window.renderProfileDisplay === 'function') {
                    window.renderProfileDisplay();
                }
            }
        };
        return true;
    });

})();

console.log('[patches45] loaded — profile FA icon, mindmap dblclick, settings profile');
