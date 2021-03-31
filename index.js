'use strict';


// Change to 'false' in production.
let DEBUG = true;


// Helper to print a message for the end user on the main page.
// The message is added in the HTML element whose selector is 'where'.
// The message is added within a '<p>' element of class 'mark'.
function trujamanPrint (where, mark, message) {

    let theConsole = document.querySelector(where);

    // This has to be calculated BEFORE inserting the new content...
    let mustScroll = theConsole.scrollHeight - theConsole.clientHeight - theConsole.scrollTop <= 0;

    // New content is inserted at the end...
    theConsole.insertAdjacentHTML('beforeend', `<p${`${mark?` class="${mark}"`:''}`}>${message}</p>`);

    // This has to be calculated AFTER inserting the new content...
    if (mustScroll) theConsole.scrollTop = theConsole.scrollHeight - theConsole.clientHeight;
}


// Helper to print log messages to "stdlog".
function trujamanLog (message) {
    if (DEBUG) trujamanPrint('#trujaman_stdlog', 'trujaman_logmsg', '• ' + message);
}


// Helper to print normal messages to "stdtty".
function trujamanSay (message) {
    trujamanPrint('#trujaman_stdtty', 'trujaman_stdmsg', message);
}


// Helper to print error messages to "stdtty".
function trujamanErr (message) {
    trujamanPrint('#trujaman_stdtty', 'trujaman_errmsg', '¡ERROR!<br>' + message);
}


// Helper to terminate script execution.
// This is one of the many ways of stopping execution. This is terse and effective.
function trujamanDie () {
    window.onerror=()=>true;
    throw true;
}


// Helper for add arbitrary delays, for debugging.
function trujamanSleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));  // For debugging...
}


window.addEventListener('load', () => {
    let trujamanMissingFeatures = [];

    // Feature detection: HTML5 File API.
    if (!window.FileReader) trujamanMissingFeatures.push('HTML5 File API');
    // Feature detection: service workers (PWA support).
    if ('serviceWorker' in navigator === false) trujamanMissingFeatures.push('Progressive Web Apps');

    if (trujamanMissingFeatures.length) {
        let message = 'trujamán no puede funcionar en este navegador.<br>';

        message += '<br>El navegador no es compatible con:';
        message += trujamanMissingFeatures.reduce((string, item) => {
            return string + '<br>' + item;
        },'');
        trujamanErr(message);
        trujamanDie();
    }

    // Show logging console during development.
    if (DEBUG) document.querySelector('#trujaman_stdlog').classList.remove('trujaman_hidden');

    trujamanLog('Versión de desarrollo.');
    trujamanLog('Hay compatibilidad con File API.');
    trujamanLog('Se permiten service workers.');
    trujamanLog(`La página${navigator.serviceWorker.controller?'':' no'} está controlada.`);

    // Show version number.
    navigator.serviceWorker.ready
    .then(registration => {
        fetch('version')
        .then(response => response.text())
        .then(version => document.getElementById('trujaman_version').textContent = 'v' + version);
    });

    // Handle controller change.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', event => {
        trujamanLog('La página tiene un nuevo controlador.');
        if (refreshing) return;
        refreshing = true;
        trujamanSleep(1000).then(() => window.location.reload());  // Debugging only, FIXME!
    });

    // Handle PWA installation offers.
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();  // Prevent the default install handler to appear for now.
        // Indicate the PWA is installable.
        trujamanLog('Parece que trujamán puede ser instalado.');
    });

    // Register service worker.
    navigator.serviceWorker.register('sw.js')
    .then(registration => {
        trujamanLog('El service worker se registró con éxito.')

        trujamanLog(`${registration.active?'Hay':'No hay'} un service worker activo.`);

        if (registration.waiting) trujamanLog('Hay un service worker esperando.');

        // Handle state changes for new service workers, including the first one.
        registration.addEventListener('updatefound', () => {
            trujamanLog('Se encontró un nuevo service worker.');
            registration.installing.onstatechange = event => {
                if (event.target.state == 'installed')
                    trujamanLog('Se ha instalado un nuevo service worker.');
                if (event.target.state == 'activated')
                    trujamanLog('Hay un nuevo service worker activo.');
            }
        });
    })
    .catch(error => {
        trujamanLog('El registro del service worker falló: ' + error);  // Only for debugging, FIXME!
        console.error('Service worker registration failed with', error);
    });

    // Set up file picker.
    let filePicker = document.querySelector('#trujaman_filepicker');
    filePicker.classList.remove('trujaman_hidden');
    document.querySelector('#trujaman_jobs').classList.remove('trujaman_hidden');
    filePicker.lastElementChild.addEventListener('click', event => {
        // Propagate the click.
        event.target.previousElementSibling.click();
    });
    // Create new file processor with the selected file.
    filePicker.firstElementChild.addEventListener('change', event => {
        // Single file per job, for now...
        let trujamanJob = new TrujamanJob(event.target.files[0]);
        // Add the container itself to the page.
        document.querySelector('#trujaman_jobs').appendChild(trujamanJob.element);

        // Or the event won't be fired again if the user selects the same file...
        event.target.value = null;
    });
});

class TrujamanJob {
    constructor(file) {
        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        this.element = document.querySelector('div#trujaman_job_template').cloneNode(true);
        this.element.classList.remove('trujaman_hidden');
        this.element.removeAttribute('id');

        this.element.querySelector('.trujaman_job_filename').innerText = file.name;


        this.element.querySelector('.trujaman_job_dismiss_button').addEventListener('click', event => {
            let theJob = event.target.closest('.trujaman_job');
            theJob.parentNode.removeChild(theJob);
        }, {once: true});

        this.reader = new FileReader();
        this.reader.onerror = (event) => {
            console.log('Error reading file with error', event.target.error.name);
        }
    }
}