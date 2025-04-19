import DrawingPolygon from "../polygon.js";

/**
 * Characters used to draw the different types of ascii rectangles. A rectangle is made up of 4 corners (TOP_LEFT,
 * TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT), 2 HORIZONTAL lines, and 2 VERTICAL lines.
 */
const DRAW_RECT_CHARS = {
    'outline-ascii-1': {
        TOP_LEFT: '/',
        TOP_RIGHT: '\\',
        BOTTOM_LEFT: '\\',
        BOTTOM_RIGHT: '/',
        HORIZONTAL: '-',
        VERTICAL: '|'
    },
    'outline-ascii-2': {
        TOP_LEFT: '+',
        TOP_RIGHT: '+',
        BOTTOM_LEFT: '+',
        BOTTOM_RIGHT: '+',
        HORIZONTAL: '-',
        VERTICAL: '|'
    },
    'outline-unicode-1': {
        TOP_LEFT: '┌',
        TOP_RIGHT: '┐',
        BOTTOM_LEFT: '└',
        BOTTOM_RIGHT: '┘',
        HORIZONTAL: '─',
        VERTICAL: '│'
    },
    'outline-unicode-2': {
        TOP_LEFT: '╔',
        TOP_RIGHT: '╗',
        BOTTOM_LEFT: '╚',
        BOTTOM_RIGHT: '╝',
        HORIZONTAL: '═',
        VERTICAL: '║'
    },
    'outline-monochar': char => {
        return {
            TOP_LEFT: char,
            TOP_RIGHT: char,
            BOTTOM_LEFT: char,
            BOTTOM_RIGHT: char,
            HORIZONTAL: char,
            VERTICAL: char,
        }
    },
    'filled-monochar': char => {
        return {
            TOP_LEFT: char,
            TOP_RIGHT: char,
            BOTTOM_LEFT: char,
            BOTTOM_RIGHT: char,
            HORIZONTAL: char,
            VERTICAL: char,
            FILL: char
        }
    }
}

/**
 * Handles drawing a rect out of ASCII characters. This is different than just making a rect outline selection and
 * pressing a keyboard character to fill the line; that would create a rect of all the same character whereas this
 * tries to approximate an actual rectangle shape out of many characters (e.g. vertical line char on sides, horizontal
 * line char on top/bottom, rounded corners, etc.)
 */
export default class DrawingRect extends DrawingPolygon {
    recalculate() {
        this._initGlyphsToBoundingArea();

        this._setCharSheet(DRAW_RECT_CHARS);

        const lastRow = this.boundingArea.numRows - 1
        const lastCol = this.boundingArea.numCols - 1

        // draw 4 lines and 4 corners
        for (let row = 0; row <= lastRow; row++) {
            for (let col = 0; col <= lastCol; col++) {
                let char;
                if (col === 0) {
                    if (row === 0) { char = this.charSheet.TOP_LEFT; }
                    else if (row === lastRow) { char = this.charSheet.BOTTOM_LEFT; }
                    else { char = this.charSheet.VERTICAL; }
                }
                else if (col === lastCol) {
                    if (row === 0) { char = this.charSheet.TOP_RIGHT; }
                    else if (row === lastRow) { char = this.charSheet.BOTTOM_RIGHT; }
                    else { char = this.charSheet.VERTICAL; }
                }
                else {
                    if (row === 0) { char = this.charSheet.HORIZONTAL; }
                    else if (row === lastRow) { char = this.charSheet.HORIZONTAL; }
                    else if (this.charSheet.FILL !== undefined) { char = this.charSheet.FILL; }
                }

                if (char !== undefined) this._setGlyph({row, col}, char, this.options.colorIndex);
            }
        }
    }
}