/**
 * Handles drawing shapes out of ASCII characters. E.g. rectangles, lines.
 * Note: This is different than just making a line selection and pressing a character to fill the line. That just
 * creates a line of all the same character, whereas an AsciiLine will use many different characters.
 */

import {Cell} from "./canvas.js";
import {create2dArray} from "./utilities.js";
import * as state from "./state.js";
import {currentColorIndex} from "./editor.js";

class AsciiPolygon {
    constructor(startCell) {
        this.start = startCell;
        this.end = startCell.clone();
        this.refreshGlyphs();
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

    refreshGlyphs() {
        this._glyphs = {
            chars: create2dArray(this.numRows, this.numCols),
            colors: create2dArray(this.numRows, this.numCols)
        }
    }
}

// Characters used to draw the different types of ascii rectangles. A rectangle is made up of 4 corners (TOP_LEFT,
// TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT), 2 HORIZONTAL lines, and 2 VERTICAL lines.
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

export class AsciiRect extends AsciiPolygon {
    get origin() {
        return this.topLeft;
    }

    refreshGlyphs() {
        super.refreshGlyphs();

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
 * A short segment of a line, used to draw a line of any length by repeating the template over and over.
 * @param repeatCoord The row/col offset where the template should start looping (i.e. start its next character).
 *   This cannot simply be calculated from looking at the chars array -- it depends on the shape of the line.
 *   Note: Since rows go top to bottom, a negative row offset indicates upward movement
 * @param chars A 2d array of chars to represent the line.
 */
class LineTemplate {
    constructor(repeatCoord, chars) {
        this.chars = chars;

        this.rise = repeatCoord[0];
        this.run = repeatCoord[1];
        this.slope = this.rise / this.run;

        this.maxRowIndex = this.chars.length - 1;
        this.maxColIndex = this.chars[0].length - 1; // TODO This assumes template rows all have same length
    }

    /**
     * Creates a path for this template, repeating the template over and over until the length is reached.
     * @param length How many chars long the path should be
     * @param callback Function that is called for each character in the line.
     *   It receives 3 arguments: (glyphRow, glyphCol, char)
     *   - glyphRow: The row to place the char in the final glyphs array. This value can be NEGATIVE, which means it
     *     should precede row 0.
     *   - glyphCol: Same as glyphRow but for columns.
     *   - char: The character to draw.
     */
    followLinePath(length, callback) {
        let charIndex = 0; // How many chars have been drawn; once it reaches `length` the function stops
        let templateIndex = 0; // How many times we've looped drawing the entire template
        let finished = false;

        while (!finished) {
            const rowOffset = templateIndex * this.rise;
            const colOffset = templateIndex * this.run;

            finished = this._iterateTemplate((char, glyphR, glyphC) => {
                if (char !== ' ') {
                    callback(glyphR + rowOffset, glyphC + colOffset, char);
                    charIndex++;
                    return charIndex > length; // Returning true will set `finished` to be true
                }
            })

            templateIndex++;
        }
    }

    /**
     * Iterates through the line template's characters. If the line has a negative rise, the rows will be iterated
     * in REVERSE order. Likewise, if the line has a negative run, the columns will be iterated in reverse order.
     *
     * For example, if the line is this (where `A` is the character that should be drawn first):
     *
     *       D      row index = 0
     *     C        row index = 1
     *   B          row index = 2
     * A            row index = 3
     *
     * Then the rows will be iterated in reverse. That way, row index 3 (the bottom row) will be first, followed by
     * row index 2 (second to bottom row), etc.
     *
     * @param callback A callback called for each character in the template (including spaces). It receives 3
     *   arguments: (char, glyphRow, glyphCol):
     *   - char: The char in the template
     *   - glyphRow: The row index to place the char in the final drawn array. Can be negative to indicate it should
     *     precede row index 0. In the example above, when the `A` char is processed, its glyphRow is 0. When `B`
     *     is processed, its glyphRow is -1. And so on.
     *   - glyphCol: Same as glyphRow but for column.
     *   - If the callback returns true, iteration will stop
     * @returns {boolean} Returns true if iteration was stopped due to the callback returning true.
     */
    _iterateTemplate(callback) {
        return this._iterate(this.maxRowIndex, this.rise < 0, (templateR, glyphRow) => {
            return this._iterate(this.maxColIndex, this.run < 0, (templateC, glyphCol) => {
                return callback(this.chars[templateR][templateC], glyphRow, glyphCol);
            })
        })
    }

    _iterate(max, inReverse, callback) {
        if (inReverse) {
            for (let i = max; i >= 0; i--) {
                if (callback(i, i - max)) return true;
            }
        }
        else {
            for (let i = 0; i <= max; i++) {
                if (callback(i, i)) return true;
            }
        }
    }

}

/**
 * Contains all the line templates used to draw ascii lines. All directions are represented here (think of it like hands
 * of a clock). We cannot just simply draw half the clock and then invert the lines for the other half; the lines are
 * not exact mirror images. For example, the LineTemplate for [2,8] cannot be inverted to generate the [-2,-8] line.
 */
const LINE_TEMPLATES = [
    new LineTemplate([0, 8], [
        '--------'
    ]),
    new LineTemplate([1, 8], [
        '-.._    ',
        '    `\'\'-'
    ]),
    new LineTemplate([2, 8], [
        '-._     ',
        '   `-._ ',
        '       `'
    ]),
    new LineTemplate([4, 8], [
        '`.      ',
        '  `.    ',
        '    `.  ',
        '      `.'
    ]),
    new LineTemplate([3, 4], [
        '\\   ',
        ' \'  ',
        '  `.'
    ]),
    new LineTemplate([4, 4], [
        '\\   ',
        ' \\  ',
        '  \\ ',
        '   \\',
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
    new LineTemplate([4, -1], [
        ' |',
        ' /',
        '| ',
        '/ '
    ]),
    new LineTemplate([4, -2], [
        '  /',
        ' | ',
        ' / ',
        '|  '
    ]),
    new LineTemplate([4, -4], [
        '   /',
        '  / ',
        ' /  ',
        '/   '
    ]),
    new LineTemplate([3, -4], [
        '   /',
        '  \' ',
        '.`  '
    ]),
    new LineTemplate([4, -8], [
        '      .\'',
        '    .\'  ',
        '  .\'    ',
        '.\'      '
    ]),
    new LineTemplate([2, -8], [
        '     _,-',
        ' _,-\'   ',
        '\'       '
    ]),
    new LineTemplate([1, -8], [
        '    _..-',
        '-\'\'`    '
    ]),
    // Don't need [0, -8], it is the same as [0, 8]
    new LineTemplate([-1, -8], [
        '-..,_   ',
        '     \'\'-'
    ]),
    new LineTemplate([-2, -8], [
        '._      ',
        '  `-._  ',
        '      `-'
    ]),
    new LineTemplate([-4, -8], [
        '`.      ',
        '  `.    ',
        '    `.  ',
        '      `.'
    ]),
    new LineTemplate([-3, -4], [
        '`.  ',
        '  . ',
        '   \\'
    ]),
    new LineTemplate([-4, -4], [
        '\\   ',
        ' \\  ',
        '  \\ ',
        '   \\'
    ]),
    new LineTemplate([-4, -2], [
        '|  ',
        ' \\ ',
        ' | ',
        '  \\'
    ]),
    new LineTemplate([-4, -1], [
        '\\ ',
        '| ',
        ' \\',
        ' |'
    ]),
    // Don't need [-4, 0], it is the same as [4, 0]
    new LineTemplate([-4, 1], [
        ' /',
        ' |',
        '/ ',
        '| '
    ]),
    new LineTemplate([-4, 2], [
        '  |',
        ' / ',
        ' | ',
        '/  '
    ]),
    new LineTemplate([-4, 4], [
        '   /',
        '  / ',
        ' /  ',
        '/   '
    ]),
    new LineTemplate([-3, 4], [
        '  ,\'',
        ' .  ',
        '/   '
    ]),
    new LineTemplate([-4, 8], [
        '      .\'',
        '    .\'  ',
        '  .\'    ',
        '.\'      '
    ]),
    new LineTemplate([-2, 8], [
        '      _,',
        '  _,-\'  ',
        '-\'      '
    ]),
    new LineTemplate([-1, 8], [
        '   _,..-',
        '-\'\'     '
    ]),
]

// Finds the LINE_TEMPLATE that most closely matches the given rise and run.
function findClosestLineTemplate(rise, run) {
    const slope = rise / run;

    // There is only one vertical/horizontal template:
    if (isVerticalSlope(slope)) return LINE_TEMPLATES.filter(template => isVerticalSlope(template.slope))[0];
    if (isHorizontalSlope(slope)) return LINE_TEMPLATES.filter(template => isHorizontalSlope(template.slope))[0];

    return LINE_TEMPLATES.filter(template => {
        // only include templates going same direction (check polarity)
        if (rise * template.rise < 0) return false;
        if (run * template.run < 0) return false;
        return true;
    }).reduce((prev, curr) => {
        // of the remaining, find the template with the closest slope
        return Math.abs(curr.slope - slope) < Math.abs(prev.slope - slope) ? curr : prev;
    });
}

function isVerticalSlope(slope) {
    return slope === Infinity || slope === -Infinity;
}
function isHorizontalSlope(slope) {
    return slope === 0;
}


export class AsciiLine extends AsciiPolygon {
    get origin() {
        return this._origin;
    }

    refreshGlyphs() {
        // Short-circuit if line is only one single character long
        if (this.start.equals(this.end)) {
            this._glyphs = { chars: [['-']], colors: [[currentColorIndex()]] }
            this._origin = this.start;
            return;
        }

        const rise = this.end.row - this.start.row;
        const run = this.end.col - this.start.col;
        const lineTemplate = findClosestLineTemplate(rise, run);
        const lineLength = Math.max(Math.abs(rise), Math.abs(run));

        // See _convertObjToArray function for info on why we initially store _glyphs as an object
        this._glyphs = { chars: {}, colors: {} };
        lineTemplate.followLinePath(lineLength, (glyphR, glyphC, char) => {
            this._setGlyph(glyphR, glyphC, char, currentColorIndex());
        })
        this._glyphs.chars = this._convertObjToArray(this._glyphs.chars);
        this._glyphs.colors = this._convertObjToArray(this._glyphs.colors);

        this._recalculateOrigin(rise, run);
    }

    _setGlyph(row, col, char, color) {
        this._glyphs.chars[row] ||= {}; // Drawing can go out of the boundaries initially set by super.refreshGlyphs()
        this._glyphs.chars[row][col] = char;
        this._glyphs.colors[row] ||= {};
        this._glyphs.colors[row][col] = color;
    }

    /**
     * Initially, we store _glyphs as an object (not array). In other words, instead of an array with indexes
     * 0, 1, 2, etc., we have an object with keys 0, 1, 2, etc. We do this so we can support negative indexes.
     *
     * This function turns that object back into an array.
     *
     * Note: A negative index does not mean the same thing as javascript's `at(index)` function:
     * - In this code, a negative index means how many indexes before index 0 something is
     * - In javascript's `at(index)` function, a negative index means the index starting from the end of the array
     */
    _convertObjToArray(obj) {
        const result = [];

        const minRowIndex = Math.min(...Object.keys(obj));
        const minColIndex = Math.min(...Object.values(obj).map(colObj => Object.keys(colObj)).flat());
        Object.keys(obj).sort((a, b) => a - b).forEach(rowIndex => {
            const netRowIndex = rowIndex - minRowIndex;
            if (result[netRowIndex] === undefined) result[netRowIndex] = [];
            Object.keys(obj[rowIndex]).sort((a, b) => a - b).forEach(colIndex => {
                const netColIndex = colIndex - minColIndex;
                result[netRowIndex][netColIndex] = obj[rowIndex][colIndex];
            })
        })

        return result;
    }

    _recalculateOrigin(rise, run) {
        this._origin = this.start.clone();
        if (rise < 0) {
            const rowOffset = this._glyphs.chars.length - 1;
            this._origin.translate(-1 * rowOffset, 0);
        }
        if (run < 0) {
            const colOffset = Math.max(...this._glyphs.chars.map(row => row.length)) - 1;
            this._origin.translate(0, -1 * colOffset);
        }
    }


}

