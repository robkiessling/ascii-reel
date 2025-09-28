import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js";
import {SELECTION_COLOR} from "../../config/colors.js";
import {
    CARET_HANDLE_SELECTION_MODES, CHAR_PROP, COLOR_PROP,
    HANDLE_CELL_RADIUS, HANDLE_TYPES, SHAPE_BOX_PADDING, SHAPE_DASHED_OUTLINE_LENGTH,
    SHAPE_OUTLINE_WIDTH, SHAPE_TEXT_ACTIONS, SHAPE_TYPES, TEXT_PROP
} from "../../geometry/shapes/constants.js";
import CellArea from "../../geometry/cell_area.js";
import ShapeSelector from "./shape_selector.js";
import VectorMarquee from "./vector_marquee.js";
import {areArraysEqual} from "../../utils/arrays.js";
import {MOUSE} from "../../io/mouse.js";
import {insertAt} from "../../utils/strings.js";
import * as tools from "../tool_controller.js";
import Shape from "../../geometry/shapes/shape.js";
import {isFunction} from "../../utils/utilities.js";
import {changeTool} from "../tool_controller.js";
import Cell from "../../geometry/cell.js";

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
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    if (saveHistory) saveDistinctHistory();
    return true;
}
export function deselectShape(shapeId) { return state.selection.vector.deselectShape(shapeId) }

export function deselectAllShapes(saveHistory = true) {
    if (!hasSelectedShapes()) return false; // Do not emit event or push history

    state.selection.vector.deselectAllShapes();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    if (saveHistory) saveDistinctHistory();
    return true;
}

export function selectedShapes() { return state.selection.vector.selectedShapes() }
export function selectedShapeTypes() { return state.selection.vector.selectedShapeTypes() }
export function selectedShapeProps() { return state.selection.vector.selectedShapeProps() }

export function selectAll() {
    if (isEditingText()) {
        selectAllText();
    } else {
        // selectAllShapes is only used with the select tool
        if (state.getConfig('tool') !== 'select') tools.changeTool('select', false);

        selectAllShapes()
    }
}

/**
 * Updates all selected shapes.
 * @param {(shape: Shape) => boolean|void} updater - Updater function called for each shape.
 *   Should return `true` if the shape was modified, or `false` otherwise. This controls whether the canvas refreshes,
 *   change events are emitted, and, if historyMode:undefined, whether history is pushed. If the updater returns
 *   void, this will be interpreted as true (it assumes a modification was made).
 * @param {undefined|true|false|function(updated: boolean)} [historyMode] - Controls history saving behavior:
 *   - undefined: Push history if any `updater` returned `true`
 *   - true: Always push history (if any shapes were selected)
 *   - false: Never push history
 *   - function: Calls a custom function that may save history as it chooses
 */
export function updateSelectedShapes(updater, historyMode) {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    const updated = state.selection.vector.updateSelectedShapes(updater);

    if (updated) {
        eventBus.emit(EVENTS.SELECTION.CHANGED); // So shape property buttons refresh
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    }

    if (historyMode === undefined) {
        if (updated) saveDistinctHistory();
    } else if (isFunction(historyMode)) {
        historyMode(updated);
    } else if (historyMode === true) {
        saveDistinctHistory();
    }
}

export function deleteSelectedShapes() {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    state.selection.vector.deleteSelectedShapes();
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveDistinctHistory();
}

export function canReorderSelectedShapes(action) { return state.selection.vector.canReorderSelectedShapes(action) }

export function reorderSelectedShapes(action) {
    if (!hasSelectedShapes()) return; // Do not emit event or push history

    state.selection.vector.reorderSelectedShapes(action);
    eventBus.emit(EVENTS.SELECTION.CHANGED); // So shape property buttons refresh
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveDistinctHistory();
}

export function selectedShapesGlyphs() {
    return shapeSelector.glyphs;
}


// -------------------------------------------------------------------------------- Events / Shape Selector

let shapeSelector = new ShapeSelector(() => {
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    saveDistinctHistory();
});

let draggedHandle = null; // handle currently being dragged (only active during mousedown/move)
let marquee = null;
let pasteCell; // Remember latest mouseup/mousedown cells for use when pasting

function setupEventBus() {
    let prevCell;

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvas }) => {
        if (mouseEvent.button !== MOUSE.LEFT) return;
        pasteCell = cell;
        if (state.getConfig('tool') !== 'select') return;

        const handle = getHandle(cell, mouseEvent, canvas);

        if (handle) {
            startHandleDrag(canvas, mouseEvent, cell, handle)
        } else if (mouseEvent.detail > 1) {
            createEmptyTextbox(cell);
        } else {
            if (!mouseEvent.shiftKey) deselectAllShapes();
            startMarquee(canvas, mouseEvent);
        }

        prevCell = cell;
    })

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvas }) => {
        if (draggedHandle) updateHandleDrag(canvas, mouseEvent, cell, prevCell);
        if (marquee) updateMarquee(mouseEvent);

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell }) => {
        if (draggedHandle) finishHandleDrag();
        if (marquee) finishMarquee(mouseEvent);
        pasteCell = cell;
    })

    // Note: We handle the EVENTS.CANVAS.DBLCLICK (and higher) in the normal MOUSEDOWN event handler using mouseEvent.detail
}

function startHandleDrag(canvas, mouseEvent, cell, handle) {
    switch (handle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            stopEditingText();

            draggedHandle = handle;
            shapeSelector.beginResize();
            break;
        case HANDLE_TYPES.BODY:
            stopEditingText();

            draggedHandle = handle;
            if (handle.shapeId === undefined) throw new Error(`HANDLE_TYPES.BODY handle must provide shapeId`);

            shapeSelector.mousedownShape(handle.shapeId, mouseEvent.shiftKey && !isEditingText());
            break;
        case HANDLE_TYPES.CARET:
            draggedHandle = handle;
            if (handle.shapeId === undefined) throw new Error(`HANDLE_TYPES.CARET handle must provide shapeId`);
            startTextSelection(canvas, mouseEvent, cell, handle);
            break;
        default:
            throw new Error(`Unknown handle type: ${handle.type}`)
    }
}

// Cache the last *rounded* cell under the cursor to prevent redundant handle updates.
// Note: This is distinct from `prevCell`, which tracks unrounded positions.
let prevRoundedCell;

function updateHandleDrag(canvas, mouseEvent, cell, prevCell) {
    switch (draggedHandle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            const roundedCell = canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).roundedCell;
            if (prevRoundedCell && prevRoundedCell.equals(roundedCell)) return;
            prevRoundedCell = roundedCell.clone();
            shapeSelector.resize(draggedHandle, cell, roundedCell)
            break;
        case HANDLE_TYPES.BODY:
            if (prevCell && prevCell.equals(cell)) return;
            shapeSelector.translate(cell.row - prevCell.row, cell.col - prevCell.col)
            break;
        case HANDLE_TYPES.CARET:
            updateTextSelection(canvas, mouseEvent, cell, draggedHandle)
            break;
        default:
            throw new Error(`Unknown handle type: ${draggedHandle.type}`)
    }

    shapeSelector.cancelPendingSelection();
}

function finishHandleDrag() {
    switch (draggedHandle.type) {
        case HANDLE_TYPES.VERTEX:
        case HANDLE_TYPES.EDGE:
        case HANDLE_TYPES.CELL:
            prevRoundedCell = undefined;
            if (shapeSelector.finishResize()) saveShapesMoved();
            break;
        case HANDLE_TYPES.BODY:
            shapeSelector.commitPendingSelection()
            if (shapeSelector.finishTranslate()) saveShapesMoved();
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
        if (isEditingText() || mouseEvent.detail > 1) {
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


// ------------------------------------------------------------------------------------------------- Marquee
// The "marquee" refers to the rectangular drag area created by the user as they click-and-drag on the canvas.

function startMarquee(canvas, mouseEvent) {
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
            const hasStateChange = !areArraysEqual(originalSelection, selectedShapeIds())
            if (hasStateChange) saveDistinctHistory();
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


// ------------------------------------------------------------------------------------------------- Textbox/Pasting

/**
 * Creates an empty 1x1 textbox at target cell location. Textbox will be immediately put into edit-mode.
 * @param {Cell} cell - Position to place textbox
 */
function createEmptyTextbox(cell) {
    const textbox = Shape.begin(SHAPE_TYPES.TEXTBOX, {
        topLeft: cell,
        numRows: 1,
        numCols: 1,
        [CHAR_PROP]: state.getConfig('primaryChar'),
        [COLOR_PROP]: state.primaryColorIndex(),
    })
    state.addCurrentCelShape(textbox);
    changeTool('select', false);
    setSelectedShapeIds([textbox.id])
    setTextCaret(0, { saveHistory: false });

    eventBus.emit(EVENTS.REFRESH.ALL);
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    saveDistinctHistory();
}

/**
 * Creates a new textbox pre‑filled with the given text.
 * @param {string} text - Text to fill textbox with. May contain newline chars '\n'.
 * @param {Cell} [cell] - The cell where the textbox should be created. If omitted/undefined, will use this controller's
 *   current paste location (typically the cell of the most recent mouse-up/mouse-down event).
 */
export function createTextboxWithText(text, cell = nextPasteLocation()) {
    if (!text) return;

    const textbox = Shape.begin(SHAPE_TYPES.TEXTBOX, {
        topLeft: cell,
        numRows: 1, // doesn't actually matter since we have auto width enabled
        numCols: 1,
        [CHAR_PROP]: state.getConfig('primaryChar'),
        [COLOR_PROP]: state.primaryColorIndex(),
        [TEXT_PROP]: text
    })
    state.addCurrentCelShape(textbox);
    changeTool('select', false);
    setSelectedShapeIds([textbox.id])

    eventBus.emit(EVENTS.REFRESH.ALL);
    eventBus.emit(EVENTS.SELECTION.CHANGED)
    saveDistinctHistory();
}

/**
 * Imports and inserts serialized shapes into the current canvas frame.
 *
 * Each shape is deserialized, added to the current cel, and selected. After insertion, all imported shapes are
 * translated to the current paste location.
 *
 * @param {Array<Object>} serializedShapes - An array of shape data to deserialize and insert.
 */
export function importShapes(serializedShapes) {
    const importedShapes = serializedShapes.map(serializedShape => {
        const shape = Shape.deserialize(serializedShape);
        state.addCurrentCelShape(shape);
        return shape;
    })

    setSelectedShapeIds(importedShapes.map(shape => shape.id));

    shapeSelector.translateTo(nextPasteLocation());

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveDistinctHistory()
}

/**
 * Returns the next cell to paste content into. Each call returns a slightly offset location, so repeated pastes
 * won't overlap.
 *
 * @returns {Cell} A clone of the current paste location before it is incremented.
 */
function nextPasteLocation() {
    if (!pasteCell) pasteCell = new Cell(0,0);
    const location = pasteCell.clone();

    // Nudge the cached pasteCell diagonally (down and right) for the next paste
    pasteCell.translate(1, 1);

    return location;
}

// ------------------------------------------------------------------------------------------------- Keyboard

/**
 * Handles the escape key being pressed.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEscapeKey() {
    if (!hasSelectedShapes()) return false;

    if (isEditingText()) {
        stopEditingText();
    } else {
        deselectAllShapes();
    }

    return true;
}


export function handleEnterKey() {
    if (isEditingText()) {
        const { shapeId, hasRange, startIndex, endIndex } = getTextSelection();

        if (hasRange) {
            state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex }))
            setTextCaret(startIndex, { saveHistory: false });
        }
        
        state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.INSERT, { caretIndex: startIndex, text: '\n' }))
        moveCaret('right', false);

        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);

        // Store a new history snapshot at the start of the new line. This way the caret jumps from end of line ->
        // start of line -> end of prev line -> start of prev line -> etc. In other words, there are 2 jump
        // positions per line.
        saveDistinctHistory();
        return true;
    }

    if (canEnterEditMode() && selectAllText()) return true;

    // Leaving space for future Enter-key logic

    return false;
}

/**
 * Handles a keyboard key being pressed.
 * @param {string} char - The char of the pressed keyboard key.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCharKey(char) {
    if (!isEditingText()) return false;

    insertText(char);
    return true;
}

export function insertText(text) {
    if (!isEditingText()) throw new Error(`No place to insert text`);

    const { shapeId, hasRange, startIndex, endIndex } = getTextSelection();

    if (hasRange) {
        state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex }));
        setTextCaret(startIndex, { saveHistory: false });
    }

    state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.INSERT, { caretIndex: startIndex, text }));
    setTextCaret(startIndex + text.length, { saveHistory: false })

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveTextUpdated()
}


let compositionCaretIndex, compositionStartText;

/**
 * Handles the start of a text composition sequence.
 * @param {boolean} rollbackPrevChar - Whether the character typed just before the composition should be rolled back and
 *   included in the composition buffer.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionStart(rollbackPrevChar) {
    if (!isEditingText()) return false;

    let { shapeId, hasRange, startIndex, endIndex, textLayout } = getTextSelection();

    if (hasRange) {
        state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex }));
        setTextCaret(startIndex, { saveHistory: false });
        ({ startIndex, textLayout } = getTextSelection()); // get updated values after deleting range
    } else if (rollbackPrevChar) {
        state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_BACKWARD, { caretIndex: startIndex }))
        moveCaret('left', false);
        ({ startIndex, textLayout } = getTextSelection()); // get updated values after doing replacement
    }

    compositionCaretIndex = startIndex;
    compositionStartText = textLayout.text;

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveTextUpdated()
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
    if (!isEditingText()) return false;

    const { shapeId } = getTextSelection();

    const replacementText = insertAt(compositionStartText, compositionCaretIndex, str);
    state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.REPLACE, { text: replacementText }))
    setTextCaret(compositionCaretIndex + str.length, { saveHistory: false })

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveTextUpdated()
    return true;
}

/**
 * Handles the end of a text composition sequence.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionEnd() {
    return isEditingText();
}

/**
 * Handles the backspace or delete keyboard key being pressed.
 * @param {boolean} [isDelete=false] - True if it was a Delete keypress, false if it was a Backspace keypress.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleBackspaceKey(isDelete = false) {
    if (isEditingText()) {
        const { shapeId, hasRange, startIndex, endIndex } = getTextSelection();

        if (hasRange) {
            state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_RANGE, { startIndex, endIndex }));
            setTextCaret(startIndex, { saveHistory: false });
        } else if (isDelete) {
            state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_FORWARD, { caretIndex: startIndex }));
            eventBus.emit(EVENTS.SELECTION.CHANGED) // Caret doesn't change index, but might change cell if right-aligned
        } else {
            state.updateCurrentCelShape(shapeId, shape => shape.updateText(SHAPE_TEXT_ACTIONS.DELETE_BACKWARD, { caretIndex: startIndex }));
            moveCaret('left', false);
        }

        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
        saveTextUpdated()
        return true;
    }

    if (hasSelectedShapes()) {
        deleteSelectedShapes();
        return true;
    }

    return false;
}

/**
 * Handles an arrow key being pressed.
 * @param {'left'|'right'|'up'|'down'} direction - Direction of arrow key
 * @param {boolean} shiftKey - Whether the shift key was also down
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleArrowKey(direction, shiftKey) {
    if (isEditingText()) {
        if (shiftKey) {
            expandTextSelection(direction);
        } else {
            moveCaret(direction);
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

        updateSelectedShapes(shape => shape.translate(rowOffset, colOffset), () => saveShapesMoved());

        return true; // Consume keyboard event
    }

    return false;
}

// ------------------------------------------------------------------------------------------------- Text caret

/**
 * Remembers the caret's "preferred" column when moving vertically. If the current line is shorter than this column,
 * the caret may be clamped, but the preferred column is preserved so it can be restored on longer lines.
 *
 * @type {number|undefined}
 */
let preferredCaretCol;

export function caretCell() {
    if (!isEditingText()) return null;
    const { textLayout, focusIndex } = getTextSelection();
    return textLayout.getCellForCaretIndex(focusIndex)
}
export function selectedTextAreas() {
    if (!isEditingText()) return null;
    const { isCollapsed, textLayout, startIndex, endIndex } = getTextSelection();
    if (isCollapsed) return null;
    return textLayout.lineCellAreas(startIndex, endIndex);
}

export function hasTextProperty() { return state.selection.vector.hasTextProperty() }
export function canEnterEditMode() { return state.selection.vector.canEnterEditMode() }
export function canSelectAllText() { return state.selection.vector.canSelectAllText() }

export function selectAllText(saveHistory = true) {
    if (!canSelectAllText()) return false;

    preferredCaretCol = undefined;
    state.selection.vector.selectAllText()

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    if (saveHistory) saveTextSelectionMoved()

    return true;
}

/**
 * Activates text-editing mode for the currently selected shape (if not already active) and selects a range of text
 * between the given indices. Text selections are directional: the anchorIndex is the fixed point where the selection
 * began, while the focusIndex is the moving end (which may be to the left or right of the anchor).
 *
 * @param {number} anchorIndex - The fixed index where the selection began.
 * @param {number} focusIndex - The moving index where the selection ends.
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.resetPreferredCol=true] - Whether to reset the stored preferred column
 * @param {boolean} [options.saveHistory=true] - Whether to save this selection change to history
 */
export function setSelectedTextRange(anchorIndex, focusIndex, options = {}) {
    const resetPreferredCol = options.resetPreferredCol === undefined ? true : options.resetPreferredCol;
    const saveHistory = options.saveHistory === undefined ? true : options.saveHistory;

    if (resetPreferredCol) preferredCaretCol = undefined;
    state.selection.vector.setSelectedTextRange(anchorIndex, focusIndex);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    if (saveHistory) saveTextSelectionMoved()
}


/**
 * Activates text-editing mode for the currently selected shape (if not already active) and creates a collapsed
 * selection at the given index. A collapsed selection is just a single blinking caret; no highlighted range.
 *
 * @param {number} caretIndex - The character index to place the caret.
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.resetPreferredCol=true] - Whether to reset the stored preferred column
 * @param {boolean} [options.saveHistory=true] - Whether to save this selection change to history
 *
 * TODO add refresh option to improve performance? e.g. from insertText, don't need to emit changes yet
 */
export function setTextCaret(caretIndex, options = {}) {
    const resetPreferredCol = options.resetPreferredCol === undefined ? true : options.resetPreferredCol;
    const saveHistory = options.saveHistory === undefined ? true : options.saveHistory;

    if (resetPreferredCol) preferredCaretCol = undefined;
    state.selection.vector.setTextCaret(caretIndex);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    if (saveHistory) saveTextSelectionMoved()
}

/**
 * Retrieves details about the current text selection within the active shape. Throws an error if not currently
 * editing text in exactly one shape.
 */
export function getTextSelection() { return state.selection.vector.getTextSelection() }

export function isEditingText() { return state.selection.vector.isEditingText() }

export function stopEditingText(saveHistory = true) {
    if (!isEditingText()) return;

    state.selection.vector.stopEditingText()

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME); // Refresh chars canvas in case shape text overflow changed
    if (saveHistory) saveDistinctHistory()
}

/**
 * Moves the caret in the given direction, collapsing any selection.
 *
 * @param {'left'|'right'|'up'|'down'} direction - Movement direction.
 * @param {boolean} [saveHistory=true] - Whether to push the change to history.
 */
function moveCaret(direction, saveHistory = true) {
    const { caretIndex, resetPreferredCol } = getCaretInDirection(direction, false);
    setTextCaret(caretIndex, { saveHistory, resetPreferredCol })
}


/**
 * Expands or shrinks the current text selection by moving only the focus (the "moving end") in the given direction.
 *
 * @param {'left'|'right'|'up'|'down'} direction - Expansion direction.
 * @param {boolean} [saveHistory=true] - Whether to push the change to history.
 */
function expandTextSelection(direction, saveHistory = true) {
    const { caretIndex: newFocusIndex, resetPreferredCol } = getCaretInDirection(direction, true);
    setSelectedTextRange(getTextSelection().anchorIndex, newFocusIndex, { saveHistory, resetPreferredCol })
}

/**
 * Computes the next caret position given a direction.
 *
 * @param {'left'|'right'|'up'|'down'} direction - Movement direction.
 * @param {boolean} [forExpansion=false] - If true, keep the anchor fixed and only move the focus.
 * @returns {{ caretIndex: number, resetPreferredCol: boolean }}
 *   caretIndex: the new caret/selection focus index
 *   resetPreferredCol: whether to reset preferred horizontal column tracking
 */
function getCaretInDirection(direction, forExpansion = false) {
    const textSelection = getTextSelection();
    let caretIndex, resetPreferredCol;

    switch(direction) {
        case 'left':
        case 'right':
            const min = textSelection.textLayout.minCaretIndex;
            const max = textSelection.textLayout.maxCaretIndex;

            // For expansion, always start from current focus; otherwise use the active edge
            if (forExpansion) {
                caretIndex = textSelection.focusIndex;
            } else {
                caretIndex = direction === 'left' ? textSelection.startIndex : textSelection.endIndex;
            }

            // Advance one step, except when collapsing a selection into a caret
            if (forExpansion || !textSelection.hasRange) caretIndex += direction === 'left' ? -1 : 1;

            if (caretIndex < min) caretIndex = min;
            if (caretIndex > max) caretIndex = max;

            // Left/right movement always resets preferred column
            resetPreferredCol = true;
            break;
        case 'up':
        case 'down':
            // For expansion, always start from current focus; otherwise use the active edge
            if (forExpansion) {
                caretIndex = textSelection.focusIndex;
            } else {
                caretIndex = direction === 'up' ? textSelection.startIndex : textSelection.endIndex;
            }

            // Vertical movement is based on cells, not raw caret indices. Find the cell one row above/below current cell.
            const currentCell = textSelection.textLayout.getCellForCaretIndex(caretIndex);
            const desiredCell = currentCell.translate(direction === 'up' ? -1 : 1, 0);

            // Stick to the preferred column if it's set; otherwise, record it now.
            if (preferredCaretCol !== undefined) {
                desiredCell.col = preferredCaretCol;
            } else {
                preferredCaretCol = desiredCell.col;
            }

            // Convert the desired cell back into a caret index.
            caretIndex = textSelection.textLayout.getCaretIndexForCell(desiredCell);

            // Vertical movement resets preferred column when hitting the top or bottom text bounds
            resetPreferredCol = !textSelection.textLayout.isCellInVerticalBounds(desiredCell);
            break;
        default:
            throw new Error(`Invalid direction: ${direction}`);
    }

    return { caretIndex, resetPreferredCol }
}

/**
 * Begins a text selection operation in response to a mouse click.
 *
 * Behavior depends on the click count (`mouseEvent.detail`):
 * - Single click (or if not already editing): collapses selection into a caret
 * - Double click: selects the entire word at the clicked cell
 * - Triple click or higher: selects the entire paragraph at the clicked cell
 *
 * @param {Canvas} canvas - Canvas instance, used to convert screen to world coordinates
 * @param {MouseEvent} mouseEvent - The mouse event that initiated the selection
 * @param {Cell} cell - The text cell that was clicked
 * @param {CaretHandle} handle - Handle object for the caret/selection. We store additional data
 */
function startTextSelection(canvas, mouseEvent, cell, handle) {
    // Ensure this is the only shape selected
    setSelectedShapeIds([handle.shapeId])

    if (!isEditingText() || mouseEvent.detail === 1) {
        // Single click (or not yet editing): collapse selection into a caret
        // When single clicking, we do not just use the provided `cell`. We round up or down; see Cell#caretCell definition.
        const caretCell = canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell
        const caretIndex = handle.shape.textLayout.getCaretIndexForCell(caretCell);
        setTextCaret(caretIndex);
        handle.selectionMode = CARET_HANDLE_SELECTION_MODES.CHAR;
    } else if (mouseEvent.detail === 2) {
        // Double click: select entire word under cell
        const word = getTextSelection().textLayout.wordAtCell(cell);
        setSelectedTextRange(word[0], word[1])
        handle.selectionMode = CARET_HANDLE_SELECTION_MODES.WORD;
    } else {
        // Triple click or higher: select entire paragraph under cell
        const paragraph = getTextSelection().textLayout.paragraphAtCell(cell);
        setSelectedTextRange(paragraph[0], paragraph[1])
        handle.selectionMode = CARET_HANDLE_SELECTION_MODES.PARAGRAPH;
    }

    // Save the initial normalized selection range for drag/expansion logic
    handle.initialSelection = [getTextSelection().startIndex, getTextSelection().endIndex];
}

/**
 * Updates the active text selection while dragging after an initial click. Behavior depends on the handle's selectionMode:
 * - CHAR: extend the selection by character
 * - WORD: extend the selection by word
 * - PARAGRAPH: extend the selection by paragraph
 *
 * @param {Canvas} canvas - Canvas instance, used to convert mouse coords to text cells.
 * @param {MouseEvent} mouseEvent - Current mouse event during drag.
 * @param {Cell} cell - The text cell under the mouse.
 * @param {CaretHandle} handle - Caret handle tracking selection state.
 */
function updateTextSelection(canvas, mouseEvent, cell, handle) {
    switch(handle.selectionMode) {
        case CARET_HANDLE_SELECTION_MODES.CHAR:
            // When single clicking, we do not just use the provided `cell`. We round up or down; see Cell#caretCell definition.
            const caretCell = canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell
            const mouseIndex = handle.shape.textLayout.getCaretIndexForCell(caretCell);
            if (mouseIndex < handle.initialSelection[0]) {
                setSelectedTextRange(handle.initialSelection[1], mouseIndex);
            } else {
                setSelectedTextRange(handle.initialSelection[0], mouseIndex);
            }
            break;
        case CARET_HANDLE_SELECTION_MODES.WORD:
            const word = getTextSelection().textLayout.wordAtCell(cell);
            if (word[0] < handle.initialSelection[0]) {
                setSelectedTextRange(handle.initialSelection[1], word[0]);
            } else {
                setSelectedTextRange(handle.initialSelection[0], word[1]);
            }
            break;
        case CARET_HANDLE_SELECTION_MODES.PARAGRAPH:
            const paragraph = getTextSelection().textLayout.paragraphAtCell(cell);
            if (paragraph[0] < handle.initialSelection[0]) {
                setSelectedTextRange(handle.initialSelection[1], paragraph[0]);
            } else {
                setSelectedTextRange(handle.initialSelection[0], paragraph[1]);
            }
            break;
        default:
            throw new Error(`Invalid selectionMode: ${handle.selectionMode}`);
    }
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

export function drawShapeBoundingBox(canvas, shape) {
    canvas.inScreenSpace(() => {
        drawBoundingBox(canvas, shape.boundingArea);
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


// -------------------------------------------------------------------------------- History Management

/**
 * Saves a shape moving or resizing. This means consecutive moving/resizing of a given shape will all be grouped
 * under a single undo.
 */
function saveShapesMoved() {
    state.pushHistory({ modifiable: 'vectorShapesMoved' });
}

/**
 * Saves a text selection changing (e.g. caret moving, highlighting new words, etc.). This means consecutive
 * text selection changes will be grouped under a single undo.
 */
function saveTextSelectionMoved() {
    state.pushHistory({ modifiable: 'vectorTextSelectionMoved' });
}

/**
 * Saves a selection text update (e.g. adding new chars, deleting chars). This means consecutive text edits
 * will be grouped under a single undo.
 *
 * Because this is different from saveTextSelectionMoved, each newline char will end being its own undo slice.
 */
function saveTextUpdated() {
    state.pushHistory({ modifiable: 'vectorTextUpdated' });
}

/**
 * Saves an immutable history snapshot of the current selection state. No modifiable flag means it always
 * creates a new slice in time. This is useful for editor states that must remain distinct.
 *
 * Note: This type of history saving is common throughout the app - it is just less common in this vector
 * selection file so I'm giving it its own function.
 */
function saveDistinctHistory() {
    state.pushHistory();
}