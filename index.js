"use strict";

let trujaman_version = '0.0.2-alpha';

// Show current version on page.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version').textContent = 'version ' + trujaman_version;
});

function set_status (status, value) {
    document.getElementById(status).textContent = value ? ' YES' : ' NO';
}

// Register service worker.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        set_status('sw_supported', true);  // Indicate service worker (PWA) support.

        // For now, set a flag to show whether this page is being controlled or not.
        set_status('page_controlled', navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener('controllerchange', event => {
            set_status('page_controlled', true);
        });

        // For now, set a flag to show that the PWA is, in fact, installable.
        set_status('pwa_installable', false);  // By default...
        window.addEventListener('beforeinstallprompt', event => {
            // Prevent the default install handler to appear for now.
            event.preventDefault();
            set_status('pwa_installable', true);
        });

        navigator.serviceWorker.register('sw.js').then(registration => {
            set_status('sw_registered', true);

            // This is a starting point, to show the status after page load.
            set_status('sw_active', registration.active);
            set_status('sw_waiting', registration.waiting);
            set_status('sw_installing', registration.installing);

            // Handle state changes for new service workers, including the first one.
            registration.addEventListener('updatefound', () => {
                set_status('sw_installing', true);
                registration.installing.onstatechange = event => {
                    if (event.target.state == 'installed' || event.target.state == 'activated') {
                        set_status('sw_active', registration.active);
                        set_status('sw_waiting', registration.waiting);
                        set_status('sw_installing', registration.installing);
                    }
                }
            });
        }).catch(error => {
            set_status('sw_registered', false);
            console.error('Service worker registration failed:', error);
        });
    });
} else {
    // Indicate that there's no service worker (PWA) support.
    window.addEventListener('load', () => set_status('sw_supported', false));
}
