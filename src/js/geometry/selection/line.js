import SelectionShape from "./shape.js";
import {SELECTION_SHAPE_TYPES} from "./constants.js";
import {isCellInBounds} from "../../state/index.js";

/**
 * A selection of cells between a start/end cell using Bresenham line approximation (see Cell.lineTo).
 */
export default class LineSelection extends SelectionShape {
    static type = SELECTION_SHAPE_TYPES.LINE;

    iterateCells(callback) {
        this.start.lineTo(this.end).forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this.start.lineTo(this.end).forEach(cell => {
            if (isCellInBounds(cell)) {
                context.fillRect(...cell.xywh);
            }
        });
    }
}