import $ from "jquery";
import { $canvas, numRows, numCols, cells } from './index.js';

let selections = [];
clearSelections();

export function loadCanvas() {
    clearSelections();

    let isSelecting = false;

    $canvas.off('mousedown', '.cell').on('mousedown', '.cell', function(evt) {
        isSelecting = true;
        const $cell = $(this);

        if (!evt.metaKey && !evt.ctrlKey && !evt.shiftKey) {
            clearSelections();
        }

        if (evt.metaKey || evt.ctrlKey || !latestSelection()) {
            startSelection($cell.data('row'), $cell.data('col'));
        }

        if (evt.shiftKey) {
            latestSelection().end = { row: $cell.data('row'), col: $cell.data('col') };
            refresh();
        }
    }).off('mousemove', '.cell').on('mousemove', '.cell', function(evt) {
        if (isSelecting) {
            const $cell = $(this);
            latestSelection().end = { row: $cell.data('row'), col: $cell.data('col') };
            refresh();
        }
    });

    $(document).off('mouseup').on('mouseup', function(evt) {
        if (isSelecting) {
            isSelecting = false;
            refresh();
        }
    });
}

export function refresh() {
    if ($canvas) {
        $canvas.find('.cell').removeClass('selected');
        getSelectedCells().forEach(cell => cell.addClass('selected'));
    }
}

// If part of the applied layout will end up out of bounds, the callback will return a null value for that point
export function applyLayoutAtPoint(layout, point, callback) {
    layout.forEach((layoutRowValues, layoutRow) => {
        layoutRowValues.forEach((layoutValue, layoutCol) => {
            // Final row/col is the layout translated by the origin point
            const row = layoutRow + point.row;
            const col = layoutCol + point.col;
            callback(row < 0 || row >= numRows || col < 0 || col >= numCols ? null : layoutValue, row, col);
        })
    })
}

/**
 * Returns a 2d array of the smallest rectangle that bounds all selections. This 2d array will contain null cells
 * if there are multiple selections with gaps in between them.
 *
 * E.g. If the selection (depicted by x's) was this:
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
 */
export function getSelectionLayout(processor = function(cell, r, c) { return cell; }) {
    if (!hasSelection()) {
        return [[]];
    }

    let layout = [];

    // Find outermost boundaries for the layout
    let { topLeft: layoutTopLeft, bottomRight: layoutBottomRight } = getLayoutCorners();

    // Fill layout with nulls
    cornerToCorner(layoutTopLeft, layoutBottomRight, (r, c) => {
        if (!layout[r - layoutTopLeft.row]) { layout[r - layoutTopLeft.row] = []; }
        layout[r - layoutTopLeft.row][c - layoutTopLeft.col] = null;
    });

    // Iterate through selections, filling layout with cell values
    selections.forEach(selection => {
        const { topLeft, bottomRight } = getCorners(selection);
        cornerToCorner(topLeft, bottomRight, (r, c) => {
            layout[r - layoutTopLeft.row][c - layoutTopLeft.col] = processor(cells[r][c], r, c);
        })
    });

    return layout;
}

/**
 * Returns a flat array of selected cells from all selections.
 *
 * E.g. If the selection (depicted by x's) was this:
 *
 *        .......
 *        ..xx...
 *        ..xx..x
 *        .......
 *
 *      Returns:
 *
 *        [x, x, x, x, x]
 */
export function getSelectedCells() {
    return getSelectionLayout().flat().filter(cell => cell !== null);
}

export function getLayoutCorners() {
    let layoutTopLeft = { row: null, col: null };
    let layoutBottomRight = { row: null, col: null };
    selections.forEach(selection => {
        const { topLeft, bottomRight } = getCorners(selection);
        if (layoutTopLeft.row === null || topLeft.row < layoutTopLeft.row) { layoutTopLeft.row = topLeft.row; }
        if (layoutTopLeft.col === null || topLeft.col < layoutTopLeft.col) { layoutTopLeft.col = topLeft.col; }
        if (layoutBottomRight.row === null || bottomRight.row > layoutBottomRight.row) { layoutBottomRight.row = bottomRight.row; }
        if (layoutBottomRight.col === null || bottomRight.col > layoutBottomRight.col) { layoutBottomRight.col = bottomRight.col; }
    });
    return {
        topLeft: layoutTopLeft,
        bottomRight: layoutBottomRight
    };
}

function getCorners(selection) {
    return {
        topLeft: {
            row: Math.min(selection.start.row, selection.end.row),
            col: Math.min(selection.start.col, selection.end.col)
        },
        bottomRight: {
            row: Math.max(selection.start.row, selection.end.row),
            col: Math.max(selection.start.col, selection.end.col)
        }
    }
}

function cornerToCorner(topLeft, bottomRight, callback) {
    for (let r = topLeft.row; r <= bottomRight.row; r++) {
        for (let c = topLeft.col; c <= bottomRight.col; c++) {
            callback(r, c);
        }
    }
}



$(document).keydown(function(e) {
    // e.ctrlKey e.altKey e.shiftKey e.metaKey (command/windows)

    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter

    // Commands
    if (e.metaKey || e.ctrlKey) {
        switch (char) {
            case 'a':
                selectAll();
                break;
            default:
                return;
        }

        e.preventDefault(); // One of the commands was used, prevent default
        return;
    }

    switch (char) {
        case 'Escape':
            clearSelections();
            break;
        case 'ArrowLeft':
            moveSelections('left', !e.shiftKey); // If shift key is pressed, we only want to move the end point
            break;
        case 'ArrowUp':
            moveSelections('up', !e.shiftKey);
            break;
        case 'ArrowRight':
            moveSelections('right', !e.shiftKey);
            break;
        case 'ArrowDown':
            moveSelections('down', !e.shiftKey);
            break;
        case 'Tab':
            if (e.shiftKey) { moveSelections('left'); } else { moveSelections('right'); }
            break;
        case 'Enter':
            if (e.shiftKey) { moveSelections('up'); } else { moveSelections('down'); }
            break;
        default:
            return; // No changes
    }
});

export function hasSelection() {
    return selections.length > 0;
}

function hasMultipleSelections() {
    return selections.length > 1;
}

function latestSelection() {
    return selections[selections.length - 1];
}

function clearSelections() {
    selections = [];
    refresh();
}

function startSelection(row, col) {
    selections.push({
        start: { row: row, col: col },
        end: { row: row, col: col }
    });
    refresh();
}

function selectAll() {
    selections = [{
        start: { row: 0, col: 0 },
        end: { row: numRows - 1, col: numCols - 1 }
    }];
    refresh();
}

// Move all selections in a particular direction, as long as they can ALL move in that direction without hitting boundaries
function moveSelections(direction, moveStart = true, moveEnd = true) {
    if (!hasSelection()) {
        startSelection(0, 0);
        return;
    }

    if (selections.every(selection => canMoveSelection(selection, direction, moveStart, moveEnd))) {
        selections.forEach(selection => moveSelection(selection, direction, moveStart, moveEnd));
    }
}

function canMoveSelection(selection, direction, moveStart = true, moveEnd = true) {
    switch(direction) {
        case 'left':
            if (moveStart && selection.start.col <= 0) { return false; }
            if (moveEnd && selection.end.col <= 0) { return false; }
            break;
        case 'up':
            if (moveStart && selection.start.row <= 0) { return false; }
            if (moveEnd && selection.end.row <= 0) { return false; }
            break;
        case 'right':
            if (moveStart && selection.start.col >= numCols - 1) { return false; }
            if (moveEnd && selection.end.col >= numCols - 1) { return false; }
            break;
        case 'down':
            if (moveStart && selection.start.row >= numRows - 1) { return false; }
            if (moveEnd && selection.end.row >= numRows - 1) { return false; }
            break;
        default:
            console.warn(`Invalid moveSelection direction: ${direction}`);
            return false;
    }
    return true;
}

// Move a selection in a direction. Does not respect boundaries (you should call canMoveSelection first)
function moveSelection(selection, direction, moveStart = true, moveEnd = true) {
    switch(direction) {
        case 'left':
            if (moveStart) { selection.start.col -= 1; }
            if (moveEnd) { selection.end.col -= 1; }
            break;
        case 'up':
            if (moveStart) { selection.start.row -= 1; }
            if (moveEnd) { selection.end.row -= 1; }
            break;
        case 'right':
            if (moveStart) { selection.start.col += 1; }
            if (moveEnd) { selection.end.col += 1; }
            break;
        case 'down':
            if (moveStart) { selection.start.row += 1; }
            if (moveEnd) { selection.end.row += 1; }
            break;
        default:
            console.warn(`Invalid moveSelection direction: ${direction}`);
    }
}
