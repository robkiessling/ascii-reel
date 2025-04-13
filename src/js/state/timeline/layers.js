
const DEFAULT_STATE = {
    layers: [],
    currentIndex: 0
};

const LAYER_DEFAULTS = {
    name: 'Layer',
    visible: true
}

let state = {};
let idSequence = 0;

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE);

    if (newState.layers) {
        state.layers = newState.layers.map(layer => $.extend(true, {}, LAYER_DEFAULTS, layer));
    }

    state.currentIndex = 0; // Do not import from newState; always start at 0

    idSequence = Math.max(...state.layers.map(layer => layer.id), 0);
}
export function replaceState(newState) {
    state = newState;
}
export function getState() {
    return state;
}

export function layers() {
    return state.layers;
}

export function layerAt(index) {
    return state.layers[index];
}

export function layerIndex(newIndex) {
    if (newIndex !== undefined) state.currentIndex = newIndex;
    return state.currentIndex;
}

export function currentLayer() {
    return state.layers[layerIndex()];
}

export function createLayer(index, data) {
    let max = 0;

    state.layers.map(layer => layer.name).forEach(name => {
        const match = name.match(/^Layer (\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
        }
    });

    const layer = $.extend({}, LAYER_DEFAULTS, {
        id: ++idSequence,
        name: `Layer ${max + 1}`
    }, data);

    state.layers.splice(index, 0, layer);

    return layer;
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
