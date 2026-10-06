// Offline app shell. Bump VERSION whenever any cached file changes.
const VERSION = 'v1-2026-10-06';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/catalog.js', 'js/store.js', 'js/util.js', 'js/analytics.js', 'js/ui.js', 'js/charts.js',
  'js/scanner.js', 'js/health.js', 'js/coach.js', 'js/router.js', 'js/timer.js', 'js/theme.js',
  'js/views/today.js', 'js/views/machines.js', 'js/views/scan.js', 'js/views/logger.js', 'js/views/progress.js', 'js/views/me.js',
  'vendor/jsQR.min.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
