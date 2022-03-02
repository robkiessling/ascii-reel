import $ from "jquery";
import * as selection from "./selection.js";
import {create2dArray, iterate2dArray} from "./utilities.js";

const CELL_WIDTH = 9.6;
const CELL_HEIGHT = 18.6;

const $canvas = $('.ascii-canvas');
selection.bindCanvas($canvas);

let cells = [[]];
let chars = [[]];

export function numRows() {
    return chars.length;
}
export function numCols() {
    return chars[0].length;
}

export function getChar(row, col) {
    return chars[row][col];
}
export function updateChar(row, col, value) {
    chars[row][col] = value;
}

export function loadFrame(frame) {
    chars = frame;

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
    iterate2dArray(chars, (value, row, col) => {
        cells[row][col].html(value);
    });
}
export function refreshSelection() {
    $canvas.find('.cell').removeClass('selected');
    selection.getSelectedCoords().forEach(coord => {
        cells[coord.row][coord.col].addClass('selected');
    });
}

/**
 * Translates a 2d array as if it was positioned at a Coord. The callback value will be null for parts of the array
 * that go out of the frame.
 *
 * @param layout        2d array
 * @param coord         Position to move the top-left Coord of the layout to
 * @param callback      function(value, row, col), where row and col are the coordinates if the layout was moved
 */
export function translate(layout, coord, callback) {
    layout.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            const row = rowIndex + coord.row;
            const col = colIndex + coord.col;
            const inBounds = row >= 0 && row < numRows() && col >= 0 && col < numCols();
            callback(inBounds ? value : null, row, col);
        });
    });
}

