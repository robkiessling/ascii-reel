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

    // ------------------------------------------------------ Initial draw

    /**
     * Called during initial shape drawing on any mousedown. For most shapes, this is only
     * called once to place the starting anchor. But some shapes, such as multi-point lines,
     * will have this called multiple times.
     * @param {Cell} cell - Location of mousedown
     */
    handleDrawMousedown(cell) {
        if (!this._initialDraw) {
            this._initialDraw = {
                anchor: cell.clone(), // Original mousedown cell (unchanging)
                hover: cell.clone(), // Represents current cell being hovered over (will rapidly update)
                path: [cell.clone()], // If multiple mousedowns occur, stores the path they create
                multiPointDrawing: false // Whether this drawing uses multiple points (true) or just 2 (false)
            }
        }

        // Add further mousedown cells to path (if they are different than previous path cell)
        if (this._initialDraw.multiPointDrawing && !cell.equals(this._initialDraw.path.at(-1))) {
            this._initialDraw.path.push(cell.clone());
        }

        this._convertInitialDrawToProps();
    }

    /**
     * Called during initial shape drawing as mouse is moved across canvas.
     * @param {Cell} cell - mouse hover location
     * @param modifiers
     */
    handleDrawMousemove(cell, modifiers) {
        this._initialDraw.hover.translateTo(cell);

        this._convertInitialDrawToProps();
    }

    /**
     * Called during initial shape drawing on mouseup. Returns a boolean that signals whether the
     * shape is finished (true) or unfinished (false).
     * @param {Cell} cell - Mouseup location
     * @returns {boolean} - True if drawing is finished, false if drawing needs to continue
     */
    handleDrawMouseup(cell) {
        return true; // Default: immediately finish on mouseup
    }

    /**
     * Called once initial shape drawing is finished. Most shapes do not need any further processing,
     * but this can be overridden to add post-processing.
     */
    finishDraw() {
        // Default: Do nothing
    }

    /**
     * Converts the initial draw state into a shape's standard props.
     * @private
     */
    _convertInitialDrawToProps() {
        throw new Error(`_convertInitialDrawToProps must be implemented by subclass`)
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