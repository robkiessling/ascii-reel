import { nanoid } from 'nanoid'
import {create2dArray} from "../../utils/arrays.js";
import {COLOR_PROPS, HANDLES, TRANSLATABLE_PROPS} from "./constants.js";

export default class Shape {
    constructor(id, type, props = {}) {
        this.id = id || nanoid();
        this.type = type;
        this.props = props;
        this._clearCache();
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

    // ------------------------------------------------------ Resizing
    // Resizing requires a snapshot of its initial state to compare to. So resizing is a three part process:
    // 1. call beginResize()
    // 2. call resize() multiple times as user drags. resize() can reference resizeSnapshot if needed
    // 3. call finishResize()

    beginResize() {
        if (this._resizeSnapshot) throw new Error(`beginResize has already been called`);
        this._resizeSnapshot = this.serializeProps();
    }

    get resizeSnapshot() {
        if (!this._resizeSnapshot) throw new Error(`Must call beginResize before resizing`)
        return this.constructor.deserializeProps(this._resizeSnapshot);
    }

    resize(handle, position, options) {
        throw new Error(`resize must be implemented by subclass`)
    }

    resizeInGroup(oldGroupBox, newGroupBox) {
        throw new Error(`resizeInGroup must be implemented by subclass`)
    }

    finishResize() {
        this._resizeSnapshot = undefined;
    }


    _cacheGeometry() {
        throw new Error("_cacheGeometry must be implemented by subclass");
    }

    _clearCache() {
        this._cache = {};
    }

    get boundingArea() {
        if (!this._cache.boundingArea) this._cacheGeometry();
        return this._cache.boundingArea;
    }

    // Returns { glyphs: [[]], origin: Cell }
    rasterize() {
        if (!this._cache.glyphs) this._cacheGeometry();
        return {
            glyphs: this._cache.glyphs,
            origin: this._cache.origin
        };
    }

    /**
     * Hitbox is the area where if clicked on the shape will be selected. This varies from shape to shape; e.g. for
     * rectangles if the rectangle is not filled the hitbox is just the outer area.
     */
    checkHitbox(cell) {
        if (!this._cache.hitbox) this._cacheGeometry();
        return this._cache.hitbox(cell);
    }

    fitsInside(cellArea) {
        return cellArea.contains(this.boundingArea);
    }

    _initGlyphs(numRows, numCols) {
        return {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols),
        }
    }
    _setGlyph(glyphs, cell, char, colorIndex) {
        glyphs.chars[cell.row][cell.col] = char;
        glyphs.colors[cell.row][cell.col] = colorIndex;
    }



    hasContent(matchingColorIndex) {
        // TODO
    }
    translate(rowOffset, colOffset) {
        TRANSLATABLE_PROPS.forEach(prop => {
            if (this.props[prop] !== undefined) {
                this.props[prop].translate(rowOffset, colOffset);
            }
        })
        this._clearCache();
    }

    updateColorIndexes(callback) {
        COLOR_PROPS.forEach(prop => {
            if (this.props[prop] !== undefined) {
                callback(this.props[prop], newColorIndex => this.props[prop] = newColorIndex);
            }
        })

        this._clearCache();
    }
    colorSwap(oldColorIndex, newColorIndex) {
        COLOR_PROPS.forEach(prop => {
            if (this.props[prop] === oldColorIndex) {
                this.props[prop] = newColorIndex;
            }
        })

        this._clearCache();
    }
}