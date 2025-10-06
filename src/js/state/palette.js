import Color from "@sphinxxxx/color-conversion";
import {getDrawingColor} from "./config.js";
import {iterateAllCels} from "./timeline/cels.js";

// TODO Should this be moved to state index? It is used by a lot of outside code
export const COLOR_FORMAT = 'hex'; // vanilla-picker format we use to store colors

export const BLACK = new Color('rgba(0,0,0,1)')[COLOR_FORMAT];
export const WHITE = new Color('rgba(255,255,255,1)')[COLOR_FORMAT];

export const DEFAULT_COLOR = BLACK;

export const COLOR_DEPTH_8_BIT = '8bit';
export const COLOR_DEPTH_16_BIT = '16bit';

// Note: these values get used to look up strings->description value for tooltip. If this is changed need to update strings.
export const SORT_BY_OPTIONS = {
    DATE_ADDED: 'date-added',
    HUE: 'hue',
    SATURATION: 'saturation',
    LIGHTNESS: 'lightness',
    ALPHA: 'alpha'
}

const DEFAULT_STATE = {
    colors: [DEFAULT_COLOR],
    sortBy: null,
    sortedColors: []
}

let state = {};

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        state = data;
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, data);

    // Re-import current colors array to ensure proper format and sorting
    importPalette(data.colors || DEFAULT_STATE.colors, true);
}

export function serialize() {
    return state;
}

export function colorDepth() {
    return state.colors.length > 0xFF ? COLOR_DEPTH_16_BIT : COLOR_DEPTH_8_BIT
}

export function colorTable() {
    return state.colors.slice(0); // Returning a dup; colorTable should only be modified by colorIndex/vacuum
}
export function colorStr(colorIndex) {
    return state.colors[colorIndex] === undefined ? DEFAULT_COLOR : state.colors[colorIndex];
}
export function colorIndex(colorStr) {
    let index = state.colors.indexOf(colorStr);

    if (index === -1) {
        state.colors.push(colorStr);
        index = state.colors.length - 1;
        recalculateSortedPalette();
    }

    return index;
}
export function primaryColorIndex() {
    return colorIndex(getDrawingColor());
}




export function sortedPalette() {
    return state.sortedColors || [];
}

export function isNewColor(colorStr) {
    return !state.colors.includes(colorStr);
}

export function addColor(colorStr) {
    if (isNewColor(colorStr)) {
        state.colors.push(colorStr);
        recalculateSortedPalette();
    }
}

export function deleteColor(colorStr) {
    // TODO do not let you delete if it's in use
    state.colors = state.colors.filter(paletteColorStr => paletteColorStr !== colorStr);
    recalculateSortedPalette();
}

export function changePaletteSortBy(newSortBy) {
    state.sortBy = newSortBy;
    recalculateSortedPalette();
}

export function getPaletteSortBy() {
    return state ? state.sortBy : null;
}


// Returns the best default color that contrasts a given background color
export function defaultContrastColor(forBackground) {
    if (!forBackground) return BLACK;

    const backgroundColor = new Color(forBackground);
    let [h, s, l, a] = backgroundColor.hsla;
    return l < 0.5 ? WHITE : BLACK;
}

export function importPalette(newColors, replace = false) {
    newColors = newColors.map(colorStr => new Color(colorStr)[COLOR_FORMAT])
    state.colors = replace ? newColors : [...state.colors, ...newColors];

    recalculateSortedPalette();
}

export function convertToMonochrome(charColor) {
    importPalette([charColor], true)
}

function recalculateSortedPalette() {
    if (!Object.values(SORT_BY_OPTIONS).includes(state.sortBy)) {
        state.sortBy = SORT_BY_OPTIONS.DATE_ADDED;
    }

    switch (state.sortBy) {
        case SORT_BY_OPTIONS.DATE_ADDED:
            state.sortedColors = [...state.colors];
            break;
        case SORT_BY_OPTIONS.HUE:
            state.sortedColors = sortColorsByHslaAttr(state.colors, 'h');
            break;
        case SORT_BY_OPTIONS.SATURATION:
            state.sortedColors = sortColorsByHslaAttr(state.colors, 's');
            break;
        case SORT_BY_OPTIONS.LIGHTNESS:
            state.sortedColors = sortColorsByHslaAttr(state.colors, 'l');
            break;
        case SORT_BY_OPTIONS.ALPHA:
            state.sortedColors = sortColorsByHslaAttr(state.colors, 'a');
            break;
        default:
            console.warn(`Could not sort by: ${state.sortBy}`)
            state.sortedColors = [...state.colors];
    }
}

function sortColorsByHslaAttr(colors, hslaAttr) {
    const hslaColors = colors.map(colorStr => {
        const [h, s, l, a] = new Color(colorStr).hsla;
        return { h, s, l, a, colorStr };
    });
    hslaColors.sort((a, b) => {
        // Sorting by hue
        if (hslaAttr === 'h') {
            return sortByHue(a, b)
        }

        // Sorting by saturation/lightness/alpha, and use hue as a secondary sort if equivalent
        if (a[hslaAttr] === b[hslaAttr]) {
            return sortByHue(a, b);
        }
        return a[hslaAttr] > b[hslaAttr] ? 1 : -1;
    })
    return hslaColors.map(hslaColor => hslaColor.colorStr);
}

// Sorts by hue, and uses lightness as a secondary sort if equivalent
// There is also a special handler for grey colors (which are all hue:0 -- red) so that they are sorted in front of reds
function sortByHue(a, b) {
    if (a.h === b.h) {
        if (isGreyColor(a) && !isGreyColor(b)) {
            return -1;
        }
        else if (!isGreyColor(a) && isGreyColor(b)) {
            return 1;
        }
        else {
            return a.l > b.l ? 1 : -1;
        }
    }

    return a.h > b.h ? 1 : -1;
}

function isGreyColor(hslaColor) {
    return hslaColor.h === 0 && hslaColor.s === 0;
}




// -------------------------------------------------------------------------------------------- Vacuuming

// TODO we could implement this if we want to disable the delete-unused-colors button if nothing to delete
export function canVacuumColorTable() {

}

/**
 * Removes all unused colors from the color table. A color becomes unused if, for example, it was previously used 
 * in a cel but was later overwritten or erased.
 *
 * During vacuuming, each cel's color indices are remapped to match the compacted colors array.
 *
 * @example
 * // Using symbolic color values for clarity:
 * // Initial color table: ['a', 'b', 'c', 'd', 'd']  // Duplicate 'd' shouldn't ever happen, but will be fixed by vacuum
 * // cel #1 uses color indices: [1 ('b'), 4 ('d')]
 * // cel #2 uses color indices: [1 ('b'), 2 ('c')]
 * //
 * // After vacuuming:
 * // New color table: ['b', 'c', 'd'] // Contains only colors in use
 * // cel #1 remapped indices: [0 ('b'), 2 ('d')] // E.g. Any cell that had colorIndex 4 will now have colorIndex 2
 * // cel #2 remapped indices: [0 ('b'), 1 ('c')]
 */
export function vacuumColorTable() {
    // Ensure colors has at least one entry so we can use index 0 as a fallback
    if (!state.colors[0]) state.colors[0] = DEFAULT_COLOR;

    // Determine what color indices are in use
    let usedColorIndexes = new Set();
    iterateAllCels(cel => cel.getUniqueColorIndexes().forEach(colorIndex => usedColorIndexes.add(colorIndex)))
    usedColorIndexes = [...usedColorIndexes].sort();

    // Build a map of original colorIndex -> new vacuumed colorIndex
    let newIndex = 0;
    const vacuumMap = new Map();
    const dupMap = getDupColorMap(); // Used to remove any duplicate colors values
    usedColorIndexes.forEach(colorIndex => {
        // If colors does not have a value for the current colorIndex, we set the colorIndex to 0
        if (!state.colors[colorIndex]) colorIndex = 0;

        // If the color value of a colorIndex is duplicated by an earlier colorIndex, we use that earlier colorIndex
        if (dupMap.has(colorIndex)) colorIndex = dupMap.get(colorIndex);

        // Add any new color indexes to the map
        if (!vacuumMap.has(colorIndex)) vacuumMap.set(colorIndex, newIndex++)
    });

    if (!vacuumMap.size) return;

    // Update all cels so that they used the newly vacuumed colors array
    iterateAllCels(cel => cel.updateColorIndexes(vacuumMap))

    // Store new vacuumed colors array to state
    const vacuumedColors = [];
    for (const [oldIndex, newIndex] of vacuumMap.entries()) {
        vacuumedColors[newIndex] = state.colors[oldIndex];
    }
    state.colors = vacuumedColors;
    recalculateSortedPalette();
}

/**
 * Returns a map of any duplicate colors values, where the key is the dup index and the value is the original index.
 * E.g. if colors is ['#000000', '#ff0000', '#00ff00', '#ff0000'], index 3 (the second '#ff0000') is a duplicate,
 * so the returned map would be { 3 => 1 }, since any cel that uses colorIndex 3 can be replaced with colorIndex 1.
 * @returns {Map<number, number>}
 */
function getDupColorMap() {
    const updateMap = new Map();
    const colorStrToIndexMap = new Map();
    state.colors.forEach((colorStr, colorIndex) => {
        if (colorStrToIndexMap.has(colorStr)) {
            // It is a duplicate
            updateMap.set(colorIndex, colorStrToIndexMap.get(colorStr))
        }
        else {
            // It is an original
            colorStrToIndexMap.set(colorStr, colorIndex);
        }
    })
    return updateMap;
}
