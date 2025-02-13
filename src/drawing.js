/**
 * Handles drawing shapes out of ASCII characters. E.g. rectangles, lines
 */


import {Cell} from "./canvas.js";
import {create2dArray} from "./utilities.js";
import * as state from "./state.js";
import {currentColorIndex} from "./editor.js";

class DrawingPolygon {
    constructor(startCell) {
        this.start = startCell;
        this.end = startCell.clone();
        this.recalculateGlyphs();
    }

    get glyphs() {
        return this._glyphs;
    }
    get topLeft() {
        return new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }
    get bottomRight() {
        return new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
    }
    get numRows() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }
    get numCols() {
        return this.bottomRight.col - this.topLeft.col + 1;
    }

    recalculateGlyphs() {
        this._glyphs = {
            chars: create2dArray(this.numRows, this.numCols),
            colors: create2dArray(this.numRows, this.numCols)
        }
    }
}

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

export class DrawingRect extends DrawingPolygon {
    recalculateGlyphs() {
        super.recalculateGlyphs();

        const charSheet = DRAW_RECT_CHARS[state.config('drawRectType')];
        if (charSheet === undefined) {
            console.error("Invalid char sheet for: ", state.config('drawRectType'))
            return;
        }

        const lastRow = this.numRows - 1;
        const lastCol = this.numCols - 1;

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
                    this._glyphs.colors[row][col] = currentColorIndex();
                }
            }
        }
    }
}

export class DrawingLine extends DrawingPolygon {
    recalculateGlyphs() {
        this._glyphs = {
            chars: [],
            colors: []
        }
    }
}

