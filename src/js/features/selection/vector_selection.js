import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js";
import {SELECTION_COLOR} from "../../config/colors.js";
import {HANDLES} from "../../geometry/shapes/constants.js";
import CellArea from "../../geometry/cell_area.js";
import ShapeSelection from "./shape_selection.js";
import VectorMarquee from "./vector_marquee.js";
import {arraysEqual} from "../../utils/arrays.js";
import Cell from "../../geometry/cell.js";
import {moveCaretTo, polygons} from "../selection.js";

export function init() {
    setupEventBus();
}

let shapeSelection = new ShapeSelection();
let draggedHandle = null; // handle currently being dragged (only active during mousedown/move)
let marquee = null;

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

        if (marquee) updateMarquee(mouseEvent);

    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell, canvasControl }) => {
        if (draggedHandle) finishDragHandle();

        if (marquee) finishMarquee(mouseEvent);
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
        case HANDLES.TOP_EDGE:
        case HANDLES.LEFT_EDGE:
        case HANDLES.RIGHT_EDGE:
        case HANDLES.BOTTOM_EDGE:
            draggedHandle = handle;
            shapeSelection.beginResize();
            break;
        case HANDLES.BODY:
            draggedHandle = handle;
            if (handle.focusedShapeId === undefined) throw new Error(`HANDLES.BODY must provide focusedShapeId`);

            if (shapeSelection.mousedownShape(handle.focusedShapeId, mouseEvent.shiftKey)) {
                eventBus.emit(EVENTS.SELECTION.CHANGED);
                state.pushHistory();
            }
            break;
        case null:
            if (mouseEvent.shiftKey) {
                createMarquee(canvasControl, mouseEvent);
            } else {
                deselectAllShapes();
                createMarquee(canvasControl, mouseEvent);
            }
            break;
    }
}

function dragHandle(canvasControl, mouseEvent, cell, moveStep) {
    switch (draggedHandle.type) {
        case HANDLES.TOP_LEFT_CORNER:
        case HANDLES.TOP_RIGHT_CORNER:
        case HANDLES.BOTTOM_LEFT_CORNER:
        case HANDLES.BOTTOM_RIGHT_CORNER:
        case HANDLES.TOP_EDGE:
        case HANDLES.LEFT_EDGE:
        case HANDLES.RIGHT_EDGE:
        case HANDLES.BOTTOM_EDGE:
            const roundedCell = canvasControl.roundedCellAtScreenXY(mouseEvent.offsetX, mouseEvent.offsetY);
            shapeSelection.resize(draggedHandle.type, roundedCell)
            break;
        case HANDLES.BODY:
            shapeSelection.translate(cell.row - moveStep.row, cell.col - moveStep.col)
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    shapeSelection.cancelPending();

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function finishDragHandle() {
    let hasStateChange = false;

    switch (draggedHandle.type) {
        case HANDLES.TOP_LEFT_CORNER:
        case HANDLES.TOP_RIGHT_CORNER:
        case HANDLES.BOTTOM_LEFT_CORNER:
        case HANDLES.BOTTOM_RIGHT_CORNER:
        case HANDLES.TOP_EDGE:
        case HANDLES.LEFT_EDGE:
        case HANDLES.RIGHT_EDGE:
        case HANDLES.BOTTOM_EDGE:
            if (shapeSelection.finishResize()) hasStateChange = true;
            break;
        case HANDLES.BODY:
            if (shapeSelection.commitPending()) hasStateChange = true;
            if (shapeSelection.finishTranslate()) hasStateChange = true;
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    draggedHandle = null;
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);

    if (hasStateChange) state.pushHistory();
}

export function getHandle(cell, mouseEvent, canvasControl) {
    // If a shape is currently being dragged, the handle is locked to the drag handle
    if (draggedHandle) return draggedHandle;

    // todo maybe need to check hitboxes of shapes above current shape?
    //      then do current shape handles
    //      then hitboxes of shapes below
    //      E.g. make a small rect on top big rect. select big rect. now you can't select small rect unless you click off first

    // If there are 1 or more selected shapes, check the handles of those shape(s)
    if (state.hasSelectedShapes()) {
        for (const handleType of Object.values(HANDLES)) {
            switch(handleType) {
                case HANDLES.TOP_LEFT_CORNER:
                case HANDLES.TOP_RIGHT_CORNER:
                case HANDLES.BOTTOM_LEFT_CORNER:
                case HANDLES.BOTTOM_RIGHT_CORNER:
                    const corner = cornerRegion(canvasControl, shapeSelection.boundingArea, handleType);
                    if (
                        (Math.abs(mouseEvent.offsetX - corner.x) <= corner.size / 2) &&
                        (Math.abs(mouseEvent.offsetY - corner.y) <= corner.size / 2)
                    ) {
                        return {
                            type: handleType,
                            cursor: corner.cursor
                        }
                    }
                    break;
                case HANDLES.TOP_EDGE:
                case HANDLES.LEFT_EDGE:
                case HANDLES.RIGHT_EDGE:
                case HANDLES.BOTTOM_EDGE:
                    const edge = edgeRegion(canvasControl, shapeSelection.boundingArea, handleType);
                    if (
                        (mouseEvent.offsetX >= edge.x1) && (mouseEvent.offsetX <= edge.x2) &&
                        (mouseEvent.offsetY >= edge.y1) && (mouseEvent.offsetY <= edge.y2)
                    ) {
                        return {
                            type: handleType,
                            cursor: edge.cursor
                        }
                    }
                    break;
                case HANDLES.BODY:
                    const hitShape = state.checkCurrentCelHitbox(cell, state.selectedShapeIds());
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

export function deleteSelectedShapes() {
    state.deleteSelectedShapes();
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

export function deselectAllShapes(allowHistoryPush = true) {
    const hasStateChange = state.hasSelectedShapes();
    state.deselectAllShapes();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    if (allowHistoryPush && hasStateChange) state.pushHistory();
}

export function reorderSelectedShapes(action) {
    state.reorderSelectedShapes(action);
    eventBus.emit(EVENTS.SELECTION.CHANGED); // So shape property buttons refresh
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

export function updateSelectedShapes(updater) {
    state.updateSelectedShapes(updater);
    eventBus.emit(EVENTS.SELECTION.CHANGED); // So shape property buttons refresh
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

// For rapid updates that affect shape display but should not be committed to history
export function rapidUpdateSelectedShapes(updater) {
    state.updateSelectedShapes(updater);
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

// ------------------------------------------------------------------------------------------------- Marquee
// The "marquee" refers to the rectangular drag area created by the user as they click-and-drag on the canvas.

function createMarquee(canvasControl, mouseEvent) {
    const isFreshMarquee = !state.hasSelectedShapes();
    const originalSelection = state.selectedShapeIds();

    marquee = new VectorMarquee({
        canvasControl,
        startX: mouseEvent.offsetX,
        startY: mouseEvent.offsetY,
        onUpdate: area => {
            const marqueeShapeIds = state.checkCurrentCelMarquee(area).map(shape => shape.id);

            if (isFreshMarquee) {
                // If fresh marquee, set selected shapes to match the covered shapes (this allows shapes to be
                // added/removed as the marquee boundaries change)
                state.setSelectedShapeIds(marqueeShapeIds);
            } else {
                // If selection already exists, shapes will only be *added* to selection; if the marquee adds a rect
                // and then the marquee is moved away, the rect remains added
                marqueeShapeIds.forEach(shapeId => state.selectShape(shapeId));
            }
        },
        onFinish: () => {
            const hasStateChange = !arraysEqual(originalSelection, state.selectedShapeIds())
            if (hasStateChange) state.pushHistory();
        }
    })
}

function updateMarquee(mouseEvent) {
    marquee.update(mouseEvent.offsetX, mouseEvent.offsetY);
    eventBus.emit(EVENTS.SELECTION.CHANGED)
}

function finishMarquee(mouseEvent) {
    marquee.update(mouseEvent.offsetX, mouseEvent.offsetY);
    marquee.finish();
    marquee = null;
    eventBus.emit(EVENTS.SELECTION.CHANGED)
}


// ------------------------------------------------------------------------------------------------- Text caret

let preferredCursorCol;

export function caretCell() {
    let { shape, cursorIndex } = state.getShapeCursor();
    if (!shape) return null;
    return getTextLayout().getCellForCursorIndex(cursorIndex)
}

function getTextLayout() {
    return state.getShapeCursor().shape.textLayout;
}

export function setShapeCursor(shapeId, atIndex, resetPreferredCol = true) {
    if (resetPreferredCol) preferredCursorCol = undefined;
    state.setShapeCursor(shapeId, atIndex);
    eventBus.emit(EVENTS.SELECTION.CHANGED)
}

function moveCursorInVertDir(vertOffset) {
    const currentCell = caretCell();
    const desiredCell = currentCell.translate(vertOffset, 0);

    if (preferredCursorCol === undefined) {
        preferredCursorCol = desiredCell.col;
    } else {
        desiredCell.col = preferredCursorCol
    }

    const layout = getTextLayout();

    let cursorIndex;
    let resetPreferredCol = false;
    if (layout.isCellInVerticalBounds(desiredCell)) {
        cursorIndex = layout.getCursorIndexForCell(desiredCell);
    } else {
        cursorIndex = vertOffset > 0 ? layout.maxCursorIndex : 0;
        resetPreferredCol = true;
    }

    setShapeCursor(state.getShapeCursor().shape.id, cursorIndex, resetPreferredCol);
}

function moveCursorInHorizDir(horizOffset) {
    const min = 0;
    const max = state.getShapeCursor().shape.textLayout.maxCursorIndex;
    let newIndex = state.getShapeCursor().cursorIndex + horizOffset;
    if (newIndex < min) newIndex = min;
    if (newIndex > max) newIndex = max;
    setShapeCursor(state.getShapeCursor().shape.id, newIndex, true);
}

export function handleArrowKey(direction, shiftKey) {
    switch(direction) {
        case 'left':
            moveCursorInHorizDir(-1)
            break;
        case 'up':
            moveCursorInVertDir(-1)
            break;
        case 'right':
            moveCursorInHorizDir(1)
            break;
        case 'down':
            moveCursorInVertDir(1)
            break;
        default:
            throw new Error(`Invalid direction: ${direction}`);
    }
}



// ------------------------------------------------------------------------------------------------- Drawing

export function drawShapeSelection(canvasControl) {
    canvasControl.inScreenSpace(() => {
        const shapes = state.selectedShapes();

        if (shapes.length === 0) {
            // no shapes to draw
        } else if (shapes.length === 1) {
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

        if (marquee) drawMarquee(canvasControl);
    })
}

const SHAPE_OUTLINE_WIDTH = 2;
const BOUNDING_BOX_PADDING = 6;

const CORNER_SIZE = 8;
const CORNER_RADIUS = 2;
const EDGE_WIDTH = 8;
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

function drawMarquee(canvasControl) {
    const context = canvasControl.context;
    context.lineWidth = SHAPE_OUTLINE_WIDTH;
    context.setLineDash([]);
    context.strokeStyle = SELECTION_COLOR;

    context.beginPath();
    context.rect(...marquee.xywh);
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

            // EDGE handles have no visual representation
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

    switch (corner) {
        case HANDLES.TOP_LEFT_CORNER:
            x = cellArea.x;
            y = cellArea.y;
            xPadding = -BOUNDING_BOX_PADDING;
            yPadding = -BOUNDING_BOX_PADDING;
            cursor = 'nwse-resize';
            break;
        case HANDLES.TOP_RIGHT_CORNER:
            x = cellArea.x + cellArea.width;
            y = cellArea.y;
            xPadding = BOUNDING_BOX_PADDING;
            yPadding = -BOUNDING_BOX_PADDING;
            cursor = 'nesw-resize';
            break;
        case HANDLES.BOTTOM_LEFT_CORNER:
            x = cellArea.x;
            y = cellArea.y + cellArea.height;
            xPadding = -BOUNDING_BOX_PADDING;
            yPadding = BOUNDING_BOX_PADDING;
            cursor = 'nesw-resize';
            break;
        case HANDLES.BOTTOM_RIGHT_CORNER:
            x = cellArea.x + cellArea.width;
            y = cellArea.y + cellArea.height;
            xPadding = BOUNDING_BOX_PADDING;
            yPadding = BOUNDING_BOX_PADDING;
            cursor = 'nwse-resize';
            break;
    }

    const screenPosition = canvasControl.worldToScreen(x, y)
    return {
        x: screenPosition.x + xPadding,
        y: screenPosition.y + yPadding,
        size: CORNER_SIZE, // in screen units
        cursor: cursor
    }
}

function edgeRegion(canvasControl, cellArea, edge) {
    let screen1, screen2; // in screen units
    let x1, x2, y1, y2; // in screen units
    let cursor;

    switch (edge) {
        case HANDLES.TOP_EDGE:
            screen1 = canvasControl.worldToScreen(cellArea.x, cellArea.y);
            screen2 = canvasControl.worldToScreen(cellArea.x + cellArea.width, cellArea.y);
            x1 = screen1.x - BOUNDING_BOX_PADDING;
            x2 = screen2.x + BOUNDING_BOX_PADDING;
            y1 = screen1.y - EDGE_WIDTH / 2 - BOUNDING_BOX_PADDING;
            y2 = screen2.y + EDGE_WIDTH / 2 - BOUNDING_BOX_PADDING;
            cursor = 'ns-resize';
            break;
        case HANDLES.LEFT_EDGE:
            screen1 = canvasControl.worldToScreen(cellArea.x, cellArea.y);
            screen2 = canvasControl.worldToScreen(cellArea.x, cellArea.y + cellArea.height);
            x1 = screen1.x - EDGE_WIDTH / 2 - BOUNDING_BOX_PADDING;
            x2 = screen2.x + EDGE_WIDTH / 2 - BOUNDING_BOX_PADDING;
            y1 = screen1.y - BOUNDING_BOX_PADDING;
            y2 = screen2.y + BOUNDING_BOX_PADDING;
            cursor = 'ew-resize';
            break;
        case HANDLES.RIGHT_EDGE:
            screen1 = canvasControl.worldToScreen(cellArea.x + cellArea.width, cellArea.y);
            screen2 = canvasControl.worldToScreen(cellArea.x + cellArea.width, cellArea.y + cellArea.height);
            x1 = screen1.x - EDGE_WIDTH / 2 + BOUNDING_BOX_PADDING;
            x2 = screen2.x + EDGE_WIDTH / 2 + BOUNDING_BOX_PADDING;
            y1 = screen1.y - BOUNDING_BOX_PADDING;
            y2 = screen2.y + BOUNDING_BOX_PADDING;
            cursor = 'ew-resize';
            break;
        case HANDLES.BOTTOM_EDGE:
            screen1 = canvasControl.worldToScreen(cellArea.x, cellArea.y + cellArea.height);
            screen2 = canvasControl.worldToScreen(cellArea.x + cellArea.width, cellArea.y + cellArea.height);
            x1 = screen1.x - BOUNDING_BOX_PADDING;
            x2 = screen2.x + BOUNDING_BOX_PADDING;
            y1 = screen1.y - EDGE_WIDTH / 2 + BOUNDING_BOX_PADDING;
            y2 = screen2.y + EDGE_WIDTH / 2 + BOUNDING_BOX_PADDING;
            cursor = 'ns-resize';
            break;
    }

    return {x1, x2, y1, y2, cursor};
}