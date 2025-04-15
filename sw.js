import {version} from './version.js';
import {LOG} from './strings.js';


const landingPage = '.';  // Maybe: "new URL(globalThis.registration.scope).pathname"???
const cachePrefix = `trujaman@${globalThis.registration.scope}`;
const currentCacheName = `${cachePrefix} v${version}`;
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
    'favicon.ico',
];


globalThis.addEventListener('install', event => {
    console.debug(LOG.SW_INSTALLING(version));  // eslint-disable-line new-cap
    event.waitUntil(
        caches.open(currentCacheName)
        .then(cache => cache.addAll(assets))
        .then(globalThis.skipWaiting())  // Brutal, but effective for now.
    );
});


globalThis.addEventListener('activate', event => {
    console.debug(LOG.SW_ACTIVATING(version));  // eslint-disable-line new-cap
    event.waitUntil(
        caches.keys()
        .then(keys => Promise.all(
            keys
            .filter(key => key.startsWith(cachePrefix))
            .filter(key => key !== currentCacheName)
            .map(key => caches.delete(key))
        ))
        .then(globalThis.clients.claim())  // Brutal, but effective for now.
    );
});


// A 'cache-only' caching strategy is used for now.
// This makes sure the PWA fully works when offline,
// and it's perfect for the core assets.
globalThis.addEventListener('fetch', event => {
    console.debug(LOG.SW_FETCH_REQUEST(event.request.url));  // eslint-disable-line new-cap
    if (event.request.method !== 'GET') {
        console.error(LOG.SW_FETCH_REQUEST_NON_GET(event.request.method));  // eslint-disable-line new-cap
        return;
    }

    if (!event.request.url.startsWith(globalThis.location.origin)) {
        console.error(LOG.SW_FETCH_REQUEST_CROSS_ORIGIN(event.request.url));  // eslint-disable-line new-cap
        return;
    }

    // This is TEMPORARY!
    // This is needed to be able to test changes fast and at the same time having offline functionality.
    event.respondWith((() => fetch(event.request).catch(async () => {
        const cache = await caches.open(currentCacheName);
        const response = await cache.match(event.request);
        return response || cache.match(landingPage);
    }))());
});

console.info(LOG.SCRIPT_PROCESSED('Service Worker'));  // eslint-disable-line new-cap
