'use strict';


globalThis.showError = function showError (message, location, details) {
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

    globalThis.showError(message, location, details);
    event.preventDefault();
});


globalThis.addEventListener('unhandledrejection', event => {
    globalThis.reportError(event.reason);
    event.preventDefault();
});


class JobView {
    constructor (jobId, fileName) {
        this.jobId = jobId;

        this.element = document.getElementById('job_template').content.firstElementChild.cloneNode(true);
        this.element.querySelector('.job_filename').textContent = fileName;

        this.statusMessage = this.element.querySelector('.job_status_message');

        this.dismissButton = this.element.querySelector('.job_dismiss_button');
        this.retryButton = this.element.querySelector('.job_retry_button');
        this.cancelButton = this.element.querySelector('.job_cancel_button');
        this.downloadDropdown = this.element.querySelector('.job_download_dropdown');

        this.controller = new AbortController();

        this.dismissButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent('custom:dismissjob', {'detail': this, 'bubbles': true}));
        }, {'once': true});

        this.cancelButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent('custom:canceljob', {'detail': this, 'bubbles': true}));
        }, {'signal': this.controller.signal});

        this.retryButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent('custom:retryjob', {'detail': this, 'bubbles': true}));
        }, {'signal': this.controller.signal});

        this.element.querySelector('.job_download_dropdown').addEventListener('click', () => {
            const formatsList = this.element.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        }, {'signal': this.controller.signal});

        document.querySelector('#jobs').append(this.element);
    }

    static setDownloadFormats (formats) {
        const formatsDropdown = document.querySelector('#job_template').content.querySelector('.job_formats_list');
        formats.forEach(format => {
            const paragraph = document.createElement('p');
            paragraph.textContent = format;
            formatsDropdown.append(paragraph);
        });
    }

    remove () {
        // Remove event listeners before removing the DOM element.
        // Not really needed, apparently, but it's the Tao.
        this.controller.abort();
        this.element.remove();
    }

    setStatusMessage (statusMessage) {
        this.statusMessage.innerHTML = statusMessage;
    }

    setState (state) {
        switch (state) {
        case 'processing':
        case 'retrying':
            this.retryButton.hidden = true;
            this.cancelButton.hidden = false;
            break;
        case 'processed':
            this.cancelButton.hidden = true;
            this.downloadDropdown.hidden = false;
            break;
        case 'cancelled':
            this.cancelButton.hidden = true;
            this.retryButton.hidden = false;
            break;
        case 'error':
            this.cancelButton.hidden = true;
            this.retryButton.hidden = true;
            this.downloadDropdown.hidden = true;
            break;
        // No default
        }
    }
}


class SlowModeIndicator {
    constructor () {
        this.element = document.querySelector('#slow_mode');
    }

    show () {
        this.element.addEventListener('click', () => {
            globalThis.dispatchEvent(new CustomEvent('custom:slowmodetoggle'));
        });
        this.element.hidden = false;
    }

    setState (state) {
        this.element.textContent = state ? '⊖' : '⊕';
    }
}


class VersionIndicator {
    static show (version) {
        document.querySelector('#version').textContent += `v${version}`;
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
            globalThis.dispatchEvent(new CustomEvent('custom:processfiles', {'detail': event.target.files}));
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
            globalThis.dispatchEvent(new CustomEvent('custom:processfiles', {'detail': event.dataTransfer.files}));
            event.preventDefault();  // Prevent the browser from opening the file.
        });

        this.element.hidden = false;
        this.element.dataset.state = 'hidden';
    }
}


class Presenter {
    constructor () {
        this.jobViews = new Map();
        this.developmentMode = false;
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
        this.initView();

        fetch('formats.json')
        .then(response => {
            if (!response.ok) {
                throw new FatalError('No se encontró el fichero con la lista de formatos.');
            }
            return response.json();
        })
        .then(formats => {
            JobView.setDownloadFormats(Object.keys(formats));
            this.webWorkerDo('registerFormats', formats);
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
                        this.webWorkerDo('setSlowMode', this.slowModeState);
                    }
                }
            });
        });

        navigator.serviceWorker.register(serviceWorker)
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
        this.worker = new Worker(webWorker);
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
        globalThis.addEventListener('custom:processfiles', event => {
            const files = event.detail;
            for (const file of files) {
                this.webWorkerDo('createJob', file);
            }
        });

        globalThis.addEventListener('custom:slowmodetoggle', () => {
            this.slowModeState = !this.slowModeState;
            this.webWorkerDo('setSlowMode', this.slowModeState);
        });

        globalThis.addEventListener('custom:dismissjob', event => {
            const jobView = event.detail;
            this.webWorkerDo('deleteJob', jobView.jobId);
        });

        globalThis.addEventListener('custom:canceljob', event => {
            const jobView = event.detail;
            jobView.setStatusMessage('Cancelando el fichero…');
            this.webWorkerDo('cancelJob', jobView.jobId);
        });

        globalThis.addEventListener('custom:retryjob', event => {
            const jobView = event.detail;
            jobView.setState('retrying');
            this.webWorkerDo('retryJob', jobView.jobId);
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
        this.slowModeIndicator.setState(this.slowModeState);
    }

    jobCreatedHandler ({jobId, fileName}) {
        const newJobView = new JobView(jobId, fileName);
        this.jobViews.set(jobId, newJobView);
        newJobView.setState('processing');
        this.webWorkerDo('processJob', jobId);
    }

    jobDeletedHandler (jobId) {
        const jobView = this.jobViews.get(jobId);
        jobView.remove();
        this.jobViews.delete(jobId);
    }

    jobCancelledHandler (jobId) {
        const jobView = this.jobViews.get(jobId);
        jobView.setState('cancelled');
        jobView.setStatusMessage('Lectura cancelada.');
    }

    bytesReadHandler ({jobId, percent}) {
        const jobView = this.jobViews.get(jobId);
        jobView.setStatusMessage(`Leyendo el fichero (${percent}%).`);
    }

    fileReadOKHandler ({jobId, contents}) {
        const jobView = this.jobViews.get(jobId);
        let debugInfo = '';
        if (this.developmentMode) {
            const HEX_RADIX = 16;
            const TARGET_LENGTH = 2;
            const PAD_STRING = '0';
            debugInfo = `<br><span class="monospaced">jobId <${jobId}>`;
            if (typeof contents === 'undefined') {
                debugInfo += ', empty file';
            } else {
                debugInfo += `, data <0x${contents.toString(HEX_RADIX).padStart(TARGET_LENGTH, PAD_STRING)}>`;
            }
            debugInfo += '</span>';
        }
        jobView.setState('processed');
        jobView.setStatusMessage(`El fichero se leyó correctamente.${debugInfo}`);
    }

    fileReadErrorHandler ({jobId, error}) {
        const jobView = this.jobViews.get(jobId);
        const errorMessages = {
            'FileTooLargeError': 'el fichero es muy grande',
            'NotFoundError': 'el fichero no existe',
            'NotReadableError': 'el fichero no se puede leer',
            'SecurityError': 'el fichero no se puede leer de forma segura'
        };
        jobView.setState('error');
        if (error.name in errorMessages) {
            let statusMessage = `ERROR: ${errorMessages[error.name]}`;
            statusMessage += ` <span class="monospaced">(${error.name})</span>.`;
            jobView.setStatusMessage(statusMessage);
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
