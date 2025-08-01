// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";

import * as selection from "../features/selection.js";
import * as state from "../state/index.js";
import * as actions from "./actions.js";
import {translateGlyphs} from "../utils/arrays.js";
import {eventBus, EVENTS} from "../events/events.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";

let copiedSelection = null;
let copiedText = null;

export function init() {
    actions.registerAction('clipboard.cut', {
        callback: () => cut(),
        enabled: () => selection.hasSelection() && !selection.movableContent
    });
    actions.registerAction('clipboard.copy', {
        callback: () => copy(),
        enabled: () => selection.hasSelection() && !selection.movableContent
    });
    actions.registerAction('clipboard.paste', {
        callback: () => paste(),
        enabled: () => selection.hasTarget() && !selection.movableContent
    });
    actions.registerAction('clipboard.paste-in-selection', {
        callback: () => paste(true),
        enabled: () => selection.hasSelection() && !selection.movableContent
    });
}


function cut() {
    // If we're moving content, immediately finish it so that it's more intuitive as to what is being cut
    if (selection.movableContent) { selection.finishMovingContent(); }

    copySelection();
    selection.empty();
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    state.pushHistory();
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
    if (!selection.hasTarget()) {
        // There is nowhere to paste the text
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

// Copies a single char to the clipboard
export function copyChar(char) {
    writeClipboard(char);
}

/**
 * Pastes the glyph content in the selection
 * @param {{chars: string[][], colors: number[][]}} glyphs - Content to paste
 * @param {boolean} [limitToSelection=false] - If true, pasted text will only be pasted within the current selection bounds
 */
function pasteGlyphs(glyphs, limitToSelection = false) {
    // If there is no selection area, that means there is simply a caret to paste at (this only happens when using the
    // text-editor tool).
    const pasteAtCaret = !selection.hasSelection();

    if (glyphs.chars.length === 1 && glyphs.chars[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        const char = glyphs.chars[0][0];
        const color = glyphs.colors[0][0];

        (pasteAtCaret ? [selection.caretCell()] : selection.getSelectedCells()).forEach(cell => {
            state.setCurrentCelGlyph(cell.row, cell.col, char, color);
        });
    }
    else {
        // Paste glyphs at topLeft of selected area
        const topLeft = pasteAtCaret ? selection.caretCell() : selection.getSelectedCellArea().topLeft;
        translateGlyphs(glyphs, topLeft, (r, c, char, color) => {
            // Copied empty cells do not override existing cells (if you want to override existing cells to make them
            // blank, original copy should have spaces not empty cells)
            if (char === EMPTY_CHAR) return;

            if (!limitToSelection || selection.isSelectedCell({row: r, col: c})) {
                state.setCurrentCelGlyph(r, c, char, color);
            }
        });
    }

    if (selection.caretCell()) {
        selection.moveInDirection('down', {
            amount: glyphs.chars.length - 1,
            updateCaretOrigin: false,
            wrapCaretPosition: false,
        });
        selection.moveInDirection('right', {
            amount: glyphs.chars.at(-1).length,
            updateCaretOrigin: false,
            wrapCaretPosition: false,
        });
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function convertGlyphsToText(glyphs) {
    // TODO Only caring about the char, not the color
    return glyphs.chars.map(row => {
        return row.map(char => {
            // Convert empty cells to WHITESPACE_CHAR so when it is pasted to a text document the spacing is correct
            return char === undefined || char === EMPTY_CHAR ? WHITESPACE_CHAR : char;
        }).join('');
    }).join('\n');
}

const MAX_TEXT_LENGTH = 100000; // Upper limit just in case the OS clipboard had a huge amount of text copied
function convertTextToGlyphs(text) {
    let chars = [], colors = [];
    const primaryColorIndex = state.primaryColorIndex()
    
    text.slice(0, MAX_TEXT_LENGTH).split(/\r?\n/).forEach((line, r) => {
        chars[r] = [];
        colors[r] = [];

        line.split('').forEach((char, c) => {
            chars[r][c] = char;
            colors[r][c] = primaryColorIndex // Not possible to read color (e.g. if copied from an RTF) so just use primary color
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
            " in your browser settings if you want to copy text.");
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
