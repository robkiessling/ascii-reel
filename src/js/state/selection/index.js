
import * as vectorSelection from './vector_selection.js'
// import * as rasterSelection from './raster_selection.js'

export function deserialize(data = {}, options = {}) {
    vectorSelection.deserialize(data.vectorSelection, options);
    // rasterSelection.deserialize(data.rasterSelection, options);
}

export function serialize(options = {}) {
    return {
        vectorSelection: vectorSelection.serialize(options),
        // rasterSelection: rasterSelection.serialize(options),
    }
}

export {
    selectedShapeIds, setSelectedShapeIds, numSelectedShapes, hasSelectedShapes, isShapeSelected,
    selectShape, deselectShape, deselectAllShapes,
    selectedShapes, selectedShapeTypes, selectedShapeProps,
    updateSelectedShapes, deleteSelectedShapes, reorderSelectedShapes, canReorderSelectedShapes
} from './vector_selection.js'