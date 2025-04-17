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
import {STRINGS} from "../config/strings.js";
import AsciiRect from "../geometry/ascii/ascii_rect.js";
import AsciiLine from "../geometry/ascii/ascii_line.js";
import AsciiFreeform from "../geometry/ascii/ascii_freeform.js";
import {translateGlyphs} from "../utils/arrays.js";
import {capitalizeFirstLetter} from "../utils/strings.js";
import {modifierAbbr} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";
import Cell from "../geometry/cell.js";
import AsciiEllipse from "../geometry/ascii/ascii_ellipse.js";
import CharPicker from "../components/char_picker.js";
import {standardTip} from "../components/tooltips.js";
import {getIconHTML} from "../config/icons.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";

// -------------------------------------------------------------------------------- Main External API

let $standardTools, $selectionTools, $canvasContainer, subMenus;

export function init() {
    $canvasContainer = $('#canvas-container');
    subMenus = [];

    setupEventBus();
    setupStandardTools();
    setupSelectionTools();
    setupDrawSubMenus();
    setupBrushSubMenu();
    setupColorPicker();
    setupCharPicker();
}

function refresh() {
    selectColor(state.getConfig('primaryColor'))
    selectChar(state.getConfig('primaryChar'))

    $standardTools.find('.standard-tool').removeClass('selected');
    $standardTools.find(`.standard-tool[data-tool='${state.getConfig('tool')}']`).addClass('selected');

    refreshSelectionTools();
    subMenus.forEach(subMenu => subMenu.refresh());
}

export function changeTool(newTool) {
    state.setConfig('tool', newTool);
    selection.clear();
    refresh();
}


// -------------------------------------------------------------------------------- Events

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED], () => refresh())

    let prevCell; // Used to keep track of whether the mousemove is entering a new cell
    let editorMousedown = false; // Used to keep track of whether the mousedown started in the editor canvas

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl }) => {
        if (mouseEvent.which !== 1) return; // Only apply to left-click

        const tool = state.getConfig('tool')

        editorMousedown = true;
        prevCell = undefined;

        switch(tool) {
            case 'eraser':
                erase(cell);
                break;
            case 'paint-brush':
                paintBrush(cell);
                break;
            case 'draw-freeform':
                state.getConfig('drawTypes')[tool] === 'current-char' ?
                    drawFreeformChar(cell) :
                    startDrawing(cell, AsciiFreeform, { canvas: canvasControl }, [mouseEvent])
                break;
            case 'draw-rect':
                startDrawing(cell, AsciiRect);
                break;
            case 'draw-line':
                startDrawing(cell, AsciiLine);
                break;
            case 'draw-ellipse':
                startDrawing(cell, AsciiEllipse);
                break;
            case 'fill-char':
                fillConnectedCells(cell, state.getConfig('primaryChar'), state.primaryColorIndex(), {
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
            case 'eraser':
                if (isNewCell) erase(cell, prevCell);
                break;
            case 'paint-brush':
                if (isNewCell) paintBrush(cell, prevCell);
                break;
            case 'draw-freeform':
                if (state.getConfig('drawTypes')[tool] === 'current-char') {
                    if (isNewCell) drawFreeformChar(cell, prevCell);
                }
                else {
                    // Intentionally not checking if isNewCell; we update the char based on pixels not cells
                    updateDrawing(cell, [mouseEvent]);
                }
                break;
            case 'draw-rect':
            case 'draw-line':
            case 'draw-ellipse':
                if (isNewCell) updateDrawing(cell);
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
            case 'eraser':
            case 'paint-brush':
                state.pushHistory();
                break;
            case 'draw-freeform':
                state.getConfig('drawTypes')[tool] === 'current-char' ?
                    state.pushHistory() :
                    finishDrawing()
                break;
            case 'draw-rect':
            case 'draw-line':
            case 'draw-ellipse':
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

    const $leftTools = $standardTools.find('.standard-tool-column:first-child:not(:last-child) .standard-tool').toArray();
    const $centerTools = $standardTools.find('.standard-tool-column:first-child:last-child .standard-tool').toArray();
    const $rightTools = $standardTools.find('.standard-tool-column:last-child:not(:first-child) .standard-tool').toArray();
    const TIP_X_OFFSET = 15; // Move the tip a bit to the right so it's over the canvas
    const STANDARD_TOOL_SIZE = 42; // matches $standard-tool-size
    const MARGIN_SIZE = 1;
    setupTooltips($leftTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: [0, TIP_X_OFFSET + STANDARD_TOOL_SIZE + MARGIN_SIZE]
    });
    setupTooltips($centerTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: [0, TIP_X_OFFSET + STANDARD_TOOL_SIZE / 2 + MARGIN_SIZE]
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

    function registerAction(tool, callback, disableOnMove = true, shortcutAbbr) {
        actions.registerAction(actionIdForSelectionTool(tool), {
            callback: callback,
            enabled: () => {
                if (disableOnMove && selection.movableContent) { return false; }
                return true;
            },
            shortcutAbbr: shortcutAbbr
        });
    }
    
    registerAction('move', () => selection.toggleMovingContent(), false, `${modifierAbbr('metaKey')}Click`);
    registerAction('flip-v', e => selection.flipVertically(shouldModifyAction('tools.selection.flip-v.mirror', e)));
    registerAction('flip-h', e => selection.flipHorizontally(shouldModifyAction('tools.selection.flip-h.mirror', e)));
    registerAction('clone', () => selection.cloneToAllFrames());
    registerAction('fill-char', () => fillSelection(state.getConfig('primaryChar'), undefined));
    registerAction('fill-color', () => fillSelection(undefined, state.primaryColorIndex()));
    registerAction('resize', () => resizeToSelection());
    registerAction('close', () => selection.clear(), true, 'Esc');

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

    $selectionTools.find('.sub-tool[data-tool="move"]').toggleClass('active', !!selection.movableContent);

    $selectionTools.find('.sub-tool').each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled(actionIdForSelectionTool($element.data('tool'))));
    });
}

function fillSelection(char, color) {
    selection.getSelectedCells().forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, char, color);
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

const BRUSH_TOOLS = ['draw-freeform', 'eraser', 'paint-brush'];

function brushEnabled() {
    if (!BRUSH_TOOLS.includes(state.getConfig('tool'))) return false;

    switch(state.getConfig('tool')) {
        case 'draw-freeform':
            // Brush is only used when drawing current-char (not other types of freeform drawings)
            return state.getConfig('drawTypes')['draw-freeform'] === 'current-char';
        default:
            return true;
    }
}

export function hoveredCells(primaryCell) {
    if (!primaryCell) return [];
    if (!brushEnabled()) return [primaryCell];
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
    const subMenu = new ToolSubMenu($('#brush-shapes'), {
        visible: () => BRUSH_TOOLS.includes(state.getConfig('tool')),
        disabled: () => !brushEnabled(),
        getValue: () => state.getConfig('brush'),
        onChange: (newValue) => {
            state.setConfig('brush', newValue)
            refresh();
        },
        tooltipContent: $tool => {
            const shape = $tool.data('shape');
            const size = $tool.data('size');
            return `<span class="title">${capitalizeFirstLetter(shape)} Brush</span><br><span>Size: ${size}</span>`;
        }
    })

    subMenus.push(subMenu);
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
        state.setCurrentCelGlyph(cell.row, cell.col, state.getConfig('primaryChar'), primaryColorIndex)
    })
}

function erase(currentCell, prevCell) {
    freeformBrush(currentCell, prevCell, cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, EMPTY_CHAR, 0)
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
    if (targetChar === EMPTY_CHAR) return;

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


// -------------------------------------------------------------------------------- Drawing

function setupDrawSubMenus() {
    setupDrawSubMenu('draw-freeform');
    setupDrawSubMenu('draw-rect');
    setupDrawSubMenu('draw-line');
    setupDrawSubMenu('draw-ellipse');
}

function setupDrawSubMenu(toolKey) {
    const typesKey = `${toolKey}-types`; // E.g. 'draw-rect-types', 'draw-line-types'

    const subMenu = new ToolSubMenu($(`#${typesKey}`), {
        visible: () => state.getConfig('tool') === toolKey,
        getValue: () => ({ type: state.getConfig('drawTypes')[toolKey] }),
        onChange: (newValue) => {
            state.updateDrawType(toolKey, newValue.type);
            refresh();
        },
        icon: $tool => {
            const type = $tool.data('type');
            return getIconHTML(`tools.${typesKey}.${type}`);
        },
        tooltipContent: $tool => {
            const type = $tool.data('type');
            const name = STRINGS[`tools.${typesKey}.${type}.name`];
            const description = STRINGS[`tools.${typesKey}.${type}.description`];
            return `<span class="title">${name}</span><br><span>${description}</span>`;
        }
    })

    subMenus.push(subMenu);
}

export let drawingContent = null;

function startDrawing(cell, klass, options = {}, recalculateArgs = []) {
    options = $.extend({
        drawType: state.getConfig('drawTypes')[state.getConfig('tool')],
        colorIndex: state.primaryColorIndex(),
        char: state.getConfig('primaryChar')
    }, options);

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



// -------------------------------------------------------------------------------- Char Picker

let charPicker, charPickerTooltip;

function setupCharPicker() {
    const $charPicker = $('#current-char');

    charPickerTooltip = standardTip($charPicker, 'tools.standard.char-picker', {
        placement: 'right',
    })

    charPicker = new CharPicker($charPicker, {
        initialValue: 'A',
        onChange: (newValue) => {
            state.setConfig('primaryChar', newValue);

            // If you want the paint bucket char icon to change along with the selected char
            // let visibleChar = newValue;
            // if (visibleChar === WHITESPACE_CHAR) visibleChar = '␣';
            // if (visibleChar === EMPTY_CHAR) visibleChar = '∅';
            // $('.picked-char').html(visibleChar);

            eventBus.emit(EVENTS.TOOLS.CHAR_CHANGED);
        },
        onOpen: () => {
            charPickerTooltip.disable();
        },
        onClose: () => {
            charPickerTooltip.enable();
        }
    })
}

export function selectChar(char) {
    charPicker.value(char);
}

export function canSelectChar() {
    // return state.getConfig('tool') === 'draw-freeform' || state.getConfig('tool') === 'fill-char';

    // Currently we are always updating the picked char, even if a char-related tool is not selected
    return true;
}


// -------------------------------------------------------------------------------- Color Picker

let colorPicker, colorPickerTooltip, $addToPalette, addToPaletteTooltip;

export function selectColor(colorStr) {
    colorPicker.setColor(colorStr, false);
}

function setupColorPicker() {
    const $colorPicker = $('#current-color');

    colorPickerTooltip = standardTip($colorPicker, 'tools.standard.color-picker', {
        placement: 'right',
    })

    colorPicker = new Picker({
        parent: $colorPicker.get(0),
        popup: 'right',
        onOpen: () => {
            keyboard.toggleStandard('color-picker', true);
            colorPickerTooltip.disable();
            $colorPicker.addClass('picker-open');

            if (!$addToPalette) {
                $addToPalette = $colorPicker.find('.picker_sample');
                addToPaletteTooltip = standardTip($addToPalette, 'tools.standard.color-picker-add', {
                    placement: 'right',
                    offset: [0, 20],
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
            return selection.isSelectedCell(cell) && selection.allowMovement(tool, mouseEvent) ? 'grab' : 'cell';
        case 'draw-freeform':
        case 'draw-rect':
        case 'draw-line':
        case 'draw-ellipse':
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
    /**
     * @param $menu - jQuery element for the menu
     * @param {Object} options - Menu options
     * @param {(Object) => void} options.onChange - Callback when sub-tool changes
     * @param {() => Object} options.getValue - Callback to get the current value of the submenu
     * @param {() => boolean} options.visible - Callback that controls whether the submenu is visible
     * @param {() => boolean} [options.disabled] - Callback that controls whether the submenu is disabled. Default: always enabled.
     * @param {function} [options.icon] - Icon retriever. Passed the current $tool, returns the icon.
     * @param {function} [options.tooltipContent] - Tooltip content retriever. Passed the current $tool, returns tooltip content.
     */
    constructor($menu, options = {}) {
        this.$menu = $menu;
        this.options = options;
        this._init();
    }

    _init() {
        this.$menu.off('click', '.sub-tool').on('click', '.sub-tool', evt => {
            this.options.onChange($(evt.currentTarget).data());
            // this.refresh(); // Don't need to refresh here; entire tools panel will refresh
        });

        if (this.options.icon) {
            this.$menu.find('.sub-tool').each((i, element) => {
                const $tool = $(element);
                const icon = this.options.icon($tool);
                if (icon) $tool.html(icon);
            })
        }

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
        this.$menu.toggleClass('disabled', !!this.options.disabled && this.options.disabled())

        if (show) {
            let str = '';
            for (const [key, value] of Object.entries(this.options.getValue())) {
                str += `[data-${key}="${value}"]`;
            }
            this.$menu.find('.sub-tool').toggleClass('active', false);
            this.$menu.find(`.sub-tool${str}`).toggleClass('active', true);
        }
    }

}