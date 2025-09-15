import {
    canReorderCurrentCelShapes,
    deleteCurrentCelShape,
    getCurrentCelShape, getCurrentCelShapes,
    reorderCurrentCelShapes,
    updateCurrentCelShape
} from "../index.js";
import {SHARED_SHAPE_PROPS} from "../../geometry/shapes/constants.js";
import {transformValues} from "../../utils/objects.js";

const DEFAULT_STATE = {
    shapeIds: new Set(),
    caretShapeId: null,
    caretIndex: null,
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
    if (state.caretShapeId && !shapeIds.includes(state.caretShapeId)) clearTextSelection();
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
    shapeIdsSet().add(shapeId);
}

// Returns false if user is already selecting-all
export function canSelectAllShapes() {
    return getCurrentCelShapes().some(shape => !isShapeSelected(shape));
}
export function selectAllShapes() {
    getCurrentCelShapes().forEach(shape => selectShape(shape.id));
}

export function deselectShape(shapeId) {
    shapeIdsSet().delete(shapeId);
    if (state.caretShapeId && state.caretShapeId === shapeId) clearTextSelection();
}
export function deselectAllShapes() {
    shapeIdsSet().clear();
    clearTextSelection();
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

export function setTextRange(shapeId, selectionStart, selectionEnd) {
    state.caretShapeId = shapeId;
    state.textSelectionStart = selectionStart;
    state.textSelectionEnd = selectionEnd;
}

export function canEditText() {
    if (numSelectedShapes() !== 1) return false;
    return selectedShapes()[0].canHaveText;
}

// Returns false if text is already all selected
export function canSelectAllText() {
    if (!canEditText()) return false;

    const shape = selectedShapes()[0];
    return state.caretShapeId !== shape.id ||
        state.textSelectionStart !== shape.textLayout.minCaretIndex ||
        state.textSelectionEnd !== shape.textLayout.maxCaretIndex
}
export function selectAllText() {
    if (numSelectedShapes() !== 1) throw new Error('Must call selectAllText with 1 shape already selected');
    const shape = selectedShapes()[0];
    if (!shape.canHaveText) throw new Error('Shape has no text property to select');
    const textLayout = getCurrentCelShape(shape.id).textLayout
    setTextRange(shape.id, textLayout.minCaretIndex, textLayout.maxCaretIndex);
}

export function setTextCaret(shapeId, caretIndex) {
    state.caretShapeId = shapeId;
    state.textSelectionStart = caretIndex;
    state.textSelectionEnd = caretIndex;
}

export function clearTextSelection() {
    state.caretShapeId = null;
}

export function getTextSelection() {
    if (state.caretShapeId === null) return null;

    return {
        shapeId: state.caretShapeId,
        textLayout: getCurrentCelShape(state.caretShapeId).textLayout,
        hasRange: state.textSelectionStart !== state.textSelectionEnd,
        startIndex: state.textSelectionStart,
        endIndex: state.textSelectionEnd
    }
}

