
import {isObject, transformValues} from "../../utils/objects.js";
import {numCols, numRows, getConfig, setConfig} from "../config.js";
import {create2dArray, split1DArrayInto2D} from "../../utils/arrays.js";
import {mod} from "../../utils/numbers.js";
import {DEFAULT_COLOR} from "../palette.js";
import pako from "pako";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {CelOps, clearCachedCel, clearAllCachedCels} from "./cel/index.js";

const DEFAULT_STATE = {
    cels: {},
    colorTable: []
}

let state = {};

export function load(newState = {}) {
    clearAllCachedCels();

    state = $.extend(true, {}, DEFAULT_STATE);

    if (newState.colorTable) state.colorTable = [...newState.colorTable];
    if (newState.cels) state.cels = transformValues(newState.cels, (celId, cel) => CelOps.normalize(cel))
}

export function replaceState(newState) {
    clearAllCachedCels();
    state = newState;
}

export function getState() {
    return state;
}

export function createCel(layer, frame, data = {}) {
    const celId = getCelId(layer.id, frame.id);
    state.cels[celId] = CelOps.normalize(data, layer, frame);
}

export function deleteCel(celId) {
    clearCachedCel(cel(celId));

    delete state.cels[celId]
}

/**
 * Returns the cel for either a celId or a layer & frame combination.
 * @param {string|Object} celIdOrLayer - Can be a celId string or a Layer object. If it is a celId string, simply returns
 *   the cel for that given id. If it is a Layer object, must also provide a Frame object as second parameter. The cel
 *   for that given layer & frame is returned.
 * @param {Object} [frame] - Frame object (only applicable if celIdOrLayer was a Layer object)
 * @returns {Object} - The cel at the given layer/frame
 */
export function cel(celIdOrLayer, frame) {
    if (arguments.length === 1 && typeof celIdOrLayer === 'string') {
        return state.cels[celIdOrLayer];
    }
    else if (arguments.length === 2 && isObject(celIdOrLayer) && isObject(frame)) {
        return state.cels[getCelId(celIdOrLayer.id, frame.id)];
    }
    else {
        throw new Error(`Invalid cel() call, arguments: ${arguments}`)
    }
}

export function getCelId(layerId, frameId) {
    return `F-${frameId},L-${layerId}`;
}

export function iterateAllCelIds(callback) {
    for (const celId of Object.keys(state.cels)) {
        callback(celId);
    }
}

export function iterateAllCels(callback) {
    for (const cel of Object.values(state.cels)) {
        callback(cel);
    }
}

export function charInBounds(row, col) {
    return row >= 0 && row < numRows() && col >= 0 && col < numCols();
}

/**
 * Shifts all the contents (chars/colors) of a cel.
 * @param {cel} cel - The cel to affect
 * @param {number} rowOffset - How many rows to shift (can be negative)
 * @param {number} colOffset - How many columns to shift content (can be negative)
 * @param {boolean} [wrap=false] - If true, shifting content past the cel boundaries will wrap it around to the other side
 */
export function translateCel(cel, rowOffset, colOffset, wrap = false) {
    CelOps.translate(cel, rowOffset, colOffset, wrap);
}

export function setCelGlyph(cel, row, col, char, color) {
    CelOps.setGlyph(cel, row, col, char, color);
}

export function getCelGlyphs(cel) {
    return CelOps.rasterizedGlyphs(cel)
}

export function colorSwapCel(cel, oldColorIndex, newColorIndex) {
    CelOps.colorSwap(cel, oldColorIndex, newColorIndex)
}

export function getOffsetPosition(r, c, rowOffset, colOffset, wrap) {
    r += rowOffset;
    c += colOffset;

    if (wrap) {
        r = mod(r, numRows());
        c = mod(c, numCols());
    }

    return { r, c }
}


// -------------------------------------------------------------------------------- Colors / Palettes
// - colorTable includes all colors used in rendering
// - palette.colors includes only colors that have been saved to the palette

export function colorTable() {
    return state.colorTable.slice(0); // Returning a dup; colorTable should only be modified by colorIndex/vacuum
}
export function colorStr(colorIndex) {
    return state.colorTable[colorIndex] === undefined ? DEFAULT_COLOR : state.colorTable[colorIndex];
}

// Cleans out any unused colors from colorTable (adjusting cel color indices appropriately). Colors can become unused
// if, for example, some text was drawn with that color but then re-painted with a new color.
// This method also ensures all cel colors actually exist in the colorTable.
export function vacuumColorTable() {
    // Ensure colorTable has at least one entry so we can use index 0 as a fallback
    if (!state.colorTable[0]) state.colorTable[0] = DEFAULT_COLOR;

    let newIndex = 0;
    const vacuumMap = new Map(); // maps original colorIndexes to their new vacuumed colorIndex
    const dupUpdateMap = getDupColorUpdateMap(); // keeps track of any duplicate colorTable values

    iterateAllCels(cel => {
        CelOps.updateColorIndexes(cel, (colorIndex, updater) => {
            // If colorTable does not have a value for the current colorIndex, we set the colorIndex to 0
            if (!state.colorTable[colorIndex]) colorIndex = 0;

            // If the color value of a colorIndex is duplicated by an earlier colorIndex, we use that earlier colorIndex
            if (dupUpdateMap.has(colorIndex)) colorIndex = dupUpdateMap.get(colorIndex);

            // Add any new color indexes to the vacuum map
            if (!vacuumMap.has(colorIndex)) vacuumMap.set(colorIndex, newIndex++)

            // Update the cel color to use the vacuumed index
            updater(vacuumMap.get(colorIndex));
        })
    })

    const vacuumedColorTable = [];
    for (const [oldIndex, newIndex] of vacuumMap.entries()) {
        vacuumedColorTable[newIndex] = state.colorTable[oldIndex];
    }
    state.colorTable = vacuumedColorTable;
}

// Returns a map of any duplicate colorTable values, where the key is the dup index and the value is the original index.
// E.g. if colorTable is ['#000000', '#ff0000', '#00ff00', '#ff0000'], index 3 (the second '#ff0000') is a duplicate,
// so the returned map would be { 3 => 1 }, since any cel that uses colorIndex 3 can be replaced with colorIndex 1.
function getDupColorUpdateMap() {
    const updateMap = new Map();
    const colorStrToIndexMap = new Map();
    state.colorTable.forEach((colorStr, colorIndex) => {
        if (colorStrToIndexMap.has(colorStr)) {
            // It is a duplicate
            updateMap.set(colorIndex, colorStrToIndexMap.get(colorStr))
        }
        else {
            // It is an original
            colorStrToIndexMap.set(colorStr, colorIndex);
        }
    })
    return updateMap;
}

export function colorIndex(colorStr) {
    let index = state.colorTable.indexOf(colorStr);

    if (index === -1) {
        state.colorTable.push(colorStr);
        index = state.colorTable.length - 1;
    }

    return index;
}

function hasColor(colorStr) {
    return state.colorTable.indexOf(colorStr) !== -1;
}

export function primaryColorIndex() {
    return colorIndex(getConfig('primaryColor'));
}

export function convertToMonochrome(color) {
    state.colorTable = [color]
    iterateAllCels(cel => CelOps.convertToMonochrome(cel))
}

/**
 * Returns true if any cels have non-blank characters
 * @param {string} [matchingColor=undefined] If provided, the non-blank character has to also match this color value
 * @returns {boolean}
 */
export function hasCharContent(matchingColor) {
    let matchingColorIndex;
    if (matchingColor !== undefined) {
        matchingColorIndex = hasColor(matchingColor) ? colorIndex(matchingColor) : -1;
    }

    // Not using iterateAllCels so we can terminate early
    for (const cel of Object.values(state.cels)) {
        if (CelOps.hasContent(cel, matchingColorIndex)) return true;
    }

    return false;
}



// -------------------------------------------------------------------------------- Resizing Canvas

/**
 * Resizes the canvas dimensions. If the canvas shrinks, all content outside of the new dimensions will be truncated.
 * @param {[number, number]} newDimensions - An array representing [num rows, num cols] of the new dimensions
 * @param {number|'top'|'middle'|'bottom'} rowOffset - If an integer is provided, it will determine the starting row
 *   for the content in the new dimensions. Alternatively, a string 'top'/'middle'/'bottom' can be given to anchor the
 *   content to the top, middle, or bottom row in the new dimensions.
 * @param {number|'top'|'middle'|'bottom'} colOffset - Same definition as rowOffset, but for the column.
 */
export function resize(newDimensions, rowOffset, colOffset) {
    switch(rowOffset) {
        case 'top':
            rowOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            rowOffset = newDimensions[0] > numRows() ?
                Math.ceil((numRows() - newDimensions[0]) / 2) :
                Math.floor((numRows() - newDimensions[0]) / 2)
            break;
        case 'bottom':
            rowOffset = numRows() - newDimensions[0];
            break;
    }

    switch(colOffset) {
        case 'left':
            colOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            colOffset = newDimensions[1] > numCols() ?
                Math.ceil((numCols() - newDimensions[1]) / 2) :
                Math.floor((numCols() - newDimensions[1]) / 2)
            break;
        case 'right':
            colOffset = numCols() - newDimensions[1];
            break;
    }

    iterateAllCels(cel => CelOps.resize(cel, newDimensions, rowOffset, colOffset));

    setConfig('dimensions', newDimensions);
}


// -------------------------------------------------------------------------------- Encoding

export function encodeState() {
    vacuumColorTable();
    const req16BitColors = state.colorTable.length > 0xFF;

    return {
        colorTable: state.colorTable,
        cels: transformValues(state.cels, (celId, cel) => CelOps.encode(cel, req16BitColors)),
    }
}

export function decodeState(encodedState, celRowLength) {
    const req16BitColors = (encodedState.colorTable.length || 0) > 0xFF;

    return {
        colorTable: encodedState.colorTable,
        cels: transformValues(encodedState.cels, (celId, cel) => CelOps.decode(cel, celRowLength, req16BitColors))
    }
}
