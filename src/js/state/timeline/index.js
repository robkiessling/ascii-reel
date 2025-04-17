/**
 * Timeline state manages:
 * - layers
 * - frames
 * - cels
 */

import * as cels from './cels.js';
import * as frames from './frames.js';
import * as layers from './layers.js';
import {create2dArray, translateGlyphs} from "../../utils/arrays.js";
import {numCols, numRows, getConfig} from "../config.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";


export function load(data = {}) {
    layers.load(data.layers);
    frames.load(data.frames);
    cels.load(data.cels); // must come after config load, since it depends on dimensions
}

export function getState() {
    return {
        layers: layers.getState(),
        frames: frames.getState(),
        cels: cels.getState(),
    }
}

export function encodeState() {
    return {
        layers: layers.getState(),
        frames: frames.getState(),
        cels: cels.encodeState()
    }
}

export function decodeState(encodedState, celRowLength) {
    return {
        layers: encodedState.layers,
        frames: encodedState.frames,
        cels: cels.decodeState(encodedState.cels, celRowLength),
    }
}

export function replaceState(newState) {
    layers.replaceState(newState.layers);
    frames.replaceState(newState.frames);
    cels.replaceState(newState.cels);
}


export function validate() {
    // Ensures all the cels referenced by frames/layers exist, and prunes any unused cels.
    // This should only be needed if the file was manually modified outside the app.
    const usedCelIds = new Set();
    frames.frames().forEach(frame => {
        layers.layers().forEach(layer => {
            const celId = cels.getCelId(layer.id, frame.id);
            if (!cels.cel(layer, frame)) {
                console.warn(`No cel found for (${celId}) -- inserting blank cel`)
                cels.createCel(layer, frame);
            }
            usedCelIds.add(celId)
        })
    })
    cels.iterateAllCelIds(celId => {
        if (!usedCelIds.has(celId)) {
            console.warn(`Cel (${celId}) is unused in frames/layers -- deleting cel`)
            cels.deleteCel(celId)
        }
    })

    if (layers.layers().length === 0) {
        console.warn(`No layers found; creating new layer`)
        createLayer(0)
    }
    if (frames.frames().length === 0) {
        console.warn(`No frames found; creating new frame`)
        createFrame(0)
    }
}

export function newBlankState() {
    return {
        layers: {
            layers: [{ id: 1, name: 'Layer 1' }]
        },
        frames: {
            frames: [{ id: 1 }]
        },
        cels: {
            cels: {
                [cels.getCelId(1, 1)]: {}
            }
        }
    }
}

// --------------------------------------------------------------------------- Frames API
export {
    frames as frames, frameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame,
    previousFrame, reorderFrames, reverseFrames
} from './frames.js'

export function createFrame(index, data) {
    const frame = frames.createFrame(index, data);

    // create blank cels for all layers
    layers.layers().forEach(layer => cels.createCel(layer, frame));
}

export function duplicateFrames(range) {
    frames.duplicateFrames(range).forEach(({ originalFrame, dupFrame }) => {
        layers.layers().forEach(layer => {
            const originalCel = cels.cel(layer, originalFrame);
            cels.createCel(layer, dupFrame, originalCel);
        });
    })
}

export function deleteFrames(range) {
    range.iterate(frameIndex => {
        celIdsForFrame(frames.frameAt(frameIndex)).forEach(celId => cels.deleteCel(celId));
    });

    frames.deleteFrames(range)
}


// --------------------------------------------------------------------------- Layers API
export {
    layers as layers, layerIndex, currentLayer, updateLayer, reorderLayer, toggleLayerVisibility
} from './layers.js'

export function createLayer(index, data) {
    const layer = layers.createLayer(index, data);

    // create blank cels for all frames
    frames.frames().forEach(frame => cels.createCel(layer, frame));
}

export function deleteLayer(index) {
    celIdsForLayer(layers.layerAt(index)).forEach(celId => cels.deleteCel(celId));
    layers.deleteLayer(index);
}


// --------------------------------------------------------------------------- Cels API

export {
    hasCharContent, iterateCellsForCel, setCelGlyph, charInBounds, translateCel,
    colorTable, colorStr, vacuumColorTable, colorIndex, primaryColorIndex,
    resize
} from './cels.js'

function currentCel() {
    return cels.cel(layers.currentLayer(), frames.currentFrame());
}

function celIdsForLayer(layer) {
    return frames.frames().map(frame => cels.getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentLayer(callback) {
    celIdsForLayer(layers.currentLayer()).forEach(celId => callback(cels.cel(celId)));
}

function celIdsForFrame(frame) {
    return layers.layers().map(layer => cels.getCelId(layer.id, frame.id));
}

export function iterateCelsForCurrentFrame(callback) {
    celIdsForFrame(frames.currentFrame()).forEach(celId => callback(cels.cel(celId)));
}

/**
 * Iterates through cels. Which cels are iterated over depends on the allLayers and allFrames params.
 * @param {Boolean} allLayers - If true, will include cels across all layers. If false, just includes cels for current layer.
 * @param {Boolean} allFrames - If true, will include cels across all frames. If false, just includes cels for current frame.
 * @param {function(cel)} celCallback - Callback called for each cel being iterated over
 */
export function iterateCels(allLayers, allFrames, celCallback) {
    if (allLayers && allFrames) {
        // Apply to all cels
        cels.iterateAllCels(celCallback);
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
    return cels.charInBounds(row, col) ? [currentCel().chars[row][col], currentCel().colors[row][col]] : [];
}

// If the char or color parameter is undefined, that parameter will not be overridden
export function setCurrentCelGlyph(row, col, char, color) {
    cels.setCelGlyph(currentCel(), row, col, char, color);
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

    for (l = 0; l < layers.layers().length; l++) {
        layer = layers.layerAt(l);
        isCurrentLayer = l === layers.layerIndex();

        if (layerIds && !layerIds.has(layer.id)) continue;

        celChars = cels.cel(layer, frame).chars;
        celColors = cels.cel(layer, frame).colors;
        const offset = options.offset && options.offset.amount;

        for (celR = 0; celR < celChars.length; celR++) {
            for (celC = 0; celC < celChars[celR].length; celC++) {
                if (celChars[celR][celC] === EMPTY_CHAR) continue;

                r = celR;
                c = celC;

                if (offset && (options.offset.modifiers.allLayers || isCurrentLayer)) {
                    ({ r, c } = cels.getOffsetPosition(celR, celC, offset[0], offset[1], options.offset.modifiers.wrap));
                    if (!cels.charInBounds(r, c)) continue;
                }

                chars[r][c] = celChars[celR][celC];
                colors[r][c] = celColors[celR][celC];
            }
        }

        // If there is movableContent, show it on top of the rest of the layer
        if (options.movableContent && options.movableContent.glyphs && isCurrentLayer) {
            translateGlyphs(options.movableContent.glyphs, options.movableContent.origin, (r, c, char, color) => {
                if (char !== undefined && char !== EMPTY_CHAR && cels.charInBounds(r, c)) {
                    chars[r][c] = char;
                    colors[r][c] = color;
                }
            });
        }

        // If there is drawingContent (e.g. drawing a line out of chars), show it on top of the rest of the layer
        if (options.drawingContent && isCurrentLayer) {
            translateGlyphs(options.drawingContent.glyphs, options.drawingContent.origin, (r, c, char, color) => {
                if (char !== undefined && char !== EMPTY_CHAR && cels.charInBounds(r, c)) {
                    chars[r][c] = char;
                    colors[r][c] = color;
                }
            });
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
