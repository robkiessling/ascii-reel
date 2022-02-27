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

function loadFrame(newFrame) {
    frame = newFrame;
    canvas.createFrame();
}

loadFrame(create2dArray(20, 50));
