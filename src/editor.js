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

export function currentColorIndex() {
    if (cachedColorIndex !== null) {
        return cachedColorIndex;
    }
    return state.findOrCreateColor(currentColorStr);
}

export function refresh() {
    $tools.find('.editing-tool').removeClass('selected');
    $tools.find(`.editing-tool[data-tool='${state.config('tool')}']`).addClass('selected');

    $selectionTools.toggle(selection.hasSelection());
    // $selectionTools.toggle(selection.hasSelection() && !selection.isDrawing);
}


$tools.off('click', '.editing-tool').on('click', '.editing-tool', (evt) => {
    changeTool($(evt.currentTarget).data('tool'));
});

export function changeTool(newTool) {
    state.config('tool', newTool);
    selection.clear();
    refresh();
}


export function setupMouseEvents(canvasControl) {
    /*  ---------------------  Emitting Events  ---------------------  */
    function _emitEvent(name, mouseEvent) {
        if (!canvasControl.initialized) { return; }
        const cell = canvasControl.cellAtExternalXY(mouseEvent.offsetX, mouseEvent.offsetY);
        canvasControl.$canvas.trigger(name, [mouseEvent, cell, state.config('tool')])
    }

    canvasControl.$canvas.on('mousedown', evt => {
        if (evt.which !== 1) { return; } // Only apply to left-click
        _emitEvent('editor:mousedown', evt);
    });

    canvasControl.$canvas.on('mousemove', evt => {
        _emitEvent('editor:mousemove', evt);
    });

    $(document).on('mouseup', evt => {
        _emitEvent('editor:mouseup', evt);
    });

    /*  ---------------------  Event Listeners  ---------------------  */
    canvasControl.$canvas.on('editor:mousedown', (evt, mouseEvent, cell, tool) => {
        switch(tool) {
            case 'paint':
                paintConnectedCells(cell, { diagonal: mouseEvent.metaKey });
                break;
            default:
                return; // Ignore all other tools
        }
    });

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell, tool) => {
        $canvasContainer.css('cursor', cursorStyle(tool, cell));
    });
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
bindSelectionToolEvent('paint', () => paintSelection());
bindSelectionToolEvent('cancel', () => selection.clear());

function paintSelection() {
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
    onDone: () => paintSelection()
});

function cursorStyle(tool, cell) {
    switch (tool) {
        case 'selection-rect':
        case 'selection-line':
        case 'selection-lasso':
        case 'selection-wand':
            return selection.isSelectedCell(cell) ? 'grab' : 'cell';
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

function paintConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return; }

    selection.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelChar(cell.row, cell.col, [undefined, currentColorIndex()]);
    })

    triggerRefresh('chars');
}