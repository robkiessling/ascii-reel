import {isFunction} from "../../utils/utilities.js";
import {
    CHAR_PROP, COLOR_PROP, SHAPE_TYPES, STROKE_STYLE_PROPS, TEXT_PADDING_PROP
} from "./constants.js";
import CellArea from "../cell_area.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import {registerShape} from "./registry.js";
import Textbox from "./textbox.js";


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

export default class Rect extends Textbox {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: STROKE_STYLE_PROPS[SHAPE_TYPES.RECT] },
    ];

    deleteOnTextFinished() {
        return false;
    }
    showSelectionOnInitialDraw() {
        return false;
    }


    _cacheGeometry() {
        const boundingArea = CellArea.fromOriginAndDimensions(this.props.topLeft, this.props.numRows, this.props.numCols);
        const glyphs = this._initGlyphs(boundingArea);
        const textLayout = this._buildTextLayout(boundingArea);

        this._applyStrokeAndFill(boundingArea, glyphs);
        this._applyTextLayout(textLayout, glyphs);

        const hasEmptyBackground = this._fillChar === EMPTY_CHAR;
        const innerArea = boundingArea.innerArea();
        const handles = this._buildHandleCollection(boundingArea, cell => {
            if (textLayout.includesCell(cell)) return true;
            if (innerArea && innerArea.includesCell(cell) && hasEmptyBackground) return false;
            return boundingArea.includesCell(cell);
        }, cell => {
            return textLayout.includesCell(cell, false)
        })

        this._cache = {
            boundingArea,
            origin: this.props.topLeft,
            glyphs,
            textLayout,
            handles
        }
    }

    _applyStrokeAndFill(boundingArea, glyphs) {
        let charSheet = CHAR_SHEETS[this._strokeStyle];
        if (isFunction(charSheet)) charSheet = charSheet(this.props[CHAR_PROP]);
        const fillChar = this._fillChar;

        const lastRow = this.props.numRows - 1;
        const lastCol = this.props.numCols - 1;
        const colorIndex = this.props[COLOR_PROP];

        boundingArea.iterateRelative((row, col) => {
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
                else { char = fillChar; }
            }

            this._setGlyph(glyphs, {row, col}, char, colorIndex);
        });
    }

    get textPadding() {
        // Add 1 for rect's natural outline
        return this.props[TEXT_PADDING_PROP] + 1;
    }

}

registerShape(SHAPE_TYPES.RECT, Rect);