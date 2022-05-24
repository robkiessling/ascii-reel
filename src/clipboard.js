// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";

import * as selection from "./selection.js";
import * as state from "./state.js";
import {translateGlyphs} from "./utilities.js";
import {triggerRefresh} from "./index.js";
import * as editor from "./editor.js";
import * as actions from "./actions.js";

let copiedSelection = null;
let copiedText = null;

export function init() {
    actions.registerAction('cut', {
        name: 'Cut',
        callback: () => cut(),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: 'x'
    });
    actions.registerAction('copy', {
        name: 'Copy',
        callback: () => copy(),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: 'c'
    });
    actions.registerAction('paste', {
        name: 'Paste',
        callback: () => paste(),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: 'v'
    });
    actions.registerAction('paste-in-selection', {
        name: 'Paste In Selection',
        callback: () => paste(true),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: { char: 'v', modifiers: ['shift'] }
    });
}


function cut() {
    // If we're moving content, immediately finish it so that it's more intuitive as to what is being cut
    if (selection.movableContent) { selection.finishMovingContent(); }

    copySelection();
    selection.empty();
    triggerRefresh('chars', true);
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
            pasteGlyphs(convertTextToGlyphs(text), limitToSelection);
        }
        else if (copiedSelection) {
            // Write our stored selection
            pasteGlyphs(copiedSelection, limitToSelection);
        }
    });
}

function copySelection() {
    copiedSelection = selection.getSelectedValues();
    copiedText = convertGlyphsToText(copiedSelection);
    writeClipboard(copiedText);
}

/**
 *
 * @param glyphs           An object like: { chars: [[2d array of chars]], colors: [[2d array of colors]] }
 * @param limitToSelection If true, pasted text will only be pasted within the current selection bounds
 */
function pasteGlyphs(glyphs, limitToSelection) {
    if (glyphs.chars.length === 1 && glyphs.chars[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        const char = glyphs.chars[0][0];
        const color = glyphs.colors[0][0];

        selection.getSelectedCells().forEach(cell => {
            state.setCurrentCelGlyph(cell.row, cell.col, char, color);
        });
    }
    else {
        // Paste glyphs once at topLeft of entire selected area
        translateGlyphs(glyphs, selection.getSelectedCellArea().topLeft, (r, c, char, color) => {
            if (!limitToSelection || selection.isSelectedCell({row: r, col: c})) {
                state.setCurrentCelGlyph(r, c, char, color);
            }
        });
    }

    triggerRefresh('chars', true);
}

function convertGlyphsToText(glyphs) {
    // TODO Only caring about the char, not the color
    return glyphs.chars.map(row => {
        return row.map(char => {
            // Convert empty cells to space char ' ' so when it is pasted to a text document the spacing is correct
            return char === undefined || char === '' ? ' ' : char;
        }).join('');
    }).join('\n');
}

const MAX_TEXT_LENGTH = 100000; // Upper limit just in case the OS clipboard had a huge amount of text copied
function convertTextToGlyphs(text) {
    let chars = [], colors = [];
    
    text.slice(0, MAX_TEXT_LENGTH).split(/\r?\n/).forEach((line, r) => {
        chars[r] = [];
        colors[r] = [];

        line.split('').forEach((char, c) => {
            chars[r][c] = char;
            colors[r][c] = editor.currentColorIndex() // todo could read color from rtf
        })
    });

    return {
        chars: chars,
        colors: colors
    }
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
