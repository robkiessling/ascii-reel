import {deleteCurrentCelShape, getCurrentCelShape, updateCurrentCelShape} from "../index.js";

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

export function selectedShapeIds() {
    return Array.from(state.shapeIds);
}
export function setSelectedShapeIds(shapeIds) {
    state.shapeIds = new Set(shapeIds);
}

export function numSelectedShapes() {
    return state.shapeIds.size;
}
export function hasSelectedShapes() {
    return numSelectedShapes() > 0;
}
export function isShapeSelected(shapeId) {
    return state.shapeIds.has(shapeId);
}
export function selectShape(shapeId) {
    state.shapeIds.add(shapeId);
}
export function deselectShape(shapeId) {
    state.shapeIds.delete(shapeId);
}
export function deselectAllShapes() {
    state.shapeIds.clear();
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