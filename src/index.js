import './styles/app.scss'
import {create2dArray} from "./utilities.js";

// Import necessary files (required even if they are not used by name in this file)
import * as canvas from './canvas.js';
import * as keyboard from './keyboard.js';
import * as selection from './selection.js';
import * as clipboard from './clipboard.js';

export let frame = [[]];

export function numRows() {
    return frame.length;
}
export function numCols() {
    return frame[0].length;
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

function loadFrame(newFrame) {
    frame = newFrame;
    canvas.createFrame();
}

loadFrame(create2dArray(20, 50));
