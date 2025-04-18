import DrawingFreeform from "./base.js";
import Cell from "../../cell.js";
import {create2dArray} from "../../../utils/arrays.js";
import {EMPTY_CHAR} from "../../../config/chars.js";


export default class UniformFreeform extends DrawingFreeform {
    constructor(...args) {
        super(...args);

        this.prevCell = null;
        this._origin = new Cell(0, 0); // using absolute positioning

        const [numCols, numRows] = this.options.canvasDimensions;
        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols),
        }
    }

    recalculate(mouseEvent) {
        if (this.prevCell && this.prevCell.equals(this.end)) return;

        if (this.prevCell && !this.prevCell.equals(this.end)) {
            this.prevCell.lineTo(this.end, false).forEach(cell => {
                this._brushCell(cell);
            })
        }

        this._brushCell(this.end)
    }

    _brushCell(primaryCell) {
        this.options.hoveredCells(primaryCell).forEach(cell => {
            switch(this.options.drawType) {
                case 'current-char':
                    this._glyphs.chars[cell.row][cell.col] = this.options.char;
                    this._glyphs.colors[cell.row][cell.col] = this.options.colorIndex;
                    break;
                case 'eraser':
                    this._glyphs.chars[cell.row][cell.col] = EMPTY_CHAR;
                    break;
                case 'paint-brush':
                    this._glyphs.colors[cell.row][cell.col] = this.options.colorIndex;
                    break;
                default:
                    console.warn(`Unknown UniformFreeform drawType: ${this.options.drawType}`)
            }
        })
    }
}