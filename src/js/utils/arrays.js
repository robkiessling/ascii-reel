import {isFunction} from "./utilities.js";

/**
 * Creates an array of arrays
 * @param {number} numRows - Number of rows in the 2d array
 * @param {number} numCols - Number of columns in the 2d array
 * @param {*|function:*} [defaultValue=undefined] - Can be a primitive value (like an integer or string) or a function that
 *   returns the desired value. Do not pass an object as a default value; otherwise all the elements will be a reference
 *   to the same object. You should pass a function that returns a new object.
 * @returns {*[][]} - The 2d array
 */
export function create2dArray(numRows, numCols, defaultValue) {
    let array = [];

    for (let row = 0; row < numRows; row++) {
        let rowValues = [];
        for (let col = 0; col < numCols; col++) {
            rowValues.push(isFunction(defaultValue) ? defaultValue(row, col) : defaultValue);
        }
        array.push(rowValues);
    }

    return array;
}

export function freeze2dArray(arr) {
    for (const row of arr) {
        Object.freeze(row);
    }
    return Object.freeze(arr);
}

/**
 * Given an array such as [1, 2, 3, 4, 5, 6, 7, 8, 9] and a rowLength such as 3, will return a result:
 *
 *      [ [1, 2, 3], [4, 5, 6], [7, 8, 9] ]
 *
 * Throws an error if the array cannot be evenly split
 *
 * @param {*[]} arr - The 1d array to split
 * @param {number} rowLength - How long each row should be in the final 2d array
 * @returns {*[][]} - A 2d array
 */
export function split1DArrayInto2D(arr, rowLength) {
    if (arr.length % rowLength !== 0) throw new Error(`1d array of length ${arr.length} cannot be split into rows of length ${rowLength}`);

    const result = [];

    for (let i = 0; i < arr.length; i += rowLength) {
        result.push(arr.slice(i, i + rowLength));
    }

    return result;
}

/**
 * Translates 2d arrays of chars/colors as if they were positioned at a Cell.
 * Note: The callback rows/cols can be out of bounds
 *
 * @param {{chars: string[][], colors: number[][]}} glyphs - Content to translate
 * @param {Cell} cell - Position to move the top-left cell of the layout to
 * @param {(row: number, col: number, char: string, color: number) => void} callback - Callback function where row and col
 *   are the coordinates of the cell after translating
 */
export function translateGlyphs(glyphs, cell, callback) {
    // Note: rows may have different number of columns (e.g. when pasting from a text editor) so not caching row/col length
    let r, c;

    for (r = 0; r < glyphs.chars.length; r++) {
        for (c = 0; c < glyphs.chars[r].length; c++) {
            callback(r + cell.row, c + cell.col, glyphs.chars[r][c], glyphs.colors[r][c]);
        }
    }
}

/**
 * A Range represents a subarray between two indices: startIndex and endIndex
 * Indices are inclusive.
 */
export default class ArrayRange {
    constructor(startIndex, endIndex) {
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        if (this.endIndex < this.startIndex) {
            console.error(`Invalid ArrayRange initialization: ${startIndex}, ${endIndex}`);
            this.endIndex = this.startIndex;
        }
    }

    // Convert to/from its object representation (so we can store it in json state)
    static deserialize(data) {
        return new ArrayRange(data.startIndex, data.endIndex);
    }
    serialize() {
        return { startIndex: this.startIndex, endIndex: this.endIndex };
    }

    static fromSingleIndex(index) {
        return new ArrayRange(index, index);
    }

    includes(index) {
        return index >= this.startIndex && index <= this.endIndex;
    }

    get length() {
        return this.endIndex - this.startIndex + 1;
    }

    toDisplay() {
        return `${this.startIndex + 1}-${this.endIndex + 1}`
    }

    // Returns how far a given index is from the start of the range
    offset(index) {
        return index - this.startIndex;
    }

    iterate(callback) {
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            callback(i);
        }
    }

    // Extends the range so that it includes the given index
    extendTo(index) {
        this.startIndex = Math.min(this.startIndex, index);
        this.endIndex = Math.max(this.endIndex, index);
        return this;
    }

    // Translates the range a fixed distance
    translate(distance) {
        this.startIndex += distance;
        this.endIndex += distance;
        return this;
    }

    // Translates the range so that its startIndex equals the given index
    translateTo(index) {
        return this.translate(this.offset(index));
    }

    clone() {
        return new ArrayRange(this.startIndex, this.endIndex);
    }
}