'use strict';

const staticCacheVersion = 0;
const staticCachePrefix = `trujaman@${self.registration.scope}`;
const staticCacheName = `${staticCachePrefix} v${staticCacheVersion}`;
const staticAssets = [
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
        caches.open(staticCacheName)
        .then(cache => cache.addAll(staticAssets))
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
            keys = keys.filter(key => key.startsWith(staticCachePrefix)).filter(key => key != staticCacheName);
            return Promise.all(keys.map(key => caches.delete(key)));
        })
        .then(self.clients.claim())  // Brutal, but effective for now.
    );
});


// As a first step, a 'pass-through' fetch handler is implemented.
// This is ABSOLUTELY discouraged, for a whole variety of reasons, but here it's just used as a starting point.
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
        caches.open(staticCacheName)
        .then(cache => cache.match(event.request))
        .then(response => {
            // For now, just detect uncached assets, but always fetch from network.
            if (!response) console.error('UNCACHED request for', event.request.url);
            return fetch(event.request);
        })
    );
});