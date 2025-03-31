
export const DEFAULT_STATE = {
    font: 'monospace',
    dimensions: [30, 15], // [numCols, numRows]
    background: false,
    cursorPosition: {},
}
let state = {};

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE, newState);
}
export function replaceState(newState) {
    state = newState;
}
export function getState() {
    return state;
}

export function numRows() {
    return state.dimensions[1];
}
export function numCols() {
    return state.dimensions[0];
}

export function setConfig(key, newValue) {
    state[key] = newValue;
}
export function getConfig(key) {
    return state[key];
}

// Returns the stored font as a string that can be entered as a CSS font-family attribute (including fallbacks)
export function fontFamily() {
    return `'${getConfig('font')}', monospace`
}
