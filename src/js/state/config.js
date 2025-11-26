import {getFormattedDateTime} from "../utils/strings.js";
import {pick} from "../utils/objects.js";
import Color from "@sphinxxxx/color-conversion";
import {CHAR_PROP, COLOR_STR_PROP, DEFAULT_DRAW_PROPS} from "../config/shapes.js";
import {LAYER_TYPES} from "./constants.js";
import * as timeline from "./timeline/index.js";
import {
    BACKGROUND_MODES, CHECKERBOARD_DARK_A, CHECKERBOARD_DARK_B, CHECKERBOARD_LIGHT_A, CHECKERBOARD_LIGHT_B,
    COLOR_FORMAT,
    COLOR_MODES, DARK,
    HOVER_LIGHTNESS_DELTA, LIGHT,
    MAJOR_GRID_LIGHTNESS_DELTA,
    MINOR_GRID_LIGHTNESS_DELTA
} from "../config/colors.js";
import {getComputedTheme} from "./preferences.js";
import {THEMES} from "../config/themes.js";
import {isEmptyObject} from "jquery";
import {roundToDecimal} from "../utils/numbers.js";
import {FONT_PT} from "../config/font.js";

// TODO There are a lot of strings that should be constants
// TODO Organize this better? E.g. projectSettings could contain certain keys
export const DEFAULT_STATE = {
    name: '',
    projectType: 'animation',
    layerType: LAYER_TYPES.RASTER,
    colorMode: COLOR_MODES.BLACK_AND_WHITE,
    createdAt: undefined,
    dimensions: [30, 60], // [numRows, numCols]
    background: BACKGROUND_MODES.MATCH_THEME,
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
export const MULTICOLOR_TOOLS = new Set(['paint-brush', 'color-swap'])

// These tools are only available depending on layerType
export const RASTER_TOOLS = new Set([
    'text-editor', 'fill-char', 'selection-rect', 'selection-lasso', 'selection-line', 'selection-wand',
    'paint-brush', 'color-swap'
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
    if (resetCachedCanvasColorProps.has(key)) resetCachedCanvasColors();

    state[key] = newValue;
}
export function getConfig(key) {
    return state[key];
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
    return getConfig('colorMode') === COLOR_MODES.COLORED;
}

// Certain tools are only available in certain modes. This ensures the current tool is valid
export function toolFallback() {
    switch(timeline.currentLayerType()) {
        case LAYER_TYPES.RASTER:
            if (getConfig('colorMode') === COLOR_MODES.BLACK_AND_WHITE && MULTICOLOR_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', VECTOR_TOOL_TO_RASTER_FALLBACK.default)
            } else if (VECTOR_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', VECTOR_TOOL_TO_RASTER_FALLBACK[getConfig('tool')] || VECTOR_TOOL_TO_RASTER_FALLBACK.default)
            }
            break;
        case LAYER_TYPES.VECTOR:
            if (getConfig('colorMode') === COLOR_MODES.BLACK_AND_WHITE && MULTICOLOR_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', RASTER_TOOL_TO_VECTOR_FALLBACK.default)
            } else if (RASTER_TOOLS.has(getConfig('tool'))) {
                setConfig('tool', RASTER_TOOL_TO_VECTOR_FALLBACK[getConfig('tool')] || RASTER_TOOL_TO_VECTOR_FALLBACK.default)
            }
            break;
    }
}

// ------------------------------------------------------- Font:

let cachedFontMetrics = {};

// Calculate font ratio based on how the user's browser renders text. Needs to be called after changing the font.
export function recalculateFontRatio() {
    const $fontTester = $('#font-ratio-tester');

    cachedFontMetrics.height = FONT_PT;
    $fontTester.show();
    $fontTester.css('font-family', fontFamily()).css('font-size', `${cachedFontMetrics.height}px`);
    cachedFontMetrics.width = roundToDecimal($fontTester.width(), 4);
    cachedFontMetrics.ratio = cachedFontMetrics.width / cachedFontMetrics.height;
    $fontTester.hide();
}

export function fontMetrics() {
    return cachedFontMetrics;
}

// Returns the stored font as a string that can be entered as a CSS font-family attribute (including fallbacks)
export function fontFamily() {
    return `'${getConfig('font')}', monospace`
}







// ------------------------------------------------------- Canvas BG / Grid Colors:
// The canvas background / grid color depends on both the file's config:background setting & the user's theme.
// We cache these colors and only recalculate them when one of those fields changes.

// Config keys that reset cached colors
const resetCachedCanvasColorProps = new Set(['background', 'colorMode']);

let cachedCanvasColors = {};

export function getCanvasColors() {
    if (isEmptyObject(cachedCanvasColors)) cacheCanvasColors();
    return cachedCanvasColors;
}

export function resetCachedCanvasColors() {
    cachedCanvasColors = {};
}

export function bgColorForMode(backgroundMode) {
    switch (backgroundMode) {
        case BACKGROUND_MODES.MATCH_THEME:
            return getComputedTheme() === THEMES.LIGHT_MODE ? LIGHT : DARK;
        case BACKGROUND_MODES.DARK:
            return DARK;
        case BACKGROUND_MODES.LIGHT:
            return LIGHT;
        case BACKGROUND_MODES.TRANSPARENT:
            return getComputedTheme() === THEMES.LIGHT_MODE ? CHECKERBOARD_LIGHT_A : CHECKERBOARD_DARK_A
        case undefined:
            throw new Error(`backgroundMode is undefined`)
        default:
            return new Color(backgroundMode)[COLOR_FORMAT];
    }
}

function cacheCanvasColors() {
    cachedCanvasColors.background = bgColorForMode(getConfig('background'))

    // The color used for grids/hover effects changes depending on the canvas background. If the background is light we
    // use a darker shade; if the background is dark we use a lighter shade.
    let [h, s, l, a] = (new Color(cachedCanvasColors.background)).hsla;

    if (l < 0.5) {
        cachedCanvasColors.hover = colorFromHslaArray([h, s, l + HOVER_LIGHTNESS_DELTA, 1]);

        // minor grid is a little lighter, major grid is a lot lighter
        cachedCanvasColors.minor = colorFromHslaArray([h, s, l + MINOR_GRID_LIGHTNESS_DELTA, 1]);
        cachedCanvasColors.major = colorFromHslaArray([h, s, l + MAJOR_GRID_LIGHTNESS_DELTA, 1]);
    }
    else {
        cachedCanvasColors.hover = colorFromHslaArray([h, s, l - HOVER_LIGHTNESS_DELTA, 1]);

        // minor grid is a little darker, major grid is a lot darker
        cachedCanvasColors.minor = colorFromHslaArray([h, s, l - MINOR_GRID_LIGHTNESS_DELTA, 1]);
        cachedCanvasColors.major = colorFromHslaArray([h, s, l - MAJOR_GRID_LIGHTNESS_DELTA, 1]);
    }

    cachedCanvasColors.checkerboard = getComputedTheme() === THEMES.LIGHT_MODE ?
        [CHECKERBOARD_LIGHT_A, CHECKERBOARD_LIGHT_B] :
        [CHECKERBOARD_DARK_A, CHECKERBOARD_DARK_B]
}

function colorFromHslaArray(hsla) {
    let [h, s, l, a] = hsla;
    l = Math.min(1.0, Math.max(0.0, l));
    return new Color(`hsla(${h * 360},${s * 100}%,${l * 100}%,1)`)[COLOR_FORMAT]
}

