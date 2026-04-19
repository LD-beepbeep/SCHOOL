/* ================================================================
   StudentOS — Service Worker
   Handles: offline caching, push notifications, background sync
   ================================================================ */

const CACHE     = 'studentos-v10';
const ICON      = './icon.png';

/* Trusted CDN origins whose CORS responses we cache */
const TRUSTED_CDN = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ka-f.fontawesome.com',
  'unpkg.com'
];

/* Files to pre-cache on install */
const PRECACHE = [
  './styles.css',
  './mobile.css',
  './features.css',
  './forum.css',
  './script.js',
  './features.js',
  './forum.js',
  './patches/patches49.css',
  './patches/patches49.js',
  './icon.png'
];

/* ── Install: pre-cache shell ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all([
      /* Always fetch index.html fresh so stale HTTP caches don't hide new patches */
      fetch(new Request('./index.html', { cache: 'no-cache' }))
        .then(res => res.ok ? c.put(new URL('./index.html', self.location).href, res) : null),
      fetch(new Request('./', { cache: 'no-cache' }))
        .then(res => res.ok ? c.put(new URL('./', self.location).href, res) : null),
      c.addAll(PRECACHE)
    ])).then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first for assets, network-first for API ── */
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  /* Skip non-GET and cross-origin Firebase/API requests */
  if (request.method !== 'GET') return;
  if (url.hostname === 'firebaseio.com' || url.hostname.endsWith('.firebaseio.com'))   return;
  if (url.hostname === 'calendar.google.com') return;
  /* Allow fonts through, skip other googleapis/gstatic */
  if ((url.hostname.endsWith('.googleapis.com') || url.hostname === 'googleapis.com') &&
      url.hostname !== 'fonts.googleapis.com')   return;
  if ((url.hostname.endsWith('.gstatic.com') || url.hostname === 'gstatic.com') &&
      url.hostname !== 'fonts.gstatic.com')      return;

  /* Determine if this is a trusted CDN response (CORS) */
  const isTrustedCDN = TRUSTED_CDN.some(h => url.hostname === h || url.hostname.endsWith('.' + h));

  /* Network-first for HTML navigation so new patches are always picked up */
  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(cached => {
      /* Return cached instantly, then refresh in background */
      const fetchPromise = fetch(request)
        .then(res => {
          /* Cache same-origin (basic) and trusted CDN (cors) responses */
          if (res && res.status === 200 &&
              (res.type === 'basic' || (res.type === 'cors' && isTrustedCDN))) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});

/* ================================================================
   PUSH NOTIFICATIONS
   ================================================================ */

self.addEventListener('push', e => {
  let data = { title: 'StudentOS', body: 'You have a new reminder', tag: 'general' };

  if (e.data) {
    try { data = { ...data, ...e.data.json() }; }
    catch { data.body = e.data.text(); }
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    ICON,
      badge:   ICON,
      tag:     data.tag    || 'general',
      data:    data.url    ? { url: data.url } : {},
      vibrate: [200, 100, 200],
      actions: data.actions || [],
      silent:  false
    })
  );
});

/* Click notification — open or focus the app */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      /* If app is already open, focus it */
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (target !== '/') client.postMessage({ type: 'NAVIGATE', tab: target });
          return;
        }
      }
      /* Otherwise open fresh */
      return clients.openWindow(target);
    })
  );
});

/* ================================================================
   BACKGROUND SYNC — re-send failed saves when back online
   ================================================================ */

self.addEventListener('sync', e => {
  if (e.tag === 'sos-sync') {
    e.waitUntil(
      /* Post message to all open clients to retry saves */
      clients.matchAll({ type: 'window' }).then(list =>
        list.forEach(c => c.postMessage({ type: 'SYNC_RETRY' }))
      )
    );
  }
});

/* ================================================================
   LOCAL NOTIFICATION SCHEDULING
   Triggered by postMessage from the main thread
   Format: { type:'SCHEDULE', id, title, body, fireAt(ms timestamp) }
   ================================================================ */

const _scheduled = {};

self.addEventListener('message', e => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'SCHEDULE') {
    const delay = msg.fireAt - Date.now();
    if (delay <= 0) return;

    /* Clear any existing timer for same id */
    if (_scheduled[msg.id]) clearTimeout(_scheduled[msg.id]);

    _scheduled[msg.id] = setTimeout(() => {
      self.registration.showNotification(msg.title || 'StudentOS', {
        body:    msg.body  || 'Reminder',
        icon:    ICON,
        badge:   ICON,
        tag:     msg.id,
        vibrate: [200, 100, 200],
        data:    { url: msg.url || '/' }
      });
      delete _scheduled[msg.id];
    }, delay);
  }

  if (msg.type === 'CANCEL') {
    if (_scheduled[msg.id]) {
      clearTimeout(_scheduled[msg.id]);
      delete _scheduled[msg.id];
    }
  }
});
