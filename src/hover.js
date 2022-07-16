import {triggerRefresh} from "./index.js";
import * as state from './state.js';
import {DRAWING_TOOLS} from "./editor.js";
import {Cell} from "./canvas.js";

export let hoveredCell = null;

export function setupMouseEvents(canvasControl) {
    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell, tool) => {
        hoveredCell = cell;
        triggerRefresh('hoveredCell');
    });

    canvasControl.$canvas.on('editor:mouseenter', (evt, mouseEvent, cell) => {
        hoveredCell = cell;
        triggerRefresh('hoveredCell');
    });

    canvasControl.$canvas.on('editor:mouseleave', () => {
        hoveredCell = null;
        triggerRefresh('hoveredCell');
    });
}


export function iterateHoveredCells(callback) {
    // If not using a drawing-tool, only include hoveredCell (the cell the mouse is over)
    if (!DRAWING_TOOLS.includes(state.config('tool'))) {
        callback(hoveredCell);
        return;
    }

    // If using a drawing-tool, other nearby cells will be iterated through depending on the chosen shape/size
    let { shape, size } = state.config('drawingShape');

    switch(shape) {
        case 'square':
            return iterateSquareShape(size, callback);
        case 'circle':
            return iterateCircleShape(size, callback);
        default:
            console.error('Unsupported drawing shape: ', shape);
    }
}

// Iterates through cells in a square shape, centered around the hoveredCell
function iterateSquareShape(size, callback) {
    const offset = Math.floor(size / 2);

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            callback(new Cell(hoveredCell.row - offset + row, hoveredCell.col - offset + col));
        }
    }
}

// Iterates through cells in a circle shape, centered around the hoveredCell
function iterateCircleShape(size, callback) {
    let offsets;

    switch(size) {
        // Note: There are mathematical ways to generate a circle shape around a point, but since I'm only implementing
        //       a few sizes I'm just hard-coding the cell coordinates. Offsets are formatted: [row offset, col offset]
        case 3:
            offsets = [
                         [-1, 0],
                [ 0,-1], [ 0, 0], [ 0, 1],
                         [ 1, 0]
            ];
            break;
        case 4:
            offsets = [
                         [-2,-1], [-2, 0],
                [-1,-2], [-1,-1], [-1, 0], [-1, 1],
                [ 0,-2], [ 0,-1], [ 0, 0], [ 0, 1],
                         [ 1,-1], [ 1, 0]
            ];
            break;
        default:
            console.error('Unsupported circle size: ', size);
            return;
    }

    offsets.forEach(offset => {
        callback(new Cell(hoveredCell.row + offset[0], hoveredCell.col + offset[1]));
    });
}
