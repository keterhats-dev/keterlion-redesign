// Service worker: lets the phone install the app, opens it fast, and shows task notifications.
// App files and libraries are served from a copy on the device at once, and refreshed in the
// background, so a new version shows on the next open. Data (Supabase) and server functions
// always go to the network.
const VERSION = 'kl-ops-v3';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/data.js', 'js/util.js', 'js/config.js', 'icon.svg', 'manifest.webmanifest'];
const CDN = ['unpkg.com', 'cdn.jsdelivr.net', 'esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  if (own && (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/cal/'))) return;
  if (!own && !CDN.includes(url.hostname)) return; // Supabase and everything else: straight to the network

  // Stale-while-revalidate: answer from the copy, refresh the copy in the background
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const fresh = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) { e.waitUntil(fresh); return cached; }
    return fresh;
  })());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'כתרליון · משימות', {
    body: d.body || '', tag: d.tag, renotify: true, dir: 'rtl', lang: 'he',
    icon: 'icon.svg', badge: 'icon.svg', data: { url: d.url || './' },
  }));
});

// Tapping the notification opens the task, so the person can tap "קיבלתי"
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const win = list.find((c) => c.url.startsWith(self.registration.scope));
    if (win) return win.navigate(url).then((c) => (c || win).focus());
    return self.clients.openWindow(url);
  }));
});
