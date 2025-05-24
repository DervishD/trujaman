export const commands = Object.freeze(Object.fromEntries(Object.keys({
    registerFormats: null,
    createJob: null,
    processJob: null,
    deleteJob: null,
}).map(key => [key, key])));


export const replies = Object.freeze(Object.fromEntries(Object.keys({
    commandNotFound: null,
    jobCreated: null,
    jobDeleted: null,
    bytesRead: null,
    fileReadError: null,
    fileReadComplete: null,
    fileTooLarge: null,
}).map(key => [key, key])));


export const customEvents = Object.freeze(Object.fromEntries(Object.keys({
    jobDismissed: null,
    processingRequested: null,
    interactionHalted: null,
}).map(key => [key, key])));
