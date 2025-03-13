/**
 * This is the UI component for the canvas editing tools:
 * - The editing toolbar on the left of the main canvas (e.g. free draw, draw line, paint brush, etc.)
 * - The "submenu" toolbar that appears on the left when you've made a selection, or to choose a brush size, etc.
 * - The color picker on the left toolbar
 */

import Picker from 'vanilla-picker/csp';
import * as state from '../state/state.js';
import * as selection from '../canvas/selection.js';
import {triggerRefresh} from "../index.js";
import * as keyboard from "../io/keyboard.js";
import * as actions from "../io/actions.js";
import Color from "@sphinxxxx/color-conversion";
import {hoveredCell, iterateHoveredCells} from "../canvas/hover.js";
import tippy from 'tippy.js';
import {setupTooltips, shouldModifyAction} from "../io/actions.js";
import {strings} from "../config/strings.js";
import AsciiRect from "../geometry/ascii/ascii_rect.js";
import AsciiLine from "../geometry/ascii/ascii_line.js";
import AsciiFreeform from "../geometry/ascii/ascii_freeform.js";
import {translateGlyphs} from "../utils/arrays.js";
import {capitalizeFirstLetter} from "../utils/strings.js";
import {modifierAbbr} from "../utils/os.js";

// -------------------------------------------------------------------------------- Main External API

let $editingTools, $selectionTools, drawRectSubMenu, drawLineSubMenu, brushSubMenu,
    $canvasContainer, $canvasDetails, $canvasMessage;

export function init() {
    $canvasContainer = $('#canvas-container');
    $canvasDetails = $('#canvas-details');
    $canvasMessage = $('#canvas-message');
    
    setupEditingTools();
    setupFreeformChar();
    setupSelectionTools();
    setupDrawRectSubMenu();
    setupDrawLineSubMenu();
    setupBrushSubMenu();
    setupColorPicker();
}

export function refresh() {
    selectColor(state.config('primaryColor'))

    $editingTools.find('.editing-tool').removeClass('selected');
    $editingTools.find(`.editing-tool[data-tool='${state.config('tool')}']`).addClass('selected');

    refreshSelectionTools();
    drawRectSubMenu.refresh();
    drawLineSubMenu.refresh();
    brushSubMenu.refresh();

    $canvasDetails.find('.canvas-dimensions .value').html(`[${state.numCols()}x${state.numRows()}]`);
}

export function refreshMouseCoords(cell) {
    const show = cell && cell.isInBounds();
    $canvasDetails.find('.mouse-coordinates').toggle(!!show)
        .find('.value').html(show ? `${cell.col}:${cell.row}` : '&nbsp;');
}

export function refreshSelectionDimensions(cellArea) {
    const show = cellArea !== null;
    $canvasDetails.find('.selection-dimensions').toggle(!!show)
        .find('.value').html(show ? `${cellArea.numRows}x${cellArea.numCols}` : '&nbsp;');
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
        if (!canvasControl.initialized) return;
        const cell = canvasControl.cellAtExternalXY(mouseEvent.offsetX, mouseEvent.offsetY);
        canvasControl.$canvas.trigger(name, [mouseEvent, cell, state.config('tool')])
    }

    canvasControl.$canvas.on('mousedown', evt => {
        if (evt.which !== 1) return; // Only apply to left-click
        _emitEvent('editor:mousedown', evt);
    });
    canvasControl.$canvas.on('mousemove', evt => _emitEvent('editor:mousemove', evt));
    $(document).on('mouseup', evt => _emitEvent('editor:mouseup', evt));
    canvasControl.$canvas.on('dblclick', evt => _emitEvent('editor:dblclick', evt));
    canvasControl.$canvas.on('mouseenter', evt => _emitEvent('editor:mouseenter', evt));
    canvasControl.$canvas.on('mouseleave', evt => _emitEvent('editor:mouseleave', evt));

    /*  ---------------------  Event Listeners  ---------------------  */
    let prevCell; // Used to keep track of whether the mousemove is entering a new cell

    canvasControl.$canvas.on('editor:mousedown', (evt, mouseEvent, cell, tool) => {
        if (colorPickerOpen) return;

        switch(tool) {
            case 'draw-freeform-char':
                drawFreeformChar();
                break;
            case 'fill-char':
                fillConnectedCells(cell, freeformChar, state.primaryColorIndex(), {
                    diagonal: shouldModifyAction('editor.tools.fill-char.diagonal', mouseEvent),
                    charblind: false,
                    colorblind: shouldModifyAction('editor.tools.fill-char.colorblind', mouseEvent)
                });
                break;
            case 'draw-rect':
                startDrawing(AsciiRect, { drawType: state.config('drawRect').type });
                break;
            case 'draw-line':
                startDrawing(AsciiLine, { drawType: state.config('drawLine').type });
                break;
            case 'draw-freeform-ascii':
                startDrawing(AsciiFreeform, { canvas: canvasControl }, [mouseEvent]);
                break;
            case 'eraser':
                erase();
                break;
            case 'paint-brush':
                paintBrush();
                break;
            case 'fill-color':
                fillConnectedCells(cell, undefined, state.primaryColorIndex(), {
                    diagonal: shouldModifyAction('editor.tools.fill-color.diagonal', mouseEvent),
                    charblind: true,
                    colorblind: shouldModifyAction('editor.tools.fill-color.colorblind', mouseEvent)
                });
                break;
            case 'color-swap':
                colorSwap(cell, {
                    allLayers: shouldModifyAction('editor.tools.color-swap.all-layers', mouseEvent),
                    allFrames: shouldModifyAction('editor.tools.color-swap.all-frames', mouseEvent)
                })
                break;
            case 'eyedropper':
                eyedropper(cell, {
                    addToPalette: shouldModifyAction('editor.tools.eyedropper.add-to-palette', mouseEvent)
                });
                break;
            case 'pan':
                // Pan tool is already handled by the setupMousePan() call in canvas_stack.js
                break;
            case 'move-all':
                startMoveAll(cell, mouseEvent);
                break;
            default:
                return; // Ignore all other tools
        }
    });

    canvasControl.$canvas.on('editor:mousemove', (evt, mouseEvent, cell, tool) => {
        if (colorPickerOpen) return;

        $canvasContainer.css('cursor', cursorStyle(evt, mouseEvent, cell, tool));

        if (mouseEvent.which !== 1) return; // only care about left-click

        // Keep track of whether the mousemove has reached a new cell (helps with performance, so we can just redraw
        // when a new cell is reached, not on every pixel change)
        const isNewCell = !prevCell || !prevCell.equals(cell);
        prevCell = cell;

        switch(tool) {
            case 'draw-freeform-char':
                if (!isNewCell) return;
                drawFreeformChar();
                break;
            case 'draw-rect':
            case 'draw-line':
                if (!isNewCell) return;
                updateDrawing();
                break;
            case 'draw-freeform-ascii':
                // Do not return early if we're still on the same cell; we need pixel accuracy
                updateDrawing([mouseEvent]);
                break;
            case 'eraser':
                if (!isNewCell) return;
                erase();
                break;
            case 'paint-brush':
                if (!isNewCell) return;
                paintBrush();
                break;
            case 'move-all':
                if (!isNewCell) return;
                updateMoveAll(cell, isNewCell);
                break;
            default:
                return; // Ignore all other tools
        }
    });

    canvasControl.$canvas.on('editor:mouseup', (evt, mouseEvent, cell, tool) => {
        if (colorPickerOpen) return;

        switch(tool) {
            case 'draw-freeform-char':
            case 'eraser':
            case 'paint-brush':
                // These handlers save a 'modifiable' state during mousemove, so end modifications on mouseup
                state.endHistoryModification();
                break;
            case 'draw-rect':
            case 'draw-line':
            case 'draw-freeform-ascii':
                finishDrawing();
                break;
            case 'move-all':
                finishMoveAll();
                break;
            default:
                return; // Ignore all other tools
        }
    });
}



// -------------------------------------------------------------------------------- Editing Tools

function setupEditingTools() {
    $editingTools = $('#editing-tools');

    $editingTools.find('.editing-tool').each(function(i, element) {
        const $element = $(element);
        const tool = $element.data('tool');
        const actionData = { callback: () => changeTool(tool) }

        // Some tools have custom shortcuts
        switch (tool) {
            case 'pan':
                actionData.shortcutAbbr = 'Right Click'
                break;
        }

        actions.registerAction(actionIdForTool(tool), actionData);
    });

    $editingTools.off('click', '.editing-tool').on('click', '.editing-tool', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction(actionIdForTool($element.data('tool')));
    });

    const $leftTools = $editingTools.find('.editing-tool-column:first-child .editing-tool').toArray();
    const $rightTools = $editingTools.find('.editing-tool-column:last-child .editing-tool').toArray();
    const TIP_X_OFFSET = 15; // Move the tip a bit to the right so it's over the canvas
    setupTooltips($leftTools, element => actionIdForTool($(element).data('tool')), {
        offset: [0, TIP_X_OFFSET + 43] // 42px for the button to the right ($editing-tool-size), 1px for margin
    });
    setupTooltips($rightTools, element => actionIdForTool($(element).data('tool')), {
        offset: [0, TIP_X_OFFSET]
    });
}

function actionIdForTool(tool) {
    return `editor.tools.${tool}`;
}


// -------------------------------------------------------------------------------- Selection Tools

function setupSelectionTools() {
    $selectionTools = $('#selection-tools');

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
    
    registerAction('move', () => selection.toggleMovingContent(), false, true, `${modifierAbbr('metaKey')}Click`);
    registerAction('typewriter', () => selection.toggleCursor(), true, false, 'Double Click');
    registerAction('flip-v', e => selection.flipVertically(shouldModifyAction('editor.selection.flip-v.mirror', e)));
    registerAction('flip-h', e => selection.flipHorizontally(shouldModifyAction('editor.selection.flip-h.mirror', e)));
    registerAction('clone', () => selection.cloneToAllFrames());
    registerAction('fill-color', () => paintSelection());
    registerAction('resize', () => resizeToSelection());
    registerAction('close', () => selection.clear(), true, true, 'Esc');

    $selectionTools.off('click', '.sub-tool').on('click', '.sub-tool', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction(actionIdForSelectionTool($element.data('tool')), evt);
    });

    setupTooltips($selectionTools.find('.sub-tool').toArray(), element => actionIdForSelectionTool($(element).data('tool')));
}

function actionIdForSelectionTool(tool) {
    return `editor.selection.${tool}`;
}

function refreshSelectionTools() {
    $selectionTools.toggle(selection.hasSelection());

    // Hide typewriter when using text-editor tool
    $selectionTools.find('.sub-tool[data-tool="typewriter"]').toggle(state.config('tool') !== 'text-editor');

    $selectionTools.find('.sub-tool[data-tool="move"]').toggleClass('active', !!selection.movableContent);
    $selectionTools.find('.sub-tool[data-tool="typewriter"]').toggleClass('active', !!selection.cursorCell);

    $selectionTools.find('.sub-tool').each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled(actionIdForSelectionTool($element.data('tool'))));
    });
}

function paintSelection() {
    const primaryColorIndex = state.primaryColorIndex();

    selection.getSelectedCells().forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, undefined, primaryColorIndex);
    });

    triggerRefresh('chars', true);
}

function resizeToSelection() {
    const area = selection.getSelectedCellArea().bindToDrawableArea();
    state.resize([area.numCols, area.numRows], area.topLeft.row, area.topLeft.col);
}


// -------------------------------------------------------------------------------- Brushing shapes / painting

export const BRUSH_TOOLS = ['draw-freeform-char', 'eraser', 'paint-brush'];

function setupBrushSubMenu() {
    brushSubMenu = new ToolSubMenu({
        $menu: $('#brush-shapes'),
        configKey: 'brush',
        visible: () => BRUSH_TOOLS.includes(state.config('tool')),
        tooltipContent: $tool => {
            const shape = $tool.data('shape');
            const size = $tool.data('size');
            return `<span class="title">${capitalizeFirstLetter(shape)} Brush</span><br><span>Size: ${size}</span>`;
        }
    })
}

function drawFreeformChar() {
    const primaryColorIndex = state.primaryColorIndex();
    iterateHoveredCells(cell => state.setCurrentCelGlyph(cell.row, cell.col, freeformChar, primaryColorIndex));

    triggerRefresh('chars', 'drawFreeformChar');
}

function erase() {
    iterateHoveredCells(cell => state.setCurrentCelGlyph(cell.row, cell.col, '', 0));

    triggerRefresh('chars', 'erase');
}

function fillConnectedCells(cell, char, colorIndex, options) {
    if (!cell.isInBounds()) return;

    selection.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, char, colorIndex);
    })

    triggerRefresh('chars', true);
}

function paintBrush() {
    const primaryColorIndex = state.primaryColorIndex();
    iterateHoveredCells(cell => state.setCurrentCelGlyph(cell.row, cell.col, undefined, primaryColorIndex));

    triggerRefresh('chars', 'paintBrush');
}

function colorSwap(cell, options) {
    if (!cell.isInBounds()) return;

    const [targetChar, targetColor] = state.getCurrentCelGlyph(cell.row, cell.col);
    if (targetChar === '') return;

    const primaryColorIndex = state.primaryColorIndex();

    state.iterateCels(options.allLayers, options.allFrames, cel => {
        state.iterateCellsForCel(cel, (row, col, char, color) => {
            if (color === targetColor) state.setCelGlyph(cel, row, col, char, primaryColorIndex);
        });
    })

    // Need full refresh if multiple frames in sidebar need updating
    triggerRefresh(options.allFrames ? 'full' : 'chars', true);
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

    // Making it possible to visualize characters that don't actually take up space
    let visibleChar = char;
    if (char === ' ') visibleChar = '␣';
    if (char === '') visibleChar = '∅';

    $freeformChar.html(visibleChar);
}

export function shouldUpdateFreeformChar() {
    // return state.config('tool') === 'draw-freeform-char' || state.config('tool') === 'fill-char';

    // Currently we are always updating the freeform char, even if a freeform tool is not selected
    return true;
}


// -------------------------------------------------------------------------------- Drawing

function setupDrawRectSubMenu() {
    drawRectSubMenu = new ToolSubMenu({
        $menu: $('#draw-rect-types'),
        configKey: 'drawRect',
        visible: () => state.config('tool') === 'draw-rect',
        tooltipContent: $tool => {
            const type = $tool.data('type');
            const name = strings[`editor.draw-rect-types.${type}.name`];
            const description = strings[`editor.draw-rect-types.${type}.description`];
            return `<span class="title">${name}</span><br><span>${description}</span>`;
        }
    })
}

function setupDrawLineSubMenu() {
    drawLineSubMenu = new ToolSubMenu({
        $menu: $('#draw-line-types'),
        configKey: 'drawLine',
        visible: () => false, // We currently only have one sub-menu option so no need to show this
        tooltipContent: $tool => {
            const type = $tool.data('type');
            const name = strings[`editor.draw-line-types.${type}.name`];
            const description = strings[`editor.draw-line-types.${type}.description`];
            return `<span class="title">${name}</span><br><span>${description}</span>`;
        }
    })
}

export let drawingContent = null;

function startDrawing(klass, options = {}, recalculateArgs = []) {
    options = $.extend({ colorIndex: state.primaryColorIndex() }, options);
    drawingContent = new klass(hoveredCell, options);
    updateDrawing(recalculateArgs);
}

function updateDrawing(recalculateArgs = []) {
    if (!drawingContent) return;
    if (!hoveredCell) return;

    drawingContent.end = hoveredCell;
    drawingContent.recalculate(...recalculateArgs);

    triggerRefresh('chars');
}

function finishDrawing() {
    if (!drawingContent) return;

    translateGlyphs(drawingContent.glyphs, drawingContent.origin, (r, c, char, color) => {
        state.setCurrentCelGlyph(r, c, char, color);
    });

    drawingContent = null;
    triggerRefresh('full', true);
}



// -------------------------------------------------------------------------------- Move-all tool
// The move-all tool moves all content in the canvas

let moveAllOrigin = null; // Where the move started
export let moveAllOffset = null; // How far from the origin the move is
export let moveAllModifiers = {}; // What modifiers were used (e.g. all layers, wrapping) at the start of the move

function startMoveAll(cell, mouseEvent) {
    moveAllOrigin = cell;

    moveAllModifiers = {
        allLayers: shouldModifyAction('editor.tools.move-all.all-layers', mouseEvent),
        allFrames: shouldModifyAction('editor.tools.move-all.all-frames', mouseEvent),
        wrap: shouldModifyAction('editor.tools.move-all.wrap', mouseEvent),
    }
}

function updateMoveAll(cell, isNewCell) {
    if (moveAllOrigin && isNewCell) {
        moveAllOffset = [cell.row - moveAllOrigin.row, cell.col - moveAllOrigin.col];
        triggerRefresh('chars');
    }
}

function finishMoveAll() {
    if (moveAllOffset) {
        state.iterateCels(moveAllModifiers.allLayers, moveAllModifiers.allFrames, cel => {
            state.translateCel(cel, moveAllOffset[0], moveAllOffset[1], moveAllModifiers.wrap)
        });

        moveAllOffset = null;
        moveAllOrigin = null;
        triggerRefresh('full', true);
    }
}

// -------------------------------------------------------------------------------- Color Picker

let colorPicker, colorPickerTooltip, $addToPalette, addToPaletteTooltip;
let colorPickerOpen = false;

export function selectColor(colorStr) {
    colorPicker.setColor(colorStr, false);
}

function setupColorPicker() {
    const $colorPicker = $('#current-color');

    colorPickerTooltip = tippy($colorPicker.get(0), {
        content: `<span class="title">Primary Color</span><br>` +
            `<span>Click to change.</span>`,
        placement: 'right',
        allowHTML: true,
    })

    colorPicker = new Picker({
        parent: $colorPicker.get(0),
        popup: 'top',
        onOpen: () => {
            keyboard.toggleStandard(true);
            colorPickerTooltip.disable();
            $colorPicker.addClass('picker-open');
            colorPickerOpen = true;

            if (!$addToPalette) {
                $addToPalette = $colorPicker.find('.picker_sample');
                addToPaletteTooltip = tippy($addToPalette.get(0), {
                    content: () => {
                        return `<span class="title">Add Color To Palette</span><br>` +
                            `<span>This color is not currently saved to your palette. Click here if you want to add it.</span>`;
                    },
                    placement: 'right',
                    offset: [0, 20],
                    allowHTML: true,
                })
            }

            refreshAddToPalette();
        },
        onClose: () => {
            keyboard.toggleStandard(false);
            colorPickerTooltip.enable();
            $colorPicker.removeClass('picker-open');
            colorPickerOpen = false;
        },
        onChange: (color) => {
            state.config('primaryColor', color[state.COLOR_FORMAT]);
            $colorPicker.css('background', state.config('primaryColor'));

            refreshAddToPalette();
            triggerRefresh('paletteSelection');
        },
    });

    $colorPicker.on('click', '.add-to-palette', () => {
        state.addColor(state.config('primaryColor'));

        refreshAddToPalette();
        triggerRefresh('palette', true);
    })
}

function refreshAddToPalette() {
    if (!$addToPalette) return;

    $addToPalette.empty();

    if (state.isNewColor(state.config('primaryColor'))) {
        $addToPalette.addClass('add-to-palette');

        const [h, s, l, a] = new Color(state.config('primaryColor')).hsla; // Break colorStr into hsla components

        $('<span>', {
            css: { color: l <= 0.5 ? 'white' : 'black' },
            class: 'ri ri-fw ri-alert-line'
        }).appendTo($addToPalette);

        addToPaletteTooltip.enable();
    }
    else {
        $addToPalette.removeClass('add-to-palette');
        addToPaletteTooltip.disable();
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
        case 'draw-freeform-ascii':
        case 'draw-freeform-char':
        case 'fill-char':
        case 'eraser':
        case 'paint-brush':
        case 'fill-color':
        case 'color-swap':
        case 'eyedropper':
            return 'cell';
        case 'pan':
        case 'move-all':
            return 'grab';
        default:
            return 'default';
    }
}


class ToolSubMenu {
    constructor(options = {}) {
        this.$menu = options.$menu;
        this.options = options;
        this.setup();
    }

    get state() {
        return state.config(this.options.configKey);
    }

    set state(newState) {
        state.config(this.options.configKey, newState);
    }

    setup() {
        this.$menu.off('click', '.sub-tool').on('click', '.sub-tool', evt => {
            const $tool = $(evt.currentTarget);
            const newState = {};
            Object.keys(this.state).forEach(dataAttr => {
                newState[dataAttr] = $tool.data(dataAttr);
            })
            this.state = newState;
            this.refresh();
        });

        if (this.options.tooltipContent) {
            tippy(this.$menu.find('.sub-tool').toArray(), {
                content: element => this.options.tooltipContent($(element)),
                placement: 'right',
                hideOnClick: false,
                allowHTML: true
            })
        }
    }

    refresh() {
        let show = this.options.visible();
        this.$menu.toggle(show);

        if (show) {
            let str = '';
            for (const [key, value] of Object.entries(this.state)) {
                str += `[data-${key}="${value}"]`;
            }
            this.$menu.find('.sub-tool').toggleClass('active', false);
            this.$menu.find(`.sub-tool${str}`).toggleClass('active', true);
        }
    }

}