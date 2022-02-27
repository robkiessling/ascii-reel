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

// Returns a 2d array of the latest selection's cells
// Does not work if there are multiple selections
export function getSelectedRect() {
    if (!hasSelection()) {
        return [[]];
    }
    if (hasMultipleSelections()) {
        console.warn("Cannot getSelectedRect with multiple selections");
        return [[]];
    }

    return getRect(latestSelection());
}

// Returns a flat array of selected cells
export function getSelectedCells() {
    let selectedCells = new Set();

    selections.forEach(selection => {
        getRect(selection).flat().forEach(cell => selectedCells.add(cell));
    });

    return [...selectedCells];
}


function getRect(selection) {
    let selectedRect = [];

    // selection start/end are always in two opposite corners. So selection boundaries are min/max of the endpoints
    const topRow = Math.min(selection.start.row, selection.end.row);
    const bottomRow = Math.max(selection.start.row, selection.end.row);
    const leftCol = Math.min(selection.start.col, selection.end.col);
    const rightCol = Math.max(selection.start.col, selection.end.col);

    for (let r = topRow; r <= bottomRow; r++) {
        let selectedRow = [];
        for (let c = leftCol; c <= rightCol; c++) {
            selectedRow.push(cells[r][c]);
        }
        selectedRect.push(selectedRow);
    }
    return selectedRect;
}


$(document).keydown(function(e) {
    // e.ctrlKey e.altKey e.shiftKey e.metaKey (command/windows)

    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter

    switch (char) {
        case 'a':
            if (e.metaKey || e.ctrlKey) {
                selectAll();
                e.preventDefault();
            }
            break;
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

function hasSelection() {
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
