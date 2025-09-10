
import * as vectorSelection from './vector_selection.js'
import * as rasterSelection from './raster_selection.js'

export function deserialize(data = {}, options = {}) {
    rasterSelection.deserialize(data.rasterSelection, options);
    vectorSelection.deserialize(data.vectorSelection, options);
}

export function serialize(options = {}) {
    return {
        rasterSelection: rasterSelection.serialize(options),
        vectorSelection: vectorSelection.serialize(options),
    }
}

export {
    selectionShapes as rasterSelectionShapes,
    addSelectionShape as addRasterSelectionShape,
    hasSelection as hasRasterSelection,
    hasTarget as hasRasterTarget,
    empty as emptyRasterSelection,
    selectAll as selectAllRaster,
    getSelectedValues as getSelectedRasterValues,
    getSelectedCellArea as getSelectedRasterCellArea,
    getSelectedRect as getSelectedRasterRect,
    getSelectedCells as getSelectedRasterCells,
    getConnectedCells as getConnectedRasterCells,
    getMovableContent as getMovableRasterContent,
    startMovingContent as startMovingRasterContent,
    finishMovingContent as finishMovingRasterContent,
    updateMovableContent as updateMovableRasterContent,
    caretCell,
    moveCaretTo,
    moveDelta as moveRasterDelta,
    moveInDirection as moveRasterInDirection,
    extendInDirection as extendRasterInDirection,
    flipSelection as flipRasterSelection,
} from './raster_selection.js'

export {
    selectedShapeIds, setSelectedShapeIds, numSelectedShapes, hasSelectedShapes, isShapeSelected,
    selectShape, deselectShape,
    setShapeCursor, getShapeCursor,
    selectedShapes, selectedShapeTypes, selectedShapeProps,
    updateSelectedShapes, deleteSelectedShapes, reorderSelectedShapes, canReorderSelectedShapes
} from './vector_selection.js'

export function clearSelection() {
    rasterSelection.clear();
    vectorSelection.deselectAllShapes()
}