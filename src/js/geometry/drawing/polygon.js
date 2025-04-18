/**
 * Base class for Ascii drawings. Subclasses will override recalculate() function.
 */
export default class DrawingPolygon {
    constructor(startCell, options = {}) {
        this.start = startCell;
        this.end = startCell.clone();
        this.options = options;
    }

    get glyphs() {
        return this._glyphs;
    }

    get origin() {
        return this._origin;
    }

    recalculate() {
        this._glyphs = {
            chars: [[]],
            colors: [[]]
        }

        this._origin = this.start;
    }
}