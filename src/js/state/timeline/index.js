/**
 * Timeline state manages:
 * - layers
 * - frames
 * - cels
 */

import * as frameController from './frames.js';
import * as layerController from './layers.js';
import * as celController from './cels.js';
import ArrayRange, {create2dArray, mergeGlyphs, translateGlyphs} from "../../utils/arrays.js";
import {numCols, numRows} from "../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {LAYER_TYPES} from "../constants.js";

export function deserialize(data = {}, options = {}) {
    layerController.deserialize(data.layerController, options);
    frameController.deserialize(data.frameController, options);
    celController.deserialize(data.celController, options); // note: must come after config load, since it depends on dimensions

    if (!options.replace) {
        validate();
        celController.vacuumColorTable();
    }
}
export function serialize(options = {}) {
    return {
        layerController: layerController.serialize(options),
        frameController: frameController.serialize(options),
        celController: celController.serialize(options),
    }
}

function validate() {
    // Ensures all the cels referenced by frames/layers exist, and prunes any unused cels.
    // This should only be needed if the file was manually modified outside the app.
    const usedCelIds = new Set();
    frameController.frames().forEach(frame => {
        layerController.layers().forEach(layer => {
            const celId = celController.getCelId(layer.id, frame.id);
            if (!celController.cel(layer, frame)) {
                console.warn(`No cel found for (${celId}) -- inserting blank cel`)
                celController.createCel(layer, frame);
            }
            usedCelIds.add(celId)
        })
    })
    celController.iterateAllCelIds(celId => {
        if (!usedCelIds.has(celId)) {
            console.warn(`Cel (${celId}) is unused in frames/layers -- deleting cel`)
            celController.deleteCel(celId)
        }
    })

    if (layerController.layers().length === 0) {
        console.warn(`No layers found; creating new layer`)
        createLayer(0)
    }
    if (frameController.frames().length === 0) {
        console.warn(`No frames found; creating new frame`)
        createFrame(0)
    }
}

export function newRasterCelTimeline(celContent = {}) {
    return {
        layerController: {
            layers: [{ id: 1, name: 'Layer 1', type: LAYER_TYPES.RASTER }]
        },
        frameController: {
            frames: [{ id: 1 }]
        },
        celController: {
            cels: {
                [celController.getCelId(1, 1)]: $.extend({}, {
                    id: celController.getCelId(1, 1),
                    layerType: LAYER_TYPES.RASTER
                }, celContent)
            }
        }
    }
}
export function newVectorCelTimeline(celContent = {}) {
    return {
        layerController: {
            layers: [{ id: 1, name: 'Layer 1', type: LAYER_TYPES.VECTOR }]
        },
        frameController: {
            frames: [{ id: 1 }]
        },
        celController: {
            cels: {
                [celController.getCelId(1, 1)]: $.extend({}, {
                    id: celController.getCelId(1, 1),
                    layerType: LAYER_TYPES.VECTOR
                }, celContent)
            }
        }
    }
}

export function convertToDrawing() {
    // Delete all but the first frame
    const numFrames = frameController.frames().length;
    if (numFrames > 1) deleteFrames(new ArrayRange(1, numFrames - 1))

    frameController.frameRangeSelection(null);
    frameController.changeFrameIndex(0);
}

// --------------------------------------------------------------------------- Frames API
export {
    frames as frames, frameIndex, changeFrameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame,
    previousFrame, reorderFrames, reverseFrames, updateFrame, expandedFrames,
    TICKS_OPTIONS
} from './frames.js'

export function createFrame(index, data) {
    const frame = frameController.createFrame(index, data);

    // create blank cels for all layers
    layerController.layers().forEach(layer => celController.createCel(layer, frame));
}

export function duplicateFrames(range) {
    frameController.duplicateFrames(range).forEach(({ originalFrame, dupFrame }) => {
        layerController.layers().forEach(layer => {
            const originalCel = celController.cel(layer, originalFrame);
            celController.duplicateCel(layer, dupFrame, originalCel);
        });
    })
}

export function deleteFrames(range) {
    range.iterate(frameIndex => {
        celIdsForFrame(frameController.frames()[frameIndex]).forEach(celId => celController.deleteCel(celId));
    });

    frameController.deleteFrames(range)
}


// --------------------------------------------------------------------------- Layers API
export {
    layers as layers, layerAt, layerIndex, changeLayerIndex, currentLayer, currentLayerType, reorderLayer,
    nextLayerName, toggleLayerVisibility
} from './layers.js'

export function createLayer(index, data) {
    const layer = layerController.createLayer(index, data);

    // create blank cels for all frames
    frameController.frames().forEach(frame => celController.createCel(layer, frame));
}

export function updateLayer(layer, updates) {
    if (layer.type !== updates.type) {
        // Special handling when changing layer type:
        if (updates.type === LAYER_TYPES.VECTOR) throw new Error(`Cannot change layerType to vector`)
        if (updates.type === LAYER_TYPES.RASTER) celIdsForLayer(layer).forEach(celId => celController.rasterizeCel(celId));
    }

    layerController.updateLayer(layer, updates)
}

export function deleteLayer(index) {
    celIdsForLayer(layerController.layerAt(index)).forEach(celId => celController.deleteCel(celId));
    layerController.deleteLayer(index);
}


// --------------------------------------------------------------------------- Cels API

export {
    hasCharContent, setCelGlyph, charInBounds, translateCel,
    colorTable, colorStr, vacuumColorTable, colorIndex, primaryColorIndex,
    resize, convertToMonochrome
} from './cels.js'

function currentCel() {
    return celController.cel(layerController.currentLayer(), frameController.currentFrame());
}

function celIdsForLayer(layer) {
    return frameController.frames().map(frame => celController.getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentLayer(callback) {
    celIdsForLayer(layerController.currentLayer()).forEach(celId => callback(celController.cel(celId)));
}

function celIdsForFrame(frame) {
    return layerController.layers().map(layer => celController.getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentFrame(callback) {
    celIdsForFrame(frameController.currentFrame()).forEach(celId => callback(celController.cel(celId)));
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
        celController.iterateAllCels(celCallback);
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
    if (!celController.charInBounds(row, col)) return [];

    const celGlyphs = celController.getCelGlyphs(currentCel());
    return [celGlyphs.chars[row][col], celGlyphs.colors[row][col]];
}

// If the char or color parameter is undefined, that parameter will not be overridden
export function setCurrentCelGlyph(row, col, char, color) {
    celController.setCelGlyph(currentCel(), row, col, char, color);
}

export function getCurrentCelShapes() {
    return celController.getCelShapes(currentCel());
}
export function getCurrentCelShape(shapeId) {
    return celController.getCelShape(currentCel(), shapeId);
}
export function addCurrentCelShape(shape) {
    celController.addCelShape(currentCel(), shape)
}
export function updateCurrentCelShape(shapeId, updater) {
    celController.updateCelShape(currentCel(), shapeId, updater);
}
export function deleteCurrentCelShape(shapeId) {
    celController.deleteCelShape(currentCel(), shapeId);
}
export function reorderCurrentCelShapes(shapeIds, action) {
    celController.reorderCelShapes(currentCel(), shapeIds, action)
}
export function canReorderCurrentCelShapes(shapeIds, action) {
    return celController.canReorderCelShapes(currentCel(), shapeIds, action);
}

export function getCurrentCelShapeIdsAbove(shapeId) {
    return currentCel().getShapeIdsAbove(shapeId);
}
export function testCurrentCelShapeHitboxes(cell, forShapeIds) {
    return currentCel().testShapeHitboxes(cell, forShapeIds);
}
export function testCurrentCelMarquee(cellArea) {
    return currentCel().testMarquee(cellArea)
}

/**
 * Aggregates multiple layers into a final result. Chars on lower layers will be blocked if higher layers also have
 * a char at that spot.
 * @param {Object} frame - The frame to process
 * @param {Object} options Layering options:
 * @param {Object[]} [options.layers] - Array of Layers to include. If not provided, all layers will be included. If
 *   it is provided, the array will be further filtered to only include `visible` layers.
 * @param {Object} [options.offset] - Object containing information about how much to offset all the content
 * @param {Object} [options.movableContent] - If provided, the content will be drawn on top of the current layer
 * @param {Object} [options.drawingContent] - If provided, the content will be drawn on top of the current layer
 * @param {boolean} [options.convertEmptyStrToSpace] - If true, EMPTY_CHAR will be converted to WHITESPACE_CHAR
 * @returns {{chars: string[][], colors: number[][]}|null} - Aggregated 2d arrays of chars and color indexes. Will be
 *   null if the layers option is provided and there are no valid layers.
 */
export function layeredGlyphs(frame, options = {}) {
    const layerIds = options.layers ? new Set(options.layers.filter(layer => layer.visible).map(layer => layer.id)) : null;
    if (layerIds && layerIds.size === 0) return null; // Short circuit

    const chars = create2dArray(numRows(), numCols(), EMPTY_CHAR);
    const colors = create2dArray(numRows(), numCols(), 0);

    let l, layer, isCurrentLayer, celChars, celColors, celR, celC, r, c;
    const isCurrentFrame = frame.id === frameController.currentFrame().id;

    for (l = 0; l < layerController.layers().length; l++) {
        layer = layerController.layerAt(l);
        isCurrentLayer = l === layerController.layerIndex();

        if (layerIds && !layerIds.has(layer.id)) continue;

        const glyphs = celController.getCelGlyphs(celController.cel(layer, frame));
        celChars = glyphs.chars;
        celColors = glyphs.colors;
        const offset = options.offset && options.offset.amount;

        for (celR = 0; celR < celChars.length; celR++) {
            for (celC = 0; celC < celChars[celR].length; celC++) {
                if (celChars[celR][celC] === EMPTY_CHAR) continue;

                r = celR;
                c = celC;

                if (offset && (options.offset.modifiers.allLayers || isCurrentLayer)) {
                    ({ r, c } = celController.getOffsetPosition(celR, celC, offset[0], offset[1], options.offset.modifiers.wrap));
                    if (!celController.charInBounds(r, c)) continue;
                }

                chars[r][c] = celChars[celR][celC];
                colors[r][c] = celColors[celR][celC];
            }
        }

        // If there is movableContent, show it on top of the rest of the layer
        if (options.movableContent && options.movableContent.glyphs && isCurrentLayer && isCurrentFrame) {
            mergeGlyphs({ chars, colors }, options.movableContent.glyphs, options.movableContent.origin, (char, color) => {
                return char !== undefined && char !== EMPTY_CHAR;
            })
        }

        // If there is drawingContent (e.g. drawing a line out of chars), show it on top of the rest of the layer
        if (options.drawingContent && isCurrentLayer && isCurrentFrame) {
            // todo vector drawings can't use this because they need EMPTY_CHAR to not override (so it's consistent
            //      with vector_cel mergeGlyphs). To reproduce problem, in a vector layer try drawing an empty
            //      ellipse over a background. It will block background until you finish shape, then it is unblocking.
            //      Possible solutions: vectors don't use drawingContent; just addShape and updateShape immediately
            //      Or, do something here based on vector layer type
            mergeGlyphs({ chars, colors }, options.drawingContent.glyphs, options.drawingContent.origin);
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
        celController.colorSwapCel(cel, oldColorIndex, newColorIndex);
    });
}
