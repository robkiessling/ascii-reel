import PixelRect from "./pixel_rect.js";
import {fontHeight, fontWidth} from "../config/font.js";
import Cell from "./cell.js";
import * as state from "../state/index.js";
import Vertex from "./vertex.js";

/**
 * Represents a rectangular region of the grid using inclusive cell coordinates.
 *
 * A CellArea includes both its `topLeft` and `bottomRight` corners. That is,
 * if `topLeft.row === bottomRight.row`, the area still has a height (numRows) of 1.
 */
export default class CellArea extends PixelRect {

    /**
     * @param {Cell} topLeft - The area's top-left Cell (inclusive)
     * @param {Cell} bottomRight - The area's bottom-right Cell (inclusive)
     */
    constructor(topLeft, bottomRight) {
        super();
        this.topLeft = topLeft;
        this.bottomRight = bottomRight;
    }

    serialize() {
        return { topLeft: this.topLeft.serialize(), bottomRight: this.bottomRight.serialize() }
    }

    static deserialize(data) {
        return new CellArea(Cell.deserialize(data.topLeft), Cell.deserialize(data.bottomRight));
    }

    static drawableArea() {
        return new CellArea(new Cell(0, 0), new Cell(state.numRows() - 1, state.numCols() - 1));
    }

    static fromOriginAndDimensions(topLeft, numRows, numCols) {
        const bottomRight = topLeft.clone().translate(numRows - 1, numCols -1);
        return new CellArea(topLeft.clone(), bottomRight);
    }

    static fromCells(cells) {
        if (cells.length === 0) return null;

        let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;

        for (const cell of cells) {
            if (cell.row < top) top = cell.row;
            if (cell.col < left) left = cell.col;
            if (cell.row > bottom) bottom = cell.row;
            if (cell.col > right) right = cell.col;
        }

        return new CellArea(new Cell(top, left), new Cell(bottom, right));
    }

    static mergeCellAreas(cellAreas) {
        if (cellAreas.length === 0) return null;

        let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;

        for (const cellArea of cellAreas) {
            if (cellArea.topLeft.row < top) top = cellArea.topLeft.row;
            if (cellArea.topLeft.col < left) left = cellArea.topLeft.col;
            if (cellArea.bottomRight.row > bottom) bottom = cellArea.bottomRight.row;
            if (cellArea.bottomRight.col > right) right = cellArea.bottomRight.col;
        }

        return new CellArea(new Cell(top, left), new Cell(bottom, right));
    }

    static fromPoints(points) {
        return CellArea.fromCells(points.map(point => point.cell));
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

    get numCells() {
        return this.numRows * this.numCols;
    }

    get topRight() {
        return this.topLeft.clone().translate(0, this.numCols - 1);
    }
    get bottomLeft() {
        return this.topLeft.clone().translate(this.numRows - 1, 0);
    }

    get topLeftVertex() { return new Vertex(this.topLeft.row, this.topLeft.col); }
    get topRightVertex() { return new Vertex(this.topRight.row, this.topRight.col + 1); }
    get bottomLeftVertex() { return new Vertex(this.bottomLeft.row + 1, this.bottomLeft.col); }
    get bottomRightVertex() { return new Vertex(this.bottomRight.row + 1, this.bottomRight.col + 1); }

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

    // Iterates through each cell, using the row/col of the cell relative to the CellArea origin
    // E.g. the topLeft cell will be (0,0) regardless of where the cellArea is located on the grid
    iterateRelative(callback) {
        for (let r = 0; r < this.numRows; r++) {
            for (let c = 0; c < this.numCols; c++) {
                callback(r, c);
            }
        }
    }

    includesCell(cell) {
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

    /**
     * Returns whether the provided cellArea fits entirely within this cellArea.
     * Comparison is inclusive: edges must lie within or on the boundaries.
     *
     * @param {CellArea} cellArea - The area to check for containment.
     * @returns {boolean} - True if `cellArea` is fully inside this area.
     */
    contains(cellArea) {
        return this.topLeft.row <= cellArea.topLeft.row &&
            this.topLeft.col <= cellArea.topLeft.col &&
            this.bottomRight.row >= cellArea.bottomRight.row &&
            this.bottomRight.col >= cellArea.bottomRight.col;
    }

    /**
     * Returns true if this cellArea overlaps with the given cellArea.
     * Overlap is defined as any shared cells, including edge or corner contact.
     *
     * @param {CellArea} cellArea - The other area to test for overlap.
     * @returns {boolean} - True if the two areas share any overlapping space.
     */
    overlaps(cellArea) {
        return !(
            this.bottomRight.row < cellArea.topLeft.row ||
            this.topLeft.row > cellArea.bottomRight.row ||
            this.bottomRight.col < cellArea.topLeft.col ||
            this.topLeft.col > cellArea.bottomRight.col
        );
    }

    toString() {
        return `CA[${this.topLeft}-${this.bottomRight}]`
    }

}