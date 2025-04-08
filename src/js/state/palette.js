import Color from "@sphinxxxx/color-conversion";

export const COLOR_FORMAT = 'hex'; // vanilla-picker format we ues to store colors

const BLACK = 'rgba(0,0,0,1)';
const WHITE = 'rgba(255,255,255,1)';

export const DEFAULT_COLOR = BLACK;

// Note: these values get used to look up strings->description value for tooltip. If this is changed need to update strings.
export const SORT_BY_OPTIONS = {
    DATE_ADDED: 'date-added',
    HUE: 'hue',
    SATURATION: 'saturation',
    LIGHTNESS: 'lightness',
    ALPHA: 'alpha'
}

const DEFAULT_STATE = {
    colors: [BLACK],
    sortBy: null,
    sortedColors: []
}

let state = {};

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE, newState);
    importPalette(state.colors, true); // Re-import current colors array to ensure proper format and sorting
}
export function replaceState(newState) {
    state = newState;
}
export function getState() {
    return state;
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
