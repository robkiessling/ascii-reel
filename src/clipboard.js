import * as selection from "./selection.js";
import {convert2dArrayToText, convertTextTo2dArray} from "./utilities.js"; // or more selective import, like "core-js/es/array"

// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";
import {refresh, translate, updateChar} from "./index.js";

let cutCell = null;
let copiedSelection = null; // 2d array
let copiedText = null; // string

export function cut() {
    cutCell = selection.getSelectedArea().topLeft;
    copySelection();
}

export function copy() {
    copySelection();
}

/**
 * What to paste:
 * - If there is new content in the clipboard (clipboard comes from user's OS) paste that
 * - Otherwise, paste the copied canvas selection
 *
 * How to paste it:
 * - If the pasted content is a single character, repeat that character across current selection
 * - Otherwise, paste content relative to topLeft of selection
 */
export function paste() {
    if (!selection.hasSelection()) {
        // There is no where to paste the text
        return;
    }

    readClipboard(text => {
        if (copiedText !== text) {
            // External clipboard has changed; paste the external clipboard
            cutCell = null; // Disregard any previous cuts
            pasteArray(convertTextTo2dArray(text));
        }
        else if (copiedSelection) {
            // Write our stored selection
            pasteArray(copiedSelection);
        }
    });
}

function copySelection() {
    copiedSelection = selection.getSelectedValues();
    copiedText = convert2dArrayToText(copiedSelection);
    writeClipboard(copiedText);
}

function pasteArray(array) {
    // If cut was used, remove old cut
    if (cutCell) {
        translate(array, cutCell, (value, r, c) => {
            if (value !== null) { updateChar(r, c, ''); }
        })
        cutCell = null;
    }

    if (array.length === 1 && array[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        selection.getSelectedCells().forEach(cell => {
            updateChar(cell.row, cell.col, array[0][0])
        });
    }
    else {
        // Paste array once at topLeft of first selectionArea
        translate(array, selection.selectionAreas[0].topLeft, (value, r, c) => {
            if (value !== null) { updateChar(r, c, value); }
        });

        // Paste array at topLeft of each selectionArea TODO Has issues if your copiedSelection has multiple selectionAreas too
        // selection.selectionAreas.forEach(selectionArea => {
        //     translate(array, selectionArea.topLeft, (value, r, c) => {
        //         if (value !== null) { updateChar(r, c, value); }
        //     });
        // });
    }

    refresh('chars');
}

function readClipboard(callback) {
    navigator.clipboard.readText().then(text => {
        callback(text);
    }).catch(err => {
        console.error('Failed to read clipboard contents: ', err);
        alert("Cannot read from your clipboard. You need to allow 'Clipboard' access for this site " +
            " in your browser settings if you want to paste text.");
    });
}

function writeClipboard(text, callback) {
    navigator.clipboard.writeText(text).then(() => {
        if (callback) { callback(); }
    }).catch(err => {
        console.error('Failed to write clipboard contents: ', err);
        alert("Cannot write to your clipboard. You need to allow 'Clipboard' access for this site " +
            " in your browser settings if you want to paste text.");
    });
}
