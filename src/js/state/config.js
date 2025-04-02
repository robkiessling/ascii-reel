import {getFormattedDateTime} from "../utils/strings.js";
import {DEFAULT_COLOR} from "../features/palette.js";
import {pick} from "../utils/objects.js";

export const DEFAULT_STATE = {
    name: '',
    createdAt: undefined,
    fps: 6,
    grid: {
        show: true,
        minorGridEnabled: true,
        minorGridSpacing: 1,
        majorGridEnabled: true,
        majorGridSpacing: 5,
    },
    whitespace: false,
    onion: false,
    lockLayerVisibility: true,
    frameOrientation: 'left',
    minimizedComponents: {
        layers: true
    },
    tool: 'draw-freeform-ascii',
    primaryColor: DEFAULT_COLOR,
    brush: {
        shape: 'square',
        size: 1
    },
    drawRect: {
        type: 'printable-ascii-1'
    },
    drawLine: {
        type: 'basic'
    },
    lastExportOptions: {},

    font: 'monospace',
    dimensions: [30, 15], // [numCols, numRows]
    background: false,
    cursorPosition: {},
}

// Only the following config keys are saved to history; undo/redo will not affect the other config
const CONFIG_KEYS_SAVED_TO_HISTORY = [
    'font', 'dimensions', 'background', 'cursorPosition'
]


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

// Only certain keys are stored to history (e.g. we don't want undo to change what tool the user has selected)
export function getStateForHistory() {
    return pick(state, CONFIG_KEYS_SAVED_TO_HISTORY);
}
export function updateStateFromHistory(updates) {
    for (const [key, value] of Object.entries(pick(updates, CONFIG_KEYS_SAVED_TO_HISTORY))) {
        state[key] = value;
    }
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

export function getName(includeDefaultTimestamp = true) {
    if (getConfig('name')) return getConfig('name');

    if (includeDefaultTimestamp) {
        let name = 'Untitled';
        let createdAt = new Date(getConfig('createdAt'));
        if (isNaN(createdAt.getTime())) createdAt = new Date();
        name += `-${getFormattedDateTime(createdAt)}`;
        return name;
    }
    else {
        return 'Untitled animation'
    }
}

export function isMinimized(componentKey) {
    return !!(getConfig('minimizedComponents') || {})[componentKey];
}