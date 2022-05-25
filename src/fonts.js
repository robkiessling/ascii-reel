import $ from "jquery";
import * as state from "./state.js";
import {roundToDecimal} from "./utilities.js";

const $fontTester = $('#font-ratio-tester');

export let cellHeight = 16;
export let cellWidth;
export let fontRatio;

// Calculate font ratio based on how the user's browser renders text. Needs to be called after changing the font.
export function calculateFontRatio() {
    $fontTester.show();
    $fontTester.css('font-family', state.config('font')).css('font-size', `${cellHeight}px`);
    cellWidth = roundToDecimal($fontTester.width(), 2);
    fontRatio = cellWidth / cellHeight;
    $fontTester.hide();
}

// TODO font options? Not all browsers have these
// Courier, Courier New, Menlo, Monaco, Consolas, Verdana

// TODO Just always using 'Courier' when exporting to RTF, because it seems well supported by windows/mac and
//      we want to ensure a monospace font is used
// RTF Doesn't have fallback fonts like HTML
export function rtfFont() {
    return 'Courier';
}