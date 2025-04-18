import DrawingLine from "./base.js";
import Cell from "../../cell.js";
import {create2dArray} from "../../../utils/arrays.js";


export default class MonocharLine extends DrawingLine {
    recalculate(shiftKey) {
        const numRows = Math.abs(this.start.row - this.end.row) + 1
        const numCols = Math.abs(this.start.col - this.end.col) + 1
        this._origin = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols)
        }
        this.start.lineTo(this.end).forEach(cell => {
            const relativeRow = cell.row - this._origin.row;
            const relativeCol = cell.col - this._origin.col;
            this._glyphs.chars[relativeRow][relativeCol] = this.options.char;
            this._glyphs.colors[relativeRow][relativeCol] = this.options.colorIndex;
        })

    }
}