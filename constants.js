export const WEB_WORKER_URL = './ww.js'
export const SERVICE_WORKER_URL = './sw.js'
export const FORMATS_URL = './formats.json'

export const IEC_BINARY_PREFIX_MULTIPLIER = 1024;
export const PERCENT_FACTOR = 100;

// Arbitrary file size limit.
const MAX_FILE_SIZE_MIB = 99;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MIB * IEC_BINARY_PREFIX_MULTIPLIER * IEC_BINARY_PREFIX_MULTIPLIER;

// Selectors
export const S_KEEP_ON_ERROR = '[data-keep-on-error]'
export const S_DEFAULT_CONTROL = '[data-element="js-default-control"]'
export const S_DROPZONE = '[data-element="js-dropzone"]'
export const S_VERSION_TEXT = '[data-placeholder="js-version"]'
export const S_LOGO = '[data-element="js-logo"]'
export const S_FILEPICKER = '[data-element="js-filepicker"]'
export const S_FILEPICKER_INPUT = '[data-role="js-filepicker"]'
export const S_ERROR_TEMPLATE = '[data-element="js-error-template"]'
export const S_ERROR_HEADER = '.js-error-header'
export const S_ERROR_MESSAGE = '.js-error-message'
export const S_ERROR_LOCATION = '.js-error-location'
export const S_ERROR_DETAILS = '.js-error-details'
export const S_JOBS_CONTAINER = '[data-element="js-jobs-container"]'
export const S_JOB_TEMPLATE = '[data-element="js-job-template"]'
export const S_JOB_FILENAME = '[data-placeholder="js-job-filename"]'
export const S_JOB_MESSAGE = '[data-placeholder="js-job-message"]'
export const S_JOB_DISMISS = '[data-role="js-job-dismiss"]'
export const S_JOB_DOWNLOAD_DROPDOWN = '[data-element="js-job-download-dropdown"]'
export const S_JOB_FORMATS_LIST = '[data-element="js-job-formats-list"]'
export const S_DOWNLOADABLE_FORMAT_TEMPLATE = '[data-element="js-downloadable-format-template"]'
export const S_DOWNLOADABLE_FORMAT_NAME = '[data-placeholder="js-downloadable-format-name"]'

// States
export const DROPZONE_STATE_HIDDEN = 'hidden'
export const DROPZONE_STATE_VISIBLE = 'visible'
export const DROPZONE_STATE_DISMISSED = 'dismissed'
export const APP_STATE_RUNNING = 'running'
export const JOB_STATE_READING = 'reading'
export const JOB_STATE_PROCESSED = 'processed'
export const JOB_STATE_ERROR = 'error'