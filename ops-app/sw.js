// Service worker: lets the phone install the app, and shows task notifications.
// Pages always come fresh from the network (no offline cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

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
