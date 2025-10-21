import {isFunction} from "../../utils/utilities.js";
import {
    CHAR_PROP, COLOR_PROP, LINE_PATHING_BUFFER, SHAPE_TYPES, STROKE_STYLE_PROPS, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP,
    TEXT_ALIGN_V_OPTS, TEXT_ALIGN_V_PROP, TEXT_OVERFLOW_PROP, TEXT_PADDING_PROP, TEXT_PROP
} from "./constants.js";
import CellArea from "../cell_area.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import {registerShape} from "./registry.js";
import BoxShape from "./box_shape.js";
import TextLayout from "./text_layout.js";
import Cell from "../cell.js";


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
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: STROKE_STYLE_PROPS[SHAPE_TYPES.RECT] },
        { prop: TEXT_PROP, default: "" },
        { prop: TEXT_ALIGN_V_PROP, default: TEXT_ALIGN_V_OPTS.MIDDLE },
        { prop: TEXT_ALIGN_H_PROP, default: TEXT_ALIGN_H_OPTS.CENTER },
        { prop: TEXT_PADDING_PROP, default: 0 },
        { prop: TEXT_OVERFLOW_PROP, default: false },
    ];

    _cacheGeometry() {
        let origin = this.props.topLeft;
        const boundingArea = CellArea.fromOriginAndDimensions(origin, this.props.numRows, this.props.numCols);
        let glyphs = this._initGlyphs(boundingArea, this.props[TEXT_OVERFLOW_PROP]);

        this._applyStrokeAndFill(boundingArea, glyphs);

        const textLayout = this._buildTextLayout(boundingArea);
        this._applyTextLayout(boundingArea, textLayout, glyphs);

        // Glyphs may have overflowed due to TEXT_OVERFLOW_PROP. We do not update boundingArea accordingly;
        // we want the boundingArea to still appear as original rect despite text appearing outside this area.
        if (glyphs.supportOverflow) ({ glyphs } = this._processAnchoredGrid(glyphs, origin));

        const hasEmptyBackground = this._fillChar === EMPTY_CHAR;
        const innerArea = boundingArea.innerArea();
        const handles = this._buildHandleCollection(boundingArea, cell => {
            if (textLayout.includesCell(cell)) return true;
            if (innerArea && innerArea.includesCell(cell) && hasEmptyBackground) return false;
            return boundingArea.includesCell(cell);
        }, cell => {
            return textLayout.includesCell(cell, false)
        })

        const bufferArea = boundingArea.outerArea(LINE_PATHING_BUFFER);

        this._cache = { boundingArea, origin, glyphs, textLayout, handles, bufferArea }
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

    // ------------------------------------------------------ Text

    get canHaveText() {
        return true;
    }

    get textPadding() {
        // Add 1 for rect's natural outline
        return this.props[TEXT_PADDING_PROP] + 1;
    }

    _buildTextLayout(cellArea) {
        return new TextLayout(
            this.props[TEXT_PROP],
            cellArea,
            {
                alignH: this.props[TEXT_ALIGN_H_PROP],
                alignV: this.props[TEXT_ALIGN_V_PROP],
                paddingH: this.textPadding,
                paddingV: this.textPadding,
                showOverflow: this.props[TEXT_OVERFLOW_PROP],
                autoWidth: false,
                autoHeight: false
            }
        );
    }

    _applyTextLayout(boundingArea, textLayout, glyphs) {
        textLayout.charGrid.forEachCell((char, rowIndex, colIndex) => {
            if (char !== undefined) {
                const cell = new Cell(rowIndex, colIndex).changeRelativeOrigin(
                    textLayout.textArea.topLeft,
                    boundingArea.topLeft
                );
                this._setGlyph(glyphs, cell, char, this.props[COLOR_PROP])
            }
        })
    }

}

registerShape(SHAPE_TYPES.RECT, Rect);