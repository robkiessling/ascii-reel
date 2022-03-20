import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as selection from './selection.js';
import {triggerRefresh} from "./index.js";

let currentColorStr = '#fff';
let cachedColorIndex = null;
const $tools = $('#editing-tools');
const $canvasContainer = $('#canvas-container');

export function currentColorIndex() {
    if (cachedColorIndex !== null) {
        return cachedColorIndex;
    }
    return state.findOrCreateColor(currentColorStr);
}

export function refresh() {
    $tools.find('.editing-tool').removeClass('selected');
    $tools.find(`.editing-tool[data-tool='${state.config('tool')}']`).addClass('selected');

    $canvasContainer.css('cursor', cursorStyle());
}


$tools.off('click', '.editing-tool').on('click', '.editing-tool', (evt) => {
    const $tool = $(evt.currentTarget);
    state.config('tool', $tool.data('tool'));
    refresh();
});

const colorPickerElement = document.querySelector('#current-color');
const colorPicker = new Picker({
    parent: colorPickerElement,
    color: currentColorStr,
    popup: 'top',
    onOpen: () => {
        const $done = $(colorPickerElement).find('.picker_done');
        $done.toggle(selection.hasSelection()).find('button').html("<span class='icon-paint-bucket'></span>")
    },
    onChange: (color) => {
        colorPickerElement.style.background = color.hex;
        currentColorStr = color.hex;
        cachedColorIndex = null;
    },
    onDone: () => {
        selection.getSelectedCells().forEach(cell => {
            state.setCurrentCelChar(cell.row, cell.col, [undefined, currentColorIndex()]);
        });
        triggerRefresh('chars');
    }
});

function cursorStyle() {
    switch (state.config('tool')) {
        case 'selection-rect':
        case 'selection-line':
        case 'selection-lasso':
        case 'selection-wand':
            return 'cell';
        case 'draw-rect':
        case 'draw-line':
            return 'crosshair';
        case 'paint':
            return 'cell';
        case 'move':
            return 'grab';
        default:
            return 'default';
    }
}
