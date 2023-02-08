'use strict';

const version = '0.1.0-alpha+20230204';

const landingPage = '.';  // Maybe: "new URL(globalThis.registration.scope).pathname"???

const cachePrefix = `trujaman@${globalThis.registration.scope}`;

const cacheName = `${cachePrefix} v${version}`;

const assets = [
    landingPage,
    'index.css',
    'font_sans_r_400.woff2',
    'font_sans_r_700.woff2',
    'font_mono_r_400.woff2',
    'index.js',
    'formats.json',
    'ww.js',
    'manifest.webmanifest',
    'appicon.png',
    'favicon.ico'
];


// Precache assets and take control (for now)
globalThis.addEventListener('install', event => {
    event.waitUntil(
        caches.open(cacheName)
        .then(cache => cache.addAll(assets))
        .then(globalThis.skipWaiting())  // Brutal, but effective for now.
    );
});


// Delete old caches and take control of uncontrolled pages.
globalThis.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
        .then(keys => Promise.all(
            keys
            .filter(key => key.startsWith(cachePrefix))
            .filter(key => key !== cacheName)  // Only old caches from this PWA are deleted. Check the prefix!
            .map(key => caches.delete(key))
        ))
        .then(globalThis.clients.claim())  // Brutal, but effective for now.
    );
});


// A 'cache-only' caching strategy is used for now.
// This makes sure the PWA fully works when offline, and it's perfect for the core assets.
globalThis.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        // eslint-disable-next-line no-console
        console.error('Fetch with non-GET method!');  // Should NEVER happen in production.
        return;
    }
    if (!event.request.url.startsWith(globalThis.location.origin)) {
        // eslint-disable-next-line no-console
        console.error('Cross-origin fetch!');  // Should NEVER happen in production.
        return;
    }
    // eslint-disable-next-line no-console
    console.debug('Fetching', event.request.url);
    event.respondWith((() => {
        if (event.request.url.endsWith('version')) return new Response(version);

        // This is TEMPORARY!
        // This is needed to be able to test changes fast and at the same time having offline functionality.
        return fetch(event.request).catch(async () => {
            const cache = await caches.open(cacheName);
            const response = await cache.match(event.request);
            return response || cache.match(landingPage);
        });
    })());
});
