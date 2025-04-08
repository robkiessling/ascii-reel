/**
 * This is the UI component for the canvas toolbar:
 * - The standard toolbar on the left of the main canvas (e.g. free draw, draw line, paint brush, etc.)
 * - The submenu toolbar that appears on the left when you've made a selection, or to choose a brush size, etc.
 * - The color picker on the left toolbar
 */

import Picker from 'vanilla-picker/csp';
import * as state from '../state/index.js';
import * as selection from './selection.js';
import * as keyboard from "../io/keyboard.js";
import * as actions from "../io/actions.js";
import Color from "@sphinxxxx/color-conversion";
import tippy from 'tippy.js';
import {setupTooltips, shouldModifyAction} from "../io/actions.js";
import {strings} from "../config/strings.js";
import AsciiRect from "../geometry/ascii/ascii_rect.js";
import AsciiLine from "../geometry/ascii/ascii_line.js";
import AsciiFreeform from "../geometry/ascii/ascii_freeform.js";
import {translateGlyphs} from "../utils/arrays.js";
import {capitalizeFirstLetter} from "../utils/strings.js";
import {modifierAbbr} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";
import Cell from "../geometry/cell.js";

// -------------------------------------------------------------------------------- Main External API

let $standardTools, $selectionTools, drawRectSubMenu, drawLineSubMenu, brushSubMenu, $canvasContainer;

export function init() {
    $canvasContainer = $('#canvas-container');

    setupEventBus();
    setupStandardTools();
    setupPickedChar();
    setupSelectionTools();
    setupDrawRectSubMenu();
    setupDrawLineSubMenu();
    setupBrushSubMenu();
    setupColorPicker();
}

function refresh() {
    selectColor(state.getConfig('primaryColor'))

    $standardTools.find('.standard-tool').removeClass('selected');
    $standardTools.find(`.standard-tool[data-tool='${state.getConfig('tool')}']`).addClass('selected');

    refreshSelectionTools();
    drawRectSubMenu.refresh();
    drawLineSubMenu.refresh();
    brushSubMenu.refresh();
}

export function changeTool(newTool) {
    state.setConfig('tool', newTool);
    selection.clear();
    refresh();
}


// -------------------------------------------------------------------------------- Events

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED, EVENTS.SELECTION.CURSOR_MOVED], () => refresh())

    let prevCell; // Used to keep track of whether the mousemove is entering a new cell
    let editorMousedown = false; // Used to keep track of whether the mousedown started in the editor canvas

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl }) => {
        if (mouseEvent.which !== 1) return; // Only apply to left-click

        const tool = state.getConfig('tool')

        editorMousedown = true;
        prevCell = undefined;

        switch(tool) {
            case 'draw-freeform-char':
                drawFreeformChar(cell);
                break;
            case 'eraser':
                erase(cell);
                break;
            case 'paint-brush':
                paintBrush(cell);
                break;
            case 'draw-rect':
                startDrawing(cell, AsciiRect, { drawType: state.getConfig('drawRect').type });
                break;
            case 'draw-line':
                startDrawing(cell, AsciiLine, { drawType: state.getConfig('drawLine').type });
                break;
            case 'draw-freeform-ascii':
                startDrawing(cell, AsciiFreeform, { canvas: canvasControl }, [mouseEvent]);
                break;
            case 'fill-char':
                fillConnectedCells(cell, pickedChar, state.primaryColorIndex(), {
                    diagonal: shouldModifyAction('tools.standard.fill-char.diagonal', mouseEvent),
                    charblind: false,
                    colorblind: shouldModifyAction('tools.standard.fill-char.colorblind', mouseEvent)
                });
                break;
            case 'fill-color':
                fillConnectedCells(cell, undefined, state.primaryColorIndex(), {
                    diagonal: shouldModifyAction('tools.standard.fill-color.diagonal', mouseEvent),
                    charblind: true,
                    colorblind: shouldModifyAction('tools.standard.fill-color.colorblind', mouseEvent)
                });
                break;
            case 'color-swap':
                colorSwap(cell, {
                    allLayers: shouldModifyAction('tools.standard.color-swap.all-layers', mouseEvent),
                    allFrames: shouldModifyAction('tools.standard.color-swap.all-frames', mouseEvent)
                })
                break;
            case 'eyedropper':
                eyedropper(cell, {
                    addToPalette: shouldModifyAction('tools.standard.eyedropper.add-to-palette', mouseEvent)
                });
                break;
            case 'pan':
                // Pan tool is already handled by main_canvas.js
                break;
            case 'move-all':
                startMoveAll(cell, mouseEvent);
                break;
            default:
                return; // Ignore all other tools
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell }) => {
        const tool = state.getConfig('tool')

        $canvasContainer.css('cursor', cursorStyle(mouseEvent, cell, tool));

        if (!editorMousedown) return;
        if (mouseEvent.which !== 1) return; // Only apply to left-click
        if (mouseEvent.buttons === 0) return; // Catch firefox mousemove bug where mouseEvent.which is 1 when no buttons pressed

        // Keep track of whether the mousemove has reached a new cell (helps with performance, so we can just redraw
        // when a new cell is reached, not on every pixel change)
        const isNewCell = !prevCell || !prevCell.equals(cell);

        switch(tool) {
            case 'draw-freeform-char':
                if (isNewCell) drawFreeformChar(cell, prevCell);
                break;
            case 'eraser':
                if (isNewCell) erase(cell, prevCell);
                break;
            case 'paint-brush':
                if (isNewCell) paintBrush(cell, prevCell);
                break;
            case 'draw-rect':
            case 'draw-line':
                if (isNewCell) updateDrawing(cell);
                break;
            case 'draw-freeform-ascii':
                // Intentionally not checking if isNewCell; we update the char based on pixels not cells
                updateDrawing(cell, [mouseEvent]);
                break;
            case 'move-all':
                if (isNewCell) updateMoveAll(cell, isNewCell);
                break;
        }

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent }) => {
        if (mouseEvent.which !== 1) return; // Only apply to left-click
        if (!editorMousedown) return;

        editorMousedown = false;

        const tool = state.getConfig('tool')

        switch(tool) {
            case 'draw-freeform-char':
            case 'eraser':
            case 'paint-brush':
                state.pushHistory();
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



// -------------------------------------------------------------------------------- Standard Tools

function setupStandardTools() {
    $standardTools = $('#standard-tools');

    $standardTools.find('.standard-tool').each(function(i, element) {
        const $element = $(element);
        const tool = $element.data('tool');
        const actionData = { callback: () => changeTool(tool) }

        // Some tools have custom shortcuts
        switch (tool) {
            case 'pan':
                actionData.shortcutAbbr = 'Right Click'
                break;
        }

        actions.registerAction(actionIdForStandardTool(tool), actionData);
    });

    $standardTools.off('click', '.standard-tool').on('click', '.standard-tool', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction(actionIdForStandardTool($element.data('tool')));
    });

    const $leftTools = $standardTools.find('.standard-tool-column:first-child .standard-tool').toArray();
    const $rightTools = $standardTools.find('.standard-tool-column:last-child .standard-tool').toArray();
    const TIP_X_OFFSET = 15; // Move the tip a bit to the right so it's over the canvas
    setupTooltips($leftTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: [0, TIP_X_OFFSET + 43] // 42px for the button to the right ($standard-tool-size), 1px for margin
    });
    setupTooltips($rightTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: [0, TIP_X_OFFSET]
    });
}

function actionIdForStandardTool(tool) {
    return `tools.standard.${tool}`;
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
    registerAction('flip-v', e => selection.flipVertically(shouldModifyAction('tools.selection.flip-v.mirror', e)));
    registerAction('flip-h', e => selection.flipHorizontally(shouldModifyAction('tools.selection.flip-h.mirror', e)));
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
    return `tools.selection.${tool}`;
}

function refreshSelectionTools() {
    $selectionTools.toggle(selection.hasSelection());

    // Hide typewriter when using text-editor tool
    $selectionTools.find('.sub-tool[data-tool="typewriter"]').toggle(state.getConfig('tool') !== 'text-editor');

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

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function resizeToSelection() {
    const area = selection.getSelectedCellArea().bindToDrawableArea();
    state.resize([area.numCols, area.numRows], area.topLeft.row, area.topLeft.col);
    eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
    state.pushHistory({ requiresResize: true });
}


// -------------------------------------------------------------------------------- Brushing shapes / painting

export const BRUSH_TOOLS = ['draw-freeform-char', 'eraser', 'paint-brush'];

export function hoveredCells(primaryCell) {
    if (!primaryCell) return [];
    if (!BRUSH_TOOLS.includes(state.getConfig('tool'))) return [primaryCell];
    const { shape, size } = state.getConfig('brush');

    switch(shape) {
        case 'square':
            return squareBrushCells(primaryCell, size);
        case 'circle':
            return circleBrushCells(primaryCell, size);
        default:
            console.error('Unsupported brush shape: ', shape);
    }
}

// Iterates through cells in a square shape, centered around the primaryCell
function squareBrushCells(primaryCell, size) {
    const result = []
    const offset = Math.floor(size / 2);

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            result.push(new Cell(primaryCell.row - offset + row, primaryCell.col - offset + col));
        }
    }
    return result;
}

// Iterates through cells in a circle shape, centered around the primaryCell
// Also, it's actually more of a diamond than a circle
function circleBrushCells(primaryCell, size) {
    const result = [];
    let offsets;

    switch(size) {
        // Note: There are mathematical ways to generate a circle shape around a point, but since I'm only implementing
        //       a few sizes I'm just hard-coding the cell coordinates. Offsets are formatted: [row offset, col offset]
        case 3:
            offsets = [
                [-1, 0],
                [ 0,-1], [ 0, 0], [ 0, 1],
                [ 1, 0]
            ];
            break;
        // case 4:
        //     offsets = [
        //                  [-2,-1], [-2, 0],
        //         [-1,-2], [-1,-1], [-1, 0], [-1, 1],
        //         [ 0,-2], [ 0,-1], [ 0, 0], [ 0, 1],
        //                  [ 1,-1], [ 1, 0]
        //     ];
        //     break;
        case 5:
            offsets = [
                [-2, 0],
                [-1,-1], [-1, 0], [-1, 1],
                [ 0,-2], [ 0,-1], [ 0, 0], [ 0, 1], [ 0, 2],
                [ 1,-1], [ 1, 0], [ 1, 1],
                [ 2, 0]
            ];
            break;
        default:
            console.error('Unsupported circle size: ', size);
            return;
    }

    offsets.forEach(offset => {
        result.push(new Cell(primaryCell.row + offset[0], primaryCell.col + offset[1]));
    });
    return result;
}

function setupBrushSubMenu() {
    brushSubMenu = new ToolSubMenu({
        $menu: $('#brush-shapes'),
        configKey: 'brush',
        visible: () => BRUSH_TOOLS.includes(state.getConfig('tool')),
        tooltipContent: $tool => {
            const shape = $tool.data('shape');
            const size = $tool.data('size');
            return `<span class="title">${capitalizeFirstLetter(shape)} Brush</span><br><span>Size: ${size}</span>`;
        }
    })
}

/**
 * Updates a cell (and potentially its neighboring cells) according to the current brush shape/size. If a previous cell
 * is provided, will interpolate the cells between the previous cell and the current cell. This is important in case the
 * user drags their mouse very fast.
 * @param {Cell} currentCell - The cell at the center of the brush
 * @param {Cell} [prevCell] - The previous cell to interpolate from
 * @param {(cell: Cell) => void} updater - Callback
 */
function freeformBrush(currentCell, prevCell, updater) {
    if (prevCell) {
        prevCell.lineTo(currentCell).forEach(cell => hoveredCells(cell).forEach(updater));
    }
    else {
        hoveredCells(currentCell).forEach(updater)
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function drawFreeformChar(currentCell, prevCell) {
    const primaryColorIndex = state.primaryColorIndex();

    freeformBrush(currentCell, prevCell, cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, pickedChar, primaryColorIndex)
    })
}

function erase(currentCell, prevCell) {
    freeformBrush(currentCell, prevCell, cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, '', 0)
    });
}

function paintBrush(currentCell, prevCell) {
    const primaryColorIndex = state.primaryColorIndex();

    freeformBrush(currentCell, prevCell, cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, undefined, primaryColorIndex)
    })
}


function fillConnectedCells(cell, char, colorIndex, options) {
    if (!cell.isInBounds()) return;

    selection.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, char, colorIndex);
    })

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
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
    eventBus.emit(options.allFrames ? EVENTS.REFRESH.ALL : EVENTS.REFRESH.CURRENT_FRAME)
    state.pushHistory();
}

function eyedropper(cell, options) {
    const [char, colorIndex] = state.getCurrentCelGlyph(cell.row, cell.col);
    const colorStr = state.colorStr(colorIndex);
    selectColor(colorStr);

    if (options.addToPalette) {
        state.addColor(colorStr);
        eventBus.emit(EVENTS.TOOLS.COLOR_ADDED);
        state.pushHistory();
    }
}


// -------------------------------------------------------------------------------- Char Picker

let pickedChar, $pickedChar;

function setupPickedChar() {
    $pickedChar = $('.picked-char');
    pickChar('A'); // initial value
}

export function pickChar(char) {
    pickedChar = char;

    // Making it possible to visualize characters that don't actually take up space
    let visibleChar = char;
    if (char === ' ') visibleChar = '␣';
    if (char === '') visibleChar = '∅';

    $pickedChar.html(visibleChar);
}

export function canPickChar() {
    // return state.getConfig('tool') === 'draw-freeform-char' || state.getConfig('tool') === 'fill-char';

    // Currently we are always updating the picked char, even if a char-related tool is not selected
    return true;
}


// -------------------------------------------------------------------------------- Drawing

function setupDrawRectSubMenu() {
    drawRectSubMenu = new ToolSubMenu({
        $menu: $('#draw-rect-types'),
        configKey: 'drawRect',
        visible: () => state.getConfig('tool') === 'draw-rect',
        tooltipContent: $tool => {
            const type = $tool.data('type');
            const name = strings[`tools.draw-rect-types.${type}.name`];
            const description = strings[`tools.draw-rect-types.${type}.description`];
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
            const name = strings[`tools.draw-line-types.${type}.name`];
            const description = strings[`tools.draw-line-types.${type}.description`];
            return `<span class="title">${name}</span><br><span>${description}</span>`;
        }
    })
}

export let drawingContent = null;

function startDrawing(cell, klass, options = {}, recalculateArgs = []) {
    options = $.extend({ colorIndex: state.primaryColorIndex() }, options);
    drawingContent = new klass(cell, options);
    updateDrawing(cell, recalculateArgs);
}

function updateDrawing(cell, recalculateArgs = []) {
    if (!drawingContent) return;
    if (!cell) return;

    drawingContent.end = cell;
    drawingContent.recalculate(...recalculateArgs);

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function finishDrawing() {
    if (!drawingContent) return;

    translateGlyphs(drawingContent.glyphs, drawingContent.origin, (r, c, char, color) => {
        state.setCurrentCelGlyph(r, c, char, color);
    });

    drawingContent = null;
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}



// -------------------------------------------------------------------------------- Move-all tool
// The move-all tool moves all content in the canvas

let moveAllOrigin = null; // Where the move started
export let moveAllOffset = null; // How far from the origin the move is
export let moveAllModifiers = {}; // What modifiers were used (e.g. all layers, wrapping) at the start of the move

function startMoveAll(cell, mouseEvent) {
    moveAllOrigin = cell;

    moveAllModifiers = {
        allLayers: shouldModifyAction('tools.standard.move-all.all-layers', mouseEvent),
        allFrames: shouldModifyAction('tools.standard.move-all.all-frames', mouseEvent),
        wrap: shouldModifyAction('tools.standard.move-all.wrap', mouseEvent),
    }
}

function updateMoveAll(cell, isNewCell) {
    if (moveAllOrigin && isNewCell) {
        moveAllOffset = [cell.row - moveAllOrigin.row, cell.col - moveAllOrigin.col];
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    }
}

function finishMoveAll() {
    if (moveAllOffset) {
        state.iterateCels(moveAllModifiers.allLayers, moveAllModifiers.allFrames, cel => {
            state.translateCel(cel, moveAllOffset[0], moveAllOffset[1], moveAllModifiers.wrap)
        });

        moveAllOffset = null;
        moveAllOrigin = null;
        eventBus.emit(EVENTS.REFRESH.ALL);
        state.pushHistory();
    }
}

// -------------------------------------------------------------------------------- Color Picker

let colorPicker, colorPickerTooltip, $addToPalette, addToPaletteTooltip;

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
            keyboard.toggleStandard('color-picker', true);
            colorPickerTooltip.disable();
            $colorPicker.addClass('picker-open');

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
            keyboard.toggleStandard('color-picker', false);
            colorPickerTooltip.enable();
            $colorPicker.removeClass('picker-open');
        },
        onChange: (color) => {
            state.setConfig('primaryColor', color[state.COLOR_FORMAT]);
            $colorPicker.css('background', state.getConfig('primaryColor'));

            refreshAddToPalette();
            eventBus.emit(EVENTS.TOOLS.COLOR_CHANGED);
        },
    });

    $colorPicker.on('click', '.add-to-palette', () => {
        state.addColor(state.getConfig('primaryColor'));

        refreshAddToPalette();
        eventBus.emit(EVENTS.TOOLS.COLOR_ADDED);
        state.pushHistory();
    })
}

function refreshAddToPalette() {
    if (!$addToPalette) return;

    $addToPalette.empty();

    if (state.isNewColor(state.getConfig('primaryColor'))) {
        $addToPalette.addClass('add-to-palette');

        const [h, s, l, a] = new Color(state.getConfig('primaryColor')).hsla; // Break colorStr into hsla components

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

function cursorStyle(mouseEvent, cell, tool) {
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
        return state.getConfig(this.options.configKey);
    }

    set state(newState) {
        state.setConfig(this.options.configKey, newState);
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