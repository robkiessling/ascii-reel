import {isFunction} from "../../utils/utilities.js";
import {
    CHAR_PROP, COLOR_PROP, FILL_OPTIONS, FILL_PROP, HANDLES, SHAPE_TYPES,
    STROKE_PROPS, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP, TEXT_ALIGN_V_OPTS, TEXT_ALIGN_V_PROP, TEXT_PROP
} from "./constants.js";
import CellArea from "../cell_area.js";
import TextLayout from "./text_layout.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import BoxShape from "./box_shape.js";


/**
 * Characters used to draw the different types of ascii rectangles. A rectangle is made up of 4 corners (TOP_LEFT,
 * TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT), 2 HORIZONTAL lines, and 2 VERTICAL lines
 */
const CHAR_SHEETS = {
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
    }
}

export default class Rect extends BoxShape {

    static beginRect(startCell, options) {
        const props = {
            topLeft: startCell,
            numRows: 1,
            numCols: 1,
            [STROKE_PROPS[SHAPE_TYPES.RECT]]: options.drawPreset,
            [FILL_PROP]: options.fill || FILL_OPTIONS.EMPTY,
            [CHAR_PROP]: options.char,
            [COLOR_PROP]: options.colorIndex,
            [TEXT_PROP]: " Hello World\nI am Merlin, lord of magicke, and I shall rule these lands",
            [TEXT_ALIGN_V_PROP]: TEXT_ALIGN_V_OPTS.TOP,
            [TEXT_ALIGN_H_PROP]: TEXT_ALIGN_H_OPTS.LEFT,
            textPadding: 0
        };

        return new Rect(undefined, SHAPE_TYPES.RECT, props);
    }

    _cacheGeometry() {
        const state = this.props;

        const boundingArea = CellArea.fromOriginAndDimensions(state.topLeft, state.numRows, state.numCols);
        const innerArea = boundingArea.innerArea();
        const glyphs = this._initGlyphs(boundingArea);

        const stroke = state[STROKE_PROPS[SHAPE_TYPES.RECT]]
        let charSheet = CHAR_SHEETS[stroke];
        if (isFunction(charSheet)) charSheet = charSheet(state[CHAR_PROP]);
        const fillChar = this._fillChar();

        const lastRow = state.numRows - 1;
        const lastCol = state.numCols - 1;

        boundingArea.iterateRelative((row, col) => {
            let char;
            const colorIndex = state[COLOR_PROP];

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
                else { char = fillChar; }
            }

            this._setGlyph(glyphs, {row, col}, char, colorIndex);
        });

        const textLayout = this._applyTextLayout(glyphs, boundingArea);

        const emptyBackground = fillChar === EMPTY_CHAR;

        const hitbox = cell => {
            if (textLayout && textLayout.doesCellOverlap(cell)) return true;
            if (innerArea && innerArea.doesCellOverlap(cell) && emptyBackground) return false;
            return boundingArea.doesCellOverlap(cell);
        };

        this._cache = {
            boundingArea,
            origin: state.topLeft,
            glyphs,
            hitbox,
            textLayout
        }
    }


    // ------------------------------------------------------ Text

    _applyTextLayout(glyphs, cellArea) {
        if (!this.props[TEXT_PROP]) return null;
        if (cellArea.numCols < 3 || cellArea.numRows < 3) return null;

        const textLayout = new TextLayout(
            this.props[TEXT_PROP],
            cellArea,
            {
                alignH: this.props[TEXT_ALIGN_H_PROP],
                alignV: this.props[TEXT_ALIGN_V_PROP],
                paddingH: this.props.textPadding + 1, // Add 1 for rect's natural outline
                paddingV: this.props.textPadding + 1,
            }
        )

        textLayout.grid.forEach((row, rowIndex) => {
            row.forEach((char, colIndex) => {
                if (char !== EMPTY_CHAR) {
                    this._setGlyph(glyphs, { row: rowIndex, col: colIndex }, char, this.props[COLOR_PROP])
                }
            })
        })

        return textLayout;
    }


}