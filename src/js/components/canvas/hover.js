import Cell from "../../geometry/cell.js";

/**
 * Sets up mouse hover listeners for the given canvas control. Returns a small API to retrieve the current hovered cell,
 * attach hover callbacks, and more.
 *
 * Not using the events.js eventBus because these events do not need to propagate through the app; only the controller
 * that calls setupMouseEvents cares about the events.
 *
 * @param canvasControl
 * @returns {Object} A small API for the hover handler:
 *   - api.cell: the current cell being hovered over (null if not hovering)
 *   - api.getBrushCells: function to retrieve all hovered cells for a given brush shape/size
 *   - api.onHover: attaches a callback to be fired when hovering takes place
 */
export function setupMouseEvents(canvasControl) {
    const listeners = [];
    let api = {
        cell: null,
        getBrushCells: (brushShape, brushSize) => getAllHoveredCells(api.cell, brushShape, brushSize),
        onHover: listener => listeners.push(listener),
    }

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell, tool) => {
        api.cell = cell;
        listeners.forEach(listener => listener(api.cell))
    });

    canvasControl.$canvas.on('editor:mouseenter', (evt, mouseEvent, cell) => {
        api.cell = cell;
        listeners.forEach(listener => listener(api.cell))
    });

    canvasControl.$canvas.on('editor:mouseleave', () => {
        api.cell = null;
        listeners.forEach(listener => listener(api.cell))
    });

    return api;
}

function getAllHoveredCells(primaryCell, brushShape, brushSize) {
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
