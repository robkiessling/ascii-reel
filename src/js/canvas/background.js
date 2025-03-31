import * as state from "../state/index.js";
import Color from "@sphinxxxx/color-conversion";
import {roundForComparison} from "../utils/numbers.js";
import {currentTheme, THEMES} from "../config/theme.js";


// ------------------------------------------------------------- Grid / Hover Color Calculations
/**
 * The color used for grids//over effects changes depending on the canvas background; if the background is light we use
 * a darker shade, if the background is dark we use a lighter shade.
 */

const MINOR_GRID_LIGHTNESS_DELTA = 0.1;
const MAJOR_GRID_LIGHTNESS_DELTA = 0.4;
const HOVER_LIGHTNESS_DELTA = 0.5;
export const HOVER_CELL_OPACITY = 0.25;

let minorGridColor, majorGridColor, hoverColor;

export function getMajorGridColor() {
    if (!majorGridColor) recalculateBGColors();
    return majorGridColor;
}

export function getMinorGridColor() {
    if (!minorGridColor) recalculateBGColors();
    return minorGridColor;
}

export function getHoverColor() {
    if (!hoverColor) recalculateBGColors();
    return hoverColor;
}

export function recalculateBGColors() {
    const background = state.getConfig('background');
    const backgroundColor = new Color(background ? background : checkerboardA());
    let [h, s, l, a] = backgroundColor.hsla;

    if (l < 0.5) {
        hoverColor = colorFromHslaArray([h, s, l + HOVER_LIGHTNESS_DELTA, 1]);

        // minor grid is a little lighter, major grid is a lot lighter
        minorGridColor = colorFromHslaArray([h, s, l + MINOR_GRID_LIGHTNESS_DELTA, 1]);
        majorGridColor = colorFromHslaArray([h, s, l + MAJOR_GRID_LIGHTNESS_DELTA, 1]);
    }
    else {
        hoverColor = colorFromHslaArray([h, s, l - HOVER_LIGHTNESS_DELTA, 1])[state.COLOR_FORMAT];

        // minor grid is a little darker, major grid is a lot darker
        minorGridColor = colorFromHslaArray([h, s, l - MINOR_GRID_LIGHTNESS_DELTA, 1]);
        majorGridColor = colorFromHslaArray([h, s, l - MAJOR_GRID_LIGHTNESS_DELTA, 1]);
    }
}

function colorFromHslaArray(hsla) {
    const [h, s, l, a] = hsla;
    return new Color(`hsla(${h * 360},${s * 100}%,${l * 100}%,1)`)[state.COLOR_FORMAT]
}


// ------------------------------------------------------------- Checkerboard
/**
 * Checkerboard is the pattern of grey squares used to represent a transparent background
 */

// Dark mode checkerboard
const CHECKERBOARD_DARK_A = '#4c4c4c';
const CHECKERBOARD_DARK_B = '#555';

// Light mode checkerboard
const CHECKERBOARD_LIGHT_A = '#ccc';
const CHECKERBOARD_LIGHT_B = '#ddd';

const CHECKER_SIZE = 10;

function checkerboardA() {
    switch (currentTheme().name) {
        case THEMES.light.name:
            return CHECKERBOARD_LIGHT_A;
        default:
            return CHECKERBOARD_DARK_A;
    }
}

function checkerboardB() {
    switch (currentTheme().name) {
        case THEMES.light.name:
            return CHECKERBOARD_LIGHT_B;
        default:
            return CHECKERBOARD_DARK_B;
    }
}

export function drawCheckerboard(context, area) {
    // First, fill entire area with checkerboard-A color
    context.beginPath();
    context.fillStyle = checkerboardA();
    context.rect(...area.xywh);
    context.fill();

    // Then draw many little squares for checkerboard-B color
    context.beginPath();
    context.fillStyle = checkerboardB();
    let x, y;
    let maxX = roundForComparison(area.x + area.width);
    let maxY = roundForComparison(area.y + area.height);
    let colStartsOnB = false;

    for (x = area.x; roundForComparison(x) < maxX; x += CHECKER_SIZE) {
        let isCheckered = colStartsOnB;
        for (y = area.y; roundForComparison(y) < maxY; y += CHECKER_SIZE) {
            if (isCheckered) context.rect(x, y, CHECKER_SIZE, CHECKER_SIZE);
            isCheckered = !isCheckered;
        }
        colStartsOnB = !colStartsOnB;
    }
    context.fill();
}
