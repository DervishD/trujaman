export const WEB_WORKER_URL = './ww.js'
export const SERVICE_WORKER_URL = './sw.js'
export const FORMATS_URL = './formats.json'


// Miscellaneous constants
export const IEC_BINARY_PREFIX_MULTIPLIER = 1024;
export const PERCENT_FACTOR = 100;
export const SUBSTACKDUMP_SEPARATOR = '\uEEEE';

// Arbitrary file size limit.
const MAX_FILE_SIZE_MIB = 99;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MIB * IEC_BINARY_PREFIX_MULTIPLIER * IEC_BINARY_PREFIX_MULTIPLIER;

// Selectors
export const S_KEEP_ON_ERROR = '[data-keep-on-error]';
export const S_DEFAULT_CONTROL = '[data-element="js-default-control"]';
export const S_DEFAULT_CONTROL_TEXT = '[data-placeholder="js-default-control-text"]';
export const S_DROPZONE = '[data-element="js-dropzone"]';
export const S_DROPZONE_TEXT = '[data-placeholder="js-dropzone-text"]';
export const S_VERSION_TEXT = '[data-placeholder="js-version-text"]';
export const S_LOGO = '[data-element="js-logo"]';
export const S_FILEPICKER = '[data-element="js-filepicker"]';
export const S_FILEPICKER_INPUT = '[data-role="js-filepicker"]';
export const S_ERROR_TEMPLATE = '[data-element="js-error-template"]';
export const S_ERROR_HEADER = '[data-placeholder="js-error-header"]';
export const S_ERROR_NAME = '[data-placeholder="js-error-name"]';
export const S_ERROR_MESSAGE = '[data-placeholder="js-error-message"]';
export const S_ERROR_LOCATION = '[data-placeholder="js-error-location"]';
export const S_ERROR_DETAILS = '[data-placeholder="js-error-details"';
export const S_ERROR_STACK = '[data-placeholder="js-error-stack"]';
export const S_JOBS_CONTAINER = '[data-element="js-jobs-container"]';
export const S_JOB_TEMPLATE = '[data-element="js-job-template"]';
export const S_JOB_FILENAME_TEXT = '[data-placeholder="js-job-filename-text"]';
export const S_JOB_MESSAGE_TEXT = '[data-placeholder="js-job-message-text"]';
export const S_JOB_DEBUG_INFO = '[data-element="js-job-debuginfo"]';
export const S_JOB_DEBUG_INFO_TEXT = '[data-placeholder="js-job-debuginfo-text"]';
export const S_JOB_DISMISS = '[data-role="js-job-dismiss"]';
export const S_JOB_DOWNLOAD_DROPDOWN = '[data-element="js-job-download-dropdown"]';
export const S_JOB_DOWNLOAD_DROPDOWN_TEXT = '[data-placeholder="js-job-download-dropdown-text"]';
export const S_JOB_FORMATS_LIST = '[data-element="js-job-formats-list"]';
export const S_DOWNLOADABLE_FORMAT_TEMPLATE = '[data-element="js-downloadable-format-template"]';
export const S_DOWNLOADABLE_FORMAT_NAME_TEXT = '[data-placeholder="js-downloadable-format-name-text"]';

// States
export const DROPZONE_STATE_HIDDEN = 'hidden';
export const DROPZONE_STATE_VISIBLE = 'visible';
export const DROPZONE_STATE_DISMISSED = 'dismissed';
export const APP_STATE_RUNNING = 'running';
export const JOB_STATE_READING = 'reading';
export const JOB_STATE_PROCESSED = 'processed';
export const JOB_STATE_ERROR = 'error';
