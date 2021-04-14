'use strict';

const serviceworkerVersion = '20210414.5';

const landingPage = '.';  // Maybe: "new URL(self.registration.scope).pathname"???

const cachePrefix = `trujaman@${self.registration.scope}`;

const coreCacheName = `${cachePrefix} v${serviceworkerVersion}`;

const coreAssets = [
    landingPage,
    'index.css',
    'index_n400.woff2',
    'index_n700.woff2',
    'index_i400.woff2',
    'index_i700.woff2',
    'index_n400m.woff2',
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


// A 'cache-only' caching strategy is used for now.
// This makes sure the PWA fully works when offline, and it's perfect for the core assets.
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
    event.respondWith(function () {
        if (event.request.url.endsWith('version')) return new Response(serviceworkerVersion);

        // This is TEMPORARY!
        // This is needed to be able to test changes fast and at the same time having offline functionality.
        return fetch(event.request).catch(async () => {
            let cache = await caches.open(coreCacheName);
            let response = await cache.match(event.request);
            return response || cache.match(landingPage);
        });
    }());
});