const CACHE = 'elm-v7';

// The 11 libraries + pdf.js's worker are vendored locally under vendor/ now
// (see index.html's script tags), not loaded from CDN. Cache key bumped
// again for js/lib/pathUtils.js's addition (pure logic extracted for unit
// testing, still loaded via <script src> at runtime) — same reason as
// every prior bump: a returning tab must not keep an old precache list
// that doesn't know about a newly-added file. Found by an offline-reload
// e2e test actually failing with "titleKey is not defined" — this file
// wasn't reachable offline until this bump, exactly the bug this whole
// cache scheme exists to prevent.
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './icon-maskable.png',
  './js/lib/pathUtils.js',
  './vendor/idb.umd.js',
  './vendor/marked.min.js',
  './vendor/highlight.min.js',
  './vendor/purify.min.js',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './vendor/mammoth.browser.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/js-yaml.min.js',
  './vendor/minisearch.min.js',
  './vendor/vis-network.min.js',
  './vendor/fflate.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(new Request(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' }))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App-shell files (the HTML/JS/CSS this project actually edits) are
// network-first: try the real network every time, fall back to cache only
// when offline. Cache-first here was the bug — once index.html was cached
// under a given CACHE key, it served that ONE frozen snapshot forever,
// silently ignoring every subsequent edit until the key changed. A
// returning tab could sit on code from days ago with zero indication.
// Pinned CDN vendor libs stay cache-first below — they're exact-version
// URLs that never change in place, so cache-first there is correct and
// fast, not stale. icon.png belongs here too, not in the cache-first
// bucket below — it's a local asset the user edits directly (already
// happened twice), not an immutable pinned URL; cache-first would repeat
// the exact staleness bug this comment describes, just for the icon
// instead of the HTML. js/lib/pathUtils.js is the same category as
// index.html itself — project code that gets edited, not a pinned vendor
// file — so it belongs here too, not in the cache-first vendor bucket.
const APP_SHELL = new Set(['./', './index.html', './manifest.json', './sw.js', './icon.png', './js/lib/pathUtils.js']);

function isAppShellRequest(url) {
  // Preserve the full relative path, not just the basename — a basename-only
  // comparison (previously `pathname.replace(/^.*\//, './')`, which discards
  // everything through the last slash) only ever "worked" because every
  // app-shell file so far happened to sit at the vault root with no
  // subdirectory. It silently breaks the moment one doesn't (found by
  // js/lib/pathUtils.js needing this same network-first treatment), and it
  // would just as silently collide two different-directory files that
  // happen to share a filename.
  const path = url.pathname === '/' ? './' : '.' + url.pathname;
  return APP_SHELL.has(path) || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);
  const isAppShell = event.request.mode === 'navigate' || isAppShellRequest(url);

  if (isAppShell) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(cached =>
        cached || new Response('Offline and not cached yet', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      ))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request, { mode: 'cors' }).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') return response;
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(event.request, clone));
        return response;
      }).catch(() =>
        new Response('Resource unavailable offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        })
      );
    })
  );
});
