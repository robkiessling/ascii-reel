import $ from "jquery";
import * as selection from "./selection.js";
import {iterate2dArray} from "./utilities.js";

export const CELL_HEIGHT = 16;
export const CELL_WIDTH = 16 * 3/5; // Standard monospace ratio is 3/5

const GRID = false;
const GRID_WIDTH = 0.25;
const GRID_COLOR = '#fff';

const SELECTION_COLOR = '#0066ccaa';
const TEXT_COLOR = '#fff'; // TODO This will be configurable

const charCanvas = document.getElementById('char-canvas');
const selectionCanvas = document.getElementById('selection-canvas');
selection.bindCanvas($('#canvas-container').find('canvas').last()); // Using last element since it is on "top"

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

export function loadChars(newChars) {
    chars = newChars;

    setupCanvas(charCanvas);
    setupCanvas(selectionCanvas);

    refresh();
}

export function refresh() {
    refreshChars();
    refreshSelection();
}

export function refreshChars() {
    const charCtx = charCanvas.getContext("2d");

    clearCanvas(charCanvas);

    // Draw all chars using fillText
    iterate2dArray(chars, (value, coord) => {
        charCtx.fillStyle = TEXT_COLOR;
        coord.translate(0.5, 0.5); // Move coord by 50% of a cell, so we can draw char in center of cell
        charCtx.fillText(value, ...coord.xy());
    });

    if (GRID) {
        drawGrid(charCanvas);
    }
}

export function refreshSelection() {
    const selectionCtx = selectionCanvas.getContext("2d");

    clearCanvas(selectionCanvas);

    // Draw all selection rectangles
    selection.getSelectedCoords().forEach(coord => {
        selectionCtx.fillStyle = SELECTION_COLOR;
        selectionCtx.fillRect(...coord.xywh());
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


function setupCanvas(canvas) {
    const context = canvas.getContext("2d");

    // Fix canvas PPI https://stackoverflow.com/a/65124939/4904996
    let ratio = window.devicePixelRatio;
    canvas.width = canvasWidth() * ratio;
    canvas.height = canvasHeight() * ratio;
    canvas.style.width = canvasWidth() + "px";
    canvas.style.height = canvasHeight() + "px";
    context.scale(ratio, ratio);

    // Set up font
    context.font = '1rem monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
}

function clearCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGrid(canvas) {
    const context = canvas.getContext("2d");
    context.strokeStyle = GRID_COLOR;

    iterate2dArray(chars, (value, coord) => {
        if (coord.row !== 0) {
            context.beginPath();
            context.lineWidth = GRID_WIDTH;
            context.moveTo(...coord.xy());
            coord.translate(0, 1); // Move coord 1 cell to the right
            context.lineTo(...coord.xy());
            context.stroke();
        }

        if (coord.col !== 0) {
            context.beginPath();
            context.lineWidth = GRID_WIDTH;
            context.moveTo(...coord.xy());
            coord.translate(1, 0); // Move coord 1 cell down
            context.lineTo(...coord.xy());
            context.stroke();
        }
    });

    context.beginPath();
    context.lineWidth = GRID_WIDTH * 2;
    context.rect(0, 0, canvasWidth(), canvasHeight());
    context.stroke();
}

function canvasWidth() {
    return numCols() * CELL_WIDTH;
}

function canvasHeight() {
    return numRows() * CELL_HEIGHT;
}