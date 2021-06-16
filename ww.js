'use strict';

// To keep track of File Readers used in different transactions.
self.fileReaders = {};
function hash (file) { return `${file.name}${file.size}${file.lastModified}`}


// Main entry point for web worker, a simple command dispatcher.
// Commands are responsible for replying with postmessage themselves because some of them are asynchronous.
// So, they don't return a value to this dispatcher that can be used to reply to main thread.
// The only exception are internal errors, of course.
self.addEventListener('message', event => {
    const {id, command, args} = event.data;
    if (command in self) {
        // Run the appropriate command. The response will be sent back by the command itself.
        self[command](args)
        .then(payload => self.postMessage({id:id, status: true, payload:payload}))
        .catch(payload => self.postMessage({id:id, status: false, payload:payload}));
    } else {
        // Notify the internal error. Should not happen on production.
        const payload = {  // This is needed because Firefox can't clone an Error object.
            name: 'TypeError',
            message: 'No existe el comando',
            command: command
        };
        return self.postMessage({id:id, status: null, payload: payload});
    }
});


// Read the file specified by the provided File object, using the HTML5 File API.
function readFile (file) {
    // Create a new FileReader to handle this File.
    const reader = new FileReader();

    // Remember it for further handling.
    self.fileReaders[hash(file)] = reader;

    // Right now, mainly for testing purposes, to slow down the reading process so the UI can be examined.
    reader.onprogress = event => {
        let start = Date.now(); while (Date.now() - start < 500);  // Delay each reading operation.
        console.log(`${event.loaded} bytes read.`);
    }

    return new Promise ((resolve, reject) => {
        // Handle file reading errors.
        // This includes unsuccessful reads and discarded huge files.
        // The convoluted call to 'reject' is needed because Firefox can't clone an Error object.
        reader.onerror = event => reject({
            name: event.target.error.name,
            message: event.target.error.message,
            fileName: file.name
        });

        // Handle successful reads.
        reader.onload = event => resolve((new Uint8Array(event.target.result))[0]);

        if (file.size > 9999 * 1024 * 1024) {  // Absolutely arbitrary maximum file size...
            const error = new DOMException('El fichero es demasiado grande para ser procesado', 'FileTooLargeError');
            // Again, the convoluted call to 'reject' is needed because Firefox can't clone an Error object.
            reject({name: error.name, message: error.message, fileName: file.name});
        } else {
            // Read the file as ArrayBuffer.
            reader.readAsArrayBuffer(file);
        }
    });
}


// This command aborts an in-progress file reading operation for the given File.
// It is a nop if no file reading operation is currently happening.
//
// This is usually a successful operation, because the user actually requested
// the aborting of the current file reading operation, so when it's aborted it
// actually IS a successful response to the request.
function abortRead (file) {
    const reader = self.fileReaders[hash(file)];  // FileReader for this File.

    return new Promise ((resolve) => {
        if (reader) {
            reader.onabort = () => resolve(file.name);
            reader.abort();
        } else resolve(file.name);
    });
}


// This command frees the resources associated with the given File.
// So, everything can be garbage collected at a later time.
//
// It always resolves successfully, even if the file has been already
// forgotten and all its resources have already been properly freed.
//
// The payload is the file name, for convenience.
function forgetFile (file) {
    let reader = self.fileReaders[hash(file)];  // FileReader for this File.

    return new Promise((resolve) => {
        if (reader) {
            // Free resources.
            reader.onload = null;
            reader.onerror = null;
            reader.onabort = null;
            reader = null;
            delete self.fileReaders[hash(file)];
        }
        resolve(file.name);
    });
}