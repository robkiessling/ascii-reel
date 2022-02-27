import './styles/app.scss'
import $ from 'jquery';
import * as selection from './selection.js';

const CELL_WIDTH = 9.6;
const CELL_HEIGHT = 18.6;

export const $canvas = $('.ascii-canvas');
export let numRows = 20;
export let numCols = 50;
export let cells = [[]];

$canvas.width(numCols * CELL_WIDTH);
$canvas.height(numRows * CELL_HEIGHT);

selection.loadCanvas();
createCellElements();
repaint();

function createCellElements() {
    cells = [];

    for (let r = 0; r < numRows; r++) {
        cells.push([]);

        for (let c = 0; c < numCols; c++) {
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
            cells[r].push($cell);
        }
    }
}

function repaint() {
    selection.refresh();
    // todo refresh other plugins
}

$(document).keydown(function(e) {
    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter
    console.log(code, char);

    // e.ctrlKey e.altKey e.shiftKey e.metaKey (command/windows)
    if (e.metaKey || e.ctrlKey) {
        return; // Doing a browser operation (like command-R to reload); do not prevent it
    }

    if (char === 'Unidentified') {
        console.warn(`Unidentified key for event: ${e}`);
        return;
    }

    switch (char) {
        case 'Backspace':
            selection.getSelectedCells().forEach(cell => cell.html(''));
            break;
        default:
            if (                                // Keyboard keycodes that produce output:
                (code === 32) ||                // space bar
                (code >= 48 && code <= 57) ||   // 0-9
                (code >= 65 && code <= 90) ||   // a-z
                (code >= 186 && code <= 192) || // ;=,-./`
                (code >= 219 && code <= 222)    // [\]'
            ) {
                selection.getSelectedCells().forEach(cell => cell.html(char));
            }
            break;
    }

    e.preventDefault();
    repaint();
});
