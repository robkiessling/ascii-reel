import PixelRect from "./pixel_rect.js";
import {fontHeight, fontWidth} from "../config/font.js";
import Cell from "./cell.js";
import * as state from "../state/index.js";

/**
 * A CellArea is a rectangle of Cells between a topLeft Cell and a bottomRight Cell.
 */
export default class CellArea extends PixelRect {
    constructor(topLeft, bottomRight) {
        super();
        this.topLeft = topLeft; // Cell
        this.bottomRight = bottomRight; // Cell
    }

    static drawableArea() {
        return new CellArea(new Cell(0, 0), new Cell(state.numRows() - 1, state.numCols() - 1));
    }

    static fromOriginAndDimensions(topLeft, numRows, numCols) {
        const bottomRight = new Cell(topLeft.row + numRows - 1, topLeft.col + numCols - 1);
        return new CellArea(topLeft.clone(), bottomRight);
    }

    static mergeCellAreas(cellAreas) {
        const top = Math.min(...cellAreas.map(cellArea => cellArea.topLeft.row));
        const left = Math.min(...cellAreas.map(cellArea => cellArea.topLeft.col));
        const bottom = Math.max(...cellAreas.map(cellArea => cellArea.bottomRight.row));
        const right = Math.max(...cellAreas.map(cellArea => cellArea.bottomRight.col));
        return new CellArea(new Cell(top, left), new Cell(bottom, right));
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

    get topRight() {
        return this.topLeft.clone().translate(0, this.numCols - 1);
    }
    get bottomLeft() {
        return this.topLeft.clone().translate(this.numRows - 1, 0);
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

    // Iterates through each cell, using the absolute row/col value of the cell
    iterate(callback) {
        for (let r = this.topLeft.row; r <= this.bottomRight.row; r++) {
            for (let c = this.topLeft.col; c <= this.bottomRight.col; c++) {
                callback(r, c);
            }
        }
    }

    // Iterates through each cell, using the row/col of the cell relative to the CellArea origin (e.g. topLeft cell will be 0,0)
    iterateRelative(callback) {
        for (let r = 0; r < this.numRows; r++) {
            for (let c = 0; c < this.numCols; c++) {
                callback(r, c);
            }
        }
    }

    doesCellOverlap(cell) {
        return cell.row >= this.topLeft.row && cell.row <= this.bottomRight.row &&
            cell.col >= this.topLeft.col && cell.col <= this.bottomRight.col;
    }

    innerArea() {
        if (this.numRows < 3 || this.numCols < 3) return null;
        return new CellArea(
            this.topLeft.clone().translate(1, 1),
            this.bottomRight.clone().translate(-1, -1),
        )
    }

    contains(cellArea) {
        return this.topLeft.row <= cellArea.topLeft.row &&
            this.topLeft.col <= cellArea.topLeft.col &&
            this.bottomRight.row >= cellArea.bottomRight.row &&
            this.bottomRight.col >= cellArea.bottomRight.col;
    }

}