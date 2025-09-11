import * as vector from './vector_controller.js'
import * as raster from './raster_controller.js'

export * as raster from './raster_controller.js';
export * as vector from './vector_controller.js';

export function init() {
    raster.init();
    vector.init();
}

export function clear(refresh = true) {
    raster.clear(refresh);
    vector.deselectAllShapes(refresh)
}