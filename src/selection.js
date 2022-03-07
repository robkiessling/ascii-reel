import $ from "jquery";
import {create2dArray} from "./utilities.js";
import {Cell, CellArea} from "./canvas.js";
import {getChar, numCols, numRows, refresh} from "./index.js";

// The full selection is made up of 1 or more SelectionAreas. All SelectionAreas are highlighted in the editor.
export let selectionAreas = [];

export function hasSelection() {
    return selectionAreas.length > 0;
}

export function clear() {
    selectionAreas = [];
    refresh('selection');
}

export function selectAll() {
    selectionAreas = [SelectionArea.drawableArea()];
    refresh('selection');
}

export function bindMouseToCanvas(canvasControl) {
    let isSelecting = false;

    canvasControl.$canvas.off('mousedown.selection').on('mousedown.selection', evt => {
        isSelecting = true;

        if (!evt.metaKey && !evt.ctrlKey && !evt.shiftKey) {
            clear();
        }

        if (evt.metaKey || evt.ctrlKey || !lastArea()) {
            startArea(canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY));
        }

        if (evt.shiftKey) {
            lastArea().end = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
            refresh('selection');
        }
    });
    canvasControl.$canvas.off('mousemove.selection').on('mousemove.selection', evt => {
        if (isSelecting) {
            lastArea().end = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
            refresh('selection');
        }
    });

    $(document).off('mouseup.selection').on('mouseup.selection', evt => {
        if (isSelecting) {
            isSelecting = false;
            refresh('selection');
        }
    });
}

/**
 * Returns a 2d array of values for the smallest CellArea that bounds all SelectionAreas. This 2d array will contain null values
 * for any gaps between selectionAreas (if any).
 *
 * E.g. If the selectionAreas (depicted by x's) were this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *
 *        [
 *          [x, x, null, null, null],
 *          [x, x, null, null, x]
 *        ]
 *
 * By default, returned values are the displayed chars. Can pass a @processor parameter to return a custom value.
 */
export function getSelectedValues(processor = function(r, c) { return getChar(r, c); }) {
    if (!hasSelection()) {
        return [[]];
    }

    // Start with 2d array of nulls
    let selectedArea = getSelectedArea();
    let values = create2dArray(selectedArea.numRows, selectedArea.numCols, null);

    // Iterate through selectionAreas, populating values with cell values
    selectionAreas.forEach(selectionArea => {
        selectionArea.toCellArea().iterate((r, c) => {
            const relativeRow = r - selectedArea.topLeft.row;
            const relativeCol = c - selectedArea.topLeft.col;
            values[relativeRow][relativeCol] = processor(r, c);
        })
    })

    return values;
}

/**
 * Returns a flat array of Cell objects for all selected cells.
 *
 * E.g. If the selectionAreas (depicted by x's) were this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *
 *        [Cell{row:1,col:2}, Cell{row:1,col:3}, Cell{row:2,col:2}, Cell{row:2,col:3}, Cell{row:2,col:6}]
 */
export function getSelectedCells() {
    return getSelectedValues((r, c) => {
        return new Cell(r, c);
    }).flat().filter(cell => cell !== null);
}

/**
 * Returns the smallest possible CellArea that includes all SelectionAreas.
 *
 * E.g. If the selectionAreas (depicted by x's) were this:
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
export function getSelectedArea() {
    let mergedArea;

    selectionAreas.forEach(selectionArea => {
        if (mergedArea) {
            mergedArea.mergeArea(selectionArea.toCellArea());
        }
        else {
            mergedArea = selectionArea.toCellArea();
        }
    });

    return mergedArea;
}

// Move all selectionAreas in a particular direction
export function moveSelection(direction, moveStart = true, moveEnd = true) {
    if (!hasSelection()) {
        startArea(new Cell(0, 0));
        return;
    }

    // if (selectionAreas.every(selectionArea => selectionArea.canMove(direction, moveStart, moveEnd))) {
        selectionAreas.forEach(selectionArea => selectionArea.move(direction, moveStart, moveEnd));
    // }

    refresh('selection');
}

function lastArea() {
    return selectionAreas[selectionAreas.length - 1];
}

function startArea(cell) {
    selectionAreas.push(new SelectionArea(cell, cell.clone()));
    refresh('selection');
}

/**
 * A SelectionArea is like a CellArea, but instead of having topLeft and bottomRight Cells, it has start and end Cells.
 * The start Cell may be to the bottom or right of the end Cell, depending on how the user draws the rectangle.
 * You can still call the helper methods topLeft / bottomRight if you need the absolute end points.
 *
 * It currently does NOT extend CellArea, and does not have any methods dealing with x/y/width/height (not needed at the
 * moment). Any time we need those values, we just convert it to a CellArea (using toCellArea).
 */
class SelectionArea {
    constructor(start, end) {
        this.start = start; // Cell
        this.end = end; // Cell
    }

    static drawableArea() {
        return new SelectionArea(new Cell(0, 0), new Cell(numRows() - 1, numCols() - 1));
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
        return new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col))
    }

    toCellArea() {
        return new CellArea(this.topLeft, this.bottomRight);
    }

    // Returns true if this selectionArea can be moved 1 space in the given direction
    canMove(direction, moveStart = true, moveEnd = true) {
        switch(direction) {
            case 'left':
                if (moveStart && this.start.col <= 0) { return false; }
                if (moveEnd && this.end.col <= 0) { return false; }
                break;
            case 'up':
                if (moveStart && this.start.row <= 0) { return false; }
                if (moveEnd && this.end.row <= 0) { return false; }
                break;
            case 'right':
                if (moveStart && this.start.col >= numCols() - 1) { return false; }
                if (moveEnd && this.end.col >= numCols() - 1) { return false; }
                break;
            case 'down':
                if (moveStart && this.start.row >= numRows() - 1) { return false; }
                if (moveEnd && this.end.row >= numRows() - 1) { return false; }
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
                return false;
        }
        return true;
    }

    // Move this selectionArea 1 space in the given direction. Does not respect boundaries (you should call canMove first)
    move(direction, moveStart = true, moveEnd = true) {
        switch(direction) {
            case 'left':
                if (moveStart) { this.start.col -= 1; }
                if (moveEnd) { this.end.col -= 1; }
                break;
            case 'up':
                if (moveStart) { this.start.row -= 1; }
                if (moveEnd) { this.end.row -= 1; }
                break;
            case 'right':
                if (moveStart) { this.start.col += 1; }
                if (moveEnd) { this.end.col += 1; }
                break;
            case 'down':
                if (moveStart) { this.start.row += 1; }
                if (moveEnd) { this.end.row += 1; }
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
    }
}
