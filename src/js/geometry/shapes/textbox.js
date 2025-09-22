import BoxShape from "./box_shape.js";
import {
    COLOR_PROP, SHAPE_TYPES, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP,
    TEXT_ALIGN_V_OPTS, TEXT_ALIGN_V_PROP, TEXT_OVERFLOW_PROP, TEXT_PADDING_PROP, TEXT_PROP
} from "./constants.js";
import TextLayout from "./text_layout.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import CellArea from "../cell_area.js";
import {registerShape} from "./registry.js";
import {isEmptyOrWhitespace} from "../../utils/strings.js";

export default class Textbox extends BoxShape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: TEXT_PROP, default: "" },
        { prop: TEXT_ALIGN_V_PROP, default: TEXT_ALIGN_V_OPTS.MIDDLE },
        { prop: TEXT_ALIGN_H_PROP, default: TEXT_ALIGN_H_OPTS.CENTER },
        { prop: TEXT_PADDING_PROP, default: 0 },
        { prop: TEXT_OVERFLOW_PROP, default: false }
    ];

    // When finished editing text, if there is no text the textbox will be deleted
    deleteOnTextFinished() {
        return isEmptyOrWhitespace(this.props[TEXT_PROP] || "")
    }

    showSelectionOnInitialDraw() {
        return true;
    }

    _cacheGeometry() {
        const boundingArea = CellArea.fromOriginAndDimensions(this.props.topLeft, this.props.numRows, this.props.numCols);
        const glyphs = this._initGlyphs(boundingArea);
        const textLayout = this._buildTextLayout(boundingArea);

        this._applyFill(boundingArea, glyphs);
        this._applyTextLayout(textLayout, glyphs);

        const hasEmptyBackground = this._fillChar === EMPTY_CHAR;
        const handles = this._buildHandleCollection(boundingArea, cell => {
            if (textLayout.includesCell(cell)) return true;
            return !hasEmptyBackground && boundingArea.includesCell(cell);
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

    _applyFill(boundingArea, glyphs) {
        const fillChar = this._fillChar;
        const colorIndex = this.props[COLOR_PROP];
        boundingArea.iterateRelative((row, col) => {
            this._setGlyph(glyphs, { row, col }, fillChar, colorIndex);
        })
    }


    // ------------------------------------------------------ Text

    get canHaveText() {
        return true;
    }

    get textPadding() {
        return this.props[TEXT_PADDING_PROP];
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
                showOverflow: this.props[TEXT_OVERFLOW_PROP]
            }
        );
    }

    _applyTextLayout(textLayout, glyphs) {
        textLayout.grid.forEach((row, rowIndex) => {
            row.forEach((char, colIndex) => {
                if (char !== EMPTY_CHAR) {
                    // Text layout might go beyond bounds if showOverflow:true, so support adding new rows
                    if (!glyphs.chars[rowIndex]) {
                        glyphs.chars[rowIndex] = [];
                        glyphs.colors[rowIndex] = [];
                    }

                    this._setGlyph(glyphs, { row: rowIndex, col: colIndex }, char, this.props[COLOR_PROP])
                }
            })
        })
    }

}

registerShape(SHAPE_TYPES.TEXTBOX, Textbox);
