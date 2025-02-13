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
    get origin() {
        return this.topLeft;
    }

    recalculateGlyphs() {
        super.recalculateGlyphs();

        const charSheet = DRAW_RECT_CHARS[state.config('drawRect').type];
        if (charSheet === undefined) {
            console.error("Invalid char sheet for: ", state.config('drawRect'))
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

/**
 * @param loopTarget The row/col offset where the template should start looping (i.e. start its next character)
 */
class LineTemplate {
    constructor(loopTarget, chars) {
        this.loopTarget = loopTarget;
        this.chars = chars;
        
        this.rise = this.loopTarget[0];
        this.run = this.loopTarget[1];
        this.slope = this.rise / this.run;
    }
}

const LINE_TEMPLATES = [
    new LineTemplate([0, 8], [
        '--------'
    ]),
    new LineTemplate([1, 8], [
        '-.._    ',
        '    `\'\'-'
    ]),
    new LineTemplate([2, 8], [
        '-.      ',
        '  `\'-.  ',
        '      `\''
    ]),
    new LineTemplate([4, 8], [
        '`.      ',
        '  `.    ',
        '    `.  ',
        '      `.'
    ]),
    new LineTemplate([6, 8], [
        '\\               ',
        ' \'              ',
        '  `.            ',
        '    \\           ',
        '     \'          ',
        '      `.        '
    ]),
    new LineTemplate([4, 4], [
        '\\               ',
        ' \\              ',
        '  \\             ',
        '   \\            ',
    ]),
    new LineTemplate([4, 2], [
        '\\  ',
        ' | ',
        ' \\ ',
        '  |'
    ]),
    new LineTemplate([4, 1], [
        '| ',
        '\\ ',
        ' |',
        ' \\'
    ]),
    new LineTemplate([4, 0], [
        '|',
        '|',
        '|',
        '|'
    ]),
]

function findClosestLineTemplate(goalSlope) {
    if (isVerticalSlope(goalSlope)) {
        return LINE_TEMPLATES.filter(template => isVerticalSlope(template.slope))[0];
    }

    return LINE_TEMPLATES.reduce((prev, curr) => {
        return Math.abs(curr.slope - goalSlope) < Math.abs(prev.slope - goalSlope) ? curr : prev
    });
}

function isVerticalSlope(slope) {
    return slope === Infinity || slope === -Infinity;
}


export class DrawingLine extends DrawingPolygon {
    get origin() {
        return this._invertedOrigin ? this._invertedOrigin : this.start;
    }

    recalculateGlyphs() {
        this._glyphs = {
            chars: [[]],
            colors: [[]]
        }

        if (this.start.equals(this.end)) {
            this._glyphs.chars[0][0] = '-';
            this._glyphs.colors[0][0] = currentColorIndex();
            return;
        }

        const rise = this.end.row - this.start.row;
        const run = this.end.col - this.start.col;
        const goalSlope = rise / run;
        const inverted = run < 0 || (run === 0 && rise < 0);

        const lineTemplate = findClosestLineTemplate(goalSlope);
        const lineLength = Math.max(Math.abs(rise), Math.abs(run));

        this._drawLineTemplate(lineTemplate, lineLength);

        if (inverted) {
            this._invertedOrigin = this.start.clone();
            const rowOffset = this._glyphs.chars.length - 1;
            const colOffset = this._glyphs.chars[rowOffset].length - 1
            this._invertedOrigin.translate(-1 * rowOffset, -1 * colOffset);
        }
        else {
            this._invertedOrigin = null;
        }
    }

    // Draws the line by repeating the LineTemplate chars over and over until we reach the given lineLength
    _drawLineTemplate(lineTemplate, lineLength) {
        let charIndex = 0; // How far into the ascii line we've drawn
        let templateIndex = 0; // How many times we've looped drawing the entire template

        while (true) {
            const templateRow = templateIndex * lineTemplate.rise;
            const templateCol = templateIndex * lineTemplate.run;

            for (let r = 0; r < lineTemplate.chars.length; r++) {
                for (let c = 0; c < lineTemplate.chars[r].length; c++) {
                    const char = lineTemplate.chars[r][c];
                    if (char === ' ') { continue; } // Ignore blank chars in the line template

                    this._setGlyph(templateRow + r, templateCol + c, char, currentColorIndex());

                    charIndex++;
                    if (charIndex > lineLength) {
                        return;
                    }
                }
            }

            templateIndex++;
        }
    }

    // Drawing can go out of the boundaries initially set by super.recalculateGlyphs()
    _setGlyph(row, col, char, color) {
        if (this._glyphs.chars[row] === undefined) {
            this._glyphs.chars[row] = [];
        }
        this._glyphs.chars[row][col] = char;

        if (this._glyphs.colors[row] === undefined) {
            this._glyphs.colors[row] = [];
        }
        this._glyphs.colors[row][col] = color;
    }

}

