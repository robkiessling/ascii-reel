import Color from "@sphinxxxx/color-conversion";
import * as palette from "../components/palette.js";

const DEFAULT_STATE = {
    colors: [],
    sortBy: null,
    sortedColors: []
}

export const COLOR_FORMAT = 'hex'; // vanilla-picker format we ues to store colors

let state = {};

export function load(newState = {}) {
    importPalette(newState ? newState : { colors: palette.DEFAULT_PALETTE }, true)
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

function importPalette(newState, replace) {
    if (replace) state = $.extend(true, {}, DEFAULT_STATE);

    const currentColors = state.colors ? state.colors : []
    const newColors = newState.colors ? newState.colors.map(colorStr => new Color(colorStr)[COLOR_FORMAT]) : [];
    state.colors = replace ? newColors : [...currentColors, ...newColors]

    state.sortBy = newState.sortBy || state.sortBy;
    if (!Object.values(palette.SORT_BY).includes(state.sortBy)) {
        state.sortBy = palette.SORT_BY.DATE_ADDED;
    }

    recalculateSortedPalette();
}

function recalculateSortedPalette() {
    state.sortedColors = palette.sortPalette(state.colors, state.sortBy);
}