function buildContractObject(object) {
    return Object.freeze(Object.fromEntries(Object.keys(object).map(key => [key, key])));
}


export const {unknownCommand} = buildContractObject({unknownCommand: null});


export const serviceWorkerCommands = buildContractObject({
    getVersion: null,
});


export const serviceWorkerReplies = buildContractObject({
    versionReported: null,
});


export const webWorkerCommands = buildContractObject({
    registerFormats: null,
    createJob: null,
    processJob: null,
    deleteJob: null,
});


export const webWorkerReplies = buildContractObject({
    jobCreated: null,
    jobDeleted: null,
    bytesRead: null,
    fileReadError: null,
    fileReadComplete: null,
    fileTooLarge: null,
});


export const customEvents = buildContractObject({
    jobDismissed: null,
    processingRequested: null,
    interactionHalted: null,
});
