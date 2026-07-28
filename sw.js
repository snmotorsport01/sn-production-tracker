/* SN ERP — Service Worker
   Strategy:
   - App shell (same-origin HTML/SVG/PNG/JSON): stale-while-revalidate → instant loads + offline, updates land next visit.
   - CDN libraries (cdnjs, versioned/immutable): cache-first → heavy libs load once, then from cache.
   - Apps Script API (script.google.com): network-first with cache fallback → always fresh when online, still works offline.
   Only GET requests are cached; POST (auth, uploads, mutations) always hits the network.
   Bump VERSION to force a refresh of all cached assets. */
var VERSION = 'v5';
var SHELL   = 'sn-shell-' + VERSION;
var RUNTIME = 'sn-runtime-' + VERSION;

var SHELL_ASSETS = [
  './',
  'index.html', 'hub.html', 'production.html', 'inventory.html',
  'finance.html', 'cost.html', 'qr.html', 'report.html',
  'admin.html', 'login.html',
  'logo.svg', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (cache) {
      // allSettled so a single missing asset never breaks the install
      return Promise.allSettled(SHELL_ASSETS.map(function (u) { return cache.add(u); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== RUNTIME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var network = fetch(req).then(function (resp) {
        if (resp && resp.status === 200) cache.put(req, resp.clone());
        return resp;
      }).catch(function () { return cached; });
      return cached || network;
    });
  });
}

function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        if (resp && (resp.status === 200 || resp.type === 'opaque')) cache.put(req, resp.clone());
        return resp;
      });
    });
  });
}

function networkFirst(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return fetch(req).then(function (resp) {
      if (resp && resp.status === 200) cache.put(req, resp.clone());
      return resp;
    }).catch(function () {
      return cache.match(req);
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // never cache mutations

  var url = new URL(req.url);

  // Apps Script backend: fresh-first, cache as offline fallback
  if (url.hostname === 'script.google.com') {
    e.respondWith(networkFirst(req, RUNTIME));
    return;
  }

  // CDN libraries: cache-first (versioned URLs are immutable)
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(cacheFirst(req, RUNTIME));
    return;
  }

  // Same-origin app shell & assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }
  // everything else: default network
});
