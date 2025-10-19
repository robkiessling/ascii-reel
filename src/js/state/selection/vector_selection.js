import {
    canReorderCurrentCelShapes, currentCelShapeExists,
    deleteCurrentCelShape,
    getCurrentCelShape, getCurrentCelShapes,
    reorderCurrentCelShapes,
    updateCurrentCelShape
} from "../index.js";
import {TEXT_OVERFLOW_PROP} from "../../geometry/shapes/constants.js";
import {areArraysEqual} from "../../utils/arrays.js";

const DEFAULT_STATE = {
    shapeIds: new Set(),

    isEditingText: false,
    textSelectionAnchor: null, // Selected text's fixed index (starting point of text selection)
    textSelectionFocus: null, // Selected text's moving index (where mouse/caret currently is)
}

let state = {};

export function deserialize(data = {}, options = {}) {
    const newShapeIds = new Set(data.shapeIds || []); // Convert Array to Set

    if (options.replace) {
        state = {
            ...data,
            shapeIds: newShapeIds
        }
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, { ...data, shapeIds: newShapeIds });
}

export function serialize(options = {}) {
    return {
        ...state,
        shapeIds: Array.from(state.shapeIds)
    }
}

function shapeIdsSet() {
    return state.shapeIds ? state.shapeIds : new Set();
}

export function selectedShapeIds() {
    return Array.from(shapeIdsSet());
}

export function setSelectedShapeIds(shapeIds) {
    if (areArraysEqual(shapeIds, selectedShapeIds())) return;

    stopEditingText();
    state.shapeIds = new Set(shapeIds);
}

export function numSelectedShapes() {
    return shapeIdsSet().size;
}
export function hasSelectedShapes() {
    return numSelectedShapes() > 0;
}
export function isShapeSelected(shapeId) {
    return shapeIdsSet().has(shapeId);
}
export function selectShape(shapeId) {
    stopEditingText();
    shapeIdsSet().add(shapeId);
}

// Returns false if user is already selecting-all
export function canSelectAllShapes() {
    return getCurrentCelShapes().some(shape => !isShapeSelected(shape));
}
export function selectAllShapes() {
    stopEditingText();
    getCurrentCelShapes().forEach(shape => selectShape(shape.id));
}

export function deselectShape(shapeId) {
    stopEditingText();
    shapeIdsSet().delete(shapeId);
}
export function deselectAllShapes() {
    stopEditingText();
    shapeIdsSet().clear();
}

export function selectedShapes() {
    return selectedShapeIds().map(shapeId => getCurrentCelShape(shapeId));
}

export function updateSelectedShapes(updater) {
    let updated = false;

    selectedShapeIds().forEach(shapeId => {
        if (updateCurrentCelShape(shapeId, updater)) updated = true;
    });

    return updated;
}

// Deletes all selected shapes
export function deleteSelectedShapes() {
    selectedShapeIds().forEach(shapeId => deleteSelectedShape(shapeId));
}

// Special handler: When deleting a shape, if it is selected we have to first deselect it
export function deleteSelectedShape(shapeId) {
    deselectShape(shapeId);

    // Deselecting the shape may have already deleted it (e.g. if it's an empty text box)
    if (!currentCelShapeExists(shapeId)) return;

    deleteCurrentCelShape(shapeId);
}

export function canReorderSelectedShapes(action) {
    if (!hasSelectedShapes()) return false;
    return canReorderCurrentCelShapes(selectedShapeIds(), action)
}

export function reorderSelectedShapes(action) {
    reorderCurrentCelShapes(selectedShapeIds(), action)
}

/**
 * Determines whether the current shape selection allows text editing.
 * @returns {boolean} True if exactly one shape is selected and that shape supports text, false otherwise.
 */
export function hasTextProperty() {
    if (numSelectedShapes() !== 1) return false;
    return singleSelectedShape().canHaveText;
}

/**
 * Indicates whether the editor is currently in text-editing mode for a shape.
 * This is true if a text caret or selection range is active inside a shape.
 *
 * @returns {boolean} True if a shape's text is being edited, false otherwise.
 */
export function isEditingText() {
    if (state.isEditingText && !hasTextProperty()) throw new Error(`Invalid text-editing state`)
    return state.isEditingText;
}

export function canEnterEditMode() {
    return hasTextProperty() && !isEditingText() && !singleSelectedShape().textLayout.fullyClipped;
}

/**
 * Checks whether a "select all" operation would change the current text selection.
 * @returns {boolean} True if the current shape's text is editable and not already fully selected, false otherwise
 */
export function canSelectAllText() {
    if (!hasTextProperty()) return false;

    const shape = singleSelectedShape();

    return !isEditingText() ||
        textSelectionStart() !== shape.textLayout.minCaretIndex ||
        textSelectionEnd() !== shape.textLayout.maxCaretIndex;
}

/**
 * Enables text-editing mode for the currently selected shape (if not already active) and selects all available text.
 */
export function selectAllText() {
    if (!canSelectAllText()) return;
    const shape = singleSelectedShape();
    toggleTextOverflow(true) // Need to show all text before calculating min/max carets
    const textLayout = getCurrentCelShape(shape.id).textLayout
    setSelectedTextRange(textLayout.minCaretIndex, textLayout.maxCaretIndex);
}

/**
 * Activates text-editing mode for the currently selected shape (if not already active) and selects a range of text
 * between the given indices. Text selections are directional: the anchorIndex is the fixed point where the selection
 * began, while the focusIndex is the moving end (which may be to the left or right of the anchor).
 *
 * For example, if the user clicks on the right and drags left, the anchor will be on the right and the focus on the left.
 *
 * @param {number} anchorIndex - The fixed index where the selection began.
 * @param {number} focusIndex - The moving index where the selection ends.
 * @throws {Error} If zero or multiple shapes are selected.
 */
export function setSelectedTextRange(anchorIndex, focusIndex) {
    if (numSelectedShapes() !== 1) throw new Error('Must call setSelectedTextRange with 1 shape already selected');
    state.isEditingText = true;
    state.textSelectionAnchor = anchorIndex;
    state.textSelectionFocus = focusIndex;
    toggleTextOverflow(true)
}

/**
 * Activates text-editing mode for the currently selected shape (if not already active) and creates a collapsed
 * selection at the given index. A collapsed selection is just a single blinking caret; no highlighted range.
 *
 * @param {number} caretIndex - The character index to place the caret.
 * @throws {Error} If zero or multiple shapes are selected.
 */
export function setTextCaret(caretIndex) {
    if (numSelectedShapes() !== 1) throw new Error('Must call setTextCaret with 1 shape already selected');

    state.isEditingText = true;
    state.textSelectionAnchor = caretIndex;
    state.textSelectionFocus = caretIndex;
    toggleTextOverflow(true)
}

/**
 * Stops text-editing mode.
 */
export function stopEditingText() {
    state.isEditingText = false;
    toggleTextOverflow(false)

    selectedShapeIds().forEach(shapeId => {
        if (getCurrentCelShape(shapeId).deleteOnTextFinished()) {
            shapeIdsSet().delete(shapeId);
            deleteCurrentCelShape(shapeId);
        }
    });
}

/**
 * Retrieves details about the current text selection within the active shape.
 *
 * @throws {Error} If not currently editing text in exactly one shape.
 * @returns {{
 *   shapeId: number,        // ID of the shape whose text is being edited
 *   textLayout: TextLayout, // Layout information for the shape's text
 *   isCollapsed: boolean,   // True if the selection has no range; the caret is at a single position. Opposite of hasRange.
 *   hasRange: boolean,      // True if a selection covers at least one character (not just a caret). Opposite of isCollapsed.
 *   anchorIndex: number,    // Index where selection began; the fixed end. E.g. where the original mousedown was.
 *   focusIndex: number,     // Index where selection currently extends to; the moving end. E.g. where the mouse currently is.
 *   startIndex: number,     // Selection's logical start; the top-left-most index of the selection
 *   endIndex: number,       // Selection's logical end; the bottom-right-most index of the selection
 *   text: string            // Selected text string
 * }}
 */
export function getTextSelection() {
    if (!isEditingText()) throw new Error('Text selection is only valid while editing text');

    const shape = singleSelectedShape();
    const start = textSelectionStart();
    const end = textSelectionEnd();

    return {
        shapeId: shape.id,
        textLayout: shape.textLayout,
        isCollapsed: state.textSelectionAnchor === state.textSelectionFocus,
        hasRange: state.textSelectionAnchor !== state.textSelectionFocus,
        anchorIndex: state.textSelectionAnchor,
        focusIndex: state.textSelectionFocus,
        startIndex: start,
        endIndex: end,
        text: shape.textLayout.text.substring(start, end)
    }
}

/**
 * Returns the normalized start index of the current text selection. This is always the smaller of (anchor, focus), so
 * it works regardless of selection direction (left-to-right or right-to-left).
 *
 * @returns {number} - The top-left-most index of the selection.
 */
function textSelectionStart() {
    return Math.min(state.textSelectionAnchor, state.textSelectionFocus);
}

/**
 * Returns the normalized end index of the current text selection. This is always the larger of (anchor, focus), so
 * it works regardless of selection direction (left-to-right or right-to-left).
 *
 * @returns {number} - The bottom-right-most index of the selection.
 */
function textSelectionEnd() {
    return Math.max(state.textSelectionAnchor, state.textSelectionFocus);
}

/**
 * Returns the currently selected shape, if and only if exactly one shape is selected. Throws an error otherwise.
 *
 * @throws {Error} If zero or more than one shape is selected.
 * @returns {Shape} The single selected shape.
 */
export function singleSelectedShape() {
    if (numSelectedShapes() !== 1) throw new Error('Exactly 1 shape must be selected');
    return selectedShapes()[0];
}


/**
 * Shows/hides the text overflow of a shape. We typically only show overflow when editing; once editing is finished
 * we cut off all overflow.
 *
 * Because this actually affects which chars are visible on the canvas, we end up having to refresh the char canvas
 * during almost any selection change. TODO We can improve performance by just refreshing char canvas if overflow toggles.
 *
 * @param {boolean} show - Whether to show or hide text overflow for selected shapes.
 */
function toggleTextOverflow(show) {
    updateSelectedShapes(shape => shape.updateProp(TEXT_OVERFLOW_PROP, show))
}