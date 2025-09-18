import * as vector from './vector_controller.js'
import * as raster from './raster_controller.js'
import * as actions from "../../io/actions.js";
import * as state from "../../state/index.js";
import {LAYER_TYPES} from "../../state/constants.js";

export * as raster from './raster_controller.js';
export * as vector from './vector_controller.js';

export function init() {
    raster.init();
    vector.init();

    actions.registerAction('selection.select-all', () => selectAll());
}

export function isRaster() {
    return state.currentLayerType() === LAYER_TYPES.RASTER;
}
export function isVector() {
    return state.currentLayerType() === LAYER_TYPES.VECTOR;
}

export function clear(saveHistory = true) {
    raster.clear(saveHistory);
    vector.deselectAllShapes(saveHistory)
}

export function selectAll() {
    switch (state.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            raster.selectAll();
            break;
        case LAYER_TYPES.VECTOR:
            vector.selectAll();
            break;
    }
}