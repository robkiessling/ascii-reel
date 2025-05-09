import DrawingLine from "./base.js";

export default class MonocharLine extends DrawingLine {
    recalculate() {
        this._initGlyphsToBoundingArea();

        this.start.lineTo(this.end).forEach(cell => {
            this._setGlyphToMonochar(cell.relativeTo(this.origin));
        })
    }
}