import $ from "jquery";
import {create2dArray, eachWithObject, transformValues, translate} from "./utilities.js";
import * as selection from "./selection.js";
import {onStateLoaded} from "./index.js";

const CONFIG_DEFAULTS = {
    name: 'New Sprite',
    dimensions: [10, 5],
    fps: 0,
    onion: false,
    lockLayerVisibility: true,
    layerIndex: 0,
    frameIndex: 0,
    paletteIndex: 0,
    frameOrientation: 'left',
    tool: 'selection-rect'
}
const LAYER_DEFAULTS = {
    name: 'Layer',
    visible: true
}
const FRAME_DEFAULTS = {}
const CELL_DEFAULTS = {
    chars: [[]]
}
const SEQUENCES = ['layers', 'frames'];

export const COLOR_FORMAT = 'rgbaString'; // vanilla-picker format we store and display
export const DEFAULT_COLOR = 'rgba(0,0,0,255)';

let state;
let sequences;

export function loadNew() {
    load({
        layers: [{ id: 1 }],
        frames: [{ id: 1 }],
        cels: { '1,1': { chars: [[]] } }
    });
}

export function load(data) {
    state = {
        config: $.extend(true, {}, CONFIG_DEFAULTS, data.config), // todo ensure indices are in bounds
        layers: data.layers.map(layer => $.extend(true, {}, LAYER_DEFAULTS, layer)),
        frames: data.frames.map(frame => $.extend(true, {}, FRAME_DEFAULTS, frame)),
        colorTable: data.colorTable ? [...data.colorTable] : [],
        palettes: [] // todo import from settings? or does this get saved with file
    };

    state.cels = transformValues(data.cels || {}, (v) => normalizeCel(v));

    sequences = eachWithObject(SEQUENCES, {}, (className, obj) => {
        obj[className] = Math.max.apply(Math, state[className].map(e => e.id));
    });

    onStateLoaded();
}

export function stringify() {
    return JSON.stringify(state);
}

function vacuumColorTable() {
    // todo
}

export function numRows() {
    return state.config.dimensions[1];
}
export function numCols() {
    return state.config.dimensions[0];
}
export function layers() {
    return state.layers;
}
export function frames() {
    return state.frames;
}

export function config(key, newValue) {
    if (newValue !== undefined) { state.config[key] = newValue; }
    return state.config[key];
}

export function layerIndex(newIndex) {
    return config('layerIndex', newIndex);
}
export function frameIndex(newIndex) {
    return config('frameIndex', newIndex);
}

export function currentLayer() {
    return state.layers[layerIndex()];
}
export function currentFrame() {
    return state.frames[frameIndex()];
}
export function previousFrame() {
    let index = frameIndex();
    index -= 1;
    if (index < 0) { index = frames().length - 1; }
    return state.frames[index];
}
export function currentCel() {
    return cel(currentLayer(), currentFrame());
}
export function previousCel() {
    return cel(currentLayer(), previousFrame());
}

export function cel(layer, frame) {
    return state.cels[getCelId(layer.id, frame.id)];
}


function celIdsForLayer(layer) {
    return state.frames.map(frame => getCelId(layer.id, frame.id));
}
function celIdsForFrame(frame) {
    return state.layers.map(layer => getCelId(layer.id, frame.id));
}
function getCelId(layerId, frameId) {
    return `${layerId},${frameId}`;
}

export function createLayer(index, data) {
    const layer = $.extend({}, LAYER_DEFAULTS, {
        id: ++sequences.layers
    }, data);

    state.layers.splice(index, 0, layer);

    // create blank cels for all frames
    state.frames.forEach(frame => createCel(layer, frame));
}
export function deleteLayer(index) {
    const layer = state.layers[index];
    celIdsForLayer(layer).forEach(celId => delete state.cels[celId]);
    state.layers.splice(index, 1);
}
export function updateLayer(layer, updates) {
    $.extend(layer, updates);
}
export function reorderLayer(oldIndex, newIndex) {
    state.layers.splice(newIndex, 0, state.layers.splice(oldIndex, 1)[0]);
}
export function toggleLayerVisibility(layer) {
    layer.visible = !layer.visible;
}



export function createFrame(index, data) {
    const frame = $.extend({}, FRAME_DEFAULTS, {
        id: ++sequences.frames
    }, data);

    state.frames.splice(index, 0, frame);

    // create blank cels for all layers
    state.layers.forEach(layer => createCel(layer, frame));
}
export function duplicateFrame(index) {
    const originalFrame = state.frames[index];
    const newFrame = $.extend({}, originalFrame, {
        id: ++sequences.frames
    });

    state.frames.splice(index, 0, newFrame);

    state.layers.forEach(layer => {
        const originalCel = cel(layer, originalFrame);
        createCel(layer, newFrame, originalCel);
    });
}
export function deleteFrame(index) {
    const frame = state.frames[index];
    celIdsForFrame(frame).forEach(celId => delete state.cels[celId]);
    state.frames.splice(index, 1);
}
export function reorderFrame(oldIndex, newIndex) {
    state.frames.splice(newIndex, 0, state.frames.splice(oldIndex, 1)[0]);
}


function createCel(layer, frame, data = {}) {
    const celId = getCelId(layer.id, frame.id);
    state.cels[celId] = normalizeCel(data);
}

function normalizeCel(cel) {
    let normalizedCel = $.extend({}, CELL_DEFAULTS);

    // Copy over everything except for chars
    Object.keys(cel).filter(key => key !== 'chars').forEach(key => normalizedCel[key] = cel[key]);

    // Build chars array, making sure every row/col has a value, and boundaries are followed
    normalizedCel.chars = [];
    let row, col, char, color;
    for (row = 0; row < numRows(); row++) {
        normalizedCel.chars[row] = [];

        for (col = 0; col < numCols(); col++) {
            char = undefined;
            color = undefined;

            if (cel.chars && cel.chars[row] && cel.chars[row][col] !== undefined) {
                if (Array.isArray(cel.chars[row][col])) {
                    char = cel.chars[row][col][0];
                    color = cel.chars[row][col][1];
                }
                else {
                    char = cel.chars[row][col];
                }
            }
            if (char === undefined) { char = ''; }
            if (color === undefined) { color = 0; }

            normalizedCel.chars[row][col] = [char, color];
        }
    }

    return normalizedCel;
}

export function iterateCels(callback) {
    Object.values(state.cels).forEach((cel, i) => callback(cel, i));
}

export function getCurrentCelChar(row, col) {
    return charInBounds(row, col) ? $.extend([], currentCel().chars[row][col]) : undefined;
}

// Parameter 'value' is an array of [char, color]. If an array element is undefined, that element will not be modified
export function setCurrentCelChar(row, col, value) {
    if (charInBounds(row, col)) {
        $.extend(currentCel().chars[row][col], value);
    }
}

export function charInBounds(row, col) {
    return row >= 0 && row < numRows() && col >= 0 && col < numCols();
}

// Aggregates all visible layers for a frame
export function layeredChars(frame, options = {}) {
    let result = create2dArray(numRows(), numCols(), () => ['', 0]);

    let l, layer, chars, r, c;
    for (l = 0; l < state.layers.length; l++) {
        layer = state.layers[l];
        if (options.showAllLayers || (state.config.lockLayerVisibility ? l === layerIndex() : layer.visible)) {
            chars = cel(layer, frame).chars;
            for (r = 0; r < chars.length; r++) {
                for (c = 0; c < chars[r].length; c++) {
                    if (chars[r][c][0] !== '') {
                        result[r][c] = chars[r][c];
                    }
                }
            }
        }

        // If there is movableContent, we show it on top of the rest of the layer
        if (options.showMovingContent && l === layerIndex() && selection.movableContent) {
            translate(selection.movableContent, selection.getSelectedCellArea().topLeft, (value, r, c) => {
                if (value !== undefined && charInBounds(r, c)) { result[r][c] = value; }
            });
        }
    }

    return result;
}

export function colorTable() {
    return state.colorTable;
}
export function colorStr(colorIndex) {
    return state.colorTable[colorIndex] === undefined ? DEFAULT_COLOR : state.colorTable[colorIndex];
}

export function findOrCreateColor(colorStr) {
    let index = state.colorTable.indexOf(colorStr);

    if (index === -1) {
        state.colorTable.push(colorStr);
        index = state.colorTable.length - 1;
    }

    return index;
}


export function currentPalette() {
    return state.palettes[config('paletteIndex')];
}

export function updatePalette(index, palette) {
    state.palettes[index] = palette;
}