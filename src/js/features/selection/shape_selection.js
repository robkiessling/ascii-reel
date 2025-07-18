import * as state from "../../state/index.js";
import CellArea from "../../geometry/cell_area.js";

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
