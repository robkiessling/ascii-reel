import Rect from "./rect.js";
import {fontHeight, fontWidth} from "../canvas/font.js";
import Cell from "./cell.js";
import * as state from "../state/index.js";

/**
 * A CellArea is a rectangle of Cells between a topLeft Cell and a bottomRight Cell.
 */
export default class CellArea extends Rect {
    constructor(topLeft, bottomRight) {
        super();
        this.topLeft = topLeft; // Cell
        this.bottomRight = bottomRight; // Cell
    }

    static drawableArea() {
        return new CellArea(new Cell(0, 0), new Cell(state.numRows() - 1, state.numCols() - 1));
    }

    get x() {
        return this.topLeft.x;
    }
    get y() {
        return this.topLeft.y;
    }
    get width() {
        return this.numCols * fontWidth;
    }
    get height() {
        return this.numRows * fontHeight;
    }

    get numRows() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }

    get numCols() {
        return this.bottomRight.col - this.topLeft.col + 1;
    }

    clone() {
        return new CellArea(this.topLeft.clone(), this.bottomRight.clone());
    }

    // todo use static.drawableArea method somehow
    bindToDrawableArea() {
        if (this.topLeft.row < 0) { this.topLeft.row = 0; }
        if (this.topLeft.col < 0) { this.topLeft.col = 0; }
        if (this.topLeft.row > state.numRows() - 1) { this.topLeft.row = state.numRows(); } // Allow 1 space negative
        if (this.topLeft.col > state.numCols() - 1) { this.topLeft.col = state.numCols(); } // Allow 1 space negative

        if (this.bottomRight.row < 0) { this.bottomRight.row = -1; } // Allow 1 space negative
        if (this.bottomRight.col < 0) { this.bottomRight.col = -1; } // Allow 1 space negative
        if (this.bottomRight.row > state.numRows() - 1) { this.bottomRight.row = state.numRows() - 1; }
        if (this.bottomRight.col > state.numCols() - 1) { this.bottomRight.col = state.numCols() - 1; }

        return this;
    }

    iterate(callback) {
        for (let r = this.topLeft.row; r <= this.bottomRight.row; r++) {
            for (let c = this.topLeft.col; c <= this.bottomRight.col; c++) {
                callback(r, c);
            }
        }
    }
}