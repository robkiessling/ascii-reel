import PixelRect from "./pixel_rect.js";
import {fontHeight, fontWidth} from "../config/font.js";
import bresenham from "bresenham";

/**
 * A Cell is a particular row/column pair of the drawable area. It is useful so we can deal with rows/columns instead
 * of raw x/y values.
 */
export default class Cell extends PixelRect {
    constructor(row, col) {
        super();
        this.row = row;
        this.col = col;
    }

    // Since x and y are based purely on col/row value, we have these static methods so you can calculate x/y without
    // having to instantiate a new Cell() -- helps with performance
    static x(col) {
        return col * fontWidth;
    }
    static y(row) {
        return row * fontHeight;
    }
    static get width() {
        return fontWidth;
    }
    static get height() {
        return fontHeight;
    }

    static fromXYWH(x, y) {
        return new Cell(Math.floor(y / fontHeight), Math.floor(x / fontWidth));
    }

    // Convert to/from its object representation (so we can store it in json state)
    static deserialize(data) {
        if (!data || data.row === undefined || data.col === undefined) return null;
        return new Cell(data.row, data.col);
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
    get width() {
        return fontWidth;
    }
    get height() {
        return fontHeight;
    }

    clone() {
        return new Cell(this.row, this.col);
    }

    equals(cell) {
        return this.row === cell.row && this.col === cell.col;
    }

    translate(rowDelta, colDelta) {
        this.row += rowDelta;
        this.col += colDelta;
        return this;
    }

    translateTo(cell) {
        this.row = cell.row;
        this.col = cell.col;
        return this;
    }

    add(cell) {
        return this.translate(cell.row, cell.col);
    }

    invert() {
        this.row = -this.row;
        this.col = -this.col;
        return this;
    }

    // Note: Diagonal is considered adjacent
    isAdjacentTo(cell) {
        return (cell.row !== this.row || cell.col !== this.col) && // Has to be a different cell
            cell.row <= (this.row + 1) && cell.row >= (this.row - 1) &&
            cell.col <= (this.col + 1) && cell.col >= (this.col - 1);
    }

    // Returns an array of Cells from this Cell's position to a target Cell's position
    // Using Bresenham line approximation https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
    lineTo(cell, inclusive = true) {
        const cells = bresenham(this.col, this.row, cell.col, cell.row).map(coord => {
            return new Cell(coord.y, coord.x);
        });

        if (inclusive) {
            return cells;
        }
        else {
            // Remove endpoints. Note: If line is only 1 or 2 Cells long, an empty array will be returned
            cells.shift();
            cells.pop();
            return cells;
        }
    }

    // Returns a new Cell that represents the relative distance of this cell from another cell
    relativeTo(cell) {
        return new Cell(this.row - cell.row, this.col - cell.col)
    }

    // Returns a new Cell that represents this relative cell's absolute coords. To do so, have to supply what this cell
    // is relative to.
    makeAbsolute(relativeOrigin) {
        return new Cell(this.row + relativeOrigin.row, this.col + relativeOrigin.col);
    }

    // Make absolute compared to old origin, then make relative to new origin
    changeRelativeOrigin(oldOrigin, newOrigin) {
        return new Cell(
            this.row + oldOrigin.row - newOrigin.row,
            this.col + oldOrigin.col - newOrigin.col
        )
    }

    toString() {
        return `C{r:${this.row},c:${this.col}}`
    }
}