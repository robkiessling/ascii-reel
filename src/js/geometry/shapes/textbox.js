import BoxShape from "./box_shape.js";
import {
    AUTO_TEXT_WIDTH_PROP,
    COLOR_PROP, FILL_OPTIONS, FILL_PROP, LINE_PATHING_BUFFER, SHAPE_TYPES, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP,
    TEXT_ALIGN_V_PROP, TEXT_PADDING_PROP, TEXT_PROP
} from "../../config/shapes.js";
import TextLayout from "./text_layout.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import CellArea from "../cell_area.js";
import {registerShape} from "./registry.js";
import {isEmptyOrWhitespace} from "../../utils/strings.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";

export default class Textbox extends BoxShape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: FILL_PROP, default: FILL_OPTIONS.EMPTY },
        { prop: TEXT_PROP, default: "" },
        { prop: TEXT_ALIGN_H_PROP, default: TEXT_ALIGN_H_OPTS.LEFT }, // Textbox only has horizontal alignment
        { prop: TEXT_PADDING_PROP, default: 0 },
        { prop: AUTO_TEXT_WIDTH_PROP, default: true },
    ];

    shouldDeleteAfterTextEdit() {
        // When finished editing text, if there is no text the textbox will be deleted
        return isEmptyOrWhitespace(this.props[TEXT_PROP] || "")
    }

    shouldShowBoundariesDuringDraw() {
        return true;
    }

    beginResize() {
        super.beginResize();

        // Resizing should disable auto-width
        this.updateProp(AUTO_TEXT_WIDTH_PROP, false);
    }

    resize(oldBox, newBox) {
        const snapshot = this.resizeSnapshot;

        const oldArea = CellArea.fromOriginAndDimensions(snapshot.topLeft, snapshot.numRows, snapshot.numCols);
        const newArea = translateAreaWithBoxResizing(oldArea, oldBox, newBox).area;

        // Similar to normal BoxShape resize, but we never allow rows to change (rows are determined from text)
        const newTopLeft = newArea.topLeft.clone();
        newTopLeft.row = snapshot.topLeft.row;
        this.props.topLeft = newTopLeft;
        this.props.numRows = snapshot.numRows;
        this.props.numCols = newArea.numCols;
        this._clearCache();
    }

    _convertInitialDrawToProps() {
        // Restrict initial draw to always be a single row
        this._initialDraw.hover.row = this._initialDraw.anchor.row;
        super._convertInitialDrawToProps();
    }

    finishDraw() {
        // If textbox is just a single cell, make it auto-width. Otherwise, use a static width.
        this.props[AUTO_TEXT_WIDTH_PROP] = this.props.numRows <= 1 && this.props.numCols <= 1;
        this._clearCache();

        super.finishDraw();
    }

    _cacheGeometry() {
        let origin = this.props.topLeft;
        let boundingArea = CellArea.fromOriginAndDimensions(origin, this.props.numRows, this.props.numCols);

        // During initial draw, just treat it as a normal rectangular shape
        if (this.isPerformingInitialDraw) {
            this._cache = { boundingArea, origin, glyphs: this._initGlyphs(boundingArea) }
            return;
        }

        // If not in the initial draw, dimensions are determined from text layout
        const textLayout = this._buildTextLayout(boundingArea);
        boundingArea = textLayout.textArea; // textArea might expand/translate the boundingArea!

        const glyphs = this._initGlyphs(boundingArea);
        this._applyTextLayout(textLayout, glyphs)

        // When using auto-width, origin might change again depending on text alignment. For example, when right-aligned,
        // we need to shift the origin leftward as the textbox grows.
        if (this.props[AUTO_TEXT_WIDTH_PROP]) {
            ({origin, boundingArea} = this._applyAutoWidth(origin, boundingArea, textLayout));
        }

        this._applyFill(boundingArea, glyphs);

        const hasEmptyBackground = this._fillChar === EMPTY_CHAR;
        const handles = this._buildHandleCollection(boundingArea, cell => {
            if (textLayout.includesCell(cell)) return true;
            return !hasEmptyBackground && boundingArea.includesCell(cell);
        }, cell => {
            return textLayout.includesCell(cell, false)
        })

        const bufferArea = boundingArea.outerArea(LINE_PATHING_BUFFER);

        this._cache = {
            boundingArea,
            origin,
            glyphs,
            textLayout,
            handles,
            bufferArea
        }
    }

    _applyFill(boundingArea, glyphs) {
        const fillChar = this._fillChar;
        const colorIndex = this.props[COLOR_PROP];
        boundingArea.iterateRelative((row, col) => {
            if (glyphs.chars[row][col] === undefined) {
                this._setGlyph(glyphs, { row, col }, fillChar, colorIndex);
            }
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
                showOverflow: false, // should be irrelevant since autoHeight is enabled
                autoWidth: this.props[AUTO_TEXT_WIDTH_PROP],
                autoHeight: true
            }
        );
    }

    _applyTextLayout(textLayout, glyphs) {
        textLayout.charGrid.forEachCell((char, rowIndex, colIndex) => {
            if (char !== undefined) {
                // No need to changeRelativeOrigin like in rect.js; textbox exactly matches textLayout's area
                this._setGlyph(glyphs, { row: rowIndex, col: colIndex }, char, this.props[COLOR_PROP])
            }
        })
    }

    /**
     * When auto-width is enabled, typing may increase the textbox width. To preserve the intended alignment (e.g.
     * right-aligned text expanding leftward), we need to adjust the origin accordingly.
     */
    _applyAutoWidth(origin, boundingArea, textLayout) {
        // In this switch block:
        // - `this.props.numCols` is the textbox's current (old) width
        // - `boundingArea.numCols` is the textbox's new width after layout changes
        let colOffset;
        switch(this.props[TEXT_ALIGN_H_PROP]) {
            case TEXT_ALIGN_H_OPTS.LEFT:
                // Left aligned: the textbox expands/shrinks to the right; origin doesn't have to move.
                colOffset = 0;
                break;
            case TEXT_ALIGN_H_OPTS.CENTER:
                // Center-aligned: keep the textbox centered around its midpoint. A width change means shifting the
                // origin left or right by half the change.  We vary the rounding direction to maintain symmetry.
                colOffset = (this.props.numCols - boundingArea.numCols) / 2;
                colOffset = this.props.numCols % 2 === 0 ? Math.floor(colOffset) : Math.ceil(colOffset);
                break;
            case TEXT_ALIGN_H_OPTS.RIGHT:
                // Right-aligned: maintain the right edge of the textbox in place; if the width increases, shift the
                // origin to the left that amount.
                colOffset = this.props.numCols - boundingArea.numCols
                break;
            default:
                throw new Error(`Invalid text alignment: ${this.props[TEXT_ALIGN_H_PROP]}`)
        }
        const newTopLeft = origin.clone().translate(0, colOffset);

        // The new bounding area is the same size as before, but at a potentially new origin
        const newBoundingArea = CellArea.fromOriginAndDimensions(newTopLeft, boundingArea.numRows, boundingArea.numCols)

        // Apply the new layout to shape props and textLayout
        this.props.numRows = newBoundingArea.numRows;
        this.props.numCols = newBoundingArea.numCols;
        this.props.topLeft = newBoundingArea.topLeft;
        textLayout.textArea = newBoundingArea;

        return {
            origin: newTopLeft,
            boundingArea: newBoundingArea
        }
    }

}

registerShape(SHAPE_TYPES.TEXTBOX, Textbox); // Note: File also has to be manually imported in index.js