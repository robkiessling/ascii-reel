import * as state from "../state/index.js";
import Color from "@sphinxxxx/color-conversion";
import {computedTheme, THEMES} from "./theme.js";

// ------------------------------------------------------------- CSS Variables

const rootStyles = getComputedStyle(document.documentElement);

// The following colors are static; they do not change based on dark/light mode
export const PRIMARY_COLOR = rootStyles.getPropertyValue('--color-primary');
export const SELECTION_COLOR = rootStyles.getPropertyValue('--color-selection');

// The following function can be used to get the current color value (based on dark/light mode)
export function getDynamicColor(cssProperty) {
    return rootStyles.getPropertyValue(cssProperty);
}

// ------------------------------------------------------------- Canvas Colors

const MINOR_GRID_LIGHTNESS_DELTA = 0.1;
const MAJOR_GRID_LIGHTNESS_DELTA = 0.4;
const HOVER_LIGHTNESS_DELTA = 0.5;
export const HOVER_CELL_OPACITY = 0.25;

export let minorGridColor, majorGridColor, hoverColor;

export function recalculateCanvasColors() {
    const bgColor = state.getConfig('background')

    // The color used for grids/hover effects changes depending on the canvas background. If the background is light we
    // use a darker shade; if the background is dark we use a lighter shade.
    const renderedBgColor = new Color(bgColor ? bgColor : checkerboardColors()[0]);
    let [h, s, l, a] = renderedBgColor.hsla;

    if (l < 0.5) {
        hoverColor = colorFromHslaArray([h, s, l + HOVER_LIGHTNESS_DELTA, 1]);

        // minor grid is a little lighter, major grid is a lot lighter
        minorGridColor = colorFromHslaArray([h, s, l + MINOR_GRID_LIGHTNESS_DELTA, 1]);
        majorGridColor = colorFromHslaArray([h, s, l + MAJOR_GRID_LIGHTNESS_DELTA, 1]);
    }
    else {
        hoverColor = colorFromHslaArray([h, s, l - HOVER_LIGHTNESS_DELTA, 1]);

        // minor grid is a little darker, major grid is a lot darker
        minorGridColor = colorFromHslaArray([h, s, l - MINOR_GRID_LIGHTNESS_DELTA, 1]);
        majorGridColor = colorFromHslaArray([h, s, l - MAJOR_GRID_LIGHTNESS_DELTA, 1]);
    }
}

function colorFromHslaArray(hsla) {
    let [h, s, l, a] = hsla;
    l = Math.min(1.0, Math.max(0.0, l));
    return new Color(`hsla(${h * 360},${s * 100}%,${l * 100}%,1)`)[state.COLOR_FORMAT]
}


// ------------------------------------------------------------- Checkerboard
// Checkerboard is the pattern of grey squares used to represent a transparent background

// Dark mode checkerboard
const CHECKERBOARD_DARK_A = '#4c4c4c';
const CHECKERBOARD_DARK_B = '#555';

// Light mode checkerboard
const CHECKERBOARD_LIGHT_A = '#eee';
const CHECKERBOARD_LIGHT_B = '#fafafa';

export function checkerboardColors() {
    if (computedTheme === THEMES.LIGHT_MODE) {
        return [CHECKERBOARD_LIGHT_A, CHECKERBOARD_LIGHT_B]
    }
    return computedTheme === THEMES.LIGHT_MODE ?
        [CHECKERBOARD_LIGHT_A, CHECKERBOARD_LIGHT_B] :
        [CHECKERBOARD_DARK_A, CHECKERBOARD_DARK_B]
}
