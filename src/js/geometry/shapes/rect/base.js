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

    resize(handle, position, mods) {
        if (handle === undefined) handle = HANDLES.BOTTOM_RIGHT_CORNER;

        let anchor1 = this.props.topLeft.clone();
        let anchor2 = this.props.topLeft.clone().translate(this.props.numRows - 1, this.props.numCols - 1);

        switch(handle) {
            case HANDLES.TOP_LEFT_CORNER:
                anchor1.row = position.row;
                anchor1.col = position.col;
                break;
            case HANDLES.TOP_RIGHT_CORNER:
                anchor1.row = position.row;
                anchor2.col = position.col;
                break;
            case HANDLES.BOTTOM_LEFT_CORNER:
                anchor1.col = position.col;
                anchor2.row = position.row;
                break;
            case HANDLES.BOTTOM_RIGHT_CORNER:
                anchor2.row = position.row;
                anchor2.col = position.col;
                break;

            case HANDLES.TOP_EDGE:
                anchor1.row = position.row;
                break;
            case HANDLES.LEFT_EDGE:
                anchor1.col = position.col;
                break;
            case HANDLES.RIGHT_EDGE:
                anchor2.col = position.col;
                break;
            case HANDLES.BOTTOM_EDGE:
                anchor2.row = position.row;
                break;
            default:
                throw new Error(`Invalid handle: ${handle}`);
        }

        const topLeft = new Cell(Math.min(anchor1.row, anchor2.row), Math.min(anchor1.col, anchor2.col));
        const bottomRight = new Cell(Math.max(anchor1.row, anchor2.row), Math.max(anchor1.col, anchor2.col));

        // Need to use a draft because we need the original topLeft until resize is done
        this.draft = {
            topLeft: topLeft,
            numRows: bottomRight.row - topLeft.row + 1,
            numCols: bottomRight.col - topLeft.col + 1,
        }

        this._clearCache();
    }

    _cacheGeometry() {
        const state = this.appliedDraft();

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