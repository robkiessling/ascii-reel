/**
 * Timeline state manages:
 * - layers
 * - frames
 * - cels
 */

import * as frameData from './frames.js';
import * as layerData from './layers.js';
import * as celData from './cels.js';
import {ArrayRange, create2dArray, mergeGlyphs} from "../../utils/arrays.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {LAYER_TYPES} from "../constants.js";
import CellArea from "../../geometry/cell_area.js";

export function deserialize(data = {}, options = {}) {
    layerData.deserialize(data.layerData, options);
    frameData.deserialize(data.frameData, options);
    celData.deserialize(data.celData, options); // note: must come after config load, since it depends on dimensions

    if (!options.replace) {
        validate();
    }
}
export function serialize(options = {}) {
    return {
        layerData: layerData.serialize(options),
        frameData: frameData.serialize(options),
        celData: celData.serialize(options),
    }
}

function validate() {
    // Ensures all the cels referenced by frames/layers exist, and prunes any unused cels.
    // This should only be needed if the file was manually modified outside the app.
    const usedCelIds = new Set();
    frameData.frames().forEach(frame => {
        layerData.layers().forEach(layer => {
            const celId = celData.getCelId(layer.id, frame.id);
            if (!celData.cel(layer, frame)) {
                console.warn(`No cel found for (${celId}) -- inserting blank cel`)
                celData.createCel(layer, frame);
            }
            usedCelIds.add(celId)
        })
    })
    celData.iterateAllCelIds(celId => {
        if (!usedCelIds.has(celId)) {
            console.warn(`Cel (${celId}) is unused in frames/layers -- deleting cel`)
            celData.deleteCel(celId)
        }
    })

    if (layerData.layers().length === 0) {
        console.warn(`No layers found; creating new layer`)
        createLayer(0)
    }
    if (frameData.frames().length === 0) {
        console.warn(`No frames found; creating new frame`)
        createFrame(0)
    }
}

export function newRasterCelTimeline(celContent = {}) {
    return {
        layerData: {
            layers: [{ id: 1, name: 'Layer 1', type: LAYER_TYPES.RASTER }]
        },
        frameData: {
            frames: [{ id: 1 }]
        },
        celData: {
            cels: {
                [celData.getCelId(1, 1)]: $.extend({}, {
                    id: celData.getCelId(1, 1),
                    layerType: LAYER_TYPES.RASTER
                }, celContent)
            }
        }
    }
}
export function newVectorCelTimeline(celContent = {}) {
    return {
        layerData: {
            layers: [{ id: 1, name: 'Layer 1', type: LAYER_TYPES.VECTOR }]
        },
        frameData: {
            frames: [{ id: 1 }]
        },
        celData: {
            cels: {
                [celData.getCelId(1, 1)]: $.extend({}, {
                    id: celData.getCelId(1, 1),
                    layerType: LAYER_TYPES.VECTOR
                }, celContent)
            }
        }
    }
}

export function convertToDrawing() {
    // Delete all but the first frame
    const numFrames = frameData.frames().length;
    if (numFrames > 1) deleteFrames(new ArrayRange(1, numFrames - 1))

    frameData.frameRangeSelection(null);
    frameData.changeFrameIndex(0);
}

// --------------------------------------------------------------------------- Frames API
export {
    frames as frames, frameIndex, changeFrameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame,
    previousFrame, reorderFrames, reverseFrames, updateFrame, expandedFrames,
    TICKS_OPTIONS
} from './frames.js'

export function createFrame(index, data) {
    const frame = frameData.createFrame(index, data);

    // create blank cels for all layers
    layerData.layers().forEach(layer => celData.createCel(layer, frame));
}

export function duplicateFrames(range) {
    frameData.duplicateFrames(range).forEach(({ originalFrame, dupFrame }) => {
        layerData.layers().forEach(layer => {
            const originalCel = celData.cel(layer, originalFrame);
            celData.duplicateCel(layer, dupFrame, originalCel);
        });
    })
}

export function deleteFrames(range) {
    range.iterate(frameIndex => {
        celIdsForFrame(frameData.frames()[frameIndex]).forEach(celId => celData.deleteCel(celId));
    });

    frameData.deleteFrames(range)
}


// --------------------------------------------------------------------------- Layers API
export {
    layers as layers, layerAt, layerIndex, changeLayerIndex, currentLayer, currentLayerType, reorderLayer,
    nextLayerName, toggleLayerVisibility
} from './layers.js'

export function createLayer(index, data) {
    const layer = layerData.createLayer(index, data);

    // create blank cels for all frames
    frameData.frames().forEach(frame => celData.createCel(layer, frame));


}

export function updateLayer(layer, updates) {
    if (layer.type !== updates.type) {
        // Special handling when changing layer type:
        if (updates.type === LAYER_TYPES.VECTOR) throw new Error(`Cannot change layerType to vector`)
        if (updates.type === LAYER_TYPES.RASTER) celIdsForLayer(layer).forEach(celId => celData.rasterizeCel(celId));
    }

    layerData.updateLayer(layer, updates)
}

export function deleteLayer(index) {
    celIdsForLayer(layerData.layerAt(index)).forEach(celId => celData.deleteCel(celId));
    layerData.deleteLayer(index);
}


// --------------------------------------------------------------------------- Cels API

export {
    hasCharContent, setCelGlyph, isCellInBounds, translateCel, resize, convertToMonochrome
} from './cels.js'

function currentCel() {
    return celData.cel(layerData.currentLayer(), frameData.currentFrame());
}

function celIdsForLayer(layer) {
    return frameData.frames().map(frame => celData.getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentLayer(callback) {
    celIdsForLayer(layerData.currentLayer()).forEach(celId => callback(celData.cel(celId)));
}

function celIdsForFrame(frame) {
    return layerData.layers().map(layer => celData.getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentFrame(callback) {
    celIdsForFrame(frameData.currentFrame()).forEach(celId => callback(celData.cel(celId)));
}

/**
 * Iterates through cels. Which cels are iterated over depends on the allLayers and allFrames params.
 * @param {Boolean} allLayers - If true, will include cels across all layers. If false, just includes cels for current layer.
 * @param {Boolean} allFrames - If true, will include cels across all frames. If false, just includes cels for current frame.
 * @param {function(Object)} celCallback - Callback called for each cel being iterated over
 */
export function iterateCels(allLayers, allFrames, celCallback) {
    if (allLayers && allFrames) {
        // Apply to all cels
        celData.iterateAllCels(celCallback);
    }
    else if (!allLayers && allFrames) {
        // Apply to all frames of a single layer
        iterateCelsForCurrentLayer(celCallback);
    }
    else if (allLayers && !allFrames) {
        // Apply to all layers (of a single frame)
        iterateCelsForCurrentFrame(celCallback);
    }
    else {
        // Apply to current cel
        celCallback(currentCel());
    }
}

// This function returns the glyph as a 2d array: [char, color]
export function getCurrentCelGlyph(row, col) {
    if (!celData.isCellInBounds({row, col})) return [];

    const celGlyphs = celData.getCelGlyphs(currentCel());
    return [celGlyphs.chars[row][col], celGlyphs.colors[row][col]];
}

export function setCurrentCelGlyph(...args) { return celData.setCelGlyph(currentCel(), ...args) }
export function getCurrentCelShapes() { return celData.getCelShapes(currentCel()) }
export function getCurrentCelShape(...args) { return celData.getCelShape(currentCel(), ...args) }
export function currentCelShapeExists(...args) { return celData.celShapeExists(currentCel(), ...args) }
export function addCurrentCelShape(...args) { return celData.addCelShape(currentCel(), ...args) }
export function updateCurrentCelShape(...args) { return celData.updateCelShape(currentCel(), ...args) }
export function deleteCurrentCelShape(...args) { return celData.deleteCelShape(currentCel(), ...args) }
export function outOfBoundsCurrentCelShapes() { return celData.outOfBoundsCelShapes(currentCel()) }
export function reorderCurrentCelShapes(...args) { return celData.reorderCelShapes(currentCel(), ...args) }
export function canReorderCurrentCelShapes(...args) { return celData.canReorderCelShapes(currentCel(), ...args) }
export function getCurrentCelShapeIdsAbove(...args) { return currentCel().getShapeIdsAbove(...args) }
export function testCurrentCelHandles(...args) { return currentCel().testHandles(...args) }
export function testCurrentCelMarquee(...args) { return currentCel().testMarquee(...args) }

/**
 * Aggregates multiple layers into a final result. Chars on lower layers will be blocked if higher layers also have
 * a char at that spot.
 * @param {Object} frame - The frame to process
 * @param {Object} options Layering options:
 * @param {Object[]} [options.layers] - Array of Layers to include. If not provided, all layers will be included. If
 *   it is provided, the array will be further filtered to only include `visible` layers.
 * @param {{row: number, col: number}} [options.offset] - Object containing information about how much to offset all the content
 * @param {Object} [options.movableContent] - If provided, the content will be drawn on top of the current layer
 * @param {Object} [options.drawingContent] - If provided, the content will be drawn on top of the current layer
 * @param {boolean} [options.convertEmptyStrToSpace=false] - If true, EMPTY_CHAR will be converted to WHITESPACE_CHAR
 * @param {CellArea} [options.viewport] - If provided, limits glyph calculation to the specified CellArea instead of
 *   the full drawable area. This improves performance when rendering only part of the drawing, since less merging of
 *   2D arrays is required. Default: the full drawable area.
 *   Note: When using a viewport, you must render the resulting 2D arrays offset by the viewport's origin.
 * @returns {{chars: string[][], colors: number[][]}|null} - Aggregated 2d arrays of chars and color indexes. Will be
 *   null if the layers option is provided and there are no valid layers.
 */
export function layeredGlyphs(frame, options = {}) {
    const layerIds = options.layers ? new Set(options.layers.map(layer => layer.id)) : null;
    if (layerIds && layerIds.size === 0) return null; // Short circuit

    const viewport = options.viewport ? options.viewport : CellArea.drawableArea();

    const chars = create2dArray(viewport.numRows, viewport.numCols, EMPTY_CHAR);
    const colors = create2dArray(viewport.numRows, viewport.numCols, 0);

    // When a viewport is active, we need to offset glyphs from cels, drawingContent, etc. in the opposite direction
    // of the viewport. Those glyphs are positioned in absolute coordinates (relative to the full drawing's origin at
    // 0,0), but the merged result starts at the viewport's top-left corner. Inverting the viewport offset realigns the
    // global glyphs into the local viewport space.
    const viewportOffset = viewport.topLeft.clone().invert();

    let l, layer, isCurrentLayer, r, c;
    const isCurrentFrame = frame.id === frameData.currentFrame().id;

    for (l = 0; l < layerData.layers().length; l++) {
        layer = layerData.layerAt(l);
        isCurrentLayer = l === layerData.layerIndex();

        if (layerIds && !layerIds.has(layer.id)) continue;

        // Merge in standard cel content. Offsets are handled slightly differently for raster vs. vector layers.
        const offset = options.offset && options.offset.amount && (options.offset.modifiers.allLayers || isCurrentLayer)
            ? options.offset.amount : { row: 0, col: 0 };
        switch (layer.type) {
            case LAYER_TYPES.RASTER:
                // For raster layers, we calculate cel glyphs without an offset, then merge them into result using offset
                const rasterGlyphs = celData.getCelGlyphs(celData.cel(layer, frame));
                mergeGlyphs({ chars, colors }, rasterGlyphs, viewportOffset.clone().add(offset));
                break;
            case LAYER_TYPES.VECTOR:
                // For vector layers, the cel glyphs must be calculated using the offset (cannot add it in post like
                // raster layers). This is required because vector shapes can go beyond borders, so when we offset
                // them (e.g. during a move) we need that outside content to appear in the canvas.
                const vectorGlyphs = celData.getCelGlyphs(celData.cel(layer, frame), offset);
                mergeGlyphs({ chars, colors }, vectorGlyphs, viewportOffset.clone());
                break;
            default:
                throw new Error(`Invalid layer type: ${layer.type}`)
        }

        // If there is movableContent, show it on top of the rest of the layer
        if (options.movableContent && options.movableContent.glyphs && isCurrentLayer && isCurrentFrame) {
            mergeGlyphs({ chars, colors }, options.movableContent.glyphs, viewportOffset.clone().add(options.movableContent.origin))
        }

        // If there is drawingContent (e.g. drawing a line out of chars), show it on top of the rest of the layer
        if (options.drawingContent && isCurrentLayer && isCurrentFrame) {
            const { glyphs: drawGlyphs, origin: drawOrigin } = options.drawingContent.rasterize();
            mergeGlyphs({ chars, colors }, drawGlyphs, viewportOffset.clone().add(drawOrigin), options.drawingContent.writeEmptyChars);
        }

        if (options.convertEmptyStrToSpace) {
            for (r = 0; r < chars.length; r++) {
                for (c = 0; c < chars[r].length; c++) {
                    if (chars[r][c] === EMPTY_CHAR) {
                        chars[r][c] = WHITESPACE_CHAR;
                        // colors[r][c] will be left at default (0)
                    }
                }
            }
        }
    }

    return { chars, colors }
}

export function colorSwap(oldColorIndex, newColorIndex, options = {}) {
    iterateCels(options.allLayers, options.allFrames, cel => {
        celData.colorSwapCel(cel, oldColorIndex, newColorIndex);
    });
}
