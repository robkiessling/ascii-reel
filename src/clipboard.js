import * as selection from "./selection.js";
import * as canvas from "./canvas.js";
import {frame, translate} from "./index.js";
import isEqual from "lodash/isEqual.js";
import {textTo2dArray} from "./utilities.js"; // or more selective import, like "core-js/es/array"

// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";

let cutCoord = null;
let copiedSelection = null;
let copiedText = null;

export function cut() {
    cutCoord = selection.getSelectionRect().topLeft;
    copiedSelection = selection.getSelection();
    storeClipboard(); // Save the current external clipboard, so we know if it changes
}

export function copy() {
    copiedSelection = selection.getSelection();
    storeClipboard(); // Save the current external clipboard, so we know if it changes
}

/**
 * What to paste:
 * - If there is new content in the clipboard (clipboard is set by operating system), paste that
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
        let newClipboard = textTo2dArray(text);

        if (!isEqual(copiedText, newClipboard)) {
            // External clipboard has changed; paste the external clipboard
            pasteClipboard(newClipboard);
        }
        else if (copiedSelection) {
            // Write our stored selection
            pasteSelection();
        }
    });
}

function pasteSelection() {
    if (copiedSelection.length === 1 && copiedSelection[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        pasteSingleChar(copiedSelection[0][0]);
    }
    else {
        translate(copiedSelection, selection.getSelectionRect().topLeft, (value, r, c) => {
            if (value !== null) { frame[r][c] = value; }
        });
    }

    // If cut was used, remove old cut
    if (cutCoord) {
        translate(copiedSelection, cutCoord, (value, r, c) => {
            if (value !== null) { frame[r][c] = ''; }
        })
        cutCoord = null;
    }

    canvas.refreshChars();
}

function pasteClipboard(clipboard) {
    if (clipboard.length === 1 && clipboard[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        pasteSingleChar(clipboard[0][0]);
    }
    else {
        translate(clipboard, selection.getSelectionRect().topLeft, (value, r, c) => {
            if (value !== null) { frame[r][c] = value; }
        });
    }

    canvas.refreshChars();
}

function pasteSingleChar(char) {
    selection.getSelectedCoords().forEach(coord => {
        frame[coord.row][coord.col] = char;
    });
}

function storeClipboard() {
    readClipboard(text => { copiedText = textTo2dArray(text); });
}

function readClipboard(callback) {
    navigator.clipboard.readText()
        .then(text => {
            callback(text);
        })
        .catch(err => {
            console.error('Failed to read clipboard contents: ', err);
            alert("Cannot read from your clipboard. You need to allow 'Clipboard' access for this site " +
                " in your browser settings if you want to paste text.");
        });
}

