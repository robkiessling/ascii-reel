import {fontHeight, fontWidth} from "../config/font.js";
import Point from "./point.js";
import Cell from "./cell.js";

export default class Vertex extends Point {
    constructor(row, col) {
        super();
        this.row = row;
        this.col = col;
    }

    // Since x and y are based purely on col/row value, we have these static methods so you can calculate x/y without
    // having to instantiate a new Vertex() -- helps with performance
    static x(col) {
        return col * fontWidth;
    }
    static y(row) {
        return row * fontHeight;
    }

    // Convert to/from its object representation (so we can store it in json state)
    static deserialize(data) {
        if (!data || data.row === undefined || data.col === undefined) return null;
        return new Vertex(data.row, data.col);
    }
    serialize() {
        return { row: this.row, col: this.col };
    }

    get x() {
        return this.col * fontWidth;
    }
    get y() {
        return this.row * fontHeight;
    }

    get topLeftCell() {
        return new Cell(this.row - 1, this.col - 1);
    }
    get topRightCell() {
        return new Cell(this.row - 1, this.col);
    }
    get bottomLeftCell() {
        return new Cell(this.row, this.col - 1);
    }
    get bottomRightCell() {
        return new Cell(this.row, this.col);
    }
    toCell(flipRow = false, flipCol = false) {
        return new Cell(flipRow ? this.row - 1 : this.row, flipCol ? this.col - 1 : this.col);
    }

    clone() {
        return new Vertex(this.row, this.col);
    }

    equals(vertex) {
        return this.row === vertex.row && this.col === vertex.col;
    }

    translate(rowDelta, colDelta) {
        this.row += rowDelta;
        this.col += colDelta;
        return this;
    }

    // Returns a new Vertex that represents the relative distance of this vertex from another vertex
    relativeTo(vertex) {
        return new Vertex(this.row - vertex.row, this.col - vertex.col)
    }

    toString() {
        return `V{r:${this.row},c:${this.col}}`
    }
}