import $ from "jquery";
import * as canvas from "./canvas.js";
import {create2dArray} from "./utilities.js";
import {Cell, Partial} from "./canvas.js";

// The selection is made up of 1 or more Partials. All Partials are highlighted in the editor.
export let partials = [];

export function hasSelection() {
    return partials.length > 0;
}

export function clear() {
    partials = [];
    canvas.refresh('selection');
}

export function selectAll() {
    partials = [Partial.drawableArea()];
    canvas.refresh('selection');
}

export function bindCanvas($canvas) {
    let isSelecting = false;

    $canvas.off('mousedown.selection').on('mousedown.selection', evt => {
        isSelecting = true;

        if (!evt.metaKey && !evt.ctrlKey && !evt.shiftKey) {
            clear();
        }

        if (evt.metaKey || evt.ctrlKey || !latestPartial()) {
            startPartial(Cell.fromExternalXY(evt.offsetX, evt.offsetY));
        }

        if (evt.shiftKey) {
            latestPartial().end = Cell.fromExternalXY(evt.offsetX, evt.offsetY);
            canvas.refresh('selection');
        }
    });
    $canvas.off('mousemove.selection').on('mousemove.selection', evt => {
        if (isSelecting) {
            latestPartial().end = Cell.fromExternalXY(evt.offsetX, evt.offsetY);
            canvas.refresh('selection');
        }
    });

    $(document).off('mouseup.selection').on('mouseup.selection', evt => {
        if (isSelecting) {
            isSelecting = false;
            canvas.refresh('selection');
        }
    });
}

/**
 * Returns a 2d array of values for the smallest Rect that bounds all Partials. This 2d array will contain null values
 * for any gaps between partials (if any).
 *
 * E.g. If the partials (depicted by x's) were this:
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
export function getSelection(processor = function(r, c) { return canvas.getChar(r, c); }) {
    if (!hasSelection()) {
        return [[]];
    }

    // Fill selection with nulls
    let selectionRect = getSelectionRect();
    let selection = create2dArray(selectionRect.numRows, selectionRect.numCols, null);

    // Iterate through partials, populating selection with cell values
    partials.forEach(partial => {
        partial.toRect().iterate((r, c) => {
            const relativeRow = r - selectionRect.topLeft.row;
            const relativeCol = c - selectionRect.topLeft.col;
            selection[relativeRow][relativeCol] = processor(r, c);
        })
    })

    return selection;
}

/**
 * Returns a flat array of Cell objects for all selected cells.
 *
 * E.g. If the partials (depicted by x's) were this:
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
    return getSelection((r, c) => {
        return new Cell(r, c);
    }).flat().filter(cell => cell !== null);
}

/**
 * Returns the smallest possible Rect that includes all Partials.
 *
 * E.g. If the partials (depicted by x's) were this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *
 *        Rect{ topLeft: {row:1,col:2}, bottomRight: {row:2,col:6} }
 *
 */
export function getSelectionRect() {
    let rect;

    partials.forEach(partial => {
        if (rect) {
            rect.mergeRect(partial.toRect());
        }
        else {
            rect = partial.toRect();
        }
    });

    return rect;
}

// Move all partials in a particular direction, as long as they can ALL move in that direction without hitting boundaries
export function moveSelection(direction, moveStart = true, moveEnd = true) {
    if (!hasSelection()) {
        startPartial(new Cell(0, 0));
        return;
    }

    // if (partials.every(partial => partial.canMove(direction, moveStart, moveEnd))) {
        partials.forEach(partial => partial.move(direction, moveStart, moveEnd));
    // }

    canvas.refresh('selection');
}

function latestPartial() {
    return partials[partials.length - 1];
}

function startPartial(cell) {
    partials.push(new Partial(cell, cell.clone()));
    canvas.refresh('selection');
}

