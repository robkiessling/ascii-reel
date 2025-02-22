import {create2dArray, mirrorCharHorizontally, mirrorCharVertically, translateGlyphs} from "../utils/utilities.js";
import {triggerRefresh} from "../index.js";
import * as state from "../state/state.js";
import * as editor from "../components/editor.js";
import * as actions from "../io/actions.js";
import {shouldModifyAction} from "../io/actions.js";
import Cell from "../geometry/cell.js";
import CellArea from "../geometry/cell_area.js";
import SelectionRect from "../geometry/selection/selection_rect.js";
import SelectionWand from "../geometry/selection/selection_wand.js";
import SelectionLine from "../geometry/selection/selection_line.js";
import SelectionLasso from "../geometry/selection/selection_lasso.js";
import SelectionText from "../geometry/selection/selection_text.js";


// -------------------------------------------------------------------------------- Main API

export let polygons = [];
export let isDrawing = false; // Only true when mouse is down and polygon is being drawn
export let isMoving = false; // Only true when mouse is down and polygon is being moved
export let movableContent = null; // Selected glyph content IF there is any (it will be surrounded by dashed outline)
export let cursorCell = null;
export let cursorCellOrigin; // Where to move from on return key

export function init() {
    actions.registerAction('selection.select-all', () => selectAll());

    clearCaches();
}

// Returns true if there is any area selected
export function hasSelection() {
    return polygons.some(polygon => polygon.hasArea);
}

// Returns true if there is any area selected or a cursor showing (i.e. a target visible on the canvas)
export function hasTarget() {
    return hasSelection() || cursorCell;
}

export function clear() {
    if (movableContent) { finishMovingContent(); }
    if (cursorCell) { hideCursor(); }
    polygons = [];
    triggerRefresh('selection');
}

// Empties the selection's contents. Does not clear the selection.
export function empty() {
    getSelectedCells().forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, '', 0);
    });
}

// Select entire canvas
export function selectAll() {
    // selectAll works with both text-editor and selection-rect tools; only switch tools if not using one of those already
    if (state.config('tool') !== 'text-editor' && state.config('tool') !== 'selection-rect') {
        editor.changeTool('selection-rect');
    }

    if (cursorCell) {
        hideCursor();
    }

    polygons = [SelectionRect.drawableArea()];
    triggerRefresh('selection');
}

// Returns true if the given Cell is part of the selection
export function isSelectedCell(cell) {
    cacheSelectedCells();
    return caches.selectedCells.has(cellKey(cell));
}

// We allow the selection to be moved in all cases except for when the text-editor tool is being used and the
// shift key is down (in that case - we simply modify the text-editor polygon).
export function allowMovement(tool, mouseEvent) {
    return !(tool === 'text-editor' && mouseEvent.shiftKey)
}

export function setSelectionToSingleChar(char, color) {
    if (movableContent) {
        updateMovableContent(char, color);
    }
    else if (cursorCell) {
        // update cursor cell and then move to next cell
        state.setCurrentCelGlyph(cursorCell.row, cursorCell.col, char, color);
        moveCursorInDirection('right', false);
    }
    else {
        // update entire selection
        getSelectedCells().forEach(cell => {
            state.setCurrentCelGlyph(cell.row, cell.col, char, color);
        });
    }

    triggerRefresh('chars', 'producesText');

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

export function setupMouseEvents(canvasControl) {
    let moveStep, hasMoved;

    canvasControl.$canvas.on('editor:mousedown', (evt, mouseEvent, cell, tool) => {
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

            triggerRefresh('selection');
            return;
        }

        // If user clicks anywhere on the canvas (without the multiple-select key down) we want to clear everything and start a new polygon
        if (!shouldModifyAction('editor.tools.selection.multiple', mouseEvent)) {
            clear();
        }

        if (cell.isInBounds()) {
            isDrawing = true;

            switch(tool) {
                case 'selection-rect':
                    polygons.push(new SelectionRect(cell, undefined, {
                        outline: shouldModifyAction('editor.tools.selection-rect.outline', mouseEvent)
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
                        diagonal: true,
                        colorblind: shouldModifyAction('editor.tools.selection-wand.colorblind', mouseEvent)
                    });
                    wand.complete();
                    polygons.push(wand);
                    break;
                case 'text-editor':
                    cell = canvasControl.cursorAtExternalXY(mouseEvent.offsetX, mouseEvent.offsetY);

                    // We only ever use one polygon for the text-editor tool
                    if (polygons.length === 0) {
                        polygons.push(new SelectionText(cell));
                    }
                    else {
                        polygons[0].end = cell;
                    }

                    hasSelection() ? hideCursor() : moveCursorTo(cell);
                    break;
            }

            triggerRefresh('selection');
        }
    });

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell, tool) => {
        if (isDrawing) {
            if (tool === 'text-editor') {
                cell = canvasControl.cursorAtExternalXY(mouseEvent.offsetX, mouseEvent.offsetY);
                lastPolygon().end = cell;
                triggerRefresh('selection');
                hasSelection() ? hideCursor() : moveCursorTo(cell);
            }
            else {
                lastPolygon().end = cell;
                triggerRefresh('selection');
            }
        }
        else if (isMoving) {
            moveDelta(cell.row - moveStep.row, cell.col - moveStep.col);

            if (!hasMoved && (cell.row !== moveStep.row || cell.col !== moveStep.col)) {
                hasMoved = true;
            }
            moveStep = cell;
        }
    });

    canvasControl.$canvas.on('editor:mouseup', (evt, mouseEvt, cell, tool) => {
        if (isDrawing) {
            lastPolygon().complete();
            isDrawing = false;
            triggerRefresh('selection');
        }
        else if (isMoving) {
            if (tool === 'text-editor' && !movableContent && !hasMoved) {
                clear();
                moveCursorTo(cell);
            }

            isMoving = false;
            const refresh = ['selection'];
            if (movableContent) { refresh.push('chars'); }
            if (cursorCell) { refresh.push('cursorCell'); }
            triggerRefresh(refresh);
        }
    });

    canvasControl.$canvas.on('editor:dblclick', (evt, mouseEvent, cell, tool) => {
        switch(tool) {
            case 'selection-rect':
            case 'selection-line':
            case 'selection-lasso':
            case 'selection-wand':
                break;
            default:
                return; // Ignore all other tools
        }

        moveCursorTo(cell);
    });
}


// -------------------------------------------------------------------------------- Moving Content

export function toggleMovingContent() {
    movableContent ? finishMovingContent() : startMovingContent();
}

export function startMovingContent() {
    if (cursorCell) { hideCursor(); } // Cannot move content and show cursor at the same time

    movableContent = getSelectedValues();

    empty();
    triggerRefresh('full');
}

export function finishMovingContent() {
    translateGlyphs(movableContent, getSelectedCellArea().topLeft, (r, c, char, color) => {
        state.setCurrentCelGlyph(r, c, char, color);
    });

    movableContent = null;
    triggerRefresh('full', true);
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

export function toggleCursor() {
    cursorCell ? hideCursor() : moveCursorToStart();
}

export function moveCursorTo(cell, updateOrigin = true) {
    if (movableContent) { finishMovingContent(); } // Cannot move content and show cursor at the same time

    cursorCell = cell;

    if (updateOrigin) {
        cursorCellOrigin = cell;
    }

    triggerRefresh('cursorCell');
}

export function moveCursorToStart() {
    if (state.config('tool') === 'text-editor') {
        // Move cursor to top-left cell of entire canvas. This only really happens during page init.
        moveCursorTo(new Cell(0, 0));
        matchPolygonToCursor();
        return;
    }

    cacheUniqueSortedCells();
    const cellData = caches.cellsLeftToRight[0];

    if (cellData) {
        moveCursorTo(new Cell(cellData[0], cellData[1]));
    }
}

// When using the text-editor tool, moves the cursor down one row and back to the origin column.
// This is similar to how Excel moves your cell when using the tab/return keys.
export function moveCursorCarriageReturn() {
    if (cursorCell) {
        if (state.config('tool') === 'text-editor') {
            let col = cursorCellOrigin.col,
                row = cursorCell.row + 1;

            if (row >= state.numRows()) {
                return; // Do not wrap around or move cursor at all
            }

            moveCursorTo(new Cell(row, col));
            matchPolygonToCursor();
        }
        else {
            moveCursorInDirection('down', false);
        }
    }
}

export function moveCursorInDirection(direction, updateOrigin = true, amount = 1) {
    if (cursorCell) {
        if (state.config('tool') === 'text-editor') {
            let col = cursorCell.col, row = cursorCell.row;

            if (direction === 'left') {
                col = Math.max(0, col - amount);
            }
            if (direction === 'up') {
                row = Math.max(0, row - amount);
            }
            if (direction === 'right') {
                // Note: When moving right, we intentionally allow column to go 1 space out of bounds
                col = Math.min(col + amount, state.numCols());
            }
            if (direction === 'down' && row < state.numRows() - 1) {
                row = Math.min(row + amount, state.numRows() - 1);
            }

            moveCursorTo(new Cell(row, col), updateOrigin);
            matchPolygonToCursor();
        }
        else {
            // For selection tools, the cursor traverse through the domain of the selection (wrapping when it reaches the end of a row)

            // TODO This case is hardcoded to step 1 space, but so far it does not need to support anything more
            if (amount !== 1) {
                console.error('moveCursorInDirection only supports an `amount` of `1` for selection tools');
            }

            cacheUniqueSortedCells();

            // Find the current targeted cell index
            let i;
            let cells = (direction === 'left' || direction === 'right') ? caches.cellsLeftToRight : caches.cellsTopToBottom;
            let length = cells.length;
            for (i = 0; i < length; i++) {
                if (cursorCell.row === cells[i][0] && cursorCell.col === cells[i][1]) {
                    break;
                }
            }

            // Step forward/backward
            (direction === 'right' || direction === 'down') ? i++ : i--;

            // Wrap around if necessary
            if (i >= length) { i = 0; }
            if (i < 0) { i = length - 1; }

            moveCursorTo(new Cell(cells[i][0], cells[i][1]), updateOrigin);
        }
    }
}

export function hideCursor() {
    cursorCell = null;
    triggerRefresh('cursorCell');
}

// Sets the current polygon to be a SelectionText of size 0 located at the cursor
function matchPolygonToCursor() {
    polygons = [new SelectionText(cursorCell)];
    triggerRefresh('selection');
}



// -------------------------------------------------------------------------------- Caching
// We cache some selection results to improve lookup times. Caches must be cleared whenever the selection changes.

let caches;

export function clearCaches() {
    caches = {};
}

function cacheUniqueSortedCells() {
    if (caches.cellsLeftToRight === undefined) {
        // using Set to find unique cell keys
        caches.cellsLeftToRight = new Set(getSelectedCells().map(cell => cellKey(cell)));

        // Convert cell keys to pairs of [row, col]
        caches.cellsLeftToRight = [...caches.cellsLeftToRight].map(cellKey => cellKeyToRowCol(cellKey));

        // Sort by row, then column
        caches.cellsLeftToRight.sort((a,b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    }
    if (caches.cellsTopToBottom === undefined) {
        // using Set to find unique cell keys
        caches.cellsTopToBottom = new Set(getSelectedCells().map(cell => cellKey(cell)));

        // Convert cell keys to pairs of [row, col]
        caches.cellsTopToBottom = [...caches.cellsTopToBottom].map(cellKey => cellKeyToRowCol(cellKey));

        // Sort by column, then row
        caches.cellsTopToBottom.sort((a,b) => a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]);
    }
}

function cacheSelectedCells() {
    if (caches.selectedCells === undefined) {
        caches.selectedCells = new Set(getSelectedCells().map(selectedCell => cellKey(selectedCell)));
    }
}


// -------------------------------------------------------------------------------- Translating/Modifying Polygons

function moveDelta(rowDelta, colDelta) {
    if (!hasSelection()) {
        return;
    }

    polygons.forEach(polygon => polygon.translate(rowDelta, colDelta));

    if (cursorCell) {
        cursorCell.row += rowDelta;
        cursorCell.col += colDelta;
    }

    const refresh = ['selection'];
    if (movableContent) { refresh.push('chars'); }
    if (cursorCell) { refresh.push('cursorCell'); }
    triggerRefresh(refresh);
}

// Move all polygons in a particular direction
export function moveInDirection(direction, amount, moveStart = true, moveEnd = true) {
    if (!hasTarget()) {
        return;
    }

    switch(direction) {
        case 'left':
            polygons.forEach(polygon => polygon.translate(0, -amount, moveStart, moveEnd));
            break;
        case 'up':
            polygons.forEach(polygon => polygon.translate(-amount, 0, moveStart, moveEnd));
            break;
        case 'right':
            polygons.forEach(polygon => polygon.translate(0, amount, moveStart, moveEnd));
            break;
        case 'down':
            polygons.forEach(polygon => polygon.translate(amount, 0, moveStart, moveEnd));
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }

    triggerRefresh(movableContent ? ['chars', 'selection'] : 'selection');
}

/**
 * Special handler for text-editor tool when arrow keys are pressed. We simulate a real text editor, where:
 *   - the arrow keys move the cursor
 *   - if you hold shift, the cursor begins highlighting text
 *   - if you keep holding shift and make your highlighted text area size 0, it reverts to a normal cursor
 *   - if you let go of shift after highlighting text and hit an arrow key, the cursor jumps to beginning/end of what
 *     you had selected
 */
export function handleTextEditorArrowKey(direction, shiftKey) {
    if (shiftKey) {
        if (cursorCell) {
            // Switch from a cursor to a selection area (by extending the current polygon and hiding the cursor)
            moveInDirection(direction, 1, false);
            hideCursor();
        }
        else {
            // Grow/shrink the selection area like normal
            moveInDirection(direction, 1, false);

            // However, if the selection area ever gets to be size 0, revert back to showing a cursor
            if (polygons[0] && !hasSelection()) {
                moveCursorTo(polygons[0].start);
            }
        }
    }
    else {
        if (cursorCell) {
            // Move the cursor like normal
            moveCursorInDirection(direction)
        }
        else {
            // Jump cursor to start/end of the selection area, and go back to just having a cursor
            switch(direction) {
                case 'left':
                case 'up':
                    moveCursorTo(polygons[0].topLeft);
                    break;
                case 'right':
                case 'down':
                    const target = polygons[0].bottomRight;
                    target.translate(0, 1); // Cursor actually needs to go one cell to the right of the selection end
                    moveCursorTo(target);
                    break;
                default:
                    console.warn(`Invalid direction: ${direction}`);
            }
            matchPolygonToCursor();
        }
    }
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
        state.setCurrentCelGlyph(cell.row, cell.col, '', 0);
    });

    updates.forEach(update => {
        state.setCurrentCelGlyph(update.row, update.col, update.char, update.color);
    })

    polygons.forEach(polygon => {
        if (vertically) { polygon.flipVertically(flipRow); }
        if (horizontally) { polygon.flipHorizontally(flipCol); }
    });

    triggerRefresh(['chars', 'selection'], true);
}

// -------------------------------------------------------------------------------- Cloning

export function cloneToAllFrames() {
    translateGlyphs(getSelectedValues(), getSelectedCellArea().topLeft, (r, c, char, color) => {
        state.iterateCelsForCurrentLayer(cel => {
            state.setCelGlyph(cel, r, c, char, color);
        })
    });

    triggerRefresh('full', true);
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



