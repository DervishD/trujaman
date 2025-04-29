import {version} from './version.js';
import {commands, replies, customEvents} from './contracts.js';
import * as MSG from './strings.js';
import * as C from './constants.js';


class FatalError extends Error {
    constructor (message, details = '') {
        super(`${message}.`);
        this.details = details;
        this.name = new.target.name;
    }
}


// Default handler for unhandled errors which should not happen in production.
globalThis.addEventListener('error', event => {
    event.preventDefault();

    const error = event instanceof ErrorEvent ? event.error : {name: event.constructor.name, message: ''};

    const message = MSG.ERROR_MESSAGE(error.name, error.message);  // eslint-disable-line new-cap
    let location = '';
    let details = event.message || '';

    if (event.filename) {
        let {filename, lineno, colno} = event;

        try {
            const FROM_SLASH = 1;
            filename = new URL(filename).pathname.substring(FROM_SLASH);
        } catch (exc) {
            if (!(exc instanceof TypeError)) throw exc;
        }
        if (typeof lineno !== 'number') lineno = MSG.NOT_AVAILABLE;
        if (typeof colno !== 'number') colno = MSG.NOT_AVAILABLE;

        location = MSG.ERROR_LOCATION(filename, lineno, colno);  // eslint-disable-line new-cap
    }

    if (error.stack) {
        details += details ? MSG.ERROR_STACK_DUMP_SEPARATOR : '';
        details += MSG.ERROR_STACK_DUMP_HEADER;
        for (const line of error.stack.trim().split('\n')) {
            details += MSG.ERROR_STACK_DUMP_FRAME(line);  // eslint-disable-line new-cap
        }
    }

    details = details.trim();

    const errorTemplate = document.querySelector(C.S_ERROR_TEMPLATE);

    // Disable UI interaction by removing all page elements.
    Array.from(document.body.children).forEach(element => {
        if (!element.matches(C.S_KEEP_ON_ERROR)) element.remove();
    });

    // At this point no further interaction with the page is possible so the
    // application is effectively stopped, even though it is still running…

    const errorElement = errorTemplate.content.firstElementChild.cloneNode(true);

    errorElement.querySelector(C.S_ERROR_HEADER).textContent = MSG.APP_STOPPED;
    errorElement.querySelector(C.S_ERROR_MESSAGE).textContent = message;

    const errorLocationElement = errorElement.querySelector(C.S_ERROR_LOCATION);
    if (location) {
        errorLocationElement.textContent = location;
    } else errorLocationElement.hidden = true;

    const errorDetailsElement = errorElement.querySelector(C.S_ERROR_DETAILS);
    if (details) {
        errorDetailsElement.textContent = details;
    } else errorDetailsElement.hidden = true;

    errorTemplate.before(errorElement);

    console.error(MSG.ERROR_FULL_DUMP(message, location, details));  // eslint-disable-line new-cap
});


globalThis.addEventListener('unhandledrejection', event => {
    event.preventDefault();
    globalThis.reportError(event.reason);
});


class UI {
    constructor () {
        document.querySelector(C.S_VERSION_TEXT).textContent = `v${version}`;

        this.formatsList = document.querySelector(C.S_JOB_TEMPLATE).content.querySelector(C.S_JOB_FORMATS_LIST);

        this.slowModeIndicator = document.querySelector(C.S_SLOW_MODE_INDICATOR);
        this.slowModeIndicator.addEventListener('click', () => {
            globalThis.dispatchEvent(new CustomEvent(customEvents.slowModeToggle));
        });

        this.defaultControl = document.querySelector(C.S_DEFAULT_CONTROL);

        this.filePicker = document.querySelector(C.S_FILEPICKER);
        this.filePicker.addEventListener('click', () => {
            this.filePicker.querySelector(C.S_FILEPICKER_INPUT).click();
        });
        this.filePicker.addEventListener('change', event => {
            globalThis.dispatchEvent(new CustomEvent(customEvents.processFiles, {detail: event.target.files}));
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        // This feature is entirely optional.
        // Detection is performed by testing for the existence of the drag and drop events used.
        // This is not orthodox but works well enough.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in globalThis)) {
            this.dropZone = document.querySelector(C.S_DROPZONE);
            globalThis.addEventListener('dragenter', () => { this.dropZone.dataset.state = C.DROPZONE_VISIBLE; });
            this.dropZone.addEventListener('dragleave', () => { this.dropZone.dataset.state = C.DROPZONE_HIDDEN; });

            // This is needed because otherwise the page is NOT a valid drop target,
            // and when the file is dropped the default action is performed by the browser.
            this.dropZone.addEventListener('dragover', event => { event.preventDefault(); });

            this.dropZone.addEventListener('drop', event => {
                this.dropZone.dataset.state = C.DROPZONE_DISMISSED;
                const {files} = event.dataTransfer;
                globalThis.dispatchEvent(new CustomEvent(customEvents.processFiles, {detail: files}));
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }
    }

    show () {
        this.filePicker.hidden = false;
        this.defaultControl.focus();
        if (this.dropZone) {
            this.dropZone.hidden = false;
            this.dropZone.dataset.state = C.DROPZONE_HIDDEN;
        }
        document.querySelector(C.S_LOGO).dataset.state = C.APP_RUNNING;
    }

    showSlowModeIndicator () {
        this.slowModeIndicator.hidden = false;
    }

    set formats (formats) {
        const template = document.querySelector(C.S_DOWNLOADABLE_FORMAT_TEMPLATE).content.firstElementChild;
        formats.forEach(format => {
            const element = template.cloneNode(true);
            element.querySelector(C.S_DOWNLOADABLE_FORMAT_NAME).textContent = format;
            this.formatsList.append(element);
        });
    }

    set slowMode (state) {
        this.slowModeIndicator.textContent = state ? MSG.UPLOAD_MODE_SLOW : MSG.UPLOAD_MODE_FAST;
    }
}


class Job {
    static states = {
        processing: Symbol(MSG.JOB_STATE_PROCESSING),
        reading: Symbol(MSG.JOB_STATE_READING),
        processed: Symbol(MSG.JOB_STATE_PROCESSED),
        error: Symbol(MSG.JOB_STATE_ERROR),
    };

    static errors = {
        FileTooLargeError: MSG.FILE_TOO_LARGE,
        NotFoundError: MSG.FILE_NOT_FOUND,
        NotReadableError: MSG.FILE_NOT_READABLE,
        SecurityError: MSG.FILE_SECURITY_ERROR,
    };

    constructor (id, fileName) {
        this.id = id;
        this.progressString = '';
        this.debugInfo = '';
        this.errorName = '';

        this.element = document.querySelector(C.S_JOB_TEMPLATE).content.firstElementChild.cloneNode(true);
        this.element.querySelector(C.S_JOB_FILENAME).textContent = fileName;

        this.message = this.element.querySelector(C.S_JOB_MESSAGE);

        this.jobDismissControl = this.element.querySelector(C.S_JOB_DISMISS);
        this.downloadDropdown = this.element.querySelector(C.S_JOB_DOWNLOAD_DROPDOWN);

        this.controller = new AbortController();

        this.jobDismissControl.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent(customEvents.jobDismiss, {detail: this, bubbles: true}));
        }, {once: true});

        this.downloadDropdown.addEventListener('click', () => {
            const formatsList = this.element.querySelector(C.S_JOB_FORMATS_LIST);
            formatsList.hidden = !formatsList.hidden;
        }, {signal: this.controller.signal});

        document.querySelector(C.S_JOBS_CONTAINER).append(this.element);
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
        case Job.states.reading:
            this.message.innerHTML += `(${this.progressString}%).`;
            break;
        case Job.states.processed:
            this.message.innerHTML += this.debugInfo;
            this.downloadDropdown.hidden = false;
            break;
        case Job.states.error:
            this.message.innerHTML += `${Job.errors[this.errorName]}.`;
            this.downloadDropdown.hidden = true;
            break;
        default:
        }
    }
}


class Presenter {
    constructor () {
        this.jobIds = new Map();
        this.UI = new UI();
        this.handlers = {};
        Object.keys(replies).forEach(reply => {
            const handler = `${reply}Handler`;
            this.handlers[reply] = handler in this ? this[handler].bind(this) : null;
        });
    }

    run () {
        this.initServiceWorker(C.SERVICE_WORKER_URL);
        this.initWebWorker(C.WEB_WORKER_URL);
        this.initCustomEventHandlers();

        fetch(C.FORMATS_URL)
        .then(response => {
            if (!response.ok) {
                throw new FatalError(MSG.FORMATS_NOT_FOUND);
            }
            return response.json();
        })
        .then(formats => {
            this.webWorkerDo(commands.registerFormats, formats);
            this.UI.formats = Object.keys(formats);
        })
        .catch(error => {
            throw new FatalError(MSG.CANNOT_PROCESS_FORMATS, error);
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

        navigator.serviceWorker.ready.then(() => {
            this.UI.show();
        });

        navigator.serviceWorker.register(serviceWorker, {type: 'module'})
        .catch(error => {
            // Service workers are considered site data, so cookies have to be enabled for the application to work.
            if (navigator.cookieEnabled) {
                throw new FatalError(MSG.CANNOT_RUN_SW, error);
            } else {
                throw new FatalError(MSG.COOKIES_ARE_DISABLED, error);
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
                throw new FatalError(MSG.WW_SYNTAX(event.lineno), event.message);  // eslint-disable-line new-cap
            } else {
                // For loading errors the error will be an Event.
                throw new FatalError(MSG.CANNOT_RUN_WW);
            }
        });
    }

    initCustomEventHandlers () {
        globalThis.addEventListener(customEvents.processFiles, event => {
            const files = event.detail;
            for (const file of files) {
                this.webWorkerDo(commands.createJob, file);
            }
        });

        globalThis.addEventListener(customEvents.slowModeToggle, () => {
            this.webWorkerDo(commands.slowModeToggle);
        });

        globalThis.addEventListener(customEvents.jobDismiss, event => {
            const job = event.detail;
            this.webWorkerDo(commands.deleteJob, job.id);
        });
    }

    webWorkerDo (command, payload) {
        console.debug(MSG.WW_SENDING_COMMAND(command), payload);  // eslint-disable-line new-cap
        this.worker.postMessage({command, payload});
    }

    handleWebWorkerMessage (message) {
        const {reply, payload} = message.data;
        console.debug(MSG.WW_RECEIVED_REPLY(reply), payload);  // eslint-disable-line new-cap

        if (reply === replies.commandNotFound) {
            const command = payload;
            throw new FatalError(MSG.UNKNOWN_WW_COMMAND(command));  // eslint-disable-line new-cap
        }

        if (this.handlers[reply]) {
            this.handlers[reply](payload);
        } else {
            throw new FatalError(MSG.UNKNOWN_WW_REPLY(reply));  // eslint-disable-line new-cap
        }
    }

    showSlowModeIndicatorHandler () {
        this.UI.slowMode = true;
        this.UI.showSlowModeIndicator();
    }

    slowModeStateHandler (state) {
        this.UI.slowMode = state;
    }

    jobCreatedHandler ({jobId, fileName}) {
        const newJob = new Job(jobId, fileName);
        this.jobIds.set(jobId, newJob);
        newJob.state = Job.states.processing;
        this.webWorkerDo(commands.processJob, newJob.id);
    }

    jobDeletedHandler (jobId) {
        const job = this.jobIds.get(jobId);
        job.remove();
        this.jobIds.delete(job.id);
    }

    bytesReadHandler ({jobId, percent}) {
        const job = this.jobIds.get(jobId);
        job.progress = percent;
        job.state = Job.states.reading;
    }

    fileReadCompleteHandler ({jobId, contents}) {
        const job = this.jobIds.get(jobId);
        const data = new Uint8Array(contents);
        console.debug(contents);
        if (version.isPrerelease()) job.debugMarker = MSG.JOB_DEBUGMARKER(data);  // eslint-disable-line new-cap
        job.state = Job.states.processed;
    }

    fileTooLargeHandler (jobId) {
        const job = this.jobIds.get(jobId);
        job.error = Object.keys(Job.errors).find(property => Job.errors[property] === Job.errors.FileTooLargeError);
        job.state = Job.states.error;
    }

    fileReadErrorHandler ({jobId, error}) {
        const job = this.jobIds.get(jobId);
        if (error.name in Job.errors) {
            job.error = error.name;
            job.state = Job.states.error;
        } else {
            // Unexpected error condition that should not happen in production.
            throw new FatalError(MSG.FILE_READ(error), error.message);  // eslint-disable-line new-cap
        }
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});


console.info(MSG.SCRIPT_PROCESSED('Main'));  // eslint-disable-line new-cap
