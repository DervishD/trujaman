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


class UI {
    constructor () {
        this.eventTarget = null;
        this.jobEventListeners = new Map();
        this.filePicker = document.querySelector('#filepicker');
        this.filePickerInput = this.filePicker.querySelector('input');
        this.filePickerButton = this.filePicker.querySelector('button');
        this.jobsContainer = document.querySelector('#jobs');
        this.version = document.querySelector('#version');
        this.slowMode = document.querySelector('#slow_mode');
        this.errorTemplate = document.querySelector('#error_template');
        this.formatsDropdown = document.querySelector('#job_template').content.querySelector('.job_formats_list');
        this.lastError = null;
    }

    render () {
        this.slowMode.addEventListener('click', () => {
            this.emit('slowmodetoggle');
        });

        this.filePicker.hidden = false;
        this.filePickerButton.focus();
        this.filePickerButton.addEventListener('click', () => {
            this.filePickerInput.click();
        });
        this.filePickerInput.addEventListener('change', event => {
            this.emit('processfiles', event.target.files);
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        this.jobsContainer.hidden = false;

        this.initDragAndDrop();
    }

    subscribe (eventTarget) {
        this.eventTarget = eventTarget;
    }

    emit (event, payload) {
        this.eventTarget && this.eventTarget.dispatchEvent(new CustomEvent(event, {'detail': payload}));
    }

    initDragAndDrop () {
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
                this.emit('processfiles', event.dataTransfer.files);
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

    createJob () {
        const newJob = document.getElementById('job_template').content.firstElementChild.cloneNode(true);

        const handleDismissClicked = function handleDismissClicked () { this.emit('dismissjob', newJob); }.bind(this);
        const dismissButton = newJob.querySelector('.job_dismiss_button');
        dismissButton.addEventListener('click', handleDismissClicked, {'once': true});

        const handleCancelClicked = function handleCancelClicked () { this.emit('canceljob', newJob); }.bind(this);
        const cancelButton = newJob.querySelector('.job_cancel_button');
        cancelButton.addEventListener('click', handleCancelClicked);

        const handleRetryClicked = function handleRetryClicked () { this.emit('retryjob', newJob); }.bind(this);
        const retryButton = newJob.querySelector('.job_retry_button');
        retryButton.addEventListener('click', handleRetryClicked);

        const handleDownloadClicked = function handleDownloadClicked () {
            const formatsList = newJob.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        };
        const downloadButton = newJob.querySelector('.job_download_dropdown');
        downloadButton.addEventListener('click', handleDownloadClicked);

        this.jobEventListeners.set(newJob, [
            [dismissButton, handleDismissClicked],
            [cancelButton, handleCancelClicked],
            [retryButton, handleRetryClicked],
            [downloadButton, handleDownloadClicked]
        ]);

        this.jobsContainer.append(newJob);
        return newJob;
    }

    removeJob (job) {
        // Remove event listeners first.
        // Not really needed, apparently, but it's the Tao.
        for (const [element, eventListener] of this.jobEventListeners.get(job)) {
            element.removeEventListener('click', eventListener);
        }
        job.remove();
    }

    setJobFileName (job, fileName) {
        job.querySelector('.job_filename').textContent = fileName;
    }

    setJobStatus (job, status) {
        job.querySelector('.job_status_message').innerHTML = status;
    }

    setJobControls (job, state) {
        switch (state) {
        case 'processing':
            job.querySelector('.job_retry_button').hidden = true;
            job.querySelector('.job_cancel_button').hidden = false;
            break;
        case 'processed':
            job.querySelector('.job_cancel_button').hidden = true;
            job.querySelector('.job_download_dropdown').hidden = false;
            break;
        case 'cancelled':
            job.querySelector('.job_cancel_button').hidden = true;
            job.querySelector('.job_retry_button').hidden = false;
            break;
        case 'error':
            job.querySelector('.job_cancel_button').hidden = true;
            job.querySelector('.job_retry_button').hidden = true;
            job.querySelector('.job_download_dropdown').hidden = true;
            break;
        }
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

        // Now that the UI is up and running, a new error printing function
        // which shows the errors on the main web page can be set.
        globalThis.showError = this.view.showError.bind(this.view);

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

    processJob (jobId) {
        this.view.setJobControls(this.jobs.get(jobId), 'processing');
        this.webWorkerDo('processJob', jobId);
    }

    initView () {
        this.view = new UI();
        const eventTarget = new EventTarget();

        eventTarget.addEventListener('slowmodetoggle', () => {
            this.webWorkerDo('slowModeToggle');
        });
        eventTarget.addEventListener('processfiles', event => {
            const files = event.detail;
            for (const file of files) {
                this.webWorkerDo('createJob', file);
            }
        });
        eventTarget.addEventListener('dismissjob', event => {
            const jobId = event.detail;
            this.webWorkerDo('deleteJob', this.jobs.get(jobId));
        });
        eventTarget.addEventListener('canceljob', event => {
            const jobId = event.detail;
            this.view.setJobStatus(jobId, 'Cancelando el fichero…');
            this.webWorkerDo('cancelJob', this.jobs.get(jobId));
        });
        eventTarget.addEventListener('retryjob', event => {
            const jobId = event.detail;
            this.processJob(this.jobs.get(jobId));
        });

        this.view.subscribe(eventTarget);
        this.view.render();
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

    webWorkerDo (command, args) {
        console.debug(`Sending command '${command}'`, args);
        this.worker.postMessage({
            command,
            args
        });
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
            const newJob = this.view.createJob();
            const [, fileName] = args;
            this.jobs.set(newJob, jobId);
            this.jobs.set(jobId, newJob);
            this.view.setJobFileName(newJob, fileName);
            this.processJob(jobId);
            break;
        }
        case 'jobDeleted':
            this.view.removeJob(job);
            this.jobs.delete(job);
            this.jobs.delete(jobId);
            break;
        case 'jobCancelled':
            this.view.setJobControls(job, 'cancelled');
            this.view.setJobStatus(job, 'Lectura cancelada.');
            break;
        case 'bytesRead':
            this.view.setJobStatus(job, `Leyendo el fichero (${args[1]}%).`);
            break;
        case 'fileReadOK': {
            let marker = typeof args[1] === 'undefined' ? '××' : `0x${args[1].toString(16).padStart(2, 0)}`;
            marker = `<span class="monospaced">[${marker}]</span>`;
            this.view.setJobControls(job, 'processed');
            this.view.setJobStatus(job, `El fichero se leyó correctamente. ${marker}`);
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
            this.view.setJobControls(job, 'error');
            if (error.name in errorMessages) {
                let status = `ERROR: ${errorMessages[error.name]}`;
                status += ` <span class="monospaced">(${error.name})</span>.`;
                this.view.setJobStatus(job, status);
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
