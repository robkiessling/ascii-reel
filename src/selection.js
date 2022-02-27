import $ from "jquery";
import { $canvas, numRows, numCols, cells } from './index.js';

// --------------------------------------
let selection = {};
reset();

export function reset() {
    selection = {
        focus: { row: 0, col: 0 },
        topLeft: { row: 0, col: 0 },
        bottomRight: { row: 0, col: 0 }
    };
}

export function refresh() {
    highlightSelection($canvas, cells);
}

export function loadCanvas() {
    reset();

    $canvas.off('mousedown', '.cell').on('mousedown', '.cell', function(evt) {
        const $cell = $(this);
        selectCell($cell.data('row'), $cell.data('col'));
        refresh();
    });
}

export function getFocusedCell() {
    return cells[selection.focus.row][selection.focus.col];
}

export function getSelectedCells() {
    let selectedCells = [];

    for (let r = selection.topLeft.row; r <= selection.bottomRight.row; r++) {
        let selectedRow = [];
        for (let c = selection.topLeft.col; c <= selection.bottomRight.col; c++) {
            selectedRow.push(cells[r][c]);
        }
        selectedCells.push(selectedRow);
    }

    return selectedCells;
}

// export function isInSelection(row, col) {
//     return row >= selection.topLeft.row && row <= selection.bottomRight.row &&
//         col >= selection.topLeft.col && col <= selection.bottomRight.col;
// }


$(document).keydown(function(e) {
    // e.ctrlKey e.altKey e.shiftKey e.metaKey (command/windows)
    if (e.metaKey || e.ctrlKey) {
        return; // Doing a browser operation (like command-R to reload); do not prevent it
    }

    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter

    switch (char) {
        case 'ArrowLeft':
            stepFocus('left');
            break;
        case 'ArrowUp':
            stepFocus('up');
            break;
        case 'ArrowRight':
            stepFocus('right');
            break;
        case 'ArrowDown':
            stepFocus('down');
            break;
        case 'Tab':
            if (e.shiftKey) { stepFocus('left'); } else { stepFocus('right'); }
            break;
        case 'Enter':
            if (e.shiftKey) { stepFocus('up'); } else { stepFocus('down'); }
            break;
        default:
            return; // No changes
    }

    e.preventDefault();
    refresh();
});

function highlightSelection() {
    $canvas.find('.cell').removeClass('selected');

    getSelectedCells().forEach(row => {
        row.forEach(cell => {
            cell.addClass('selected');
        });
    });
}

function selectCell(row, col) {
    selection = {
        focus: { row: row, col: col },
        topLeft: { row: row, col: col },
        bottomRight: { row: row, col: col }
    };
}

function stepFocus(direction) {
    let row = selection.focus.row, col = selection.focus.col;

    switch(direction) {
        case 'left':
            if (col > 0) { col -= 1; }
            break;
        case 'up':
            if (row > 0) { row -= 1; }
            break;
        case 'right':
            if (col < numCols - 1) { col += 1; }
            break;
        case 'down':
            if (row < numRows - 1) { row += 1; }
            break;
        default:
            console.warn(`Invalid stepFocus direction: ${direction}`);
            return;
    }

    selectCell(row, col);
}
