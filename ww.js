import {version} from './version.js';
import {commands, replies} from './contracts.js';
import {MAX_FILE_SIZE, PERCENT_FACTOR, FILE_READING_DELAY_MILLISECONDS} from './constants.js';
import * as MSG from './strings.js';


const handlers = Object.fromEntries(Object.keys(commands).map(command => [command, null]));

let knownFormats = null;
const jobs = new Map();

let slowMode = Boolean(version.prerelease);  // Enabled by default on prereleases.
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


const generateJobId = (function *generateJobId () {
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


handlers.registerFormats = registerFormatsHandler;
function registerFormatsHandler (formats) {
    knownFormats = formats;
}


handlers.slowModeToggle = slowModeToggleHandler;
function slowModeToggleHandler () {
    slowMode = !slowMode;
    postReply(replies.slowModeState, slowMode);
}


handlers.createJob = createJobHandler;
function createJobHandler (file) {
    const job = {file, reader: null};
    const jobId = generateJobId.next().value;

    if (typeof jobId === 'undefined' || !knownFormats) {
        return;
    }

    job.reader = new FileReader();

    job.reader.onprogress = event => {
        const percent = event.total ? Math.floor(PERCENT_FACTOR * event.loaded / event.total) : PERCENT_FACTOR;

        if (slowMode) {
            const start = Date.now(); while (Date.now() - start < FILE_READING_DELAY_MILLISECONDS);
        }
        postReply(replies.bytesRead, {jobId, percent});
    };

    job.reader.onerror = event => {
        const error = {
            name: event.target.error.name,
            message: event.target.error.message,
            fileName: job.file.name,
        };
        postReply(replies.fileReadError, {jobId, error});
    };
    job.reader.onload = event => {
        const contents = event.target.result;
        postReply(replies.fileReadComplete, {jobId, contents}, [contents]);
    };
    job.reader.onabort = () => {
        postReply(replies.jobCancelled, jobId);
    };

    jobs.set(jobId, job);
    postReply(replies.jobCreated, {jobId, fileName: job.file.name});
}


handlers.processJob = processJobHandler;
handlers.retryJob = processJobHandler;
function processJobHandler (jobId) {
    const job = jobs.get(jobId);

    if (job.file.size > MAX_FILE_SIZE) {
        postReply(replies.fileTooLarge, jobId);
    } else {
        // The file is read using the HTML5 File API.
        // Read the file as ArrayBuffer.
        job.reader.readAsArrayBuffer(job.file);
    }
}


handlers.cancelJob = cancelJobHandler;
function cancelJobHandler (jobId) {
    const job = jobs.get(jobId);
    job.reader.abort();
}


handlers.deleteJob = deleteJobHandler;
function deleteJobHandler (jobId) {
    const job = jobs.get(jobId);
    job.reader.abort();
    job.reader.onload = null;
    job.reader.onerror = null;
    job.reader.onabort = null;
    jobs.delete(jobId);
    postReply(replies.jobDeleted, jobId);
}


console.info(MSG.SCRIPT_PROCESSED('Web Worker'));  // eslint-disable-line new-cap
