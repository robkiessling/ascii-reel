import $ from "jquery";
import {frame, numRows, numCols} from './index.js';
import * as canvas from "./canvas.js";
import {create2dArray, Coord, Rect} from "./utilities.js";

let partials = [];

export function hasSelection() {
    return partials.length > 0;
}

export function clear() {
    partials = [];
    canvas.refreshSelection();
}

export function selectAll() {
    partials.push(new Partial(new Coord(0, 0), new Coord(numRows() - 1, numCols() - 1)));
    canvas.refreshSelection();
}

export function bindCanvas($canvas) {
    let isSelecting = false;

    $canvas.off('mousedown.selection', '.cell').on('mousedown.selection', '.cell', function(evt) {
        isSelecting = true;
        const $cell = $(this);

        if (!evt.metaKey && !evt.ctrlKey && !evt.shiftKey) {
            clear();
        }

        if (evt.metaKey || evt.ctrlKey || !latestPartial()) {
            startPartial($cell.data('row'), $cell.data('col'));
        }

        if (evt.shiftKey) {
            latestPartial().end = { row: $cell.data('row'), col: $cell.data('col') };
            canvas.refreshSelection();
        }
    }).off('mousemove.selection', '.cell').on('mousemove.selection', '.cell', function(evt) {
        if (isSelecting) {
            const $cell = $(this);
            latestPartial().end = { row: $cell.data('row'), col: $cell.data('col') };
            canvas.refreshSelection();
        }
    });

    $(document).off('mouseup.selection').on('mouseup.selection', function(evt) {
        if (isSelecting) {
            isSelecting = false;
            canvas.refreshSelection();
        }
    });
}

/**
 * Returns a 2d array of the smallest Rect that bounds all partials. This 2d array will contain null cells
 * if there are gaps in the Rect.
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
 * By default, values are frame chars (frame[r][c]). Can pass a @processor parameter to store a custom value.
 */
export function getSelection(processor = function(r, c) { return frame[r][c]; }) {
    if (!hasSelection()) {
        return [[]];
    }

    // Fill selection with nulls
    let selectionRect = getSelectionRect();
    let selection = create2dArray(selectionRect.height(), selectionRect.width(), null);

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
 * Returns a flat array of Coord objects for all selected cells.
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
 *        [{row:1,col:2}, {row:1,col:3}, {row:2,col:2}, {row:2,col:3}, {row:2,col:6}]
 */
export function getSelectedCoords() {
    return getSelection((r, c) => {
        return new Coord(r, c);
    }).flat().filter(cell => cell !== null);
}

/**
 * Returns top-left and bottom-right Coord objects for the smallest Rect that includes all partials.
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
 *        { topLeft: {row:1,col:2}, bottomRight: {row:2,col:6} }
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
        startPartial(0, 0);
        return;
    }

    if (partials.every(partial => partial.canMove(direction, moveStart, moveEnd))) {
        partials.forEach(partial => partial.move(direction, moveStart, moveEnd));
    }

    canvas.refreshSelection();
}



function latestPartial() {
    return partials[partials.length - 1];
}

function startPartial(row, col) {
    partials.push(new Partial(new Coord(row, col), new Coord(row, col)));
    canvas.refreshSelection();
}


/**
 * A partial is like a Rect, but instead of having topLeft and bottomRight Coords, it has start and end Coords.
 * The start Coord may be to the bottom-right of the end Coord, depending on how the user draws the rectangle.
 * You can call the helper methods topLeft() / bottomRight() if you need the absolute end points.
 */
class Partial {
    constructor(start, end) {
        this.start = start; // Coord
        this.end = end; // Coord
    }

    topLeft() {
        return new Coord(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }

    bottomRight() {
        return new Coord(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col))
    }

    toRect() {
        return new Rect(this.topLeft(), this.bottomRight());
    }

    // Returns true if this partial can be moved 1 space in the given direction
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

    // Move this partial 1 space in the given direction. Does not respect boundaries (you should call canMove first)
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
