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
function trujamanSay (message, mark='trujaman_stdmsg') {
    trujamanPrint('#trujaman_stdtty', mark, message);
}


// Helper to print error messages to "stdtty".
function trujamanErr (message, mark='trujaman_errmsg') {
    trujamanPrint('#trujaman_stdtty', mark, '¡ERROR!<br>' + message);
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


// Detect needed features. This function MUST BE CALLED on the window.onload event handler,
// because it needs access to the web page body in order to show the error messages.
function trujamanDetectFeatures () {
    let trujamanMissingFeatures = [];

    // ECMAScript 6 arrow functions.
    try {
        eval('var f = x => x');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: arrow functions');
    }

    // ECMAScript 6 classes.
    try {
        eval('class X {}')
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: classes');
    }

    // ECMAScript 6 let.
    try {
        eval('let x = true')
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: let statement');
    }

    // ECMAScript 6 template strings.
    try {
        eval('let x = `x`')
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: template strings');
    }

    // ECMAScript 6 default parameters.
    try {
        eval('function f (x=1) {}')
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: default function parameters');
    }

    // ECMAScript 6 async functions.
    try {
        eval('async function f() {}')
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: async functions');
    }

    // ECMAScript 6 promises.
    if (typeof Promise === 'undefined') {
        trujamanMissingFeatures.push('JavaScript ES6: promises');
    }

    // Service workers.
    if ('serviceWorker' in navigator === false) {
        trujamanMissingFeatures.push('Progressive Web Apps: service workers');
    }

    // Cookies (needed for registering a service worker).
    if (!navigator.cookieEnabled) {
        trujamanMissingFeatures.push('Progressive Web Apps: cookies');
    }

    // Cache storage.
    if ('caches' in window === false) {
        trujamanMissingFeatures.push('Progressive Web Apps: cache storage');
    }

    // HTML5 File API.
    if (!('File' in window && 'Blob' in window && 'FileReader' in window && 'FileList' in window)) {
        trujamanMissingFeatures.push('HTML5: File API');
    }

    if (trujamanMissingFeatures.length) {
        trujamanErr('trujamán no puede funcionar en este navegador.');

        trujamanSay('El navegador no es compatible con:', 'trujaman_errmsg');
        trujamanMissingFeatures.forEach(function (item) {
            trujamanSay('· ' + item + '.', 'trujaman_missing_feature');
        });

        trujamanDie();
    }
}


window.addEventListener('load', () => {

    // Detect needed features and show error messages if needed.
    trujamanDetectFeatures();

    // Show logging console during development.
    if (DEBUG) document.querySelector('#trujaman_stdlog').classList.remove('trujaman_hidden');

    trujamanLog('Versión de desarrollo.');
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
    filePicker.querySelector('#trujaman_filepicker_button').addEventListener('click', event => {
        // Propagate the click.
        filePicker.querySelector('#trujaman_filepicker_input').click();
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
        this.file = file;

        // Create the file reader.
        this.reader = new FileReader();

        this.reader.onloadend = this.loadendHandler.bind(this);  // You have to love JavaScript...
        this.reader.onprogress = event => {
            this.setStatus(`Cargando fichero: ${event.loaded} bytes leídos.`);
        }

        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        this.element = document.querySelector('div#trujaman_job_template').cloneNode(true);
        this.element.classList.remove('trujaman_hidden');
        this.element.removeAttribute('id');
        this.element.querySelector('.trujaman_job_filename').innerText = file.name;

        this.action_button = this.element.querySelector('.trujaman_job_action');

        // For testing only. The file will be automatically loaded after being selected.
        this.action_button.innerText = 'Cargar fichero';
        this.action_button.onclick = event => {
            console.log('Loading file...');

            this.action_button.innerText = 'Cancelar carga';
            this.action_button.onclick = event => {
                console.log('Forcing abort!');
                this.reader.abort();
            };
            this.reader.readAsText(this.file);
        };

        this.element.querySelector('.trujaman_job_dismiss_button').addEventListener('click', event => {
            // Remove the onloadend handler, to avoid messing with the UI once the element is removed.
            // This is because that handler modifies DOM elements within the job UI element.
            this.reader.onloadend = null;

            // Remove job UI element.
            let theJob = event.target.closest('.trujaman_job');
            theJob.parentNode.removeChild(theJob);

            // Abort file reading, just in case.
            this.reader.abort();
        }, {once: true});
    }


    // Handling errors here is simpler and more convenient than having two nearly identical handlers for
    // 'onerror' and 'onabort', since this event will fire no matter if the file reading process finished
    // successfully or not.
    loadendHandler(event) {
        this.action_button.onclick = null;
        if (this.reader.error) {
            console.log('Error loading file:', this.reader.error.name);
            this.setStatus('Error al cargar el fichero: ' + this.reader.error.name);
            this.action_button.innerText = '¡Error!';
        } else {
            console.log('File loaded successfully!');
            this.setStatus(`Fichero cargado correctamente, ${event.total} bytes`);
            this.action_button.innerText = 'Convertir';
        }
    }


    // Simple method to show a small status message on the job UI element.
    setStatus(message) {
        this.element.querySelector('.trujaman_job_status').innerText = message;
    }
}