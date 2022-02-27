import $ from "jquery";
import { $canvas, numRows, numCols, cells } from './index.js';

// --------------------------------------
let selection = {};
clearSelection();

export function loadCanvas() {
    clearSelection();

    let isSelecting = false;

    $canvas.off('mousedown', '.cell').on('mousedown', '.cell', function(evt) {
        isSelecting = true;
        const $cell = $(this);
        selectCell($cell.data('row'), $cell.data('col'));
    }).off('mousemove', '.cell').on('mousemove', '.cell', function(evt) {
        if (isSelecting) {
            const $cell = $(this);
            selection.end = { row: $cell.data('row'), col: $cell.data('col') };
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
        getSelectedCells().flat().forEach(cell => cell.addClass('selected'));
    }
}

export function getSelectedCells() {
    let selectedCells = [];

    if (!hasSelection()) {
        return selectedCells;
    }

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
        selectedCells.push(selectedRow);
    }

    return selectedCells;
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
            clearSelection();
            break;
        case 'ArrowLeft':
            moveSelection('left', !e.shiftKey); // If shift key is pressed, we only want to move the end point
            break;
        case 'ArrowUp':
            moveSelection('up', !e.shiftKey);
            break;
        case 'ArrowRight':
            moveSelection('right', !e.shiftKey);
            break;
        case 'ArrowDown':
            moveSelection('down', !e.shiftKey);
            break;
        case 'Tab':
            if (e.shiftKey) { moveSelection('left'); } else { moveSelection('right'); }
            break;
        case 'Enter':
            if (e.shiftKey) { moveSelection('up'); } else { moveSelection('down'); }
            break;
        default:
            return; // No changes
    }
});

function hasSelection() {
    return selection.start.row !== null;
}

function clearSelection() {
    selectCell(null, null);
}

function selectCell(row, col) {
    selection = {
        start: { row: row, col: col },
        end: { row: row, col: col }
    };
    refresh();
}

function selectAll() {
    selection = {
        start: { row: 0, col: 0 },
        end: { row: numRows - 1, col: numCols - 1 }
    };
    refresh();
}

function moveSelection(direction, moveStart = true, moveEnd = true) {
    if (!hasSelection()) {
        selectCell(0, 0);
        return;
    }

    switch(direction) {
        case 'left':
            if (moveStart && selection.start.col > 0) { selection.start.col -= 1; }
            if (moveEnd && selection.end.col > 0) { selection.end.col -= 1; }
            break;
        case 'up':
            if (moveStart && selection.start.row > 0) { selection.start.row -= 1; }
            if (moveEnd && selection.end.row > 0) { selection.end.row -= 1; }
            break;
        case 'right':
            if (moveStart && selection.start.col < numCols - 1) { selection.start.col += 1; }
            if (moveEnd && selection.end.col < numCols - 1) { selection.end.col += 1; }
            break;
        case 'down':
            if (moveStart && selection.start.row < numRows - 1) { selection.start.row += 1; }
            if (moveEnd && selection.end.row < numRows - 1) { selection.end.row += 1; }
            break;
        default:
            console.warn(`Invalid moveSelection direction: ${direction}`);
            return;
    }

    refresh();
}
