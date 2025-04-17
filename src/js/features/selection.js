import * as state from "../state/index.js";
import * as tools from "./tools.js";
import * as actions from "../io/actions.js";
import {shouldModifyAction} from "../io/actions.js";
import Cell from "../geometry/cell.js";
import CellArea from "../geometry/cell_area.js";
import SelectionRect from "../geometry/selection/selection_rect.js";
import SelectionWand from "../geometry/selection/selection_wand.js";
import SelectionLine from "../geometry/selection/selection_line.js";
import SelectionLasso from "../geometry/selection/selection_lasso.js";
import {create2dArray, translateGlyphs} from "../utils/arrays.js";
import {mirrorCharHorizontally, mirrorCharVertically} from "../utils/strings.js";
import {eventBus, EVENTS} from "../events/events.js";
import {EMPTY_CHAR} from "../config/chars.js";


// -------------------------------------------------------------------------------- Main API

export let polygons = [];
export let isDrawing = false; // Only true when mouse is down and polygon is being drawn
export let isMoving = false; // Only true when mouse is down and polygon is being moved
export let movableContent = null; // Selected glyph content IF there is any (it will be surrounded by dashed outline)

export function init() {
    actions.registerAction('selection.select-all', () => selectAll());

    setupEventBus();

    clearCaches();
}

// Returns true if there is any area selected
export function hasSelection() {
    return polygons.length > 0;
}

export function clear(refresh = true) {
    if (movableContent) { finishMovingContent(); }
    polygons = [];
    if (refresh) eventBus.emit(EVENTS.SELECTION.CHANGED);
}

// Empties the selection's contents. Does not clear the selection.
export function empty() {
    getSelectedCells().forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, EMPTY_CHAR, 0);
    });
}

// Select entire canvas
export function selectAll() {
    // selectAll is only used with a few tools; switch to selection-rect if not using one of those tools already
    if (!['text-editor', 'selection-rect'].includes(state.getConfig('tool'))) {
        tools.changeTool('text-editor');
    }

    polygons = [SelectionRect.drawableArea()];
    eventBus.emit(EVENTS.SELECTION.CHANGED);
}

// Returns true if the given Cell is part of the selection
export function isSelectedCell(cell) {
    cacheSelectedCells();
    return caches.selectedCells.has(cellKey(cell));
}

export function allowMovement(tool, mouseEvent) {
    if (isDrawing) return false;

    // In text-editor tool, holding shift and clicking will modify the polygon instead of move it
    if (tool === 'text-editor' && mouseEvent.shiftKey) return false;

    return true;
}

export function setSelectionToSingleChar(char, color, moveCursor = true) {
    if (movableContent) {
        // Update entire movable content
        updateMovableContent(char, color);
    }
    else if (cursorCell()) {
        // Update cursor cell and then move to next cell
        state.setCurrentCelGlyph(cursorCell().row, cursorCell().col, char, color);
        if (moveCursor) moveInDirection('right', { updateCursorOrigin: false });
    }
    else if (hasSelection()) {
        // Update entire selection
        getSelectedCells().forEach(cell => {
            state.setCurrentCelGlyph(cell.row, cell.col, char, color);
        });
    }
    else {
        return; // No modifications were made: do not trigger refresh
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'producesText' })
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
    if (!hasSelection()) {
        return [[]];
    }

    if (movableContent) {
        return movableContent;
    }

    // Start with 2d arrays of undefined elements
    const cellArea = getSelectedCellArea();
    let chars = create2dArray(cellArea.numRows, cellArea.numCols);
    let colors = create2dArray(cellArea.numRows, cellArea.numCols);

    polygons.forEach(polygon => {
        polygon.iterateCells((r, c) => {
            const [char, color] = state.getCurrentCelGlyph(r, c);
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
    if (!hasSelection()) {
        return null;
    }

    const topLeft = new Cell();
    const bottomRight = new Cell();
    
    for (const polygon of Object.values(polygons)) {
        if (!polygon.topLeft || !polygon.bottomRight) { continue; } // E.g. lasso that has not yet completed
        if (topLeft.row === undefined || polygon.topLeft.row < topLeft.row) { topLeft.row = polygon.topLeft.row; }
        if (topLeft.col === undefined || polygon.topLeft.col < topLeft.col) { topLeft.col = polygon.topLeft.col; }
        if (bottomRight.row === undefined || polygon.bottomRight.row > bottomRight.row) { bottomRight.row = polygon.bottomRight.row; }
        if (bottomRight.col === undefined || polygon.bottomRight.col > bottomRight.col) { bottomRight.col = polygon.bottomRight.col; }
    }

    if (topLeft.row === undefined) { return null; }

    return new CellArea(topLeft, bottomRight);
}

export function getSelectedRect() {
    if (!hasSelection()) {
        return null;
    }

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
    polygons.forEach(polygon => {
        polygon.iterateCells((r, c) => {
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



// -------------------------------------------------------------------------------- Events

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED], () => {
        clearCaches()
    }, 1) // Higher than default priority because this must happen before other callbacks

    // If we're in the middle of moving content and the user presses undo, it can be jarring. So we always finish the
    // current move and then undo it.
    eventBus.on(EVENTS.HISTORY.BEFORE_CHANGE, () => {
        if (movableContent) finishMovingContent()
    })

    let moveStep, hasMoved;

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl }) => {
        if (mouseEvent.which !== 1) return; // Only apply to left-click

        const tool = state.getConfig('tool')

        switch(tool) {
            case 'selection-rect':
            case 'selection-line':
            case 'selection-lasso':
            case 'selection-wand':
            case 'text-editor':
                break;
            default:
                return; // Ignore all other tools
        }

        state.endHistoryModification();

        // If user clicks on the selection, we begin the 'moving' process (moving the selection area).
        if (isSelectedCell(cell) && allowMovement(tool, mouseEvent)) {
            isMoving = true;
            moveStep = cell;
            hasMoved = false;

            if (mouseEvent.metaKey && !movableContent) {
                startMovingContent();
                return;
            }

            eventBus.emit(EVENTS.SELECTION.CHANGED);
            return;
        }

        // If user clicks anywhere on the canvas (without the multiple-select key down) we want to clear everything and start a new polygon
        if (!shouldModifyAction('tools.standard.selection.multiple', mouseEvent)) {
            clear();
        }

        if (cell.isInBounds()) {
            isDrawing = true;

            switch(tool) {
                case 'selection-rect':
                    polygons.push(new SelectionRect(cell, undefined, {
                        outline: shouldModifyAction('tools.standard.selection-rect.outline', mouseEvent)
                    }));
                    break;
                case 'selection-line':
                    polygons.push(new SelectionLine(cell));
                    break;
                case 'selection-lasso':
                    polygons.push(new SelectionLasso(cell));
                    break;
                case 'selection-wand':
                    const wand = new SelectionWand(cell, undefined, {
                        diagonal: shouldModifyAction('tools.standard.selection-wand.diagonal', mouseEvent),
                        charblind: true,
                        colorblind: shouldModifyAction('tools.standard.selection-wand.colorblind', mouseEvent)
                    });
                    wand.complete();
                    polygons.push(wand);
                    break;
                case 'text-editor':
                    if (polygons.length === 0) {
                        moveCursorTo(cell)
                    }
                    else {
                        // This case only happens if there is already a selection and the user holds shift and clicks on a
                        // new cell. We extend the current selection to that cell since that is how editors usually work.
                        polygons[0].end = cell;
                    }
                    break;
            }

            eventBus.emit(EVENTS.SELECTION.CHANGED);
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ cell }) => {
        // TODO This could be more efficient, could just trigger refreshes if cell is different than last?

        if (isDrawing) {
            lastPolygon().end = cell;
            eventBus.emit(EVENTS.SELECTION.CHANGED);
        }
        else if (isMoving) {
            moveDelta(cell.row - moveStep.row, cell.col - moveStep.col);

            // Keep track of whether we've moved to a new cell. Note: moving to a new cell and then moving back
            // will still count as movement (hasMoved:true).
            if (!moveStep.equals(cell)) hasMoved = true;

            moveStep = cell;
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ cell }) => {
        const tool = state.getConfig('tool')

        if (isDrawing) {
            lastPolygon().complete();
            isDrawing = false;
            eventBus.emit(EVENTS.SELECTION.CHANGED);
        }
        else if (isMoving) {
            isMoving = false;

            // For text-editor, if you click somewhere in the selected area (and we're not trying to move the underlying
            // content or the selected area) it will immediately place the cursor into that spot, removing the selection.
            if (tool === 'text-editor' && !movableContent && !hasMoved) {
                clear();
                moveCursorTo(cell);
            }
            else {
                eventBus.emit(EVENTS.SELECTION.CHANGED)
                if (movableContent) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
            }
        }
    });
}


// -------------------------------------------------------------------------------- Moving Content

export function toggleMovingContent() {
    movableContent ? finishMovingContent() : startMovingContent();
}

export function startMovingContent() {
    movableContent = getSelectedValues();

    empty();
    eventBus.emit(EVENTS.REFRESH.ALL);
}

export function finishMovingContent() {
    translateGlyphs(movableContent, getSelectedCellArea().topLeft, (r, c, char, color) => {
        // Moving empty cells does not override existing cells
        if (char === EMPTY_CHAR) return;

        state.setCurrentCelGlyph(r, c, char, color);
    });

    movableContent = null;
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
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

    _update2dArray(movableContent.chars, char);
    _update2dArray(movableContent.colors, color);
}


// -------------------------------------------------------------------------------- Cursor
let cursorCellOrigin; // Where to move from on return key

// We show a blinking cursor cell if using the text-editor tool and a single 1x1 square is selected
export function cursorCell() {
    if (state.getConfig('tool') !== 'text-editor') return null;
    if (!hasSelection()) return null;
    if (movableContent) return null;
    if (!polygons[0].topLeft.equals(polygons[0].bottomRight)) return null;
    return polygons[0].topLeft;
}

export function moveCursorTo(cell, updateOrigin = true) {
    if (state.getConfig('tool') !== 'text-editor') {
        console.warn('Can only call moveCursorTo if tool is text-editor')
        return;
    }

    if (movableContent) { finishMovingContent(); } // Cannot move content and show cursor at the same time

    polygons = [new SelectionRect(cell)];
    state.setConfig('cursorPosition', cell.serialize());

    if (updateOrigin) {
        cursorCellOrigin = cell;

        // Update the current history slice so that if you undo to the slice, the cursor will be at the most recent position
        // TODO Is there a way to do this using state's setConfig somehow?
        state.modifyHistory(historySlice => historySlice.config.cursorPosition = cell.serialize())
    }

    eventBus.emit(EVENTS.SELECTION.CHANGED);
}

export function syncTextEditorCursorPos() {
    if (state.getConfig('tool') !== 'text-editor') return;

    const deserializedCell = Cell.deserialize(state.getConfig('cursorPosition'));
    if (deserializedCell) moveCursorTo(deserializedCell, false);
}



// -------------------------------------------------------------------------------- Caching
// We cache some selection results to improve lookup times. Caches must be cleared whenever the selection changes.

let caches;

function clearCaches() {
    caches = {};
}

function cacheSelectedCells() {
    if (caches.selectedCells === undefined) {
        caches.selectedCells = new Set(getSelectedCells().map(selectedCell => cellKey(selectedCell)));
    }
}


// -------------------------------------------------------------------------------- Keyboard handlers

export function handleArrowKey(direction, shiftKey) {
    // If holding shift, arrow keys extend the current selection
    if (shiftKey) {
        extendInDirection(direction, 1)
        return;
    }

    if (state.getConfig('tool') === 'text-editor' && !cursorCell() && !movableContent) {
        // Jump cursor to start/end of the selection area
        switch(direction) {
            case 'left':
            case 'up':
                moveCursorTo(polygons[0].topLeft);
                break;
            case 'right':
            case 'down':
                // Cursor actually needs to go one cell to the right of the selection end
                moveCursorTo(nextCursorPosition(polygons[0].bottomRight, 'right', 1));
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
        return;
    }

    moveInDirection(direction);
}

export function handleBackspaceKey(isDelete) {
    if (movableContent) {
        updateMovableContent(EMPTY_CHAR, 0);
    }
    else if (cursorCell()) {
        if (!isDelete) {
            moveInDirection('left', { updateCursorOrigin: false });
        }
        state.setCurrentCelGlyph(cursorCell().row, cursorCell().col, EMPTY_CHAR, 0);
    }
    else {
        empty();
    }
}

export function handleTabKey(shiftKey) {
    if (shiftKey) {
        // If shift key is pressed, we move in opposite direction
        moveInDirection('left', { updateCursorOrigin: false });
    } else {
        moveInDirection('right', { updateCursorOrigin: false })
    }
}

export function handleEnterKey(shiftKey) {
    if (movableContent) {
        finishMovingContent();
    }
    else {
        // Push a state to the history where the cursor is at the end of the current line -- that way when
        // you undo, the first undo just jumps back to the previous line with cursor at end.
        if (cursorCell()) state.pushHistory();

        if (shiftKey) {
            // If shift key is pressed, we move in opposite direction
            moveInDirection('up')
        } else if (cursorCell()) {
            // 'Enter' key differs from 'ArrowDown' in that the cursor will go to the start of the next line (like Excel)
            let col = cursorCellOrigin.col,
                row = cursorCell().row + 1;
            if (row >= state.numRows()) row = 0
            moveCursorTo(new Cell(row, col));
        } else {
            moveInDirection('down')
        }
    }
}



// -------------------------------------------------------------------------------- Translating/Modifying Polygons

function moveDelta(rowDelta, colDelta) {
    if (!hasSelection()) {
        return;
    }

    polygons.forEach(polygon => polygon.translate(rowDelta, colDelta));

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
}

/**
 * Move all selection polygons in a particular direction
 * @param {string} direction - Direction to move selection ('left'/'up'/'right'/'down')
 * @param {Object} [options={}] - move options
 * @param {number} [options.amount=1] - Number of cells to move the selection
 * @param {boolean} [options.updateCursorOrigin=true] - Whether to update the cursorCellOrigin (where carriage return takes you)
 * @param {boolean} [options.wrapCursorPosition=true] - Whether to wrap the cursor if it goes out of bounds
 */
export function moveInDirection(direction, options = {}) {
    const amount = options.amount === undefined ? 1 : options.amount;
    const updateCursorOrigin = options.updateCursorOrigin === undefined ? true : options.updateCursorOrigin;
    const wrapCursorPosition = options.wrapCursorPosition === undefined ? true : options.wrapCursorPosition;

    if (!hasSelection()) return;

    if (cursorCell()) {
        moveCursorTo(nextCursorPosition(cursorCell(), direction, amount, wrapCursorPosition), updateCursorOrigin);
        return;
    }

    switch(direction) {
        case 'left':
            polygons.forEach(polygon => polygon.translate(0, -amount));
            break;
        case 'up':
            polygons.forEach(polygon => polygon.translate(-amount, 0));
            break;
        case 'right':
            polygons.forEach(polygon => polygon.translate(0, amount));
            break;
        case 'down':
            polygons.forEach(polygon => polygon.translate(amount, 0));
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
}

export function extendInDirection(direction, amount = 1) {
    if (!hasSelection()) return;
    if (movableContent) return; // Cannot extend while moving content

    switch(direction) {
        case 'left':
            polygons.forEach(polygon => polygon.translate(0, -amount, false, true));
            break;
        case 'up':
            polygons.forEach(polygon => polygon.translate(-amount, 0, false, true));
            break;
        case 'right':
            polygons.forEach(polygon => polygon.translate(0, amount, false, true));
            break;
        case 'down':
            polygons.forEach(polygon => polygon.translate(amount, 0, false, true));
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
}

function nextCursorPosition(currentPosition, direction, amount, wrapCursorPosition = true) {
    let col = currentPosition.col, row = currentPosition.row;

    switch (direction) {
        case 'left':
            col -= amount;
            break;
        case 'up':
            row -= amount;
            break;
        case 'right':
            col += amount;
            break;
        case 'down':
            row += amount;
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }

    if (wrapCursorPosition) {
        // Wrap around canvas
        if (col >= state.numCols()) {
            col = 0
            row += 1
        }
        if (row >= state.numRows()) {
            row = 0
        }
        if (col < 0) {
            col = state.numCols() - 1
            row -= 1
        }
        if (row < 0) {
            row = state.numRows() - 1
        }
    }
    else {
        if (col >= state.numCols()) col = state.numCols() - 1
        if (row >= state.numRows()) row = state.numRows() - 1
        if (col < 0) col = 0
        if (row < 0) row = 0;
    }

    return new Cell(row, col);
}

export function flipVertically(mirrorChars) {
    flip(false, true, mirrorChars);
}
export function flipHorizontally(mirrorChars) {
    flip(true, false, mirrorChars);
}

function flip(horizontally, vertically, mirrorChars) {
    const cellArea = getSelectedCellArea();
    const updates = []; // Have to batch the updates, and do them all at end (i.e. do not modify chars while iterating)

    function flipRow(oldRow) {
        return (cellArea.topLeft.row + cellArea.bottomRight.row) - oldRow;
    }
    function flipCol(oldCol) {
        return (cellArea.topLeft.col + cellArea.bottomRight.col) - oldCol;
    }

    getSelectedCells().forEach(cell => {
        let [char, color] = state.getCurrentCelGlyph(cell.row, cell.col);
        if (mirrorChars && horizontally) { char = mirrorCharHorizontally(char); }
        if (mirrorChars && vertically) { char = mirrorCharVertically(char); }
        updates.push({
            row: vertically ? flipRow(cell.row) : cell.row,
            col: horizontally ? flipCol(cell.col) : cell.col,
            char: char,
            color: color
        });
        state.setCurrentCelGlyph(cell.row, cell.col, EMPTY_CHAR, 0);
    });

    updates.forEach(update => {
        state.setCurrentCelGlyph(update.row, update.col, update.char, update.color);
    })

    polygons.forEach(polygon => {
        if (vertically) { polygon.flipVertically(flipRow); }
        if (horizontally) { polygon.flipHorizontally(flipCol); }
    });

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    state.pushHistory();
}

// -------------------------------------------------------------------------------- Cloning

export function cloneToAllFrames() {
    translateGlyphs(getSelectedValues(), getSelectedCellArea().topLeft, (r, c, char, color) => {
        state.iterateCelsForCurrentLayer(cel => {
            state.setCelGlyph(cel, r, c, char, color);
        })
    });

    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}




// -------------------------------------------------------------------------------- Helpers

function lastPolygon() {
    return polygons[polygons.length - 1];
}

// A unique way of identifying a cell (for Set lookup purposes)
function cellKey(cell) {
    return `${cell.row},${cell.col}`
}

// The inverse of cellKey
function cellKeyToRowCol(cellKey) {
    return cellKey.split(',').map(int => parseInt(int));
}



