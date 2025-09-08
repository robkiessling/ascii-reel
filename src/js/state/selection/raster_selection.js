import {deserializeSelectionShape} from "../../geometry/selection/deserialize.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import {getCurrentCelGlyph, setCurrentCelGlyph} from "../timeline/index.js";
import {create2dArray, translateGlyphs} from "../../utils/arrays.js";
import Cell from "../../geometry/cell.js";
import CellArea from "../../geometry/cell_area.js";
import SelectionRect from "../../geometry/selection/rect.js";
import SelectionText from "../../geometry/selection/text.js";
import SelectionWand from "../../geometry/selection/wand.js";
import {getConfig} from "../config.js";
import {mirrorCharHorizontally, mirrorCharVertically} from "../../utils/strings.js";


const DEFAULT_STATE = {
    selectionShapes: [],
    movableContent: null,
    caretPosition: {}
}

let state = {};

export function deserialize(data = {}, options = {}) {
    const newSelectionShapes = (data.selectionShapes || []).map(shape => deserializeSelectionShape(shape));

    if (options.replace) {
        state = {
            ...data,
            selectionShapes: newSelectionShapes
        }
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, { ...data, selectionShapes: newSelectionShapes });
}

export function serialize(options = {}) {
    return {
        ...state,
        selectionShapes: state.selectionShapes.map(shape => shape.serialize())
    }
}

export function selectionShapes() {
    return state.selectionShapes;
}

export function addSelectionShape(shape) {
    state.selectionShapes.push(shape)
}

export function hasSelection() {
    return state.selectionShapes.some(shape => shape.hasArea);
}

export function hasTarget() {
    return state.selectionShapes.length > 0;
}

export function clear() {
    state.selectionShapes = [];
}

// Empties the selection's contents. Does not clear the selection.
export function empty() {
    getSelectedCells().forEach(cell => {
        setCurrentCelGlyph(cell.row, cell.col, EMPTY_CHAR, 0);
    });
}

// Select entire canvas
export function selectAll() {
    state.selectionShapes = [SelectionRect.drawableArea()];
}


// -------------------------------------------------------------------------------- Selection Results

/**
 * Returns an object representing the smallest CellArea that bounds all polygons. The object contains a 2d array of its
 * chars and a 2d array of its colors. Gaps within the polygon(s) will be represented by undefined values.
 *
 * E.g. If the polygons (depicted by x's) were this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *      {
 *          chars: [
 *              ['x', 'x', undefined, undefined, undefined],
 *              ['x', 'x', undefined, undefined, 'x']
 *          ],
 *          colors: [
 *             [0, 0, undefined, undefined, undefined],
 *             [0, 0, undefined, undefined, 0]
 *          ]
 *      }
 */
export function getSelectedValues() {
    if (!hasSelection()) return [[]];
    if (state.movableContent) return state.movableContent;

    // Start with 2d arrays of undefined elements
    const cellArea = getSelectedCellArea();
    let chars = create2dArray(cellArea.numRows, cellArea.numCols);
    let colors = create2dArray(cellArea.numRows, cellArea.numCols);

    state.selectionShapes.forEach(shape => {
        shape.iterateCells((r, c) => {
            const [char, color] = getCurrentCelGlyph(r, c);
            chars[r - cellArea.topLeft.row][c - cellArea.topLeft.col] = char;
            colors[r - cellArea.topLeft.row][c - cellArea.topLeft.col] = color;
        });
    });

    return {
        chars: chars,
        colors: colors
    };
}


/**
 * Returns the smallest possible CellArea that includes all polygons.
 *
 * E.g. If the polygons (depicted by x's) were this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *
 *        CellArea{ topLeft: {row:1,col:2}, bottomRight: {row:2,col:6} }
 *
 */
export function getSelectedCellArea() {
    if (!hasSelection()) return null;

    const topLeft = new Cell();
    const bottomRight = new Cell();

    for (const shape of Object.values(state.selectionShapes)) {
        if (!shape.topLeft || !shape.bottomRight) { continue; } // E.g. lasso that has not yet completed
        if (topLeft.row === undefined || shape.topLeft.row < topLeft.row) { topLeft.row = shape.topLeft.row; }
        if (topLeft.col === undefined || shape.topLeft.col < topLeft.col) { topLeft.col = shape.topLeft.col; }
        if (bottomRight.row === undefined || shape.bottomRight.row > bottomRight.row) { bottomRight.row = shape.bottomRight.row; }
        if (bottomRight.col === undefined || shape.bottomRight.col > bottomRight.col) { bottomRight.col = shape.bottomRight.col; }
    }

    if (topLeft.row === undefined) { return null; }

    return new CellArea(topLeft, bottomRight);
}

export function getSelectedRect() {
    if (!hasSelection()) return null;

    const cellArea = getSelectedCellArea();
    return new SelectionRect(cellArea.topLeft, cellArea.bottomRight);
}

/**
 * Returns a 1d array of Cell-like objects for all selected cells. The Cell-like objects have row and column attributes
 * like regular Cells, but none of the other methods. This function does not return full Cell objects to reduce memory cost.
 *
 * E.g. If the polygons (depicted by x's) were this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *
 *        [{row:1,col:2}, {row:1,col:3}, {row:2,col:2}, {row:2,col:3}, {row:2,col:6}]
 */
export function getSelectedCells() {
    const result = [];
    state.selectionShapes.forEach(shape => {
        shape.iterateCells((r, c) => {
            // Note: Not making a full Cell object for performance reasons. We don't need the other attributes of a Cell
            result.push({ row: r, col: c });
        });
    });
    return result;
}


/**
 * Returns all Cells adjacent to (and sharing the same color as) the targeted Cell
 */
export function getConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return []; }

    const wand = new SelectionWand(cell, undefined, options);
    wand.complete();
    return wand.cells;
}



// -------------------------------------------------------------------------------- Moving Content

export function getMovableContent() {
    return state.movableContent;
}

export function startMovingContent() {
    state.movableContent = getSelectedValues();
    empty();
}

export function finishMovingContent() {
    translateGlyphs(state.movableContent, getSelectedCellArea().topLeft, (r, c, char, color) => {
        // Moving empty cells does not override existing cells
        if (char === EMPTY_CHAR) return;

        setCurrentCelGlyph(r, c, char, color);
    });

    state.movableContent = null;
}

export function updateMovableContent(char, color) {
    function _update2dArray(array, value) {
        let r, c;

        for (r = 0; r < array.length; r++) {
            for (c = 0; c < array[r].length; c++) {
                if (array[r][c] !== undefined) {
                    array[r][c] = value;
                }
            }
        }
    }

    _update2dArray(state.movableContent.chars, char);
    _update2dArray(state.movableContent.colors, color);
}

// -------------------------------------------------------------------------------- Caret

export function getCaretPosition() {
    return Cell.deserialize(state.caretPosition);
}

// We show a blinking caret if using the text-editor tool and a single 1x1 square is selected
export function caretCell() {
    if (getConfig('tool') !== 'text-editor') return null;
    if (state.movableContent) return null;

    if (getConfig('caretStyle') === 'I-beam') {
        if (!hasTarget()) return null;
        if (hasSelection()) return null;
        return state.selectionShapes[0].topLeft;
    } else {
        if (!hasSelection()) return null;
        if (!state.selectionShapes[0].topLeft.equals(state.selectionShapes[0].bottomRight)) return null;
        return state.selectionShapes[0].topLeft;
    }
}

export function moveCaretTo(cell) {
    if (getConfig('caretStyle') === 'I-beam') {
        state.selectionShapes = [new SelectionText(cell)]
    } else {
        state.selectionShapes = [new SelectionRect(cell)];
    }

    state.caretPosition = cell.serialize();
}


// -------------------------------------------------------------------------------- Translating shapes

// todo rename translateSelection
export function moveDelta(rowDelta, colDelta, moveStart, moveEnd) {
    state.selectionShapes.forEach(shape => shape.translate(rowDelta, colDelta, moveStart, moveEnd));
}

export function moveInDirection(direction, amount = 1) {
    switch(direction) {
        case 'left':
            moveDelta(0, -amount);
            break;
        case 'up':
            moveDelta(-amount, 0);
            break;
        case 'right':
            moveDelta(0, amount);
            break;
        case 'down':
            moveDelta(amount, 0);
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }
}

export function extendInDirection(direction, amount = 1) {
    switch(direction) {
        case 'left':
            moveDelta(0, -amount, false, true);
            break;
        case 'up':
            moveDelta(-amount, 0, false, true);
            break;
        case 'right':
            moveDelta(0, amount, false, true);
            break;
        case 'down':
            moveDelta(amount, 0, false, true);
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }
}


export function flipSelection(horizontally, vertically, mirrorChars) {
    const cellArea = getSelectedCellArea();
    const updates = []; // Have to batch the updates, and do them all at end (i.e. do not modify chars while iterating)

    function flipRow(oldRow) {
        return (cellArea.topLeft.row + cellArea.bottomRight.row) - oldRow;
    }
    function flipCol(oldCol) {
        return (cellArea.topLeft.col + cellArea.bottomRight.col) - oldCol;
    }

    getSelectedCells().forEach(cell => {
        let [char, color] = getCurrentCelGlyph(cell.row, cell.col);
        if (mirrorChars && horizontally) { char = mirrorCharHorizontally(char); }
        if (mirrorChars && vertically) { char = mirrorCharVertically(char); }
        updates.push({
            row: vertically ? flipRow(cell.row) : cell.row,
            col: horizontally ? flipCol(cell.col) : cell.col,
            char: char,
            color: color
        });
        setCurrentCelGlyph(cell.row, cell.col, EMPTY_CHAR, 0);
    });

    updates.forEach(update => {
        setCurrentCelGlyph(update.row, update.col, update.char, update.color);
    })

    state.selectionShapes.forEach(shape => {
        if (vertically) { shape.flipVertically(flipRow); }
        if (horizontally) { shape.flipHorizontally(flipCol); }
    });
}






