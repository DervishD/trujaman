'use strict';

// To keep track of FileReaders.
self.jobs = {};

// Main entry point for web worker, a simple command dispatcher.
// Commands are responsible for replying with postmessage themselves because some of them are asynchronous.
// So, they don't return a value to this dispatcher that can be used to reply to main thread.
// The only exception are internal errors, of course.
self.addEventListener('message', event => {
    const {command, args} = event.data;
    const handler = `handle${command[0].toUpperCase()}${command.slice(1)}`;  // eslint-disable-line no-magic-numbers

    if (handler in self) {
        console.log('Got async command:', command, args);
        // Run the appropriate command.
        self[handler](args);
    } else {
        // Notify the internal error. Should not happen on production.
        self.postReply('commandNotFound', '', command);
    }
});


// Helper for building the object needed in calls to postMessage(), so calling
// code is cleaner and simpler. This way
self.postReply = function postReply (reply, jobId = '', payload = '') {
    self.postMessage({reply, jobId, payload});
};


// This command creates a new file processing job, with the specified jobId, for
// the specified File object, assigning the necessary resources.
/* eslint-disable max-lines-per-function, max-statements */
self.handleCreateJob = function handleCreateJob (file) {
    // There's a problem with File objects: they don't have paths, only names.
    // So, there's no way of telling if two user-selected files are the same or not,
    // because they may have the same name but come from different directories.
    //
    // Best effort here is to create a kind of hash from the file name, the file size
    // and the last modification time. This is not bulletproof, as the user may have
    // and select to different files from different directores whose names are equal,
    // their sizes and modification times too, but still have different contents.
    //
    // Still, this minimizes the possibility of leaving the user unable to add a file
    // just because it has the same name than one previously selected, if they come
    // from different folders. The chances of both files having the exact same size
    // and modification time are quite reduced. Hopefully.
    const job = {
        'id': `${file.name}_${file.size}_${file.lastModified}`,
        file,
        'reader': null
    };

    // Do not add duplicate jobs.
    if (job.id in self.jobs) return;
    self.jobs[job.id] = job;

    // Store a reference for future use.
    job.reader = new FileReader();

    // Right now, mainly for testing purposes, to slow down the reading
    // process so the UI can be examined.
    job.reader.onprogress = event => {
        const DELAY = 500;
        const start = Date.now(); while (Date.now() - start < DELAY);  // Delay each reading operation.
        console.log(`${event.loaded} bytes read.`);
    };

    // Handle file reading errors.
    // This includes unsuccessful reads and discarded huge files.
    // The convoluted call to 'reject' is needed because Firefox can't clone an Error object.
    job.reader.onerror = event => {
        const error = {
            'name': event.target.error.name,
            'message': event.target.error.message,
            'fileName': job.file.name
        };
        self.postReply('fileReadError', job.id, error);
    };

    // Handle successful reads.
    job.reader.onload = event => self.postReply('fileReadOK', job.id, new Uint8Array(event.target.result)[0]);

    // Handle cancellation of reading process.
    job.reader.onabort = () => self.postReply('jobCancelled', job.id);

    // Notify the operation was successful.
    self.postReply('jobCreated', job.id, job.file.name);
};
/* eslint-enable max-lines-per-function, max-statements */


// This command frees the resources associated with the job with the given
// jobId, so everything can be garbage collected at a later time.
self.handleDeleteJob = function handleDeleteJob (jobId) {
    const job = self.jobs[jobId];

    // Cancel the job first.
    self.handleCancelJob(jobId);

    // Free resources.
    job.onload = null;
    job.onerror = null;
    job.onabort = null;
    delete self.jobs[jobId];

    // Notify the operation was successful.
    self.postReply('jobDeleted', jobId);
};


// This command processes the job with the specified jobId, reading the file and
// performing any other needed operation on that file or its contents.
//
// The file is read using the HTML5 File API.
self.handleProcessJob = function handleProcessJob (jobId) {
    const job = self.jobs[jobId];

    // Refuse to process very large files.
    if (job.file.size > 9999 * 1024 * 1024) {  // Absolutely arbitrary maximum file size...
        const error = {
            'name': 'FileTooLargeError',
            'message': 'El fichero es demasiado grande para ser procesado',
            'fileName': job.file.name
        };
        self.postReply('fileReadError', job.id, error);
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
self.handleCancelJob = function handleCancelJob (jobId) {
    self.jobs[jobId].reader.abort();
};
