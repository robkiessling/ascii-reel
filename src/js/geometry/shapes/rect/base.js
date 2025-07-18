import Shape from "../shape.js";
import Cell from "../../cell.js";
import {create2dArray} from "../../../utils/arrays.js";
import {isFunction} from "../../../utils/utilities.js";
import {HANDLES} from "../constants.js";
import CellArea from "../../cell_area.js";


/**
 * Characters used to draw the different types of ascii rectangles. A rectangle is made up of 4 corners (TOP_LEFT,
 * TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT), 2 HORIZONTAL lines, and 2 VERTICAL lines.
 */
const STROKE_CHARS = {
    'ascii-1': {
        TOP_LEFT: '/',
        TOP_RIGHT: '\\',
        BOTTOM_LEFT: '\\',
        BOTTOM_RIGHT: '/',
        HORIZONTAL: '-',
        VERTICAL: '|'
    },
    'ascii-2': {
        TOP_LEFT: '+',
        TOP_RIGHT: '+',
        BOTTOM_LEFT: '+',
        BOTTOM_RIGHT: '+',
        HORIZONTAL: '-',
        VERTICAL: '|'
    },
    'unicode-1': {
        TOP_LEFT: '┌',
        TOP_RIGHT: '┐',
        BOTTOM_LEFT: '└',
        BOTTOM_RIGHT: '┘',
        HORIZONTAL: '─',
        VERTICAL: '│'
    },
    'unicode-2': {
        TOP_LEFT: '╔',
        TOP_RIGHT: '╗',
        BOTTOM_LEFT: '╚',
        BOTTOM_RIGHT: '╝',
        HORIZONTAL: '═',
        VERTICAL: '║'
    },
    'monochar': char => {
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

export default class BaseRect extends Shape {

    static beginRect(startCell, options) {
        const props = {
            topLeft: startCell,
            numRows: 1,
            numCols: 1,
            strokeStyle: 'monochar',
            strokeColor: options.colorIndex,
            strokeChar: options.char,
            fillStyle: 'none',
            fillColor: options.colorIndex,
            fillChar: options.char
        };

        switch (options.drawPreset) { // todo drawType could be "drawPreset"?
            case 'outline-ascii-1':
                props.strokeStyle = 'ascii-1';
                break;
            case 'outline-ascii-2':
                props.strokeStyle = 'ascii-2';
                break;
            case 'outline-unicode-1':
                props.strokeStyle = 'unicode-1';
                break;
            case 'outline-unicode-2':
                props.strokeStyle = 'unicode-2';
                break;
            case 'outline-monochar':
                break;
            case 'filled-monochar':
                props.fillStyle = 'monochar';
                break;
            default:
                console.warn(`No Rect drawing found for: ${options.drawType}`);
        }

        return new BaseRect(undefined, 'rect', props);
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

        let anchor; // anchor is the corner of the rectangle that is not moving (it is opposite of the handle)
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
                // todo
                // anchor1.row = position.row;
                break;
            case HANDLES.LEFT_EDGE:
                // anchor1.col = position.col;
                break;
            case HANDLES.RIGHT_EDGE:
                // anchor2.col = position.col;
                break;
            case HANDLES.BOTTOM_EDGE:
                // anchor2.row = position.row;
                break;
            default:
                throw new Error(`Invalid handle: ${handle}`);
        }

        // Handles positioned on the bottom or right edges are conceptually attached to the *next* row/column
        // (i.e. one cell past the handle corner). For example, the bottom-right handle is located at [row+1, col+1].
        // To get the correct handle cell for the rectangle during resizing, we subtract [1,0] or [0,1] accordingly.
        if (!options.fullCellHandle) {
            position = position.clone();
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

        let strokeChars = STROKE_CHARS[state.strokeStyle];
        if (isFunction(strokeChars)) strokeChars = strokeChars(state.strokeChar);

        const lastRow = state.numRows - 1;
        const lastCol = state.numCols - 1;

        boundingArea.iterateRelative((row, col) => {
            let char;
            let colorIndex = state.strokeColor;

            if (col === 0) {
                if (row === 0) { char = strokeChars.TOP_LEFT; }
                else if (row === lastRow) { char = strokeChars.BOTTOM_LEFT; }
                else { char = strokeChars.VERTICAL; }
            }
            else if (col === lastCol) {
                if (row === 0) { char = strokeChars.TOP_RIGHT; }
                else if (row === lastRow) { char = strokeChars.BOTTOM_RIGHT; }
                else { char = strokeChars.VERTICAL; }
            }
            else {
                if (row === 0) { char = strokeChars.HORIZONTAL; }
                else if (row === lastRow) { char = strokeChars.HORIZONTAL; }
                else if (state.fillStyle === 'monochar') {
                    char = state.fillChar;
                    colorIndex = state.fillColor
                }
            }

            if (char !== undefined) this._setGlyph(glyphs, {row, col}, char, colorIndex);
        });

        const hitbox = cell => {
            if (innerArea && innerArea.doesCellOverlap(cell) && this.props.fillStyle === 'none') return false;
            return boundingArea.doesCellOverlap(cell);
        };

        this._cache = {
            boundingArea: boundingArea,
            origin: state.topLeft,
            glyphs: glyphs,
            hitbox: hitbox
        }
    }



}