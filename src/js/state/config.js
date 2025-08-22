import {getFormattedDateTime} from "../utils/strings.js";
import {COLOR_FORMAT, DEFAULT_COLOR} from "./palette.js";
import {pick} from "../utils/objects.js";
import Color from "@sphinxxxx/color-conversion";
import {BRUSHES, DEFAULT_SHAPE_STYLES} from "../geometry/shapes/constants.js";

// TODO There are a lot of strings that should be constants
// TODO Organize this better? E.g. projectSettings could contain certain keys
export const DEFAULT_STATE = {
    name: '',
    projectType: 'animation',
    layerType: 'raster', // or 'vector'
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
    tool: 'text-editor',
    primaryColor: DEFAULT_COLOR,
    primaryChar: 'A',
    brush: Object.keys(BRUSHES)[0], // todo brushType/brushSize
    drawTypes: {
        'draw-freeform': 'irregular-adaptive',
        'draw-rect': 'outline-ascii-1',
        'draw-line': 'straight-adaptive',
        'draw-ellipse': 'outline-monochar',
    },
    shapeStyles: DEFAULT_SHAPE_STYLES,
    lastExportOptions: null,
    caretPosition: {},
    caretStyle: 'I-beam', // vs. block
}

// Only the following config keys are saved to history; undo/redo will not affect the other config
const CONFIG_KEYS_SAVED_TO_HISTORY = [
    'font', 'dimensions', 'background', 'caretPosition', 'projectType', 'colorMode'
]

// These tools are only available if colorMode is multicolor
export const MULTICOLOR_TOOLS = new Set(['paint-brush', 'color-swap', 'fill-color', 'eyedropper'])


let state = {};

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        if (options.history) {
            for (const [key, value] of Object.entries(pick(data, CONFIG_KEYS_SAVED_TO_HISTORY))) {
                state[key] = value;
            }
        } else {
            state = data;
        }
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, { createdAt: new Date().toISOString() }, data);
}

export function serialize(options = {}) {
    if (options.history) {
        // Only certain keys are stored to history (e.g. we don't want undo to change what tool the user has selected)
        return pick(state, CONFIG_KEYS_SAVED_TO_HISTORY)
    } else {
        return state;
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
