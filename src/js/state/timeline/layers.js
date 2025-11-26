import {LAYER_TYPES} from "../../config/timeline.js";

const DEFAULT_STATE = {
    layers: [],
    currentIndex: 0
};

const LAYER_DEFAULTS = {
    name: 'Layer',
    visible: true,
    type: LAYER_TYPES.VECTOR
}

let state = {};
let idSequence = 0;

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        state = data;
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, data);
    if (data.layers) {
        state.layers = data.layers.map(layer => $.extend(true, {}, LAYER_DEFAULTS, layer));
    }

    idSequence = Math.max(...state.layers.map(layer => layer.id), 0);
}

export function serialize() {
    return state;
}

export function layers() {
    return state.layers;
}

export function layerAt(index) {
    return state.layers[index];
}

export function layerIndex() {
    return state.currentIndex;
}

export function changeLayerIndex(newIndex) {
    state.currentIndex = newIndex;
}

export function currentLayer() {
    return state.layers[layerIndex()];
}

export function currentLayerType() {
    return currentLayer().type;
}

export function createLayer(index, data) {
    const layer = $.extend(true, {}, LAYER_DEFAULTS, {
        id: ++idSequence,
        name: nextLayerName()
    }, data);

    state.layers.splice(index, 0, layer);

    return layer;
}

export function nextLayerName() {
    let max = 0;

    state.layers.map(layer => layer.name).forEach(name => {
        const match = name.match(/^Layer (\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
        }
    });

    return `Layer ${max + 1}`
}

export function deleteLayer(index) {
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
