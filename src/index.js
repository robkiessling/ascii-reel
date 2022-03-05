import $ from "jquery";
import './styles/app.scss'
import {create2dArray, randomPrintableChar} from "./utilities.js";
import {CanvasControl} from './canvas.js';
import './preview.js';
import './keyboard.js';
import * as selection from './selection.js';
import './clipboard.js';

let chars = [[]];

const charCanvas = new CanvasControl($('#char-canvas'), {});
const selectionCanvas = new CanvasControl($('#selection-canvas'), {});
selection.bindToCanvas(selectionCanvas);

const ZOOM_SPEED = 1;
selectionCanvas.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
    evt.preventDefault();

    const deltaY = evt.originalEvent.deltaY;
    if (deltaY === 0) { return; }
    const scaledDelta = -deltaY * ZOOM_SPEED / 300;
    charCanvas.zoomDelta(scaledDelta);
    selectionCanvas.zoomDelta(scaledDelta);
    refresh();
});

function loadChars(newChars) {
    chars = newChars;
    charCanvas.rebuild();
    selectionCanvas.rebuild();
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
                charCanvas.drawChars(chars);
                break;
            case 'selection':
                selectionCanvas.highlightSelection(selection.getSelectedCells());
                break;
            default:
                console.warn(`refresh("${specificCanvas}") is not a valid canvas`);
        }
    }
    else {
        charCanvas.drawChars(chars);
        selectionCanvas.highlightSelection(selection.getSelectedCells());
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
