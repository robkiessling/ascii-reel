import SelectionPolygon from "./polygon.js";
import {SELECTION_SHAPE_TYPES} from "./constants.js";

/**
 * A selection of cells between a start/end cell using Bresenham line approximation (see Cell.lineTo).
 */
export default class SelectionLine extends SelectionPolygon {
    static type = SELECTION_SHAPE_TYPES.LINE;

    iterateCells(callback) {
        this.start.lineTo(this.end).forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this.start.lineTo(this.end).forEach(cell => {
            if (cell.isInBounds()) {
                context.fillRect(...cell.xywh);
            }
        });
    }
}