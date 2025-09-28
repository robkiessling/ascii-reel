// Necessary for clipboard read/write https://stackoverflow.com/a/61517521
import "regenerator-runtime/runtime.js";
import "core-js/stable.js";

import * as selectionController from "../controllers/selection/index.js";
import * as state from "../state/index.js";
import * as actions from "./actions.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";
import {LAYER_TYPES} from "../state/constants.js";
import Cell from "../geometry/cell.js";

let copiedSelection = {};

export function init() {
    actions.registerAction('clipboard.cut', {
        callback: () => cut(),
        enabled: () => canCopy()
    });
    actions.registerAction('clipboard.copy', {
        callback: () => copy(),
        enabled: () => canCopy()
    });
    actions.registerAction('clipboard.paste', {
        callback: () => paste(),
        enabled: () => canPaste()
    });
    actions.registerAction('clipboard.paste-in-selection', {
        callback: () => paste(true),
        enabled: () => canPaste(true)
    });
}

/**
 * Determines whether the current layer has any content that can be copied or cut.
 * @returns {boolean}
 */
function canCopy() {
    switch (state.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            return selectionController.raster.hasSelection()
        case LAYER_TYPES.VECTOR:
            if (selectionController.vector.isEditingText()) {
                return selectionController.vector.getTextSelection().hasRange;
            }
            return selectionController.vector.hasSelectedShapes();
        default:
            throw new Error(`Invalid layer type: ${state.currentLayerType()}`)
    }
}

/**
 * Determines whether the current layer has a place to paste copied content.
 * @param {boolean} [limitToSelection=false] Whether the paste is going to be limited to within the current selection.
 * @returns {boolean}
 */
export function canPaste(limitToSelection) {
    switch (state.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            if (limitToSelection) return selectionController.raster.hasSelection() && !selectionController.raster.movableContent();
            return selectionController.raster.hasTarget() && !selectionController.raster.movableContent()
        case LAYER_TYPES.VECTOR:
            if (limitToSelection) return false; // Vector cels have no concept of "paste in selection"
            return true;
        default:
            throw new Error(`Invalid layer type: ${state.currentLayerType()}`)
    }
}


function cut() {
    // If we're moving content, immediately finish it so that it's more intuitive as to what is being cut
    if (selectionController.raster.movableContent()) { selectionController.raster.finishMovingContent(); }

    copy();

    // Empty selection
    switch (state.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            // todo don't tie these to "backspace key" handlers; tie them to actual empty() functions
            selectionController.raster.handleBackspaceKey();
            break;
        case LAYER_TYPES.VECTOR:
            selectionController.vector.handleBackspaceKey();
            break;
    }
}

/**
 * Copies the current selected content.
 * - Saves a rich representation (glyph arrays, shape instances, etc.) of the selection for use when pasting back
 *   inside this app. This is stored in `copiedSelection`.
 * - Writes a plain-text version of the selection to the system clipboard so it can be pasted into external
 *   applications.
 */
function copy() {
    switch (state.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            const glyphs = selectionController.raster.getSelectedValues();
            copiedSelection = {
                text: convertGlyphsToText(glyphs),
                glyphs
            }
            break;
        case LAYER_TYPES.VECTOR:
            if (selectionController.vector.isEditingText()) {
                copiedSelection = {
                    text: selectionController.vector.getTextSelection().text,
                    glyphs: null, // Don't calculate glyphs yet; we can calculate them if/when we end up pasting
                }
            } else {
                const glyphs = selectionController.vector.selectedShapesGlyphs();
                const shapes = selectionController.vector.selectedShapes();

                copiedSelection = {
                    text: convertGlyphsToText(glyphs),
                    glyphs,
                    shapes
                }
            }
            break;
    }

    writeClipboard(copiedSelection.text);
}

/**
 * Pastes content into the canvas.
 * - If new system clipboard content is available, use that first (e.g. plain text from the OS).
 * - Otherwise, fall back to the app's rich internal clipboard content (glyph arrays, shapes, etc.).
 *
 * @param {boolean} [limitToSelection=false] - If true, restricts the pasted content to the current selection area.
 *   This option currently only applies to raster pasting.
 */
function paste(limitToSelection) {
    readClipboard(latestText => {
        // If external clipboard has changed, convert new clipboard text to glyphs. Otherwise, use stored glyphs.
        const latestGlyphs = latestText !== copiedSelection.text || !copiedSelection.glyphs ?
            convertTextToGlyphs(latestText) :
            copiedSelection.glyphs;

        switch (state.currentLayerType()) {
            case LAYER_TYPES.RASTER:
                selectionController.raster.insertGlyphs(latestGlyphs, limitToSelection);
                break;
            case LAYER_TYPES.VECTOR:
                if (selectionController.vector.isEditingText()) {
                    selectionController.vector.insertText(latestText);
                } else if (copiedSelection.shapes) {
                    selectionController.vector.importShapes(copiedSelection.shapes.map(shape => shape.duplicate()));
                } else {
                    selectionController.vector.createTextboxWithText(latestText)
                }
                break;
        }
    });
}

// Copies a single char to the clipboard
export function copyChar(char) {
    writeClipboard(char);
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
