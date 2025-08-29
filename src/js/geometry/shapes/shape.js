import { nanoid } from 'nanoid'
import {create2dArray} from "../../utils/arrays.js";
import {CHAR_PROP, COLOR_PROP, FILL_OPTIONS, FILL_PROP} from "./constants.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";

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

    updateProp(prop, newValue) {
        this.props[prop] = newValue;
        this._clearCache();
    }

    // Initial draw always deals with Cells, not vertexes.
    handleInitialDraw(cell, modifiers) {
        if (!this._initialDraw) {
            this._initialDraw = {
                start: cell.clone()
            }
        }
        this._initialDraw.end = cell.clone();
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

    finishResize() {
        this._resizeSnapshot = undefined;
    }

    dragCellHandle(handle, position, options) {
        throw new Error(`dragCellHandle must be implemented by subclass`)
    }


    _cacheGeometry() {
        throw new Error("_cacheGeometry must be implemented by subclass");
    }

    _clearCache() {
        this._cache = {};
    }

    /**
     * @returns {CellArea}
     */
    get boundingArea() {
        if (this._cache.boundingArea === undefined) this._cacheGeometry();
        return this._cache.boundingArea;
    }

    /**
     * @returns {HandleCollection}
     */
    get handles() {
        if (this._cache.handles === undefined) this._cacheGeometry();
        return this._cache.handles;
    }

    // Returns { glyphs: [[]], origin: Cell }
    rasterize() {
        if (this._cache.glyphs === undefined) this._cacheGeometry();
        return {
            glyphs: this._cache.glyphs,
            origin: this._cache.origin
        };
    }

    fitsInside(cellArea) {
        return cellArea.contains(this.boundingArea);
    }

    get textLayout() {
        if (this._cache.textLayout === undefined) this._cacheGeometry();
        return this._cache.textLayout;
    }

    // Note: glyphs will be in relative coords
    _initGlyphs(area) {
        return {
            chars: create2dArray(area.numRows, area.numCols),
            colors: create2dArray(area.numRows, area.numCols),
        }
    }
    _setGlyph(glyphs, cell, char, colorIndex) {
        glyphs.chars[cell.row][cell.col] = char;
        glyphs.colors[cell.row][cell.col] = colorIndex;
    }

    _fillChar() {
        switch(this.props[FILL_PROP]) {
            case FILL_OPTIONS.WHITESPACE:
                return WHITESPACE_CHAR;
            case FILL_OPTIONS.MONOCHAR:
                return this.props[CHAR_PROP] || EMPTY_CHAR;
            default:
                return EMPTY_CHAR;
        }
    }


    hasContent(matchingColorIndex) {
        // TODO
    }
    translate(rowOffset, colOffset) {
        throw new Error("translate must be implemented by subclass");
    }

    updateColorIndexes(callback) {
        if (this.props[COLOR_PROP] !== undefined) {
            callback(this.props[COLOR_PROP], newColorIndex => this.props[COLOR_PROP] = newColorIndex);
        }

        this._clearCache();
    }
    colorSwap(oldColorIndex, newColorIndex) {
        if (this.props[COLOR_PROP] === oldColorIndex) {
            this.props[COLOR_PROP] = newColorIndex;
        }

        this._clearCache();
    }
}