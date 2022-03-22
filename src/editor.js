import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as selection from './selection.js';
import {triggerRefresh} from "./index.js";
import * as clipboard from "./clipboard.js";

let currentColorStr = '#fff';
let cachedColorIndex = null;
const $tools = $('#editing-tools');
const $canvasContainer = $('#canvas-container');

let $selectionTools = $('#selection-tools');
let selectionToolsWereVisible = false;

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

    // Note: This logic is kind of overkill to get what we want. Basically just want to show tools if there is a selection,
    //       except for the initial down-click during a fresh selection
    let selectionToolsAreVisible = selection.hasSelection() && (!selection.isSelecting || selectionToolsWereVisible);
    $selectionTools.toggle(selectionToolsAreVisible);
    if (!selection.isSelecting) { selectionToolsWereVisible = selectionToolsAreVisible; }
}


$tools.off('click', '.editing-tool').on('click', '.editing-tool', (evt) => {
    changeTool($(evt.currentTarget).data('tool'));
});

export function changeTool(newTool) {
    state.config('tool', newTool);
    selection.clear();
    refresh();
}

function bindSelectionToolEvent(tool, onClick) {
    $selectionTools.find(`.selection-tool[data-tool="${tool}"]`).off('click').on('click', evt => {
        onClick(evt);
    })
}

bindSelectionToolEvent('cut', () => clipboard.cut());
bindSelectionToolEvent('copy', () => clipboard.copy());
bindSelectionToolEvent('paste', () => clipboard.paste());
bindSelectionToolEvent('flip-v', (e) => selection.flipVertically(e.altKey));
bindSelectionToolEvent('flip-h', (e) => selection.flipHorizontally(e.altKey));
bindSelectionToolEvent('paint', () => fillSelection());

function fillSelection() {
    selection.getSelectedCells().forEach(cell => {
        state.setCurrentCelChar(cell.row, cell.col, [undefined, currentColorIndex()]);
    });
    triggerRefresh('chars');
}

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
    onDone: () => fillSelection()
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
