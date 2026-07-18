/*
 * Service worker — makes the app installable (PWA) and fast on repeat
 * visits. Strategy:
 *  - navigations: network first, cached shell as offline fallback
 *  - same-origin static assets (hashed js/css/img): cache first
 *  - everything else (Supabase, TRTC, websockets): untouched
 */
const CACHE = 'hypecall-v24';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return; // never intercept Supabase / TRTC / third parties
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          const hit = await cache.match(req, { ignoreSearch: true });
          return hit || Response.error();
        }
      })(),
    );
    return;
  }

  if (
    url.pathname.includes('/assets/')
    || /\.(js|css|png|jpg|svg|ico|webmanifest|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) {
          return hit;
        }
        const fresh = await fetch(req);
        if (fresh.ok) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      })(),
    );
  }
});

// ---------------------------------------------------------------------
// Web Push: rings an incoming call even when the app/tab is closed or
// backgrounded (see web/api/notify-call.ts, which sends the push, and
// src/data/push.ts, which registers this device to receive it).
// ---------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  if (data.type !== 'incoming-call' || !data.callId) {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(`${data.callerName || 'Alguien'} te está llamando`, {
      body: 'Videollamada entrante',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: `call-${data.callId}`,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300],
      data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'incoming-call', payload: data });
          return;
        }
      }
      const params = new URLSearchParams({ incomingCall: JSON.stringify(data) });
      await self.clients.openWindow(`./#/messages?${params.toString()}`);
    })(),
  );
});
