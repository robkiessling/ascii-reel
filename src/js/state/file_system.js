import { fileOpen, fileSave } from 'browser-fs-access';
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
 * @returns {Promise<object|boolean>} data is the parsed json to be loaded into the state. data will be false if the user
 *   cancels the dialog (this will not throw an error).
 */
export async function openFile() {
    try {
        const file = await fileOpen({
            description: "AsciiReel File",
            extensions: [`.${FILE_EXTENSION}`],
            mimeTypes: [MIME_TYPE],
            excludeAcceptAllOption: true
        });

        fileHandle = file.handle; // Will be undefined if File System API is not supported

        const fileText = await file.text();
        const json = JSON.parse(fileText);

        if (json && isObject(json.config)) {
            // Always prefer the file's name over the name property stored in the json.
            // Note: file.name will be defined even if File System API is not supported.
            json.config.name = fileNameWithoutExtension(file.name, FILE_EXTENSION);
        }

        return json;
    } catch(error) {
        return handleDialogError(error)
    }
}

/**
 * Saves the current state to disk as an .asciireel file. If the browser has File System API support, it is possible
 * to save updates directly to a file on the user's OS.
 *
 * @param {FileSystemFileHandle} [handle] If provided, will update the file attached to the handle (on the user's OS)
 *   instead of downloading a new file. Requires browser support for the File System API. Handles are retrieved from
 *   previous calls to saveFile or openFile. Handles cannot be persisted across sessions; the user will have to choose
 *   a file from a dialog at least once per session.
 * @returns {Promise<boolean>} True if file was successfully saved, false if not. E.g. if user closes the dialog without
 *   choosing a save destination, the Promise is fulfilled (no error) but its return value is false.
 */
export async function saveFile(handle) {
    try {
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
            handle
        )

        // Update the state's name based on what the user entered into the dialog. Only applicable if the browser
        // has File System API support.
        if (fileHandle) state.config('name', fileNameWithoutExtension(fileHandle.name, FILE_EXTENSION));

        return true;
    } catch (error) {
        return handleDialogError(error)
    }
}

/**
 * Directly updates a file on the user's OS. Requires a handle to have been previously set up (e.g. by opening or
 * saving the file)
 * @returns {Promise<boolean>}
 */
export async function saveToActiveFile() {
    if (!fileHandle) throw new Error(`No handle found for ${FILE_EXTENSION} file`);

    return await saveFile(fileHandle);
}



// -------------------------------------------------------------------------------- Export Files
// See saveFile/saveToActiveFile functions for information on how handles work.

const EXPORT_DIR_ID = "asciireel-exports"
let exportHandle;

export function hasActiveExport() {
    return !!exportHandle;
}

export async function exportFile(blobOrPromiseBlob, extension, mimeType, handle) {
    exportHandle = await fileSave(
        blobOrPromiseBlob,
        {
            fileName: `${state.getName()}.${extension}`,
            extensions: [`.${extension}`],
            mimeTypes: [mimeType],
            id: EXPORT_DIR_ID,
            excludeAcceptAllOption: true
        },
        handle
    )
}

export async function exportToActiveFile(blob, extension, mimeType) {
    if (!exportHandle) throw new Error(`No handle found for export file`);

    return await exportFile(blob, extension, mimeType, exportHandle);
}




// -------------------------------------------------------------------------------- Corrupted State

// If the state failed to load some content, this can be used to downloads that corrupted content for troubleshooting.
export async function saveCorruptedState(corruptedData) {
    try {
        const blob = new Blob([JSON.stringify(corruptedData)], { type: "application/json" });

        await fileSave(
            blob,
            {
                fileName: `${state.getName()}-corrupted.json`,
                extensions: [`.json`],
                mimeTypes: ['application/json'],
                id: FILES_DIR_ID,
                excludeAcceptAllOption: true
            }
        )

        return true;
    } catch (error) {
        return handleDialogError(error)
    }
}


// -------------------------------------------------------------------------------- Helpers

export function isPickerCanceledError(error) {
    return error.name === "AbortError";
}

function handleDialogError(error) {
    if (isPickerCanceledError(error)) {
        // User canceled the dialog; this is not considered an error (so Promise is still fulfilled) but we return
        // false to indicate the dialog was canceled
        return false;
    } else {
        // An actual error occurred, re-raise it
        console.error(error.message, error.stack);
        throw error;
    }
}

function fileNameWithoutExtension(fileName, extension) {
    return fileName.endsWith(`.${extension}`) ? fileName.slice(0, -`.${extension}`.length) : fileName;
}