import {commands} from './contracts.js';

const showError = (message, location, details) => {
    console.error(`${message}${location ? `\n\n${location}` : ''}${details ? `\n\n${details}` : ''}`);

    const errorTemplate = document.querySelector('#error_template');

    // Disable UI interaction by removing all page elements.
    Array.from(document.body.children).forEach(element => {
        if (['HEADER', 'TEMPLATE'].includes(element.tagName)) {
            return;
        }
        if (element.tagName === 'DIV' && element.classList.contains('error')) {
            return;
        }
        element.remove();
    });

    // At this point no further interaction with the page is possible so the
    // application is effectively stopped, even though it is still running…

    const errorElement = errorTemplate.content.firstElementChild.cloneNode(true);

    errorElement.querySelector('.error_header').textContent = '¡ERROR, la aplicación no puede funcionar!';
    errorElement.querySelector('.error_message').textContent = message;
    errorElement.querySelector('.error_location').textContent = location;
    errorElement.querySelector('.error_details').textContent = details.trim();

    // Errors are shown in a first-happenned, first-shown manner.
    errorTemplate.before(errorElement);
};


class FatalError extends Error {
    constructor (message, details = '') {
        super(message);
        this.details = details;
        this.name = 'FatalError';
    }
}


// Default handler for unhandled errors which should not happen in production.
globalThis.addEventListener('error', event => {
    const error = event instanceof PromiseRejectionEvent ? event.reason : event.error;
    let message = 'No hay información.';
    let details = '';
    let location = '';

    if (event.filename) {
        try {
            const FROM_SLASH = 1;
            location = new URL(event.filename).pathname.substring(FROM_SLASH);
        } catch (exc) {
            if (exc instanceof TypeError) {
                location = event.filename;
            } else throw exc;
        }
        location = `En ${location}, línea ${event.lineno}, columna ${event.colno}.`;
    }

    if (error) {
        ({message} = error);

        if (error instanceof FatalError) {
            ({details} = error);
        } else {
            message = `${error.name ? `${error.name}` : 'Error'}('${message}') sin gestionar.`;
            details = '';
        }

        if (error.stack) {
            details += `${details ? '\n\n' : ''}Información de depurado:\n`;
            for (const line of error.stack.trim().split('\n')) {
                details += `    ${line.trim()}\n`;
            }
        }
    } else {
        ({message} = event);
        message += message && !message.endsWith('.') ? '.' : '';
    }

    showError(message, location, details);
    event.preventDefault();
});


globalThis.addEventListener('unhandledrejection', event => {
    globalThis.reportError(event.reason);
    event.preventDefault();
});


const customEvents = {
    jobDismiss: null,
    jobCancel: null,
    jobRetry: null,
    slowModeToggle: null,
    processFiles: null,
};
Object.keys(customEvents).forEach(key => { customEvents[key] = `custom:${key}`; });
Object.freeze(customEvents);


class Job {
    static states = {
        processing: Symbol('Leyendo el fichero…'),
        reading: Symbol('Leyendo el fichero '),
        processed: Symbol('El fichero se leyó correctamente.'),
        retrying: Symbol('Reintentando…'),  // cspell:disable-line
        cancelling: Symbol('Cancelando el fichero…'),
        cancelled: Symbol('Lectura cancelada.'),
        error: Symbol('Error: '),
    };

    static errors = {
        FileTooLargeError: 'el fichero es muy grande',
        NotFoundError: 'el fichero no existe',
        NotReadableError: 'el fichero no se puede leer',
        SecurityError: 'el fichero no se puede leer de forma segura',
    };

    constructor (id, fileName) {
        this.id = id;
        this.progressString = '';
        this.debugInfo = '';
        this.errorName = '';

        this.element = document.getElementById('job_template').content.firstElementChild.cloneNode(true);
        this.element.querySelector('.job_filename').textContent = fileName;

        this.message = this.element.querySelector('.job_message');

        this.dismissButton = this.element.querySelector('.job_dismiss_button');
        this.retryButton = this.element.querySelector('.job_retry_button');
        this.cancelButton = this.element.querySelector('.job_cancel_button');
        this.downloadDropdown = this.element.querySelector('.job_download_dropdown');

        this.controller = new AbortController();

        this.dismissButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent(customEvents.jobDismiss, {detail: this, bubbles: true}));
        }, {once: true});

        this.cancelButton.addEventListener('click', event => {
            this.cancelButton.disabled = true;
            event.target.dispatchEvent(new CustomEvent(customEvents.jobCancel, {detail: this, bubbles: true}));
        }, {signal: this.controller.signal});

        this.retryButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent(customEvents.jobRetry, {detail: this, bubbles: true}));
        }, {signal: this.controller.signal});

        this.element.querySelector('.job_download_dropdown').addEventListener('click', () => {
            const formatsList = this.element.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        }, {signal: this.controller.signal});

        document.querySelector('#jobs').append(this.element);
    }

    remove () {
        // Remove event listeners before removing the DOM element.
        // Not really needed, apparently, but it's the Tao.
        this.controller.abort();
        this.element.remove();
    }

    set progress (progress) {
        this.progressString = progress;
    }

    set debugMarker (marker) {
        this.debugInfo = `<br><span class="monospaced">Id <${this.id}>, ${marker}</span>`;
    }

    set error (error) {
        this.errorName = error;
    }

    set state (state) {
        this.message.innerHTML = state.description;
        switch (state) {
        case Job.states.processing:
        case Job.states.retrying:
            this.retryButton.hidden = true;
            this.cancelButton.disabled = false;
            this.cancelButton.hidden = false;
            break;
        case Job.states.reading:
            this.message.innerHTML += `(${this.progressString}%).`;
            break;
        case Job.states.processed:
            this.message.innerHTML += this.debugInfo;
            this.cancelButton.hidden = true;
            this.downloadDropdown.hidden = false;
            break;
        case Job.states.cancelled:
            this.cancelButton.hidden = true;
            this.retryButton.hidden = false;
            break;
        case Job.states.error:
            this.message.innerHTML += `${Job.errors[this.errorName]}.`;
            this.cancelButton.hidden = true;
            this.retryButton.hidden = true;
            this.downloadDropdown.hidden = true;
            break;
        default:
        }
    }
}


class FormatsList {
    constructor () {
        this.formatsList = document.querySelector('#job_template').content.querySelector('.job_formats_list');
    }

    set formats (formats) {
        formats.forEach(format => {
            const paragraph = document.createElement('p');
            paragraph.textContent = format;
            this.formatsList.append(paragraph);
        });
    }
}


class SlowModeIndicator {
    constructor () {
        this.element = document.querySelector('#slow_mode');
    }

    show () {
        this.element.addEventListener('click', () => {
            globalThis.dispatchEvent(new CustomEvent(customEvents.slowModeToggle));
        });
        this.element.hidden = false;
    }

    set state (state) {
        this.element.textContent = state ? '⊖' : '⊕';
    }
}


class VersionIndicator {
    static show (version) {
        document.querySelector('#version').textContent = `v${version}`;
    }
}


class FilePicker {
    constructor () {
        this.container = document.querySelector('#filepicker');
        this.input = this.container.querySelector('input');
        this.button = this.container.querySelector('button');
    }

    show () {
        this.button.addEventListener('click', () => {
            this.input.click();
        });
        this.input.addEventListener('change', event => {
            globalThis.dispatchEvent(new CustomEvent(customEvents.processFiles, {detail: event.target.files}));
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });
        this.container.hidden = false;
        this.button.focus();
    }
}


class DropZone {
    constructor () {
        this.element = document.querySelector('#dropzone');
    }

    show () {
        globalThis.addEventListener('dragenter', () => { this.element.dataset.state = 'visible'; });
        this.element.addEventListener('dragleave', () => { this.element.dataset.state = 'hidden'; });

        // This is needed because otherwise the page is NOT a valid drop target,
        // and when the file is dropped the default action is performed by the browser.
        this.element.addEventListener('dragover', event => { event.preventDefault(); });

        this.element.addEventListener('drop', event => {
            this.element.dataset.state = 'dismissed';
            globalThis.dispatchEvent(new CustomEvent(customEvents.processFiles, {detail: event.dataTransfer.files}));
            event.preventDefault();  // Prevent the browser from opening the file.
        });

        this.element.hidden = false;
        this.element.dataset.state = 'hidden';
    }
}


class Presenter {
    constructor () {
        this.jobIds = new Map();
        this.developmentMode = false;
        this.formatsList = new FormatsList();
        this.slowModeIndicator = new SlowModeIndicator();
        this.slowModeState = false;
        this.filePicker = new FilePicker();

        // This feature is entirely optional.
        // Detection is performed by testing for the existence of the drag and drop events used.
        // This is not orthodox but works well enough.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in globalThis)) {
            this.dropZone = new DropZone();
        }
    }

    run () {
        this.initServiceWorker('sw.js');
        this.initWebWorker('ww.js');

        fetch('formats.json')
        .then(response => {
            if (!response.ok) {
                throw new FatalError('No se encontró el fichero con la lista de formatos.');
            }
            return response.json();
        })
        .then(formats => {
            this.webWorkerDo(commands.registerFormats, formats);
            this.formatsList.formats = Object.keys(formats);
            this.initView();
        })
        .catch(error => {
            throw new FatalError('No se pudo procesar el fichero con la lista de formatos.', error);
        });
    }

    initServiceWorker (serviceWorker) {
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            globalThis.location.reload();
            refreshing = true;
        });

        // For now, just prevent the default install handler to appear.
        globalThis.addEventListener('beforeinstallprompt', event => event.preventDefault());

        navigator.serviceWorker.ready
        .then(() => {
            fetch('version')
            .then(response => response.text())
            .then(version => {
                if (version) {
                    VersionIndicator.show(version);
                    // Enable development mode ONLY for prereleases which are NOT release candidates.
                    if (version.includes('-') && !version.includes('-rc')) {
                        this.developmentMode = true;
                        this.slowModeState = true;
                        this.slowModeIndicator.show();
                        this.webWorkerDo(commands.setSlowMode, this.slowModeState);
                    }
                }
            });
        });

        navigator.serviceWorker.register(serviceWorker, {type: 'module'})
        .catch(error => {
            // Service workers are considered site data, so cookies have to be enabled for the application to work.
            if (navigator.cookieEnabled) {
                throw new FatalError('No se pudo iniciar el service worker.', error);
            } else {
                throw new FatalError('Las cookies están desactivadas.', error);
            }
        });
    }

    initWebWorker (webWorker) {
        this.worker = new Worker(webWorker, {type: 'module'});
        this.worker.addEventListener('message', event => this.handleWebWorkerMessage(event));
        this.worker.addEventListener('error', event => {
            event.preventDefault();
            if (event instanceof ErrorEvent) {
                // For syntax errors, that should not happen in production,
                // the event will be an ErrorEvent instance and will contain
                // information pertaining to the error.
                throw new FatalError(`Error de sintaxis en el web worker, línea ${event.lineno}.`, event.message);
            } else {
                // For loading errors the error will be an Event.
                throw new FatalError('No se pudo iniciar el web worker.');
            }
        });
    }

    initView () {
        globalThis.addEventListener(customEvents.processFiles, event => {
            const files = event.detail;
            for (const file of files) {
                this.webWorkerDo(commands.createJob, file);
            }
        });

        globalThis.addEventListener(customEvents.slowModeToggle, () => {
            this.slowModeState = !this.slowModeState;
            this.webWorkerDo(commands.setSlowMode, this.slowModeState);
        });

        globalThis.addEventListener(customEvents.jobDismiss, event => {
            const job = event.detail;
            this.webWorkerDo(commands.deleteJob, job.id);
        });

        globalThis.addEventListener(customEvents.jobCancel, event => {
            const job = event.detail;
            job.state = Job.states.cancelling;
            this.webWorkerDo(commands.cancelJob, job.id);
        });

        globalThis.addEventListener(customEvents.jobRetry, event => {
            const job = event.detail;
            job.state = Job.states.retrying;
            this.webWorkerDo(commands.retryJob, job.id);
        });

        this.filePicker.show();
        this.dropZone?.show();
    }

    webWorkerDo (command, payload) {
        console.debug(`Sending command '${command}'`, payload);
        this.worker.postMessage({command, payload});
    }

    handleWebWorkerMessage (message) {
        const {reply, payload} = message.data;
        console.debug(`Received reply '${reply}'`, payload);

        if (reply === 'commandNotFound') {
            const command = payload;
            throw new FatalError(`El web worker no reconoce el comando «${command}».`);
        }

        const handler = `${reply}Handler`;
        if (handler in this) {
            this[handler](payload);
        } else {
            throw new FatalError(`No se reconoce la respuesta del web worker «${reply}».`);
        }
    }

    slowModeStateHandler (state) {
        this.slowModeState = state;
        this.slowModeIndicator.state = this.slowModeState;
    }

    jobCreatedHandler ({jobId, fileName}) {
        const newJob = new Job(jobId, fileName);
        this.jobIds.set(jobId, newJob);
        newJob.state = Job.states.processing;
        this.webWorkerDo('processJob', newJob.id);
    }

    jobDeletedHandler (jobId) {
        const job = this.jobIds.get(jobId);
        job.remove();
        this.jobIds.delete(job.id);
    }

    jobCancelledHandler (jobId) {
        const job = this.jobIds.get(jobId);
        job.state = Job.states.cancelled;
    }

    bytesReadHandler ({jobId, percent}) {
        const job = this.jobIds.get(jobId);
        job.progress = percent;
        job.state = Job.states.reading;
    }

    fileReadOKHandler ({jobId, contents}) {
        const job = this.jobIds.get(jobId);
        if (this.developmentMode) {
            const HEX_RADIX = 16;
            const TARGET_LENGTH = 2;
            const PAD_STRING = '0';
            if (typeof contents === 'undefined') {
                job.debugMarker = 'empty file';
            } else {
                job.debugMarker = `data <0x${contents.toString(HEX_RADIX).padStart(TARGET_LENGTH, PAD_STRING)}>`;
            }
        }
        job.state = Job.states.processed;
    }

    fileReadErrorHandler ({jobId, error}) {
        const job = this.jobIds.get(jobId);
        if (error.name in Job.errors) {
            job.error = error.name;
            job.state = Job.states.error;
        } else {
            // Unexpected error condition that should not happen in production.
            throw new FatalError(`Error «${error.name}» leyendo el fichero «${error.fileName}»`, error.message);
        }
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});


console.info('Main script processed.');
