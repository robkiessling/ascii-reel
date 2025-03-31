/**
 * This is the UI component for the main canvas editor in the center of the page. It contains a stack of CanvasControls:
 * - charCanvas: The canvas that renders chars
 * - hoveredCellCanvas: The canvas that renders a rectangular box over the hovered cell. This is its own canvas so we
 *   can rapidly update it as the mouse moves without having to re-render any of the chars, selection polygons, etc.
 * - selectionCanvas: The canvas that renders selection polygons (light blue). This canvas has an overall 0.5 opacity
 *   so that you can see chars through the selections. We opt for this global opacity (instead of drawing each polygon
 *   at 0.5 opacity) so we don't have to worry about overlapping opacities.
 *   The selectionCanvas is also the canvas on top of the others, so it receives all the mouse events.
 * - selectionBorderCanvas: The canvas that renders the borders of selections. Basically just renders some parts of the
 *   selection polygons that would have been on the selectionCanvas but that needed full opacity.
 */

import CanvasControl from "../canvas/canvas.js";
import * as selection from "../canvas/selection.js";
import {hoveredCell, iterateHoveredCells, setupMouseEvents as setupHoverMouse} from "../canvas/hover.js";
import {refreshMouseCoords, refreshSelectionDimensions, setupMouseEvents as setupEditorMouse} from "./editor.js";
import {setupMousePan, setupScrollZoom} from "../canvas/zoom.js";
import * as state from "../state/index.js";
import {getMajorGridColor, getMinorGridColor} from "../canvas/background.js";
import * as editor from "./editor.js";

let charCanvas, selectionCanvas, selectionBorderCanvas, hoveredCellCanvas;

export function init() {
    charCanvas = new CanvasControl($('#char-canvas'), {});
    selectionBorderCanvas = new CanvasControl($('#selection-border-canvas'), {});
    hoveredCellCanvas = new CanvasControl($('#hovered-cell-canvas'), {});
    selectionCanvas = new CanvasControl($('#selection-canvas'), {});

    // Bind mouse events to controllers
    // Note: many controllers attach mouse events to the selectionCanvas since it is on top, even though they have their
    // own canvases underneath.
    selection.setupMouseEvents(selectionCanvas);
    setupHoverMouse(selectionCanvas);
    setupEditorMouse(selectionCanvas);

    setupScrollZoom(selectionCanvas, true);
    setupMousePan(selectionCanvas, false, () => state.getMetadata('tool') === 'pan' ? [1, 3] : [3])
}

export function iterateCanvases(callback) {
    [selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas].forEach(canvas => callback(canvas));
}

export function canZoomIn() {
    return selectionCanvas.canZoomIn();
}
export function canZoomOut() {
    return selectionCanvas.canZoomOut();
}

export function getCurrentViewRect() {
    return selectionCanvas.currentViewRect()
}

export function resize(resetZoom) {
    charCanvas.resize(resetZoom);
    selectionBorderCanvas.resize(resetZoom);
    hoveredCellCanvas.resize(resetZoom);
    selectionCanvas.resize(resetZoom);
}

export function redrawCharCanvas() {
    charCanvas.clear();
    charCanvas.drawBackground(state.getConfig('background'));

    const glyphs = state.layeredGlyphs(state.currentFrame(), {
        showMovingContent: true,
        movableContent: {
            glyphs: selection.movableContent,
            origin: selection.movableContent ? selection.getSelectedCellArea().topLeft : null
        },
        showDrawingContent: true,
        drawingContent: editor.drawingContent,
        showOffsetContent: true,
        offset: {
            amount: editor.moveAllOffset,
            modifiers: editor.moveAllModifiers
        }
    });

    charCanvas.drawGlyphs(glyphs, { showWhitespace: state.getMetadata('whitespace') });

    const grid = state.getMetadata('grid');
    if (grid.show) {
        if (grid.minorGridEnabled) charCanvas.drawGrid(1, grid.minorGridSpacing, getMinorGridColor());
        if (grid.majorGridEnabled) charCanvas.drawGrid(1, grid.majorGridSpacing, getMajorGridColor());
    }

    if (state.getMetadata('onion')) {
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
        selectionBorderCanvas.drawCursorCell(selection.cursorCell);
    }

    refreshSelectionDimensions(selection.getSelectedCellArea())
}

const HIDE_HOVER_EFFECT_FOR_TOOLS = new Set([
    // Not showing hover cell for text-editor, since clicking on a cell does not necessarily go to that cell (it gets
    // rounded up/down like a real text editor does).
    'text-editor',

    // Not showing hover cell for these tools since they affect entire canvas, not one cell
    'pan',
    'move-all'
])

export function drawHoveredCell() {
    hoveredCellCanvas.clear();

    if (hoveredCell && !selection.isDrawing && !selection.isMoving) {
        if (!HIDE_HOVER_EFFECT_FOR_TOOLS.has(state.getMetadata('tool'))) {
            iterateHoveredCells(cell => {
                if (cell.isInBounds()) hoveredCellCanvas.highlightCell(cell);
            })
        }
    }

    // We don't show mouse coords if we're showing selection dimensions
    refreshMouseCoords(selection.hasSelection() ? null : hoveredCell);
}
