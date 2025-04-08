import Cell from "../../geometry/cell.js";
import {eventBus, EVENTS} from "../../events/events.js";

/**
 * Adds mouse event handlers to a canvasControl so hovering over the canvas emits hover events
 * @param {CanvasControl} canvasControl - The canvas controller to apply mouse event handlers to
 */
export function setupHoverEvents(canvasControl) {
    canvasControl.$canvas.on('mouseenter', evt => {
        if (!canvasControl.initialized) return;
        const cell = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
        eventBus.emit(EVENTS.CANVAS.HOVERED, { cell })
    });

    canvasControl.$canvas.on('mousemove', evt => {
        if (!canvasControl.initialized) return;
        const cell = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
        eventBus.emit(EVENTS.CANVAS.HOVERED, { cell })
    });

    canvasControl.$canvas.on('mouseleave', () => {
        if (!canvasControl.initialized) return;
        eventBus.emit(EVENTS.CANVAS.HOVER_END)
    });
}

export function getAllHoveredCells(primaryCell, brushShape, brushSize) {
    if (!primaryCell) return [];

    switch(brushShape) {
        case 'square':
            return getHoveredSquare(primaryCell, brushSize);
        case 'circle':
            return getHoveredCircle(primaryCell, brushSize);
        default:
            console.error('Unsupported brush shape: ', brushShape);
    }
}

// Iterates through cells in a square shape, centered around the primaryCell
function getHoveredSquare(primaryCell, size) {
    const result = []
    const offset = Math.floor(size / 2);

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            result.push(new Cell(primaryCell.row - offset + row, primaryCell.col - offset + col));
        }
    }
    return result;
}

// Iterates through cells in a circle shape, centered around the primaryCell
// On second thought, it's more of a diamond than a circle
function getHoveredCircle(primaryCell, size) {
    const result = [];
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
        // case 4:
        //     offsets = [
        //                  [-2,-1], [-2, 0],
        //         [-1,-2], [-1,-1], [-1, 0], [-1, 1],
        //         [ 0,-2], [ 0,-1], [ 0, 0], [ 0, 1],
        //                  [ 1,-1], [ 1, 0]
        //     ];
        //     break;
        case 5:
            offsets = [
                                  [-2, 0],
                         [-1,-1], [-1, 0], [-1, 1],
                [ 0,-2], [ 0,-1], [ 0, 0], [ 0, 1], [ 0, 2],
                         [ 1,-1], [ 1, 0], [ 1, 1],
                                  [ 2, 0]
            ];
            break;
        default:
            console.error('Unsupported circle size: ', size);
            return;
    }

    offsets.forEach(offset => {
        result.push(new Cell(primaryCell.row + offset[0], primaryCell.col + offset[1]));
    });
    return result;
}
