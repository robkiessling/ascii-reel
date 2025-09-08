import {
    canReorderCurrentCelShapes,
    deleteCurrentCelShape,
    getCurrentCelShape,
    reorderCurrentCelShapes,
    updateCurrentCelShape
} from "../index.js";
import {SHARED_SHAPE_PROPS} from "../../geometry/shapes/constants.js";
import {transformValues} from "../../utils/objects.js";

const DEFAULT_STATE = {
    shapeIds: new Set(),
    cursorShapeId: null,
    cursorIndex: null,
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
    if (state.cursorShapeId === shapeId) state.cursorShapeId = null;
}
export function deselectAllShapes() {
    shapeIdsSet().clear();
    state.cursorShapeId = null;
}

export function setShapeCursor(shapeId, cursorIndex = 0) {
    state.cursorShapeId = shapeId;
    state.cursorIndex = cursorIndex;
}
export function getShapeCursor() {
    if (state.cursorShapeId === null) return {};

    return {
        shape: getCurrentCelShape(state.cursorShapeId),
        cursorIndex: state.cursorIndex,
    }
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