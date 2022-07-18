import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';
import * as selection from './selection.js';
import {triggerRefresh} from "./index.js";
import * as keyboard from "./keyboard.js";
import * as palette from "./palette.js";
import * as actions from "./actions.js";
import Color from "@sphinxxxx/color-conversion";
import {iterateHoveredCells} from "./hover.js";
import tippy from 'tippy.js';
import {capitalizeFirstLetter} from "./utilities.js";
import {setupTooltips, shouldModifyAction} from "./actions.js";

// -------------------------------------------------------------------------------- Main External API

let $editingTools, $canvasContainer, $selectionTools, $brushShapes, $canvasDetails, $canvasMessage;

export function init() {
    $editingTools = $('#editing-tools');
    $canvasContainer = $('#canvas-container');
    $selectionTools = $('#selection-tools');
    $brushShapes = $('#brush-shapes');
    $canvasDetails = $('#canvas-details');
    $canvasMessage = $('#canvas-message');
    
    setupEditingTools();
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

    $editingTools.find('.editing-tool').removeClass('selected');
    $editingTools.find(`.editing-tool[data-tool='${state.config('tool')}']`).addClass('selected');

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



export function showCanvasMessage(message) {
    $canvasMessage.show().html(message);
}

export function hideCanvasMessage() {
    $canvasMessage.hide();
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
                paintConnectedCells(cell, {
                    // Uses same diagonal/colorblind modifications as selection-wand tool
                    diagonal: true, //shouldModifyAction('editor.tools.selection-wand.diagonal', mouseEvent),
                    colorblind: shouldModifyAction('editor.tools.selection-wand.colorblind', mouseEvent)
                });
                break;
            case 'eyedropper':
                eyedropper(cell, {
                    addToPalette: shouldModifyAction('editor.tools.eyedropper.add-to-palette', mouseEvent)
                });
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

    canvasControl.$canvas.on('editor:mouseup', (evt, mouseEvent, cell, tool) => {
        switch(tool) {
            case 'draw-freeform':
            case 'paint-brush':
                // drawCharShape and paintShape save a 'modifiable' state during mousemove, so end modifications on mouseup
                state.endHistoryModification();
                break;
            default:
                return; // Ignore all other tools
        }
    });
}



// -------------------------------------------------------------------------------- Editing Tools

function setupEditingTools() {
    $editingTools.find('.editing-tool').each(function(i, element) {
        const $element = $(element);
        const tool = $element.data('tool');
        actions.registerAction(actionIdForTool(tool), () => changeTool(tool));
    });

    $editingTools.off('click', '.editing-tool').on('click', '.editing-tool', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction(actionIdForTool($element.data('tool')));
    });

    setupTooltips('.editing-tool', element => actionIdForTool($(element).data('tool')));
}

function actionIdForTool(tool) {
    return `editor.tools.${tool}`;
}


// -------------------------------------------------------------------------------- Selection Tools

function setupSelectionTools() {
    function registerAction(tool, callback, disableOnMove = true, disableOnCursor = true, shortcutAbbr) {
        actions.registerAction(actionIdForSelectionTool(tool), {
            callback: callback,
            enabled: () => {
                if (disableOnMove && selection.movableContent) { return false; }
                if (disableOnCursor && selection.cursorCell) { return false; }
                return true;
            },
            shortcutAbbr: shortcutAbbr
        });
    }
    
    registerAction('move', () => selection.toggleMovingContent(), false, true, '⌘ Click');
    registerAction('typewriter', () => selection.toggleCursor(), true, false, 'Double click');
    registerAction('flip-v', e => selection.flipVertically(shouldModifyAction('editor.selection.flip-v.mirror', e)));
    registerAction('flip-h', e => selection.flipHorizontally(shouldModifyAction('editor.selection.flip-h.mirror', e)));
    registerAction('paint-bucket', () => paintSelection());
    registerAction('resize', () => resizeToSelection());
    registerAction('close', () => selection.clear(), true, true, 'Esc');

    $selectionTools.off('click', '.selection-tool').on('click', '.selection-tool', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction(actionIdForSelectionTool($element.data('tool')), evt);
    });

    setupTooltips('.selection-tool', element => actionIdForSelectionTool($(element).data('tool')));
}

function actionIdForSelectionTool(tool) {
    return `editor.selection.${tool}`;
}

function refreshSelectionTools() {
    $selectionTools.toggle(selection.hasSelection());

    // Hide typewriter when using text-editor tool
    $selectionTools.find('.selection-tool[data-tool="typewriter"]').toggle(state.config('tool') !== 'text-editor');

    $selectionTools.find('.selection-tool[data-tool="move"]').toggleClass('active', !!selection.movableContent);
    $selectionTools.find('.selection-tool[data-tool="typewriter"]').toggleClass('active', !!selection.cursorCell);

    $selectionTools.find('.selection-tool').each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled(actionIdForSelectionTool($element.data('tool'))));
    });
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

    tippy('.brush-shape', {
        content: element => {
            const $element = $(element);
            const shape = $element.data('shape');
            const size = $element.data('size');
            return `<span class="title">${capitalizeFirstLetter(shape)} Brush</span><br><span>Size: ${size}</span>`;
        },
        placement: 'right',
        hideOnClick: false,
        allowHTML: true
    })
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
        triggerRefresh('chars', 'drawCharShape');
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
        triggerRefresh('chars', 'paintShape');
    }
}

function paintConnectedCells(cell, options) {
    if (!cell.isInBounds()) { return; }

    selection.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, undefined, currentColorIndex());
    })

    triggerRefresh('chars', true);
}

function eyedropper(cell, options) {
    const [char, colorIndex] = state.getCurrentCelGlyph(cell.row, cell.col);
    const colorStr = state.colorStr(colorIndex);
    selectColor(colorStr);

    if (options.addToPalette) {
        state.addColor(colorStr);
        triggerRefresh('palette', true);
    }
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
        case 'eyedropper':
            return 'cell';
        case 'move':
            return 'grab';
        default:
            return 'default';
    }
}
