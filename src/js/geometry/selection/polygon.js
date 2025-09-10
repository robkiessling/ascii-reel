import Cell from "../cell.js";
import equal from "fast-deep-equal";

/**
 * SelectionPolygon is the base class for many types of selection shapes. All polygons have a start value (where the
 * user first clicked) and an end value (where the user's mouse position currently is or was at time of mouseup).
 *
 * Subclasses must implement 'iterateCells', 'draw', and static 'type' field
 */
export default class SelectionPolygon {
    constructor(startCell, endCell = undefined, options = {}) {
        this.start = startCell;
        this.end = endCell === undefined ? startCell.clone() : endCell;
        this.options = options;
        this.completed = false;
    }

    get type() {
        return this.constructor.type;
    }

    equals(otherPolygon) {
        return equal(this.serialize(), otherPolygon.serialize());
    }

    serialize() {
        return { type: this.type, start: this.start.serialize(), end: this.end.serialize() };
    }

    static deserialize(data) {
        const shape = new this(Cell.deserialize(data.start), Cell.deserialize(data.end));
        shape.completed = true;
        return shape;
    }

    set start(cell) {
        this._start = cell;
    }
    get start() {
        return this._start;
    }
    set end(cell) {
        this._end = cell;
    }
    get end() {
        return this._end;
    }

    get topLeft() {
        return new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }
    get topRight() {
        return new Cell(Math.min(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
    }
    get bottomLeft() {
        return new Cell(Math.max(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }
    get bottomRight() {
        return new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
    }

    complete() {
        this.completed = true;
    }

    translate(rowDelta, colDelta, moveStart = true, moveEnd = true) {
        if (moveStart) {
            this.start.row += rowDelta;
            this.start.col += colDelta;
        }
        if (moveEnd) {
            this.end.row += rowDelta;
            this.end.col += colDelta;
        }
    }

    flipVertically(flipRow) {
        this.start.row = flipRow(this.start.row);
        this.end.row = flipRow(this.end.row);
    }

    flipHorizontally(flipCol) {
        this.start.col = flipCol(this.start.col);
        this.end.col = flipCol(this.end.col);
    }

    // Return true if the polygon has visible area. By default, even the smallest polygon occupies a 1x1 cell and is
    // visible. Some subclasses override this.
    hasArea() {
        return true;
    }
}
