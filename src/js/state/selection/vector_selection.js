import {
    canReorderCurrentCelShapes,
    deleteCurrentCelShape,
    getCurrentCelShape,
    reorderCurrentCelShapes,
    updateCurrentCelShape
} from "../index.js";

const DEFAULT_STATE = {
    shapeIds: new Set()
}

let state = {};

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        state = {
            ...data,
            shapeIds: new Set(data.shapeIds)
        }
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, { ...data, shapeIds: new Set(data.shapeIds) });
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
export function deselectShape(shapeId) {
    shapeIdsSet().delete(shapeId);
}
export function deselectAllShapes() {
    shapeIdsSet().clear();
}

export function selectedShapes() {
    return selectedShapeIds().map(shapeId => getCurrentCelShape(shapeId));
}

export function updateSelectedShapes(updater) {
    selectedShapeIds().forEach(shapeId => updateCurrentCelShape(shapeId, updater));
}
export function deleteSelectedShapes() {
    selectedShapeIds().forEach(shapeId => deleteCurrentCelShape(shapeId));
    deselectAllShapes();
}
export function reorderSelectedShapes(action) {
    reorderCurrentCelShapes(selectedShapeIds(), action)
}
export function canReorderSelectedShapes(action) {
    if (!hasSelectedShapes()) return false;
    return canReorderCurrentCelShapes(selectedShapeIds(), action)
}