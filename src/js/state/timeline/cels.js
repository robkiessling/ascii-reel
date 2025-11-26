
import {isObject, transformValues} from "../../utils/objects.js";
import {numCols, numRows, getConfig, setConfig, getDrawingColor} from "../config.js";
import {mod} from "../../utils/numbers.js";
import {colorIndex, isNewColor} from "../palette.js";
import CelFactory from "./cel/factory.js";
import {LAYER_TYPES} from "../../config/timeline.js";
import RasterCel from "./cel/raster.js";
import {eventBus, EVENTS} from "../../events/events.js";

export function getCelGlyphs(cel, ...args) { return cel.glyphs(...args) }
export function setCelGlyph(cel, ...args) { return cel.setGlyph(...args) }
export function translateCel(cel, ...args) { return cel.translate(...args) }
export function colorSwapCel(cel, ...args) { return cel.colorSwap(...args) }

export function getCelShapes(cel) { return cel.shapes(); }
export function getCelShape(cel, ...args) { return cel.getShape(...args) }
export function celShapeExists(cel, ...args) { return cel.shapeExists(...args) }
export function addCelShape(cel, ...args) { return cel.addShape(...args) }
export function updateCelShape(cel, ...args) { return cel.updateShape(...args) }
export function deleteCelShape(cel, ...args) { return cel.deleteShape(...args) }
export function outOfBoundsCelShapes(cel) { return cel.outOfBoundsShapes() }
export function reorderCelShapes(cel, ...args) { return cel.reorderShapes(...args) }
export function canReorderCelShapes(cel, ...args) { return cel.canReorderShapes(...args) }

const DEFAULT_STATE = {
    cels: {},
}

let state = {};

export function deserialize(data = {}, options = {}) {
    // Not using options.replace short circuit here -- we cannot replace state by reference; we always need to
    // deserialize each Cel. However, options.replace does get passed to CelFactory.deserialize to skip normalization.

    state = $.extend(true, {}, DEFAULT_STATE, data);

    if (data.cels) state.cels = transformValues(data.cels, (celId, cel) => CelFactory.deserialize(cel, options))
}

export function serialize(options = {}) {
    return {
        cels: transformValues(state.cels, (celId, cel) => cel.serialize(options)),
    }
}

export function createCel(layer, frame) {
    const celId = getCelId(layer.id, frame.id);
    state.cels[celId] = CelFactory.blank(layer.type);
}

export function duplicateCel(toLayer, toFrame, originalCel) {
    const celId = getCelId(toLayer.id, toFrame.id);
    state.cels[celId] = CelFactory.deserialize(structuredClone(originalCel.serialize()));
}

export function deleteCel(celId) {
    delete state.cels[celId]
}

export function rasterizeCel(celId) {
    const vectorCel = cel(celId);
    if (vectorCel.layerType !== LAYER_TYPES.VECTOR) throw new Error(`Cannot rasterize ${celId} - it is not a vector cel`)
    const { chars, colors } = vectorCel.glyphs();
    state.cels[celId] = new RasterCel(chars, colors);
}

/**
 * Returns the cel for either a celId or a layer & frame combination.
 * @param {string|Object} celIdOrLayer - Can be a celId string or a Layer object. If it is a celId string, simply returns
 *   the cel for that given id. If it is a Layer object, must also provide a Frame object as second parameter. The cel
 *   for that given layer & frame is returned.
 * @param {Object} [frame] - Frame object (only applicable if celIdOrLayer was a Layer object)
 * @returns {RasterCel|VectorCel} - The cel at the given layer/frame
 */
export function cel(celIdOrLayer, frame) {
    if (arguments.length === 1 && typeof celIdOrLayer === 'string') {
        return state.cels[celIdOrLayer];
    }
    else if (arguments.length === 2 && isObject(celIdOrLayer) && isObject(frame)) {
        return state.cels[getCelId(celIdOrLayer.id, frame.id)];
    }
    else {
        throw new Error(`Invalid cel() call, arguments: ${arguments}`)
    }
}

export function getCelId(layerId, frameId) {
    return `F-${frameId},L-${layerId}`;
}

export function iterateAllCelIds(callback) {
    for (const celId of Object.keys(state.cels)) {
        callback(celId);
    }
}

export function iterateAllCels(callback) {
    for (const cel of Object.values(state.cels)) {
        callback(cel);
    }
}

export function isCellInBounds(cell) {
    return cell.row >= 0 && cell.row < numRows() && cell.col >= 0 && cell.col < numCols();
}

export function getOffsetPosition(row, col, rowOffset, colOffset, wrap) {
    row += rowOffset;
    col += colOffset;

    if (wrap) {
        row = mod(row, numRows());
        col = mod(col, numCols());
    }

    return { row, col }
}


export function convertToMonochrome() {
    iterateAllCels(cel => cel.convertToMonochrome())
}

/**
 * Returns true if any cels have non-blank characters
 * @param {string} [matchingColor=undefined] If provided, the non-blank character has to also match this color value
 * @returns {boolean}
 */
export function hasCharContent(matchingColor) {
    let matchingColorIndex;
    if (matchingColor !== undefined) {
        matchingColorIndex = isNewColor(matchingColor) ? -1 : colorIndex(matchingColor);
    }

    // Not using iterateAllCels so we can terminate early
    for (const cel of Object.values(state.cels)) {
        if (cel.hasContent(matchingColorIndex)) return true;
    }

    return false;
}



// -------------------------------------------------------------------------------- Resizing Canvas

/**
 * Resizes the canvas dimensions. If the canvas shrinks, all content outside of the new dimensions will be truncated.
 * @param {[number, number]} newDimensions - An array representing [num rows, num cols] of the new dimensions
 * @param {number|'top'|'middle'|'bottom'} rowOffset - If an integer is provided, it will determine the starting row
 *   for the content in the new dimensions. Alternatively, a string 'top'/'middle'/'bottom' can be given to anchor the
 *   content to the top, middle, or bottom row in the new dimensions.
 * @param {number|'top'|'middle'|'bottom'} colOffset - Same definition as rowOffset, but for the column.
 */
export function resize(newDimensions, rowOffset, colOffset) {
    switch(rowOffset) {
        case 'top':
            rowOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            rowOffset = newDimensions[0] > numRows() ?
                Math.ceil((numRows() - newDimensions[0]) / 2) :
                Math.floor((numRows() - newDimensions[0]) / 2)
            break;
        case 'bottom':
            rowOffset = numRows() - newDimensions[0];
            break;
    }

    switch(colOffset) {
        case 'left':
            colOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            colOffset = newDimensions[1] > numCols() ?
                Math.ceil((numCols() - newDimensions[1]) / 2) :
                Math.floor((numCols() - newDimensions[1]) / 2)
            break;
        case 'right':
            colOffset = numCols() - newDimensions[1];
            break;
    }

    iterateAllCels(cel => cel.resize(newDimensions, rowOffset, colOffset));

    setConfig('dimensions', newDimensions);
}

