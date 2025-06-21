import {create2dArray, mergeGlyphs, split1DArrayInto2D} from "../../../utils/arrays.js";
import {numCols, numRows} from "../../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../../config/chars.js";
import {charInBounds, COLOR_DEPTH_16_BIT, COLOR_DEPTH_8_BIT, getOffsetPosition} from "../cels.js";
import {addToCache} from "../../unicode.js";
import pako from "pako";

const ENCODED_EMPTY_CHAR = "\0";

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
export default class RasterCel {
    constructor(chars, colors) {
        this.layerType = 'raster';
        this.chars = chars || [];
        this.colors = colors || [];
    }

    static blank() {
        const cel = new this();
        cel.normalize()
        return cel;
    }

    static deserialize(celData, options = {}) {
        let cel;

        if (options && options.decompress) {
            cel = new this(
                decodeChars(celData.chars, options.rowLength),
                decodeColors(celData.colors, options.rowLength, options.colorDepth)
            )
        } else {
            cel = new this(celData.chars, celData.colors);
        }

        if (!options.replace) {
            cel.normalize()
        }

        return cel;
    }


    /**
     * Storing the chars/colors 2d arrays as they are is quite inefficient in JSON (the array is converted to a string,
     * where every comma and/or quotation mark uses 1 byte). Instead, we use pako to store these 2d arrays as compressed
     * Base64 strings.
     */
    serialize(options = {}) {
        return {
            layerType: this.layerType,
            chars: options.compress ? encodeChars(this.chars) : this.chars,
            colors: options.compress ? encodeColors(this.colors, options.colorDepth) : this.colors
        }
    }

    // Ensures sure every row/col has a value, and boundaries are followed
    normalize() {
        const chars = [];
        const colors = [];

        let row, col, char, color, rowLength = numRows(), colLength = numCols();
        for (row = 0; row < rowLength; row++) {
            chars[row] = [];
            colors[row] = [];

            for (col = 0; col < colLength; col++) {
                char = undefined;
                color = undefined;

                if (this.chars[row] && this.chars[row][col] !== undefined) {
                    char = this.chars[row][col];
                }
                if (this.colors[row] && this.colors[row][col] !== undefined) {
                    color = this.colors[row][col];
                }
                if (char === undefined) { char = EMPTY_CHAR; }
                if (color === undefined) { color = 0; }

                chars[row][col] = char;
                colors[row][col] = color;
            }
        }

        this.chars = chars;
        this.colors = colors;
    }

    glyphs() {
        return {
            chars: this.chars,
            colors: this.colors
        }
    }

    hasContent(matchingColorIndex) {
        let result = false;
        this._iterateCells((r, c, char, colorIndex) => {
            if (
                (char !== EMPTY_CHAR && char !== WHITESPACE_CHAR) &&
                (matchingColorIndex === undefined || matchingColorIndex === colorIndex)
            ) result = true
        })
        return result;
    }

    /**
     * Shifts all the contents (chars/colors) of the cel
     * @param {number} rowOffset - How many rows to shift (can be negative)
     * @param {number} colOffset - How many columns to shift content (can be negative)
     * @param {boolean} [wrap=false] - If true, shifting content past the cel boundaries will wrap it around to the other side
     */
    translate(rowOffset, colOffset, wrap = false) {
        let chars = create2dArray(numRows(), numCols(), EMPTY_CHAR);
        let colors = create2dArray(numRows(), numCols(), 0);

        let celR, celC, r, c;
        for (celR = 0; celR < this.chars.length; celR++) {
            for (celC = 0; celC < this.chars[celR].length; celC++) {
                ({ r, c } = getOffsetPosition(celR, celC, rowOffset, colOffset, wrap));

                if (charInBounds(r, c)) {
                    chars[r][c] = this.chars[celR][celC];
                    colors[r][c] = this.colors[celR][celC];
                }
            }
        }

        this.chars = chars;
        this.colors = colors;
    }

    resize(newDimensions, rowOffset, colOffset) {
        let resizedChars = [];
        let resizedColors = [];

        for (let r = 0; r < newDimensions[0]; r++) {
            for (let c = 0; c < newDimensions[1]; c++) {
                if (resizedChars[r] === undefined) { resizedChars[r] = []; }
                if (resizedColors[r] === undefined) { resizedColors[r] = []; }

                let oldRow = r + rowOffset;
                let oldCol = c + colOffset;

                resizedChars[r][c] = this.chars[oldRow] && this.chars[oldRow][oldCol] ? this.chars[oldRow][oldCol] : EMPTY_CHAR;
                resizedColors[r][c] = this.colors[oldRow] && this.colors[oldRow][oldCol] ? this.colors[oldRow][oldCol] : 0;
            }
        }

        this.chars = resizedChars;
        this.colors = resizedColors;
    }

    convertToMonochrome() {
        this.colors = create2dArray(numRows(), numCols(), 0);
    }
    updateColorIndexes(callback) {
        this._iterateCells((r, c, char, colorIndex) => {
            callback(colorIndex, newColorIndex => this.colors[r][c] = newColorIndex);
        })
    }
    colorSwap(oldColorIndex, newColorIndex) {
        this._iterateCells((r, c, char, colorIndex) => {
            if (colorIndex === oldColorIndex) this.setGlyph(r, c, undefined, newColorIndex);
        })
    }

    // Shapes are immediately rasterized and merged into chars/colors state
    addShape(shape) {
        const { glyphs: shapeGlyphs, origin: shapeOrigin } = shape.rasterize();
        mergeGlyphs({ chars: this.chars, colors: this.colors }, shapeGlyphs, shapeOrigin);
    }

    // ------------------ Raster-specific functions:

    setGlyph(row, col, char, color) {
        if (charInBounds(row, col)) {
            if (char !== undefined) {
                addToCache(char);
                this.chars[row][col] = char;
            }
            if (color !== undefined) {
                this.colors[row][col] = color;
            }
        }
    }

    _iterateCells(callback) {
        const rowLength = numRows(), colLength = numCols();
        for (let row = 0; row < rowLength; row++) {
            for (let col = 0; col < colLength; col++) {
                callback(row, col, this.chars[row][col], this.colors[row][col]);
            }
        }
    }

}


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
 * @param {'8bit'|'16bit'} colorDepth - How many bits are used to encode each color. Normally 8bit is enough, but if there are
 *   more than 255 colors 16bit is required
 * @returns {string} - Base 64 string representing the compressed 2d array
 */
function encodeColors(colors, colorDepth) {
    let uncompressed;
    const flatColors = colors.flat();

    // Convert to Uint8Array typed array for compression
    switch(colorDepth) {
        case COLOR_DEPTH_8_BIT:
            uncompressed = new Uint8Array(flatColors)
            break;
        case COLOR_DEPTH_16_BIT:
            // pako only supports Uint8Array, so if there are 16-bit numbers we need to split each 16-bit number into 2 bytes
            uncompressed = new Uint8Array(flatColors.length * 2);
            for (let i = 0; i < flatColors.length; i++) {
                uncompressed[i * 2] = (flatColors[i] >> 8) & 0xFF; // Most significant byte
                uncompressed[i * 2 + 1] = flatColors[i] & 0xFF;    // Least significant byte
            }
            break;
        default:
            throw new Error(`Unsupported color depth: ${colorDepth}`);
    }

    const compressed = pako.deflate(uncompressed); // convert to compressed Uint8Array
    return btoa(String.fromCharCode(...compressed)); // Convert to Base64 string for json
}

/**
 * Decodes a compressed Base64 string into a 2d colors array
 * @param {string} base64String - Base 64 string representing the compressed 2d array (from encodeColors function)
 * @param {number} rowLength - How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @param {'8bit'|'16bit'} colorDepth - How many bits were used to encode each color
 * @returns {number[][]} - 2d array of color integers
 */
function decodeColors(base64String, rowLength, colorDepth) {
    const compressed = Uint8Array.from(atob(base64String), c => c.charCodeAt(0)); // Base64 string -> compressed Uint8Array
    const uncompressed = pako.inflate(compressed); // convert to uncompressed Uint8Array

    let flatColors;

    switch(colorDepth) {
        case COLOR_DEPTH_8_BIT:
            // Convert to array of 8-bit numbers
            flatColors = Array.from(uncompressed);
            break;
        case COLOR_DEPTH_16_BIT:
            // Convert pairs of two consecutive bytes back into one 16-bit number
            flatColors = [];
            for (let i = 0; i < uncompressed.length; i += 2) {
                flatColors.push((uncompressed[i] << 8) | uncompressed[i + 1]);
            }
            break;
        default:
            throw new Error(`Unsupported color depth: ${colorDepth}`);
    }

    return split1DArrayInto2D(flatColors, rowLength)
}

