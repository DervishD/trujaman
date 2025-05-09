import {version} from './version.js';
import {commands, replies, customEvents} from './contracts.js';
import * as MSG from './strings.js';
import * as C from './constants.js';


class FatalError extends Error {
    constructor (message, details = '') {
        super(message);
        this.details = details;
        this.name = new.target.name;
    }
}


// Default handler for errors which should not happen in production.
globalThis.addEventListener('error', event => {
    event.preventDefault();

    globalThis.dispatchEvent(new Event(customEvents.interactionHalted));
    // At this point no further interaction with the page is possible so the
    // application is effectively stopped, even though it is still running…

    let errorMessage = MSG.ERROR_MESSAGE(MSG.DEFAULT_ERROR_NAME);
    let errorLocation = '';
    let errorDetails = '';
    let errorStack = '';

    if (event instanceof ErrorEvent) {
        errorMessage = MSG.ERROR_MESSAGE(event.error.name);
        errorDetails = event.error.message;
        errorStack = event.error.stack;

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

            errorLocation = MSG.ERROR_LOCATION(filename, lineno, colno);
        }
    }

    if (event.error instanceof FatalError) {
        errorMessage = event.error.message;
        errorDetails = event.error.details.message;
        if (event.error.details.stack) {
            errorStack += errorStack ? MSG.ERROR_SUBSTACK_SEPARATOR : '';
            errorStack += event.error.details.stack;
        }
    }

    errorDetails += errorDetails && !errorDetails.endsWith('.') ? '.' : '';

    if (errorStack) {
        errorDetails += errorDetails ? MSG.ERROR_STACK_DUMP_SEPARATOR : '';
        errorDetails += MSG.ERROR_STACK_DUMP_HEADER;
        for (const line of errorStack.trim().split('\n')) {
            errorDetails += MSG.ERROR_STACK_DUMP_FRAME(line);
        }
    }

    errorDetails = errorDetails.trim();

    reportError(errorMessage, errorLocation, errorDetails);
});


globalThis.addEventListener('unhandledrejection', event => {
    event.preventDefault();
    globalThis.reportError(event.reason);
});


function reportError(message, location, details) {
    const errorTemplate = document.querySelector(C.S_ERROR_TEMPLATE);
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

    console.error(MSG.ERROR_FULL_STR(message, location, details));
}


class UI {
    constructor () {
        this.halted = false;

        this.versionText = document.querySelector(C.S_VERSION_TEXT);
        this.versionText.textContent = MSG.TEXT_LOADING;

        this.formatsList = document.querySelector(C.S_JOB_TEMPLATE).content.querySelector(C.S_JOB_FORMATS_LIST);

        this.defaultControl = document.querySelector(C.S_DEFAULT_CONTROL);

        this.filePicker = document.querySelector(C.S_FILEPICKER);
        this.filePicker.addEventListener('click', () => {
            this.filePicker.querySelector(C.S_FILEPICKER_INPUT).click();
        });
        this.filePicker.addEventListener('change', event => {
            globalThis.dispatchEvent(new CustomEvent(customEvents.processingRequested, {detail: event.target.files}));
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        // This feature is entirely optional.
        // Detection is performed by testing for the existence of the drag and drop events used.
        // This is not orthodox but works well enough.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in globalThis)) {
            this.dropZone = document.querySelector(C.S_DROPZONE);
            globalThis.addEventListener('dragenter', () => {
                this.dropZone.dataset.state = C.DROPZONE_STATE_VISIBLE;
            });
            this.dropZone.addEventListener('dragleave', () => {
                this.dropZone.dataset.state = C.DROPZONE_STATE_HIDDEN;
            });

            // This is needed because otherwise the page is NOT a valid drop target,
            // and when the file is dropped the default action is performed by the browser.
            this.dropZone.addEventListener('dragover', event => { event.preventDefault(); });

            this.dropZone.addEventListener('drop', event => {
                this.dropZone.dataset.state = C.DROPZONE_STATE_DISMISSED;
                const {files} = event.dataTransfer;
                globalThis.dispatchEvent(new CustomEvent(customEvents.processingRequested, {detail: files}));
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }
    }

    show () {
        this.versionText.textContent = `v${version}`;

        if (this.halted) return;

        document.querySelector(C.S_DROPZONE_TEXT).textContent = MSG.TEXT_DROPZONE;
        document.querySelector(C.S_DEFAULT_CONTROL_TEXT).textContent = MSG.TEXT_DEFAULT_CONTROL;

        this.filePicker.hidden = false;
        this.defaultControl.focus();

        if (this.dropZone) {
            this.dropZone.hidden = false;
            this.dropZone.dataset.state = C.DROPZONE_STATE_HIDDEN;
        }
        document.querySelector(C.S_LOGO).dataset.state = C.APP_STATE_RUNNING;
    }

    halt () {
        this.halted = true;
        this.filePicker.remove();
        this.dropZone.remove();
        document.querySelector(C.S_JOBS_CONTAINER).hidden = true;
    }

    set formats (formats) {
        const template = document.querySelector(C.S_DOWNLOADABLE_FORMAT_TEMPLATE).content.firstElementChild;
        formats.forEach(format => {
            const element = template.cloneNode(true);
            element.querySelector(C.S_DOWNLOADABLE_FORMAT_NAME_TEXT).textContent = format;
            this.formatsList.append(element);
        });
    }
}


class Job {
    static states = {
        reading: Symbol(C.JOB_STATE_READING),
        processed: Symbol(C.JOB_STATE_PROCESSED),
        error: Symbol(C.JOB_STATE_ERROR),
    };

    static errors = {
        FileTooLargeError: MSG.FILE_TOO_LARGE,
        NotFoundError: MSG.FILE_NOT_FOUND,
        NotReadableError: MSG.FILE_NOT_READABLE,
        SecurityError: MSG.FILE_SECURITY_ERROR,
    };

    constructor (fileName) {
        this.progressString = '';
        this.errorName = '';

        this.element = document.querySelector(C.S_JOB_TEMPLATE).content.firstElementChild.cloneNode(true);
        this.element.querySelector(C.S_JOB_FILENAME_TEXT).textContent = fileName;

        this.message = this.element.querySelector(C.S_JOB_MESSAGE_TEXT);

        this.debugInfoElement = this.element.querySelector(C.S_JOB_DEBUG_INFO);
        this.debugInfoText = this.element.querySelector(C.S_JOB_DEBUG_INFO_TEXT);

        this.jobDismissControl = this.element.querySelector(C.S_JOB_DISMISS);
        this.downloadDropdown = this.element.querySelector(C.S_JOB_DOWNLOAD_DROPDOWN);
        this.downloadDropdown.querySelector(C.S_JOB_DOWNLOAD_DROPDOWN_TEXT).textContent = MSG.TEXT_DOWNLOAD_DROPDOWN;

        this.jobDismissControl.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent(customEvents.jobDismissed, {detail: this, bubbles: true}));
        }, {once: true});

        this.downloadDropdown.addEventListener('click', this.downloadDropdownEventListener = () => {
            const formatsList = this.element.querySelector(C.S_JOB_FORMATS_LIST);
            formatsList.hidden = !formatsList.hidden;
        });

        document.querySelector(C.S_JOBS_CONTAINER).append(this.element);
    }

    remove () {
        // Remove event listeners before removing the DOM element.
        // Not really needed, apparently, but it's the Tao.
        this.downloadDropdown.removeEventListener('click', this.downloadDropdownEventListener);
        this.element.remove();
    }

    set progress (progress) {
        console.error(progress);
        this.progressString = progress;
    }

    set error (error) {
        this.errorName = error;
    }

    set debugInfo (debugInfo) {
        if (!debugInfo) {
            this.debugInfoElement.hidden = true;
            return;
        }
        this.debugInfoElement.hidden = false;
        this.debugInfoText.textContent = debugInfo;
    }

    set state (state) {
        switch (state) {
        case Job.states.reading:
            this.message.textContent = MSG.JOB_STATE_READING(this.progressString);
            break;
        case Job.states.processed:
            this.message.textContent = MSG.JOB_STATE_PROCESSED;
            this.downloadDropdown.hidden = false;
            break;
        case Job.states.error:
            this.message.textContent = MSG.JOB_STATE_ERROR(Job.errors[this.errorName]);
            this.downloadDropdown.hidden = true;
            break;
        default:
        }
    }
}


class Presenter {
    constructor () {
        this.jobRegistry = new Map();
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
                const error = new Error(event.message);
                throw new FatalError(MSG.WW_SYNTAX(event.lineno, event.colno), error);
            } else {
                // For loading errors the error will be an Event.
                throw new FatalError(MSG.CANNOT_RUN_WW);
            }
        });
    }

    initCustomEventHandlers () {
        globalThis.addEventListener(customEvents.processingRequested, event => {
            const files = event.detail;
            for (const file of files) {
                this.webWorkerDo(commands.createJob, file);
            }
        });

        globalThis.addEventListener(customEvents.jobDismissed, event => {
            const job = event.detail;
            const jobId = this.jobRegistry.get(job);
            this.webWorkerDo(commands.deleteJob, jobId);
        });

        globalThis.addEventListener(customEvents.interactionHalted, () => {
            this.UI.halt();
            for (const job of this.jobRegistry.values()) {
                if (typeof job !== 'object') {
                    this.webWorkerDo(commands.deleteJob, job);
                }
            }
        });
    }

    webWorkerDo (command, payload) {
        console.debug(MSG.WW_SENDING_COMMAND(command), payload);
        this.worker.postMessage({command, payload});
    }

    handleWebWorkerMessage (message) {
        const {reply, payload} = message.data;
        console.debug(MSG.WW_RECEIVED_REPLY(reply), payload);

        if (reply === replies.commandNotFound) {
            const command = payload;
            throw new FatalError(MSG.UNKNOWN_WW_COMMAND(command));
        }

        if (this.handlers[reply]) {
            this.handlers[reply](payload);
        } else {
            throw new FatalError(MSG.UNKNOWN_WW_REPLY(reply));
        }
    }

    jobCreatedHandler ({jobId, fileName}) {
        const job = new Job(fileName);
        this.jobRegistry.set(jobId, job);
        this.jobRegistry.set(job, jobId);
        job.progress = 0;
        job.state = Job.states.reading;
        this.webWorkerDo(commands.processJob, jobId);
    }

    jobDeletedHandler (jobId) {
        const job = this.jobRegistry.get(jobId);
        job.remove();
        this.jobRegistry.delete(job);
        this.jobRegistry.delete(jobId);
    }

    bytesReadHandler ({jobId, percent}) {
        const job = this.jobRegistry.get(jobId);
        job.progress = percent;
        job.state = Job.states.reading;
    }

    fileReadCompleteHandler ({jobId, contents}) {
        const job = this.jobRegistry.get(jobId);
        const data = new Uint8Array(contents);
        console.debug(contents);
        if (version.isPrerelease()) job.debugInfo = MSG.JOB_DEBUG_INFO(jobId, data);
        job.state = Job.states.processed;
    }

    fileTooLargeHandler (jobId) {
        const job = this.jobRegistry.get(jobId);
        job.error = Object.keys(Job.errors).find(property => Job.errors[property] === Job.errors.FileTooLargeError);
        job.state = Job.states.error;
    }

    fileReadErrorHandler ({jobId, error}) {
        const job = this.jobRegistry.get(jobId);
        if (error.name in Job.errors) {
            job.error = error.name;
            job.state = Job.states.error;
        } else {
            // Unexpected error condition that should not happen in production.
            throw new FatalError(MSG.FILE_READ(error), new Error(error.message));
        }
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});


console.info(MSG.SCRIPT_PROCESSED('Main'));
