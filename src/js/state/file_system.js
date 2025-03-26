import {fileOpen, fileSave, supported} from 'browser-fs-access';
import * as state from "./state.js";
import {isObject} from "../utils/utilities.js";

// -------------------------------------------------------------------------------- Editor Files
export const FILE_EXTENSION = "asciireel"
const MIME_TYPE = "application/vnd.asciireel+json"
const FILES_DIR_ID = "asciireel-files"
let fileHandle;

export function hasActiveFile() {
    return !!fileHandle;
}

/**
 * Prompts the user to select an .asciireel file to open. If File System API is supported by the browser, this will also
 * store the file handle so we can continuously update the file later (see saveFile).
 * @returns {Promise<object>} data is the parsed json to be loaded into the state
 */
export async function openFile() {
    const file = await fileOpen({
        description: "AsciiReel File",
        extensions: [`.${FILE_EXTENSION}`],
        mimeTypes: [MIME_TYPE],
        excludeAcceptAllOption: true
    });

    fileHandle = file.handle; // Will be undefined if File System API is not supported
    exportHandle = undefined; // Clear any existing export handles since we are looking at a new file now

    const fileText = await file.text();
    const json = JSON.parse(fileText);

    if (json && isObject(json.config)) {
        // Always prefer the file's name over the name property stored in the json.
        // Note: file.name will be defined even if File System API is not supported.
        json.config.name = fileNameWithoutExtension(file.name, FILE_EXTENSION);
    }

    return json;
}

/**
 * Saves the current state to disk as an .asciireel file. If the browser has File System API support, it is possible
 * to save updates directly to a file on the user's OS.
 *
 * Note: Promise will be rejected if user closes the file picker; use isPickerCanceledError to catch this case.
 *
 * @param {boolean} [saveToActiveFile] If true, will update the most recent saved file (on the user's OS). Requires
 *   a handle to have been previously set up (e.g. by previously opening/saving a file). Only used if the browser
 *   supports the File System API.
 * @returns {Promise<string|undefined>} Returns the name of the file (will be undefined if File System API not supported)
 */
export async function saveFile(saveToActiveFile) {
    if (saveToActiveFile && !fileHandle) throw new Error(`No handle found for saveToActiveFile`);

    const serializedState = JSON.stringify(state.getState());
    const blob = new Blob([serializedState], {
        type: MIME_TYPE,
    });

    fileHandle = await fileSave(
        blob,
        {
            fileName: `${state.getName()}.${FILE_EXTENSION}`,
            description: 'AsciiReel File',
            extensions: [`.${FILE_EXTENSION}`],
            mimeTypes: [MIME_TYPE],
            id: FILES_DIR_ID,
            excludeAcceptAllOption: true
        },
        saveToActiveFile ? fileHandle : undefined
    )

    // Update the state's name based on what the user entered into the dialog. Only applicable if the browser
    // has File System API support.
    if (fileHandle) state.config('name', fileNameWithoutExtension(fileHandle.name, FILE_EXTENSION));

    return fileHandle && fileHandle.name;
}



// -------------------------------------------------------------------------------- Export Files
const EXPORT_DIR_ID = "asciireel-exports"
let exportHandle;

export function hasActiveExport() {
    return !!exportHandle;
}

/**
 * Exports Blob content to the user's OS.
 *
 * Note: Promise will be rejected if user closes the file picker; use isPickerCanceledError to catch this case.
 *
 * @param {Blob|Promise<Blob>} blobOrPromiseBlob The content to export. Note: If generating the Blob is slow (i.e. it
 *   will be more than ~200ms from when the user clicked 'export'), you must pass a deferred Promise<Blob> to avoid
 *   a user activation error. See exporter.js#lazyBlobPromise for more info.
 * @param {String} extension File extension (e.g. "txt")
 * @param {String} mimeType File MIME type (e.g. "text/plain")
 * @param {boolean} [exportToActiveFile] If true, will update the most recent exported file (on the user's OS). Requires
 *   a handle to have been previously set up (e.g. by previously exporting and picking a file). Only used if the browser
 *   supports the File System API.
 * @param {function()} [onExportStarted] Callback called once the user has selected where they want to save the file.
 *   If File System API is not supported or if the export handle is already known this will be instantly called.
 * @returns {Promise<string|undefined>} Returns the name of the file (will be undefined if File System API not supported)
 */
export async function exportFile(blobOrPromiseBlob, extension, mimeType, exportToActiveFile, onExportStarted) {
    if (exportToActiveFile && !exportHandle) throw new Error(`No handle found for exportToActiveFile`);

    if (onExportStarted && (!supported || exportToActiveFile)) onExportStarted();

    exportHandle = await fileSave(
        blobOrPromiseBlob,
        {
            fileName: `${state.getName()}.${extension}`,
            extensions: [`.${extension}`],
            mimeTypes: [mimeType],
            id: EXPORT_DIR_ID,
            excludeAcceptAllOption: true
        },
        exportToActiveFile ? exportHandle : undefined,
        false,
        onExportStarted // Will be called if file system API is supported, there is no handle, and user selects a location
    )

    return exportHandle && exportHandle.name;
}




// -------------------------------------------------------------------------------- Corrupted State

// If the state failed to load some content, this can be used to downloads that corrupted content for troubleshooting.
export async function saveCorruptedState(corruptedData) {
    const blob = new Blob([JSON.stringify(corruptedData)], { type: "application/json" });

    const handle = await fileSave(
        blob,
        {
            fileName: `${state.getName()}-corrupted.json`,
            extensions: [`.json`],
            mimeTypes: ['application/json'],
            id: FILES_DIR_ID,
            excludeAcceptAllOption: true
        }
    )

    return handle && handle.name;
}


// -------------------------------------------------------------------------------- Helpers

export function isPickerCanceledError(error) {
    return error.name === "AbortError";
}

export function resetHandles() {
    fileHandle = undefined;
    exportHandle = undefined;
}

function fileNameWithoutExtension(fileName, extension) {
    return fileName.endsWith(`.${extension}`) ? fileName.slice(0, -`.${extension}`.length) : fileName;
}