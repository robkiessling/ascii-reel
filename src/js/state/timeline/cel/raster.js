import {create2dArray, split1DArrayInto2D} from "../../../utils/arrays.js";
import {numCols, numRows} from "../../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../../config/chars.js";
import {charInBounds, getOffsetPosition} from "../cels.js";
import {addToCache} from "../../unicode.js";
import pako from "pako";

/**
 * Raster Cel
 * -----------------
 * Raster cels store fixed-size 2D arrays of characters/colors, where each cell corresponds to a grid position on
 * the canvas.
 *
 * All drawn shapes are immediately rasterized; they are converted into a raw 2D array of characters/colors. This
 * process loses all shape-level information — the output has no knowledge of the original shape's position, size,
 * styling, the fact that it used to be a rectangle, etc.
 *
 */

const RASTER_CEL_DEFAULTS = {
    layerType: 'raster',
    chars: [],
    colors: [],
}

export const RasterCelOps = {
    normalize: cel => {
        const normalizedCel = $.extend(true, {}, RASTER_CEL_DEFAULTS);
        mergeNonGlyphContent(normalizedCel, cel);

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
    },
    rasterizedGlyphs: cel => {
        return {
            chars: cel.chars,
            colors: cel.colors
        }
    },
    hasContent: (cel, matchingColorIndex) => {
        let result = false;
        iterateCells(cel, (r, c, char, colorIndex) => {
            if (
                (char !== EMPTY_CHAR && char !== WHITESPACE_CHAR) &&
                (matchingColorIndex === undefined || matchingColorIndex === colorIndex)
            ) result = true
        })
        return result;
    },
    translate: (cel, rowOffset, colOffset, wrap = false) => {
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
    },
    resize: (cel, newDimensions, rowOffset, colOffset) => {
        let resizedChars = [];
        let resizedColors = [];

        for (let r = 0; r < newDimensions[0]; r++) {
            for (let c = 0; c < newDimensions[1]; c++) {
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
    },

    convertToMonochrome: cel => {
        cel.colors = create2dArray(numRows(), numCols(), 0);
    },
    updateColorIndexes: (cel, callback) => {
        iterateCells(cel, (r, c, char, colorIndex) => {
            callback(colorIndex, newColorIndex => cel.colors[r][c] = newColorIndex);
        })
    },
    colorSwap: (cel, oldColorIndex, newColorIndex) => {
        iterateCells(cel, (r, c, char, colorIndex) => {
            if (colorIndex === oldColorIndex) RasterCelOps.setGlyph(cel, r, c, undefined, newColorIndex);
        })
    },

    setGlyph: (cel, row, col, char, color) => {
        if (charInBounds(row, col)) {
            if (char !== undefined) {
                addToCache(char);
                cel.chars[row][col] = char;
            }
            if (color !== undefined) { cel.colors[row][col] = color; }
        }
    },

    encode: (cel, req16BitColors) => {
        const result = mergeNonGlyphContent({}, cel);
        result.chars = encodeChars(cel.chars);
        result.colors = encodeColors(cel.colors, req16BitColors);
        return result;
    },
    decode: (cel, celRowLength, req16BitColors) => {
        const result = mergeNonGlyphContent({}, cel);
        result.chars = decodeChars(cel.chars, celRowLength || 1);
        result.colors = decodeColors(cel.colors, celRowLength || 1, req16BitColors);
        return result;
    }
}


// -------- Private helper functions:

// Copy over everything except for chars/colors
function mergeNonGlyphContent(toCel, fromCel) {
    Object.keys(fromCel).filter(key => key !== 'chars' && key !== 'colors').forEach(key => toCel[key] = fromCel[key]);
    return toCel;
}

function iterateCells(cel, callback) {
    const rowLength = numRows(), colLength = numCols();
    for (let row = 0; row < rowLength; row++) {
        for (let col = 0; col < colLength; col++) {
            callback(row, col, cel.chars[row][col], cel.colors[row][col]);
        }
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

