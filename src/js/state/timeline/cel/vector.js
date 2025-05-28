import {create2dArray, freeze2dArray} from "../../../utils/arrays.js";
import {numCols, numRows} from "../../config.js";
import {EMPTY_CHAR} from "../../../config/chars.js";

/**
 * Vector Cel
 * -----------------
 * Vector cels store array of vector shapes, each defined by properties such as position, size, character, and style.
 * This allows shapes to continue to be manipulated (e.g., moved, scaled) after they've been drawn.
 *
 * Vector cels are still rasterized before they are displayed (which is expensive but cacheable).
 */

const VECTOR_CEL_DEFAULTS = {
    layerType: 'vector',
    shapesById: {},
    shapesOrder: []
}

export const VectorCelOps = {
    normalize: cel => {
        const normalizedCel = $.extend(true, {}, VECTOR_CEL_DEFAULTS);

        // Copy over everything except for shapesById
        Object.keys(cel).filter(key => key !== 'shapesById').forEach(key => normalizedCel[key] = cel[key]);

        normalizedCel.shapesById = cel.shapesById;

        return normalizedCel;
    },
    rasterizedGlyphs: cel => {
        // todo complex stuff
        return {
            chars: freeze2dArray(create2dArray(numRows(), numCols(), EMPTY_CHAR)),
            colors: freeze2dArray(create2dArray(numRows(), numCols(), 0))
        }
    },
    hasContent: (cel, matchingColorIndex) => {
        let result = false;
        VectorCelOps.shapes(cel).forEach(shape => {
            // todo check if shape uses color index
        })
        return result;
    },
    translate(cel, rowOffset, colOffset) {
        VectorCelOps.shapes(cel).forEach(shape => {
            shape.translate(rowOffset, colOffset);
        })
    },
    resize: (cel, newDimensions, rowOffset, colOffset) => {

    },

    convertToMonochrome: cel => {
        // todo
    },
    updateColorIndexes: (cel, callback) => {
        VectorCelOps.shapes(cel).forEach(shape => {
            shape.updateColorIndexes(callback)
        })
    },
    colorSwap: (cel, oldColorIndex, newColorIndex) => {
        VectorCelOps.shapes(cel).forEach(shape => {
            shape.colorSwap(newColorIndex, newColorIndex);
        })
    },

    addShape: (cel, shapeData) => {

    },
    updateShape: (cel, shapeId, shapeData) => {

    },
    deleteShape: (cel, shapeId) => {

    },
    shapes: (cel) => {
        return cel.shapesOrder.map(shapeId => cel.shapesById[shapeId])
    }
}