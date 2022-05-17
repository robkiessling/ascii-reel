import {create2dArray, mirrorCharHorizontally, mirrorCharVertically, translate} from "./utilities.js";
import {Cell, CellArea} from "./canvas.js";
import {triggerRefresh} from "./index.js";
import * as state from "./state.js";
import * as editor from "./editor.js";
import * as actions from "./actions.js";


// -------------------------------------------------------------------------------- Main API

export let polygons = [];
export let isDrawing = false; // Only true when mouse is down and polygon is being drawn
export let isMoving = false; // Only true when mouse is down and polygon is being moved
export let movableContent = null; // 2d array of content IF there is any (it will be surrounded by dashed outline)
export let hoveredCell;
export let cursorCell;
// export let cursorTabCell; // TODO Where to move from on return key

export function hasSelection() {
    return polygons.length > 0;
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
        state.setCurrentCelChar(cell.row, cell.col, ['', 0]);
    });
}

// Select entire canvas
export function selectAll() {
    editor.changeTool('selection-rect');
    polygons = [SelectionRect.drawableArea()];
    triggerRefresh('selection');
}

// Returns true if the given Cell is part of the selection
export function isSelectedCell(cell) {
    cacheSelectedCells();
    return caches.selectedCells.has(cellKey(cell));
}

// Returns true if the selection is comprised by a single 1x1 Cell
export function selectingSingleCell() {
    if (isDrawing) {
        return false;
    }
    const area = getSelectedCellArea();
    return area && area.topLeft.equals(area.bottomRight);
}

actions.registerAction('commit-selection', {
    name: 'Commit Move',
    callback: () => finishMovingContent(),
    enabled: () => !!movableContent,
    shortcut: 'Enter'
});

actions.registerAction('select-all', {
    name: 'Select All',
    callback: () => selectAll(),
    shortcut: 'a'
});




// -------------------------------------------------------------------------------- Selection Results


/**
 * Returns a 2d array of values for the smallest CellArea that bounds all polygons. This 2d array will contain
 * undefined elements for any gaps between polygons (if any).
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
 *        [
 *          ['x', 'x', undefined, undefined, undefined],
 *          ['x', 'x', undefined, undefined, 'x']
 *        ]
 *
 */
export function getSelectedValues() {
    if (!hasSelection()) {
        return [[]];
    }

    if (movableContent) {
        return movableContent;
    }

    // Start with a 2d array of undefined elements
    const cellArea = getSelectedCellArea();
    let values = create2dArray(cellArea.numRows, cellArea.numCols);

    polygons.forEach(polygon => {
        polygon.iterateCells((r, c) => {
            values[r - cellArea.topLeft.row][c - cellArea.topLeft.col] = state.getCurrentCelChar(r, c);
        });
    });

    return values;
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
    
    polygons.forEach(polygon => {
        if (topLeft.row === undefined || polygon.topLeft.row < topLeft.row) { topLeft.row = polygon.topLeft.row; }
        if (topLeft.col === undefined || polygon.topLeft.col < topLeft.col) { topLeft.col = polygon.topLeft.col; }
        if (bottomRight.row === undefined || polygon.bottomRight.row > bottomRight.row) { bottomRight.row = polygon.bottomRight.row; }
        if (bottomRight.col === undefined || polygon.bottomRight.col > bottomRight.col) { bottomRight.col = polygon.bottomRight.col; }
    });

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
 * Returns a 1d array of Cell-like objects for all selected cells.
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
 * Returns all cells adjacent to (and sharing the same color as) the targeted cell
  */
export function getConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return []; }
    return new SelectionWand(cell, cell.clone(), options).cells;
}



// -------------------------------------------------------------------------------- Events

export function setupMouseEvents(canvasControl) {
    let movingFrom = null;

    canvasControl.$canvas.on('editor:mousedown', (evt, mouseEvent, cell, tool) => {
        switch(tool) {
            case 'selection-rect':
            case 'selection-line':
            case 'selection-lasso':
            case 'selection-wand':
                break;
            default:
                return; // Ignore all other tools
        }

        if (isSelectedCell(cell)) {
            isMoving = true;
            movingFrom = cell;

            if (mouseEvent.metaKey && !movableContent) {
                startMovingContent();
                return;
            }

            triggerRefresh('selection');
            return;
        }

        if (!mouseEvent.shiftKey) {
            clear();
        }

        if (cell.isInBounds()) {
            isDrawing = true;

            switch(tool) {
                case 'selection-rect':
                    polygons.push(new SelectionRect(cell, cell.clone()));
                    break;
                case 'selection-line':
                    polygons.push(new SelectionLine(cell, cell.clone()));
                    break;
                case 'selection-lasso':
                    polygons.push(new SelectionLasso(cell, cell.clone()));
                    break;
                case 'selection-wand':
                    polygons.push(new SelectionWand(cell, cell.clone(), { diagonal: mouseEvent.metaKey, colorblind: mouseEvent.altKey }));
                    break;
            }

            triggerRefresh('selection');
        }
    });

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell) => {
        hoveredCell = cell;
        triggerRefresh('hoveredCell');

        if (isDrawing) {
            lastPolygon().end = cell;
            triggerRefresh('selection');
        }
        if (isMoving) {
            moveDelta(cell.row - movingFrom.row, cell.col - movingFrom.col);
            movingFrom = cell;
        }
    });

    canvasControl.$canvas.on('editor:mouseup', () => {
        if (isDrawing) {
            lastPolygon().complete();
            isDrawing = false;
            triggerRefresh('selection');
        }
        if (isMoving) {
            isMoving = false;
            const refresh = ['selection'];
            if (movableContent) { refresh.push('chars'); }
            if (cursorCell) { refresh.push('cursorCell'); }
            triggerRefresh(refresh);
        }
    });

    canvasControl.$canvas.on('editor:mouseenter', (evt, mouseEvent, cell) => {
        hoveredCell = cell;
        triggerRefresh('hoveredCell');
    });

    canvasControl.$canvas.on('editor:mouseleave', () => {
        hoveredCell = null;
        triggerRefresh('hoveredCell');
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
    triggerRefresh();
}

export function finishMovingContent() {
    translate(movableContent, getSelectedCellArea().topLeft, (value, r, c) => {
        if (value !== undefined) { state.setCurrentCelChar(r, c, value); }
    });

    movableContent = null;
    triggerRefresh();
}

export function updateMovableContent(char, color) {
    movableContent.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            if (value !== undefined) {
                value[0] = char;
                value[1] = color;
            }
        });
    });
}


// -------------------------------------------------------------------------------- Cursor

export function toggleCursor() {
    cursorCell ? hideCursor() : moveCursorToStart();
}

export function moveCursorTo(cell) {
    if (movableContent) { finishMovingContent(); } // Cannot move content and show cursor at the same time

    cursorCell = cell;
    triggerRefresh('cursorCell');
}

export function moveCursorToStart() {
    cacheUniqueSortedCells();
    const cellData = caches.cellsLeftToRight[0];

    if (cellData) {
        const cell = new Cell(cellData[0], cellData[1]);
        moveCursorTo(cell);
    }
}

// Steps the cursor forward or backward one space
export function moveCursorInDirection(direction) {
    if (cursorCell) {
        if (selectingSingleCell() || state.config('tool') === 'write-text') {
            // Entire canvas is the domain to traverse through

            let col = cursorCell.col, row = cursorCell.row;

            if (direction === 'left') { col -= 1; }
            if (direction === 'up') { row -= 1; }
            if (direction === 'right') { col += 1; }
            if (direction === 'down') { row += 1; }

            if (col >= state.numCols()) { col = 0; row += 1; }
            if (col < 0) { col = state.numCols() - 1; row -= 1; }
            if (row >= state.numRows()) { row = 0; }
            if (row < 0) { row = state.numRows() - 1; }

            moveCursorTo(new Cell(row, col));

            if (selectingSingleCell()) {
                // Also update underlying single selection cell.
                // Don't have to refresh selection since the selection is hidden if selecting single cells
                polygons = [new SelectionRect(cursorCell.clone(), cursorCell.clone())];
                clearCaches();
            }
        }
        else {
            // The current selection is the domain to traverse through

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

            moveCursorTo(new Cell(cells[i][0], cells[i][1]));
        }
    }
}

export function hideCursor() {
    cursorCell = null;
    triggerRefresh('cursorCell');
}




// -------------------------------------------------------------------------------- Caching
// We cache some selection results to improve lookup times. Caches must be cleared whenever the selection changes.

let caches = {};

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
    if (!hasSelection()) {
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
        let value = state.getCurrentCelChar(cell.row, cell.col);
        if (mirrorChars && horizontally) { value[0] = mirrorCharHorizontally(value[0]); }
        if (mirrorChars && vertically) { value[0] = mirrorCharVertically(value[0]); }
        updates.push({
            row: vertically ? flipRow(cell.row) : cell.row,
            col: horizontally ? flipCol(cell.col) : cell.col,
            value: value
        });
        state.setCurrentCelChar(cell.row, cell.col, ['', 0]);
    });

    updates.forEach(update => {
        state.setCurrentCelChar(update.row, update.col, update.value);
    })

    polygons.forEach(polygon => {
        if (vertically) { polygon.flipVertically(flipRow); }
        if (horizontally) { polygon.flipHorizontally(flipCol); }
    });

    triggerRefresh(['chars', 'selection']);
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





// -------------------------------------------------------------------------------- Polygon Classes

/**
 * SelectionPolygon is the base class for many types of selection shapes. All polygons have a start value (where the
 * user first clicked) and an end value (where the user's last mouse position was).
 *
 * Subclasses must implement an 'iterateCells' function and a 'draw' function.
 */
class SelectionPolygon {
    constructor(startCell, endCell, options = {}) {
        this.start = startCell;
        this.end = endCell;
        this.options = options;
        this.completed = false;
    }

    set start(cell) {
        this._start = cell;
    }
    get start() {
        return this._start;
    }
    set end(cell) {
        this._end = cell;
    }
    get end() {
        return this._end;
    }

    get topLeft() {
        return new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }
    get bottomRight() {
        return new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
    }

    complete() {
        this.completed = true;
    }

    translate(rowDelta, colDelta, moveStart = true, moveEnd = true) {
        if (moveStart) {
            this.start.row += rowDelta;
            this.start.col += colDelta;
        }
        if (moveEnd) {
            this.end.row += rowDelta;
            this.end.col += colDelta;
        }
    }

    flipVertically(flipRow) {
        this.start.row = flipRow(this.start.row);
        this.end.row = flipRow(this.end.row);
    }

    flipHorizontally(flipCol) {
        this.start.col = flipCol(this.start.col);
        this.end.col = flipCol(this.end.col);
    }


}

class SelectionLine extends SelectionPolygon {
    iterateCells(callback) {
        this.start.lineTo(this.end).forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this.start.lineTo(this.end).forEach(cell => {
            if (cell.isInBounds()) {
                context.fillRect(...cell.xywh);
            }
        });
    }
}

class SelectionRect extends SelectionPolygon {
    static drawableArea() {
        return new SelectionRect(new Cell(0, 0), new Cell(state.numRows() - 1, state.numCols() - 1));
    }

    iterateCells(callback) {
        this._toCellArea().iterate(callback);
    }

    draw(context) {
        context.fillRect(...this._toCellArea().clone().bindToDrawableArea().xywh);
    }

    // Note: SelectionRect is the only Polygon that needs to implement `stroke`
    stroke(context) {
        context.beginPath();
        context.rect(...this._toCellArea().xywh);
        context.stroke();
    }

    _toCellArea() {
        return new CellArea(this.topLeft, this.bottomRight);
    }
}

/**
 * A SelectionLasso starts off as just an array of Cells (_lassoCells) as the user clicks and drags the mouse. When
 * the mouse click is released the lasso will connect the end point to the start point to complete the polygon. Then
 * the polygon is filled in and stored as an array of rectangular CellAreas (_lassoAreas).
 */
class SelectionLasso extends SelectionPolygon {

    iterateCells(callback) {
        if (this._lassoAreas) {
            this._lassoAreas.forEach(area => area.iterate(callback));
        }
        else {
            this._lassoCells.forEach(cell => callback(cell.row, cell.col));
        }
    }

    draw(context) {
        if (this._boundedLassoAreas) {
            this._boundedLassoAreas.forEach(area => context.fillRect(...area.xywh));
        }
        else {
            this._lassoCells.forEach(cell => {
                if (cell.isInBounds()) {
                    context.fillRect(...cell.xywh);
                }
            });
        }
    }

    set start(cell) {
        super.start = cell;
        this._lassoCells = [];
    }

    set end(cell) {
        super.end = cell;

        const previousEnd = this._lassoCells[this._lassoCells.length - 1];
        if (previousEnd === undefined || previousEnd.row !== cell.row || previousEnd.col !== cell.col) {
            if (previousEnd && !cell.isAdjacentTo(previousEnd)) {
                // Mouse might skip cells if moved quickly, so fill in any skips
                previousEnd.lineTo(cell, false).forEach(cell => {
                    this._lassoCells.push(cell);
                });
            }

            // Note: Duplicates cells ARE allowed, as long as they are not consecutive
            this._lassoCells.push(cell);
        }
    }

    get start() {
        return super.start; // Have to override get since set is overridden
    }
    get end() {
        return super.end; // Have to override get since set is overridden
    }

    get topLeft() {
        return this._topLeft; // Using a cached value
    }

    get bottomRight() {
        return this._bottomRight; // Using a cached value
    }

    complete() {
        // Connect the end point back to the start with a line to finish the full border chain
        let chain = this._lassoCells.map(cell => ({row: cell.row, col: cell.col}));
        this.end.lineTo(this.start, false).forEach(cell => {
            chain.push({row: cell.row, col: cell.col});
        });

        // Update each link in the chain with a reference to its previous/next link
        for (let i = 0; i < chain.length; i++) {
            chain[i].prev = (i === 0) ? chain[chain.length - 1] : chain[i - 1];
            chain[i].next = (i === chain.length - 1) ? chain[0] : chain[i + 1];
        }

        // Organize chain links into a 2d array sorted by row/col
        let sortedLinks = [];
        let minRow, maxRow;
        chain.forEach(link => {
            if (sortedLinks[link.row] === undefined) {
                sortedLinks[link.row] = [];
                if(minRow === undefined || link.row < minRow) { minRow = link.row; }
                if(maxRow === undefined || link.row > maxRow) { maxRow = link.row; }
            }
            sortedLinks[link.row].push(link);
        });
        sortedLinks.splice(0, minRow); // Remove empty rows from 0 to the first row
        sortedLinks.forEach(row => row.sort((a, b) => a.col - b.col));

        /**
         * Iterate through the sortedLinks, applying "point in polygon" logic to determine if a cell is inside or outside
         * the polygon (https://en.wikipedia.org/wiki/Point_in_polygon).
         *
         * Because we have discrete cells, a polygon edge/corner can "double back" on itself along the same path. We
         * have to implement special handlers for these cases to calculate whether it counts as 1 or 2 "crossings" in
         * point-in-polygon test.
         *
         * A lasso area is a CellArea that is on a single row. There may be multiple lasso areas per row if they are
         * separated by gaps. We use areas instead of keeping track of individual cells to maximize performance.
         */
        this._lassoAreas = [];
        sortedLinks.forEach(rowOfLinks => {
            let inside = false;

            // Iterate through the row. Each time we cross a polygon edge, we toggle whether we are inside the polygon or not.
            for (let i = 0; i < rowOfLinks.length; i++) {
                const link = rowOfLinks[i];
                const cell = new Cell(link.row, link.col);

                if (inside) {
                    this._lassoAreas[this._lassoAreas.length - 1].bottomRight = cell;
                }
                else {
                    this._lassoAreas.push(new CellArea(cell, cell.clone()));
                }

                // If crossing a boundary, toggle 'inside' boolean
                if ((link.next.row > link.row && link.prev.row <= link.row) ||
                    (link.prev.row > link.row && link.next.row <= link.row)) {
                    inside = !inside;
                }
            }
        });

        this._cacheEndpoints();

        super.complete();
    }

    translate(rowDelta, colDelta) {
        this._lassoAreas.forEach(area => {
            area.topLeft.row += rowDelta;
            area.topLeft.col += colDelta;
            area.bottomRight.row += rowDelta;
            area.bottomRight.col += colDelta;
        })

        this._cacheEndpoints();
    }

    flipVertically(flipRow) {
        this._lassoAreas.forEach(area => {
            const topLeftRow = area.topLeft.row, bottomRightRow = area.bottomRight.row;
            area.topLeft.row = flipRow(bottomRightRow);
            area.bottomRight.row = flipRow(topLeftRow);
        });

        this._cacheEndpoints();
    }

    flipHorizontally(flipCol) {
        this._lassoAreas.forEach(area => {
            const topLeftCol = area.topLeft.col, bottomRightCol = area.bottomRight.col;
            area.topLeft.col = flipCol(bottomRightCol);
            area.bottomRight.col = flipCol(topLeftCol);
        });

        this._cacheEndpoints();
    }

    _cacheEndpoints() {
        this._boundedLassoAreas = this._lassoAreas.map(area => area.clone().bindToDrawableArea(true));

        // _lassoAreas is sorted by row, so we can determine the min/max row just from the first/last areas
        const minRow = this._lassoAreas[0].topLeft.row;
        const maxRow = this._lassoAreas[this._lassoAreas.length - 1].bottomRight.row;

        // Any of the areas could have the min/max col, so have to search through all of them
        const minCol = Math.min(...this._lassoAreas.map(area => area.topLeft.col));
        const maxCol = Math.max(...this._lassoAreas.map(area => area.bottomRight.col));

        this._topLeft = new Cell(minRow, minCol);
        this._bottomRight = new Cell(maxRow, maxCol);
    }
}



class SelectionWand extends SelectionPolygon {
    constructor(...args) {
        super(...args);
        this._findConnectedCells();
        this.complete();
    }

    get cells() {
        return this._cells;
    }

    iterateCells(callback) {
        this._cells.forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this._cells.forEach(cell => {
            if (cell.isInBounds()) {
                context.fillRect(...cell.xywh);
            }
        });
    }

    get topLeft() {
        return this._topLeft; // Using a cached value
    }

    get bottomRight() {
        return this._bottomRight; // Using a cached value
    }

    translate(rowDelta, colDelta) {
        this._cells.forEach(cell => {
            cell.row += rowDelta;
            cell.col += colDelta;
        });

        this._cacheEndpoints();
    }

    flipVertically(flipRow) {
        this._cells.forEach(cell => {
            cell.row = flipRow(cell.row);
        })

        this._cacheEndpoints();
    }

    flipHorizontally(flipCol) {
        this._cells.forEach(cell => {
            cell.col = flipCol(cell.col);
        })

        this._cacheEndpoints();
    }

    _findConnectedCells() {
        const cellHash = {};
        const startChar = state.getCurrentCelChar(this.start.row, this.start.col);
        const isBlank = startChar[0] === '';
        const colorblind = this.options.colorblind;
        const diagonal = this.options.diagonal;

        function spread(cell) {
            if (cellHash[cellKey(cell)] === undefined) {
                const charObj = state.getCurrentCelChar(cell.row, cell.col);
                if (!charObj) { return; }

                // If starting character was blank, only keep blank cells. Otherwise only keep non-blank cells
                if (isBlank ? charObj[0] !== '' : charObj[0] === '') { return; }

                // Character colors have to match unless colorblind option is true
                if (!isBlank && !colorblind && charObj[1] !== startChar[1]) { return; }

                // Add cell to result
                cellHash[cellKey(cell)] = new Cell(cell.row, cell.col);

                // Recursive call to adjacent cells (note: not instantiating full Cell objects for performance reasons)
                spread({ row: cell.row - 1, col: cell.col });
                spread({ row: cell.row, col: cell.col + 1 });
                spread({ row: cell.row + 1, col: cell.col });
                spread({ row: cell.row, col: cell.col - 1 });

                if (diagonal) {
                    spread({ row: cell.row - 1, col: cell.col - 1 });
                    spread({ row: cell.row - 1, col: cell.col + 1 });
                    spread({ row: cell.row + 1, col: cell.col + 1 });
                    spread({ row: cell.row + 1, col: cell.col - 1 });
                }
            }
        }

        spread(this.start);

        this._cells = Object.values(cellHash);
        this._cacheEndpoints();
    }

    _cacheEndpoints() {
        const minRow = Math.min(...this._cells.map(cell => cell.row));
        const maxRow = Math.max(...this._cells.map(cell => cell.row));
        const minCol = Math.min(...this._cells.map(cell => cell.col));
        const maxCol = Math.max(...this._cells.map(cell => cell.col));

        this._topLeft = new Cell(minRow, minCol);
        this._bottomRight = new Cell(maxRow, maxCol);
    }

}