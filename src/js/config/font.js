import {roundToDecimal} from "../utils/numbers.js";
import {fontFamily} from "../state/index.js";

const FONT_PT = 16; // Font size for canvas rendering

// The following values are calculated based on actual text rendering
export let fontHeight;
export let fontWidth;
export let fontRatio;

// Calculate font ratio based on how the user's browser renders text. Needs to be called after changing the font.
export function calculateFontRatio() {
    const $fontTester = $('#font-ratio-tester');

    fontHeight = FONT_PT;
    $fontTester.show();
    $fontTester.css('font-family', fontFamily()).css('font-size', `${fontHeight}px`);
    fontWidth = roundToDecimal($fontTester.width(), 4);
    fontRatio = fontWidth / fontHeight;
    $fontTester.hide();
}


// Only allowing monospaced fonts or else canvas won't render text correctly
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
    'Segoe UI Mono'
];
