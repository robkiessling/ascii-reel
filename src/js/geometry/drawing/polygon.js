import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {create2dArray} from "../../utils/arrays.js";
import {isFunction} from "../../utils/utilities.js";

/**
 * Base class for Ascii drawings. Subclasses will override recalculate() function.
 */
export default class DrawingPolygon {
    constructor(startCell, options = {}) {
        this.start = startCell;
        this.end = startCell.clone();
        this.options = options;
    }

    recalculate(/* modifiers, mouseEvent */) {
        console.warn("`recalculate` must be overridden by DrawingPolygon subclass")
    }

    get glyphs() {
        return this._glyphs;
    }
    set glyphs(newGlyphs) {
        this._glyphs = newGlyphs;
    }

    get origin() {
        return this.boundingArea.topLeft;
    }

    get start() {
        return this._start;
    }
    set start(newStart) {
        this._cachedBoundingArea = undefined;
        this._start = newStart;
    }
    get end() {
        return this._end;
    }
    set end(newEnd) {
        this._cachedBoundingArea = undefined;
        this._end = newEnd;
    }

    // Default boundingArea is a rectangle between start and end points. Must be overridden if the polygon can extend
    // outside of this area.
    get boundingArea() {
        if (this._cachedBoundingArea === undefined) {
            const topLeft = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
            const bottomRight = new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
            this._cachedBoundingArea = new CellArea(topLeft, bottomRight);
        }

        return this._cachedBoundingArea;
    }

    _initGlyphs(numRows, numCols) {
        this.glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols)
        }
    }

    _initGlyphsToBoundingArea() {
        this._initGlyphs(this.boundingArea.numRows, this.boundingArea.numCols);
    }

    _setGlyph(cell, char, colorIndex) {
        this.glyphs.chars[cell.row][cell.col] = char;
        this.glyphs.colors[cell.row][cell.col] = colorIndex;
    }

    _setGlyphToMonochar(cell) {
        this._setGlyph(cell, this.options.char, this.options.colorIndex);
    }

    _setCharSheet(sheets) {
        const charSheet = sheets[this.options.drawType];

        if (charSheet === undefined) {
            console.error("Invalid char sheet for: ", this.options.drawType)
            return;
        }

        this.charSheet = isFunction(charSheet) ? charSheet(this.options.char) : charSheet;
    }

}