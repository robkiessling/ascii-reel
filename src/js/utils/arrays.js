import {isFunction} from "./utilities.js";
import {EMPTY_CHAR} from "../config/chars.js";

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
    let result = [];

    for (let row = 0; row < numRows; row++) {
        let rowValues = [];
        for (let col = 0; col < numCols; col++) {
            rowValues.push(isFunction(defaultValue) ? defaultValue(row, col) : defaultValue);
        }
        result.push(rowValues);
    }

    return result;
}

export function create2dAnchoredArray(numRows, numCols, defaultValue) {
    let result = new AnchoredArray();

    for (let row = 0; row < numRows; row++) {
        let rowValues = new AnchoredArray();
        for (let col = 0; col < numCols; col++) {
            rowValues.push(isFunction(defaultValue) ? defaultValue(row, col) : defaultValue);
        }
        result.push(rowValues);
    }

    return result;
}

export function freeze2dArray(arr) {
    for (const row of arr) {
        Object.freeze(row);
    }
    return Object.freeze(arr);
}

export function isIn2dArrayBounds(array, row, col) {
    return row >= 0 && row < array.length && col >= 0 && array[0] && col < array[0].length;
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
 * Merges two glyphs objects. Incoming newGlyphs will be merged as if it was located at the given origin.
 * @param {{chars: string[][], colors: number[][]}} baseGlyphs - The content to merge newGlyphs into
 * @param {{chars: string[][], colors: number[][]}} newGlyphs - The content to merge into baseGlyphs
 * @param {Cell} origin - Position to merge newGlyphs in at
 * @param {boolean} [writeEmptyChars=false] - All empty/undefined chars will be skipped unless this is true
 */
export function mergeGlyphs(baseGlyphs, newGlyphs, origin, writeEmptyChars = false) {
    translateGlyphs(newGlyphs, origin, (r, c, char, color) => {
        if (!isIn2dArrayBounds(baseGlyphs.chars, r, c)) return;
        if (!writeEmptyChars && (char === undefined || char === EMPTY_CHAR)) return;

        if (char !== undefined) baseGlyphs.chars[r][c] = char;
        if (color !== undefined) baseGlyphs.colors[r][c] = color;
    });
}


/**
 * Checks if two arrays are shallowly equal (same elements in the same order).
 *
 * @param {Array} a - The first array to compare.
 * @param {Array} b - The second array to compare.
 * @returns {boolean} - True if both arrays contain the same elements in the same order.
 */
export function areArraysEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;

    return a.every((val, index) => val === b[index]);
}

// Iterates through each adjacent pair of elements in the array and calls the callback.
// E.g. for an array with 3 items: A B and C, the callback is called two times: once for (A, B) and once for (B, C).
export function forEachAdjPair(array, callback) {
    for (let i = 0; i < array.length - 1; i++) {
        callback(array[i], array[i + 1], i);
    }
}


/**
 * Moves specified elements one step forward or backward without disrupting their relative order or swapping over
 * each other. Items at the edge or blocked by other selected items will not move.
 *
 * @param {Array} array - The full array
 * @param {Array} elementsToMove - The elements to move. Elements do not have to be in same order as array.
 * @param {number} direction - Either +1 (move towards end of array) or -1 (move towards start of array).
 * @returns {Array} A new array with the specified elements moved one step if possible.
 */
export function moveOneStep(array, elementsToMove, direction) {
    const elementsToMoveLookup = new Set(elementsToMove);
    const result = [...array];

    // Process in correct order: reverse for forward, normal for backward
    const indexes = [];
    for (let i = 0; i < result.length; i++) {
        if (elementsToMoveLookup.has(result[i])) indexes.push(i);
    }

    if (direction > 0) indexes.reverse();

    for (const i of indexes) {
        const j = i + direction;
        if (
            j < 0 || j >= result.length ||      // out of bounds
            elementsToMoveLookup.has(result[j]) // would swap with another selected item
        ) continue;

        // Swap elements
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}


/**
 * A Range represents a subarray between two indices: startIndex and endIndex
 * Indices are inclusive.
 */
export class ArrayRange {
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

/**
 * AnchoredArray is an array-like structure that supports both positive and negative indices,
 * where index `0` is a fixed anchor point. Negative indices allow insertion before index 0
 * without shifting or affecting positive indices.
 *
 * Unlike native JavaScript arrays:
 * - Setting a value at index `-1` does not access the last element.
 * - Instead, it inserts a value before index `0`, preserving the meaning of `0`, `1`, etc.
 */
export class AnchoredArray {
    constructor() {
        this._before = []; // values at negative indices
        this._after = [];  // values at 0 and above
    }

    set(index, value) {
        if (index >= 0) {
            this._after[index] = value;
        } else {
            this._before[-index - 1] = value;
        }
    }

    get(index) {
        if (index >= 0) {
            return this._after[index];
        } else {
            return this._before[-index - 1];
        }
    }

    push(value) {
        this._after.push(value);
    }

    pop() {
        return this._after.pop();
    }

    unshift(value) {
        this._before.push(value);
    }

    toArray() {
        return [...this._before.slice().reverse(), ...this._after];
    }

    forEach(callback) {
        // Negative indices: from -N to -1
        for (let i = this._before.length - 1; i >= 0; i--) {
            const index = -i - 1;
            callback(this._before[i], index);
        }

        // Non-negative indices: from 0 upward
        for (let i = 0; i < this._after.length; i++) {
            callback(this._after[i], i);
        }
    }

    length() {
        return this._before.length + this._after.length;
    }
}


/**
 * AnchoredGrid is a 2D grid that supports both negative and positive row/column indices.
 * This is useful when elements need to extend beyond the original bounds of a shape or area.
 *
 * For example, you could start with a 5x5 grid, then call `set(-1, -1, value)` to assign a cell
 * above and to the left of (0, 0). This does not shift the existing grid; instead, it expands the
 * tracked bounds so that `to2dArray()` will include the new top-left and return a larger array.
 */
export class AnchoredGrid {
    constructor() {
        this._rowsBefore = [];
        this._rowsAfter = [];
    }

    // Creates a 2d AnchoredGrid, analogous to create2dArray
    static filledGrid(numRows, numCols, defaultValue) {
        const grid = new AnchoredGrid();

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                grid.set(row, col, defaultValue);
            }
        }

        return grid;
    }

    /**
     * Set a value at (row, col)
     * @param {number} row - Row index (can be negative)
     * @param {number} col - Column index (can be negative)
     * @param {*} value - Value to store
     */
    set(row, col, value) {
        const targetRow = this._getOrCreateRow(row);
        targetRow.set(col, value);
    }

    /**
     * Get a value at (row, col)
     * @param {number} row - Row index (can be negative)
     * @param {number} col - Column index (can be negative)
     * @returns {*} Value at the given cell, or undefined
     */
    get(row, col) {
        const targetRow = this._getRow(row);
        return targetRow?.get(col);
    }

    /**
     * Iterate over all defined cells in row-major order, starting from the most negative row, most negative column.
     *
     * @param {(value: any, row: number, col: number) => void} callback
     */
    forEachCell(callback) {
        this.forEach((row, rowIndex) => {
            if (row) {
                row.forEach((value, colIndex) => {
                    callback(value, rowIndex, colIndex);
                });
            }
        })
    }

    forEach(callback) {
        // Rows before 0: most negative up to -1
        for (let r = this._rowsBefore.length - 1; r >= 0; r--) {
            callback(this._rowsBefore[r], -r - 1)
        }

        // Rows 0 and above
        for (let r = 0; r < this._rowsAfter.length; r++) {
            callback(this._rowsAfter[r], r)
        }
    }

    get length() {
        return this._rowsBefore.length + this._rowsAfter.length;
    }

    /**
     * Converts the grid into a dense 2D array of values. Rows and columns are padded with `undefined` as needed. \
     * Result includes offsets for origin; this can be used to place the resulting 2D array so that the negative
     * values are upward/leftward.
     *
     * @returns {{
     *   data: any[][],
     *   rowOffset: number,
     *   colOffset: number
     * }}
     */
    to2dArray() {
        // First, find bounds
        let minRow = Infinity;
        let maxRow = -Infinity;
        let minCol = Infinity;
        let maxCol = -Infinity;

        this.forEachCell((_, row, col) => {
            minRow = Math.min(minRow, row);
            maxRow = Math.max(maxRow, row);
            minCol = Math.min(minCol, col);
            maxCol = Math.max(maxCol, col);
        });

        // Empty grid?
        if (minRow > maxRow || minCol > maxCol) {
            return { data: [[]], rowOffset: 0, colOffset: 0 };
        }

        const numRows = maxRow - minRow + 1;
        const numCols = maxCol - minCol + 1;

        // Build and populate 2D array
        // const data = Array.from({ length: numRows }, () => Array(numCols).fill(undefined));
        const data = create2dArray(numRows, numCols);

        this.forEachCell((value, row, col) => {
            const r = row - minRow;
            const c = col - minCol;
            data[r][c] = value;
        });

        return {
            data,
            rowOffset: minRow,
            colOffset: minCol
        };
    }

    /**
     * Get or create the AnchoredArray row at the given index.
     * @private
     * @param {number} row
     * @returns {AnchoredArray}
     */
    _getOrCreateRow(row) {
        const rows = row >= 0 ? this._rowsAfter : this._rowsBefore;
        const index = row >= 0 ? row : -row - 1;

        if (!rows[index]) {
            rows[index] = new AnchoredArray();
        }

        return rows[index];
    }

    /**
     * Get the AnchoredArray row at the given index, if it exists.
     * @private
     * @param {number} row
     * @returns {AnchoredArray | undefined}
     */
    _getRow(row) {
        const rows = row >= 0 ? this._rowsAfter : this._rowsBefore;
        const index = row >= 0 ? row : -row - 1;
        return rows[index];
    }
}