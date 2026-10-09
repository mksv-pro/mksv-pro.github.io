/* Offline: the site read without a network once it has been visited. Pages network first (the
   newest when online), their last copy when not; the site's own files from the cache at once and
   refreshed behind (stale-while-revalidate); the CV and the front page kept from the start. Other
   origins (the weather, the sky's data) are left to the network. Registered by assets/js/ui, on the
   real site only (not on a local port). */
const CACHE = 'mksv-v1';
const KEEP = ['./', 'index.html', 'assets/Mike_Silva_CV.pdf', 'styles.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(KEEP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') { // a page: the network, else its last copy, else the front page
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => { // a file: the copy now, a fresh one for next time
    const fresh = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  })));
});
