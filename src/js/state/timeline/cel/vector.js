import {areArraysEqual, create2dArray, mergeGlyphs, moveOneStep} from "../../../utils/arrays.js";
import {numCols, numRows} from "../../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../../config/chars.js";
import {transformValues} from "../../../utils/objects.js";
import {COLOR_PROP, HANDLE_TYPES, REORDER_ACTIONS} from "../../../geometry/shapes/constants.js";
import {LAYER_TYPES} from "../../constants.js";
import Shape from "../../../geometry/shapes/shape.js";

/**
 * Vector Cel
 * -----------------
 * Vector cels store array of vector shapes, each defined by properties such as position, size, character, and style.
 * This allows shapes to continue to be manipulated (e.g., moved, scaled) after they've been drawn.
 *
 * Vector cels are still rasterized before they are displayed (which is expensive but cacheable).
 */
export default class VectorCel {
    constructor(shapesById, shapesOrder) {
        this.layerType = LAYER_TYPES.VECTOR;
        this.shapesById = shapesById || {};
        this.shapesOrder = shapesOrder || [];
    }

    static blank() {
        const cel = new this();
        cel.normalize()
        return cel;
    }

    static deserialize(data, options = {}) {
        const cel = new this(
            transformValues(data.shapesById || {}, (id, shapeData) => Shape.deserialize(shapeData)),
            data.shapesOrder
        );

        if (!options.replace) {
            cel.normalize()
        }
        return cel;
    }

    serialize(options = {}) {
        return {
            layerType: this.layerType,
            shapesById: transformValues(this.shapesById, (id, shape) => shape.serialize()),
            shapesOrder: this.shapesOrder,
        }
    }

    normalize() {
        // Filter shapesById to only keep keys that are in shapesOrder (and ensures shape id matches its key)
        this.shapesById = Object.fromEntries(
            Object.entries(this.shapesById).filter(([id, shape]) => {
                if (!this.shapesOrder.includes(id)) {
                    console.warn(`Removing shape ${id} from shapesById -- it is not found in shapesOrder`);
                    return false;
                }
                if (shape.id !== id) {
                    console.warn(`Removing shape ${id} from shapesById -- its internal id does not match key`);
                    return false;
                }
                return true;
            })
        );

        // Filter shapesOrder to only keep IDs that exist in shapesById
        this.shapesOrder = this.shapesOrder.filter(id => {
            if (!(id in this.shapesById)) {
                console.warn(`Removing shape ${id} from shapesOrder -- it is not found in shapesById`);
                return false;
            }
            return true;
        });
    }

    /**
     * Returns the rendered character and color grids for this cel.
     *
     * @param {{row: number, col: number}} [offset] - Optional offset to apply to the rendered position.
     * @returns {{chars: string[][], colors: number[][]}}
     */
    glyphs(offset = { row: 0, col: 0 }) {
        // If offset changes, recalculate cache
        const needsRebuild = !this._cachedGlyphs || !this._cachedGlyphsOffset ||
            this._cachedGlyphsOffset.row !== offset.row ||
            this._cachedGlyphsOffset.col !== offset.col;

        if (needsRebuild) {
            this._cachedGlyphsOffset = { ...offset };
            this._cachedGlyphs = {
                chars: create2dArray(numRows(), numCols(), EMPTY_CHAR),
                colors: create2dArray(numRows(), numCols(), 0)
            }

            // TODO [Performance] I think this can be optimized. Rather than drawing every shape to canvas (which is
            //      wasteful if many shapes overlap), just draw every cell once.
            this.shapes().forEach(shape => {
                const { glyphs: shapeGlyphs, origin: shapeOrigin } = shape.rasterize();
                mergeGlyphs(this._cachedGlyphs, shapeGlyphs, shapeOrigin.clone().translate(offset.row, offset.col));
            })
        }

        return this._cachedGlyphs;
    }

    _clearCachedGlyphs() {
        this._cachedGlyphs = undefined;
        this._cachedGlyphsOffset = undefined;
    }


    hasContent(matchingColorIndex) {
        if (matchingColorIndex === undefined) {
            return this.shapes().length > 0;
        } else {
            for (const shape of this.shapes()) {
                if (shape.isAllowedProp(COLOR_PROP) && shape.props[COLOR_PROP] === matchingColorIndex) return true;
            }
            return false;
        }
    }

    translate(rowOffset, colOffset) {
        this.shapes().forEach(shape => shape.translate(rowOffset, colOffset))
        this._clearCachedGlyphs();
    }

    resize(newDimensions, rowOffset, colOffset) {
        // todo delete any shapes out of the picture?
        this._clearCachedGlyphs();
    }

    convertToMonochrome() {
        this.shapes().forEach(shape => shape.updateProp(COLOR_PROP, 0))
        this._clearCachedGlyphs();
    }

    getUniqueColorIndexes() {
        const result = new Set();
        this.shapes().forEach(shape => {
            if (shape.isAllowedProp(COLOR_PROP)) result.add(shape.props[COLOR_PROP])
        })
        return result;
    }

    updateColorIndexes(mapper) {
        this.shapes().forEach(shape => {
            if (shape.isAllowedProp(COLOR_PROP)) shape.updateProp(COLOR_PROP, mapper.get(shape.props[COLOR_PROP]))
        });
        this._clearCachedGlyphs();
    }

    colorSwap(oldColorIndex, newColorIndex) {
        this.shapes().forEach(shape => shape.colorSwap(oldColorIndex, newColorIndex))
        this._clearCachedGlyphs();
    }


    addShape(shape) {
        this.shapesById[shape.id] = shape;
        this.shapesOrder.push(shape.id);
        this._clearCachedGlyphs();
    }

    // ------------------ Vector-specific functions:

    getShape(shapeId) {
        if (this.shapesById[shapeId] === undefined) throw new Error(`Could not find shape for id ${shapeId}`);
        return this.shapesById[shapeId];
    }

    /**
     * Checks whether a shape exists in the cel.
     *
     * This is useful when you need to conditionally handle shapes that may have been deleted by another process.
     * Usually when you call getShape, updateShape, etc. you can skip this check and let the method throw an error
     * if the shape is missing.
     *
     * @param {string} shapeId - The ID of the shape to check
     * @returns {boolean} True if the shape exists, false otherwise
     */
    shapeExists(shapeId) {
        return !!this.shapesById[shapeId];
    }

    /**
     * Applies an update to a shape in this cel.
     * @param {string} shapeId - The ID of shape to update
     * @param {(shape: Shape) => boolean|void} updater - Function called with the shape for the given `shapeId`.
     *   Should return `true` if the shape's state was modified, or `false` if no changes were made.
     *   This cel's cached glyphs are only cleared when the updater reports a change.
     *   If function returns void, it will count as updating; cache will be cleared.
     * @returns {boolean} - `true` if the shape's state changed, otherwise `false`
     */
    updateShape(shapeId, updater) {
        let updated = updater(this.shapesById[shapeId])
        if (updated === undefined) updated = true;
        if (updated) this._clearCachedGlyphs();
        return updated;
    }

    deleteShape(shapeId) {
        const deletedShape = this.getShape(shapeId);
        this.otherShapes(shapeId).forEach(otherShape => otherShape.removeAttachmentsTo(deletedShape))

        delete this.shapesById[shapeId];

        const index = this.shapesOrder.indexOf(shapeId);
        if (index !== -1) this.shapesOrder.splice(index, 1);

        this._clearCachedGlyphs();
    }
    shapes() {
        return this.shapesOrder.map(shapeId => this.shapesById[shapeId]);
    }
    otherShapes(shapeId) {
        return this.shapes().filter(shape => shape.id !== shapeId)
    }

    reorderShapes(shapeIds, action) {
        this.shapesOrder = this._reorderShapesPreview(shapeIds, action);
        this._clearCachedGlyphs();
    }

    canReorderShapes(shapeIds, action) {
        return !areArraysEqual(this.shapesOrder, this._reorderShapesPreview(shapeIds, action));
    }

    _reorderShapesPreview(shapeIds, action) {
        if (!Array.isArray(shapeIds) || shapeIds.length === 0) return [...this.shapesOrder];

        const idSet = new Set(shapeIds);
        const remainingIds = this.shapesOrder.filter(id => !idSet.has(id));

        switch(action) {
            case REORDER_ACTIONS.BRING_TO_FRONT:
                return [...remainingIds, ...shapeIds];
            case REORDER_ACTIONS.SEND_TO_BACK:
                return [...shapeIds, ...remainingIds];
            case REORDER_ACTIONS.BRING_FORWARD:
                return moveOneStep(this.shapesOrder, shapeIds, 1);
            case REORDER_ACTIONS.SEND_BACKWARD:
                return moveOneStep(this.shapesOrder, shapeIds, -1);
            default:
                throw new Error(`Invalid reorder action: ${action}`)
        }
    }

    /**
     * Retrieves all the shapes that are above a given shape
     * @param {string} shapeId - ID of the shape
     * @returns {string[]} - Array of shape ids
     */
    getShapeIdsAbove(shapeId) {
        const index = this.shapesOrder.indexOf(shapeId);
        return index === -1 ? [] : this.shapesOrder.slice(index + 1);
    }

    /**
     * Tests all shapes in the Cel from top to bottom for a matching handle.
     * @param {Cell} cell - The Cell to test
     * @param {HANDLE_TYPES.BODY|HANDLE_TYPES.ATTACHMENT} handleType - Handle type to check for
     * @param {string[]} [forShapeIds] - If provided, only specific shapes will be considered
     * @returns {Handle|null}
     */
    testHandles(cell, handleType, forShapeIds) {
        // Find first shape that has a handle at that cell, iterating in reverse order (top shape is checked first)
        for (let i = this.shapesOrder.length - 1; i >= 0; i--) {
            const shapeId = this.shapesOrder[i]
            const shape = this.shapesById[shapeId];

            if (forShapeIds !== undefined && !forShapeIds.includes(shapeId)) continue;

            const handle = shape.handles.matches(handleType, { cell });
            if (handle) return handle;
        }

        return null;
    }

    testMarquee(cellArea) {
        // Option 1: Include shapes that completely fit in the cellArea bounds
        return this.shapes().filter(shape => shape.fitsInside(cellArea));

        // Option 2: Include shapes that partially overlap with cellArea bounds
        // TODO this has problems, e.g. empty rect still gets selected when clicking inside
        // return this.shapes().filter(shape => shape.overlaps(cellArea));
    }

}
