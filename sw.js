// Service worker: keeps a saved copy of the app on the phone.
//
// How updates work:
// - The app always opens from the saved copy (fast, works offline).
// - When a new version is on GitHub, it downloads quietly in the background
//   and waits. The app then shows "New version ready · Update / Later".
// - Nothing changes until someone taps Update.
//
// RELEASING A NEW VERSION: change VERSION (and NOTES) below. That change is
// what tells phones there is something new.
const VERSION = '1.6.1';
const NOTES = 'Fix: "client has already been terminated" when saving. The app now reconnects and saves automatically.';

const CACHE = `tour-app-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/data.js',
  './js/utils.js',
  './js/icons.js',
  './js/components.js',
  './js/updates.js',
  './js/firebase-config.js',
  './js/backend/firebase.js',
  './js/backend/shared.js',
  './js/views/today.js',
  './js/views/schedule.js',
  './js/views/day.js',
  './js/views/people.js',
  './js/views/later.js',
  './js/views/auth.js',
  './js/views/me.js',
  './js/views/band.js',
  './js/views/editor.js',
  './js/views/contacts.js',
  './js/views/docs.js',
  './js/views/export.js',
  './js/pdf/writer.js',
  './js/pdf/metrics.js',
  './js/pdf/guest.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  // Download a complete, fresh copy of the new version. It waits until the user taps Update.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tour-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'GET_VERSION' && event.ports[0]) event.ports[0].postMessage({ version: VERSION, notes: NOTES });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameOrigin && !isFont && !isSdk) return;

  // Opening the app (also with ?date=...): always the saved index.html of this version.
  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match('./index.html'))
        .then((hit) => hit || fetch(req))
    );
    return;
  }

  // Everything else: saved copy first; if it's not saved yet, get it and save it.
  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: sameOrigin }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      });
    }))
  );
});
