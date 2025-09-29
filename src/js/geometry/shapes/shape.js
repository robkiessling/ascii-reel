import { nanoid } from 'nanoid'
import {AnchoredGrid, create2dArray} from "../../utils/arrays.js";
import {
    CHAR_PROP,
    COLOR_PROP,
    FILL_OPTIONS,
    FILL_PROP, LINKED_PROPS,
    SHAPE_TEXT_ACTIONS, STROKE_STYLE_PROPS,
    TEXT_PROP
} from "./constants.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {deleteBackward, deleteForward, deleteRange, insertAt} from "../../utils/strings.js";
import {deserializeShape, getConstructor} from "./registry.js";
import CellArea from "../cell_area.js";

export default class Shape {
    static propDefinitions = [
        { prop: CHAR_PROP },
        { prop: COLOR_PROP },
    ]

    static get allowedProps() {
        if (!Object.hasOwn(this, '_allowedPropsCache')) {
            this._allowedPropsCache = new Set(this.propDefinitions.map(definition => definition.prop));
        }
        return this._allowedPropsCache;
    }

    constructor(id, type, props = {}) {
        this.id = id || nanoid();
        this.type = type;

        this.props = {};
        this.constructor.propDefinitions.forEach(definition => {
            const incomingValue = props[definition.prop];
            this.updateProp(definition.prop, incomingValue === undefined ? definition.default : incomingValue);
        })

        this._clearCache();
    }

    static deserialize(data) {
        return deserializeShape(data)
    }

    static begin(shapeType, initialProps) {
        const constructor = getConstructor(shapeType);
        return new constructor(undefined, shapeType, initialProps);
    }

    serialize() {
        return {
            id: this.id,
            type: this.type,
            props: this.serializeProps(),
        }
    }

    duplicate() {
        const serializedShape = this.serialize();
        serializedShape.id = undefined;
        return deserializeShape(serializedShape);
    }

    // Subclasses can override props serialization/deserialization (e.g. if a prop is a Cell)
    serializeProps() {
        return structuredClone(this.props);
    }
    static deserializeProps(props) {
        return structuredClone(props);
    }

    /**
     * Updates one of the shape's properties. Property must be included in the shape's static allowedProps
     * for it to be updated.
     * @param {string} propKey - Property to update
     * @param newValue - Value to set property to
     * @returns {boolean} - Whether the property was actually updated. Note: uses === to test equality, so if your
     *   value is, for example, a Cell, this will return true if though the Cells might be at the same location.
     */
    updateProp(propKey, newValue) {
        const standardUpdate = (key, value) => {
            if (this.constructor.allowedProps.has(key) && this.props[key] !== value) {
                this.props[key] = value;
                this._clearCache();
                return true;
            }
            return false;
        }

        // Special handler for linked props:
        for (const { when, enforce } of LINKED_PROPS) {
            if (propKey === when.prop && newValue === when.value) {
                const normalUpdate = standardUpdate(propKey, newValue)
                const linkedUpdate = standardUpdate(enforce.prop, enforce.value);
                return normalUpdate || linkedUpdate;
            }
            if (propKey === enforce.prop && this.props[when.prop] === when.value) {
                return standardUpdate(propKey, enforce.value);
            }
        }

        return standardUpdate(propKey, newValue);
    }

    // ------------------------------------------------------ Initial draw

    /**
     * Called during initial shape drawing on any mousedown. For most shapes, this is only
     * called once to place the starting anchor. But some shapes, such as multi-point lines,
     * will have this called multiple times.
     * @param {Cell} cell - Location of mousedown
     * @param {Object} options
     */
    handleDrawMousedown(cell, options) {
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
     * @param {Object} [options] - additional options
     */
    handleDrawMousemove(cell, options) {
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
        this._initialDraw = undefined;
    }

    get isPerformingInitialDraw() {
        return !!this._initialDraw;
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

    resize(oldBox, newBox) {
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

    overlaps(cellArea) {
        return cellArea.overlaps(this.boundingArea);
    }

    get canHaveText() {
        return false;
    }

    /**
     * Returns the shape's TextLayout component.
     * @returns {TextLayout}
     */
    get textLayout() {
        if (!this.canHaveText) throw new Error('Shape does not support textLayout');
        if (this._cache.textLayout === undefined) this._cacheGeometry();
        if (this._cache.textLayout === undefined) throw new Error(`Shape failed to create textLayout during _cacheGeometry`)
        return this._cache.textLayout;
    }

    /**
     * Updates the text property of the shape.
     *
     * @param {string} action - A key from {@link SHAPE_TEXT_ACTIONS} that specifies the type of modification to
     *   perform (e.g., insert, delete, replace).
     * @param {Object} actionParams - An options object containing the parameters required by the given action type.
     */
    updateText(action, actionParams) {
        const currentText = this.props[TEXT_PROP] || '';

        switch(action) {
            case SHAPE_TEXT_ACTIONS.INSERT:
                this.props[TEXT_PROP] = insertAt(currentText, actionParams.caretIndex, actionParams.text)
                break;
            case SHAPE_TEXT_ACTIONS.DELETE_BACKWARD:
                this.props[TEXT_PROP] = deleteBackward(currentText, actionParams.caretIndex)
                break;
            case SHAPE_TEXT_ACTIONS.DELETE_FORWARD:
                this.props[TEXT_PROP] = deleteForward(currentText, actionParams.caretIndex)
                break;
            case SHAPE_TEXT_ACTIONS.DELETE_RANGE:
                this.props[TEXT_PROP] = deleteRange(currentText, actionParams.startIndex, actionParams.endIndex)
                break;
            case SHAPE_TEXT_ACTIONS.REPLACE:
                this.props[TEXT_PROP] = actionParams.text;
                break;
            default:
                throw new Error(`Invalid updateText action: ${action}`)
        }

        this._clearCache();
    }

    // -------------------------------------------------------------------------------- Glyphs
    /**
     * A glyph "grid" contains 2d arrays for both chars and colors.
     *
     * Two storage modes are supported:
     *
     * 1. Standard Mode: Uses regular 2D arrays for rectangular shapes.
     * 2. Overflow Mode Uses `AnchoredGrid` to support brush strokes
     *    or shapes that can extend outside their bounding box (e.g. thick freeform lines).
     *
     * Glyphs are stored in relative coords to shape's origin.
     */

    /**
     * Sets up containers to hold the shape's rendered chars/colors.
     * @param {CellArea} boundingArea - current bounding area of shape
     * @param {boolean} [supportOverflow=false] - If true, uses AnchoredGrids to allow drawing glyphs that extend
     *   outside the bounding area. If false, uses regular 2D arrays sized to the bounding area.
     *
     *  @returns {{chars: AnchoredGrid|string[][], colors: AnchoredGrid|number[][], supportOverflow: boolean}}
     */
    _initGlyphs(boundingArea, supportOverflow = false) {
        return supportOverflow ? {
            chars: AnchoredGrid.filledGrid(boundingArea.numRows, boundingArea.numCols),
            colors: AnchoredGrid.filledGrid(boundingArea.numRows, boundingArea.numCols),
            supportOverflow
        } : {
            chars: create2dArray(boundingArea.numRows, boundingArea.numCols),
            colors: create2dArray(boundingArea.numRows, boundingArea.numCols),
            supportOverflow
        }
    }

    _setGlyph(glyphs, cell, char, colorIndex) {
        if (glyphs.supportOverflow) {
            glyphs.chars.set(cell.row, cell.col, char);
            glyphs.colors.set(cell.row, cell.col, colorIndex);
        } else {
            glyphs.chars[cell.row][cell.col] = char;
            glyphs.colors[cell.row][cell.col] = colorIndex;
        }
    }

    /**
     * Converts the AnchoredGrids back to normal 2d arrays. Also returns an updated boundingArea and origin
     * if the anchored grids had any out-of-bounds cells.
     * @param glyphs
     * @param currentOrigin
     * @returns {{boundingArea: CellArea, origin: Cell, glyphs: {chars: string[][], colors: number[][]}}}
     */
    _processAnchoredGrid(glyphs, currentOrigin) {
        const { data: chars, rowOffset, colOffset } = glyphs.chars.to2dArray();
        const { data: colors } = glyphs.colors.to2dArray();
        const origin = currentOrigin.clone().translate(rowOffset, colOffset);

        return {
            boundingArea: CellArea.fromOriginAndDimensions(origin, chars.length, chars[0].length),
            origin: origin,
            glyphs: { chars, colors }
        }
    }

    get _fillChar() {
        switch(this.props[FILL_PROP]) {
            case FILL_OPTIONS.WHITESPACE:
                return WHITESPACE_CHAR;
            case FILL_OPTIONS.MONOCHAR:
                return this.props[CHAR_PROP] || EMPTY_CHAR;
            default:
                return EMPTY_CHAR;
        }
    }

    get _strokeStyle() {
        return this.props[STROKE_STYLE_PROPS[this.type]]
    }

    // --------------------------------------------------------------------------------

    // If returns true, shape will be deleted when text editing is finished
    deleteOnTextFinished() {
        return false;
    }
    showSelectionOnInitialDraw() {
        return false;
    }

    hasContent(matchingColorIndex) {
        // TODO
    }
    translate(rowOffset, colOffset) {
        throw new Error("translate must be implemented by subclass");
    }

    /**
     * Top-left cell of the shape. Useful when translating groups of shapes and you need to determine overall topLeft.
     * @returns {Cell}
     */
    get topLeft() {
        throw new Error("topLeft must be implemented by subclass");
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