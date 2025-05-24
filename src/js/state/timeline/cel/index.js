import {RasterCelOps} from "./raster.js";
import {VectorCelOps} from "./vector.js";
import {getCelId} from "../cels.js";

/**
 * Cel
 * -----------------
 * The term "cel" is short for "celluloid" https://en.wikipedia.org/wiki/Cel
 * In this app, it represents one image in a specific frame and layer.
 * Note: This is different from a "Cell" (which refers to a row/column pair in this app)
 *
 *
 * CelOps Registry
 * -----------------
 * This registry serves as a centralized dispatch table for operations that apply differently depending on the cel
 * type (e.g., 'raster', 'vector').
 *
 * Instead of using class-based polymorphism (e.g., RasterCel, VectorCel), we keep our app state fully serializable
 * by storing plain objects and using functional dispatch based on the cel's layerType.
 *
 * Each key in CelOps (like 'normalize', 'translate', etc.) maps to an object with handlers for each cel type.
 */

function celOp(operation, cel, ...rest) {
    switch(cel.layerType) {
        case 'raster': return RasterCelOps[operation](cel, ...rest);
        case 'vector': return VectorCelOps[operation](cel, ...rest);
        default: throw new Error(`Unknown layer type "${cel.layerType}"`);
    }
}

// Cache rasterization results to improve performance
const cachedCelGlyphs = new Map();
export function clearAllCachedCels() {
    cachedCelGlyphs.clear()
}
export function clearCachedCel(cel) {
    cachedCelGlyphs.delete(cel.id)
}

export const CelOps = {
    normalize: (celData, layer, frame) => {
        if (layer !== undefined) celData.layerType = layer.type
        if (layer !== undefined && frame !== undefined) celData.id = getCelId(layer.id, frame.id)

        // If no layer/id information, we cannot normalize the cell
        if (celData.layerType === undefined || celData.id === undefined) return null;

        return celOp('normalize', celData);
    },
    rasterizedGlyphs: (cel) => {
        if (!cachedCelGlyphs.has(cel.id)) cachedCelGlyphs.set(cel.id, celOp('rasterizedGlyphs', cel));
        return cachedCelGlyphs.get(cel.id);
    },
    hasContent: (cel, matchingColorIndex) => {
        return celOp('hasContent', cel, matchingColorIndex);
    },
    translate: (cel, rowOffset, colOffset, wrap = false) => {
        clearCachedCel(cel);
        return celOp('translate', cel, rowOffset, colOffset, wrap)
    },
    resize: (cel, newDimensions, rowOffset, colOffset) => {
        clearCachedCel(cel);
        return celOp('resize', cel, newDimensions, rowOffset, colOffset)
    },

    convertToMonochrome: (cel) => {
        clearCachedCel(cel);
        return celOp('convertToMonochrome', cel);
    },
    updateColorIndexes: (cel, callback) => {
        clearCachedCel(cel);
        return celOp('updateColorIndexes', cel, callback)
    },
    colorSwap: (cel, oldColorIndex, newColorIndex) => {
        clearCachedCel(cel);
        return celOp('colorSwap', cel, oldColorIndex, newColorIndex);
    },

    setGlyph: (cel, row, col, char, color) => {
        clearCachedCel(cel);
        return celOp('setGlyph', cel, row, col, char, color);
    },


    encode: (cel, req16BitColors) => {
        return celOp('encode', cel, req16BitColors);
    },
    decode: (cel, celRowLength, req16BitColors) => {
        return celOp('decode', cel, celRowLength, req16BitColors);
    }
}
