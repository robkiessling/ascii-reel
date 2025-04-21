
import {isObject, transformValues} from "../../utils/objects.js";
import {numCols, numRows, getConfig, setConfig} from "../config.js";
import {create2dArray, split1DArrayInto2D} from "../../utils/arrays.js";
import {mod} from "../../utils/numbers.js";
import {BLACK, DEFAULT_COLOR} from "../palette.js";
import pako from "pako";
import {addToCache} from "../unicode.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";

// -------------------------------------------------------------------------------- Cels
// The term "cel" is short for "celluloid" https://en.wikipedia.org/wiki/Cel
// In this app, it represents one image in a specific frame and layer
// Note: This is different from a "Cell" (in this app, a "cell" refers to a row/column pair in the canvas)

const DEFAULT_STATE = {
    cels: {},
    colorTable: []
}

const CEL_DEFAULTS = {
    chars: [[]],
    colors: [[]]
}

let state = {};

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE);

    if (newState.colorTable) state.colorTable = [...newState.colorTable];
    if (newState.cels) state.cels = transformValues(newState.cels, (celId, cel) => normalizeCel(cel));
}
export function replaceState(newState) {
    state = newState;
}
export function getState() {
    return state;
}

export function createCel(layer, frame, data = {}) {
    const celId = getCelId(layer.id, frame.id);
    state.cels[celId] = normalizeCel(data);
}

export function deleteCel(celId) {
    delete state.cels[celId]
}

function normalizeCel(cel) {
    let normalizedCel = $.extend({}, CEL_DEFAULTS);

    // Copy over everything except for chars/colors
    Object.keys(cel).filter(key => key !== 'chars' && key !== 'colors').forEach(key => normalizedCel[key] = cel[key]);

    // Build chars/colors arrays, making sure every row/col has a value, and boundaries are followed
    normalizedCel.chars = [];
    normalizedCel.colors = [];

    let row, col, char, color, rowLength = numRows(), colLength = numCols();
    for (row = 0; row < rowLength; row++) {
        normalizedCel.chars[row] = [];
        normalizedCel.colors[row] = [];

        for (col = 0; col < colLength; col++) {
            char = undefined;
            color = undefined;

            if (cel.chars && cel.chars[row] && cel.chars[row][col] !== undefined) {
                char = cel.chars[row][col];
            }
            if (cel.colors && cel.colors[row] && cel.colors[row][col] !== undefined) {
                color = cel.colors[row][col];
            }
            if (char === undefined) { char = EMPTY_CHAR; }
            if (color === undefined) { color = 0; }

            normalizedCel.chars[row][col] = char;
            normalizedCel.colors[row][col] = color;
        }
    }

    return normalizedCel;
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

export function iterateCellsForCel(cel, callback) {
    let row, col, rowLength = numRows(), colLength = numCols();
    for (row = 0; row < rowLength; row++) {
        for (col = 0; col < colLength; col++) {
            callback(row, col, cel.chars[row][col], cel.colors[row][col]);
        }
    }
}


// -------------------------------------------------------------------------------- Glyphs
// In this app, "glyph" is the term I'm using for the combination of a char and a color

export function setCelGlyph(cel, row, col, char, color) {
    if (charInBounds(row, col)) {
        if (char !== undefined) {
            addToCache(char);
            cel.chars[row][col] = char;
        }
        if (color !== undefined) { cel.colors[row][col] = color; }
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
    let chars = create2dArray(numRows(), numCols(), EMPTY_CHAR);
    let colors = create2dArray(numRows(), numCols(), 0);

    let celR, celC, r, c;
    for (celR = 0; celR < cel.chars.length; celR++) {
        for (celC = 0; celC < cel.chars[celR].length; celC++) {
            ({ r, c } = getOffsetPosition(celR, celC, rowOffset, colOffset, wrap));

            if (charInBounds(r, c)) {
                chars[r][c] = cel.chars[celR][celC];
                colors[r][c] = cel.colors[celR][celC];
            }
        }
    }

    cel.chars = chars;
    cel.colors = colors;
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
        iterateCellsForCel(cel, (r, c, char, colorIndex) => {
            // If colorTable does not have a value for the current colorIndex, we set the colorIndex to 0
            if (!state.colorTable[colorIndex]) colorIndex = 0;

            // If the color value of a colorIndex is duplicated by an earlier colorIndex, we use that earlier colorIndex
            if (dupUpdateMap.has(colorIndex)) colorIndex = dupUpdateMap.get(colorIndex);

            // Add any new color indexes to the vacuum map
            if (!vacuumMap.has(colorIndex)) vacuumMap.set(colorIndex, newIndex++)

            // Update the cel color to use the vacuumed index
            cel.colors[r][c] = vacuumMap.get(colorIndex);
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

export function primaryColorIndex() {
    return colorIndex(getConfig('primaryColor'));
}

export function convertToMonochrome() {
    state.colorTable = [BLACK];
    iterateAllCels(cel => {
        cel.colors = create2dArray(numRows(), numCols(), 0);
    })
}

// TODO would be better if this was smarter - what I really want is a way to detect if there are changes that require saving
export function hasCharContent() {
    return Object.values(state.cels).some(cel => {
        return cel.chars.some(row => row.some(char => char !== EMPTY_CHAR && char !== WHITESPACE_CHAR));
    })
}



// -------------------------------------------------------------------------------- Resizing Canvas

/**
 * Resizes the canvas dimensions. If the canvas shrinks, all content outside of the new dimensions will be truncated.
 * @param {[number, number]} newDimensions - A tuple representing [num columns, num rows] of the new dimensions
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
            rowOffset = newDimensions[1] > numRows() ?
                Math.ceil((numRows() - newDimensions[1]) / 2) :
                Math.floor((numRows() - newDimensions[1]) / 2)
            break;
        case 'bottom':
            rowOffset = numRows() - newDimensions[1];
            break;
    }

    switch(colOffset) {
        case 'left':
            colOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            colOffset = newDimensions[0] > numCols() ?
                Math.ceil((numCols() - newDimensions[0]) / 2) :
                Math.floor((numCols() - newDimensions[0]) / 2)
            break;
        case 'right':
            colOffset = numCols() - newDimensions[0];
            break;
    }

    iterateAllCels(cel => {
        let resizedChars = [];
        let resizedColors = [];

        for (let r = 0; r < newDimensions[1]; r++) {
            for (let c = 0; c < newDimensions[0]; c++) {
                if (resizedChars[r] === undefined) { resizedChars[r] = []; }
                if (resizedColors[r] === undefined) { resizedColors[r] = []; }

                let oldRow = r + rowOffset;
                let oldCol = c + colOffset;

                resizedChars[r][c] = cel.chars[oldRow] && cel.chars[oldRow][oldCol] ? cel.chars[oldRow][oldCol] : EMPTY_CHAR;
                resizedColors[r][c] = cel.colors[oldRow] && cel.colors[oldRow][oldCol] ? cel.colors[oldRow][oldCol] : 0;
            }
        }

        cel.chars = resizedChars;
        cel.colors = resizedColors;
    });

    setConfig('dimensions', newDimensions);
}



export function encodeState() {
    vacuumColorTable();
    const req16BitColors = state.colorTable.length > 0xFF;

    return {
        colorTable: state.colorTable,
        cels: transformValues(state.cels, (celId, cel) => {
            return {
                chars: encodeChars(cel.chars),
                colors: encodeColors(cel.colors, req16BitColors),
            }
        })
    }
}
export function decodeState(encodedState, celRowLength) {
    const req16BitColors = (encodedState.colorTable.length || 0) > 0xFF;

    return {
        colorTable: encodedState.colorTable,
        cels: transformValues(encodedState.cels, (celId, cel) => {
            return {
                chars: decodeChars(cel.chars, celRowLength || 1),
                colors: decodeColors(cel.colors, celRowLength || 1, req16BitColors),
            }
        })
    }
}

const ENCODED_EMPTY_CHAR = "\0";

/**
 * Encode a 2d chars array into a compressed Base64 string.
 * @param {string[][]} chars - 2d array of chars. Note: EMPTY_CHAR is a valid char.
 * @returns {string} - Base 64 string representing the compressed 2d array
 */
function encodeChars(chars) {
    const flatStr = chars.flat().map(char => char === EMPTY_CHAR ? ENCODED_EMPTY_CHAR : char).join(''); // convert to flat string
    const compressed = pako.deflate(flatStr); // convert to compressed Uint8Array
    return window.btoa(String.fromCharCode(...compressed)); // convert to Base64 string

    // todo does spread operator cap out at 10000 elements? maybe use TextDecoder? https://github.com/nodeca/pako/issues/206#issuecomment-1835315482
    //      or https://stackoverflow.com/a/66046176/4904996
}

/**
 * Decodes a compressed Base64 string into a 2d chars array
 * @param {string} base64String - Base 64 string representing the compressed 2d array (from encodeChars function)
 * @param {number} rowLength - How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @returns {string[][]} - 2d array of chars
 */
function decodeChars(base64String, rowLength) {
    const compressed = Uint8Array.from(window.atob(base64String), c => c.charCodeAt(0)); // convert to compressed Uint8Array
    const flatStr = pako.inflate(compressed, {to: 'string'}) // convert to uncompressed flat string
    return split1DArrayInto2D(flatStr.split('').map(char => char === ENCODED_EMPTY_CHAR ? EMPTY_CHAR : char), rowLength) // convert to 2d chars array
}

/**
 * Encode a 2d colors array into a compressed Base64 string.
 * @param {number[][]} colors - 2d array of color integers
 * @param {Boolean} has16BitNumbers - If your colors array contains integers greater than 255 you must set this param
 *   to be true, otherwise they won't be encoded correctly
 * @returns {string} - Base 64 string representing the compressed 2d array
 */
function encodeColors(colors, has16BitNumbers) {
    let uncompressed;
    const flatColors = colors.flat();

    // Convert to Uint8Array typed array for compression
    if (has16BitNumbers) {
        // pako only supports Uint8Array, so if there are 16-bit numbers we need to split each 16-bit number into 2 bytes
        uncompressed = new Uint8Array(flatColors.length * 2);
        for (let i = 0; i < flatColors.length; i++) {
            uncompressed[i * 2] = (flatColors[i] >> 8) & 0xFF; // Most significant byte
            uncompressed[i * 2 + 1] = flatColors[i] & 0xFF;    // Least significant byte
        }
    }
    else {
        uncompressed = new Uint8Array(flatColors)
    }

    const compressed = pako.deflate(uncompressed); // convert to compressed Uint8Array
    return btoa(String.fromCharCode(...compressed)); // Convert to Base64 string for json
}

/**
 * Decodes a compressed Base64 string into a 2d colors array
 * @param {string} base64String - Base 64 string representing the compressed 2d array (from encodeColors function)
 * @param {number} rowLength - How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @param {boolean} has16BitNumbers - If the encoded colors array contains integers greater than 255, you must set this param
 *   to be true, otherwise they won't be decoded correctly
 * @returns {number[][]} - 2d array of color integers
 */
function decodeColors(base64String, rowLength, has16BitNumbers) {
    const compressed = Uint8Array.from(atob(base64String), c => c.charCodeAt(0)); // Base64 string -> compressed Uint8Array
    const uncompressed = pako.inflate(compressed); // convert to uncompressed Uint8Array

    let flatColors;
    if (has16BitNumbers) {
        // Convert pairs of two consecutive bytes back into one 16-bit number
        flatColors = [];
        for (let i = 0; i < uncompressed.length; i += 2) {
            flatColors.push((uncompressed[i] << 8) | uncompressed[i + 1]);
        }
    }
    else {
        flatColors = Array.from(uncompressed); // Convert to array of 8-bit numbers
    }

    return split1DArrayInto2D(flatColors, rowLength)
}

