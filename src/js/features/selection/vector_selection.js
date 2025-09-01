import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js";
import {SELECTION_COLOR} from "../../config/colors.js";
import {
    HANDLE_CELL_RADIUS,
    HANDLE_TYPES,
    SHAPE_BOX_PADDING,
    SHAPE_DASHED_OUTLINE_LENGTH,
    SHAPE_OUTLINE_WIDTH
} from "../../geometry/shapes/constants.js";
import CellArea from "../../geometry/cell_area.js";
import ShapeSelector from "./shape_selector.js";
import VectorMarquee from "./vector_marquee.js";
import {arraysEqual} from "../../utils/arrays.js";
import {MOUSE} from "../../io/mouse.js";

export function init() {
    setupEventBus();
}

let shapeSelector = new ShapeSelector();
let draggedHandle = null; // handle currently being dragged (only active during mousedown/move)
let marquee = null;

function setupEventBus() {
    let moveStep;

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl }) => {
        if (mouseEvent.button !== MOUSE.LEFT) return;

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
    const handle = getHandle(cell, mouseEvent, canvasControl);

    if (!handle) {
        if (mouseEvent.shiftKey) {
            createMarquee(canvasControl, mouseEvent);
        } else {
            deselectAllShapes();
            createMarquee(canvasControl, mouseEvent);
        }
        return;
    }

    switch (handle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            draggedHandle = handle;
            shapeSelector.beginResize();
            break;
        case HANDLE_TYPES.BODY:
            draggedHandle = handle;
            if (handle.shapeId === undefined) throw new Error(`HANDLE_TYPES.BODY handle must provide shapeId`);

            if (shapeSelector.mousedownShape(handle.shapeId, mouseEvent.shiftKey)) {
                eventBus.emit(EVENTS.SELECTION.CHANGED);
                state.pushHistory();
            }
            break;
    }
}

function dragHandle(canvasControl, mouseEvent, cell, moveStep) {
    switch (draggedHandle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            const roundedCell = canvasControl.roundedCellAtScreenXY(mouseEvent.offsetX, mouseEvent.offsetY);
            shapeSelector.resize(draggedHandle, cell, roundedCell)
            break;
        case HANDLE_TYPES.BODY:
            shapeSelector.translate(cell.row - moveStep.row, cell.col - moveStep.col)
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    shapeSelector.cancelPending();

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function finishDragHandle() {
    let hasStateChange = false;

    switch (draggedHandle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            if (shapeSelector.finishResize()) hasStateChange = true;
            break;
        case HANDLE_TYPES.BODY:
            if (shapeSelector.commitPending()) hasStateChange = true;
            if (shapeSelector.finishTranslate()) hasStateChange = true;
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

    const shapes = state.selectedShapes();

    if (shapes.length === 1) {
        // Check individual shape's non-body handles
        const shape = shapes[0];
        for (const handle of shape.handles.nonBody) {
            if (handle.matches({mouseEvent, canvasControl, cell})) return handle;
        }
    } else {
        // Check shape group's non-body handles
        for (const handle of shapeSelector.handles.nonBody) {
            if (handle.matches({mouseEvent, canvasControl, cell})) return handle;
        }
    }

    // Check body handles of all shapes (both selected and unselected)
    return state.testCurrentCelShapeHitboxes(cell);
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
            const marqueeShapeIds = state.testCurrentCelMarquee(area).map(shape => shape.id);

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
            if (shape.handles.showBoundingBox) drawBoundingBox(canvasControl, shape.boundingArea);
            drawHandles(canvasControl, shape.handles);
        } else {
            shapes.forEach(shape => drawBoundingBox(canvasControl, shape.boundingArea))

            const cumulativeArea = CellArea.mergeCellAreas(shapes.map(shape => shape.boundingArea))
            drawBoundingBox(canvasControl, cumulativeArea, true)
            drawHandles(canvasControl, shapeSelector.handles)
        }

        if (marquee) drawMarquee(canvasControl);
    })
}

function drawBoundingBox(canvasControl, cellArea, dashed = false) {
    const context = canvasControl.context;

    context.lineWidth = SHAPE_OUTLINE_WIDTH;
    context.setLineDash(dashed ? [SHAPE_DASHED_OUTLINE_LENGTH, SHAPE_DASHED_OUTLINE_LENGTH] : []);
    context.strokeStyle = SELECTION_COLOR;

    context.beginPath();
    context.rect(...buildScreenRect(canvasControl, cellArea.xywh, SHAPE_BOX_PADDING));
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

function drawHandles(canvasControl, handles) {
    for (const handle of handles) {
        switch (handle.type) {
            case HANDLE_TYPES.VERTEX:
                drawCorner(canvasControl, handle)
                break;
            // HANDLE_TYPES.EDGE has no visual representation
            case HANDLE_TYPES.CELL:
                drawCellHandle(canvasControl, handle.cell);
                break;
        }
    }
}

function drawCorner(canvasControl, handle) {
    const { x, y, size, radius } = handle.geometry(canvasControl);

    const context = canvasControl.context;

    context.beginPath();
    context.fillStyle = 'white';
    context.strokeStyle = SELECTION_COLOR;
    context.lineWidth = 1;
    context.setLineDash([]);

    // Rounded rectangle path
    context.roundRect(
        x - size / 2,
        y - size / 2,
        size,
        size,
        radius,
    );

    context.fill();
    context.stroke();
}

function drawCellHandle(canvasControl, cell) {
    const context = canvasControl.context;

    context.lineWidth = SHAPE_OUTLINE_WIDTH;
    context.setLineDash([]);
    context.strokeStyle = SELECTION_COLOR;

    context.beginPath();
    context.roundRect(
        ...buildScreenRect(canvasControl, cell.xywh, SHAPE_BOX_PADDING),
        HANDLE_CELL_RADIUS
    )

    context.stroke();
}