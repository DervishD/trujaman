function buildContractObject(object) {
    return Object.freeze(Object.fromEntries(Object.keys(object).map(key => [key, key])));
}

export const webWorkerCommands = buildContractObject({
    registerFormats: null,
    createJob: null,
    processJob: null,
    deleteJob: null,
});


export const webWorkerReplies = buildContractObject({
    commandNotFound: null,
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
