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

        this._drawTemplateRepeatedly(lineTemplate, lineLength);
        this._recalculateOrigin(rise, run);
    }

    _drawTemplateRepeatedly(lineTemplate, lineLength) {
        let charIndex = 0; // How far into the ascii line we've drawn
        let templateIndex = 0; // How many times we've looped drawing the entire template
        let finished = false;

        while (!finished) {
            this._iterateRows(templateIndex, lineTemplate, (templateR, glyphR) => {
                return this._iterateCols(templateIndex, lineTemplate, (templateC, glyphC) => {
                    const char = lineTemplate.chars[templateR][templateC];
                    if (char === ' ') { return; }

                    this._setGlyph(glyphR, glyphC, char, currentColorIndex());

                    charIndex++;
                    if (charIndex > lineLength) {
                        finished = true;
                        return true;
                    }
                });
            });

            templateIndex++;
        }
    }

    _iterateRows(templateIndex, lineTemplate, callback) {
        const templateOffset = templateIndex * Math.abs(lineTemplate.rise);
        const maxTemplateRowIndex = lineTemplate.chars.length - 1;

        if (lineTemplate.rise >= 0) {
            for (let r = 0; r <= maxTemplateRowIndex; r++) {
                if (callback(r, templateOffset + r)) {
                    return true;
                }
            }
        }
        else {
            for (let r = maxTemplateRowIndex; r >= 0; r--) {
                const invertedR = maxTemplateRowIndex - r;
                if (callback(r, templateOffset + invertedR)) {
                    this._reverseGlyphRows()
                    return true;
                }
            }
        }
    }

    _iterateCols(templateIndex, lineTemplate, callback) {
        const templateOffset = templateIndex * Math.abs(lineTemplate.run);
        const maxTemplateColIndex = lineTemplate.chars[0].length - 1; // Note: This assumes template rows all have same length

        if (lineTemplate.run >= 0) {
            for (let c = 0; c <= maxTemplateColIndex; c++) {
                if (callback(c, templateOffset + c)) {
                    return true;
                }
            }
        }
        else {
            for (let c = maxTemplateColIndex; c >= 0; c--) {
                const invertedC = maxTemplateColIndex - c;
                if (callback(c, templateOffset + invertedC)) {
                    this._reverseGlyphCols();
                    return true;
                }
            }
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

