export const commands = {
    registerFormats: null,
    slowModeToggle: null,
    createJob: null,
    processJob: null,
    retryJob: null,
    cancelJob: null,
    deleteJob: null,
};
Object.keys(commands).forEach(key => { commands[key] = key; });
Object.freeze(commands);


export const replies = {
    commandNotFound: null,
    slowModeState: null,
    jobCreated: null,
    jobCancelled: null,
    jobDeleted: null,
    bytesRead: null,
    fileReadError: null,
    fileReadOK: null,
};
Object.keys(replies).forEach(key => { replies[key] = key; });
Object.freeze(replies);


export const customEvents = {
    jobDismiss: null,
    jobCancel: null,
    jobRetry: null,
    slowModeToggle: null,
    processFiles: null,
};
Object.keys(customEvents).forEach(key => { customEvents[key] = `custom:${key}`; });
Object.freeze(customEvents);


console.info('Contracts script processed.');
