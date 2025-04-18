import AsciiPolygon from "./ascii_polygon.js";
import {create2dArray} from "../../utils/arrays.js";
import Cell from "../cell.js";
import {isObject} from "../../utils/objects.js";
import {start} from "core-js/internals/string-pad.js";

/**
 * A short segment of a line, used to draw a line of any length by repeating the template over and over.
 * @param {[number, number]} repeatCoord - The row/col offset where the template should start looping (i.e. start its
 *   next character). This cannot simply be calculated from looking at the chars array -- it depends on the shape of the
 *   line. Note: Since rows go top to bottom, a negative row offset indicates upward movement.
 * @param {string[][]} chars - A 2d array of chars to represent the line.
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
     * @param {number} length - How many chars long the path should be
     * @param {(glyphRow: number, glyphCol: number, char: string) => void} callback - Function that is called for each
     *   character in the line. Function parameters:
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
     * @param {(char: string, glyphRow: number, glyphCol: number) => void} callback - A callback called for each character
     *   in the template (including spaces). Function parameters:
     *   - char: The char in the template
     *   - glyphRow: The row index to place the char in the final drawn array. Can be negative to indicate it should
     *     precede row index 0. In the example above, when the `A` char is processed, its glyphRow is 0. When `B`
     *     is processed, its glyphRow is -1. And so on.
     *   - glyphCol: Same as glyphRow but for column.
     *   - If the callback returns true, iteration will stop
     * @returns {boolean} - Returns true if iteration was stopped due to the callback returning true.
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
 * Contains all the line templates used to draw ascii lines. All directions are represented here (think of it like the
 * hand of a clock moving all the way around the clock face). Unfortunately we cannot just simply draw half the clock
 * and invert the lines for the other half; the lines are not exact mirror images. For example, the LineTemplate
 * for [2,8] cannot be inverted to generate the [-2,-8] line.
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


const RIGHT_ANGLE_CHARS = {
    'ascii-right-angle-line': {
        LINE: {
            UP: '|',
            RIGHT: '-',
            DOWN: '|',
            LEFT: '-',
        },
        BEND: '+',
    },
    'ascii-right-angle-arrow': {
        // START: {
        //     UP: '|',
        //     RIGHT: '-',
        //     DOWN: '|',
        //     LEFT: '-',
        // },
        LINE: {
            UP: '|',
            RIGHT: '-',
            DOWN: '|',
            LEFT: '-',
        },
        // BEND: {
        //     UP_RIGHT: '+',
        //     UP_LEFT: '+',
        //     DOWN_RIGHT: '+',
        //     DOWN_LEFT: '+',
        // },
        BEND: '+',
        END: {
            UP: '^',
            RIGHT: '>',
            DOWN: 'v',
            LEFT: '<',
        }
    },
}

function createSingleCharRightAngleSheet(char) {
    return {
        LINE: char
    }
}


/**
 * Handles drawing a line out of ASCII characters. This is different than just making a line selection and pressing
 * a keyboard character to fill the line; that would create a line of all the same character whereas this tries
 * to approximate an actual straight line out of many characters
 */
export default class AsciiLine extends AsciiPolygon {
    recalculate(shiftKey) {
        switch (this.options.drawType) {
            case 'ascii-straight':
                return this._straightAsciiLine()
            case 'current-char-straight':
                return this._singleCharLine();
            case 'ascii-right-angle-line':
            case 'ascii-right-angle-arrow':
            case 'current-char-right-angle':
                return this._rightAngleLine(shiftKey);
        }
    }

    _straightAsciiLine() {
        // Short-circuit if line is only one single character long
        if (this.start.equals(this.end)) {
            this._glyphs = { chars: [['-']], colors: [[this.options.colorIndex]] }
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
            this._setGlyph(glyphR, glyphC, char, this.options.colorIndex);
        })
        this._glyphs.chars = this._convertObjToArray(this._glyphs.chars);
        this._glyphs.colors = this._convertObjToArray(this._glyphs.colors);

        this._recalculateOrigin(rise, run);
    }

    _singleCharLine() {
        const numRows = Math.abs(this.start.row - this.end.row) + 1
        const numCols = Math.abs(this.start.col - this.end.col) + 1
        this._origin = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols)
        }
        this.start.lineTo(this.end).forEach(cell => {
            const relativeRow = cell.row - this._origin.row;
            const relativeCol = cell.col - this._origin.col;
            this._glyphs.chars[relativeRow][relativeCol] = this.options.char;
            this._glyphs.colors[relativeRow][relativeCol] = this.options.colorIndex;
        })
    }

    _rightAngleLine(changeRoute) {
        const charSheet = this.options.drawType === 'current-char-right-angle' ?
            createSingleCharRightAngleSheet(this.options.char) : RIGHT_ANGLE_CHARS[this.options.drawType]

        if (charSheet === undefined) {
            console.error("Invalid char sheet for: ", this.options.drawType)
            return;
        }

        const numRows = Math.abs(this.start.row - this.end.row) + 1
        const numCols = Math.abs(this.start.col - this.end.col) + 1
        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols)
        }

        const getCharBetween = (type, fromCell, toCell) => {
            const direction = getDirectionBetween(fromCell, toCell);
            if (charSheet[type] === undefined) type = 'LINE';
            return isObject(charSheet[type]) ? charSheet[type][direction] : charSheet[type];
        }
        const getDirectionBetween = (fromCell, toCell) => {
            let vertical = '';
            if (fromCell.row < toCell.row) vertical = 'DOWN'
            if (fromCell.row > toCell.row) vertical = 'UP'
            let horizontal = '';
            if (fromCell.col < toCell.col) horizontal = 'RIGHT'
            if (fromCell.col > toCell.col) horizontal = 'LEFT'
            if (!vertical && !horizontal) return 'DOWN';
            return `${vertical}${vertical && horizontal ? '_' : ''}${horizontal}`
        }
        const setGlyph = (row, col, char) => {
            if (char !== undefined) {
                this._glyphs.chars[row][col] = char;
                this._glyphs.colors[row][col] = this.options.colorIndex;
            }
        }
        const straightLineBetween = (fromCell, toCell, char) => {
            if (fromCell.row === toCell.row) {
                if (fromCell.col <= toCell.col) {
                    for (let c = fromCell.col + 1; c < toCell.col; c++) setGlyph(fromCell.row, c, char);
                }
                else {
                    for (let c = fromCell.col - 1; c > toCell.col; c--) setGlyph(fromCell.row, c, char);
                }
            }
            else if (fromCell.col === toCell.col) {
                if (fromCell.row <= toCell.row) {
                    for (let r = fromCell.row + 1; r < toCell.row; r++) setGlyph(r, fromCell.col, char);
                }
                else {
                    for (let r = fromCell.row - 1; r > toCell.row; r--) setGlyph(r, fromCell.col, char);
                }
            }
            else {
                console.warn(`Cannot draw straight line between ${fromCell} and ${toCell}`)
            }
        }

        this._origin = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col))
        const relativeStart = this.start.relativeTo(this._origin);
        const relativeEnd = this.end.relativeTo(this._origin);
        let bend = changeRoute ? new Cell(relativeStart.row, relativeEnd.col) : new Cell(relativeEnd.row, relativeStart.col);

        if (bend.equals(relativeStart) || bend.equals(relativeEnd)) {
            // There is no bend
            setGlyph(relativeStart.row, relativeStart.col, getCharBetween('START', relativeStart, relativeEnd));
            straightLineBetween(relativeStart, relativeEnd, getCharBetween('LINE', relativeStart, relativeEnd));
            setGlyph(relativeEnd.row, relativeEnd.col, getCharBetween('END', relativeStart, relativeEnd));
        }
        else {
            setGlyph(relativeStart.row, relativeStart.col, getCharBetween('START', relativeStart, bend));
            straightLineBetween(relativeStart, bend, getCharBetween('LINE', relativeStart, bend));
            setGlyph(bend.row, bend.col, getCharBetween('BEND', relativeStart, relativeEnd));
            straightLineBetween(bend, relativeEnd, getCharBetween('LINE', bend, relativeEnd));
            setGlyph(relativeEnd.row, relativeEnd.col, getCharBetween('END', bend, relativeEnd));
        }
    }

    _setGlyph(row, col, char, color) {
        this._glyphs.chars[row] ||= {};
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

