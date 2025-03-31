
import {transformValues} from "../utils/objects.js";
import {numCols, numRows, setConfig} from "./config.js";
import {currentLayer, layerIndex, layers} from "./layers.js";
import {currentFrame, frames, previousFrame} from "./frames.js";
import {create2dArray, split1DArrayInto2D, translateGlyphs} from "../utils/arrays.js";
import {mod} from "../utils/numbers.js";
import {DEFAULT_COLOR} from "../components/palette.js";
import {getMetadata} from "./metadata.js";
import pako from "pako";
import {pushStateToHistory} from "./history.js";

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
            if (char === undefined) { char = ''; }
            if (color === undefined) { color = 0; }

            normalizedCel.chars[row][col] = char;
            normalizedCel.colors[row][col] = color;
        }
    }

    return normalizedCel;
}

// Ensures all the cels referenced by frames/layers exist, and prunes any unused cels.
// This should only be needed if the file was manually modified outside the app.
export function validate() {
    const usedCelIds = new Set();
    frames().forEach(frame => {
        layers().forEach(layer => {
            const celId = getCelId(layer.id, frame.id);
            if (!cel(layer, frame)) {
                console.warn(`No cel found for (${celId}) -- inserting blank cel`)
                createCel(layer, frame);
            }
            usedCelIds.add(celId)
        })
    })
    for (const [celId, cel] of Object.entries(state.cels)) {
        if (!usedCelIds.has(celId)) {
            console.warn(`Cel (${celId}) is unused in frames/layers -- deleting cel`)
            delete state.cels[celId];
        }
    }
}


export function currentCel() {
    return cel(currentLayer(), currentFrame());
}

export function previousCel() {
    return cel(currentLayer(), previousFrame());
}

export function cel(layer, frame) {
    return state.cels[getCelId(layer.id, frame.id)];
}

export function getCelId(layerId, frameId) {
    return `F-${frameId},L-${layerId}`;
}


export function iterateAllCels(callback) {
    for (const cel of Object.values(state.cels)) {
        callback(cel);
    }
}

export function celIdsForLayer(layer) {
    return frames().map(frame => getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentLayer(callback) {
    celIdsForLayer(currentLayer()).forEach(celId => {
        callback(state.cels[celId]);
    });
}

export function celIdsForFrame(frame) {
    return layers().map(layer => getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentFrame(callback) {
    celIdsForFrame(currentFrame()).forEach(celId => {
        callback(state.cels[celId]);
    });
}

/**
 * Iterates through cels. Which cels are iterated over depends on the allLayers and allFrames params.
 * @param {Boolean} allLayers If true, will include cels across all layers. If false, just includes cels for current layer.
 * @param {Boolean} allFrames If true, will include cels across all frames. If false, just includes cels for current frame.
 * @param {function(cel)} celCallback Callback called for each cel being iterated over
 */
export function iterateCels(allLayers, allFrames, celCallback) {
    if (allLayers && allFrames) {
        // Apply to all cels
        iterateAllCels(celCallback);
    }
    else if (!allLayers && allFrames) {
        // Apply to all frames of a single layer
        iterateCelsForCurrentLayer(celCallback);
    }
    else if (allLayers && !allFrames) {
        // Apply to all layers (of a single frame)
        iterateCelsForCurrentFrame(celCallback);
    }
    else {
        // Apply to current cel
        celCallback(currentCel());
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

// This function returns the glyph as a 2d array: [char, color]
export function getCurrentCelGlyph(row, col) {
    return charInBounds(row, col) ? [currentCel().chars[row][col], currentCel().colors[row][col]] : [];
}

// If the char or color parameter is undefined, that parameter will not be overridden
export function setCurrentCelGlyph(row, col, char, color) {
    setCelGlyph(currentCel(), row, col, char, color);
}

export function setCelGlyph(cel, row, col, char, color) {
    if (charInBounds(row, col)) {
        if (char !== undefined) { cel.chars[row][col] = char; }
        if (color !== undefined) { cel.colors[row][col] = color; }
    }
}

export function charInBounds(row, col) {
    return row >= 0 && row < numRows() && col >= 0 && col < numCols();
}

// Aggregates all visible layers for a frame
export function layeredGlyphs(frame, options = {}) {
    let chars = create2dArray(numRows(), numCols(), '');
    let colors = create2dArray(numRows(), numCols(), 0);

    let l, layer, isCurrentLayer, celChars, celColors, celR, celC, r, c;

    for (l = 0; l < layers().length; l++) {
        layer = layers()[l];
        isCurrentLayer = l === layerIndex();

        if (options.showAllLayers || (getMetadata('lockLayerVisibility') ? isCurrentLayer : layer.visible)) {
            celChars = cel(layer, frame).chars;
            celColors = cel(layer, frame).colors;
            const offset = options.showOffsetContent && options.offset.amount;

            for (celR = 0; celR < celChars.length; celR++) {
                for (celC = 0; celC < celChars[celR].length; celC++) {
                    if (celChars[celR][celC] === '') continue;

                    r = celR;
                    c = celC;

                    if (offset && (options.offset.modifiers.allLayers || isCurrentLayer)) {
                        ({ r, c } = getOffsetPosition(celR, celC, offset[0], offset[1], options.offset.modifiers.wrap));
                        if (!charInBounds(r, c)) continue;
                    }

                    chars[r][c] = celChars[celR][celC];
                    colors[r][c] = celColors[celR][celC];
                }
            }
        }

        // If there is movableContent, show it on top of the rest of the layer
        if (options.movableContent && options.movableContent.glyphs && isCurrentLayer) {
            translateGlyphs(options.movableContent.glyphs, options.movableContent.origin, (r, c, char, color) => {
                if (char !== undefined && charInBounds(r, c)) {
                    chars[r][c] = char;
                    colors[r][c] = color;
                }
            });
        }

        // If there is drawingContent (e.g. drawing a line out of chars), show it on top of the rest of the layer
        if (options.drawingContent && isCurrentLayer) {
            translateGlyphs(options.drawingContent.glyphs, options.drawingContent.origin, (r, c, char, color) => {
                if (char !== undefined && charInBounds(r, c)) {
                    chars[r][c] = char;
                    colors[r][c] = color;
                }
            });
        }

        if (options.convertEmptyStrToSpace) {
            for (r = 0; r < chars.length; r++) {
                for (c = 0; c < chars[r].length; c++) {
                    if (chars[r][c] === '') {
                        chars[r][c] = ' ';
                        // colors[r][c] will be left at default (0)
                    }
                }
            }
        }
    }

    return {
        chars: chars,
        colors: colors
    };
}

/**
 * Shifts all the contents (chars/colors) of a cel.
 * @param cel The cel to affect
 * @param {Number} rowOffset How many rows to shift (can be negative)
 * @param {Number} colOffset How many columns to shift content (can be negative)
 * @param {Boolean} wrap If true, shifting content past the cel boundaries will wrap it around to the other side
 */
export function translateCel(cel, rowOffset, colOffset, wrap = false) {
    let chars = create2dArray(numRows(), numCols(), '');
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

function getOffsetPosition(r, c, rowOffset, colOffset, wrap) {
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
    return colorIndex(getMetadata('primaryColor'));
}

// TODO would be better if this was smarter - what I really want is a way to detect if there are changes that require saving
export function hasCharContent() {
    return Object.values(state.cels).some(cel => {
        return cel.chars.some(row => row.some(char => char !== '' && char !== ' '));
    })
}



// -------------------------------------------------------------------------------- Resizing Canvas

/**
 * Resizes the canvas dimensions. If the canvas shrinks, all content outside of the new dimensions will be truncated.
 * @param newDimensions Array [num columns, num rows] of the new dimensions
 * @param rowOffset Integer or 'top'/'middle'/'bottom' - If an integer is provided, it will determine the starting row
 *                  for the content in the new dimensions. Alternatively, a string 'top'/'middle'/'bottom' can be given
 *                  to anchor the content to the top, middle, or bottom row in the new dimensions.
 * @param colOffset Same as rowOffset, but for the column.
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

    Object.values(state.cels).forEach(cel => {
        let resizedChars = [];
        let resizedColors = [];

        for (let r = 0; r < newDimensions[1]; r++) {
            for (let c = 0; c < newDimensions[0]; c++) {
                if (resizedChars[r] === undefined) { resizedChars[r] = []; }
                if (resizedColors[r] === undefined) { resizedColors[r] = []; }

                let oldRow = r + rowOffset;
                let oldCol = c + colOffset;

                resizedChars[r][c] = cel.chars[oldRow] && cel.chars[oldRow][oldCol] ? cel.chars[oldRow][oldCol] : '';
                resizedColors[r][c] = cel.colors[oldRow] && cel.colors[oldRow][oldCol] ? cel.colors[oldRow][oldCol] : 0;
            }
        }

        cel.chars = resizedChars;
        cel.colors = resizedColors;
    });

    setConfig('dimensions', newDimensions);

    pushStateToHistory({ requiresResize: true });
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


/**
 * Encode a 2d chars array into a compressed Base64 string.
 * @param {Array} chars 2d array of chars. The empty string "" is a valid char.
 * @returns {string} Base 64 string representing the compressed 2d array
 */
function encodeChars(chars) {
    const flatStr = chars.flat().map(char => char === "" ? "\0" : char).join(''); // convert to flat string
    const compressed = pako.deflate(flatStr); // convert to compressed Uint8Array
    return window.btoa(String.fromCharCode(...compressed)); // convert to Base64 string

    // todo does spread operator cap out at 10000 elements? maybe use TextDecoder? https://github.com/nodeca/pako/issues/206#issuecomment-1835315482
    //      or https://stackoverflow.com/a/66046176/4904996
}

/**
 * Decodes a compressed Base64 string into a 2d chars array
 * @param base64String Base 64 string representing the compressed 2d array (from encodeChars function)
 * @param {Number} rowLength How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @returns {Array} 2d array of chars
 */
function decodeChars(base64String, rowLength) {
    const compressed = Uint8Array.from(window.atob(base64String), c => c.charCodeAt(0)); // convert to compressed Uint8Array
    const flatStr = pako.inflate(compressed, {to: 'string'}) // convert to uncompressed flat string
    return split1DArrayInto2D(flatStr.split('').map(char => char === "\0" ? "" : char), rowLength) // convert to 2d chars array
}

/**
 * Encode a 2d colors array into a compressed Base64 string.
 * @param {Array} colors 2d array of color integers
 * @param {Boolean} has16BitNumbers If your colors array contains integers greater than 255 you must set this param
 *   to be true, otherwise they won't be encoded correctly
 * @returns {string} Base 64 string representing the compressed 2d array
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
 * @param base64String Base 64 string representing the compressed 2d array (from encodeColors function)
 * @param {Number} rowLength How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @param {Boolean} has16BitNumbers If the encoded colors array contains integers greater than 255, you must set this param
 *   to be true, otherwise they won't be decoded correctly
 * @returns {Array} 2d array of color integers
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

