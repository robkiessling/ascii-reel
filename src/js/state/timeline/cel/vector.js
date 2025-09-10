import {arraysEqual, create2dArray, mergeGlyphs, moveOneStep} from "../../../utils/arrays.js";
import {numCols, numRows} from "../../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../../config/chars.js";
import {deserializeShape} from "../../../geometry/shapes/deserialize.js";
import {transformValues} from "../../../utils/objects.js";
import {HANDLE_TYPES, REORDER_ACTIONS} from "../../../geometry/shapes/constants.js";
import {LAYER_TYPES} from "../../constants.js";

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
            transformValues(data.shapesById || {}, (id, shapeData) => deserializeShape(shapeData)),
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

    glyphs() {
        if (!this._cachedGlyphs) {
            this._cachedGlyphs = {
                chars: create2dArray(numRows(), numCols(), EMPTY_CHAR),
                colors: create2dArray(numRows(), numCols(), 0)
            }

            this.shapes().forEach(shape => {
                const { glyphs: shapeGlyphs, origin: shapeOrigin } = shape.rasterize();
                mergeGlyphs(this._cachedGlyphs, shapeGlyphs, shapeOrigin, (char, color) => {
                    // Do not merge in EMPTY_CHARs when laying shapes on top of each other. In vector cels, an "empty"
                    // shape should behave as see-through; it should not overwrite characters from shapes below it.
                    // This differs from raster cels, where the final result may intentionally include EMPTY_CHARs to
                    // erase or clear underlying content. In vector cels, the background is always empty.
                    return char !== undefined && char !== EMPTY_CHAR;
                });
            })
        }

        return this._cachedGlyphs;
    }

    hasContent(matchingColorIndex) {
        let result = false;
        this.shapes().forEach(shape => {
            // todo check if shape uses color index
        })
        return result;
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
        // todo
        this._clearCachedGlyphs();
    }

    updateColorIndexes(callback) {
        this.shapes().forEach(shape => shape.updateColorIndexes(callback))
        this._clearCachedGlyphs();
    }
    colorSwap(oldColorIndex, newColorIndex) {
        this.shapes().forEach(shape => shape.colorSwap(newColorIndex, newColorIndex))
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

    updateShape(shapeId, updater) {
        updater(this.shapesById[shapeId])
        this._clearCachedGlyphs();
    }
    deleteShape(shapeId) {
        delete this.shapesById[shapeId];

        const index = this.shapesOrder.indexOf(shapeId);
        if (index !== -1) this.shapesOrder.splice(index, 1);

        this._clearCachedGlyphs();
    }
    shapes() {
        return this.shapesOrder.map(shapeId => this.shapesById[shapeId]);
    }

    reorderShapes(shapeIds, action) {
        this.shapesOrder = this._reorderShapesPreview(shapeIds, action);
        this._clearCachedGlyphs();
    }

    canReorderShapes(shapeIds, action) {
        return !arraysEqual(this.shapesOrder, this._reorderShapesPreview(shapeIds, action));
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

    testShapeHitboxes(cell, forShapeIds) {
        // Find first shape that has a handle at that cell, iterating in reverse order (top shape is checked first)
        for (let i = this.shapesOrder.length - 1; i >= 0; i--) {
            const shapeId = this.shapesOrder[i]
            const shape = this.shapesById[shapeId];

            if (forShapeIds !== undefined && !forShapeIds.includes(shapeId)) continue;

            const bodyHandle = shape.handles.body.at(0);
            if (bodyHandle && bodyHandle.matches({ cell })) return bodyHandle;
        }

        return null;
    }

    testMarquee(cellArea) {
        // Find all shapes that fit in the cellArea bounds
        const shapes = [];
        this.shapes().forEach(shape => {
            if (shape.fitsInside(cellArea)) {
                shapes.push(shape);
            }
        })
        return shapes;
    }


    _clearCachedGlyphs() {
        this._cachedGlyphs = undefined;
    }

}
