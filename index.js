'use strict';

const trujamanVersion = '0.0.6-alpha';


// Show status flags on main page, for debugging.
function trujamanShowStatusFlag (statusFlag, value) {
    document.getElementById(statusFlag).textContent = value ? ' YES' : ' NO';
}


// Helper for add arbitrary delays, for debugging.
function trujamanSleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));  // For debugging...
}


// Show current version on page.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version').textContent = 'version ' + trujamanVersion;
});

// Register service worker.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        trujamanShowStatusFlag('sw_supported', true);  // Indicate service worker (PWA) support.

        // For now, set a flag to show whether this page is being controlled or not.
        trujamanShowStatusFlag('page_controlled', navigator.serviceWorker.controller);
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', event => {
            trujamanShowStatusFlag('page_controlled', true);
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        // For now, set a flag to show that the PWA is, in fact, installable.
        trujamanShowStatusFlag('pwa_installable', false);  // By default...
        window.addEventListener('beforeinstallprompt', event => {
            // Prevent the default install handler to appear for now.
            event.preventDefault();
            trujamanShowStatusFlag('pwa_installable', true);
        });

        navigator.serviceWorker.register('sw.js')
        .then(registration => {
            trujamanShowStatusFlag('sw_registered', true);

            // This is a starting point, to show the status after page load.
            trujamanShowStatusFlag('sw_active', registration.active);
            trujamanShowStatusFlag('sw_waiting', registration.waiting);
            trujamanShowStatusFlag('sw_installing', registration.installing);

            // Handle state changes for new service workers, including the first one.
            registration.addEventListener('updatefound', () => {
                trujamanShowStatusFlag('sw_installing', true);
                registration.installing.onstatechange = event => {
                    if (event.target.state == 'installed' || event.target.state == 'activated') {
                        trujamanShowStatusFlag('sw_active', registration.active);
                        trujamanShowStatusFlag('sw_waiting', registration.waiting);
                        trujamanShowStatusFlag('sw_installing', registration.installing);
                    }
                }
            });
        })
        .catch(error => {
            trujamanShowStatusFlag('sw_registered', false);
            console.error('Service worker registration failed:', error);
        });
    });
} else {
    // Indicate that there's no service worker (PWA) support.
    window.addEventListener('load', () => trujamanShowStatusFlag('sw_supported', false));
}