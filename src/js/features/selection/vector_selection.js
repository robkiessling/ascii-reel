

import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js";
import {SELECTION_COLOR} from "../../config/colors.js";
import {HANDLES} from "../../geometry/shapes/constants.js";
import CellArea from "../../geometry/cell_area.js";

export function init() {
    setupEventBus();
}

let selectedShapeIds = new Set();
let draggedHandle = null;
let potentialDeselection = null;
let potentialSelection = null;

function setupEventBus() {
    let moveStep;

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl }) => {
        if (mouseEvent.which !== 1) return; // Only apply to left-click

        const tool = state.getConfig('tool')

        moveStep = cell;

        switch(tool) {
            case 'select':
                // state.endHistoryModification();
                onMousedown(cell, mouseEvent, canvasControl);
                break;
            default:
                return; // Ignore all other tools
        }
    })

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvasControl }) => {
        if (draggedHandle) {
            dragHandle(canvasControl, mouseEvent, cell, moveStep);
            moveStep = cell;
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell, canvasControl }) => {
        if (draggedHandle) {
            finishDragHandle()
        }
    })
}


function onMousedown(cell, mouseEvent, canvasControl) {
    const handle = getHandle(cell, mouseEvent, canvasControl)
    const handleType = handle ? handle.type : null;

    switch(handleType) {
        case HANDLES.TOP_LEFT_CORNER:
        case HANDLES.TOP_RIGHT_CORNER:
        case HANDLES.BOTTOM_LEFT_CORNER:
        case HANDLES.BOTTOM_RIGHT_CORNER:
            draggedHandle = handle;
            break;
        case HANDLES.TOP_EDGE:
        case HANDLES.LEFT_EDGE:
        case HANDLES.RIGHT_EDGE:
        case HANDLES.BOTTOM_EDGE:
            break;
        case HANDLES.BODY:
            draggedHandle = handle;
            if (handle.focusedShapeId === undefined) throw new Error(`HANDLES.BODY must provide focusedShapeId`);

            if (mouseEvent.shiftKey) {
                // Toggle shape inclusion
                if (selectedShapeIds.has(handle.focusedShapeId)) {
                    potentialDeselection = handle.focusedShapeId
                } else {
                    selectedShapeIds.add(handle.focusedShapeId);
                }
            } else if (selectedShapeIds.size > 1 && selectedShapeIds.has(handle.focusedShapeId)) {
                // Multiple shapes are selected. Might be the start of a click-and-drag move, or just selecting 1
                potentialSelection = handle.focusedShapeId
            } else {
                selectedShapeIds = new Set([handle.focusedShapeId]);
            }
            eventBus.emit(EVENTS.SELECTION.CHANGED);
            break;
        case null:
            if (mouseEvent.shiftKey) return;
            selectedShapeIds = new Set();
            eventBus.emit(EVENTS.SELECTION.CHANGED);
            break;
    }
}

function dragHandle(canvasControl, mouseEvent, cell, moveStep) {
    switch (draggedHandle.type) {
        case HANDLES.TOP_LEFT_CORNER:
        case HANDLES.TOP_RIGHT_CORNER:
        case HANDLES.BOTTOM_LEFT_CORNER:
        case HANDLES.BOTTOM_RIGHT_CORNER:
            const offset = draggedHandle.cellOriginOffset;
            const roundedCell = canvasControl.roundedCellAtScreenXY(mouseEvent.offsetX - offset.x, mouseEvent.offsetY - offset.y);
            getSelectedShapes().forEach(shape => {
                state.updateCurrentCelShape(shape.id, shape => shape.resize(draggedHandle.type, roundedCell));
            })
            break;
        case HANDLES.TOP_EDGE:
        case HANDLES.LEFT_EDGE:
        case HANDLES.RIGHT_EDGE:
        case HANDLES.BOTTOM_EDGE:
            break;
        case HANDLES.BODY:
            const rowDelta = cell.row - moveStep.row;
            const colDelta = cell.col - moveStep.col;
            getSelectedShapes().forEach(shape => {
                state.updateCurrentCelShape(shape.id, shape => shape.translate(rowDelta, colDelta));
            })
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    potentialDeselection = null; // If user moves mouse while down, do not consider them to be deselecting a shape
    potentialSelection = null;

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function finishDragHandle() {
    switch (draggedHandle.type) {
        case HANDLES.TOP_LEFT_CORNER:
        case HANDLES.TOP_RIGHT_CORNER:
        case HANDLES.BOTTOM_LEFT_CORNER:
        case HANDLES.BOTTOM_RIGHT_CORNER:
            getSelectedShapes().forEach(shape => {
                state.updateCurrentCelShape(shape.id, shape => shape.commitResize());
            })
            break;
        case HANDLES.TOP_EDGE:
        case HANDLES.LEFT_EDGE:
        case HANDLES.RIGHT_EDGE:
        case HANDLES.BOTTOM_EDGE:
            break;
        case HANDLES.BODY:
            // if holding shift and mouse didn't move, deselect the current shape
            if (potentialDeselection) {
                selectedShapeIds.delete(potentialDeselection)
                potentialDeselection = null;
            }

            if (potentialSelection) {
                selectedShapeIds = new Set([potentialSelection]);
                potentialSelection = null;
            }
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    draggedHandle = null;
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function getSelectedShapes() {
    return Array.from(selectedShapeIds).map(shapeId => state.getCurrentCelShape(shapeId));
}

class ShapeSelection {
    constructor(shapes) {
        this.shapes = shapes;
    }

    get length() {
        return this.shapes.length;
    }

    get boundingArea() {
        if (this.length === 1) return this.shapes[0].boundingArea;
        return CellArea.mergeCellAreas(this.shapes.map(shape => shape.boundingArea))
    }
}

export function getHandle(cell, mouseEvent, canvasControl) {
    if (draggedHandle) return draggedHandle;

    let handle;

    // If 1 selected shape -> check if mouse over any of its handles
    const shapes = getSelectedShapes();
    if (shapes.length === 1) {
        handle = testHandles(canvasControl, shapes[0].boundingArea, mouseEvent, cell, [shapes[0].id]);
        if (handle) return handle;
    }

    // If 2+ selected shapes -> check if mouse over any of the bounding box's handles
    if (shapes.length > 1) {
        const cumulativeArea = CellArea.mergeCellAreas(shapes.map(shape => shape.boundingArea))
        handle = testHandles(canvasControl, cumulativeArea, mouseEvent, cell, shapes.map(shape => shape.id));
        if (handle) return handle;
    }

    // Otherwise, check if mouse is over any current cel's shapes' hitboxes (iterate in top-to-bottom shape order)
    const hitShape = state.checkCurrentCelHitbox(cell);
    if (hitShape) {
        return {
            type: HANDLES.BODY,
            cursor: 'move',
            focusedShapeId: hitShape.id,
        }
    }
}

function testHandles(canvasControl, cellArea, mouseEvent, cell, shapeIds) {
    for (const handleType of Object.values(HANDLES)) {
        switch(handleType) {
            case HANDLES.TOP_LEFT_CORNER:
            case HANDLES.TOP_RIGHT_CORNER:
            case HANDLES.BOTTOM_LEFT_CORNER:
            case HANDLES.BOTTOM_RIGHT_CORNER:
                const corner = cornerRegion(canvasControl, cellArea, handleType);
                if (
                    (Math.abs(mouseEvent.offsetX - corner.x) <= corner.size / 2) &&
                    (Math.abs(mouseEvent.offsetY - corner.y) <= corner.size / 2)
                ) {
                    return {
                        type: handleType,
                        cursor: corner.cursor,
                        cellOriginOffset: corner.cellOriginOffset,
                    }
                }
                break;
            case HANDLES.TOP_EDGE:
            case HANDLES.LEFT_EDGE:
            case HANDLES.RIGHT_EDGE:
            case HANDLES.BOTTOM_EDGE:
                break;
            case HANDLES.BODY:
                const hitShape = state.checkCurrentCelHitbox(cell, shapeIds);
                if (hitShape) {
                    return {
                        type: handleType,
                        cursor: 'move',
                        focusedShapeId: hitShape.id,
                    }
                }
                break;
        }
    }
}

// ------------------------------------------------------------------------------------------------- Drawing

export function drawShapeSelection(canvasControl) {
    canvasControl.inScreenSpace(() => {
        const shapes = getSelectedShapes();

        if (shapes.length === 0) return;

        if (shapes.length === 1) {
            const shape = shapes[0];
            // draw shape anchors
            // draw shape bounding box (if applicable; line doesn't have)
            drawBoundingBox(canvasControl, shape.boundingArea)
            drawHandles(canvasControl, shape.boundingArea)
        } else {
            // multiple shapes:
            // draw bounding box around each shape (no anchors)
            // draw dashed bounding box around shape union
            // draw anchors on outermost bounding box
            shapes.forEach(shape => {
                drawBoundingBox(canvasControl, shape.boundingArea);
            })

            const cumulativeArea = CellArea.mergeCellAreas(shapes.map(shape => shape.boundingArea))
            drawBoundingBox(canvasControl, cumulativeArea, true)
            drawHandles(canvasControl, cumulativeArea)
        }

    })
}

const SHAPE_OUTLINE_WIDTH = 2;
const BOUNDING_BOX_PADDING = 2;

const CORNER_SIZE = 8;
const CORNER_RADIUS = 2;
const DASH_OUTLINE_LENGTH = 5;

function drawBoundingBox(canvasControl, cellArea, dashed = false) {
    const context = canvasControl.context;

    context.lineWidth = SHAPE_OUTLINE_WIDTH;
    context.setLineDash(dashed ? [DASH_OUTLINE_LENGTH, DASH_OUTLINE_LENGTH] : []);
    context.strokeStyle = SELECTION_COLOR;

    context.beginPath();
    context.rect(...buildScreenRect(canvasControl, cellArea.xywh, BOUNDING_BOX_PADDING));
    context.stroke();
}

/**
 * Converts a rectangle from world space to screen space, and applies fixed screen-space padding.
 *
 * The padding is added equally to all sides of the rectangle in screen coordinates, meaning it is not affected
 * by zoom level.
 *
 * @param {CanvasControl} canvasControl - canvas controller so we can perform world/screen conversions
 * @param {Array} xywh - Rectangle properties in world space
 * @param {number} padding - Padding (in screen space) to apply. Screen pixels means it won't be affected by zoom.
 * @returns {Array} - xywh rectangle properties in screen space
 */
function buildScreenRect(canvasControl, xywh, padding) {
    const [x, y, w, h] = xywh;

    // Convert rectangle to screen pixels
    const topLeftScreen = canvasControl.worldToScreen(x, y);
    const bottomRightScreen = canvasControl.worldToScreen(x + w, y + h);

    return [
        topLeftScreen.x - padding,
        topLeftScreen.y - padding,
        bottomRightScreen.x - topLeftScreen.x + 2 * padding,
        bottomRightScreen.y - topLeftScreen.y + 2 * padding,
    ]
}

function drawHandles(canvasControl, cellArea) {
    Object.values(HANDLES).forEach(handle => {
        switch(handle) {
            case HANDLES.TOP_LEFT_CORNER:
            case HANDLES.TOP_RIGHT_CORNER:
            case HANDLES.BOTTOM_LEFT_CORNER:
            case HANDLES.BOTTOM_RIGHT_CORNER:
                const corner = cornerRegion(canvasControl, cellArea, handle);
                drawCorner(canvasControl, corner)
                break;
        }
    })
}

function drawCorner(canvasControl, corner) {
    const context = canvasControl.context;

    context.beginPath();
    context.fillStyle = 'white';
    context.strokeStyle = SELECTION_COLOR;
    context.lineWidth = 1;

    // Rounded rectangle path
    context.roundRect(
        corner.x - corner.size / 2,
        corner.y - corner.size / 2,
        corner.size,
        corner.size,
        CORNER_RADIUS,
    );

    context.fill();
    context.stroke();
}

function cornerRegion(canvasControl, cellArea, corner) {
    let x, y; // in world units
    let xPadding, yPadding; // in screen units
    let cursor;
    let associatedCell;

    switch (corner) {
        case HANDLES.TOP_LEFT_CORNER:
            x = cellArea.x;
            y = cellArea.y;
            xPadding = -BOUNDING_BOX_PADDING;
            yPadding = -BOUNDING_BOX_PADDING;
            cursor = 'nwse-resize';
            associatedCell = cellArea.topLeft;
            // cellOriginOffset = [xPadding, yPadding];
            break;
        case HANDLES.TOP_RIGHT_CORNER:
            x = cellArea.x + cellArea.width;
            y = cellArea.y;
            xPadding = BOUNDING_BOX_PADDING;
            yPadding = -BOUNDING_BOX_PADDING;
            cursor = 'nesw-resize';
            associatedCell = cellArea.topRight;
            // cellOriginOffset = [xPadding, yPadding];
            break;
        case HANDLES.BOTTOM_LEFT_CORNER:
            x = cellArea.x;
            y = cellArea.y + cellArea.height;
            xPadding = -BOUNDING_BOX_PADDING;
            yPadding = BOUNDING_BOX_PADDING;
            cursor = 'nesw-resize';
            associatedCell = cellArea.bottomLeft;
            break;
        case HANDLES.BOTTOM_RIGHT_CORNER:
            x = cellArea.x + cellArea.width;
            y = cellArea.y + cellArea.height;
            xPadding = BOUNDING_BOX_PADDING;
            yPadding = BOUNDING_BOX_PADDING;
            cursor = 'nwse-resize';
            associatedCell = cellArea.bottomRight;
            break;
    }

    const screenPosition = canvasControl.worldToScreen(x, y)
    const cellScreenPosition = canvasControl.worldToScreen(associatedCell.x, associatedCell.y)
    return {
        x: screenPosition.x + xPadding,
        y: screenPosition.y + yPadding,
        size: CORNER_SIZE,
        cellOriginOffset: {
            x: screenPosition.x - cellScreenPosition.x,
            y: screenPosition.y - cellScreenPosition.y
        },
        cursor: cursor
    }
}