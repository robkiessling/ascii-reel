import $ from "jquery";
import './styles/app.scss'
import {create2dArray, randomPrintableChar} from "./utilities.js";
import {CanvasControl} from './canvas.js';
import './preview.js';
import './keyboard.js';
import * as selection from './selection.js';
import './clipboard.js';

export let chars = [[]];

export const charCanvas = new CanvasControl($('#char-canvas'), {

});
export const selectionCanvas = new CanvasControl($('#selection-canvas'), {
    zoom: {
        enabled: true
    }
});
selection.bindCanvas(selectionCanvas.$canvas);

function loadChars(newChars) {
    chars = newChars;
    charCanvas.zoom.zoom();
    selectionCanvas.zoom.zoom();
    refresh();
}

export function getChar(row, col) {
    return chars[row][col];
}
export function updateChar(row, col, value) {
    chars[row][col] = value;
}

export function numRows() {
    return chars.length;
}
export function numCols() {
    return chars[0].length;
}

export function refresh(specificCanvas) {
    if (specificCanvas) {
        switch(specificCanvas) {
            case 'chars':
                charCanvas.refreshChars();
                break;
            case 'selection':
                selectionCanvas.refreshSelection();
                break;
            default:
                console.warn(`refresh("${specificCanvas}") is not a valid canvas`);
        }
    }
    else {
        charCanvas.refreshChars();
        selectionCanvas.refreshSelection();
    }

    // updatePreview(charCanvas);
}


loadChars(create2dArray(30, 50, () => randomPrintableChar()));
// loadChars(create2dArray(6, 10, (row, col) => {
//     if (row < 2) {
//         return randomPrintableChar();
//     } else if (row < 4) {
//         return ' ';
//     }
//     else {
//         return '';
//     }
// }));
// loadChars(create2dArray(30, 50, (row, col) => {
//     return row % 10 === 0 && col % 10 === 0 ? 'X' : '';
// }));
