import Cell from "../cell.js";
import {TEXT_ALIGN_H_OPTS, TEXT_ALIGN_V_OPTS} from "./constants.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {create2dArray} from "../../utils/arrays.js";
import CellArea from "../cell_area.js";
import Vertex from "../vertex.js";
import VertexArea from "../vertex_area.js";

const DEFAULT_OPTIONS = {
    alignH: TEXT_ALIGN_H_OPTS.LEFT,
    alignV: TEXT_ALIGN_V_OPTS.TOP,
    paddingH: 0,
    paddingV: 0,
}

const DEBUG = false;

/**
 * Handles wrapping and aligning text to fit into a rectangular cellArea.
 */
export default class TextLayout {
    constructor(text = '', cellArea, options = {}) {
        // todo convert tabs to 2 spaces
        // todo convert /r/n to /n

        this.text = text;
        this.cellArea = cellArea;
        this.options = {...DEFAULT_OPTIONS, ...options};

        this.usableArea = new CellArea(
            this.cellArea.topLeft.clone().translate(this.paddingV, this.paddingH),
            this.cellArea.bottomRight.clone().translate(-this.paddingV, -this.paddingH),
        )

        this.lines = [];
        this.grid = create2dArray(this.numRows, this.numCols, EMPTY_CHAR);

        if (this.usableRows >= 1 && this.usableCols >= 1) {
            this._wrapText();
            this._alignText();
        }

        if (DEBUG) {
            this.printLines()
            this.printGrid()
        }
    }

    get numCols() { return this.cellArea.numCols; }
    get numRows() { return this.cellArea.numRows; }
    get paddingH() { return this.options.paddingH; }
    get paddingV() { return this.options.paddingV; }
    get alignH() { return this.options.alignH; }
    get alignV() { return this.options.alignV; }
    get usableRows() { return this.numRows - 2 * this.paddingV; }
    get usableCols() { return this.numCols - 2 * this.paddingH; }

    get minCaretIndex() { return 0; }
    get maxCaretIndex() { return this.lines.at(-1).caretEnd - 1; } // Subtract 1 since caretEnd is exclusive

    /**
     * Returns the corresponding Cell for a given caretIndex.
     * Note: multiple indexes can map to the same cell.
     *
     * @param {number} caretIndex - caret position in original text string
     * @returns {Cell|null} - Returns the Cell, or null if there is no valid space
     */
    getCellForCaretIndex(caretIndex) {
        if (!this.lines.length) return null;

        const translateCell = (row, col) => {
            const cell = new Cell(row, col);

            // Convert to absolute since this.lines is relative
            return cell.translate(this.cellArea.topLeft.row, this.cellArea.topLeft.col);
        }

        if (caretIndex < this.minCaretIndex) {
            // Out of bounds in the negative direction -> return first cell
            const firstLine = this.lines.at(0);
            const minCol = firstLine.colOffset;
            return translateCell(firstLine.row, minCol);
        }

        for (const { caretStart, caretEnd, displayLength, row, colOffset } of this.lines) {
            if (caretIndex >= caretStart && caretIndex < caretEnd) {
                const maxCol = colOffset + displayLength;
                const desiredCol = colOffset + (caretIndex - caretStart);
                return translateCell(row, Math.min(desiredCol, maxCol))
            }
        }

        // Out of bounds in the positive direction -> return final cell
        const lastLine = this.lines.at(-1);
        const maxCol = lastLine.colOffset + lastLine.displayLength;
        return translateCell(lastLine.row, maxCol);
    }

    /**
     * Returns the corresponding caretIndex for a given Cell. If cell is out of bounds, will return the nearest
     * caret index.
     * Note: A cell can be mapped to multiple indexes, this will return the first
     *
     * @param {Cell} cell
     * @returns {Number}
     */
    getCaretIndexForCell(cell) {
        cell = cell.relativeTo(this.cellArea.topLeft); // Convert to relative since this.lines is relative

        // Out of bounds in the negative direction -> return first caret index
        if (!this.lines.length || cell.row < this.lines.at(0).row) return this.minCaretIndex;

        for (const { caretStart, caretEnd, displayLength, row, colOffset } of this.lines) {
            if (row !== cell.row) continue;
            const colInset = cell.col - colOffset; // column relative to start of line
            if (colInset < 0) return caretStart;
            if (colInset >= displayLength) return caretEnd - 1;
            return caretStart + colInset;
        }

        // Out of bounds in the positive direction -> return final caret index
        return this.maxCaretIndex;
    }


    isCellInVerticalBounds(cell) {
        cell = cell.relativeTo(this.cellArea.topLeft); // Convert to relative since this.lines is relative

        for (const { row } of this.lines) {
            if (row === cell.row) return true;
        }

        return false;
    }

    /**
     * Determines whether the given cell overlaps a character in this text.
     *
     * @param {Cell} cell - The cell to check.
     * @param {boolean} [requireChar=true]
     *   If true, the cell must map to a non-empty character to count as overlapping.
     *   If false, any character position within the text area counts as overlapping.
     * @returns {boolean} True if the cell overlaps the text, otherwise false.
     */
    includesCell(cell, requireChar = true) {
        if (requireChar) {
            cell = cell.relativeTo(this.cellArea.topLeft); // Convert to relative since this.grid is relative
            if (this.grid[cell.row] === undefined) return false;
            if (this.grid[cell.row][cell.col] === undefined) return false;
            return this.grid[cell.row][cell.col] !== EMPTY_CHAR;
        } else {
            return this.usableArea.includesCell(cell);
        }
    }

    /**
     * Returns a CellArea for each horizontal line of selected text. If a selected line contains no characters (''),
     * its CellArea will still span 1 column since CellAreas cannot have zero width.
     * @param {number} selectionStart - Caret index where the selection begins
     * @param {number} selectionEnd - Caret index where the selection ends
     * @returns {CellArea[]}
     */
    lineCellAreas(selectionStart, selectionEnd) {
        return this.lines.map(line => {
            // Skip lines completely outside the selection range
            if (selectionStart >= line.caretEnd) return null;
            if (selectionEnd <= line.caretStart) return null;

            // Compute overlap between selection and this line (in caret coordinates)
            const overlapStart = Math.max(line.caretStart, selectionStart);
            const overlapEnd = Math.min(line.caretEnd, selectionEnd);

            // Convert overlap to column coordinates, clamped to visible width
            const startCol = line.colOffset + (overlapStart - line.caretStart);
            const endCol = line.colOffset + (overlapEnd - line.caretStart);
            const maxCol = line.colOffset + line.displayLength;
            const clampedStartCol = Math.min(startCol, maxCol);
            const clampedEndCol = Math.min(endCol, maxCol);

            // Build vertices for the selected span and translate to absolute coords
            const leftVertex = new Vertex(line.row, clampedStartCol)
            const rightVertex = new Vertex(line.row, clampedEndCol)
            leftVertex.translate(this.cellArea.topLeft.row, this.cellArea.topLeft.col)
            rightVertex.translate(this.cellArea.topLeft.row, this.cellArea.topLeft.col)

            // Create a CellArea from the vertex span. Zero-width spans are expanded to 1
            // column, aligned according to text alignment settings.
            const vertexArea = new VertexArea(leftVertex, rightVertex);
            return vertexArea.toCellArea(
                this.alignV !== TEXT_ALIGN_V_OPTS.BOTTOM,
                this.alignH !== TEXT_ALIGN_H_OPTS.RIGHT
            )
        }).filter(Boolean); // Drop skipped lines
    }

    /**
     * Wraps text into logical "lines" based on the available column width (`usableCols`).
     *
     * For example, given the input "Hello   world" (with 3 spaces) and `usableCols` = 6,
     * the resulting lines will be:
     *   { rawText: "Hello   ", caretStart: 0, caretEnd: 8 },
     *   { rawText: "world",    caretStart: 8, caretEnd: 13 }
     *
     * Note that the first line's `rawText` has a length of 8, which exceeds `usableCols`.
     * This is intentional: trailing whitespace is preserved in the line it follows, even
     * though it won't be visually rendered. This ensures accurate caret indexing and movement.
     *
     * Any caret index within [caretStart, caretEnd) maps to that line. In the example above,
     * indices 0 through 7 (inclusive) map to the first line, even though only the first 6
     * characters will be displayed in the UI.
     *
     * In practice, when the user presses the right arrow key, the caret will remain at the end
     * of the visible line while moving through the hidden whitespace. For instance, to move from
     * "Hello   " to "world", the user will need to press the right arrow 2 extra times before 
     * advancing to the next line. The caret will appear to "stick" at the line's end until all
     * hidden characters are traversed.
     */
    _wrapText() {
        const usableCols = this.usableCols;

        let textIndex = 0;
        let lineStartIndex, lastSpaceIndex;

        const pushLine = (startIndex, endIndex) => {
            this.lines.push({
                rawText: this.text.substring(startIndex, endIndex),
                caretStart: startIndex,
                caretEnd: endIndex,

                // the following will be set in _alignText
                // row: undefined,
                // colOffset: undefined,
                // displayText: undefined,
            })

            lineStartIndex = undefined;
            lastSpaceIndex = undefined;
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

            // console.log(textIndex, lineStartIndex, char === '\n' ? '\\n' : char, lineLength, lastSpaceIndex);

            if (char === '\n') {
                pushLine(lineStartIndex, textIndex + 1); // +1 to include this \n char in the current line
            } else if (char === WHITESPACE_CHAR) {
                lastSpaceIndex = textIndex; // Include sequential whitespace, even if it goes longer than usableCols
            } else if (lineLength > usableCols) {
                // Once we reach a non-whitespace out-of-bounds char we terminate the line
                if (lastSpaceIndex === undefined) {
                    // There were no spaces in the line so far, so have to terminate the line mid-word
                    pushLine(lineStartIndex, textIndex);
                    continue; // Not incrementing textIndex so we evaluate current char again
                } else {
                    // There were spaces in the line, so we terminate the line at the end of the last space
                    const indexAfterLastSpace = lastSpaceIndex + 1; // Store this because pushLine will wipe lastSpaceIndex
                    pushLine(lineStartIndex, indexAfterLastSpace)
                    textIndex = indexAfterLastSpace; // Restart evaluation after the last space
                    continue;
                }
            }

            textIndex++;
        }

        // The following add one since the final caretEnd should be exclusive
        if (lineStartIndex === undefined) {
            // ended on a newline char, so add the next line
            pushLine(textIndex, textIndex + 1)
        } else {
            // finish normal current line
            pushLine(lineStartIndex, textIndex + 1);
        }
    }


    /**
     * Aligns text according to horizontal and vertical alignment settings. Also applies padding.
     * Will populate a 2d array of chars which it stores in `this.grid`
     */
    _alignText() {
        const usableRows = this.usableRows;
        const usableCols = this.usableCols;

        // Truncate lines that exceed grid height
        this.lines = this.lines.slice(0, usableRows);

        // Calculate vertical offset based on alignment
        let offsetTop = this.paddingV;
        if (this.alignV === TEXT_ALIGN_V_OPTS.MIDDLE) offsetTop += Math.floor((usableRows - this.lines.length) / 2);
        else if (this.alignV === TEXT_ALIGN_V_OPTS.BOTTOM) offsetTop += (usableRows - this.lines.length);

        this.lines.forEach((line, lineIndex) => {
            line.displayText = this._calcDisplayText(line, lineIndex, usableCols);
            line.displayLength = line.displayText.length;

            // Calculate horizontal offset based on alignment and display length
            let offsetLeft = this.paddingH;
            if (this.alignH === TEXT_ALIGN_H_OPTS.CENTER) offsetLeft += Math.floor((usableCols - line.displayLength) / 2);
            else if (this.alignH === TEXT_ALIGN_H_OPTS.RIGHT) offsetLeft += (usableCols - line.displayLength);

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