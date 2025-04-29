import {version} from './version.js';
import {commands, replies} from './contracts.js';
import {MAX_FILE_SIZE, PERCENT_FACTOR} from './constants.js';
import * as MSG from './strings.js';


const handlers = Object.fromEntries(Object.keys(commands).map(command => [command, null]));

let knownFormats = null;

let slowMode = version.isPrerelease();  // Enabled by default on prereleases.
if (slowMode) postReply(replies.showSlowModeIndicator);


globalThis.addEventListener('message', message => {
    const {command, payload} = message.data;
    console.debug(MSG.WW_RECEIVED_COMMAND(command), payload);  // eslint-disable-line new-cap

    if (handlers[command]) {
        handlers[command](payload);
    } else {
        postReply(replies.commandNotFound, command);
    }
});


function postReply (reply, payload, transferables = []) {
    console.debug(MSG.WW_SENDING_REPLY(reply), payload);  // eslint-disable-line new-cap
    globalThis.postMessage({reply, payload}, transferables);
}


handlers.registerFormats = registerFormatsHandler;
function registerFormatsHandler (formats) {
    knownFormats = formats;
}


handlers.slowModeToggle = slowModeToggleHandler;
function slowModeToggleHandler () {
    slowMode = !slowMode;
    postReply(replies.slowModeState, slowMode);
}


class Job {
    static jobRegistry = new Map();
    static generateId = (function *generateId () {
        // According to ECMA-262 Number.MAX_SAFE_INTEGER is (2^53)-1. So, even in an
        // scenario where 1000 jobs are added each millisecond, which is, in fact, a
        // bit optimistic, jobs could be added at that rate for a bit over 285 years
        // for the test below to be true.
        //
        // So, it is perfectly safe to end the generator in that case.
        let id = 0;
        while (Number.isSafeInteger(id)) {
            yield id++;
        }
    }());

    constructor (file, callbacks) {
        this.file = file;
        this.callbacks = callbacks;

        this.id = this.constructor.generateId.next().value;
        this.constructor.jobRegistry.set(this.id, this);

        this.reader = new FileReader();
        this.reader.onload = event => this.callbacks.onComplete(this.id, event.target.result);
        this.reader.onprogress = event => this.callbacks.onBytesRead(this.id, event.loaded);
        this.reader.onerror = event => {
            console.error(event);
            const error = {
                name: event.target.error.name,
                message: event.target.error.message,
                fileName: this.file,
            };
            this.callbacks.onError(this.id, error);
        }
    }

    readFile () {
        this.reader.readAsArrayBuffer(this.file);
    }

    cancel () {
        if (this.reader.readyState === this.reader.DONE) return false;
        this.reader.abort();
        return true;
    }

    delete () {
        this.file = null;
        this.reader.abort();
        this.reader.onload = null;
        this.reader.onerror = null;
        this.reader.onprogress = null;
        this.reader = null;
        this.callbacks = null;
        this.constructor.jobRegistry.delete(this.id);
    }
}


handlers.createJob = createJobHandler;
function createJobHandler (file) {
    const job = new Job(file, {
        onError: (jobId, error) => {
            postReply(replies.fileReadError, {jobId, error});
        },
        onBytesRead: (jobId, bytesRead) => {
            const percent = file.size ? Math.floor(PERCENT_FACTOR * bytesRead / file.size) : PERCENT_FACTOR;
            postReply(replies.bytesRead, {jobId, percent});
        },
        onComplete: (jobId, contents) => {
            postReply(replies.fileReadComplete, {jobId, contents}, [contents]);
        },
    });

    if (typeof job.id === 'undefined' || !knownFormats) return;

    postReply(replies.jobCreated, {jobId: job.id, fileName: job.file.name});
}


handlers.processJob = processJobHandler;
handlers.retryJob = processJobHandler;
function processJobHandler (jobId) {
    const job = Job.jobRegistry.get(jobId);

    if (job.file.size > MAX_FILE_SIZE) {
        postReply(replies.fileTooLarge, jobId);
        return;
    }

    job.readFile();
}


handlers.cancelJob = cancelJobHandler;
function cancelJobHandler (jobId) {
    const job = Job.jobRegistry.get(jobId);

    if (!job.cancel()) return;

    postReply(replies.jobCancelled, jobId);
}


handlers.deleteJob = deleteJobHandler;
function deleteJobHandler (jobId) {
    const job = Job.jobRegistry.get(jobId);

    job.delete();

    postReply(replies.jobDeleted, jobId);
}


console.info(MSG.SCRIPT_PROCESSED('Web Worker'));  // eslint-disable-line new-cap
