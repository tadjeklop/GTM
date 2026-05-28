// Service worker za Podjetniški OS — app shell + CDN cache
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
];

const RUNTIME_HOSTS = [
  'unpkg.com',
  'rsms.me',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // App shell: network-first for HTML; cache-first for assets
  if (url.origin === self.location.origin) {
    if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
      e.respondWith(
        fetch(e.request).then(r => {
          const copy = r.clone();
          caches.open(SHELL_CACHE).then(c => c.put(e.request, copy));
          return r;
        }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
      );
      return;
    }
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(e.request, copy));
        return r;
      }))
    );
    return;
  }

  // Runtime cache for known CDNs
  if (RUNTIME_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => {
        if (r.ok || r.type === 'opaque') {
          const copy = r.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(e.request, copy));
        }
        return r;
      }).catch(() => caches.match(e.request)))
    );
  }
});
