// ⚠️ Bump this on breaking changes (e.g. localStorage schema migration).
// Normal code updates no longer require a version bump — the SW uses a
// stale-while-revalidate strategy for HTML/JS, so users pull fresh code
// in the background on every visit.
const CACHE_NAME = 'airdrop-v3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// ── INSTALL: pre-cache shell ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: nuke old caches, take control immediately ──────
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ── FETCH: smart routing per request type ────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // Firebase SDK + CDN runtime calls: network-first, fallback cache
  // (We want latest Firebase JS + we NEVER want stale Firestore data)
  const isThirdParty =
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('tailwindcss') ||
    url.hostname.includes('fonts.');

  if (isThirdParty) {
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Own-origin assets: stale-while-revalidate
  // → Serve from cache instantly (fast) AND fetch fresh in background (auto-update)
  // → Next reload = user sees latest code, no manual CACHE_NAME bump needed
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const networkFetch = fetch(req).then(resp => {
      // Only cache OK same-origin responses
      if (resp && resp.status === 200 && resp.type === 'basic') {
        cache.put(req, resp.clone());
      }
      return resp;
    }).catch(() => null);

    // Cache hit → serve immediately, update cache in background
    // Cache miss → wait for network
    return cached || (await networkFetch) || new Response('Offline and not cached', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  })());
});

// ── MESSAGE: let the page trigger a skipWaiting if we expose an update UI later
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
