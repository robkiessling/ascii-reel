import * as selectionController from "./index.js";
import CellArea from "../../geometry/cell_area.js";
import {arraysEqual} from "../../utils/arrays.js";
import {resizeBoundingBox} from "../../geometry/shapes/algorithms/box_sizing.js";
import VertexArea from "../../geometry/vertex_area.js";
import {HANDLE_TYPES} from "../../geometry/shapes/constants.js";
import {HandleCollection} from "../../geometry/shapes/handle.js";
import BoxShape from "../../geometry/shapes/box_shape.js";

/**
 * Intermediate between vector selection feature and its state.
 *
 * Certain UI actions require extra handling before they affect the state. For example, mousing down on a shape
 * might queue it for selection, but it won't actually be selected until the mouseup occurs.
 *
 * This also handles resizing when multiple shapes are selected.
 */
export default class ShapeSelector {

    get boundingArea() {
        if (selectionController.vector.numSelectedShapes() === 1) return selectionController.vector.selectedShapes()[0].boundingArea;

        return CellArea.mergeCellAreas(selectionController.vector.selectedShapes().map(shape => shape.boundingArea))
    }

    /**
     *
     * @returns {HandleCollection}
     */
    get handles() {
        const boundingArea = this.boundingArea;

        return new HandleCollection([
            ...BoxShape.vertexHandles(null, boundingArea),
            ...BoxShape.edgeHandles(null, boundingArea),
            ...selectionController.vector.selectedShapes().map(shape => shape.handles.body.at(0))
        ])
    }

    // get handles() {
    //     const boundingArea = this.boundingArea;
    //
    //     return new HandleCollection([
    //         ...BoxShape.vertexHandles(null, boundingArea),
    //         ...BoxShape.edgeHandles(null, boundingArea),
    //     ])
    // }


    get boundingVertexArea() {
        const area = this.boundingArea;
        return VertexArea.fromOriginAndDimensions(area.topLeft, area.numRows, area.numCols) // todo vertex
    }

    /**
     * Handles mousedown event on a shape
     * @param shapeId - ID of the shape being clicked on
     * @param shiftKey - True if shift key was down
     * @returns {boolean} - True if a state change occurred
     */
    mousedownShape(shapeId, shiftKey) {
        this.beginTranslate();

        if (shiftKey) {
            if (selectionController.vector.isShapeSelected(shapeId)) {
                // Flag shape for deselection, but do not deselect yet because we may be dragging
                this._markPendingDeselection(shapeId);
                return false;
            } else {
                selectionController.vector.selectShape(shapeId);
                return true;
            }
        } else if (selectionController.vector.numSelectedShapes() > 1 && selectionController.vector.isShapeSelected(shapeId)) {
            // If multiple shapes are already selected, mousedown (without shift) merely flags the shape for
            // selection; the shape will be selected on mouseup once it's confirmed we are not dragging
            this._markPendingSelection(shapeId);
            return false;
        } else {
            const newSelectedShapeIds = [shapeId];
            const hasStateChange = !arraysEqual(selectionController.vector.selectedShapeIds(), newSelectedShapeIds);
            selectionController.vector.setSelectedShapeIds(newSelectedShapeIds);
            return hasStateChange;
        }
    }

    // ----------------------------------------- Pending selections
    // Some selections/deselections are queued up but not actually performed until a later time.
    // E.g. on mousedown, a shape selection might get queued. If the user then does a mouseup without dragging
    // at all, the selection is committed. If the user does any drag, the selection is canceled.

    _markPendingDeselection(shapeId) {
        this._pendingDeselection = shapeId;
    }
    _markPendingSelection(shapeId) {
        this._pendingSelection = shapeId;
    }

    /**
     * Commits any pending selections/deselections.
     * @returns {boolean} - True if a state change occurred.
     */
    commitPending() {
        let hasStateChange = false;

        if (this._pendingDeselection) {
            selectionController.vector.deselectShape(this._pendingDeselection);
            hasStateChange = true;
        }
        if (this._pendingSelection) {
            selectionController.vector.setSelectedShapeIds([this._pendingSelection]);
            hasStateChange = true;
        }

        this.cancelPending();

        return hasStateChange;
    }

    cancelPending() {
        this._pendingDeselection = null;
        this._pendingSelection = null;
    }

    // ----------------------------------------- Resizing
    // These resize functions have extra logic to handle resizing a group of shapes together.
    //
    // When the user begins resizing, we capture the initial bounding rectangle that encompasses all shapes in the
    // group. As the resize progresses, we compute a new bounding rectangle based on the updated mouse position. Both
    // the original and new bounding rectangles are passed to each shape's `resizeInGroup` function.
    //
    // Each shape uses these bounding rectangles to determine its original relative position and size within the group.
    // It then applies the same relative proportions to fit itself into the new bounding rectangle, preserving layout
    // relationships during the group resize.

    beginResize() {
        this._resizeOccurred = false;

        if (selectionController.vector.numSelectedShapes() === 0) return;

        if (this._oldBounds) throw new Error(`beginResize has already been called`);
        this._oldBounds = this.boundingVertexArea;
        selectionController.vector.updateSelectedShapes(shape => shape.beginResize());
    }
    resize(handle, cell, roundedCell) {
        this._resizeOccurred = true;

        if (selectionController.vector.numSelectedShapes() === 0) return;

        switch (handle.type) {
            case HANDLE_TYPES.VERTEX:
            case HANDLE_TYPES.EDGE:
                const newBounds = resizeBoundingBox(this._oldBounds, handle, roundedCell)
                selectionController.vector.updateSelectedShapes(shape => shape.resize(this._oldBounds, newBounds));
                break;
            case HANDLE_TYPES.CELL:
                selectionController.vector.updateSelectedShapes(shape => shape.dragCellHandle(handle, cell))
                break;
        }
    }

    /**
     * @returns {boolean} - True if a state change occurred.
     */
    finishResize() {
        this._oldBounds = undefined;
        selectionController.vector.updateSelectedShapes(shape => shape.finishResize());

        return this._resizeOccurred;
    }


    // ----------------------------------------- Translation

    beginTranslate() {
        this._translateOccurred = false;
    }

    translate(rowDelta, colDelta) {
        this._translateOccurred = true;
        selectionController.vector.updateSelectedShapes(shape => shape.translate(rowDelta, colDelta));
    }

    /**
     * @returns {boolean} - True if a state change occurred.
     */
    finishTranslate() {
        return this._translateOccurred;
    }

}
