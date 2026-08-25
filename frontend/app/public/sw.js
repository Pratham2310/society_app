/*
 * Grihive service worker — browser push for the web build (Vercel).
 *
 * The native app receives push through Expo; browsers can't, so this handles
 * the Web Push (VAPID) side. Kept dependency-free and framework-agnostic:
 * it is copied verbatim from public/ to the export root by `expo export -p web`.
 */

// Take over open tabs as soon as a new version is deployed, so a stale worker
// never keeps handling pushes after the routing map below changes.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Mirror of routeForNotification() in lib/push.ts — keep the two in step.
function routeFor(data) {
  const link = data && data.link;
  const screen = (link && link.screen) || (data && data.screen);
  if (!screen) return '/notifications';

  if (screen === 'elections') {
    const id = link && link.id;
    return id ? '/election-details?id=' + encodeURIComponent(id) : '/elections';
  }

  const map = {
    notices: '/notices',
    complaints: '/complaints',
    maintenance: '/maintenance',
    events: '/events',
    members: '/members',
    profile: '/profile',
    security: '/security',
    amenities: '/amenities',
    parking: '/parking',
    finance: '/finance',
  };
  return map[String(screen)] || '/notifications';
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Grihive', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Grihive';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    // Same type collapses onto one notification instead of stacking up.
    tag: (payload.data && payload.data.type) || 'general',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = routeFor(event.notification.data);

  // Focus an already-open Grihive tab and navigate it, rather than piling up
  // a new tab for every notification the resident taps.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(function () {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
