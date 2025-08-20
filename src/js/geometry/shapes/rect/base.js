import Shape from "../shape.js";
import Cell from "../../cell.js";
import {isFunction} from "../../../utils/utilities.js";
import {
    CHAR_PROP, COLOR_PROP, HANDLES, SHAPES,
    STYLE_PROPS, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP, TEXT_ALIGN_V_OPTS, TEXT_ALIGN_V_PROP, TEXT_PROP
} from "../constants.js";
import CellArea from "../../cell_area.js";
import TextLayout from "../text_layout.js";
import {EMPTY_CHAR} from "../../../config/chars.js";


/**
 * Characters used to draw the different types of ascii rectangles. A rectangle is made up of 4 corners (TOP_LEFT,
 * TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT), 2 HORIZONTAL lines, 2 VERTICAL lines, and an optional FILL.
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
    },
    'filled-monochar': char => {
        return {
            TOP_LEFT: char,
            TOP_RIGHT: char,
            BOTTOM_LEFT: char,
            BOTTOM_RIGHT: char,
            HORIZONTAL: char,
            VERTICAL: char,
            FILL: char,
        }
    }
}

export default class BaseRect extends Shape {

    static beginRect(startCell, options) {
        const props = {
            topLeft: startCell,
            numRows: 1,
            numCols: 1,
            [STYLE_PROPS[SHAPES.RECT]]: options.drawPreset,
            [CHAR_PROP]: options.char,
            [COLOR_PROP]: options.colorIndex,
            [TEXT_PROP]: " Hello World\nI am Merlin, lord of magicke, and I shall rule these lands",
            [TEXT_ALIGN_V_PROP]: TEXT_ALIGN_V_OPTS.TOP,
            [TEXT_ALIGN_H_PROP]: TEXT_ALIGN_H_OPTS.LEFT,
            textPadding: 0
        };

        return new BaseRect(undefined, SHAPES.RECT, props);
    }

    serializeProps() {
        const result = structuredClone(this.props);
        result.topLeft = this.props.topLeft.serialize()
        return result;
    }

    static deserializeProps(props) {
        const result = structuredClone(props);
        result.topLeft = Cell.deserialize(result.topLeft);
        return result;
    }

    /**
     *
     * @param handle
     * @param position - New position of the dragged handle
     * @param {Object} options - resize options
     * @param {boolean} [options.fullCellHandle=false] - If true, the position will be treated as a cell. If false,
     *   position will be offset according to which corner of the cell the handle is in.
     */
    resize(handle, position, options = {}) {
        const snapshot = this.resizeSnapshot;
        if (handle === undefined) handle = HANDLES.BOTTOM_RIGHT_CORNER;
        position = position.clone();

        let anchor; // anchor is the corner/edge of the rectangle that is not moving (it is opposite of the handle)
        switch(handle) {
            case HANDLES.TOP_LEFT_CORNER:
                anchor = snapshot.topLeft.clone().translate(snapshot.numRows - 1, snapshot.numCols - 1); // anchor is bottom-right
                break;
            case HANDLES.TOP_RIGHT_CORNER:
                anchor = snapshot.topLeft.clone().translate(snapshot.numRows - 1, 0); // anchor is bottom-left
                break;
            case HANDLES.BOTTOM_LEFT_CORNER:
                anchor = snapshot.topLeft.clone().translate(0, snapshot.numCols - 1); // anchor is top-right
                break;
            case HANDLES.BOTTOM_RIGHT_CORNER:
                anchor = snapshot.topLeft.clone(); // anchor is top-left
                break;
            case HANDLES.TOP_EDGE:
                anchor = snapshot.topLeft.clone().translate(snapshot.numRows - 1, 0); // anchor is bottom-left
                
                // Lock the position's col to the right edge. This way, since anchor is on bottom-left and position
                // is locked to right, the rect width stays the same. Note that we do not subtract 1; we actually
                // want the col to be 1 space *outside* the rect, since the cells for the right edge are 1 space
                // outside and to the right of the rect.
                position.col = snapshot.topLeft.col + snapshot.numCols; // lock position's col to right edge
                break;
            case HANDLES.LEFT_EDGE:
                anchor = snapshot.topLeft.clone().translate(0, snapshot.numCols - 1); // anchor is top-right
                position.row = snapshot.topLeft.row + snapshot.numRows; // lock position's row to bottom edge
                break;
            case HANDLES.RIGHT_EDGE:
                anchor = snapshot.topLeft.clone(); // anchor is top-left
                position.row = snapshot.topLeft.row + snapshot.numRows; // lock position's row to bottom edge
                break;
            case HANDLES.BOTTOM_EDGE:
                anchor = snapshot.topLeft.clone(); // anchor is top-left
                position.col = snapshot.topLeft.col + snapshot.numCols; // lock position's col to right edge
                break;
            default:
                throw new Error(`Invalid handle: ${handle}`);
        }

        // Handles positioned on the bottom or right edges are conceptually attached to the *next* row/column
        // (i.e. one cell past the handle corner). For example, the bottom-right handle is located at [row+1, col+1].
        // To get the correct handle cell for the rectangle during resizing, we subtract [1,0] or [0,1] accordingly.
        if (!options.fullCellHandle) {
            if (position.row > anchor.row) position.translate(-1, 0);
            if (position.col > anchor.col) position.translate(0, -1);
        }

        const topLeft = new Cell(Math.min(anchor.row, position.row), Math.min(anchor.col, position.col));
        const bottomRight = new Cell(Math.max(anchor.row, position.row), Math.max(anchor.col, position.col));

        this.props.topLeft = topLeft;
        this.props.numRows = bottomRight.row - topLeft.row + 1;
        this.props.numCols = bottomRight.col - topLeft.col + 1;

        this._clearCache();
    }

    resizeInGroup(oldGroupBox, newGroupBox) {
        const snapshot = this.resizeSnapshot;

        let relX = (snapshot.topLeft.col - oldGroupBox.topLeft.col) / oldGroupBox.numCols;
        let relY = (snapshot.topLeft.row - oldGroupBox.topLeft.row) / oldGroupBox.numRows;
        const relW = snapshot.numCols / oldGroupBox.numCols;
        const relH = snapshot.numRows / oldGroupBox.numRows;

        // When dragging a corner handle past its opposite corner anchor, the group must be inverted
        const invertRows = newGroupBox.topLeft.row < oldGroupBox.topLeft.row;
        const invertCols = newGroupBox.topLeft.col < oldGroupBox.topLeft.col;
        if (invertRows) relY = (1 - relY) - relH;
        if (invertCols) relX = (1 - relX) - relW;

        let newCol = Math.round(newGroupBox.topLeft.col + newGroupBox.numCols * relX);
        let newRow = Math.round(newGroupBox.topLeft.row + newGroupBox.numRows * relY);
        const newNumCols = Math.max(1, Math.round(newGroupBox.numCols * relW));
        const newNumRows = Math.max(1, Math.round(newGroupBox.numRows * relH));

        this.props.topLeft = new Cell(newRow, newCol);
        this.props.numRows = newNumRows;
        this.props.numCols = newNumCols;

        this._clearCache();
    }

    _cacheGeometry() {
        const state = this.props;

        const boundingArea = CellArea.fromOriginAndDimensions(state.topLeft, state.numRows, state.numCols);
        const innerArea = boundingArea.innerArea();

        const glyphs = this._initGlyphs(state.numRows, state.numCols);

        let charSheet = CHAR_SHEETS[state[STYLE_PROPS[SHAPES.RECT]]];
        if (isFunction(charSheet)) charSheet = charSheet(state[CHAR_PROP]);

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
                else if (charSheet.FILL) { char = charSheet.FILL; }
            }

            if (char !== undefined) this._setGlyph(glyphs, {row, col}, char, colorIndex);
        });

        const textLayout = this._applyTextLayout(glyphs, boundingArea);

        const hitbox = cell => {
            if (textLayout && textLayout.doesCellOverlap(cell)) return true;
            if (innerArea && innerArea.doesCellOverlap(cell) && !charSheet.FILL) return false;
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