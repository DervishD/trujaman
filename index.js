'use strict';


// Very crude default function for showing errors to the end user.
//
// Works even if the page is not fully loaded, so it is a last resort.
globalThis.showError = function showError (message) {
    alert(`¡Error inesperado!\n${message}\nCompruebe la consola para más detalles.`); // eslint-disable-line no-alert
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
            location = new URL(event.filename).pathname.substring(1);
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

    console.error(`${message}${location ? `\n\n${location}` : ''}${details ? `\n\n${details}` : ''}`);
    globalThis.showError(message, location, details);
    event.preventDefault();
});


globalThis.addEventListener('unhandledrejection', event => {
    globalThis.reportError(event.reason);
    event.preventDefault();
});


class Job {
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
            event.target.dispatchEvent(new CustomEvent('dismissjob', {'detail': this, 'bubbles': true}));
        }, {'once': true});

        this.cancelButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent('canceljob', {'detail': this, 'bubbles': true}));
        }, {'signal': this.controller.signal});

        this.retryButton.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent('retryjob', {'detail': this, 'bubbles': true}));
        }, {'signal': this.controller.signal});

        this.element.querySelector('.job_download_dropdown').addEventListener('click', () => {
            const formatsList = this.element.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        }, {'signal': this.controller.signal});
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
        }
    }
}


class UI {
    constructor () {
        this.filePicker = document.querySelector('#filepicker');
        this.filePickerInput = this.filePicker.querySelector('input');
        this.filePickerButton = this.filePicker.querySelector('button');
        this.jobsContainer = document.querySelector('#jobs');
        this.version = document.querySelector('#version');
        this.slowMode = document.querySelector('#slow_mode');
        this.errorTemplate = document.querySelector('#error_template');
        this.formatsDropdown = document.querySelector('#job_template').content.querySelector('.job_formats_list');
        this.lastError = null;

        this.slowMode.addEventListener('click', () => {
            globalThis.dispatchEvent(new CustomEvent('slowmodetoggle'));
        });

        this.filePicker.hidden = false;
        this.filePickerButton.focus();
        this.filePickerButton.addEventListener('click', () => {
            this.filePickerInput.click();
        });
        this.filePickerInput.addEventListener('change', event => {
            globalThis.dispatchEvent(new CustomEvent('processfiles', {'detail': event.target.files}));
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        this.jobsContainer.hidden = false;

        // This feature is entirely optional.
        // Detection is performed by testing for the existence of the drag and
        // drop events used. This is not orthodox but works well enough.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in globalThis)) {
            const dropzone = document.querySelector('#dropzone');

            dropzone.hidden = false;
            dropzone.dataset.state = 'hidden';

            globalThis.addEventListener('dragenter', () => { dropzone.dataset.state = 'visible'; });
            dropzone.addEventListener('dragleave', () => { dropzone.dataset.state = 'hidden'; });

            // This is needed because otherwise the page is NOT a valid drop target,
            // and when the file is dropped the default action is performed by the browser.
            dropzone.addEventListener('dragover', event => { event.preventDefault(); });

            dropzone.addEventListener('drop', event => {
                dropzone.dataset.state = 'dismissed';
                globalThis.dispatchEvent(new CustomEvent('processfiles', {'detail': event.dataTransfer.files}));
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }
    }

    populateFormatsDropdown (formats) {
        for (const format in formats) {
            const paragraph = document.createElement('p');
            paragraph.textContent = format;
            this.formatsDropdown.append(paragraph);
        }
    }

    showVersion (version) {
        this.version.hidden = false;
        this.version.textContent += `v${version}`;
    }

    showSlowModeStatus (status) {
        this.slowMode.hidden = false;
        this.slowMode.textContent = status ? '⊖' : '⊕';
    }

    showError (message, location, details) {
        if (!this.lastError) {
            for (const job of this.jobsContainer.querySelectorAll('.job:not([hidden])')) {
                job.querySelector('.job_dismiss_button').click();
            }

            // Disable UI interaction by removing the file picker.
            this.filePicker.remove();
            delete this.filePicker;

            // At this point no further interaction with the page is possible so the
            // application is effectively stopped, even though it is still running…

            // Use the hidden template as insertion point.
            this.lastError = this.errorTemplate;
        }

        const errorElement = this.errorTemplate.cloneNode(true);

        errorElement.querySelector('.error_header').textContent = '¡ERROR, la aplicación no puede funcionar!';
        errorElement.querySelector('.error_message').textContent = message;
        errorElement.querySelector('.error_location').textContent = location;
        errorElement.querySelector('.error_details').textContent = details.trim();

        // Errors are shown in a first-happenned, first-shown manner.
        this.lastError.nextSibling.before(errorElement);
        errorElement.hidden = false;
        this.lastError = errorElement;
    }

    showJob (job) {
        this.jobsContainer.append(job);
    }
}


class Presenter {
    constructor () {
        // For keeping track of jobs.
        //
        // Since the Presenter has to keep a bijection map between job objects
        // as returned by the View and job ids as returned by the web worker,
        // for converting between them as needed, it would be necessary to keep
        // two different maps. BUT, since it's impossible that a View object
        // will collide with a web worker job id, BOTH of them can be added to
        // the same Map() and that way it will work as a bijection.
        this.jobs = new Map();
        this.developmentMode = false;
    }

    async run () {
        this.initView();
        await this.initServiceWorker('sw.js');
        await this.loadFormats('formats.json');
        this.initWebWorker('ww.js');

        if (this.developmentMode) {
            this.webWorkerDo('slowModeToggle');
        }
    }

    async loadFormats (formatsFile) {
        const response = await fetch(formatsFile);
        if (response.ok) {
            try {
                const formats = await response.json();
                this.view.populateFormatsDropdown(formats);
            } catch (error) {
                throw new FatalError('No se pudo procesar el fichero con la lista de formatos.', error);
            }
        } else {
            throw new FatalError('No se encontró el fichero con la lista de formatos.');
        }
    }

    initView () {
        globalThis.addEventListener('processfiles', event => {
            const files = event.detail;
            for (const file of files) {
                this.webWorkerDo('createJob', file);
            }
        });

        globalThis.addEventListener('slowmodetoggle', () => {
            this.webWorkerDo('slowModeToggle');
        });

        globalThis.addEventListener('dismissjob', event => {
            const job = event.detail;
            this.webWorkerDo('deleteJob', job.jobId);
        });

        globalThis.addEventListener('canceljob', event => {
            const job = event.detail;
            job.setStatusMessage('Cancelando el fichero…');
            this.webWorkerDo('cancelJob', job.jobId);
        });

        globalThis.addEventListener('retryjob', event => {
            const job = event.detail;
            job.setState('retrying');
            this.webWorkerDo('retryJob', job.jobId);
        });

        this.view = new UI();

        // Now that the UI is up and running, a new error printing function
        // which shows the errors on the main web page can be set.
        globalThis.showError = this.view.showError.bind(this.view);
    }

    async initServiceWorker (serviceWorker) {
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
                    this.view.showVersion(version);
                    // Enable development mode ONLY for prereleases which are NOT release candidates.
                    if (version.includes('-') && !version.includes('-rc')) {
                        this.developmentMode = true;
                    }
                }
            });
        });

        try {
            await navigator.serviceWorker.register(serviceWorker);
        } catch (error) {
            // Service workers are considered site data, so cookies have to be enabled for the application to work.
            if (navigator.cookieEnabled) {
                throw new FatalError('No se pudo iniciar el service worker.', error);
            } else {
                throw new FatalError('Las cookies están desactivadas.', error);
            }
        }
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

    webWorkerDo (command, ...args) {
        console.debug(`Sending command '${command}'`, args);
        this.worker.postMessage({command, args});
    }

    handleWebWorkerMessage (message) {
        const {reply, args} = message.data;
        console.debug(`Received reply '${reply}'`, args);

        const [jobId] = args;  // Needed for most of the replies, so…
        const job = this.jobs.get(jobId);  // Idem…

        switch (reply) {
        case 'slowModeStatus':
            this.view.showSlowModeStatus(args[0]);
            break;
        case 'jobCreated': {
            const [, fileName] = args;
            const newJob = new Job(jobId, fileName);
            this.jobs.set(jobId, newJob);
            this.view.showJob(newJob.element);
            newJob.setState('processing');
            this.webWorkerDo('processJob', jobId);
            break;
        }
        case 'jobDeleted':
            job.element.remove();
            this.jobs.delete(jobId);
            break;
        case 'jobCancelled':
            job.setState('cancelled');
            job.setStatusMessage('Lectura cancelada.');
            break;
        case 'bytesRead':
            job.setStatusMessage(`Leyendo el fichero (${args[1]}%).`);
            break;
        case 'fileReadOK': {
            let marker = typeof args[1] === 'undefined' ? '××' : `0x${args[1].toString(16).padStart(2, 0)}`;
            marker = `<span class="monospaced">[${marker}]</span>`;
            job.setState('processed');
            job.setStatusMessage(`El fichero se leyó correctamente. ${marker}, ${jobId}`);
            break;
        }
        case 'fileReadError': {
            const [, error] = args;
            const errorMessages = {
                'FileTooLargeError': 'el fichero es muy grande',
                'NotFoundError': 'el fichero no existe',
                'NotReadableError': 'el fichero no se puede leer',
                'SecurityError': 'el fichero no se puede leer de forma segura'
            };
            job.setState('error');
            if (error.name in errorMessages) {
                let statusMessage = `ERROR: ${errorMessages[error.name]}`;
                statusMessage += ` <span class="monospaced">(${error.name})</span>.`;
                job.setStatusMessage(statusMessage);
            } else {
                // Unexpected error condition that should not happen in production.
                throw new FatalError(`Error «${error.name}» leyendo el fichero «${error.fileName}»`, error.message);
            }
            break;
        }
        case 'commandNotFound':
            throw new FatalError(`El web worker no reconoce el comando «${args[0]}».`);
        default:
            throw new FatalError(`No se reconoce la respuesta del web worker «${reply}».`);
        }
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});
