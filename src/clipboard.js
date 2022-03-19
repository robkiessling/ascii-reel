import * as selection from "./selection.js";
import * as state from "./state.js";
import {translate} from "./utilities.js";

// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";
import {timeline, refresh} from "./index.js";
import * as editor from "./editor.js";

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
            pasteArray(convertTextToChars(text));
        }
        else if (copiedSelection) {
            // Write our stored selection
            pasteArray(copiedSelection);
        }
    });
}

function copySelection() {
    copiedSelection = selection.getSelectedValues();
    copiedText = convertCharsToText(copiedSelection);
    writeClipboard(copiedText);
}

function pasteArray(array) {
    // If cut was used, remove old cut
    if (cutCell) {
        translate(array, cutCell, (value, r, c) => {
            if (value !== null) { state.setCurrentCelChar(r, c, ['', 0]); }
        })
        cutCell = null;
    }

    if (array.length === 1 && array[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        selection.getSelectedCells().forEach(cell => {
            state.setCurrentCelChar(cell.row, cell.col, array[0][0])
        });
    }
    else {
        // Paste array once at topLeft of first selectionArea
        translate(array, selection.selectionAreas[0].topLeft, (value, r, c) => {
            if (value !== null) { state.setCurrentCelChar(r, c, value); }
        });

        // Paste array at topLeft of each selectionArea TODO Has issues if your copiedSelection has multiple selectionAreas too
        // selection.selectionAreas.forEach(selectionArea => {
        //     translate(array, selectionArea.topLeft, (value, r, c) => {
        //         if (value !== null) { state.setCurrentCelChar(r, c, value); }
        //     });
        // });
    }

    refresh('chars');
}

function convertCharsToText(array) {
    let char;
    return array.map(row => {
        return row.map(charObj => {
            // Only care about the char, not the color
            // Convert empty cells to space char ' ' so when it is pasted to a text document the spacing is correct
            return charObj === null || charObj[0] === '' ? ' ' : charObj[0];
        }).join('');
    }).join('\n');
}

const MAX_TEXT_LENGTH = 100000; // Upper limit just in case the OS clipboard had a huge amount of text copied

export function convertTextToChars(text) {
    return text.slice(0, MAX_TEXT_LENGTH).split(/\r?\n/).map(line => {
        return line.split('').map(char => [char, editor.currentColorIndex()]);
    })
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
