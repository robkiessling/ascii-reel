import { nanoid } from 'nanoid'

export default class Shape {
    constructor(id, type, props = {}) {
        if (this.id === undefined) this.id = nanoid();
        this.type = type;
        this.props = props;
    }

    serialize() {
        return {
            id: this.id,
            type: this.type,
            props: this.serializeProps(),
        }
    }

    // Subclasses can override props serialization/deserialization (e.g. if a prop is a Cell)
    serializeProps() {
        return structuredClone(this.props);
    }
    static deserializeProps(props) {
        return structuredClone(props);
    }

    // Returns { glyphs: [[]], origin: Cell }
    rasterize() {
        throw new Error(`resize must be implemented by subclass`)
    }

    resize(handle, position, mods) {
        throw new Error(`resize must be implemented by subclass`)
    }
    commitResize() {
        if (!this.draft) throw new Error(`draft is required to commitResize()`)
        $.extend(this.props, this.draft);
        this.draft = undefined;
    }
    appliedDraft() {
        return this.draft ? { ...this.props, ...this.draft } : this.props;
    }

    get boundingArea() {
        if (this._cachedBoundingArea === undefined) {
            this._cachedBoundingArea = this._calcBoundingArea;
        }

        return this._cachedBoundingArea;
    }

    _calcBoundingArea() {
        throw new Error("_calcBoundingArea must be implemented by subclass");
    }






    hasContent(matchingColorIndex) {

    }
    translate(rowOffset, colOffset) {

    }
    updateColorIndexes(callback) {

    }
    colorSwap(oldColorIndex, newColorIndex) {

    }
}