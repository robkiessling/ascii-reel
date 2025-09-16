import {
    canReorderCurrentCelShapes,
    deleteCurrentCelShape,
    getCurrentCelShape, getCurrentCelShapes,
    reorderCurrentCelShapes,
    updateCurrentCelShape
} from "../index.js";
import {SHARED_SHAPE_PROPS} from "../../geometry/shapes/constants.js";
import {transformValues} from "../../utils/objects.js";
import {areArraysEqual} from "../../utils/arrays.js";

const DEFAULT_STATE = {
    shapeIds: new Set(),

    isEditingText: false,
    textSelectionStart: null,
    textSelectionEnd: null,
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

    state.shapeIds = new Set(shapeIds);
    stopEditingText();
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
    shapeIdsSet().add(shapeId);
    stopEditingText();
}

// Returns false if user is already selecting-all
export function canSelectAllShapes() {
    return getCurrentCelShapes().some(shape => !isShapeSelected(shape));
}
export function selectAllShapes() {
    getCurrentCelShapes().forEach(shape => selectShape(shape.id));
    stopEditingText();
}

export function deselectShape(shapeId) {
    shapeIdsSet().delete(shapeId);
    stopEditingText();
}
export function deselectAllShapes() {
    shapeIdsSet().clear();
    stopEditingText();
}

export function selectedShapes() {
    return selectedShapeIds().map(shapeId => getCurrentCelShape(shapeId));
}
export function selectedShapeTypes() {
    return [...new Set(selectedShapes().map(shape => shape.type))];
}
export function selectedShapeProps() {
    const result = {};
    const shapes = selectedShapes();

    SHARED_SHAPE_PROPS.forEach(prop => {
        if (!result[prop]) result[prop] = new Set();
        shapes.forEach(shape => {
            const value = shape.props[prop];
            if (value !== undefined) result[prop].add(value)
        })
    })

    return transformValues(result, (k, v) => [...v]);
}

export function updateSelectedShapes(updater) {
    let updated = false;

    selectedShapeIds().forEach(shapeId => {
        if (updateCurrentCelShape(shapeId, updater)) updated = true;
    });

    return updated;
}

export function deleteSelectedShapes() {
    selectedShapeIds().forEach(shapeId => deleteCurrentCelShape(shapeId));
    deselectAllShapes();
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
export function canEditText() {
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
    if (state.isEditingText && !canEditText()) throw new Error(`Invalid text-editing state`)
    return state.isEditingText;
}

/**
 * Checks whether a "select all" operation would change the current text selection.
 * @returns {boolean} True if the current shape's text is editable and not already fully selected, false otherwise
 */
export function canSelectAllText() {
    if (!canEditText()) return false;

    const shape = singleSelectedShape();
    return state.textSelectionStart !== shape.textLayout.minCaretIndex ||
        state.textSelectionEnd !== shape.textLayout.maxCaretIndex
}

/**
 * Enables text-editing mode for the currently selected shape (if not already active) and selects all available text.
 */
export function selectAllText() {
    if (!canSelectAllText()) return;
    const shape = singleSelectedShape();
    const textLayout = getCurrentCelShape(shape.id).textLayout
    setSelectedTextRange(textLayout.minCaretIndex, textLayout.maxCaretIndex);
}

/**
 * Enables text-editing mode for the currently selected shape (if not already active) and selects a range of text
 * between the given indices.
 *
 * @param {number} selectionStart - The character index to start the selection range (inclusive).
 * @param {number} selectionEnd - The character index to end the selection range (exclusive).
 * @throws {Error} If zero or multiple shapes are selected.
 */
export function setSelectedTextRange(selectionStart, selectionEnd) {
    if (numSelectedShapes() !== 1) throw new Error('Must call setSelectedTextRange with 1 shape already selected');
    state.isEditingText = true;
    state.textSelectionStart = selectionStart;
    state.textSelectionEnd = selectionEnd;
}

/**
 * Enables text-editing mode for the currently selected shape (if not already active) and places the caret at
 * the given index.
 *
 * @param {number} caretIndex - The character index to place the caret.
 * @throws {Error} If zero or multiple shapes are selected.
 */
export function setTextCaret(caretIndex) {
    if (numSelectedShapes() !== 1) throw new Error('Must call setTextCaret with 1 shape already selected');

    state.isEditingText = true;
    state.textSelectionStart = caretIndex;
    state.textSelectionEnd = caretIndex;
}

/**
 * Stops text-editing mode.
 */
export function stopEditingText() {
    state.isEditingText = false;
}

/**
 * Retrieves details about the current text selection within the active shape.
 *
 * @throws {Error} If not currently editing text in exactly one shape.
 * @returns {{
 *   shapeId: number,        // ID of the shape whose text is being edited
 *   textLayout: TextLayout, // Layout information for the shape's text
 *   hasRange: boolean,      // True if a non-empty selection range exists (start !== end)
 *   startIndex: number,     // Caret/selection start index
 *   endIndex: number        // Caret/selection end index
 * }}
 */
export function getTextSelection() {
    if (!isEditingText()) throw new Error('Text selection is only valid while editing text');

    const shape = singleSelectedShape();

    return {
        shapeId: shape.id,
        textLayout: shape.textLayout,
        hasRange: state.textSelectionStart !== state.textSelectionEnd,
        startIndex: state.textSelectionStart,
        endIndex: state.textSelectionEnd
    }
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