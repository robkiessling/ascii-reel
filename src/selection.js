import {create2dArray, mirrorCharHorizontally, mirrorCharVertically} from "./utilities.js";
import {Cell, CellArea} from "./canvas.js";
import {triggerRefresh} from "./index.js";
import * as state from "./state.js";

let polygons = [];
export let isSelecting = false;

export function getPolygons() {
    return polygons;
}

export function hasSelection() {
    return polygons.length > 0;
}

export function clear() {
    polygons = [];
    triggerRefresh('selection');
}

export function selectAll() {
    polygons = [SelectionRect.drawableArea()];
    triggerRefresh('selection');
}

export function setupMouseEvents(canvasControl) {
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

        if (!mouseEvent.shiftKey) {
            clear();
        }

        if (cell.isInBounds()) {
            isSelecting = true;

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
                    polygons.push(new SelectionWand(cell, cell.clone(), { diagonal: mouseEvent.metaKey }));
                    break;
            }

            triggerRefresh('selection');
        }
    });

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell) => {
        if (isSelecting) {
            lastPolygon().end = cell;
            triggerRefresh('selection');
        }
    });

    canvasControl.$canvas.on('editor:mouseup', () => {
        if (isSelecting) {
            lastPolygon().complete();
            isSelecting = false;
            triggerRefresh('selection');
        }
    });
}

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

// Returns all cells adjacent to (and sharing the same color as) the targeted cell
export function getConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return []; }
    return new SelectionWand(cell, options).cells;
}


// Move all polygons in a particular direction
export function moveSelection(direction, amount, moveStart = true, moveEnd = true) {
    if (!hasSelection()) {
        return;
    }

    polygons.forEach(polygon => polygon.translate(direction, amount, moveStart, moveEnd));

    triggerRefresh('selection');
}

function lastPolygon() {
    return polygons[polygons.length - 1];
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
        // TODO polygons might become more complicated than this
        if (vertically) {
            polygon.start.row = flipRow(polygon.start.row);
            polygon.end.row = flipRow(polygon.end.row);
        }
        if (horizontally) {
            polygon.start.col = flipCol(polygon.start.col);
            polygon.end.col = flipCol(polygon.end.col);
        }
    });

    triggerRefresh(['chars', 'selection']);
}

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
        this._start = cell.bindToDrawableArea(true);
    }
    get start() {
        return this._start;
    }
    set end(cell) {
        this._end = cell.bindToDrawableArea(true);
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

    translate(direction, amount, moveStart = true, moveEnd = true) {
        switch(direction) {
            case 'left':
                if (moveStart) { this.start.col -= amount; }
                if (moveEnd) { this.end.col -= amount; }
                break;
            case 'up':
                if (moveStart) { this.start.row -= amount; }
                if (moveEnd) { this.end.row -= amount; }
                break;
            case 'right':
                if (moveStart) { this.start.col += amount; }
                if (moveEnd) { this.end.col += amount; }
                break;
            case 'down':
                if (moveStart) { this.start.row += amount; }
                if (moveEnd) { this.end.row += amount; }
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
    }
}

class SelectionLine extends SelectionPolygon {
    iterateCells(callback) {
        this.start.lineTo(this.end).forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this.start.lineTo(this.end).forEach(cell => context.fillRect(...cell.xywh));
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
        context.fillRect(...this._toCellArea().xywh);
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
        if (this._lassoAreas) {
            this._lassoAreas.forEach(area => context.fillRect(...area.xywh));
        }
        else {
            this._lassoCells.forEach(cell => context.fillRect(...new Cell(cell.row, cell.col).xywh));
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
                cell.bindToDrawableArea(true);

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

    _cacheEndpoints() {
        // _lassoAreas is sorted by row, so we can determine the min/max row just from the first/last areas
        const minRow = this._lassoAreas[0].topLeft.row;
        const maxRow = this._lassoAreas[this._lassoAreas.length - 1].bottomRight.row;

        // Any of the areas could have the min/max col, so have to search through all of them
        const minCol = Math.min(...this._lassoAreas.map(area => area.topLeft.col));
        const maxCol = Math.max(...this._lassoAreas.map(area => area.bottomRight.col));

        this._topLeft = new Cell(minRow, minCol);
        this._bottomRight = new Cell(maxRow, maxCol);
    }

    translate(direction, amount) {
        switch(direction) {
            case 'left':
                this._lassoAreas.forEach(area => {
                    area.topLeft.col -= amount;
                    area.bottomRight.col -= amount;
                });
                break;
            case 'up':
                this._lassoAreas.forEach(area => {
                    area.topLeft.row -= amount;
                    area.bottomRight.row -= amount;
                });
                break;
            case 'right':
                this._lassoAreas.forEach(area => {
                    area.topLeft.col += amount;
                    area.bottomRight.col += amount;
                });
                break;
            case 'down':
                this._lassoAreas.forEach(area => {
                    area.topLeft.row += amount;
                    area.bottomRight.row += amount;
                });
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }

        this._cacheEndpoints();
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
        this._cells.forEach(cell => context.fillRect(...new Cell(cell.row, cell.col).xywh));
    }

    get topLeft() {
        return this._topLeft; // Using a cached value
    }

    get bottomRight() {
        return this._bottomRight; // Using a cached value
    }

    translate(direction, amount) {
        switch(direction) {
            case 'left':
                this._cells.forEach(cell => cell.col -= amount);
                break;
            case 'up':
                this._cells.forEach(cell => cell.row -= amount);
                break;
            case 'right':
                this._cells.forEach(cell => cell.col += amount);
                break;
            case 'down':
                this._cells.forEach(cell => cell.row += amount);
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }

        this._cacheEndpoints();
    }

    _findConnectedCells() {
        const cellHash = {};
        const startChar = state.getCurrentCelChar(this.start.row, this.start.col);
        const isBlank = startChar[0] === '';
        const diagonal = this.options.diagonal;

        function spread(cell) {
            const cellId = `${cell.row},${cell.col}`;
            if (cellHash[cellId] === undefined) {
                const charObj = state.getCurrentCelChar(cell.row, cell.col);
                // If isBlank, keep any blank cells. Otherwise, keep any cells that are not blank and match the starting color
                if (charObj && (isBlank ? charObj[0] === '' : (charObj[0] !== '' && charObj[1] === startChar[1]))) {
                    cellHash[cellId] = new Cell(cell.row, cell.col);

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
        }

        spread(this.start);

        this._cells = Object.values(cellHash);
        this._cacheEndpoints();
    }

    _cacheEndpoints() {
        const minRow = Math.min(...this._cells.map(cell => cell.row));
        const maxRow = Math.max(...this._cells.map(cell => cell.row));
        const minCol = Math.min(...this._cells.map(cell => cell.col));
        const maxCol = Math.min(...this._cells.map(cell => cell.col));

        this._topLeft = new Cell(minRow, minCol);
        this._bottomRight = new Cell(maxRow, maxCol);
    }

}