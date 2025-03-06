import Cell from "../cell.js";
import {create2dArray} from "../../utils/arrays.js";

export default class AsciiPolygon {
    constructor(startCell, drawType) {
        this.start = startCell;
        this.end = startCell.clone();
        this.drawType = drawType;
        this.refreshGlyphs();
    }

    get glyphs() {
        return this._glyphs;
    }
    get topLeft() {
        return new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }
    get bottomRight() {
        return new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
    }
    get numRows() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }
    get numCols() {
        return this.bottomRight.col - this.topLeft.col + 1;
    }

    refreshGlyphs() {
        this._glyphs = {
            chars: create2dArray(this.numRows, this.numCols),
            colors: create2dArray(this.numRows, this.numCols)
        }
    }
}