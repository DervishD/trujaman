'use strict';

// For keeping track of active jobs (really, FileReaders).
globalThis.jobs = {};

// Absolutely arbitrary maximum file size.
globalThis.MAX_FILE_SIZE = 9999 * 1024 * 1024;  // eslint-disable-line no-magic-numbers

// Main entry point for web worker, a simple command dispatcher.
// Commands are responsible for replying with postmessage themselves because some of them are asynchronous.
// So, they don't return a value to this dispatcher that can be used to reply to main thread.
// The only exception are internal errors, of course.
globalThis.addEventListener('message', event => {
    const {command, args} = event.data;
    const handler = `handle${command[0].toUpperCase()}${command.slice(1)}`;  // eslint-disable-line no-magic-numbers

    if (handler in globalThis) {
        // Run the appropriate command.
        globalThis[handler](args);
    } else {
        // Notify the internal error. Should not happen on production.
        globalThis.postReply('commandNotFound', '', command);
    }
});


// Helper for building the object needed in calls to postMessage().
// This way calling code is a bit cleaner and simpler.
globalThis.postReply = function postReply (reply, jobId, payload) {
    globalThis.postMessage({reply, jobId, payload});
};


// This command creates a new file processing job, with the specified jobId, for
// the specified File object, assigning the necessary resources.
/* eslint-disable max-lines-per-function, max-statements */
globalThis.handleCreateJob = function handleCreateJob (file) {
    // There's a problem with File objects: they don't have paths, only names.
    // So, there's no way of telling if two user-selected files are the same or
    // not, because they may have the same name but come from different dirs.
    //
    // Best effort here is to create a kind of hash from the file name, the file
    // size and the last modification time. This is not bulletproof, as the user
    // may have and select two different files from different directories whose
    // names are equal, their sizes and modification times too, but still have
    // different contents.
    //
    // Still, this minimizes the possibility of leaving the user unable to add a
    // file just because it has the same name than one previously selected, if
    // they come from different folders. The chances of both files having the
    // exact same size and modification time are quite reduced. Hopefully.
    const job = {
        'id': `${file.name}_${file.size}_${file.lastModified}`,
        file,
        'reader': null
    };

    // Do not add duplicate jobs.
    if (job.id in globalThis.jobs) return;
    globalThis.jobs[job.id] = job;

    // Store a reference for future use.
    job.reader = new FileReader();

    // Right now, mainly for testing purposes.
    // Slows down the reading process so the UI can be examined.
    job.reader.onprogress = event => {
        const DELAY = 500;
        const start = Date.now(); while (Date.now() - start < DELAY);  // Delay each reading operation.
        // eslint-disable-next-line no-magic-numbers
        const percent = event.total ? Math.floor(100 * event.loaded / event.total) : 100;
        globalThis.postReply('bytesLoaded', job.id, percent);
    };

    // Handle file reading errors.
    job.reader.onerror = event => {
        const error = {
            'name': event.target.error.name,
            'message': event.target.error.message,
            'fileName': job.file.name
        };
        globalThis.postReply('fileReadError', job.id, error);
    };

    // Handle successful reads.
    job.reader.onload = event => globalThis.postReply('fileReadOK', job.id, new Uint8Array(event.target.result)[0]);

    // Handle cancellation of reading process.
    job.reader.onabort = () => globalThis.postReply('jobCancelled', job.id);

    // Notify the operation was successful.
    globalThis.postReply('jobCreated', job.id, job.file.name);
};
/* eslint-enable max-lines-per-function, max-statements */


// This command frees the resources associated with the job with the given
// jobId, so everything can be garbage collected at a later time.
globalThis.handleDeleteJob = function handleDeleteJob (jobId) {
    const job = globalThis.jobs[jobId];

    // Cancel the job first.
    globalThis.handleCancelJob(jobId);

    // Free resources.
    job.onload = null;
    job.onerror = null;
    job.onabort = null;
    delete globalThis.jobs[jobId];

    // Notify the operation was successful.
    globalThis.postReply('jobDeleted', jobId);
};


// This command processes the job with the specified jobId, reading the file and
// performing any other needed operation on that file or its contents.
//
// The file is read using the HTML5 File API.
globalThis.handleProcessJob = function handleProcessJob (jobId) {
    const job = globalThis.jobs[jobId];

    // Refuse to process very large files.
    if (job.file.size > globalThis.MAX_FILE_SIZE) {
        const error = {
            'name': 'FileTooLargeError',
            'message': 'El fichero es demasiado grande para ser procesado',
            'fileName': job.file.name
        };
        globalThis.postReply('fileReadError', job.id, error);
    } else {
        // Read the file as ArrayBuffer.
        job.reader.readAsArrayBuffer(job.file);
    }
};


// This command cancels an in-progress job processing operation for the
// specified job. It is a nop if no job processing operation is currently
// happening.
//
// This is usually a successful operation, because the user actually requested
// the cancellation of the current job processing operation, so when it's
// aborted it actually IS a successful response to the request.
globalThis.handleCancelJob = function handleCancelJob (jobId) {
    globalThis.jobs[jobId].reader.abort();
};
