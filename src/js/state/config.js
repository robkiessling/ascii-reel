import {getFormattedDateTime} from "../utils/strings.js";
import {COLOR_FORMAT} from "./palette.js";
import {pick} from "../utils/objects.js";
import Color from "@sphinxxxx/color-conversion";
import {CHAR_PROP, COLOR_STR_PROP, DEFAULT_DRAW_PROPS} from "../geometry/shapes/constants.js";
import {LAYER_TYPES} from "./constants.js";
import * as timeline from "./timeline/index.js";

// TODO There are a lot of strings that should be constants
// TODO Organize this better? E.g. projectSettings could contain certain keys
export const DEFAULT_STATE = {
    name: '',
    projectType: 'animation',
    layerType: LAYER_TYPES.RASTER,
    colorMode: 'monochrome',
    createdAt: undefined,
    dimensions: [15, 30], // [numRows, numCols]
    background: new Color('rgba(0,0,0,1)')[COLOR_FORMAT],
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
    drawProps: DEFAULT_DRAW_PROPS,
    lastExportOptions: null,
    caretStyle: 'I-beam', // vs. block
}

// Only the following config keys are saved to history; undo/redo will not affect the other config
const CONFIG_KEYS_SAVED_TO_HISTORY = [
    'font', 'dimensions', 'background', 'projectType', 'colorMode'
]

// These tools are only available if colorMode is multicolor
export const MULTICOLOR_TOOLS = new Set(['paint-brush', 'color-swap', 'fill-color', 'eyedropper'])

// These tools are only available depending on layerType
export const RASTER_TOOLS = new Set([
    'text-editor', 'fill-char', 'selection-rect', 'selection-lasso', 'selection-line', 'selection-wand',
    'paint-brush', 'color-swap', 'fill-color', 'eyedropper'
])
export const VECTOR_TOOLS = new Set(['select', 'draw-textbox']);

// Tool fallbacks for when the current tool isn't valid for the current layer type
const VECTOR_TOOL_TO_RASTER_FALLBACK = {
    default: 'text-editor',
    'draw-textbox': 'fill-char'
}
const RASTER_TOOL_TO_VECTOR_FALLBACK = {
    default: 'select',
    'fill-char': 'draw-textbox',
}

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

export function getDrawingChar() {
    return getConfig('drawProps')[CHAR_PROP];
}
export function getDrawingColor() {
    return getConfig('drawProps')[COLOR_STR_PROP];
}
export function updateDrawingProp(key, value) {
    const drawProps = structuredClone(getConfig('drawProps'));
    drawProps[key] = value;
    setConfig('drawProps', drawProps);
}

export function isAnimationProject() {
    return getConfig('projectType') === 'animation';
}

export function isMultiColored() {
    return getConfig('colorMode') === 'multicolor';
}

// Certain tools are only available in certain modes. This ensures the current tool is valid
export function toolFallback() {
    switch(timeline.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            if (getConfig('colorMode') === 'monochrome' && MULTICOLOR_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', VECTOR_TOOL_TO_RASTER_FALLBACK.default)
            } else if (VECTOR_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', VECTOR_TOOL_TO_RASTER_FALLBACK[getConfig('tool')] || VECTOR_TOOL_TO_RASTER_FALLBACK.default)
            }
            break;
        case LAYER_TYPES.VECTOR:
            if (getConfig('colorMode') === 'monochrome' && MULTICOLOR_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', RASTER_TOOL_TO_VECTOR_FALLBACK.default)
            } else if (RASTER_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', RASTER_TOOL_TO_VECTOR_FALLBACK[getConfig('tool')] || RASTER_TOOL_TO_VECTOR_FALLBACK.default)
            }
            break;
    }
}
