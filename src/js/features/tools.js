/**
 * This is the UI component for the canvas toolbar:
 * - The standard toolbar on the left of the main canvas (e.g. free draw, draw line, paint brush, etc.)
 * - The submenu toolbar that appears on the left when you've made a selection, or to choose a brush size, etc.
 * - The color picker on the left toolbar
 */

import * as state from '../state/index.js';
import * as selection from './selection.js';
import * as vectorSelection from "./selection/vector_selection.js";
import * as actions from "../io/actions.js";
import tippy from 'tippy.js';
import {setupTooltips, shouldModifyAction} from "../io/actions.js";
import {STRINGS} from "../config/strings.js";
import {capitalizeFirstLetter, strToHTML} from "../utils/strings.js";
import {modifierAbbr, modifierWord} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";
import Cell from "../geometry/cell.js";
import CharPicker from "../components/char_picker.js";
import {getIconHTML} from "../config/icons.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";
import PolygonFactory from "../geometry/drawing/polygon_factory.js";
import Rect from "../geometry/shapes/rect.js";
import {
    BRUSH_TYPES,
    BRUSHES,
    CHAR_PROP, COLOR_PROP, FILL_OPTIONS, FILL_PROP,
    REORDER_ACTIONS,
    STROKE_OPTIONS,
    SHAPE_TYPES,
    STROKE_PROPS, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP, TEXT_ALIGN_V_OPTS, TEXT_ALIGN_V_PROP, TEXT_PROP
} from "../geometry/shapes/constants.js";
import ColorPicker from "../components/color_picker.js";
import {standardTip, standardTips} from "../components/tooltips.js";
import {defer} from "../utils/utilities.js";
import IconMenu from "../components/icon_menu.js";
import Ellipse from "../geometry/shapes/ellipse.js";
import Line from "../geometry/shapes/line.js";
import {MOUSE} from "../io/mouse.js";
import Freeform from "../geometry/shapes/freeform.js";
import {LAYER_TYPES} from "../state/constants.js";


const DRAWING_MODIFIERS = {
    'draw-line': {
        'elbow-line-ascii': { 'shiftKey': 'change-route' },
        'elbow-arrow-ascii': { 'shiftKey': 'change-route' },
        'elbow-line-unicode': { 'shiftKey': 'change-route' },
        'elbow-arrow-unicode': { 'shiftKey': 'change-route' },
        'elbow-line-monochar': { 'shiftKey': 'change-route' },
    }
}

const SUB_TOOL_MENU_TOOLTIP_OFFSET = [0, 15];


// -------------------------------------------------------------------------------- Main External API

let $standardTools, $selectionTools, selectionTooltips, $canvasContainer, subMenus;

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
    setupShapeProperties();
}

function refresh() {
    refreshCharPicker();
    refreshColorPicker();
    refreshStandardTools();
    refreshSelectionTools();
    subMenus.forEach(subMenu => subMenu.refresh());
    refreshShapeProperties();
}

export function changeTool(newTool) {
    state.setConfig('tool', newTool);
    selection.clear();
    vectorSelection.deselectAllShapes();
    refresh();
}

export function changeDrawType(toolKey, newDrawType) {
    state.updateDrawType(toolKey, newDrawType);
    if (state.getConfig('tool') === toolKey) {
        refresh();
    }
    else {
        changeTool(toolKey);
    }
}


// -------------------------------------------------------------------------------- Events

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED], () => refresh())

    let prevCell; // Used to keep track of whether the mousemove is entering a new cell

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl, mouseDownButton }) => {
        const tool = toolForMouseButton(mouseDownButton);
        $canvasContainer.css('cursor', cursorStyle(tool, true, mouseEvent, cell, canvasControl));

        prevCell = undefined;

        switch(tool) {
            case 'eraser':
                handleDrawMousedown(PolygonFactory.createFreeform, cell, mouseEvent, { drawType: 'eraser' })
                break;
            case 'paint-brush':
                handleDrawMousedown(PolygonFactory.createFreeform, cell, mouseEvent, { drawType: 'paint-brush' })
                break;
            case 'draw-freeform':
                handleDrawMousedown(Freeform.beginFreeform, cell, canvasControl, mouseEvent);
                break;
            case 'draw-rect':
                handleDrawMousedown(Rect.beginRect, cell, canvasControl, mouseEvent);
                break;
            case 'draw-line':
                handleDrawMousedown(Line.beginLine, cell, canvasControl, mouseEvent);
                break;
            case 'draw-ellipse':
                handleDrawMousedown(Ellipse.beginEllipse, cell, canvasControl, mouseEvent);
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
            case 'move-all':
                startMoveAll(cell, mouseEvent);
                break;
            default:
                return; // Ignore all other tools
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvasControl, isDragging, originalPoint, currentPoint, mouseDownButton }) => {
        const tool = toolForMouseButton(mouseDownButton);
        $canvasContainer.css('cursor', cursorStyle(tool, isDragging, mouseEvent, cell, canvasControl));

        // Keep track of whether the mousemove has reached a new cell (helps with performance, so we can just redraw
        // when a new cell is reached, not on every pixel change)
        const isNewCell = !prevCell || !prevCell.equals(cell);

        switch(tool) {
            case 'eraser':
            case 'paint-brush':
                if (isDragging && isNewCell) handleDrawMousemove(cell, mouseEvent);
                break;
            case 'draw-freeform':
                // Intentionally not checking if isNewCell; we update the char based on pixels not cells
                if (isDragging) {
                    const cellPixel = canvasControl.cellPixelAtScreenXY(mouseEvent.offsetX, mouseEvent.offsetY, true);
                    handleDrawMousemove(cell, canvasControl, mouseEvent, { cellPixel });
                }
                break;
            case 'draw-line':
                // Intentionally not checking if isDragging; mouseup can occur between points on polyline
                if (isNewCell) handleDrawMousemove(cell, canvasControl, mouseEvent);
                break;
            case 'draw-rect':
            case 'draw-ellipse':
                if (isDragging && isNewCell) handleDrawMousemove(cell, canvasControl, mouseEvent);
                break;
            case 'pan':
                if (isDragging) {
                    eventBus.emit(EVENTS.CANVAS.PAN_DELTA, {
                        delta: [originalPoint.x - currentPoint.x, originalPoint.y - currentPoint.y]
                    })
                }
                break;
            case 'move-all':
                if (isDragging && isNewCell) updateMoveAll(cell, isNewCell);
                break;
        }

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell, canvasControl, isDragging, mouseDownButton }) => {
        const tool = toolForMouseButton(mouseDownButton);

        // Draw cursor according to state tool (not toolForMouseButton which will be outdated soon) and as if isDragging was false
        $canvasContainer.css('cursor', cursorStyle(state.getConfig('tool'), false, mouseEvent, cell, canvasControl));

        if (!isDragging) return;

        switch(tool) {
            case 'eraser':
            case 'paint-brush':
            case 'draw-freeform':
            case 'draw-rect':
            case 'draw-line':
            case 'draw-ellipse':
                handleDrawMouseup(cell, mouseEvent);
                break;
            case 'move-all':
                finishMoveAll();
                break;
            default:
                return; // Ignore all other tools
        }
    });

    eventBus.on(EVENTS.CANVAS.DBLCLICK, ({ mouseEvent }) => {
        const tool = toolForMouseButton(mouseEvent.button);

        switch(tool) {
            case 'draw-line':
                finishDrawing();
                break;
            default:
                return; // Ignore all other tools
        }
    });

    eventBus.on(EVENTS.PALETTE.COLOR_SELECTED, ({ color }) => {
        selectColor(color);

        if (state.hasSelectedShapes()) {
            shapeColorPicker.value(color)
        }
    })
    eventBus.on(EVENTS.UNICODE.CHAR_SELECTED, ({ char }) => {
        selectChar(char);
    })
}


function toolForMouseButton(mouseButton) {
    switch(mouseButton) {
        case MOUSE.MIDDLE:
            return 'pan';
        case MOUSE.RIGHT:
            return 'eraser';
        default:
            return state.getConfig('tool')
    }
}


// -------------------------------------------------------------------------------- Standard Tools

function setupStandardTools() {
    $standardTools = $('#standard-tools');

    $standardTools.find('.standard-tool').each((i, element) => {
        const $element = $(element);
        const tool = $element.data('tool');
        const actionData = {
            callback: () => changeTool(tool),
            enabled: () => {
                if (state.MULTICOLOR_TOOLS.has(tool) && !state.isMultiColored()) return false;
                if (state.layers()) {
                    if (state.RASTER_TOOLS.has(tool) && state.currentLayerType() !== LAYER_TYPES.RASTER) return false;
                    if (state.VECTOR_TOOLS.has(tool) && state.currentLayerType() !== LAYER_TYPES.VECTOR) return false;
                }
                return true;
            },
        }

        // Some tools have custom shortcuts
        switch (tool) {
            case 'pan':
                actionData.shortcutAbbr = 'H, Middle Click'
                break;
            case 'eraser':
                actionData.shortcutAbbr = 'E, Right Click'
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
    setupTooltips($leftTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: tooltipOffset('left')
    });
    setupTooltips($centerTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: tooltipOffset('center')
    });
    setupTooltips($rightTools, element => actionIdForStandardTool($(element).data('tool')), {
        offset: tooltipOffset('right')
    });
}

function refreshStandardTools() {
    $standardTools.find('.color-tool, .raster-tool, .vector-tool').toggleClass('hidden', false);
    if (state.currentLayerType() !== LAYER_TYPES.RASTER) $standardTools.find('.raster-tool').toggleClass('hidden', true);
    if (state.currentLayerType() !== LAYER_TYPES.VECTOR) $standardTools.find('.vector-tool').toggleClass('hidden', true);
    if (!state.isMultiColored()) $standardTools.find('.color-tool').toggleClass('hidden', true);

    // The following can be used if we want to disable raster/vector tools (instead of showing/hiding them above)
    // $standardTools.find('.standard-tool').each((i, element) => {
    //     const $tool = $(element);
    //     const tool = $tool.data('tool');
    //     $tool.toggleClass('disabled', !actions.isActionEnabled(actionIdForStandardTool(tool)))
    // })

    $standardTools.find('.standard-tool').removeClass('selected');
    $standardTools.find(`.standard-tool[data-tool='${state.getConfig('tool')}']`).addClass('selected');
}


function actionIdForStandardTool(tool) {
    return `tools.standard.${tool}`;
}

const TIP_X_OFFSET = 15; // Move the tip a bit to the right so it's over the canvas
const STANDARD_TOOL_SIZE = 42; // matches $standard-tool-size
const MARGIN_SIZE = 1;

function tooltipOffset(column) {
    switch (column) {
        case 'left':
            return [0, TIP_X_OFFSET + STANDARD_TOOL_SIZE + MARGIN_SIZE];
        case 'center':
            return [0, TIP_X_OFFSET + STANDARD_TOOL_SIZE / 2 + MARGIN_SIZE];
        case 'center-corner-button':
            return [0, TIP_X_OFFSET + STANDARD_TOOL_SIZE / 2 + MARGIN_SIZE - 6];
        case 'right':
            return [0, TIP_X_OFFSET];
        default:
            console.warn(`Invalid tooltipOffset column: ${column}`)
    }
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
    registerAction('convert-to-whitespace', () => replaceInSelection(EMPTY_CHAR, WHITESPACE_CHAR));
    registerAction('convert-to-empty', () => replaceInSelection(WHITESPACE_CHAR, EMPTY_CHAR));
    registerAction('resize', () => resizeToSelection());
    registerAction('close', () => selection.clear(), true, 'Esc');

    $selectionTools.off('click', '.sub-tool').on('click', '.sub-tool', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction(actionIdForSelectionTool($element.data('tool')), evt);
    });

    selectionTooltips = setupTooltips(
        $selectionTools.find('.sub-tool').toArray(),
        element => actionIdForSelectionTool($(element).data('tool')),
        {
            offset: SUB_TOOL_MENU_TOOLTIP_OFFSET
        }
    );
}

function actionIdForSelectionTool(tool) {
    return `tools.selection.${tool}`;
}

function refreshSelectionTools() {
    const isVisible = selection.hasSelection() && !selection.caretCell();
    $selectionTools.toggle(isVisible);
    if (!isVisible) selectionTooltips.tooltips.forEach(tooltip => tooltip.hide())

    $selectionTools.find('.sub-tool[data-tool="move"]').toggleClass('active', !!selection.movableContent);

    $selectionTools.find('.sub-tool').each((i, element) => {
        const $element = $(element);
        const actionId = actionIdForSelectionTool($element.data('tool'));
        $element.html(getIconHTML(actionId))
        $element.toggleClass('disabled', !actions.isActionEnabled(actionId));
    });

    $selectionTools.find('.color-tool').toggleClass('hidden', !state.isMultiColored())
}

function fillSelection(char, color) {
    selection.getSelectedCells().forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, char, color);
    });

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function replaceInSelection(findChar, replaceChar) {
    selection.getSelectedCells().forEach(cell => {
        if (state.getCurrentCelGlyph(cell.row, cell.col)[0] === findChar) {
            state.setCurrentCelGlyph(cell.row, cell.col, replaceChar);
        }
    });

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function resizeToSelection() {
    const area = selection.getSelectedCellArea().bindToDrawableArea();
    state.resize([area.numRows, area.numCols], area.topLeft.row, area.topLeft.col);
    eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
    state.pushHistory({ requiresResize: true });
}


// -------------------------------------------------------------------------------- Brush

const BRUSH_TOOLS = ['draw-freeform', 'eraser', 'paint-brush'];

function brushEnabled() {
    if (!BRUSH_TOOLS.includes(state.getConfig('tool'))) return false;

    switch(state.getConfig('tool')) {
        case 'draw-freeform':
            // Brush is only used when drawing irregular-monochar (not other types of freeform drawings)
            return state.getConfig('drawTypes')['draw-freeform'] === 'irregular-monochar';
        default:
            return true;
    }
}

export function hoveredCells(primaryCell) {
    if (!primaryCell) return [];
    if (!brushEnabled()) return [primaryCell];
    const { type, size } = BRUSHES[state.getConfig('brush')];

    switch(type) {
        case BRUSH_TYPES.SQUARE:
            return squareBrushCells(primaryCell, size);
        case BRUSH_TYPES.CIRCLE:
            return circleBrushCells(primaryCell, size);
        default:
            console.error('Unsupported brush type: ', type);
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
    const radius = Math.floor((size - 1) / 2);

    for (let row = -radius; row <= radius; row++) {
        for (let col = -radius; col <= radius; col++) {
            if (Math.abs(col) + Math.abs(row) <= radius) {
                result.push(new Cell(primaryCell.row + row, primaryCell.col + col));
            }
        }
    }

    return result;
}

function setupBrushSubMenu() {
    const $container = $('#context-tools-left');
    const $menu = $('<div>', {
        class: 'sub-tool-menu'
    }).appendTo($container);

    const menu = new IconMenu($menu, {
        items: Object.keys(BRUSHES).map(key => {
            return {
                value: key,
                icon: `tools.brush.${key}`,
                tooltip: `tools.brush.${key}`,
            }
        }),
        visible: () => BRUSH_TOOLS.includes(state.getConfig('tool')),
        disabled: () => !brushEnabled(),
        getValue: () => state.getConfig('brush'),
        onSelect: newValue => {
            state.setConfig('brush', newValue)
            refresh();
        }
    })

    subMenus.push(menu);
}

// -------------------------------------------------------------------------------- Shape Properties

let $shapeProperties, shapeTooltips, shapeSubMenus = [];

function setupShapeProperties() {
    $shapeProperties = $('#shape-properties')

    // Style dropdowns for each shape type
    const $styleActions = $('#shape-stroke-menu-group').find('.group-actions')
    Object.values(SHAPE_TYPES).forEach(shapeType => setupStrokeMenu($('<div>').appendTo($styleActions), shapeType));

    setupFillMenu();

    setupTextAlignMenu($('#shape-text-align-h'), TEXT_ALIGN_H_PROP, Object.values(TEXT_ALIGN_H_OPTS));
    setupTextAlignMenu($('#shape-text-align-v'), TEXT_ALIGN_V_PROP, Object.values(TEXT_ALIGN_V_OPTS));

    setupOrderMenu();

    actions.registerAction('tools.shapes.delete', {
        callback: () => vectorSelection.deleteSelectedShapes()
    })

    actions.registerAction('tools.shapes.startCursor', {
        callback: () => {
            vectorSelection.setShapeCursor(state.selectedShapes()[0].id, 0)
        },
        enabled: () => state.selectedShapes().length
    })

    $shapeProperties.off('click', '.action-button').on('click', '.action-button', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction($element.data('action'), evt);
    });

    shapeTooltips = setupTooltips(
        $shapeProperties.find('.action-button').toArray(),
        element => $(element).data('action'),
        {
            placement: 'bottom'
        }
    );
}

function setupStrokeMenu($menu, shapeType) {
    const strokeProp = STROKE_PROPS[shapeType];

    const styleMenu = new IconMenu($menu, {
        dropdown: true,
        dropdownBtnTooltip: `tools.shapes.${strokeProp}`,
        items: Object.values(STROKE_OPTIONS[shapeType]).map(stroke => {
            return {
                value: stroke,
                icon: `tools.shapes.${strokeProp}.${stroke}`,
                tooltip: `tools.shapes.${strokeProp}.${stroke}`,
            }
        }),
        visible: () => state.selectedShapeTypes().includes(shapeType),
        getValue: () => state.selectedShapeProps()[strokeProp][0],
        onSelect: newValue => {
            vectorSelection.updateSelectedShapes(shape => {
                if (shape.type === shapeType) shape.updateProp(strokeProp, newValue)
            });
        },
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus.push(styleMenu);
}

function setupTextAlignMenu($menu, prop, options) {
    const $menuGroup = $('#shape-text-align');

    const menu = new IconMenu($menu, {
        dropdown: true,
        dropdownBtnTooltip: `tools.shapes.${prop}`,
        items: options.map(option => {
            return {
                value: option,
                icon: `tools.shapes.${prop}.${option}`,
                tooltip: `tools.shapes.${prop}.${option}`,
            }
        }),
        visible: () => {
            // Show text-align if any selected shapes have non-zero text length
            // TODO or if cursor is currently in the shape
            return state.selectedShapeProps()[TEXT_PROP].some(textProp => !!textProp);
        },
        getValue: () => state.selectedShapeProps()[prop][0],
        onSelect: newValue => vectorSelection.updateSelectedShapes(shape => shape.updateProp(prop, newValue)),
        onRefresh: menu => $menuGroup.toggle(menu.isVisible()),
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus.push(menu);
}

function selectedShapesUseCharPicker() {
    let strokeUsesChar = false;
    Object.values(STROKE_PROPS).forEach(strokeProp => {
        const strokes = state.selectedShapeProps()[strokeProp];

        // TODO This is basing monochar styles off of their key name... change to a real property
        if (strokes.some(stroke => stroke.includes('monochar'))) strokeUsesChar = true;
    })

    const fillUsesChar = state.selectedShapeProps()[FILL_PROP].some(fill => fill === FILL_OPTIONS.MONOCHAR);

    return strokeUsesChar || fillUsesChar;
}

function setupFillMenu() {
    const $menuGroup = $('#shape-fill-menu-group');
    const $menu = $('<div>').appendTo($menuGroup.find('.group-actions'));

    const menu = new IconMenu($menu, {
        dropdown: true,
        dropdownBtnTooltip: `tools.shapes.${FILL_PROP}`,
        items: Object.values(FILL_OPTIONS).map(option => {
            return {
                value: option,
                icon: `tools.shapes.${FILL_PROP}.${option}`,
                tooltip: `tools.shapes.${FILL_PROP}.${option}`,
            }
        }),
        visible: () => state.selectedShapeProps()[FILL_PROP].length,
        getValue: () => state.selectedShapeProps()[FILL_PROP][0],
        onSelect: newValue => vectorSelection.updateSelectedShapes(shape => shape.updateProp(FILL_PROP, newValue)),
        onRefresh: menu => $menuGroup.toggle(menu.isVisible()),
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus.push(menu);
}

function setupOrderMenu() {
    const $menu = $('#shape-order');

    Object.values(REORDER_ACTIONS).forEach(action => {
        actions.registerAction(`tools.shapes.${action}`, {
            callback: () => vectorSelection.reorderSelectedShapes(action),
            enabled: () => state.canReorderSelectedShapes(action),
        })
    })

    const menu = new IconMenu($menu, {
        dropdown: true,
        dropdownBtnIcon: 'tools.shapes.order',
        dropdownBtnTooltip: 'tools.shapes.order',
        closeDropdownOnSelect: false,
        items: Object.values(REORDER_ACTIONS).map(action => {
            const actionId = `tools.shapes.${action}`;
            return {
                value: action,
                icon: actionId,
                tooltip: actionId,
                disabled: () => !actions.isActionEnabled(actionId)
            }
        }),
        onSelect: newValue => actions.callAction(`tools.shapes.${newValue}`),
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus.push(menu);
}

function refreshShapeProperties() {
    const isVisible = state.hasSelectedShapes();
    $shapeProperties.toggle(isVisible);

    if (isVisible) {
        shapeSubMenus.forEach(subMenu => subMenu.refresh()); // Also handles showing/hiding menu icon thru onRefresh callback

        $shapeProperties.find('#shape-color-menu-group').toggle(state.isMultiColored())
        $shapeProperties.find('#shape-char-menu-group').toggle(selectedShapesUseCharPicker())

        $shapeProperties.find('.action-button').each((i, element) => {
            const $element = $(element);
            const actionId = $element.data('action');
            $element.html(getIconHTML(actionId))
            $element.toggleClass('disabled', !actions.isActionEnabled(actionId));
        });
    } else {
        shapeTooltips.tooltips.forEach(tooltip => tooltip.hide())
        // todo hide tooltips for other stuff like shape char picker
    }
}


// -------------------------------------------------------------------------------- Color Tools

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

    state.colorSwap(targetColor, state.primaryColorIndex(), options);

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
export let drawingContent = null;

function setupDrawSubMenus() {
    setupDrawSubMenu('draw-freeform', SHAPE_TYPES.FREEFORM);
    setupDrawSubMenu('draw-rect', SHAPE_TYPES.RECT);
    setupDrawSubMenu('draw-line', SHAPE_TYPES.LINE);
    setupDrawSubMenu('draw-ellipse', SHAPE_TYPES.ELLIPSE);
}

function setupDrawSubMenu(toolKey, shapeType) {
    const $container = $('#context-tools-left');
    const $menu = $('<div>', {
        class: 'sub-tool-menu'
    }).appendTo($container);

    const strokeProp = STROKE_PROPS[shapeType]

    const menu = new IconMenu($menu, {
        items: Object.values(STROKE_OPTIONS[shapeType]).map(stroke => {
            return {
                value: stroke,
                icon: `tools.shapes.${strokeProp}.${stroke}`,
                tooltip: `tools.shapes.${strokeProp}.${stroke}`,
            }
        }),
        visible: () => state.getConfig('tool') === toolKey,
        getValue: () => state.getConfig('drawTypes')[toolKey],
        onSelect: newValue => changeDrawType(toolKey, newValue),
        // TODO getDrawingModifiersTooltip(toolKey, style)
    })

    subMenus.push(menu);
}

function getDrawingModifiers(mouseEvent) {
    const result = {}

    const tool = state.getConfig('tool');
    const drawType = state.getConfig('drawTypes')[tool]

    if (!DRAWING_MODIFIERS[tool] || !DRAWING_MODIFIERS[tool][drawType]) return result;

    for (const [modKey, modifier] of Object.entries(DRAWING_MODIFIERS[tool][drawType])) {
        if (mouseEvent[modKey]) result[modifier] = true;
    }

    return result;
}

function getDrawingModifiersTooltip(tool, drawType) {
    let result = ''
    if (!DRAWING_MODIFIERS[tool] || !DRAWING_MODIFIERS[tool][drawType]) return result;

    for (const [modKey, modifier] of Object.entries(DRAWING_MODIFIERS[tool][drawType])) {
        const modifierKey = modifierWord(modKey);
        const modifierDesc = STRINGS[`tools.${tool}-types.${drawType}.${modifier}`];
        if (modifierDesc) {
            result += `<div class="modifier-desc"><span class="modifier-key">${modifierKey}</span><span>${modifierDesc}</span></div>`;
        }
        else {
            console.warn(`No modifier description found for: [${tool}, ${drawType}]`)
        }
    }
    return result;
}

function handleDrawMousedown(factory, cell, canvasControl, mouseEvent, options = {}) {
    if (!drawingContent) {
        vectorSelection.deselectAllShapes(false); // Don't push to history; we will push history when drawing finished

        drawingContent = factory(cell, $.extend({ // todo rename drawingShape?
            drawPreset: state.getConfig('drawTypes')[state.getConfig('tool')],
            colorIndex: state.primaryColorIndex(),
            char: state.getConfig('primaryChar'),
            // hoveredCells: hoveredCells, // todo this should be based on line thickness, don't pass hoveredCells fn
            // canvasDimensions: state.getConfig('dimensions'),
        }, options));
    }

    drawingContent.handleDrawMousedown(cell, { point: mousePoint(canvasControl, mouseEvent) });
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function handleDrawMousemove(cell, canvasControl, mouseEvent, options = {}) {
    if (!drawingContent) return;
    if (!cell) return;

    drawingContent.handleDrawMousemove(cell, { point: mousePoint(canvasControl, mouseEvent) });

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function handleDrawMouseup(cell, mouseEvent) {
    if (!drawingContent) return;

    if (!drawingContent.handleDrawMouseup(cell)) return;

    finishDrawing();
}

function finishDrawing() {
    if (!drawingContent) return;

    drawingContent.finishDraw();
    state.addCurrentCelShape(drawingContent);

    drawingContent = null;
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}

function mousePoint(canvasControl, mouseEvent) {
    return canvasControl.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY)
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

let $charPicker, primaryCharPicker, shapeCharPicker, charQuickSwapTooltip;

function setupCharPicker() {
    $charPicker = $('#current-char');

    actions.registerAction('tools.standard.char-picker', {
        callback: () => toggleCharPicker(true),
    })
    actions.registerAction('tools.standard.quick-swap-char', {
        callback: () => toggleQuickSwap(),
    })

    primaryCharPicker = new CharPicker($charPicker, {
        initialValue: 'A',
        onLoad: newValue => selectChar(newValue, false),
        onChange: newValue => selectChar(newValue),
        onOpen: () => {
            charQuickSwapTooltip.disable();
        },
        onClose: () => {
            charQuickSwapTooltip.enable();
        },
        popupDirection: 'right',
        popupOffset: 34,
        tooltip: () => {
            return setupTooltips(
                $charPicker.toArray(),
                'tools.standard.char-picker',
                { offset: tooltipOffset('center') }
            ).tooltips[0];
        }
    })

    const $shapeChar = $('#shape-char');
    shapeCharPicker = new CharPicker($shapeChar, {
        onChange: newValue => selectChar(newValue),
        popupDirection: 'bottom',
        popupOffset: 22,
        tooltip: () => {
            return standardTip($shapeChar, 'tools.shapes.char-picker', {
                placement: 'bottom',
                offset: [0, 15]
            })
        }
    })

    const $quickSwap = $charPicker.find('.char-well-corner-button');
    $quickSwap.off('click').on('click', () => actions.callAction('tools.standard.quick-swap-char'))

    charQuickSwapTooltip = setupTooltips($quickSwap.toArray(), 'tools.standard.quick-swap-char', {
        offset: tooltipOffset('center-corner-button')
    }).tooltips[0];
}

function refreshCharPicker() {
    const char = state.hasSelectedShapes() ?
        state.selectedShapeProps()[CHAR_PROP][0] :
        state.getConfig('primaryChar');

    selectChar(char, false);

    $charPicker.toggleClass('animated-border', isQuickSwapEnabled());
}

export function isCharPickerOpen() {
    return primaryCharPicker.isOpen || shapeCharPicker.isOpen;
}
export function toggleCharPicker(open) {
    if (open) {
        primaryCharPicker.toggle(true);
    } else {
        primaryCharPicker.toggle(false);
        shapeCharPicker.toggle(false);
    }
}

export function selectChar(char, triggerUpdates = true) {
    if (primaryCharPicker) primaryCharPicker.value(char, true);
    if (shapeCharPicker) shapeCharPicker.value(char, true);

    state.setConfig('primaryChar', char);
    eventBus.emit(EVENTS.TOOLS.CHAR_CHANGED);

    if (triggerUpdates) {
        vectorSelection.updateSelectedShapes(shape => shape.updateProp(CHAR_PROP, char));
        // todo if not using monochar, switch shape to it
    }
}

// "Quick Swap" is a toggle that lets the user instantly update the char picker's selected value by pressing a keyboard key
let quickSwapEnabled = false;

export function isQuickSwapEnabled() {
    if (selection.hasSelection() && !selection.caretCell()) return true;
    return quickSwapEnabled;
}

export function toggleQuickSwap(enabled) {
    quickSwapEnabled = enabled === undefined ? !quickSwapEnabled : !!enabled;
    refresh();
}


// -------------------------------------------------------------------------------- Color Picker

let primaryColorPicker, shapeColorPicker;

function setupColorPicker() {
    const $colorPicker = $('#current-color');

    actions.registerAction('tools.standard.color-picker', {
        // callback: () => toggleColorPicker(true),
    })

    primaryColorPicker = new ColorPicker($colorPicker, {
        pickerOptions: {
            popup: 'right'
        },
        tooltip: () => {
            return setupTooltips(
                $colorPicker.toArray(),
                'tools.standard.color-picker',
                { offset: tooltipOffset('center') }
            ).tooltips[0]
        },
        onChange: color => selectColorFromPicker(color, primaryColorPicker),
        onDone: color => selectColor(color)
    })

    const $shapeColor = $('#shape-color');
    shapeColorPicker = new ColorPicker($shapeColor, {
        pickerOptions: {
            popup: 'bottom'
        },
        tooltip: () => {
            return standardTip($shapeColor, 'tools.shapes.color-picker', {
                placement: 'bottom',
                offset: [0, 15]
            })
        },
        onChange: color => selectColorFromPicker(color, shapeColorPicker),
        onDone: color => selectColor(color),
    })
}

function selectColor(colorStr, triggerUpdates = true) {
    if (primaryColorPicker) primaryColorPicker.value(colorStr, true);
    if (shapeColorPicker) shapeColorPicker.value(colorStr, true);

    state.setConfig('primaryColor', colorStr);
    eventBus.emit(EVENTS.TOOLS.COLOR_CHANGED);

    if (triggerUpdates) {
        const colorIndex = state.colorIndex(colorStr);
        vectorSelection.updateSelectedShapes(shape => shape.updateProp(COLOR_PROP, colorIndex));
    }
}

// When one picker selects a color, we update the value in the other picker. We also call rapidUpdateSelectedShapes
// (not the usual updateSelectedShapes) because the picker will trigger update events for every pixel that the mouse
// moves while changing the color. We want the shapes to update in real time, but we do not commit the change
// to history until the onDone is called
function selectColorFromPicker(colorStr, fromPicker) {
    if (fromPicker !== primaryColorPicker) primaryColorPicker.value(colorStr, true);
    if (fromPicker !== shapeColorPicker) shapeColorPicker.value(colorStr, true);

    state.setConfig('primaryColor', colorStr);
    eventBus.emit(EVENTS.TOOLS.COLOR_CHANGED);

    const colorIndex = state.colorIndex(colorStr);
    vectorSelection.rapidUpdateSelectedShapes(shape => shape.updateProp(COLOR_PROP, colorIndex));
}

function refreshColorPicker() {
    const color = state.hasSelectedShapes() ?
        state.colorStr(state.selectedShapeProps()[COLOR_PROP][0]) :
        state.getConfig('primaryColor');

    selectColor(color, false);
}



// -------------------------------------------------------------------------------- Misc.

function cursorStyle(tool, isDragging, mouseEvent, cell, canvasControl) {
    const grab = isDragging ? 'grabbing' : 'grab'

    switch (tool) {
        case 'select':
            const handle = vectorSelection.getHandle(cell, mouseEvent, canvasControl);
            return handle ? handle.cursor : 'default';
        case 'text-editor':
            return selection.isSelectedCell(cell) && selection.allowMovement(tool, mouseEvent) ? grab : 'text';
        case 'selection-rect':
        case 'selection-line':
        case 'selection-lasso':
        case 'selection-wand':
            return selection.isSelectedCell(cell) && selection.allowMovement(tool, mouseEvent) ? grab : 'cell';
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
            return 'crosshair';
        case 'pan':
        case 'move-all':
            return grab;
        default:
            return 'default';
    }
}