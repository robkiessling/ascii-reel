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

/**
 * Vector selection controller.
 *
 * - Re-exports all vector selection state methods so they are available here.
 * - Adds orchestration (history, events, extra logic) by overriding specific methods.
 * - Other controllers and UI code should always use this controller, not call vector state directly.
 */

export function init() {
    setupEventBus();
}

export function selectedShapeIds() { return state.selection.vector.selectedShapeIds() }
export function setSelectedShapeIds(shapeIds) { return state.selection.vector.setSelectedShapeIds(shapeIds) }
export function numSelectedShapes() { return state.selection.vector.numSelectedShapes() }
export function hasSelectedShapes() { return state.selection.vector.hasSelectedShapes() }
export function isShapeSelected(shapeId) { return state.selection.vector.isShapeSelected(shapeId) }
export function selectShape(shapeId) { return state.selection.vector.selectShape(shapeId) }
export function deselectShape(shapeId) { return state.selection.vector.deselectShape(shapeId) }

export function deselectAllShapes(allowHistoryPush = true) {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    state.selection.clearSelection();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    if (allowHistoryPush) state.pushHistory();
}

export function selectedShapes() { return state.selection.vector.selectedShapes() }
export function selectedShapeTypes() { return state.selection.vector.selectedShapeTypes() }
export function selectedShapeProps() { return state.selection.vector.selectedShapeProps() }

/**
 * Updates all selected shapes.
 * @param {(shape: Shape) => boolean} updater - Updater function called for each shape.
 *   Must return `true` if the shape was modified, or `false` otherwise. The return value is always required: it
 *   not only controls whether history is pushed (when `historyMode` is `undefined`), but also whether the canvas
 *   refreshes or change events are emitted.
 * @param {undefined|true|false|string} [historyMode] - Controls history saving behavior:
 *   - undefined: Push history if any `updater` returned `true`
 *   - true: Always push history (if any shapes were selected)
 *   - false: Never push history
 *   - string: Always push history with option `modifiable:<string>`
 */
export function updateSelectedShapes(updater, historyMode) {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    const updated = state.selection.vector.updateSelectedShapes(updater);

    if (updated) {
        eventBus.emit(EVENTS.SELECTION.CHANGED); // So shape property buttons refresh
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    }

    switch(historyMode) {
        case undefined:
            if (updated) state.pushHistory();
            break;
        case true:
            state.pushHistory();
            break;
        case false:
            // Do nothing
            break;
        default:
            state.pushHistory({ modifiable: historyMode })
    }
}

export function deleteSelectedShapes() {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    state.selection.vector.deleteSelectedShapes();
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

export function canReorderSelectedShapes(action) { return state.selection.vector.canReorderSelectedShapes(action) }

export function reorderSelectedShapes(action) {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    state.selection.vector.reorderSelectedShapes(action);
    eventBus.emit(EVENTS.SELECTION.CHANGED); // So shape property buttons refresh
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

export function setShapeCursor(shapeId, atIndex, resetPreferredCol = true) {
    if (resetPreferredCol) preferredCursorCol = undefined;
    state.selection.vector.setShapeCursor(shapeId, atIndex);
    eventBus.emit(EVENTS.SELECTION.CHANGED)
}

export function getShapeCursor() { return state.selection.vector.getShapeCursor() }


// -------------------------------------------------------------------------------- Events / Shape Selector

let shapeSelector = new ShapeSelector();
let draggedHandle = null; // handle currently being dragged (only active during mousedown/move)
let marquee = null;

function setupEventBus() {
    let prevCell;

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvas }) => {
        if (mouseEvent.button !== MOUSE.LEFT) return;

        const tool = state.getConfig('tool')

        prevCell = cell;

        switch(tool) {
            case 'select':
                onMousedown(cell, mouseEvent, canvas);
                break;
            default:
                return; // Ignore all other tools
        }
    })

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvas }) => {
        if (draggedHandle) {
            dragHandle(canvas, mouseEvent, cell, prevCell);
            prevCell = cell;
        }

        if (marquee) updateMarquee(mouseEvent);

    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell, canvas }) => {
        if (draggedHandle) finishDragHandle();

        if (marquee) finishMarquee(mouseEvent);
    })
}


function onMousedown(cell, mouseEvent, canvas) {
    const handle = getHandle(cell, mouseEvent, canvas);

    if (!handle) {
        if (mouseEvent.shiftKey) {
            createMarquee(canvas, mouseEvent);
        } else {
            deselectAllShapes();
            createMarquee(canvas, mouseEvent);
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

            shapeSelector.mousedownShape(handle.shapeId, mouseEvent.shiftKey);
            break;
    }
}

function dragHandle(canvas, mouseEvent, cell, prevCell) {
    switch (draggedHandle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            const roundedCell = canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).roundedCell;
            shapeSelector.resize(draggedHandle, cell, roundedCell)
            break;
        case HANDLE_TYPES.BODY:
            shapeSelector.translate(cell.row - prevCell.row, cell.col - prevCell.col)
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    shapeSelector.cancelPendingSelection();
}

function finishDragHandle() {
    switch (draggedHandle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            shapeSelector.finishResize()
            break;
        case HANDLE_TYPES.BODY:
            shapeSelector.commitPendingSelection()
            shapeSelector.finishTranslate()
            break;
        case null:
            throw new Error("Cannot dragHandle with null handle type")
    }

    draggedHandle = null;
}

export function getHandle(cell, mouseEvent, canvas) {
    // If a shape is currently being dragged, the handle is locked to the drag handle
    if (draggedHandle) return draggedHandle;

    const shapes = selectedShapes();

    if (shapes.length === 1) {
        // Check individual shape's non-body handles
        const shape = shapes[0];
        for (const handle of shape.handles.nonBody) {
            if (handle.matches({mouseEvent, canvas, cell})) return handle;
        }
    } else {
        // Check shape group's non-body handles
        for (const handle of shapeSelector.handles.nonBody) {
            if (handle.matches({mouseEvent, canvas, cell})) return handle;
        }
    }

    // Check body handles of all shapes (both selected and unselected)
    return state.testCurrentCelShapeHitboxes(cell);
}

// ------------------------------------------------------------------------------------------------- Marquee
// The "marquee" refers to the rectangular drag area created by the user as they click-and-drag on the canvas.

function createMarquee(canvas, mouseEvent) {
    const isFreshMarquee = !hasSelectedShapes();
    const originalSelection = selectedShapeIds();

    marquee = new VectorMarquee({
        canvas,
        startX: mouseEvent.offsetX,
        startY: mouseEvent.offsetY,
        onUpdate: area => {
            const marqueeShapeIds = state.testCurrentCelMarquee(area).map(shape => shape.id);

            if (isFreshMarquee) {
                // If fresh marquee, set selected shapes to match the covered shapes (this allows shapes to be
                // added/removed as the marquee boundaries change)
                setSelectedShapeIds(marqueeShapeIds);
            } else {
                // If selection already exists, shapes will only be *added* to selection; if the marquee adds a rect
                // and then the marquee is moved away, the rect remains added
                marqueeShapeIds.forEach(shapeId => selectShape(shapeId));
            }
        },
        onFinish: () => {
            const hasStateChange = !arraysEqual(originalSelection, selectedShapeIds())
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
    let { shape, cursorIndex } = getShapeCursor();
    if (!shape) return null;
    if (!getTextLayout()) return null;
    return getTextLayout().getCellForCursorIndex(cursorIndex)
}

function getTextLayout() {
    return getShapeCursor().shape.textLayout;
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

    setShapeCursor(getShapeCursor().shape.id, cursorIndex, resetPreferredCol);
}

function moveCursorInHorizDir(horizOffset) {
    const min = 0;
    const max = getShapeCursor().shape.textLayout.maxCursorIndex;
    let newIndex = getShapeCursor().cursorIndex + horizOffset;
    if (newIndex < min) newIndex = min;
    if (newIndex > max) newIndex = max;
    setShapeCursor(getShapeCursor().shape.id, newIndex, true);
}

/**
 * Handles an arrow key being pressed.
 * @param {'left'|'right'|'up'|'down'} direction - Direction of arrow key
 * @param {boolean} shiftKey - Whether the shift key was also down
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleArrowKey(direction, shiftKey) {
    if (caretCell()) {
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

        return true; // Consume keyboard event
    }

    if (hasSelectedShapes()) {
        let rowOffset = 0, colOffset = 0;

        switch(direction) {
            case 'left':
                colOffset = -1;
                break;
            case 'up':
                rowOffset = -1;
                break;
            case 'right':
                colOffset = 1;
                break;
            case 'down':
                rowOffset = 1;
                break;
            default:
                throw new Error(`Invalid direction: ${direction}`);
        }

        updateSelectedShapes(shape => {
            shape.translate(rowOffset, colOffset);
            return true; // Shape change has occurred - need to clear shape's cache
        }, 'vectorSelectionMove');

        return true; // Consume keyboard event
    }

    return false;
}



// ------------------------------------------------------------------------------------------------- Drawing

export function drawShapeSelection(canvas) {
    canvas.inScreenSpace(() => {
        const shapes = selectedShapes();

        if (shapes.length === 0) {
            // no shapes to draw
        } else if (shapes.length === 1) {
            const shape = shapes[0];
            if (shape.handles.showBoundingBox) drawBoundingBox(canvas, shape.boundingArea);
            drawHandles(canvas, shape.handles);
        } else {
            shapes.forEach(shape => drawBoundingBox(canvas, shape.boundingArea))

            const cumulativeArea = CellArea.mergeCellAreas(shapes.map(shape => shape.boundingArea))
            drawBoundingBox(canvas, cumulativeArea, true)
            drawHandles(canvas, shapeSelector.handles)
        }

        if (marquee) drawMarquee(canvas);
    })
}

function drawBoundingBox(canvas, cellArea, dashed = false) {
    const context = canvas.context;

    context.lineWidth = SHAPE_OUTLINE_WIDTH;
    context.setLineDash(dashed ? [SHAPE_DASHED_OUTLINE_LENGTH, SHAPE_DASHED_OUTLINE_LENGTH] : []);
    context.strokeStyle = SELECTION_COLOR;

    context.beginPath();
    context.rect(...buildScreenRect(canvas, cellArea.xywh, SHAPE_BOX_PADDING));
    context.stroke();
}

function drawMarquee(canvas) {
    const context = canvas.context;
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
 * @param {Canvas} canvas - canvas controller so we can perform world/screen conversions
 * @param {Array} xywh - Rectangle properties in world space
 * @param {number} padding - Padding (in screen space) to apply. Screen pixels means it won't be affected by zoom.
 * @returns {Array} - xywh rectangle properties in screen space
 */
function buildScreenRect(canvas, xywh, padding) {
    const [x, y, w, h] = xywh;

    // Convert rectangle to screen pixels
    const topLeftScreen = canvas.worldToScreen(x, y);
    const bottomRightScreen = canvas.worldToScreen(x + w, y + h);

    return [
        topLeftScreen.x - padding,
        topLeftScreen.y - padding,
        bottomRightScreen.x - topLeftScreen.x + 2 * padding,
        bottomRightScreen.y - topLeftScreen.y + 2 * padding,
    ]
}

function drawHandles(canvas, handles) {
    for (const handle of handles) {
        switch (handle.type) {
            case HANDLE_TYPES.VERTEX:
                drawCorner(canvas, handle)
                break;
            // HANDLE_TYPES.EDGE has no visual representation
            case HANDLE_TYPES.CELL:
                drawCellHandle(canvas, handle.cell);
                break;
        }
    }
}

function drawCorner(canvas, handle) {
    const { x, y, size, radius } = handle.geometry(canvas);

    const context = canvas.context;

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

function drawCellHandle(canvas, cell) {
    const context = canvas.context;

    context.lineWidth = SHAPE_OUTLINE_WIDTH;
    context.setLineDash([]);
    context.strokeStyle = SELECTION_COLOR;

    context.beginPath();
    context.roundRect(
        ...buildScreenRect(canvas, cell.xywh, SHAPE_BOX_PADDING),
        HANDLE_CELL_RADIUS
    )

    context.stroke();
}