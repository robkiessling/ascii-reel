import $ from "jquery";
import * as selection from "./selection.js";
import {frame, numRows, numCols} from "./index.js";
import {create2dArray, iterate2dArray} from "./utilities.js";

const CELL_WIDTH = 9.6;
const CELL_HEIGHT = 18.6;

const $canvas = $('.ascii-canvas');
selection.bindCanvas($canvas);

let cells = [[]];

export function createFrame() {
    cells = create2dArray(numRows(), numCols(), (r, c) => {
        const $cell = $('<span>', {
            "class": 'cell',
            "data-row": r,
            "data-col": c,
            css: {
                left: c * CELL_WIDTH,
                top: r * CELL_HEIGHT,
                width: CELL_WIDTH,
                height: CELL_HEIGHT
            }
        });

        // const range = [32,127];
        // let char = String.fromCharCode(range[0] + Math.floor((range[1] - range[0]) * Math.random()));
        // $cell.html(char);

        $cell.appendTo($canvas);

        return $cell;
    })

    $canvas.width(numCols() * CELL_WIDTH);
    $canvas.height(numRows() * CELL_HEIGHT);

    refresh();
}

export function refresh() {
    refreshChars();
    refreshSelection();
}

export function refreshChars() {
    iterate2dArray(frame, (value, row, col) => {
        cells[row][col].html(value);
    });
}
export function refreshSelection() {
    $canvas.find('.cell').removeClass('selected');
    selection.getSelectedCoords().forEach(coord => {
        cells[coord.row][coord.col].addClass('selected');
    });
}