/**
 * This is the UI component for the main canvas editor in the center of the page. It contains a stack of Canvases:
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

import Canvas from "../components/canvas.js";
import * as selectionController from "./selection/index.js";
import {drawingContent, hoveredCells} from "./tool_controller.js";
import * as state from "../state/index.js";
import {majorGridColor, minorGridColor, PRIMARY_COLOR} from "../config/colors.js";
import * as tools from "./tool_controller.js";
import {eventBus, EVENTS} from "../events/events.js";
import {EMPTY_CHAR} from "../config/chars.js";
import RectSelection from "../geometry/selection/rect.js";
import {LAYER_TYPES} from "../state/constants.js";


const ONION_OPACITY = 0.3;
const NON_CURRENT_LAYER_OPACITY = 0.5;

const DRAW_DEBUG_PATHS = false;

let charCanvas, selectionCanvas, selectionBorderCanvas, hoveredCellCanvas;
let hoveredCell;
let $canvasMessage, $canvasDetails;

export function init() {
    charCanvas = new Canvas($('#char-canvas'), {});
    selectionBorderCanvas = new Canvas($('#selection-border-canvas'), {});
    hoveredCellCanvas = new Canvas($('#hovered-cell-canvas'), {});

    // selection-canvas is on the top of the canvas stack, so it handles all the mouse events
    selectionCanvas = new Canvas($('#selection-canvas'), {
        onMouseDown: ({evt, cell, currentPoint, mouseDownButton, mouseCoords}) => {
            eventBus.emit(EVENTS.CANVAS.MOUSEDOWN, {
                mouseEvent: evt, canvas: selectionCanvas, cell, currentPoint, mouseDownButton, mouseCoords
            })
        },
        onMouseMove: ({evt, cell, isDragging, originalPoint, currentPoint, mouseDownButton, mouseCoords}) => {
            eventBus.emit(EVENTS.CANVAS.MOUSEMOVE, {
                mouseEvent: evt, canvas: selectionCanvas, cell, isDragging, originalPoint, currentPoint, mouseDownButton, mouseCoords
            })
            eventBus.emit(EVENTS.CANVAS.HOVERED, { cell })
        },
        onMouseUp: ({evt, cell, isDragging, originalPoint, currentPoint, mouseDownButton, mouseCoords}) => {
            eventBus.emit(EVENTS.CANVAS.MOUSEUP, {
                mouseEvent: evt, canvas: selectionCanvas, cell, isDragging, originalPoint, currentPoint, mouseDownButton, mouseCoords
            })
        },

        onDblClick: ({evt, cell}) => {
            eventBus.emit(EVENTS.CANVAS.DBLCLICK, { mouseEvent: evt, cell: cell, canvas: selectionCanvas })
        },
        onMouseEnter: ({cell}) => {
            eventBus.emit(EVENTS.CANVAS.HOVERED, { cell })
        },
        onMouseLeave: () => {
            eventBus.emit(EVENTS.CANVAS.HOVER_END)
        },

        onWheel: ({panX, panY, zoomX, zoomY, target, evt}) => {
            if ((evt.ctrlKey || evt.metaKey) && evt.shiftKey) return;

            if (evt.ctrlKey || evt.metaKey) {
                eventBus.emit(EVENTS.CANVAS.ZOOM_DELTA, { delta: zoomY, target })
            }
            else {
                eventBus.emit(EVENTS.CANVAS.PAN_DELTA, {
                    // Divide pan values to slow pan down a tiny bit
                    delta: [panX / 1.25, panY / 1.25],
                    ignoreZoom: true // Wheel delta already reflects world-like movement (is consistent across zoom levels)
                })
            }
        },
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

    // These camera events have higher priority (1) so they always occur before preview canvas. This is important
    // because preview canvas depends on these canvases for its highlighted window
    eventBus.on(EVENTS.CANVAS.ZOOM_DELTA, ({delta, target}) => {
        iterateCanvases(canvas => canvas.zoomDelta(delta, target))
    }, 1)
    eventBus.on(EVENTS.CANVAS.ZOOM_TO_FIT, () => {
        iterateCanvases(canvas => canvas.zoomToFit())
    }, 1)
    eventBus.on(EVENTS.CANVAS.ZOOM_TO_DEFAULT, () => {
        iterateCanvases(canvas => canvas.zoomToDefault())
    }, 1)
    eventBus.on(EVENTS.CANVAS.PAN_TO_TARGET, ({target}) => {
        iterateCanvases(canvas => canvas.panToTarget(target))
    }, 1)
    eventBus.on(EVENTS.CANVAS.PAN_DELTA, ({delta, ignoreZoom}) => {
        iterateCanvases(canvas => canvas.panBy(...delta, ignoreZoom))
    }, 1)

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
    const currentGlyphs = state.layeredGlyphs(state.currentFrame(), {
        ...layeredGlyphsOptions,
        layers: [state.currentLayer()].filter(layer => layer.visible),
        movableContent: {
            glyphs: selectionController.raster.movableContent(),
            origin: selectionController.raster.movableContent() ? selectionController.raster.getSelectedCellArea().topLeft : null
        },
        drawingContent: tools.drawingContent,
    })

    // If showing all layers, build glyphs for all-layers-below-current and all-layers-above-current.:
    let belowGlyphs, aboveGlyphs;
    if (!state.getConfig('lockLayerVisibility')) {
        belowGlyphs = state.layeredGlyphs(state.currentFrame(), {
            ...layeredGlyphsOptions,
            layers: state.layers().slice(0, state.layerIndex()).filter(layer => layer.visible)
        });
        aboveGlyphs = state.layeredGlyphs(state.currentFrame(), {
            ...layeredGlyphsOptions,
            layers: state.layers().slice(state.layerIndex() + 1).filter(layer => layer.visible)
        });
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
            if (currentGlyphs && currentGlyphs.chars[row][col] !== EMPTY_CHAR) return false;
            if (aboveGlyphs && aboveGlyphs.chars[row][col] !== EMPTY_CHAR) return false;
            return true;
        }
    });

    if (DRAW_DEBUG_PATHS && state.currentLayerType() === LAYER_TYPES.VECTOR) {
        charCanvas.drawShapePaths(state.getCurrentCelShapes());
        if (drawingContent) charCanvas.drawShapePaths([drawingContent]);
    }

    // Special case for textbox initial draw - need to show selection boundaries otherwise it is invisible
    if (drawingContent && drawingContent.showSelectionOnInitialDraw()) {
        // TODO - Drawing on charCanvas makes the boundaries wrong opacity
        selectionController.vector.drawShapeBoundingBox(charCanvas, drawingContent);
    }

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
    if (state.getConfig('showOnion') && state.previousFrame() !== state.currentFrame()) {
        // TODO Add an option in case user wants onion to apply to all layers?
        const onionGlyphs = state.layeredGlyphs(state.previousFrame(), {
            layers: [state.currentLayer()].filter(layer => layer.visible),
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

    selectionCanvas.highlightPolygons(selectionController.raster.selectionShapes());

    if (selectionController.raster.hasSelection() && !selectionController.raster.isDrawing && !selectionController.raster.caretCell()) {
        selectionBorderCanvas.outlinePolygon(selectionController.raster.getSelectedRect(), selectionController.raster.movableContent())
    }

    if (selectionController.raster.caretCell()) {
        const caretCanvas = state.getConfig('caretStyle') === 'I-beam' ? selectionBorderCanvas : selectionCanvas;
        caretCanvas.startCaretAnimation(selectionController.raster.caretCell(), state.getConfig('caretStyle'), () => state.getDrawingColor());
    }

    selectionController.vector.drawShapeSelection(selectionCanvas);

    const vectorTextAreas = selectionController.vector.selectedTextAreas();
    if (vectorTextAreas) {
        selectionCanvas.highlightPolygons(vectorTextAreas.map(cellArea => new RectSelection(cellArea.topLeft, cellArea.bottomRight)));
    }

    const vectorCaret = selectionController.vector.caretCell();
    if (vectorCaret) {
        const caretCanvas = state.getConfig('caretStyle') === 'I-beam' ? selectionBorderCanvas : selectionCanvas;
        caretCanvas.startCaretAnimation(vectorCaret, state.getConfig('caretStyle'), () => state.getDrawingColor());
    }

    refreshCanvasDetails();
}

function showHoverForTool() {
    switch(state.getConfig('tool')) {
        case 'text-editor':
            // If text-editor is in I-beam mode, not showing hover because clicking on a cell does not necessarily
            // go to that cell (it gets rounded up/down -- see Point.caretCell)
            return state.getConfig('caretStyle') !== 'I-beam';
        case 'pan':
        case 'move-all':
            // Not showing hover cell for these tools since they affect entire canvas, not one cell
            return false;
        default:
            return true;
    }
}

function redrawHover() {
    hoveredCellCanvas.clear();

    if (hoveredCell && !selectionController.raster.isDrawing && !selectionController.raster.isMoving && showHoverForTool()) {
        hoveredCells(hoveredCell).forEach(cell => {
            if (state.isCellInBounds(cell)) hoveredCellCanvas.highlightCell(cell);
        })
    }

    refreshCanvasDetails();
}

function refreshCanvasDetails() {
    $canvasDetails.canvasDimensionsValue.html(`[${state.numCols()}x${state.numRows()}]`);

    const selectedArea = selectionController.raster.getSelectedCellArea();
    $canvasDetails.selectedDimensions.toggle(!!selectedArea);
    $canvasDetails.selectedDimensionsValue.html(selectedArea ? `${selectedArea.numRows}x${selectedArea.numCols}` : '&nbsp;');

    const showHoveredCoords = !selectedArea && hoveredCell && state.isCellInBounds(hoveredCell)
    $canvasDetails.mouseCoordinates.toggle(!!showHoveredCoords);
    $canvasDetails.mouseCoordinatesValue.html(showHoveredCoords ? `${hoveredCell.col}:${hoveredCell.row}` : '&nbsp;');
}