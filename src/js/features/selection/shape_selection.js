import * as state from "../../state/index.js";
import CellArea from "../../geometry/cell_area.js";
import BaseRect from "../../geometry/shapes/rect/base.js";

export default class ShapeSelection {
    constructor() {
        this._shapeIdsSet = new Set();
    }

    get shapeIds() {
        return Array.from(this._shapeIdsSet);
    }
    set shapeIds(newShapeIds) {
        this._shapeIdsSet = new Set(newShapeIds);
    }

    get length() {
        return this._shapeIdsSet.size;
    }

    has(shapeId) {
        return this._shapeIdsSet.has(shapeId);
    }
    add(shapeId) {
        this._shapeIdsSet.add(shapeId);
    }
    clear() {
        this._shapeIdsSet.clear();
    }
    delete(shapeId) {
        this._shapeIdsSet.delete(shapeId);
    }

    get shapes() {
        return this.shapeIds.map(shapeId => state.getCurrentCelShape(shapeId))
    }

    get boundingArea() {
        if (this.length === 1) return this.shapes[0].boundingArea;
        return CellArea.mergeCellAreas(this.shapes.map(shape => shape.boundingArea))
    }

    update(updater) {
        this.shapeIds.forEach(shapeId => state.updateCurrentCelShape(shapeId, updater))
    }

    toggleShape(shapeId) {
        if (this.has(shapeId)) {
            // Flag shape for deselection, but do not deselect yet because we may be dragging
            this.markPendingDeselection(shapeId);
        } else {
            this.add(shapeId);
        }
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
        if (this.length === 0) return;

        if (this.length > 1) {
            if (this._boundingRect) throw new Error(`beginResize has already been called`);
            const area = this.boundingArea;
            this._boundingRect = new BaseRect(undefined, 'rect', {
                topLeft: area.topLeft,
                numRows: area.numRows,
                numCols: area.numCols
            })
            this._boundingRect.beginResize();
        }

        this.update(shape => shape.beginResize());
    }
    resize(handleType, roundedCell) {
        if (this.length === 0) return;

        if (this.length === 1) {
            this.update(shape => shape.resize(handleType, roundedCell));
        } else {
            this._boundingRect.resize(handleType, roundedCell);
            const oldBox = this._boundingRect.resizeSnapshot;
            const newBox = this._boundingRect.props;
            this.update(shape => shape.resizeInGroup(oldBox, newBox));
        }
    }
    finishResize() {
        this._boundingRect = undefined;
        this.update(shape => shape.finishResize());
    }

    // ----------------------------------------- Pending selections
    // Some selections/deselections are queued up but not actually performed until a later time.
    // E.g. on mousedown, a shape selection might get queued. If the user then does a mouseup without dragging
    // at all, the selection is committed. If the user does any drag, the selection is canceled.
    markPendingDeselection(shapeId) {
        this._pendingDeselection = shapeId;
    }
    markPendingSelection(shapeId) {
        this._pendingSelection = shapeId;
    }
    commitPending() {
        if (this._pendingDeselection) this.delete(this._pendingDeselection);
        if (this._pendingSelection) this.shapeIds = [this._pendingSelection];
        this.cancelPending()
    }
    cancelPending() {
        this._pendingDeselection = null;
        this._pendingSelection = null;
    }

}
