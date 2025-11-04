// Car Mechanic Service Worker
// Version 1.1.0

const CACHE_NAME = 'my-mechanic-v2';
const RUNTIME_CACHE = 'my-mechanic-runtime-v2';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/landing.html',
    '/index.html',
    '/style.css',
    '/script.js',
    '/favicon.svg',
    '/manifest.json',
    '/icon-192.svg',
    '/icon-512.svg',
    '/loading-car.gif'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing v2...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'reload'})))
                    .catch((error) => {
                        console.error('[Service Worker] Cache addAll failed:', error);
                        // Continue even if some assets fail to cache
                        return Promise.resolve();
                    });
            })
            .then(() => {
                console.log('[Service Worker] Skip waiting - force immediate activation');
                // Force this service worker to take control immediately
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating v2...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        // Delete old caches (v1 and any other old versions)
                        return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                    })
                    .map((cacheName) => {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[Service Worker] Claiming all clients immediately');
            // Take control of all pages immediately, even those loaded with old SW
            return self.clients.claim();
        }).then(() => {
            // Notify all clients to reload
            return self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    console.log('[Service Worker] Notifying client to reload:', client.url);
                    client.postMessage({
                        type: 'SW_UPDATED',
                        message: 'Service worker updated to v2'
                    });
                });
            });
        })
    );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome extensions and other schemes
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests - network first, no cache fallback (always need fresh data)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .catch((error) => {
                    console.error('[Service Worker] API fetch failed:', error);
                    // Return a custom offline response for API calls
                    return new Response(
                        JSON.stringify({
                            error: 'You appear to be offline. Please check your internet connection.',
                            offline: true
                        }),
                        {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'application/json'
                            })
                        }
                    );
                })
        );
        return;
    }

    // Static assets - cache first, fallback to network
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version and update cache in background
                    fetchAndCache(request);
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetchAndCache(request);
            })
            .catch((error) => {
                console.error('[Service Worker] Fetch failed:', error);

                // If this is a navigation request, return the appropriate cached page
                if (request.mode === 'navigate') {
                    const url = new URL(request.url);

                    // Root path should return landing page
                    if (url.pathname === '/' || url.pathname === '/landing' || url.pathname === '/landing.html') {
                        return caches.match('/landing.html');
                    }

                    // Chat/app routes should return the chat interface
                    if (url.pathname === '/chat' || url.pathname === '/app' || url.pathname === '/index.html') {
                        return caches.match('/index.html');
                    }

                    // Default fallback to landing page for unknown routes
                    return caches.match('/landing.html');
                }

                // For other requests, return a generic error
                return new Response('Offline - resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});

// Helper function to fetch and cache
function fetchAndCache(request) {
    return fetch(request)
        .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
                return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(RUNTIME_CACHE)
                .then((cache) => {
                    cache.put(request, responseToCache);
                });

            return response;
        });
}

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

// Background sync for offline messages (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        console.log('[Service Worker] Background sync triggered');
        // Could implement offline message queue here
    }
});

console.log('[Service Worker] Loaded');
