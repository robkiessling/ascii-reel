// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";

import * as selection from "./selection.js";
import * as state from "./state.js";
import {translate} from "./utilities.js";
import {triggerRefresh} from "./index.js";
import * as editor from "./editor.js";
import * as actions from "./actions.js";

let copiedSelection = null; // 2d array
let copiedText = null; // string

actions.createAction('cut', {
    name: 'Cut',
    callback: () => cut(),
    enabled: () => selection.hasSelection() && !selection.movableContent,
    shortcut: 'x'
});
actions.createAction('copy', {
    name: 'Copy',
    callback: () => copy(),
    enabled: () => selection.hasSelection() && !selection.movableContent,
    shortcut: 'c'
});
actions.createAction('paste', {
    name: 'Paste',
    callback: () => paste(),
    enabled: () => selection.hasSelection() && !selection.movableContent,
    shortcut: 'v'
});
actions.createAction('paste-in-selection', {
    name: 'Paste In Selection',
    callback: () => paste(true),
    enabled: () => selection.hasSelection() && !selection.movableContent,
    shortcut: { char: 'v', modifiers: ['shift'] }
});


function cut() {
    // If we're moving content, immediately finish it so that it's more intuitive as to what is being cut
    if (selection.movableContent) { selection.finishMovingContent(); }

    copySelection();
    selection.empty();
    triggerRefresh('chars');
}

function copy() {
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
function paste(limitToSelection) {
    if (!selection.hasSelection()) {
        // There is no where to paste the text
        return;
    }

    readClipboard(text => {
        if (copiedText !== text) {
            // External clipboard has changed; paste the external clipboard
            paste2dArray(convertTextToChars(text), limitToSelection);
        }
        else if (copiedSelection) {
            // Write our stored selection
            paste2dArray(copiedSelection, limitToSelection);
        }
    });
}

function copySelection() {
    copiedSelection = selection.getSelectedValues();
    copiedText = convertCharsToText(copiedSelection);
    writeClipboard(copiedText);
}

function paste2dArray(array, limitToSelection) {
    if (array.length === 1 && array[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        selection.getSelectedCells().forEach(cell => {
            state.setCurrentCelChar(cell.row, cell.col, array[0][0]);
        });
    }
    else {
        // Paste array once at topLeft of entire selected area
        translate(array, selection.getSelectedCellArea().topLeft, (value, r, c) => {
            if (value !== undefined && (!limitToSelection || selection.isSelectedCell({row: r, col: c}))) {
                state.setCurrentCelChar(r, c, value);
            }
        });
    }

    triggerRefresh('chars');
}

function convertCharsToText(array) {
    return array.map(row => {
        return row.map(charObj => {
            // Only care about the char, not the color
            // Convert empty cells to space char ' ' so when it is pasted to a text document the spacing is correct
            return charObj === undefined || charObj[0] === '' ? ' ' : charObj[0];
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
