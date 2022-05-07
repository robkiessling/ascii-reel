import $ from "jquery";
import * as state from './state.js';
import * as editor from './editor.js';
import SimpleBar from "simplebar";
import {triggerRefresh} from "./index.js";

export const DEFAULT_PALETTE = ['rgba(0,0,0,1)', 'rgba(255,255,255,1)'];
export const DEFAULT_COLOR = 'rgba(0,0,0,1)';

const $container = $('#palette-controller');
let $colorList = $container.find('.color-list');
const $sort = $container.find('.sort-colors');
const $delete = $container.find('.delete-color');
const $settings = $container.find('.palette-settings');

const colorListSimpleBar = new SimpleBar($colorList.get(0), {
    autoHide: false,
    forceVisible: true
});
$colorList = $(colorListSimpleBar.getContentElement());

$colorList.on('click', '.color', evt => {
    const $color = $(evt.currentTarget);
    editor.selectColor($color.data('color'));
});

$delete.on('click', () => {
    state.deleteColor($colorList.find('.selected').data('color'));
    triggerRefresh('palette');
});

export function refresh() {
    $colorList.empty();

    const colors = state.currentPalette();
    if (colors.length) {
        colors.forEach(colorStr => {
            $('<div></div>', {
                class: 'color',
                attr: { 'data-color': colorStr }, // using `attr` instead of `data` so we can select by it in DOM
                css: { 'background-color': colorStr }
            }).appendTo($colorList);
        });
    }
    else {
        $('<div></div>', {
            class: 'message',
            html: 'No colors...'
        }).appendTo($colorList);
    }

    refreshSelection();
}

export function refreshSelection() {
    $colorList.find('.color.selected').removeClass('selected');
    $colorList.find(`.color[data-color="${editor.currentColorString()}"]`).addClass('selected');

    $delete.prop('disabled', !$colorList.find('.selected').length);
}