// Nexpura Service Worker - PWA & Offline Support
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `nexpura-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `nexpura-dynamic-${CACHE_VERSION}`;
const OFFLINE_QUEUE_KEY = 'nexpura-offline-queue';

// Assets to cache immediately on install — critical for app shell
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/pos',
  '/inventory',
  '/customers',
  '/repairs',
  '/invoices',
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

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

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

  // Static assets and pages: Cache first, network fallback
  event.respondWith(cacheFirstStrategy(request));
});

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
