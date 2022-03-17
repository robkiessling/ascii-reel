import $ from "jquery";
import {create2dArray, eachWithObject, iterate2dArray} from "./utilities.js";

const CONFIG_DEFAULTS = {
    dimensions: [9, 9],
    fps: 1,
    onion: false, // todo may add more options
    layerIndex: 0,
    frameIndex: 0,
    frameOrientation: 'left'
}
const LAYER_DEFAULTS = {
    name: 'Layer',
    visible: true,
    opacity: 1
}
const FRAME_DEFAULTS = {}
const CELL_DEFAULTS = {
    chars: [[]],
    colors: [[]]
}
const SEQUENCES = ['layers', 'frames'];
let state;
let sequences;

export function loadState(data) {
    state = {
        config: $.extend(true, {}, CONFIG_DEFAULTS, data.config), // todo ensure index is in bounds
        layers: data.layers.map(layer => $.extend(true, {}, LAYER_DEFAULTS, layer)),
        frames: data.frames.map(frame => $.extend(true, {}, FRAME_DEFAULTS, frame))
    };

    // TODO Ensure every layer and frame has enough cels?
    state.cels = eachWithObject(data.cels.map(cel => normalizeCel(cel)), {}, (cel, obj) => {
        obj[getCelId(cel.layerId, cel.frameId)] = cel;
    });

    sequences = eachWithObject(SEQUENCES, {}, (className, obj) => {
        obj[className] = Math.max.apply(Math, state[className].map(e => e.id));
    });
}
export function saveState() {
    // TODO
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
export function reorderLayer(oldIndex, newIndex) {
    state.layers.splice(newIndex, 0, state.layers.splice(oldIndex, 1)[0]);
}
export function toggleLayerVisibility(layer) {
    layer.visible = !layer.visible;
}
export function toggleAllLayerVisibility(visible) {
    state.layers.forEach(layer => layer.visible = visible);
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
    for (let row = 0; row < numRows(); row++) {
        normalizedCel.chars[row] = [];

        for (let col = 0; col < numCols(); col++) {
            normalizedCel.chars[row][col] = cel.chars && cel.chars[row] && cel.chars[row][col] ? cel.chars[row][col] : '';
        }
    }

    return normalizedCel;
}

export function getCurrentCelChar(row, col) {
    return charInBounds(row, col) ? currentCel().chars[row][col] : null;
}
export function setCurrentCelChar(row, col, value) {
    if (charInBounds(row, col)) {
        currentCel().chars[row][col] = value;
    }
}

function charInBounds(row, col) {
    return row >= 0 && row < numRows() && col >= 0 && col < numCols();
}

// Aggregates all visible layers for a frame
export function layeredChars(frame) {
    let result = create2dArray(numRows(), numCols(), '');

    state.layers.forEach(layer => {
        if (!layer.visible) {
            return;
        }

        const layerChars = cel(layer, frame).chars;

        iterate2dArray(layerChars, (value, cell) => {
            // Only overwriting char if it is not blank
            if (value !== '') {
                result[cell.row][cell.col] = value;
            }
        });
    });

    return result;
}