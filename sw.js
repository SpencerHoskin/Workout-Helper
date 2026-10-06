// Offline support. Network-first for our own files (so a new deploy shows up on the next open),
// falling back to the cache when offline or when the gym Wi-Fi is too slow (2.5 s).
const CACHE = 'wh-shell';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/catalog.js', 'js/store.js', 'js/util.js', 'js/analytics.js', 'js/ui.js', 'js/charts.js',
  'js/scanner.js', 'js/health.js', 'js/coach.js', 'js/router.js', 'js/timer.js', 'js/theme.js', 'js/icons.js',
  'js/views/today.js', 'js/views/machines.js', 'js/views/scan.js', 'js/views/logger.js', 'js/views/progress.js', 'js/views/me.js',
  'vendor/jsQR.min.js', 'fonts/manrope-latin.woff2', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'
];
const TIMEOUT_MS = 2500;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  network.catch(() => {}); // a late failure after we've answered from cache is fine
  const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch { /* offline — fall through to cache */ }
  const hit = await cache.match(req, { ignoreSearch: true });
  return hit || network; // nothing cached yet: keep waiting on the network
}
