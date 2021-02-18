'use strict';

const trujaman = {
    staticCache: 'trujaman-alpha-v0',  // MUST start with 'trujaman-'.
    staticAssets: [
        '.',  // Maybe: "new URL(self.registration.scope).pathname"
        'index.css',
        'index_n400.woff2',
        'index_n700.woff2',
        'index_i400.woff2',
        'index_i700.woff2',
        'index.js',
        'manifest.json',
        'appicon.png',
        'favicon.ico',
    ],
    sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),  // For debugging...
};


// Precache assets and take control (for now)
self.addEventListener('install', event => {
    console.debug('Installing service worker.');
    event.waitUntil(
        caches.open(trujaman.staticCache)
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
            keys = keys.filter(key => key.startsWith('trujaman-')).filter(key => key != trujaman.staticCache);
            return Promise.all(keys.map(key => caches.delete(key)));
        })
        .then(self.clients.claim())  // Brutal, but effective for now.
    );
});


// As a first step, a 'pass-through' fetch handler is implemented.
// This is ABSOLUTELY discouraged, for a whole variety of reasons, but here it's just used as a starting point.
self.addEventListener('fetch', event => {
    console.debug('Fetching', event.request.url);
    event.respondWith(
        caches.open(trujaman.staticCache)
        .then(cache => cache.match(event.request))
        .then(response => {
            // For now, just detect uncached assets, but always fetch from network.
            if (!response) console.error('UNCACHED request for', event.request.url);
            return fetch(event.request);
        })
    );
});