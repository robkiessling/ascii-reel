import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as editor from './editor.js';
import Color from "@sphinxxxx/color-conversion";
import SimpleBar from "simplebar";

const $container = $('#palette-controller');
let $colorList = $container.find('.color-list');

const colorListSimpleBar = new SimpleBar($colorList.get(0), {
    autoHide: false,
    forceVisible: true
});
$colorList = $(colorListSimpleBar.getContentElement());

$colorList.on('click', '.color', evt => {
    const $color = $(evt.currentTarget);
    editor.selectColor($color.data('color'));
});

export function refresh() {
    $colorList.empty();

    state.palette().forEach(colorStr => {
        $('<div></div>', {
            class: 'color',
            attr: { 'data-color': colorStr }, // using `attr` instead of `data` so we can select by it in DOM
            css: { 'background-color': colorStr }
        }).appendTo($colorList);
    });

    refreshSelection();
}

export function refreshSelection() {
    $colorList.find('.color.selected').removeClass('selected');
    $colorList.find(`.color[data-color="${editor.currentColorString()}"]`).addClass('selected');
}