'use strict';

const trujaman = {
    version: '0.0.5-alpha',
    setStatus: (status, value) => document.getElementById(status).textContent = value ? ' YES' : ' NO',
    sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),  // For debugging...
};


// Show current version on page.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version').textContent = 'version ' + trujaman.version;
});

// Register service worker.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        trujaman.setStatus('sw_supported', true);  // Indicate service worker (PWA) support.

        // For now, set a flag to show whether this page is being controlled or not.
        trujaman.setStatus('page_controlled', navigator.serviceWorker.controller);
        trujaman.refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', event => {
            trujaman.setStatus('page_controlled', true);
            if (trujaman.refreshing) return;
            trujaman.refreshing = true;
            window.location.reload();
        });

        // For now, set a flag to show that the PWA is, in fact, installable.
        trujaman.setStatus('pwa_installable', false);  // By default...
        window.addEventListener('beforeinstallprompt', event => {
            // Prevent the default install handler to appear for now.
            event.preventDefault();
            trujaman.setStatus('pwa_installable', true);
        });

        navigator.serviceWorker.register('sw.js')
        .then(registration => {
            trujaman.setStatus('sw_registered', true);

            // This is a starting point, to show the status after page load.
            trujaman.setStatus('sw_active', registration.active);
            trujaman.setStatus('sw_waiting', registration.waiting);
            trujaman.setStatus('sw_installing', registration.installing);

            // Handle state changes for new service workers, including the first one.
            registration.addEventListener('updatefound', () => {
                trujaman.setStatus('sw_installing', true);
                registration.installing.onstatechange = event => {
                    if (event.target.state == 'installed' || event.target.state == 'activated') {
                        trujaman.setStatus('sw_active', registration.active);
                        trujaman.setStatus('sw_waiting', registration.waiting);
                        trujaman.setStatus('sw_installing', registration.installing);
                    }
                }
            });
        })
        .catch(error => {
            trujaman.setStatus('sw_registered', false);
            console.error('Service worker registration failed:', error);
        });
    });
} else {
    // Indicate that there's no service worker (PWA) support.
    window.addEventListener('load', () => trujaman.setStatus('sw_supported', false));
}