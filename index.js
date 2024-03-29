'use strict';


// Very crude default function for showing errors to the end user.
//
// Works even if the page is not fully loaded, so it is a last resort.
const errorHeader = '¡ERROR, la aplicación no puede funcionar!';
globalThis.showError = function showError (reason, details) {
    globalThis.stop();
    alert(`${errorHeader}\n${reason}\n${details}`);  // eslint-disable-line no-alert
};


// Default handler for unhandled errors which should not happen in production.
globalThis.unexpectedErrorHandler = function unexpectedErrorHandler (event) {  // eslint-disable-line max-statements
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

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

    let reason = '';
    let error = '';
    if (event instanceof PromiseRejectionEvent) {
        error = event.reason;
        reason = 'PromiseRejectionEvent';
    } else {  // For ErrorEvent events.
        ({error} = event);
        reason = 'ErrorEvent';
    }

    reason += `${error && error.name ? `(${error.name})` : ''} sin gestionar.`;

    let details = '';
    if (error) {
        details += `[${error}]`;
        details += location ? `\n${location}` : '';
        if (error.stack) {
            details += '\nInformación de depurado:\n';
            for (const line of error.stack.trim().split('\n')) {
                details += `    ${line.trim()}\n`;
            }
        }
    }

    globalThis.showError(reason, details);
};


globalThis.addEventListener('error', globalThis.unexpectedErrorHandler);
globalThis.addEventListener('unhandledrejection', globalThis.unexpectedErrorHandler);


class UI {
    constructor () {
        this.eventSubscribers = {};
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
            this.emit('slowModeToggle');
        });

        this.filePicker.hidden = false;
        this.filePickerButton.focus();
        this.filePickerButton.addEventListener('click', () => {
            this.filePickerInput.click();
        });
        this.filePickerInput.addEventListener('change', event => {
            this.emit('processFiles', event.target.files);
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        this.jobsContainer.hidden = false;

        this.initDragAndDrop();
    }

    emit (event, payload) {
        this.eventSubscribers[event] && this.eventSubscribers[event](payload);
    }

    on (event, handler) {
        this.eventSubscribers[event] = handler;
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
                this.emit('processFiles', event.dataTransfer.files);
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }
    }

    populateFormatsDropdown (formats) {
        for (const format in formats) {
            const paragraph = document.createElement('p');
            paragraph.innerText = format;
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

    // Shows a detailed error message.
    //
    // The function accepts two parameters:
    //  1: The error reason, preferably a one-liner explaining (tersely) the main cause of the error.
    //  2: The details of the error, verbosely explaining the information about the error.
    showError (reason, details) {
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

        errorElement.querySelector('.error_header').innerText = errorHeader;
        errorElement.querySelector('.error_reason').innerText = reason;
        errorElement.querySelector('.error_details').innerText = details;

        // Errors are shown in a first-happenned, first-shown manner.
        this.lastError.nextSibling.before(errorElement);
        errorElement.hidden = false;
        this.lastError = errorElement;
    }

    createJob () {
        const newJob = document.getElementById('job_template').content.firstElementChild.cloneNode(true);

        const handleDismissClicked = function handleDismissClicked () { this.emit('dismissJob', newJob); }.bind(this);
        const dismissButton = newJob.querySelector('.job_dismiss_button');
        dismissButton.addEventListener('click', handleDismissClicked, {'once': true});

        const handleCancelClicked = function handleCancelClicked () { this.emit('cancelJob', newJob); }.bind(this);
        const cancelButton = newJob.querySelector('.job_cancel_button');
        cancelButton.addEventListener('click', handleCancelClicked);

        const handleRetryClicked = function handleRetryClicked () { this.emit('retryJob', newJob); }.bind(this);
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

    setJobFileName (job, fileName) {  // eslint-disable-line class-methods-use-this
        job.querySelector('.job_filename').textContent = fileName;
    }

    setJobStatus (job, status) {  // eslint-disable-line class-methods-use-this
        job.querySelector('.job_status').innerHTML = status;
    }

    setJobControls (job, state) {  // eslint-disable-line class-methods-use-this
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

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            globalThis.location.reload();
        });

        // For now, just prevent the default install handler to appear.
        globalThis.addEventListener('beforeinstallprompt', event => event.preventDefault());

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

    processJob (jobId) {
        this.view.setJobControls(this.jobs.get(jobId), 'processing');
        this.webWorkerDo('processJob', jobId);
    }

    initView () {
        this.view = new UI();

        this.view.on('processFiles', this.handleViewEventProcessFiles.bind(this));
        this.view.on('dismissJob', this.handleViewEventDismissJob.bind(this));
        this.view.on('cancelJob', this.handleViewEventCancelJob.bind(this));
        this.view.on('retryJob', this.handleViewEventRetryJob.bind(this));
        this.view.on('slowModeToggle', this.handleViewEventSlowModeToggle.bind(this));

        this.view.render();
    }

    handleViewEventProcessFiles (files) {
        for (const file of files) {
            this.webWorkerDo('createJob', file);
        }
    }

    handleViewEventDismissJob (jobId) {
        this.webWorkerDo('deleteJob', this.jobs.get(jobId));
    }

    handleViewEventCancelJob (jobId) {
        this.view.setJobStatus(jobId, 'Cancelando el fichero…');
        this.view.setJobControls(jobId, 'cancelled');
        this.webWorkerDo('cancelJob', this.jobs.get(jobId));
    }

    handleViewEventRetryJob (jobId) {
        this.processJob(this.jobs.get(jobId));
    }

    handleViewEventSlowModeToggle () {
        this.webWorkerDo('slowModeToggle');
    }

    async initServiceWorker (serviceWorker) {
        try {
            await navigator.serviceWorker.register(serviceWorker);
        } catch (error) {
            // Service workers are considered site data, so cookies have to be enabled for the application to work.
            if (navigator.cookieEnabled) {
                this.view.showError('Falló una parte esencial.', error);
            } else {
                this.view.showError('Las cookies están desactivadas.', error);
            }
        }
    }

    async loadFormats (formatsFile) {
        try {
            const response = await fetch(formatsFile);
            if (response.ok) {
                const formats = await response.json();
                this.view.populateFormatsDropdown(formats);
            } else {
                this.view.showError(
                    'No se encontró la lista de formatos.',
                    'El fichero conteniendo la lista de formatos no se encuentra disponible.'
                );
            }
        } catch (error) {
            this.view.showError('No se pudo procesar la lista de formatos.', error);
        }
    }

    initWebWorker (webWorker) {
        this.worker = new Worker(webWorker);
        this.worker.addEventListener('error', event => this.handleWebWorkerError(event));
        this.worker.addEventListener('message', event => this.handleWebWorkerMessages(event.data));
    }

    webWorkerDo (command, args) {
        this.worker.postMessage({
            command,
            args
        });
    }

    handleWebWorkerError (error) {
        if (error instanceof ErrorEvent) {
            // For syntax errors, that should not happen in production,
            // the event will be an ErrorEvent instance and will contain
            // information pertaining to the error.
            this.view.showError(
                'Error inesperado en el gestor de tareas en segundo plano.',
                `Error de sintaxis en línea ${error.lineno}\n(${error.message}).`
            );
        } else {
            // For loading errors the event will be Event.
            this.view.showError(
                'No se pueden ejecutar tareas en segundo plano.',
                'No se pudo iniciar el gestor de tareas en segundo plano.'
            );
        }
    }

    handleWebWorkerMessages (message) {
        const {reply, jobId, payload} = message;

        const handler = `handleWebWorkerReply${reply[0].toUpperCase()}${reply.slice(1)}`;
        if (handler in this) {
            this[handler](jobId, payload);
        } else {
            this.view.showError(
                'Se recibió un mensaje desconocido del web worker.',
                `El mensaje «${reply}» no pudo ser gestionado.`
            );
        }
    }

    handleWebWorkerReplyCommandNotFound (__, command) {
        this.view.showError(
            'Se envió un comando desconocido al web worker.',
            `El comando «${command}» no existe.`
        );
    }

    handleWebWorkerReplyJobCreated (jobId, fileName) {
        const newJob = this.view.createJob();
        this.jobs.set(newJob, jobId);
        this.jobs.set(jobId, newJob);
        this.view.setJobFileName(newJob, fileName);
        this.processJob(jobId);
    }

    handleWebWorkerReplyJobDeleted (jobId) {
        this.view.removeJob(this.jobs.get(jobId));
        this.jobs.delete(this.jobs.get(jobId));
        this.jobs.delete(jobId);
    }

    handleWebWorkerReplyJobCancelled (jobId) {
        this.view.setJobStatus(this.jobs.get(jobId), 'Lectura cancelada.');
    }

    handleWebWorkerReplyBytesRead (jobId, percent) {
        this.view.setJobStatus(this.jobs.get(jobId), `Leyendo el fichero (${percent}%).`);
    }

    handleWebWorkerReplyFileReadOK (jobId, data) {
        let marker = typeof data === 'undefined' ? '××' : `0x${data.toString(16).padStart(2, 0)}`;
        marker = `<span class="monospaced">[${marker}]</span>`;
        this.view.setJobStatus(this.jobs.get(jobId), `El fichero se leyó correctamente. ${marker}`);
        this.view.setJobControls(this.jobs.get(jobId), 'processed');
    }

    handleWebWorkerReplyFileReadError (jobId, error) {
        const errorMessages = {
            'FileTooLargeError': 'el fichero es muy grande',
            'NotFoundError': 'el fichero no existe',
            'NotReadableError': 'el fichero no se puede leer',
            'SecurityError': 'el fichero no se puede leer de forma segura'
        };
        this.view.setJobControls(this.jobs.get(jobId), 'error');
        if (error.name in errorMessages) {
            let status = `ERROR: ${errorMessages[error.name]}`;
            status += ` <span class="monospaced">(${error.name})</span>.`;
            this.view.setJobStatus(this.jobs.get(jobId), status);
        } else {
            // Unexpected error condition that should not happen in production.
            // So, it is notified differently, by using view.showError().
            this.view.showError(
                'Error inesperado leyendo un fichero.',
                `Ocurrió un error «${error.name}» leyendo el fichero «${error.fileName}».\n` +
                `${error.message}.`
            );
        }
    }

    handleWebWorkerReplySlowModeStatus (status) {
        this.view.showSlowModeStatus(status);
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});
