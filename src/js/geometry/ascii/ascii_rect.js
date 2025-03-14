import AsciiPolygon from "./ascii_polygon.js";
import Cell from "../cell.js";
import {create2dArray} from "../../utils/arrays.js";

/**
 * Characters used to draw the different types of ascii rectangles. A rectangle is made up of 4 corners (TOP_LEFT,
 * TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT), 2 HORIZONTAL lines, and 2 VERTICAL lines.
 */
const DRAW_RECT_CHARS = {
    'printable-ascii-1': {
        TOP_LEFT: '/',
        TOP_RIGHT: '\\',
        BOTTOM_LEFT: '\\',
        BOTTOM_RIGHT: '/',
        HORIZONTAL: '-',
        VERTICAL: '|'
    },
    'printable-ascii-2': {
        TOP_LEFT: '+',
        TOP_RIGHT: '+',
        BOTTOM_LEFT: '+',
        BOTTOM_RIGHT: '+',
        HORIZONTAL: '-',
        VERTICAL: '|'
    },
    'single-line': {
        TOP_LEFT: '┌',
        TOP_RIGHT: '┐',
        BOTTOM_LEFT: '└',
        BOTTOM_RIGHT: '┘',
        HORIZONTAL: '─',
        VERTICAL: '│'
    },
    'double-line': {
        TOP_LEFT: '╔',
        TOP_RIGHT: '╗',
        BOTTOM_LEFT: '╚',
        BOTTOM_RIGHT: '╝',
        HORIZONTAL: '═',
        VERTICAL: '║'
    }
}

/**
 * Handles drawing a rect out of ASCII characters. This is different than just making a rect outline selection and
 * pressing a keyboard character to fill the line; that would create a rect of all the same character whereas this
 * tries to approximate an actual rectangle shape out of many characters (e.g. vertical line char on sides, horizontal
 * line char on top/bottom, rounded corners, etc.)
 */
export default class AsciiRect extends AsciiPolygon {
    recalculate() {
        const numRows = Math.abs(this.start.row - this.end.row) + 1
        const numCols = Math.abs(this.start.col - this.end.col) + 1

        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols)
        }

        const charSheet = DRAW_RECT_CHARS[this.options.drawType];
        if (charSheet === undefined) {
            console.error("Invalid char sheet for: ", this.options.drawType)
            return;
        }

        const lastRow = numRows - 1
        const lastCol = numCols - 1

        // draw 4 lines and 4 corners
        for (let row = 0; row <= lastRow; row++) {
            for (let col = 0; col <= lastCol; col++) {
                let char;
                if (col === 0) {
                    if (row === 0) { char = charSheet.TOP_LEFT; }
                    else if (row === lastRow) { char = charSheet.BOTTOM_LEFT; }
                    else { char = charSheet.VERTICAL; }
                }
                else if (col === lastCol) {
                    if (row === 0) { char = charSheet.TOP_RIGHT; }
                    else if (row === lastRow) { char = charSheet.BOTTOM_RIGHT; }
                    else { char = charSheet.VERTICAL; }
                }
                else {
                    if (row === 0) { char = charSheet.HORIZONTAL; }
                    else if (row === lastRow) { char = charSheet.HORIZONTAL; }
                }

                if (char) {
                    this._glyphs.chars[row][col] = char;
                    this._glyphs.colors[row][col] = this.options.colorIndex;
                }
            }
        }

        // Set origin to top-left cell
        this._origin = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col))
    }
}