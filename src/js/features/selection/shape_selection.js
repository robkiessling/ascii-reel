import * as state from "../../state/index.js";
import CellArea from "../../geometry/cell_area.js";
import BaseRect from "../../geometry/shapes/rect/base.js";
import {arraysEqual} from "../../utils/arrays.js";

/**
 * Intermediate between vector selection feature and its state.
 *
 * Certain UI actions require extra handling before they affect the state. For example, mousing down on a shape
 * might queue it for selection, but it won't actually be selected until the mouseup occurs.
 *
 * This also handles resizing when multiple shapes are selected.
 */
export default class ShapeSelection {

    get boundingArea() {
        if (state.numSelectedShapes() === 1) return state.selectedShapes()[0].boundingArea;

        return CellArea.mergeCellAreas(state.selectedShapes().map(shape => shape.boundingArea))
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
            if (state.isShapeSelected(shapeId)) {
                // Flag shape for deselection, but do not deselect yet because we may be dragging
                this._markPendingDeselection(shapeId);
                return false;
            } else {
                state.selectShape(shapeId);
                return true;
            }
        } else if (state.numSelectedShapes() > 1 && state.isShapeSelected(shapeId)) {
            // If multiple shapes are already selected, mousedown (without shift) merely flags the shape for
            // selection; the shape will be selected on mouseup once it's confirmed we are not dragging
            this._markPendingSelection(shapeId);
            return false;
        } else {
            const newSelectedShapeIds = [shapeId];
            const hasStateChange = !arraysEqual(state.selectedShapeIds(), newSelectedShapeIds);
            state.setSelectedShapeIds(newSelectedShapeIds);
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
            state.deselectShape(this._pendingDeselection);
            hasStateChange = true;
        }
        if (this._pendingSelection) {
            state.setSelectedShapeIds([this._pendingSelection]);
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

        if (state.numSelectedShapes() === 0) return;

        if (state.numSelectedShapes() > 1) {
            if (this._groupBoundary) throw new Error(`beginResize has already been called`);
            const area = this.boundingArea;
            this._groupBoundary = new BaseRect(undefined, 'rect', {
                topLeft: area.topLeft,
                numRows: area.numRows,
                numCols: area.numCols
            })
            this._groupBoundary.beginResize();
        }

        state.updateSelectedShapes(shape => shape.beginResize());
    }
    resize(handleType, roundedCell) {
        this._resizeOccurred = true;

        if (state.numSelectedShapes() === 0) return;

        if (state.numSelectedShapes() === 1) {
            state.updateSelectedShapes(shape => shape.resize(handleType, roundedCell));
        } else {
            this._groupBoundary.resize(handleType, roundedCell);
            const oldBox = this._groupBoundary.resizeSnapshot;
            const newBox = this._groupBoundary.props;
            state.updateSelectedShapes(shape => shape.resizeInGroup(oldBox, newBox));
        }
    }

    /**
     * @returns {boolean} - True if a state change occurred.
     */
    finishResize() {
        this._groupBoundary = undefined;
        state.updateSelectedShapes(shape => shape.finishResize());

        return this._resizeOccurred;
    }


    // ----------------------------------------- Translation

    beginTranslate() {
        this._translateOccurred = false;
    }

    translate(rowDelta, colDelta) {
        this._translateOccurred = true;
        state.updateSelectedShapes(shape => shape.translate(rowDelta, colDelta));
    }

    /**
     * @returns {boolean} - True if a state change occurred.
     */
    finishTranslate() {
        return this._translateOccurred;
    }

}
