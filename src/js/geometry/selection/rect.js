import Cell from "../cell.js";
import * as state from "../../state/index.js";
import CellArea from "../cell_area.js";
import SelectionPolygon from "./polygon.js";
import {SELECTION_SHAPE_TYPES} from "./constants.js";

/**
 * A selection of cells in a rectangular shape. Supports the following options:
 * - outline: (boolean) If true, only the cells along the border of the rectangle are included
 */
export default class SelectionRect extends SelectionPolygon {
    static type = SELECTION_SHAPE_TYPES.RECT;

    static drawableArea() {
        return new SelectionRect(new Cell(0, 0), new Cell(state.numRows() - 1, state.numCols() - 1));
    }

    iterateCells(callback) {
        if (this.options.outline) {
            const minRow = this.topLeft.row;
            const minCol = this.topLeft.col;
            const maxRow = this.bottomRight.row;
            const maxCol = this.bottomRight.col;

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    // Only call callback if on outer row/col of rectangle
                    if (r === minRow || c === minCol || r === maxRow || c === maxCol) {
                        callback(r, c);
                    }
                }
            }
        }
        else {
            this._toCellArea().iterate(callback);
        }
    }

    draw(context) {
        if (this.options.outline) {
            context.fillRect(...new CellArea(this.topLeft, this.topRight).bindToDrawableArea().xywh);
            context.fillRect(...new CellArea(this.topLeft, this.bottomLeft).bindToDrawableArea().xywh);
            context.fillRect(...new CellArea(this.topRight, this.bottomRight).bindToDrawableArea().xywh);
            context.fillRect(...new CellArea(this.bottomLeft, this.bottomRight).bindToDrawableArea().xywh);
        }
        else {
            context.fillRect(...this._toCellArea().bindToDrawableArea().xywh);
        }
    }

    // Note: SelectionRect is the only Polygon that needs to implement `stroke`, because we only use stroke() for
    // outlinePolygon() and the outline is always a rectangle.
    stroke(context) {
        context.beginPath();
        context.rect(...this._toCellArea().xywh);
        context.stroke();
    }

    _toCellArea() {
        return new CellArea(this.topLeft, this.bottomRight);
    }
}