import {getFormattedDateTime} from "../utils/strings.js";
import {COLOR_FORMAT, DEFAULT_COLOR} from "./palette.js";
import {pick} from "../utils/objects.js";
import Color from "@sphinxxxx/color-conversion";

// TODO There are a lot of strings that should be constants
// TODO Organize this better? E.g. projectSettings could contain certain keys
export const DEFAULT_STATE = {
    name: '',
    projectType: 'animation',
    colorMode: 'monochrome',
    createdAt: undefined,
    dimensions: [15, 30], // [numRows, numCols]
    background: new Color('rgba(255,255,255,1)')[COLOR_FORMAT],
    font: 'monospace',
    fps: 6,
    playPreview: true,
    grid: {
        show: true,
        minorGridEnabled: true,
        minorGridSpacing: 1,
        majorGridEnabled: false,
        majorGridSpacing: 5,
    },
    showWhitespace: false,
    showOnion: false,
    showTicks: false,
    lockLayerVisibility: true,
    tool: 'draw-freeform',
    primaryColor: DEFAULT_COLOR,
    primaryChar: 'A',
    brush: {
        shape: 'square',
        size: 1
    },
    drawTypes: {
        'draw-freeform': 'irregular-adaptive',
        'draw-rect': 'outline-ascii-1',
        'draw-line': 'straight-adaptive',
        'draw-ellipse': 'outline-monochar',
    },
    lastExportOptions: null,
    cursorPosition: {},
}

// Only the following config keys are saved to history; undo/redo will not affect the other config
const CONFIG_KEYS_SAVED_TO_HISTORY = [
    'font', 'dimensions', 'background', 'cursorPosition', 'projectType', 'colorMode'
]

// These tools are only available if colorMode is multicolor
export const MULTICOLOR_TOOLS = new Set(['paint-brush', 'color-swap', 'fill-color', 'eyedropper'])


let state = {};

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE, { createdAt: new Date().toISOString() }, newState);
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
    return state.dimensions[0];
}
export function numCols() {
    return state.dimensions[1];
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
        switch (getConfig('projectType')) {
            case 'animation':
                return 'Untitled animation';
            case 'drawing':
                return 'Untitled drawing';
            default:
                return 'Untitled';
        }
    }
}

export function updateDrawType(toolKey, newType) {
    state.drawTypes[toolKey] = newType;
}

export function isAnimationProject() {
    return getConfig('projectType') === 'animation';
}

export function isMultiColored() {
    return getConfig('colorMode') === 'multicolor';
}
