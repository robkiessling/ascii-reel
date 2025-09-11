import * as vector from './vector_selection.js'
import * as raster from './raster_selection.js'

export * as raster from './raster_selection.js';
export * as vector from './vector_selection.js';

export function init() {
    raster.init();
    vector.init();
}

export function clear(refresh = true) {
    raster.clear(refresh);
    vector.deselectAllShapes(refresh)
}