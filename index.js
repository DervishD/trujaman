"use strict";

let trujaman_version = '0.0.1-alpha';

// Register service worker.
if ('serviceWorker' in navigator) {                                 
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.debug('Service worker registered.', registration);
        }).catch(error => {
            console.error('Service worker registration failed.');
            console.error(error);
        });
    });
} else {
    console.warn('Browser is not compatible with Progressive Web Apps.');
}
