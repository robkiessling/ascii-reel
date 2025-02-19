import $ from "jquery";
import * as state from "./state.js";
import {roundToDecimal} from "./utilities.js";

const $fontTester = $('#font-ratio-tester');

export let cellHeight = 16;
export let cellWidth;
export let fontRatio;

export const AVAILABLE_FONTS = [
    'monospace',
    'Andale Mono',
    'Cascadia Mono',
    'Consolas',
    'Courier',
    'Courier New',
    'Fixedsys',
    'Liberation Mono',
    'Lucida Console',
    'Menlo',
    'Monaco',
    'Segoe UI Mono',
    'Verdana'
];

// Calculate font ratio based on how the user's browser renders text. Needs to be called after changing the font.
export function calculateFontRatio() {
    $fontTester.show();
    $fontTester.css('font-family', state.fontFamily()).css('font-size', `${cellHeight}px`);
    cellWidth = roundToDecimal($fontTester.width(), 2);
    fontRatio = cellWidth / cellHeight;
    $fontTester.hide();
}
