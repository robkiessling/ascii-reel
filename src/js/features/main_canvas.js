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
import {hoveredCells} from "./tools.js";
import * as state from "../state/index.js";
import {majorGridColor, minorGridColor} from "../config/colors.js";
import * as tools from "./tools.js";
import {eventBus, EVENTS} from "../events/events.js";
import {currentFrame} from "../state/index.js";
import {EMPTY_CHAR} from "../config/chars.js";


const ONION_OPACITY = 0.3;
const NON_CURRENT_LAYER_OPACITY = 0.5;

let charCanvas, selectionCanvas, selectionBorderCanvas, hoveredCellCanvas;
let hoveredCell;
let $canvasMessage, $canvasDetails;

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

    $canvasMessage = $('#canvas-message');
    
    const $canvasDetailsContainer = $('#canvas-details');
    $canvasDetails = {
        canvasDimensions: $canvasDetailsContainer.find('.canvas-dimensions'),
        canvasDimensionsValue: $canvasDetailsContainer.find('.canvas-dimensions .value'),
        selectedDimensions: $canvasDetailsContainer.find('.selection-dimensions'),
        selectedDimensionsValue: $canvasDetailsContainer.find('.selection-dimensions .value'),
        mouseCoordinates: $canvasDetailsContainer.find('.mouse-coordinates'),
        mouseCoordinatesValue: $canvasDetailsContainer.find('.mouse-coordinates .value')
    }

    setupEventBus();
}


function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => redrawAll())

    eventBus.on([EVENTS.SELECTION.CHANGED], () => {
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
    [
        selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas
    ].forEach(canvas => callback(canvas));

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

export function showCanvasMessage(message) {
    $canvasMessage.show().html(message);
}

export function hideCanvasMessage() {
    $canvasMessage.hide();
}

/**
 * Draws the char-canvas which includes the background, multiple layers of chars, the onion, and the grid
 */
function redrawCharCanvas() {
    const layeredGlyphsOptions = {
        offset: {
            amount: tools.moveAllOffset,
            modifiers: tools.moveAllModifiers
        }
    }

    // Build glyphs for current layer
    const currentGlyphs = state.layeredGlyphs(state.currentFrame(), $.extend({}, layeredGlyphsOptions, {
        layers: [state.currentLayer()],
        movableContent: {
            glyphs: selection.movableContent,
            origin: selection.movableContent ? selection.getSelectedCellArea().topLeft : null
        },
        drawingContent: tools.drawingContent,
    }));

    // If showing all layers, build glyphs for all-layers-below-current and all-layers-above-current.:
    let belowGlyphs, aboveGlyphs;
    if (!state.getConfig('lockLayerVisibility')) {
        belowGlyphs = state.layeredGlyphs(state.currentFrame(), $.extend({}, layeredGlyphsOptions, {
            layers: state.layers().slice(0, state.layerIndex())
        }));
        aboveGlyphs = state.layeredGlyphs(state.currentFrame(), $.extend({}, layeredGlyphsOptions, {
            layers: state.layers().slice(state.layerIndex() + 1)
        }));
    }

    // Begin rendering:
    // 1. Clear and draw background
    charCanvas.clear();
    charCanvas.drawBackground(state.getConfig('background'));

    // 2. If there are any layers below current layer, draw them at lower opacity
    charCanvas.drawGlyphs(belowGlyphs, {
        showWhitespace: state.getConfig('showWhitespace'),
        opacity: NON_CURRENT_LAYER_OPACITY,
        mask: (row, col) => {
            // Don't include chars that will be covered by canvases above
            if (currentGlyphs.chars[row][col] !== EMPTY_CHAR) return false;
            if (aboveGlyphs && aboveGlyphs.chars[row][col] !== EMPTY_CHAR) return false;
            return true;
        }
    });

    // 3. Draw current layer at normal opacity
    charCanvas.drawGlyphs(currentGlyphs, {
        showWhitespace: state.getConfig('showWhitespace'),

        // The following is commented out because I think it looks better if we DO draw current-layer chars, even if
        // they will be covered by canvases above
        // mask: state.getConfig('lockLayerVisibility') ? undefined : (row, col) => {
        //     return aboveGlyphs.chars[row][col] === EMPTY_CHAR;
        // }
    });

    // 4. If there are any layers above current layer, draw them at lower opacity
    charCanvas.drawGlyphs(aboveGlyphs, {
        showWhitespace: state.getConfig('showWhitespace'),
        opacity: NON_CURRENT_LAYER_OPACITY
    });

    // 5. Draw onion at lower opacity
    if (state.getConfig('showOnion') && state.previousFrame() !== currentFrame()) {
        // TODO Add an option in case user wants onion to apply to all layers?
        const onionGlyphs = state.layeredGlyphs(state.previousFrame(), {
            layers: [state.currentLayer()],
        })
        charCanvas.drawGlyphs(onionGlyphs, {
            opacity: ONION_OPACITY
        });
    }

    // 6. Draw grid
    const grid = state.getConfig('grid');
    if (grid.show) {
        if (grid.minorGridEnabled) charCanvas.drawGrid(1, grid.minorGridSpacing, minorGridColor);
        if (grid.majorGridEnabled) charCanvas.drawGrid(1, grid.majorGridSpacing, majorGridColor);
    }
}

function redrawSelection() {
    selectionCanvas.clear();
    selectionBorderCanvas.clear();

    selectionCanvas.highlightPolygons(selection.polygons);

    if (selection.hasSelection() && !selection.isDrawing && !selection.cursorCell()) {
        selectionBorderCanvas.outlinePolygon(selection.getSelectedRect(), selection.movableContent)
    }

    if (selection.cursorCell()) {
        selectionCanvas.drawCursorCell(selection.cursorCell());
    }

    refreshCanvasDetails();
}

const HIDE_HOVER_EFFECT_FOR_TOOLS = new Set([
    // Not showing hover cell for these tools since they affect entire canvas, not one cell
    'pan',
    'move-all'
])

function redrawHover() {
    hoveredCellCanvas.clear();

    if (hoveredCell && !selection.isDrawing && !selection.isMoving && !HIDE_HOVER_EFFECT_FOR_TOOLS.has(state.getConfig('tool'))) {
        hoveredCells(hoveredCell).forEach(cell => {
            if (cell.isInBounds()) hoveredCellCanvas.highlightCell(cell);
        })
    }

    refreshCanvasDetails();
}

function refreshCanvasDetails() {
    $canvasDetails.canvasDimensionsValue.html(`[${state.numCols()}x${state.numRows()}]`);

    const selectedArea = selection.getSelectedCellArea();
    $canvasDetails.selectedDimensions.toggle(!!selectedArea);
    $canvasDetails.selectedDimensionsValue.html(selectedArea ? `${selectedArea.numRows}x${selectedArea.numCols}` : '&nbsp;');

    const showHoveredCoords = !selectedArea && hoveredCell && hoveredCell.isInBounds()
    $canvasDetails.mouseCoordinates.toggle(!!showHoveredCoords);
    $canvasDetails.mouseCoordinatesValue.html(showHoveredCoords ? `${hoveredCell.col}:${hoveredCell.row}` : '&nbsp;');
}