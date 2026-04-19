// Nexpura Service Worker - PWA & Offline Support
const CACHE_VERSION = 'v6';
const STATIC_CACHE = `nexpura-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `nexpura-dynamic-${CACHE_VERSION}`;
// Hot-route RSC prefetch cache — 15-second TTL, per-user via Vary: cookie
// (middleware augments Vary on these responses; Cache API's match() honors
// Vary, so different cookies get different cache entries).
const RSC_PREFETCH_CACHE = `nexpura-rsc-prefetch-${CACHE_VERSION}`;
const RSC_PREFETCH_TTL_MS = 15 * 1000;
const OFFLINE_QUEUE_KEY = 'nexpura-offline-queue';

// Assets to cache immediately on install — critical for app shell
// Only cache truly public, auth-free assets.
// Protected routes (dashboard, pos, inventory, etc.) must NEVER be pre-cached
// because caching them while unauthenticated stores the login-redirect response,
// causing ERR_FAILED for logged-in users on every navigation.
const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
];

// Static assets to cache for long-term (fonts, icons)
const STATIC_LONG_TERM = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes to cache with network-first strategy
const CACHEABLE_API_PATTERNS = [
  /\/api\/inventory/,
  /\/api\/customers/,
  /\/api\/settings/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('/api/')));
      }),
      caches.open(STATIC_CACHE).then((cache) => {
        // Cache long-term static assets (don't fail install if these fail)
        return Promise.allSettled(STATIC_LONG_TERM.map(url => cache.add(url)));
      }),
    ]).catch(err => {
      console.warn('[SW] Some assets failed to cache:', err);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches + enable navigation preload.
//
// navigation-preload tells the browser to START the network fetch for
// navigation requests IN PARALLEL with the SW's fetch-handler boot
// (~20-50ms saved per nav on Chromium). Without it, every authenticated
// navigation pays the SW-boot penalty on top of server TTFB. With it,
// the fetch is already in flight by the time our handler runs.
//
// Chromium: supported and defaults off.
// Firefox: supported behind a flag.
// Safari: partial support.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== DYNAMIC_CACHE &&
                key !== RSC_PREFETCH_CACHE
            )
            .map((key) => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
        )
      ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable().catch(() => {})
        : Promise.resolve(),
    ])
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation requests: always fetch from network so the auth middleware
  // runs server-side on every page visit. Serving HTML from cache causes
  // stale auth state, ERR_FAILED, or showing the wrong page after login/logout.
  //
  // navigation-preload optimisation: when the activate handler has enabled
  // preload, event.preloadResponse is an already-in-flight fetch started
  // by the browser the moment it handed the request to our SW. Using it
  // saves the SW-boot overhead (~20-50ms) on every nav.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(request);
        } catch {
          const offline = await caches.match('/offline');
          return offline || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // Skip non-GET requests for caching (but handle POST for offline queue)
  if (request.method !== 'GET') {
    // Check if this is a POS sale that should be queued offline
    if (request.method === 'POST' && url.pathname.includes('/api/pos/')) {
      event.respondWith(handleOfflinePost(request));
    }
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip cross-origin requests (e.g. third-party scripts, APIs)
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests: Network first, cache fallback
  if (url.pathname.startsWith('/api/') || CACHEABLE_API_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Hot-route RSC prefetch requests — short-TTL cache with per-user isolation.
  // The pre-hydration warmup + Next's router.prefetch both fire the SAME
  // URL+header shape for these routes (verified in e2e/prefetch-audit.spec.ts).
  // By caching here with a 15s TTL we let the click-time fetch reuse the
  // warmup response without a second round-trip, while the middleware-set
  // `Vary: cookie` guarantees different users on the same browser get
  // separate cache entries (logout/login → new cookie → cache miss).
  if (
    request.method === 'GET' &&
    request.headers.get('rsc') === '1' &&
    request.headers.get('next-router-prefetch') === '1' &&
    isHotRoutePath(url.pathname)
  ) {
    event.respondWith(rscPrefetchStrategy(request));
    return;
  }

  // Static assets and pages: Cache first, network fallback
  event.respondWith(cacheFirstStrategy(request));
});

// Hot-route paths the pre-hydration warmup targets: /{slug}/{route} where
// {route} is one of the hot jeweller pages. Matches URLs like
// /test/customers, /maisonjove/repairs, etc. — NOT subpaths like
// /test/customers/new.
const HOT_ROUTE_SEGMENTS = new Set([
  'customers',
  'repairs',
  'inventory',
  'tasks',
  'invoices',
  'workshop',
  'bespoke',
  'intake',
]);
function isHotRoutePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return false;
  return HOT_ROUTE_SEGMENTS.has(parts[1]);
}

// We store cache-entry metadata (timestamp + cookie hash) in IndexedDB so
// we can (a) expire entries after RSC_PREFETCH_TTL_MS and (b) refuse to
// serve a cached response across a cookie change (logout → login as User B).
// The Cache API has no native TTL and — although Cache.match honors the
// server's Vary header — Next's renderer overwrites middleware-set Vary on
// authenticated 200 responses, so we cannot rely on `Vary: cookie` making
// it into the response. Instead the SW enforces per-cookie isolation
// itself by comparing a SHA-256 hash of the request's cookie header
// against the hash stored when the entry was first cached.
async function getMetaStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nexpura-sw-meta', 2);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (db.objectStoreNames.contains('ts')) db.deleteObjectStore('ts');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
  });
}
async function readMeta(url) {
  try {
    const db = await getMetaStore();
    return await new Promise((resolve) => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(url);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function writeMeta(url, meta) {
  try {
    const db = await getMetaStore();
    await new Promise((resolve) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(meta, url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}
// Short SHA-256 prefix of the current session's cookie state, used as a
// per-user cache key for hot-route RSC prefetch entries. 64 bits is plenty
// for collision avoidance on a single browser; a cookie rotation (session
// refresh or logout/login) changes the hash and invalidates the entry.
//
// Note: `request.headers.get('cookie')` returns null inside a SW fetch
// event — `Cookie` is a forbidden request header in the Fetch spec, so
// browsers strip it before the Request reaches the SW. We must read
// cookies from `self.cookieStore` (Chromium / Edge; behind a flag in
// Firefox, unsupported in Safari).
//
// If cookieStore is unavailable we return `null` to signal "cannot verify
// isolation" — rscPrefetchStrategy then refuses to cache/serve, falling
// through to plain network. That costs Safari users the cache-reuse win
// but keeps isolation intact. Cache reuse is an optimisation, not a
// correctness requirement.
async function computeSessionCookieHash() {
  try {
    const store = self.cookieStore;
    if (!store || typeof store.getAll !== 'function') return null;
    const all = await store.getAll();
    // Only hash cookies that matter for auth identity — Supabase session
    // cookies and anything starting with nexpura-. Other cookies
    // (analytics, etc.) would add noise and cause unnecessary cache busts.
    const relevant = all
      .filter((c) =>
        c.name.startsWith('sb-') ||
        c.name.startsWith('nexpura-') ||
        c.name === 'session' ||
        c.name === 'auth',
      )
      .map((c) => `${c.name}=${c.value}`)
      .sort()
      .join('\n');
    const buf = new TextEncoder().encode(relevant);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = new Uint8Array(digest, 0, 8);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return hex;
  } catch {
    return null;
  }
}

// Cache-with-TTL + explicit cookie keying for hot-route RSC prefetches.
// Serve cached response only if (a) fresh within TTL AND (b) the cookie
// state that produced it still matches. If we cannot read cookies from
// the CookieStore API (unsupported browser), we DO NOT cache and DO NOT
// serve from cache — pass-through to network to preserve isolation.
async function rscPrefetchStrategy(request) {
  const url = request.url;
  const currentCookieHash = await computeSessionCookieHash();
  if (currentCookieHash === null) {
    // CookieStore unavailable — cannot verify per-user isolation.
    // Pass-through and do NOT cache. (No perf win; correctness preserved.)
    return fetch(request);
  }
  const cache = await caches.open(RSC_PREFETCH_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const meta = await readMeta(url);
    if (
      meta &&
      meta.cookieHash === currentCookieHash &&
      Date.now() - meta.cachedAt < RSC_PREFETCH_TTL_MS
    ) {
      return cached;
    }
    // Stale, or a different session's cookie → fall through to network.
  }
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const toStore = response.clone();
      cache
        .put(request, toStore)
        .then(() =>
          writeMeta(url, {
            cookieHash: currentCookieHash,
            cachedAt: Date.now(),
          }),
        );
    }
    return response;
  } catch (err) {
    // Network failed — only serve stale cache if the cookie state still
    // matches. Never cross-user, even on network failure.
    if (cached) {
      const meta = await readMeta(url);
      if (meta && meta.cookieHash === currentCookieHash) return cached;
    }
    throw err;
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline');
      if (offlinePage) return offlinePage;
    }
    throw error;
  }
}

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Handle offline POST requests (queue for later sync)
async function handleOfflinePost(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Queue the request for later
    const body = await request.json();
    await queueOfflineRequest({
      url: request.url,
      method: request.method,
      body,
      timestamp: Date.now(),
    });

    // Return a synthetic response indicating queued
    return new Response(
      JSON.stringify({
        queued: true,
        message: 'Transaction saved offline. Will sync when connection is restored.',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Queue offline requests in IndexedDB
async function queueOfflineRequest(data) {
  const db = await openOfflineDB();
  const tx = db.transaction('queue', 'readwrite');
  await tx.objectStore('queue').add(data);
}

// Open IndexedDB for offline queue
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nexpura-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'timestamp' });
      }
    };
  });
}

// Background sync - process queued requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pos-transactions') {
    event.waitUntil(syncOfflineTransactions());
  }
});

// Process all queued offline transactions
async function syncOfflineTransactions() {
  const db = await openOfflineDB();
  const tx = db.transaction('queue', 'readonly');
  const store = tx.objectStore('queue');
  const requests = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const item of requests) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });

      if (response.ok) {
        // Remove from queue on success
        const deleteTx = db.transaction('queue', 'readwrite');
        await deleteTx.objectStore('queue').delete(item.timestamp);
        
        // Notify clients of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: item.timestamp,
          });
        });
      }
    } catch (error) {
      console.error('[SW] Failed to sync transaction:', error);
    }
  }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
