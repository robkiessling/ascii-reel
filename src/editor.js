import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as selection from './selection.js';
import {triggerRefresh} from "./index.js";
import * as clipboard from "./clipboard.js";
import * as keyboard from "./keyboard.js";

const $tools = $('#editing-tools');
const $canvasContainer = $('#canvas-container');

let $selectionTools = $('#selection-tools');
let $canvasDetails = $('#canvas-details');

$tools.off('click', '.editing-tool').on('click', '.editing-tool', (evt) => {
    changeTool($(evt.currentTarget).data('tool'));
});

// -------------------------------------------------------------------------------- Main External API

export function refresh() {
    if (currentColorStr === null) {
        // initial color picker state
        colorPicker.setColor(state.colors()[0]);
    }

    $tools.find('.editing-tool').removeClass('selected');
    $tools.find(`.editing-tool[data-tool='${state.config('tool')}']`).addClass('selected');

    $selectionTools.toggle(selection.hasSelection());
    refreshSelectionTools();

    $canvasDetails.find('.dimensions').html(`[${state.numCols()}x${state.numRows()}]`);
}

export function updateMouseCoords(cell) {
    $canvasDetails.find('.mouse-coordinates').html(cell && cell.isInBounds() ? `${cell.col}:${cell.row}` : '&nbsp;');
}

export function changeTool(newTool) {
    state.config('tool', newTool);
    selection.clear();
    refresh();
}


// -------------------------------------------------------------------------------- Events

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
    canvasControl.$canvas.on('mousemove', evt => _emitEvent('editor:mousemove', evt));
    $(document).on('mouseup', evt => _emitEvent('editor:mouseup', evt));
    canvasControl.$canvas.on('dblclick', evt => _emitEvent('editor:dblclick', evt));
    canvasControl.$canvas.on('mouseenter', evt => _emitEvent('editor:mouseenter', evt));
    canvasControl.$canvas.on('mouseleave', evt => _emitEvent('editor:mouseleave', evt));

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



// -------------------------------------------------------------------------------- Selection Editor

function bindSelectionToolEvent(tool, onClick) {
    $selectionTools.find(`.selection-tool[data-tool="${tool}"]`).off('click').on('click', evt => {
        if (!$(evt.currentTarget).hasClass('disabled')) {
            onClick(evt);
        }
    })
}

bindSelectionToolEvent('move', () => selection.toggleMovingContent());
bindSelectionToolEvent('typewriter', () => selection.toggleCursor());
bindSelectionToolEvent('cut', () => clipboard.cut());
bindSelectionToolEvent('copy', () => clipboard.copy());
bindSelectionToolEvent('paste', (e) => clipboard.paste(e.shiftKey));
bindSelectionToolEvent('flip-v', (e) => selection.flipVertically(e.shiftKey));
bindSelectionToolEvent('flip-h', (e) => selection.flipHorizontally(e.shiftKey));
bindSelectionToolEvent('paint', () => paintSelection());
bindSelectionToolEvent('close', () => selection.clear());

// Tools that are allowed when the given tool is selected
const MOVE_TOOLS = ['move'];
const TYPEWRITER_TOOLS = ['typewriter', 'cut', 'copy', 'paste'];

function refreshSelectionTools() {
    $selectionTools.find('.selection-tool').toggleClass('disabled', false);
    $selectionTools.find('.selection-tool').toggleClass('active', false);

    if (selection.movableContent) {
        $selectionTools.find('.selection-tool').each((i, element) => {
            const $element = $(element);
            if (!MOVE_TOOLS.includes($element.data('tool'))) {
                $element.toggleClass('disabled', true);
            }
        })

        $selectionTools.find('.selection-tool[data-tool="move"]').toggleClass('active', true);
    }

    if (selection.cursorCell) {
        $selectionTools.find('.selection-tool').each((i, element) => {
            const $element = $(element);
            if (!TYPEWRITER_TOOLS.includes($element.data('tool'))) {
                $element.toggleClass('disabled', true);
            }
        })
        $selectionTools.find('.selection-tool[data-tool="typewriter"]').toggleClass('active', true);
    }

}

function paintSelection() {
    selection.getSelectedCells().forEach(cell => {
        state.setCurrentCelChar(cell.row, cell.col, [undefined, currentColorIndex()]);
    });
    triggerRefresh('chars');
}

function paintConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return; }

    selection.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelChar(cell.row, cell.col, [undefined, currentColorIndex()]);
    })

    triggerRefresh('chars');
}


// -------------------------------------------------------------------------------- Color Picker

let currentColorStr = null;
let cachedColorIndex = null;

export function currentColorIndex() {
    if (cachedColorIndex !== null) {
        return cachedColorIndex;
    }
    return state.findOrCreateColor(currentColorStr);
}

const colorPickerElement = document.querySelector('#current-color');
const colorPicker = new Picker({
    parent: colorPickerElement,
    popup: 'top',
    onOpen: () => {
        const $done = $(colorPickerElement).find('.picker_done');
        $done.toggle(selection.hasSelection()).find('button').html("<span class='icon-paint-bucket'></span>");

        keyboard.toggleStandard(true);
    },
    onClose: () => {
        keyboard.toggleStandard(false);
    },
    onChange: (color) => {
        colorPickerElement.style.background = color.rgbaString;
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
