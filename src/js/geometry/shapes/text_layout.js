import Cell from "../cell.js";
import {ALIGN_H_CENTER, ALIGN_H_LEFT, ALIGN_H_RIGHT, ALIGN_V_BOTTOM, ALIGN_V_MIDDLE, ALIGN_V_TOP} from "./constants.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {create2dArray} from "../../utils/arrays.js";

const DEFAULT_OPTIONS = {
    alignH: ALIGN_H_LEFT,
    alignV: ALIGN_V_TOP,
    paddingH: 0,
    paddingV: 0,
}

/**
 * Handles wrapping and aligning text to fit into a rectangular cellArea.
 */
export default class TextLayout {
    constructor(text, cellArea, options = {}) {
        // todo convert tabs to 2 spaces
        // todo convert /r/n to /n

        this.text = text;
        this.cellArea = cellArea;
        this.options = {...DEFAULT_OPTIONS, ...options};

        this.lines = [];
        this.grid = [];

        this._wrapText();
        this._alignText();

        // this.printLines()
        // this.printGrid()
    }

    get numCols() { return this.cellArea.numCols; }
    get numRows() { return this.cellArea.numRows; }
    get paddingH() { return this.options.paddingH; }
    get paddingV() { return this.options.paddingV; }
    get alignH() { return this.options.alignH; }
    get alignV() { return this.options.alignV; }
    get usableRows() { return this.numRows - 2 * this.paddingV; }
    get usableCols() { return this.numCols - 2 * this.paddingH; }
    get maxCursorIndex() { return this.lines.at(-1).cursorEnd; }

    /**
     * Returns the corresponding Cell for a given cursorIndex.
     * Note: multiple indexes can map to the same cell.
     *
     * @param {Number} cursorIndex - cursor position in original text string
     * @param {Boolean} [useAbsolutePositioning=true] - If true, cell position is relative to (0,0) of canvas.
     *   If false, cell position is relative to topLeft of cellArea.
     * @returns {Cell}
     */
    getCellForCursorIndex(cursorIndex, useAbsolutePositioning = true) {
        const translateCell = (row, col) => {
            // return { row: row, col: col }
            const cell = new Cell(row, col);
            return useAbsolutePositioning ?
                cell.translate(this.cellArea.topLeft.row, this.cellArea.topLeft.col) :
                cell;
        }

        for (const { cursorStart, cursorEnd, displayLength, row, colOffset } of this.lines) {
            if (cursorIndex >= cursorStart && cursorIndex < cursorEnd) {
                const maxCol = colOffset + displayLength;
                const desiredCol = colOffset + (cursorIndex - cursorStart);
                return translateCell(row, Math.min(desiredCol, maxCol))
            }
        }

        // If out of bounds, return final cell
        const lastLine = this.lines.at(-1);
        const maxCol = lastLine.colOffset + lastLine.displayLength;
        return translateCell(lastLine.row, maxCol);
    }

    /**
     * Returns the corresponding cursorIndex for a given Cell.
     * Note: A cell can be mapped to multiple indexes, this returns the first
     * Note: If cell is out of bounds, will return the nearest cursor index
     *
     * @param {Cell} cell
     * @param {Boolean} [useAbsolutePositioning=true] - If true, cell position is assumed to be relative
     *   to (0,0) of canvas. If false, cell position is assumed to be relative to topLeft of cellArea.
     * @returns {Number}
     */
    getCursorIndexForCell(cell, useAbsolutePositioning = true) {
        if (useAbsolutePositioning) cell = cell.relativeTo(this.cellArea.topLeft);

        for (const { cursorStart, cursorEnd, displayLength, row, colOffset } of this.lines) {
            if (row !== cell.row) continue;

            const colInset = cell.col - colOffset; // column relative to start of line
            if (colInset < 0) return cursorStart;
            if (colInset >= displayLength) return cursorEnd - 1;
            return cursorStart + colInset;
        }

        // Not in any rows -> return final cursor index
        return this.maxCursorIndex;
    }


    isCellInVerticalBounds(cell, useAbsolutePositioning = true) {
        if (useAbsolutePositioning) cell = cell.relativeTo(this.cellArea.topLeft);

        for (const { row } of this.lines) {
            if (row === cell.row) return true;
        }

        return false;
    }

    doesCellOverlap(cell, useAbsolutePositioning = true) {
        if (useAbsolutePositioning) cell = cell.relativeTo(this.cellArea.topLeft);

        if (!this.grid[cell.row]) return false;
        if (!this.grid[cell.row][cell.col]) return false;
        return this.grid[cell.row][cell.col] !== EMPTY_CHAR;
    }

    /**
     * Wraps text into logical "lines" based on the available column width (`usableCols`).
     *
     * For example, given the input "Hello   world" (with 3 spaces) and `usableCols` = 6,
     * the resulting lines will be:
     *   { rawText: "Hello   ", cursorStart: 0, cursorEnd: 8 },
     *   { rawText: "world",    cursorStart: 8, cursorEnd: 13 }
     *
     * Note that the first line's `rawText` has a length of 8, which exceeds `usableCols`.
     * This is intentional: trailing whitespace is preserved in the line it follows, even
     * though it won't be visually rendered. This ensures accurate cursor indexing and movement.
     *
     * Any cursor index within [cursorStart, cursorEnd) maps to that line. In the example above,
     * indices 0 through 7 (inclusive) map to the first line, even though only the first 6
     * characters will be displayed in the UI.
     *
     * In practice, when the user presses the right arrow key, the cursor will remain at the end
     * of the visible line while moving through the hidden whitespace. For instance, to move from
     * "Hello   " to "world", the user will need to press the right arrow 2 extra times before 
     * advancing to the next line. The cursor will appear to "stick" at the line's end until all 
     * hidden characters are traversed.
     */
    _wrapText() {
        this.lines = [];
        const usableCols = this.usableCols;

        let textIndex = 0;
        let lineStartIndex, spacesEndIndex;

        const pushLine = (startIndex, endIndex) => {
            this.lines.push({
                rawText: this.text.substring(startIndex, endIndex),
                cursorStart: startIndex,
                cursorEnd: endIndex,

                // the following will be set in _alignText
                // row: undefined,
                // colOffset: undefined,
                // displayText: undefined,
            })

            lineStartIndex = undefined;
            spacesEndIndex = undefined;
        }

        /**
         * General algorithm: (goal is to group text into "lines" that fit into usableCols)
         * - Iterate through text char by char (using textIndex)
         *   - If you reach a newline char, immediately terminate line
         *   - If you are on a whitespace char, keep iterating to next char (do not terminate on whitespace).
         *     This means a line might be longer than usableCols if it ends in a lot of whitespace; that is okay
         *     (see comment at beginning of function).
         *   - Once you reach usableCols length and are not on a whitespace, terminate line:
         *     - If there were any whitespaces in the line, terminate at the last whitespace
         *     - If there were no whitespaces in the line, must cut the word
         */
        while (textIndex < this.text.length) {
            if (lineStartIndex === undefined) lineStartIndex = textIndex;

            const char = this.text[textIndex];
            const lineLength = textIndex - lineStartIndex + 1;

            // console.log(textIndex, lineStartIndex, char === '\n' ? '\\n' : char, lineLength, spacesEndIndex);

            if (char === '\n') {
                pushLine(lineStartIndex, textIndex + 1); // +1 to include this \n char in the current line
            } else if (char === WHITESPACE_CHAR) {
                spacesEndIndex = textIndex; // Include sequential whitespace, even if it goes longer than usableCols
            } else if (lineLength > usableCols) {
                // Once we reach a non-whitespace out-of-bounds char we terminate the line
                if (spacesEndIndex === undefined) {
                    // There were no spaces in the line so far, so have to terminate the line mid-word
                    pushLine(lineStartIndex, textIndex);
                    continue; // Not incrementing textIndex so we evaluate current char again
                } else {
                    // There were spaces in the line, so we terminate the line at the end of the last space
                    const indexAfterLastSpace = spacesEndIndex + 1; // Store this because pushLine will wipe spacesEndIndex
                    pushLine(lineStartIndex, indexAfterLastSpace)
                    textIndex = indexAfterLastSpace; // Restart evaluation after the last space
                    continue;
                }
            }

            textIndex++;
        }

        pushLine(lineStartIndex, textIndex);
    }


    /**
     * Aligns text according to horizontal and vertical alignment settings. Also applies padding.
     * Will populate a 2d array of chars which it stores in `this.grid`
     */
    _alignText() {
        this.grid = create2dArray(this.numRows, this.numCols, EMPTY_CHAR);

        const usableRows = this.usableRows;
        const usableCols = this.usableCols;

        // Truncate lines that exceed grid height
        this.lines = this.lines.slice(0, usableRows);

        // Calculate vertical offset based on alignment
        let offsetTop = this.paddingV;
        if (this.alignV === ALIGN_V_MIDDLE) offsetTop += Math.floor((usableRows - this.lines.length) / 2);
        else if (this.alignV === ALIGN_V_BOTTOM) offsetTop += (usableRows - this.lines.length);

        this.lines.forEach((line, lineIndex) => {
            line.displayText = this._calcDisplayText(line, lineIndex, usableCols);
            line.displayLength = line.displayText.length;

            // Calculate horizontal offset based on alignment and display length
            let offsetLeft = this.paddingH;
            if (this.alignH === ALIGN_H_CENTER) offsetLeft += Math.floor((usableCols - line.displayLength) / 2);
            else if (this.alignH === ALIGN_H_RIGHT) offsetLeft += (usableCols - line.displayLength);

            // Update line metadata with final position
            line.row = offsetTop + lineIndex;
            line.colOffset = offsetLeft;

            // Place characters in the grid
            for (let charIndex = 0; charIndex < line.displayLength; charIndex++) {
                const col = offsetLeft + charIndex;

                // Only place character if it fits within grid bounds
                if (col < this.numCols && line.row < this.numRows) this.grid[line.row][col] = line.displayText[charIndex];
            }
        });
    }

    _calcDisplayText(line, lineIndex, usableCols) {
        let displayText = line.rawText;

        // Always trim newlines off of displayText. If there is a newline char, it will always be the last char of string
        if (displayText.endsWith('\n')) displayText = displayText.slice(0, -1);

        // Normally we trim all spaces around the text, except in a few situations:
        // - if this is the first line of a paragraph, do not trim starting whitespace
        // - if this is the last line of a paragraph, do not trim ending whitespace
        const prevLine = this.lines[lineIndex - 1];
        const isFirstLineOfParagraph = lineIndex === 0 || (prevLine && prevLine.rawText.endsWith('\n'));
        const isLastLineOfParagraph = (lineIndex === this.lines.length - 1) || line.rawText.endsWith('\n');
        if (!isFirstLineOfParagraph) displayText = displayText.trimStart();
        if (!isLastLineOfParagraph) displayText = displayText.trimEnd();

        // Handle rare case where display text is still longer than usable cols. Can happen if this is the first
        // or last line of paragraph so some whitespace hasn't been trimmed
        if (displayText.length > usableCols) displayText = displayText.slice(0, usableCols);

        return displayText;
    }


    printLines() {
        console.log('---------------')
        console.log("Lines:")
        this.lines.forEach(line => {
            console.log(JSON.stringify(line));
        })
        console.log('---------------')
    }
    printGrid() {
        console.log('---------------')
        const borderLine = '#'.repeat(this.numCols + 2);
        console.log(`Grid: ${this.numCols}x${this.numRows}`);
        console.log(borderLine);
        this.grid.forEach(row => {
            console.log(`#${row.map(char => char === EMPTY_CHAR ? '•' : char).join('')}#`)
        });
        console.log(borderLine);
        console.log('---------------')
    }

}