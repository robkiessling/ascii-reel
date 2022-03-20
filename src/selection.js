import $ from "jquery";
import {create2dArray} from "./utilities.js";
import {Cell, CellArea} from "./canvas.js";
import {triggerRefresh} from "./index.js";
import * as state from "./state.js";
import bresenham from "bresenham";

let polygons = [];

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

export function bindMouseToCanvas(canvasControl) {
    let isSelecting = false;

    canvasControl.$canvas.off('mousedown.selection').on('mousedown.selection', evt => {
        if (evt.which !== 1) { return; } // Only apply to left-click

        isSelecting = true;

        if (!evt.shiftKey) {
            clear();
        }

        const cell = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY, true);
        if (cell) {
            startPolygon(cell)
        }
    });

    canvasControl.$canvas.off('mousemove.selection').on('mousemove.selection', evt => {
        if (isSelecting) {
            lastPolygon().end = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
            triggerRefresh('selection');
        }
    });

    $(document).off('mouseup.selection').on('mouseup.selection', evt => {
        if (isSelecting) {
            isSelecting = false;
            triggerRefresh('selection');
        }
    });
}

/**
 * Returns a 2d array of values for the smallest CellArea that bounds all polygons. This 2d array will contain
 * empty strings for any gaps between polygons (if any).
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
 *          ['x', 'x', null, null, null],
 *          ['x', 'x', null, null, 'x']
 *        ]
 *
 */
export function getSelectedValues() {
    if (!hasSelection()) {
        return [[]];
    }

    // Start with 2d array of nulls
    const cellArea = getSelectedCellArea();
    let values = create2dArray(cellArea.numRows, cellArea.numCols, null);

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

function startPolygon(cell) {
    switch(state.config('tool')) {
        case 'selection-rect':
            polygons.push(new SelectionRect(cell, cell.clone()));
            triggerRefresh('selection');
            break;
        case 'selection-line':
            polygons.push(new SelectionLine(cell, cell.clone()));
            triggerRefresh('selection');
            break;
        default:
            console.log('No polygon for tool: ', state.config('tool'));
    }
}

/**
 * SelectionPolygon is the base class for many types of selection shapes. All polygons have a start value (where the
 * user first clicked) and an end value (where the user's last mouse position was).
 *
 * Subclasses must implement an 'iterateCells' function and a 'draw' function.
 */
class SelectionPolygon {
    constructor(start, end) {
        this.start = start; // Cell
        this.end = end; // Cell
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
        this._cells().forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this._cells().forEach(cell => context.fillRect(...cell.xywh));
    }

    _cells() {
        // Using Bresenham line approximation https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
        return bresenham(this.start.col, this.start.row, this.end.col, this.end.row).map(coord => {
            return new Cell(coord.y, coord.x);
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
        context.fillRect(...this._toCellArea().xywh);
    }

    _toCellArea() {
        return new CellArea(this.topLeft, this.bottomRight);
    }
}
