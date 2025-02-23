/**
 * This is the main canvas editor in the center of the page. It contains a stack of CanvasControls
 * so that the actual drawing is independent of the selection polygons, hovered cell effects, etc.
 */

import CanvasControl from "../canvas/canvas.js";
import * as selection from "../canvas/selection.js";
import {hoveredCell, iterateHoveredCells, setupMouseEvents as setupHoverMouse} from "../canvas/hover.js";
import {refreshMouseCoords, refreshSelectionDimensions, setupMouseEvents as setupEditorMouse} from "./editor.js";
import {addCanvasListeners, setupMousePan, setupScrollZoom} from "../canvas/zoom.js";
import * as state from "../state/state.js";

let charCanvas, selectionCanvas, selectionBorderCanvas, hoveredCellCanvas;

export function init() {
    charCanvas = new CanvasControl($('#char-canvas'), {});
    selectionBorderCanvas = new CanvasControl($('#selection-border-canvas'), {});
    hoveredCellCanvas = new CanvasControl($('#hovered-cell-canvas'), {});
    selectionCanvas = new CanvasControl($('#selection-canvas'), {});

    // Bind mouse events to controllers
    // Note: many controllers attach mouse events to the selectionCanvas since it is
    // on top, even though they have their own canvases underneath).
    selection.setupMouseEvents(selectionCanvas);
    setupHoverMouse(selectionCanvas);
    setupEditorMouse(selectionCanvas);

    setupScrollZoom(selectionCanvas, true);
    setupMousePan(selectionCanvas, false, [3])
    addCanvasListeners([selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas])
}

export function getCurrentViewRect() {
    return selectionCanvas.currentViewRect()
}

export function resize() {
    charCanvas.resize();
    selectionBorderCanvas.resize();
    hoveredCellCanvas.resize();
    selectionCanvas.resize();
}

export function redrawCharCanvas() {
    charCanvas.clear();
    charCanvas.drawBackground(state.config('background'));
    charCanvas.drawGlyphs(state.layeredGlyphs(state.currentFrame(), { showMovingContent: true, showDrawingContent: true }));

    const grid = state.config('grid');
    if (grid.show) {
        charCanvas.drawGrid(grid.width, grid.spacing, grid.color);
    }

    if (state.config('onion')) {
        charCanvas.drawOnion(state.layeredGlyphs(state.previousFrame()));
    }
}

export function drawSelection() {
    selectionCanvas.clear();
    selectionBorderCanvas.clear();

    selectionCanvas.highlightPolygons(selection.polygons);

    if (selection.hasSelection() && !selection.isDrawing) {
        selectionBorderCanvas.outlinePolygon(selection.getSelectedRect(), selection.movableContent)
    }

    if (selection.cursorCell) {
        selectionCanvas.drawCursorCell(selection.cursorCell);
    }

    refreshSelectionDimensions(selection.getSelectedCellArea())
}

export function drawHoveredCell() {
    hoveredCellCanvas.clear();

    if (hoveredCell && !selection.isDrawing && !selection.isMoving) {
        // Not showing if the tool is text-editor because when you click on a cell, the cursor doesn't necessarily
        // go to that cell (it gets rounded up or down, like a real text editor does).
        if (state.config('tool') !== 'text-editor') {
            iterateHoveredCells(cell => {
                if (cell.isInBounds()) {
                    hoveredCellCanvas.highlightCell(cell);
                }
            })
        }
    }

    // We don't show mouse coords if we're showing selection dimensions
    refreshMouseCoords(selection.hasSelection() ? null : hoveredCell);
}
