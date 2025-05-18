import DrawingFreeform from "./base.js";
import Cell from "../../cell.js";
import {EMPTY_CHAR} from "../../../config/chars.js";
import CellArea from "../../cell_area.js";

export default class MonocharFreeform extends DrawingFreeform {
    constructor(...args) {
        super(...args);

        this.prevCell = null;
        this._initGlyphsToBoundingArea();
    }

    // Because the freeform line can have a wide area, it is easiest if we just let the bounding area equal the entire
    // canvas and deal with absolute coordinates. This is less efficient but simpler to code.
    get boundingArea() {
        if (this._cachedBoundingArea === undefined) {
            const [numRows, numCols] = this.options.canvasDimensions;
            const topLeft = new Cell(0, 0);
            const bottomRight = new Cell(numRows - 1, numCols - 1);
            this._cachedBoundingArea = new CellArea(topLeft, bottomRight);
        }

        return this._cachedBoundingArea;
    }

    recalculate(modifiers, mouseEvent) {
        // If we haven't moved to a new cell, return
        if (this.prevCell && this.prevCell.equals(this.end)) return;

        // Check if interpolation is needed
        if (this.prevCell && !this.prevCell.equals(this.end)) {
            this.prevCell.lineTo(this.end, false).forEach(cell => this._brushCell(cell))
        }

        this._brushCell(this.end)

        this.prevCell = this.end;
    }

    _brushCell(primaryCell) {
        this.options.hoveredCells(primaryCell).forEach(cell => {
            if (!cell.isInBounds()) return;

            switch(this.options.drawType) {
                case 'irregular-monochar':
                    this._setGlyphToMonochar(cell);
                    break;
                case 'eraser':
                    this._setGlyph(cell, EMPTY_CHAR, undefined);
                    break;
                case 'paint-brush':
                    this._setGlyph(cell, undefined, this.options.colorIndex);
                    break;
                default:
                    console.warn(`Unknown MonocharFreeform drawType: ${this.options.drawType}`)
            }
        })
    }
}