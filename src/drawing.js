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
 * @param loopTarget The row/col offset where the template should start looping (i.e. start its next character).
 *   This cannot simply be calculated from looking at the chars -- sometimes it is offset for certain line shapes.
 *   Note: Since rows go top to bottom, a negative row offset indicates upward movement
 */
class LineTemplate {
    constructor(loopTarget, chars) {
        this.chars = chars;
        
        this.rise = loopTarget[0];
        this.run = loopTarget[1];
        this.slope = this.rise / this.run;

        this.maxRowIndex = this.chars.length - 1;
        this.maxColIndex = this.chars[0].length - 1; // TODO This assumes template rows all have same length

        this.iterateRowsBackwards = this.rise < 0;
        this.iterateColsBackwards = this.run < 0;
    }

    followLinePath(length, callback) {
        let charIndex = 0;
        let templateIndex = 0; // How many times we've looped drawing the entire template
        let finished = false;

        while (!finished) {
            const rowOffset = templateIndex * Math.abs(this.rise);
            const colOffset = templateIndex * Math.abs(this.run);

            this._iterate(this.maxRowIndex, this.iterateRowsBackwards, (templateR, glyphR) => {
                return this._iterate(this.maxColIndex, this.iterateColsBackwards, (templateC, glyphC) => {
                    const char = this.chars[templateR][templateC];
                    if (char === ' ') { return; }

                    callback(glyphR + rowOffset, glyphC + colOffset, char);

                    charIndex++;
                    if (charIndex > length) {
                        finished = true;
                        return true;
                    }
                })
            });

            templateIndex++;
        }
    }

    _iterate(max, reverse, callback) {
        if (reverse) {
            for (let i = max; i >= 0; i--) {
                if (callback(i, max - i)) return true;
            }
        }
        else {
            for (let i = 0; i <= max; i++) {
                if (callback(i, i)) return true;
            }
        }
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
        '1   ',
        ' \\  ',
        '  \\ ',
        '   4',
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
        '   1',
        '  / ',
        ' /  ',
        '4   '
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
        '4   ',
        ' \\  ',
        '  \\ ',
        '   1'
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
        '   4',
        '  / ',
        ' /  ',
        '1   '
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

function findClosestLineTemplate(rise, run) {
    const slope = rise / run;
    if (isVerticalSlope(slope)) {
        return LINE_TEMPLATES.filter(template => isVerticalSlope(template.slope))[0];
    }
    if (isHorizontalSlope(slope)) {
        return LINE_TEMPLATES.filter(template => isHorizontalSlope(template.slope))[0];
    }

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


export class DrawingLine extends DrawingPolygon {
    get origin() {
        return this._origin;
    }

    recalculateGlyphs() {
        this._glyphs = {
            chars: [[]],
            colors: [[]]
        }

        if (this.start.equals(this.end)) {
            this._glyphs.chars[0][0] = '-';
            this._glyphs.colors[0][0] = currentColorIndex();
            this._origin = this.start;
            return;
        }

        const rise = this.end.row - this.start.row;
        const run = this.end.col - this.start.col;
        const lineTemplate = findClosestLineTemplate(rise, run);
        const lineLength = Math.max(Math.abs(rise), Math.abs(run));

        lineTemplate.followLinePath(lineLength, (glyphR, glyphC, char) => {
            this._setGlyph(glyphR, glyphC, char, currentColorIndex());
        })

        if (lineTemplate.iterateRowsBackwards) { this._reverseGlyphRows() }
        if (lineTemplate.iterateColsBackwards) { this._reverseGlyphCols() }

        this._recalculateOrigin(rise, run);
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

    _reverseGlyphRows() {
        this._glyphs.chars.reverse();
        this._glyphs.colors.reverse();
    }

    _reverseGlyphCols() {
        const maxLength = Math.max(...this._glyphs.chars.map(row => row.length));
        this._glyphs.chars.forEach(row => {
            row.length = maxLength;
            row.reverse();
        });
        this._glyphs.colors.forEach(row => {
            row.length = maxLength;
            row.reverse();
        });
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

