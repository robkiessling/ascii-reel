import SelectionPolygon from "./polygon.js";

/**
 * A selection of cells between a start/end cell using Bresenham line approximation (see Cell.lineTo).
 */
export default class SelectionLine extends SelectionPolygon {

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