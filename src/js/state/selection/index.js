import * as vector from './vector_selection.js'
import * as raster from './raster_selection.js'

export * as raster from './raster_selection.js';
export * as vector from './vector_selection.js';

export function deserialize(data = {}, options = {}) {
    raster.deserialize(data.rasterSelection, options);
    vector.deserialize(data.vectorSelection, options);
}

export function serialize(options = {}) {
    return {
        rasterSelection: raster.serialize(options),
        vectorSelection: vector.serialize(options),
    }
}

export function clearSelection() {
    raster.clear();
    vector.deselectAllShapes()
}