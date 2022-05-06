import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as editor from './editor.js';
import Color from "@sphinxxxx/color-conversion";

const CURRENT_COLORS_INDEX = 0;

const $container = $('#palette-controller');
const $colorList = $container.find('.color-list');

$colorList.on('click', '.color', evt => {
    const $color = $(evt.currentTarget);
    editor.selectColor($color.data('colorStr'));
});


export function refresh() {
    $colorList.empty();

    if (state.currentPalette()) {
        const currentColorString = editor.currentColorString();

        state.currentPalette().colors.forEach(colorStr => {
            $('<div></div>', {
                class: `color ${colorStr === currentColorString ? 'selected' : ''}`,
                data: { colorStr: colorStr },
                css: { 'background-color': colorStr }
            }).appendTo($colorList);
        });
    }
}

export function recalculate() {
    if (currentColorsSelected()) {
        recalculateCurrentColors();
    }

    refresh();
}

function currentColorsSelected() {
    return state.config('paletteIndex') === CURRENT_COLORS_INDEX;
}

function recalculateCurrentColors() {
    let currentColorIndices = new Set();

    // TODO performance? Have to scan every char of every cel to find what colors are in use...
    state.iterateCels(cel => cel.chars.forEach(row => row.forEach(col => currentColorIndices.add(col[1]))));

    let currentColors = [...currentColorIndices].map(colorIndex => {
        return new Color(state.colorStr(colorIndex));
    }).sort((color1, color2) => {
        // Sort current colors by hue, then saturation, then lightness, then alpha
        const [h1, s1, l1, a1] = color1.hsla;
        const [h2, s2, l2, a2] = color2.hsla;
        return h1 - h2 || s1 - s2 || l1 - l2 || a1 - a2;
    }).map(color => color[state.COLOR_FORMAT]);

    state.updatePalette(CURRENT_COLORS_INDEX, {
        name: 'Current Colors',
        colors: currentColors
    });
}
