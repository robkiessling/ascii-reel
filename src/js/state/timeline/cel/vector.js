import {create2dArray, mergeGlyphs} from "../../../utils/arrays.js";
import {numCols, numRows} from "../../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../../config/chars.js";
import {deserializeShape} from "../../../geometry/shapes/deserialize.js";
import {transformValues} from "../../../utils/objects.js";

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
        this.layerType = 'vector';
        this.shapesById = shapesById || {};
        this.shapesOrder = shapesOrder || [];
    }

    static blank() {
        const cel = new this();
        cel.normalize()
        return cel;
    }

    static deserialize(celData, options = {}) {
        const cel = new this(
            transformValues(celData.shapesById || {}, (id, shapeData) => deserializeShape(shapeData)),
            celData.shapesOrder
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
        // need to do anything?
    }

    glyphs() {
        if (!this._cachedGlyphs) {
            this._cachedGlyphs = {
                chars: create2dArray(numRows(), numCols(), EMPTY_CHAR),
                colors: create2dArray(numRows(), numCols(), 0)
            }

            this.shapes().forEach(shape => {
                const { glyphs: shapeGlyphs, origin: shapeOrigin } = shape.rasterize();
                mergeGlyphs(this._cachedGlyphs, shapeGlyphs, shapeOrigin);
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

    _clearCachedGlyphs() {
        this._cachedGlyphs = undefined;
    }

    updateShape(shapeId, shapeData) {
        this._clearCachedGlyphs();
    }
    deleteShape(shapeId) {

        this._clearCachedGlyphs();
    }
    shapes() {
        return this.shapesOrder.map(shapeId => this.shapesById[shapeId]);
    }
}
