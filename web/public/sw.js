/*
 * Service worker — makes the app installable (PWA) and fast on repeat
 * visits. Strategy:
 *  - navigations: network first, cached shell as offline fallback
 *  - same-origin static assets (hashed js/css/img): cache first
 *  - everything else (Supabase, TRTC, websockets): untouched
 */
const CACHE = 'hypecall-v62';

// Precache the ENTIRE app (shell + every hashed route chunk) at install so
// it runs fully offline, not just the pages visited while online. The list
// is generated at build time (vite precacheManifest plugin →
// precache-manifest.json). Each URL is fetched independently so one bad
// asset can't abort the whole install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('./precache-manifest.json', { cache: 'no-cache' });
        if (res.ok) {
          const { urls } = await res.json();
          const cache = await caches.open(CACHE);
          await Promise.allSettled(
            (urls || []).map(async (url) => {
              try {
                const r = await fetch(url, { cache: 'no-cache' });
                if (r.ok) {
                  await cache.put(url, r.clone());
                }
              } catch {
                // single asset failed — keep going
              }
            }),
          );
        }
      } catch {
        // manifest unavailable (dev, offline) — fall back to lazy caching
      }
      await self.skipWaiting();
    })(),
  );
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
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          // Offline: serve the cached app shell. Hash routing means every
          // route IS index.html, so any of these satisfies the navigation.
          const hit =
            (await cache.match(req, { ignoreSearch: true }))
            || (await cache.match('./index.html'))
            || (await cache.match('./'))
            || (await cache.match('index.html'));
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

  // Native-look defaults for every notification:
  //  - badge: monochrome white-on-transparent glyph, which Android shows in
  //    the status bar like any native app (the colored logo rendered as a
  //    generic gray dot there)
  //  - timestamp: shows "hace X min" like native notifications
  const NATIVE = {
    badge: './icons/badge-96.png',
    timestamp: Date.now(),
  };

  // Incoming call — rings, stays up until answered.
  if (data.type === 'incoming-call' && data.callId) {
    event.waitUntil(
      self.registration.showNotification(`${data.callerName || 'Alguien'} te está llamando`, {
        ...NATIVE,
        body: 'Videollamada entrante',
        icon: data.callerAvatar || './icons/icon-192.png',
        tag: `call-${data.callId}`,
        requireInteraction: true,
        vibrate: [300, 150, 300, 150, 300],
        actions: [
          { action: 'open', title: '📞 Contestar' },
          { action: 'reject', title: '✖️ Rechazar' },
        ],
        data,
      }),
    );
    return;
  }

  // New direct message — native chat-style notification.
  if (data.type === 'new-message' && data.senderId) {
    event.waitUntil(
      self.registration.showNotification(data.senderName || 'Nuevo mensaje', {
        ...NATIVE,
        body: data.preview || 'Te envió un mensaje',
        icon: data.senderAvatar || './icons/icon-192.png',
        // One notification per conversation; a newer message replaces the
        // previous one and re-alerts (renotify) instead of stacking.
        tag: `msg-${data.senderId}`,
        renotify: true,
        vibrate: [120, 60, 120],
        actions: [{ action: 'open', title: '💬 Abrir chat' }],
        data,
      }),
    );
    return;
  }

  // New comment on your reel/photo.
  if (data.type === 'new-comment') {
    event.waitUntil(
      self.registration.showNotification(`${data.senderName || 'Alguien'} comentó tu publicación`, {
        ...NATIVE,
        body: data.preview || '',
        icon: data.senderAvatar || './icons/icon-192.png',
        tag: `comment-${data.photoId || 'x'}`,
        renotify: true,
        vibrate: [80, 40, 80],
        actions: [{ action: 'open', title: '🎬 Ver publicación' }],
        data,
      }),
    );
    return;
  }

  // A followed creator went live.
  if (data.type === 'live-started' && data.streamerId) {
    event.waitUntil(
      self.registration.showNotification(`${data.streamerName || 'Alguien'} está en vivo 🔴`, {
        ...NATIVE,
        body: 'Toca para entrar a la transmisión',
        icon: data.streamerAvatar || './icons/icon-192.png',
        tag: `live-${data.streamerId}`,
        renotify: true,
        vibrate: [100, 50, 100],
        actions: [{ action: 'open', title: '🔴 Entrar al live' }],
        data,
      }),
    );
    return;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  // "Rechazar" on an incoming call: just dismiss the notification without
  // opening the app (the caller's side times out on its own).
  if (event.action === 'reject') {
    return;
  }

  // Message tap: focus an open tab (and tell it to open the thread) or
  // cold-open the app straight into that conversation.
  if (data.type === 'new-message') {
    event.waitUntil(
      (async () => {
        const target = `./#/messages?user=${data.senderId}`;
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          if ('focus' in client) {
            await client.focus();
            client.postMessage({ type: 'open-thread', senderId: data.senderId });
            return;
          }
        }
        await self.clients.openWindow(target);
      })(),
    );
    return;
  }

  // Comment tap → open that reel. Live tap → open the live list.
  if (data.type === 'new-comment' || data.type === 'live-started') {
    const target =
      data.type === 'new-comment' && data.photoId
        ? `./#/reels?r=${data.photoId}`
        : './#/live-list';
    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          if ('focus' in client) {
            await client.focus();
            client.navigate(target).catch(() => {});
            return;
          }
        }
        await self.clients.openWindow(target);
      })(),
    );
    return;
  }

  // Call tap: focus + restore the ring overlay, or cold-open with the payload.
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
