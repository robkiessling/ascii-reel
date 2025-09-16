import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js";
import {SELECTION_COLOR} from "../../config/colors.js";
import {
    HANDLE_CELL_RADIUS, HANDLE_TYPES, SHAPE_BOX_PADDING, SHAPE_DASHED_OUTLINE_LENGTH,
    SHAPE_OUTLINE_WIDTH, SHAPE_TEXT_ACTIONS
} from "../../geometry/shapes/constants.js";
import CellArea from "../../geometry/cell_area.js";
import ShapeSelector from "./shape_selector.js";
import VectorMarquee from "./vector_marquee.js";
import {arraysEqual} from "../../utils/arrays.js";
import {MOUSE} from "../../io/mouse.js";
import {insertAt} from "../../utils/strings.js";
import * as tools from "../tool_controller.js";

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
export function canSelectAllShapes() { return state.selection.vector.canSelectAllShapes() }
export function selectAllShapes(saveHistory = true) {
    if (!canSelectAllShapes()) return false; // Do not emit event or push history

    state.selection.vector.selectAllShapes();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    if (saveHistory) state.pushHistory();
    return true;
}
export function deselectShape(shapeId) { return state.selection.vector.deselectShape(shapeId) }

export function deselectAllShapes(saveHistory = true) {
    if (!hasSelectedShapes()) return false; // Do not emit event or push history

    state.selection.clearSelection();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    if (saveHistory) state.pushHistory();
    return true;
}

export function selectedShapes() { return state.selection.vector.selectedShapes() }
export function selectedShapeTypes() { return state.selection.vector.selectedShapeTypes() }
export function selectedShapeProps() { return state.selection.vector.selectedShapeProps() }

export function selectAll() {
    if (getTextSelection()) {
        selectAllText();
    } else {
        // selectAllShapes is only used with the select tool
        if (state.getConfig('tool') !== 'select') tools.changeTool('select', false);

        selectAllShapes()
    }
}

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


// -------------------------------------------------------------------------------- Events / Shape Selector

let shapeSelector = new ShapeSelector();
let draggedHandle = null; // handle currently being dragged (only active during mousedown/move)
let marquee = null;
let draggedCaretStart; // start point of a text highlight

function setupEventBus() {
    let prevCell;

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvas }) => {
        if (mouseEvent.button !== MOUSE.LEFT) return;
        if (state.getConfig('tool') !== 'select') return;

        const handle = getHandle(cell, mouseEvent, canvas);
        
        if (handle) {
            cell = cellForHandle(cell, handle, canvas, mouseEvent);
            startDraggingHandle(handle, cell, mouseEvent)
        } else {
            if (!mouseEvent.shiftKey) deselectAllShapes();
            createMarquee(canvas, mouseEvent);
        }

        prevCell = cell;
    })

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvas }) => {
        if (draggedHandle) {
            cell = cellForHandle(cell, draggedHandle, canvas, mouseEvent);
            dragHandle(canvas, mouseEvent, cell, prevCell);
        }

        if (marquee) updateMarquee(mouseEvent);

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent }) => {
        if (draggedHandle) finishDraggingHandle();

        if (marquee) finishMarquee(mouseEvent);
    })

    // Note: We handle the EVENTS.CANVAS.DBLCLICK in the normal MOUSEDOWN event handler using mouseEvent.detail
}

function startDraggingHandle(handle, cell, mouseEvent) {
    switch (handle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            clearTextSelection();

            draggedHandle = handle;
            shapeSelector.beginResize();
            break;
        case HANDLE_TYPES.BODY:
            clearTextSelection();

            draggedHandle = handle;
            if (handle.shapeId === undefined) throw new Error(`HANDLE_TYPES.BODY handle must provide shapeId`);

            shapeSelector.mousedownShape(handle.shapeId, mouseEvent.shiftKey && !getTextSelection());
            break;
        case HANDLE_TYPES.CARET:
            draggedHandle = handle;
            if (handle.shapeId === undefined) throw new Error(`HANDLE_TYPES.CARET handle must provide shapeId`);

            // Ensure this is the only shape selected
            setSelectedShapeIds([handle.shapeId])

            const caretIndex = handle.shape.textLayout.getCaretIndexForCell(cell);
            setTextCaret(handle.shapeId, caretIndex);
            draggedCaretStart = caretIndex;
            break;
        default:
            throw new Error(`Unknown handle type: ${handle.type}`)
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
        case HANDLE_TYPES.CARET:
            const newCaretIndex = draggedHandle.shape.textLayout.getCaretIndexForCell(cell);
            const selectionStart = Math.min(draggedCaretStart, newCaretIndex);
            const selectionEnd = Math.max(draggedCaretStart, newCaretIndex);
            setSelectedTextRange(draggedHandle.shape.id, selectionStart, selectionEnd);
            break;
        default:
            throw new Error(`Unknown handle type: ${draggedHandle.type}`)
    }

    shapeSelector.cancelPendingSelection();
}

function finishDraggingHandle() {
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
        case HANDLE_TYPES.CARET:
            // Do nothing
            break;
        default:
            throw new Error(`Unknown handle type: ${draggedHandle.type}`)
    }

    draggedHandle = null;
}

export function getHandle(cell, mouseEvent, canvas) {
    // If a shape is currently being dragged, the handle is locked to the drag handle
    if (draggedHandle) return draggedHandle;

    const shapes = selectedShapes();

    if (shapes.length === 1) {
        const shape = shapes[0];

        // If the caret is already showing or this was a dblclick, check individual shape's caret handle for a match
        if (getTextSelection() || mouseEvent.detail > 1) {
            const caretHandle = shape.handles.caret.at(0);
            if (caretHandle && caretHandle.matches({mouseEvent, canvas, cell})) return caretHandle;
        }

        // Check rest of individual shape's standard handles
        for (const handle of shape.handles.standard) {
            if (handle.matches({mouseEvent, canvas, cell})) return handle;
        }
    } else {
        // Check shape group's non-body handles
        for (const handle of shapeSelector.handles.standard) {
            if (handle.matches({mouseEvent, canvas, cell})) return handle;
        }
    }

    // Check body handles of all shapes (both selected and unselected)
    return state.testCurrentCelShapeHitboxes(cell);
}

/**
 * Caret handles use special cell rounding to make it more text-editor like.
 * See {@link Point#caretCell} for more info.
 */
function cellForHandle(cell, handle, canvas, mouseEvent) {
    return handle.type === HANDLE_TYPES.CARET ?
        canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell :
        cell
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


// ------------------------------------------------------------------------------------------------- Keyboard

/**
 * Handles the escape key being pressed.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEscapeKey() {
    if (!hasSelectedShapes()) return false;

    if (getTextSelection()) {
        clearTextSelection();
    } else {
        deselectAllShapes();
    }

    return true;
}


export function handleEnterKey() {
    if (getTextSelection()) {
        const { shapeId, hasRange, startIndex, endIndex } = getTextSelection();

        if (hasRange) {
            state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex });
            setTextCaret(shapeId, startIndex, { saveHistory: false });
        }
        
        state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.INSERT, { caretIndex: startIndex, char: '\n' });
        moveCaret('right', false);

        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);

        // Store a new history snapshot at the start of the new line. This way the caret jumps from end of line ->
        // start of line -> end of prev line -> start of prev line -> etc. In other words, there are 2 jump
        // positions per line.
        state.pushHistory();
        return true;
    }

    if (selectAllText()) return true;

    // Leaving space for future Enter-key logic

    return false;
}

/**
 * Handles a keyboard key being pressed.
 * @param {string} char - The char of the pressed keyboard key.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCharKey(char) {
    if (!getTextSelection()) return false;

    const { shapeId, hasRange, startIndex, endIndex } = getTextSelection();

    if (hasRange) {
        state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex });
        setTextCaret(shapeId, startIndex, { saveHistory: false });
    }

    state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.INSERT, { caretIndex: startIndex, char: char });
    moveCaret('right', false);

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'vectorSelectionText' })
    return true;
}

let compositionCaretIndex, compositionStartText;

/**
 * Handles the start of a text composition sequence.
 * @param {boolean} rollbackPrevChar - Whether the character typed just before the composition should be rolled back and
 *   included in the composition buffer.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionStart(rollbackPrevChar) {
    if (!getTextSelection()) return false;

    let { shapeId, hasRange, startIndex, endIndex, textLayout } = getTextSelection();

    if (hasRange) {
        state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex });
        setTextCaret(shapeId, startIndex, { saveHistory: false });
        ({ startIndex, textLayout } = getTextSelection()); // get updated values after deleting range
    } else if (rollbackPrevChar) {
        state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_BACKWARD, { caretIndex: startIndex })
        moveCaret('left', false);
        ({ startIndex, textLayout } = getTextSelection()); // get updated values after doing replacement
    }

    compositionCaretIndex = startIndex;
    compositionStartText = textLayout.text;

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'vectorSelectionText' })
    return true;
}

/**
 * Handles updates during an active text composition sequence.
 * @param {string} str - The current composition string. Often a single character such as "´" or "é", but can be
 *   longer if the sequence is invalid (e.g. "´x") or if IME composition is used.
 * @param {string} char - The last char of the composition string (useful if logic only supports a single character).
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionUpdate(str, char) {
    if (!getTextSelection()) return false;

    const { shapeId } = getTextSelection();

    const replacementText = insertAt(compositionStartText, compositionCaretIndex, str);
    state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.REPLACE, { text: replacementText })
    setTextCaret(shapeId, compositionCaretIndex + str.length, { saveHistory: false })

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'vectorSelectionText' })
    return true;
}

/**
 * Handles the end of a text composition sequence.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionEnd() {
    return !!getTextSelection();
}

/**
 * Handles the backspace or delete keyboard key being pressed.
 * @param {boolean} [isDelete=false] - True if it was a Delete keypress, false if it was a Backspace keypress.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleBackspaceKey(isDelete = false) {
    if (getTextSelection()) {
        const { shapeId, hasRange, startIndex, endIndex } = getTextSelection();

        if (hasRange) {
            state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex });
            setTextCaret(shapeId, startIndex, { saveHistory: false });
        } else if (isDelete) {
            state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_FORWARD, { caretIndex: startIndex });
            eventBus.emit(EVENTS.SELECTION.CHANGED) // Caret doesn't change index, but might change cell if right-aligned
        } else {
            state.updateCurrentCelShapeText(shapeId, SHAPE_TEXT_ACTIONS.DELETE_BACKWARD, { caretIndex: startIndex });
            moveCaret('left', false);
        }

        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
        state.pushHistory({ modifiable: 'vectorSelectionText' })
        return true;
    }

    if (hasSelectedShapes()) {
        deleteSelectedShapes();
        return true;
    }

    return false;
}

// ------------------------------------------------------------------------------------------------- Text caret

// Tracks the preferred caret column when moving vertically. If the immediate row above/below is too short to reach
// this column, the caret will land at the row’s end. But if a later row has enough columns again, the caret returns
// as close as possible to this column.
let preferredCaretCol;

export function caretCell() {
    const selection = getTextSelection();
    if (!selection || selection.hasRange) return null;
    return selection.textLayout.getCellForCaretIndex(selection.startIndex)
}
export function selectedTextAreas() {
    const selection = getTextSelection();
    if (!selection || !selection.hasRange) return null;
    return selection.textLayout.lineCellAreas(selection.startIndex, selection.endIndex);
}

export function setSelectedTextRange(shapeId, selectionStart, selectionEnd, saveHistory = true) {
    preferredCaretCol = undefined;
    state.selection.vector.setSelectedTextRange(shapeId, selectionStart, selectionEnd)
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (saveHistory) state.pushHistory({ modifiable: 'vectorSelectionCaret' })
}

export function canEditText() { return state.selection.vector.canEditText() }
export function canSelectAllText() { return state.selection.vector.canSelectAllText() }
export function selectAllText(saveHistory = true) {
    if (!canSelectAllText()) return false;

    preferredCaretCol = undefined;
    state.selection.vector.selectAllText()
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (saveHistory) state.pushHistory({ modifiable: 'vectorSelectionCaret' })
    return true;
}

/**
 * Places the caret into the given shape's text
 * @param {string} shapeId - ID of shape to place the caret in
 * @param {number} caretIndex - Where to place the caret in the text
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.resetPreferredCol=true] - Whether to reset the stored preferred column
 * @param {boolean} [options.saveHistory=true] - Whether to save this caret move to history
 */
export function setTextCaret(shapeId, caretIndex, options = {}) {
    const resetPreferredCol = options.resetPreferredCol === undefined ? true : options.resetPreferredCol;
    const saveHistory = options.saveHistory === undefined ? true : options.saveHistory;

    if (resetPreferredCol) preferredCaretCol = undefined;
    state.selection.vector.setTextCaret(shapeId, caretIndex);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (saveHistory) state.pushHistory({ modifiable: 'vectorSelectionCaret' })
}

/**
 * Retrieves the current text selection, if any. A selection may represent either:
 *   - A highlighted range of text (hasRange = true), or
 *   - A single caret position (hasRange = false).
 *
 * If no selection exists, the function returns null.
 *
 * @returns {?{
 *   shapeId: string,
 *   textLayout: TextLayout,
 *   hasRange: boolean,
 *   startIndex: number,
 *   endIndex: number
 * }} - The active text selection, or null if none exists.
 */
export function getTextSelection() { return state.selection.vector.getTextSelection() }

export function clearTextSelection(saveHistory = true) {
    if (!getTextSelection()) return;

    state.selection.vector.clearTextSelection()

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (saveHistory) state.pushHistory()
}

function moveCaret(direction, saveHistory = true) {
    const selection = getTextSelection();
    if (!selection) throw new Error('Cannot call moveCaret without an existing text selection');

    switch(direction) {
        case 'left':
        case 'right':
            const min = 0;
            const max = selection.textLayout.maxCaretIndex;
            const horizOffset = direction === 'left' ? -1 : 1;
            let newIndex = selection.hasRange ? selection.endIndex : selection.endIndex + horizOffset;
            if (newIndex < min) newIndex = min;
            if (newIndex > max) newIndex = max;
            setTextCaret(selection.shapeId, newIndex, { saveHistory });
            break;
        case 'up':
        case 'down':
            const vertOffset = direction === 'up' ? -1 : 1;
            const currentCell = selection.textLayout.getCellForCaretIndex(
                direction === 'up' ? selection.startIndex : selection.endIndex
            )
            const desiredCell = currentCell.translate(vertOffset, 0);

            if (preferredCaretCol === undefined) {
                preferredCaretCol = desiredCell.col;
            } else {
                desiredCell.col = preferredCaretCol
            }

            const resetPreferredCol = !selection.textLayout.isCellInVerticalBounds(desiredCell);
            const caretIndex = selection.textLayout.getCaretIndexForCell(desiredCell);

            setTextCaret(selection.shapeId, caretIndex, { resetPreferredCol, saveHistory });
            break;
        default:
            throw new Error(`Invalid direction: ${direction}`);
    }
}

/**
 * Handles an arrow key being pressed.
 * @param {'left'|'right'|'up'|'down'} direction - Direction of arrow key
 * @param {boolean} shiftKey - Whether the shift key was also down
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleArrowKey(direction, shiftKey) {
    if (getTextSelection()) {
        moveCaret(direction);
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