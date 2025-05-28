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
 * Cel Operations Registry
 * -----------------
 * This registry serves as a centralized dispatch table for operations that apply differently depending on the cel
 * type (e.g., 'raster', 'vector').
 *
 * Instead of using class-based polymorphism (e.g., RasterCel, VectorCel), we keep our app state fully serializable
 * by storing plain objects and using functional dispatch based on the cel's layerType.
 */
function celOp(operation, cel, ...rest) {
    let fn;

    switch(cel.layerType) {
        case 'raster':
            fn = RasterCelOps[operation];
            break;
        case 'vector':
            fn = VectorCelOps[operation];
            break;
        default: throw new Error(`Unknown layer type "${cel.layerType}"`);
    }

    if (fn) return fn(cel, ...rest);
}

export function normalizeCel(celData, layer, frame) {
    if (layer !== undefined) celData.layerType = layer.type
    if (layer !== undefined && frame !== undefined) celData.id = getCelId(layer.id, frame.id)

    // If no layer/id information, we cannot normalize the cell
    if (celData.layerType === undefined || celData.id === undefined) return null;

    return celOp('normalize', celData);
}
export function getCelGlyphs(cel) {
    return celOp('rasterizedGlyphs', cel)
}
export function celHasContent(cel, matchingColorIndex) {
    return celOp('hasContent', cel, matchingColorIndex);
}

export function addCelShape(cel, shapeData) {
    return celOp('addShape', cel, shapeData);
}
export function updateCelShape(cel, shapeId, shapeData) {
    return celOp('updateShape', cel, shapeId, shapeData);
}
export function deleteCelShape(cel, shapeId) {
    return celOp('deleteShape', cel, shapeId);
}

/**
 * Shifts all the contents (chars/colors) of a cel.
 * @param {Object} cel - The cel to affect
 * @param {number} rowOffset - How many rows to shift (can be negative)
 * @param {number} colOffset - How many columns to shift content (can be negative)
 * @param {boolean} [wrap=false] - If true, shifting content past the cel boundaries will wrap it around to the other side
 */
export function translateCel(cel, rowOffset, colOffset, wrap = false) {
    return celOp('translate', cel, rowOffset, colOffset, wrap)
}
export function resizeCel(cel, newDimensions, rowOffset, colOffset) {
    return celOp('resize', cel, newDimensions, rowOffset, colOffset)
}
export function convertCelToMonochrome(cel) {
    return celOp('convertToMonochrome', cel);
}
export function updateCelColorIndexes(cel, callback) {
    return celOp('updateColorIndexes', cel, callback)
}
export function colorSwapCel(cel, oldColorIndex, newColorIndex) {
    return celOp('colorSwap', cel, oldColorIndex, newColorIndex);
}
export function setCelGlyph(cel, row, col, char, color) {
    return celOp('setGlyph', cel, row, col, char, color);
}
export function encodeCel(cel, req16BitColors) {
    return celOp('encode', cel, req16BitColors);
}
export function decodeCel(cel, celRowLength, req16BitColors) {
    return celOp('decode', cel, celRowLength, req16BitColors)
}
