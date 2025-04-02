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

import CanvasControl from "../components/canvas_control/index.js";
import * as selection from "./selection.js";
import { BRUSH_TOOLS, refreshMouseCoords, refreshSelectionDimensions} from "./editor.js";
import * as state from "../state/index.js";
import {getMajorGridColor, getMinorGridColor} from "../config/background.js";
import * as editor from "./editor.js";
import {eventBus, EVENTS} from "../events/events.js";
import {getAllHoveredCells} from "../components/canvas_control/hover_events.js";

let charCanvas, selectionCanvas, selectionBorderCanvas, hoveredCellCanvas;
let hoveredCell;

export function init() {
    charCanvas = new CanvasControl($('#char-canvas'), {});
    selectionBorderCanvas = new CanvasControl($('#selection-border-canvas'), {});
    hoveredCellCanvas = new CanvasControl($('#hovered-cell-canvas'), {});

    // selection-canvas is on the top so it handles all the mouse events
    selectionCanvas = new CanvasControl($('#selection-canvas'), {
        emitRawMouseEvents: true,
        emitZoomEvents: {
            targeted: true
        },
        emitPanEvents: {
            snapToCenter: false,
            mouseButtons: () => state.getConfig('tool') === 'pan' ? [1, 3] : [3]
        },
        emitHoverEvents: true,
    });

    setupEventBus();
}


function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => redrawAll())

    eventBus.on([EVENTS.SELECTION.CHANGED, EVENTS.SELECTION.CURSOR_MOVED], () => {
        redrawSelection();
        redrawHover(); // since we hide hover mouse coords if there is a selection
    })

    eventBus.on(EVENTS.REFRESH.CURRENT_FRAME, () => redrawCharCanvas())

    eventBus.on(EVENTS.CANVAS.ZOOM_DELTA, ({delta, target}) => {
        iterateCanvases(canvasControl => canvasControl.zoomDelta(delta, target))
    })
    eventBus.on(EVENTS.CANVAS.ZOOM_TO_FIT, () => {
        iterateCanvases(canvasControl => canvasControl.zoomToFit())
    })
    eventBus.on(EVENTS.CANVAS.PAN_TO_TARGET, ({target}) => {
        iterateCanvases(canvasControl => canvasControl.translateToTarget(target))
    })
    eventBus.on(EVENTS.CANVAS.PAN_DELTA, ({delta}) => {
        iterateCanvases(canvasControl => canvasControl.translateAmount(...delta))
    })

    eventBus.on(EVENTS.CANVAS.HOVERED, ({cell}) => {
        hoveredCell = cell;
        redrawHover();
    })
    eventBus.on(EVENTS.CANVAS.HOVER_END, () => {
        hoveredCell = null;
        redrawHover();
    })
}

function redrawAll() {
    redrawCharCanvas();
    redrawSelection();
    redrawHover();
}

function iterateCanvases(callback) {
    [selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas].forEach(canvas => callback(canvas));
    redrawAll();
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

function redrawCharCanvas() {
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

    charCanvas.drawGlyphs(glyphs, { showWhitespace: state.getConfig('whitespace') });

    const grid = state.getConfig('grid');
    if (grid.show) {
        if (grid.minorGridEnabled) charCanvas.drawGrid(1, grid.minorGridSpacing, getMinorGridColor());
        if (grid.majorGridEnabled) charCanvas.drawGrid(1, grid.majorGridSpacing, getMajorGridColor());
    }

    if (state.getConfig('onion')) {
        charCanvas.drawOnion(state.layeredGlyphs(state.previousFrame()));
    }
}

function redrawSelection() {
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

function redrawHover() {
    hoveredCellCanvas.clear();

    if (hoveredCell && !selection.isDrawing && !selection.isMoving &&
        !HIDE_HOVER_EFFECT_FOR_TOOLS.has(state.getConfig('tool'))) {

        const { shape, size } = state.getConfig('brush');
        const hoveredCells = BRUSH_TOOLS.includes(state.getConfig('tool')) ?
            getAllHoveredCells(hoveredCell, shape, size) : [hoveredCell];

        hoveredCells.forEach(cell => {
            if (cell.isInBounds()) hoveredCellCanvas.highlightCell(cell);
        })
    }

    // We don't show mouse coords if we're showing selection dimensions
    refreshMouseCoords(selection.hasSelection() ? null : hoveredCell);
}
