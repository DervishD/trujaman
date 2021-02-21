'use strict';

const serviceworkerVersion = 0;

const cachePrefix = `trujaman@${self.registration.scope}`;

const coreCacheName = `${cachePrefix} v${serviceworkerVersion}`;
const coreAssets = [
    '.',  // Maybe: "new URL(self.registration.scope).pathname"???
    'index.css',
    'index_n400.woff2',
    'index_n700.woff2',
    'index_i400.woff2',
    'index_i700.woff2',
    'index.js',
    'manifest.json',
    'appicon.png',
    'favicon.ico',
];

const trujaman = {
    sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),  // For debugging...
};


// Precache assets and take control (for now)
self.addEventListener('install', event => {
    console.debug('Installing service worker.');
    event.waitUntil(
        caches.open(coreCacheName)
        .then(cache => cache.addAll(coreAssets))
        .then(self.skipWaiting())  // Brutal, but effective for now.
    );
});


// Delete old caches and take control of uncontrolled pages.
self.addEventListener('activate', event => {
    console.debug('New service worker activated!');
    event.waitUntil(
        caches.keys()
        .then(keys => {
            // Only old caches from this PWA are deleted. Check the prefix!
            keys = keys.filter(key => key.startsWith(cachePrefix)).filter(key => key != coreCacheName);
            return Promise.all(keys.map(key => caches.delete(key)));
        })
        .then(self.clients.claim())  // Brutal, but effective for now.
    );
});


// The next step in caching is switching to a 'cache-only' strategy.
// This makes sure the PWA fully works when offline, and it's perfect for the static assets.
// For now, a network-fallback is kept, anyway.
self.addEventListener('fetch', event => {
    if (event.request.method != 'GET') {
        console.error('Fetch with non-GET method!');  // Should NEVER happen in production.
        return;
    }
    if (!event.request.url.startsWith(self.location.origin)) {
        console.error('Cross-origin fetch!');  // Should NEVER happen in production.
        return;
    }
    console.debug('Fetching', event.request.url);
    event.respondWith(
        caches.open(coreCacheName)
        .then(cache => cache.match(event.request))
        .then(response => {
            if (!response) console.warn('UNCACHED request for', event.request.url);
            return response || fetch(event.request);
        })
    );
});