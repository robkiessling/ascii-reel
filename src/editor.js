import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as selection from './selection.js';
import {triggerRefresh} from "./index.js";
import * as keyboard from "./keyboard.js";
import * as palette from "./palette.js";
import Color from "@sphinxxxx/color-conversion";
import {iterateHoveredCells} from "./hover.js";

// -------------------------------------------------------------------------------- Main External API

let $tools, $canvasContainer, $selectionTools, $brushShapes, $canvasDetails;

export function init() {
    $tools = $('#editing-tools');
    $canvasContainer = $('#canvas-container');
    $selectionTools = $('#selection-tools');
    $brushShapes = $('#brush-shapes');
    $canvasDetails = $('#canvas-details');
    
    $tools.off('click', '.editing-tool').on('click', '.editing-tool', (evt) => {
        changeTool($(evt.currentTarget).data('tool'));
    });

    setupFreeformChar();
    setupSelectionTools();
    setupBrushShapes();
    setupColorPicker();
}

export function refresh() {
    if (cachedColorString === null) {
        // initial color picker state
        selectColor(palette.DEFAULT_COLOR);
    }

    $tools.find('.editing-tool').removeClass('selected');
    $tools.find(`.editing-tool[data-tool='${state.config('tool')}']`).addClass('selected');

    refreshSelectionTools();
    refreshBrushShapes();

    $canvasDetails.find('.dimensions .value').html(`${state.numCols()}:${state.numRows()}`);
}

export function updateMouseCoords(cell) {
    const show = cell && cell.isInBounds();
    $canvasDetails.find('.mouse-coordinates').toggle(!!show)
        .find('.value').html(show ? `${cell.col}:${cell.row}` : '&nbsp;');
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
            case 'draw-freeform':
                drawCharShape();
                break;
            case 'paint-brush':
                paintShape();
                break;
            case 'paint-bucket':
                paintConnectedCells(cell, { diagonal: mouseEvent.metaKey });
                break;
            default:
                return; // Ignore all other tools
        }
    });

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell, tool) => {
        $canvasContainer.css('cursor', cursorStyle(evt, mouseEvent, cell, tool));

        switch(tool) {
            case 'draw-freeform':
                if (mouseEvent.which === 1) {
                    drawCharShape(cell);
                }
                break;
            case 'paint-brush':
                if (mouseEvent.which === 1) {
                    paintShape(cell);
                }
                break;
            default:
                return; // Ignore all other tools
        }
    });
}



// -------------------------------------------------------------------------------- Selection Editor
// Tools that are allowed when the given tool is selected
const MOVE_TOOLS = ['move'];
const TYPEWRITER_TOOLS = ['typewriter'];//, 'cut', 'copy', 'paste'];

function setupSelectionTools() {
    bindSelectionToolEvent('move', () => selection.toggleMovingContent());
    bindSelectionToolEvent('typewriter', () => selection.toggleCursor());
    // bindSelectionToolEvent('cut', () => clipboard.cut());
    // bindSelectionToolEvent('copy', () => clipboard.copy());
    // bindSelectionToolEvent('paste', (e) => clipboard.paste(e.shiftKey));
    bindSelectionToolEvent('flip-v', (e) => selection.flipVertically(e.shiftKey));
    bindSelectionToolEvent('flip-h', (e) => selection.flipHorizontally(e.shiftKey));
    bindSelectionToolEvent('paint-bucket', () => paintSelection());
    bindSelectionToolEvent('resize', () => resizeToSelection());
    bindSelectionToolEvent('close', () => selection.clear());
}

function bindSelectionToolEvent(tool, onClick) {
    $selectionTools.find(`.selection-tool[data-tool="${tool}"]`).off('click').on('click', evt => {
        if (!$(evt.currentTarget).hasClass('disabled')) {
            onClick(evt);
        }
    })
}

function refreshSelectionTools() {
    $selectionTools.toggle(selection.hasSelection());

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
        state.setCurrentCelGlyph(cell.row, cell.col, undefined, currentColorIndex());
    });
    triggerRefresh('chars', true);
}

function resizeToSelection() {
    const area = selection.getSelectedCellArea();
    state.resize([area.numCols, area.numRows], area.topLeft.row, area.topLeft.col);
}

// -------------------------------------------------------------------------------- Brushing shapes / painting

export const BRUSH_TOOLS = ['draw-freeform', 'paint-brush'];

function setupBrushShapes() {
    $brushShapes.off('click', '.brush-shape').on('click', '.brush-shape', evt => {
        const $shape = $(evt.currentTarget);

        state.config('brushShape', {
            shape: $shape.data('shape'),
            size: $shape.data('size')
        });
        refreshBrushShapes();
    });
}

function refreshBrushShapes() {
    let show = BRUSH_TOOLS.includes(state.config('tool'))
    $brushShapes.toggle(show);

    if (show) {
        $brushShapes.find('.brush-shape').toggleClass('active', false);

        let { shape, size } = state.config('brushShape');
        $brushShapes.find(`.brush-shape[data-shape="${shape}"][data-size="${size}"]`).toggleClass('active', true);
    }
}

function drawCharShape() {
    let hasChanges = false;

    iterateHoveredCells(cell => {
        const [currentChar, currentColor] = state.getCurrentCelGlyph(cell.row, cell.col);

        // Only updating char if it is actually different (this needs to be efficient since we call this on mousemove)
        if (currentChar !== undefined && (currentChar !== freeformChar || currentColor !== currentColorIndex())) {
            state.setCurrentCelGlyph(cell.row, cell.col, freeformChar, currentColorIndex());
            hasChanges = true;
        }
    });

    if (hasChanges) {
        triggerRefresh('chars', true);
    }
}

function paintShape() {
    let hasChanges = false;

    iterateHoveredCells(cell => {
        const [currentChar, currentColor] = state.getCurrentCelGlyph(cell.row, cell.col);

        // Only refreshing if color is actually different (this needs to be efficient since we call this on mousemove)
        if (currentChar !== undefined && currentColor !== currentColorIndex()) {
            state.setCurrentCelGlyph(cell.row, cell.col, undefined, currentColorIndex());
            hasChanges = true;
        }
    });

    if (hasChanges) {
        triggerRefresh('chars', true);
    }
}

function paintConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return; }

    selection.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, undefined, currentColorIndex());
    })

    triggerRefresh('chars', true);
}


// -------------------------------------------------------------------------------- Freeform Char

let freeformChar, $freeformChar;

function setupFreeformChar() {
    $freeformChar = $('.freeform-char');
    setFreeformChar('A'); // initial value
}

export function setFreeformChar(char) {
    freeformChar = char;
    $freeformChar.html(freeformChar);
}



// -------------------------------------------------------------------------------- Color Picker

let cachedColorString = null;
let cachedColorIndex = null;
let $addToPalette, colorPicker;

// Returns the currently selected colorIndex, or creates a new index if a new color is selected.
// Also caching the result for faster performance since this gets called a lot in a loop
export function currentColorIndex() {
    if (cachedColorIndex !== null) {
        return cachedColorIndex;
    }
    return state.colorIndex(cachedColorString);
}

// Returns color string of currently selected color. Note: color might not yet be a part of state's colorTable
export function currentColorString() {
    return cachedColorString;
}

export function selectColor(colorStr) {
    colorPicker.setColor(colorStr, false);
}

const SHOW_ADD_ICON = false; // todo decide how I want to do this. Note: there is also associated css to uncomment

function setupColorPicker() {
    const $colorPicker = $('#current-color');

    colorPicker = new Picker({
        parent: $colorPicker.get(0),
        popup: 'top',
        onOpen: () => {
            keyboard.toggleStandard(true);

            if (SHOW_ADD_ICON) {
                if (!$addToPalette) {
                    $addToPalette = $('<div>', {
                        class: 'add-to-palette',
                        html: '<button><span class="ri ri-fw ri-alert-line"></span></button>'
                    }).appendTo($colorPicker.find('.picker_wrapper'));
                }
            }
            else {
                if (!$addToPalette) {
                    $addToPalette = $colorPicker.find('.picker_sample');
                }
            }

            refreshAddToPalette();
        },
        onClose: () => {
            keyboard.toggleStandard(false);
        },
        onChange: (color) => {
            $colorPicker.get(0).style.background = color[state.COLOR_FORMAT];
            cachedColorString = color[state.COLOR_FORMAT];
            cachedColorIndex = null;

            refreshAddToPalette();
            triggerRefresh('paletteSelection');
        },
    });

    $colorPicker.on('click', '.add-to-palette', () => {
        state.addColor(cachedColorString);

        refreshAddToPalette();
        triggerRefresh('palette', true);
    })
}

function refreshAddToPalette() {
    if ($addToPalette) {
        if (SHOW_ADD_ICON) {
            $addToPalette.toggleClass('hidden', !state.isNewColor(cachedColorString));
        }
        else {
            $addToPalette.empty();

            if (state.isNewColor(cachedColorString)) {
                $addToPalette.addClass('add-to-palette');

                const [h, s, l, a] = new Color(cachedColorString).hsla; // Break colorStr into hsla components

                $('<span>', {
                    css: { color: l <= 0.5 ? 'white' : 'black' },
                    class: 'ri ri-fw ri-alert-line'
                }).appendTo($addToPalette);
            }
            else {
                $addToPalette.removeClass('add-to-palette');
            }
        }
    }
}



// -------------------------------------------------------------------------------- Misc.

function cursorStyle(evt, mouseEvent, cell, tool) {
    switch (tool) {
        case 'text-editor':
            return selection.isSelectedCell(cell) && selection.allowMovement(tool, mouseEvent) ? 'grab' : 'text';
        case 'selection-rect':
        case 'selection-line':
        case 'selection-lasso':
        case 'selection-wand':
            return selection.isSelectedCell(cell) ? 'grab' : 'cell';
        case 'draw-rect':
        case 'draw-line':
        case 'draw-freeform':
            return 'cell';
        case 'paint-brush':
        case 'paint-bucket':
            return 'cell';
        case 'move':
            return 'grab';
        default:
            return 'default';
    }
}
