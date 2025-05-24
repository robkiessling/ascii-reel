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
    shapes: []
}

export const VectorCelOps = {
    normalize: cel => {
        const normalizedCel = $.extend(true, {}, VECTOR_CEL_DEFAULTS);

        // Copy over everything except for shapes
        Object.keys(cel).filter(key => key !== 'shapes').forEach(key => normalizedCel[key] = cel[key]);

        normalizedCel.shapes = cel.shapes;

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
        cel.shapes.forEach(shape => {
            // todo check if shape uses color index
        })
        return result;
    },
    translate(cel, rowOffset, colOffset) {
        cel.shapes.forEach(shape => {
            shape.translate(rowOffset, colOffset);
        })
    },
    resize: (cel, newDimensions, rowOffset, colOffset) => {

    },

    convertToMonochrome: cel => {
        // todo
    },
    updateColorIndexes: (cel, callback) => {
        cel.shapes.forEach(shape => {
            shape.updateColorIndexes(callback)
        })
    },
    colorSwap: (cel, oldColorIndex, newColorIndex) => {
        cel.shapes.forEach(shape => {
            shape.colorSwap(newColorIndex, newColorIndex);
        })
    },

    setGlyph: (cel, row, col, char, color) => {
        // No effect
    },
}