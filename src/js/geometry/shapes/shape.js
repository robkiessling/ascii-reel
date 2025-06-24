import { nanoid } from 'nanoid'
import {create2dArray} from "../../utils/arrays.js";
import {HANDLES} from "./constants.js";

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

    resize(handle, position, mods) {
        throw new Error(`resize must be implemented by subclass`)
    }
    commitResize() {
        if (!this.draft) throw new Error(`draft is required to commitResize()`)
        $.extend(this.props, this.draft);
        this.draft = undefined;
        this._clearCache();
    }
    appliedDraft() {
        return this.draft ? { ...this.props, ...this.draft } : this.props;
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

    getHandle(cell, cellPixel, isSelected) {
        throw new Error(`getHandle must be implemented by subclass`)
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


    //---- handles
    _centerHandle() {
        return {
            shape: this,
            handle: HANDLES.CENTER_CENTER,
            cursor: 'move'
        }
    }
    _topLeftHandle() {
        return {
            shape: this,
            handle: HANDLES.TOP_LEFT,
            cursor: 'nwse-resize'
        }
    }
    _topRightHandle() {
        return {
            shape: this,
            handle: HANDLES.TOP_RIGHT,
            cursor: 'nesw-resize'
        }
    }
    _bottomLeftHandle() {
        return {
            shape: this,
            handle: HANDLES.BOTTOM_LEFT,
            cursor: 'nesw-resize'
        }
    }
    _bottomRightHandle() {
        return {
            shape: this,
            handle: HANDLES.BOTTOM_RIGHT,
            cursor: 'nwse-resize'
        }
    }



    hasContent(matchingColorIndex) {

    }
    translate(rowOffset, colOffset) {
        this._clearCache();
    }
    updateColorIndexes(callback) {
        this._clearCache();
    }
    colorSwap(oldColorIndex, newColorIndex) {
        this._clearCache();
    }
}