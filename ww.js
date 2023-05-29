globalThis.formats = null;
globalThis.jobs = new Map();

const MAX_FILE_SIZE_MIB = 99;

// For delaying for file reading operations so the UI can be tested better, in "slow mode".
globalThis.FILE_READING_DELAY_MILLISECONDS = 500;
globalThis.slowModeEnabled = false;


globalThis.postReply = (reply, payload) => {
    console.debug(`Sending reply '${reply}'`, payload);
    globalThis.postMessage({reply, payload});
};


globalThis.addEventListener('message', message => {
    const {command, payload} = message.data;
    console.debug(`Received command '${command}'`, payload);

    const handler = `${command}Handler`;
    if (handler in globalThis) {
        globalThis[handler](payload);
    } else {
        globalThis.postReply('commandNotFound', command);
    }
});


globalThis.generateJobId = (function *generateJobId () {
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

globalThis.createJobHandler = file => {
    const job = {file, reader: null};
    const jobId = globalThis.generateJobId.next().value;

    if (typeof jobId === 'undefined' || !globalThis.formats) {
        return;
    }

    job.reader = new FileReader();

    job.reader.onprogress = event => {
        const PERCENT_FACTOR = 100;
        const percent = event.total ? Math.floor(PERCENT_FACTOR * event.loaded / event.total) : PERCENT_FACTOR;

        if (globalThis.slowModeEnabled) {
            const start = Date.now(); while (Date.now() - start < globalThis.FILE_READING_DELAY_MILLISECONDS);
        }
        globalThis.postReply('bytesRead', {jobId, percent});
    };

    job.reader.onerror = event => {
        const error = {
            name: event.target.error.name,
            message: event.target.error.message,
            fileName: job.file.name,
        };
        globalThis.postReply('fileReadError', {jobId, error});
    };
    job.reader.onload = event => {
        const [contents] = new Uint8Array(event.target.result);
        globalThis.postReply('fileReadOK', {jobId, contents});
    };
    job.reader.onabort = () => {
        globalThis.postReply('jobCancelled', jobId);
    };

    globalThis.jobs.set(jobId, job);
    globalThis.postReply('jobCreated', {jobId, fileName: job.file.name});
};


globalThis.registerFormatsHandler = formats => {
    globalThis.formats = formats;
};


globalThis.setSlowModeHandler = state => {
    globalThis.slowModeEnabled = state;
    globalThis.postReply('slowModeState', globalThis.slowModeEnabled);
};


globalThis.processJobHandler = jobId => {
    const job = globalThis.jobs.get(jobId);
    const KIB_MULTIPLIER = 1024;

    if (job.file.size > MAX_FILE_SIZE_MIB * KIB_MULTIPLIER * KIB_MULTIPLIER) {
        const error = {
            name: 'FileTooLargeError',
            fileName: job.file.name,
        };
        globalThis.postReply('fileReadError', {jobId, error});
    } else {
        // The file is read using the HTML5 File API.
        // Read the file as ArrayBuffer.
        job.reader.readAsArrayBuffer(job.file);
    }
};
globalThis.retryJobHandler = globalThis.processJobHandler;


globalThis.cancelJobHandler = jobId => {
    const job = globalThis.jobs.get(jobId);
    job.reader.abort();
};


globalThis.deleteJobHandler = jobId => {
    const job = globalThis.jobs.get(jobId);
    job.reader.abort();
    job.reader.onload = null;
    job.reader.onerror = null;
    job.reader.onabort = null;
    globalThis.jobs.delete(jobId);
    globalThis.postReply('jobDeleted', jobId);
};

console.info('Web worker script processed.');
