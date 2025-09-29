/**
 * This is the UI component for the canvas toolbar:
 * - The standard toolbar on the left of the main canvas (e.g. free draw, draw line, paint brush, etc.)
 * - The submenu toolbar that appears on the left when you've made a selection, or to choose a brush size, etc.
 * - The color picker on the left toolbar
 */

import * as state from '../state/index.js';
import * as selectionController from "./selection/index.js";
import * as actions from "../io/actions.js";
import {setupTooltips, shouldModifyAction} from "../io/actions.js";
import {STRINGS} from "../config/strings.js";
import {modifierAbbr, modifierWord} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";
import CharPicker from "../components/char_picker.js";
import {getIconHTML} from "../config/icons.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";
import {
    BRUSH_TYPES,
    BRUSHES,
    CHAR_PROP, COLOR_PROP, FILL_OPTIONS, FILL_PROP,
    REORDER_ACTIONS,
    STROKE_STYLE_OPTIONS,
    SHAPE_TYPES,
    STROKE_STYLE_PROPS, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP, TEXT_ALIGN_V_OPTS, TEXT_ALIGN_V_PROP, TEXT_PROP,
    BRUSH_PROP, LINKED_PROPS
} from "../geometry/shapes/constants.js";
import ColorPicker from "../components/color_picker.js";
import {standardTip} from "../components/tooltips.js";
import IconMenu from "../components/icon_menu.js";
import {MOUSE} from "../io/mouse.js";
import {LAYER_TYPES} from "../state/constants.js";
import {diamondBrushCells, squareBrushCells} from "../geometry/shapes/algorithms/brush.js";
import Shape from "../geometry/shapes/shape.js";


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

// TODO Rework this so we don't need second parameter
export function changeTool(newTool, saveHistoryOnSelectionClear = true) {
    if (state.getConfig('tool') === newTool) return;

    state.setConfig('tool', newTool);
    selectionController.clear(saveHistoryOnSelectionClear);
    refresh();
}

/**
 * Handles the escape key being pressed.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEscapeKey() {
    if (isCharPickerOpen()) {
        toggleCharPicker(false);
        return true;
    }

    // Turning off quick-swap does not consume the keyboard event
    if (isQuickSwapEnabled()) toggleQuickSwap(false);
    return false;
}

/**
 * Handles a keyboard key being pressed.
 * @param {string} char - The char of the pressed keyboard key
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCharKey(char) {
    if (isCharPickerOpen()) {
        applyPrimaryChar(char);
        toggleCharPicker(false);
        return true;
    }

    if (isQuickSwapEnabled()) {
        applyPrimaryChar(char);

        selectionController.raster.handleCharKey(char)
        selectionController.vector.handleCharKey(char);
        return true;
    }

    return false;
}

/**
 * Handles the start of a text composition sequence.
 * @param {boolean} rollbackPrevChar - Whether the character typed just before the composition should be rolled back and
 *   included in the composition buffer.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionStart(rollbackPrevChar) {
    if (isCharPickerOpen()) {
        return true;
    }

    if (isQuickSwapEnabled()) {
        selectionController.raster.handleCompositionStart(rollbackPrevChar);
        selectionController.vector.handleCompositionStart(rollbackPrevChar);
        return true;
    }

    return false;
}

/**
 * Handles updates during an active text composition sequence.
 *
 * TODO Making IME compositions will not work. The picker immediately closes as the first char is not a dead char.
 *
 * @param {string} str - The current composition string. Often a single character such as "´" or "é", but can be
 *   longer if the sequence is invalid (e.g. "´x") or if IME composition is used.
 * @param {string} char - The last char of the composition string (useful if logic only supports a single character).
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionUpdate(str, char) {
    if (isCharPickerOpen()) {
        applyPrimaryChar(char);
        return true;
    }

    if (isQuickSwapEnabled()) {
        applyPrimaryChar(char);
        selectionController.raster.handleCompositionUpdate(str, char)
        selectionController.vector.handleCompositionUpdate(str, char)
        return true;
    }

    return false;
}

/**
 * Handles the end of a text composition sequence.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionEnd() {
    if (isCharPickerOpen()) {
        toggleCharPicker(false);
        return true;
    }

    if (isQuickSwapEnabled()) {
        selectionController.raster.handleCompositionEnd();
        selectionController.vector.handleCompositionEnd();
        return true;
    }

    return false;
}

// -------------------------------------------------------------------------------- Events

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED], () => refresh())

    let prevCell; // Used to keep track of whether the mousemove is entering a new cell

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvas, mouseDownButton, currentPoint }) => {
        const tool = toolForMouseButton(mouseDownButton);
        $canvasContainer.css('cursor', cursorStyle(tool, true, mouseEvent, cell, canvas));

        prevCell = undefined;

        switch(tool) {
            case 'draw-freeform':
                handleDrawMousedown(SHAPE_TYPES.FREEFORM, cell, currentPoint);
                break;
            case 'draw-rect':
                handleDrawMousedown(SHAPE_TYPES.RECT, cell, currentPoint);
                break;
            case 'draw-line':
                handleDrawMousedown(SHAPE_TYPES.LINE, cell, currentPoint);
                break;
            case 'draw-ellipse':
                handleDrawMousedown(SHAPE_TYPES.ELLIPSE, cell, currentPoint);
                break;
            case 'draw-textbox':
                handleDrawMousedown(SHAPE_TYPES.TEXTBOX, cell, currentPoint);
                break;
            case 'eraser':
                if (state.currentLayerType() === LAYER_TYPES.RASTER) {
                    rasterEraser(cell, currentPoint);
                } else {
                    vectorEraser(cell);
                }
                break;
            case 'paint-brush':
                // Paint brush is just a freeform line set to monochar style with undefined char and defined color
                handleDrawMousedown(SHAPE_TYPES.FREEFORM, cell, currentPoint, {
                    [STROKE_STYLE_PROPS[SHAPE_TYPES.FREEFORM]]: STROKE_STYLE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_MONOCHAR,
                    [CHAR_PROP]: undefined,
                    [COLOR_PROP]: state.primaryColorIndex()
                });
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

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({mouseEvent, cell, canvas, isDragging, originalPoint, currentPoint, mouseDownButton}) => {
        const tool = toolForMouseButton(mouseDownButton);
        $canvasContainer.css('cursor', cursorStyle(tool, isDragging, mouseEvent, cell, canvas));

        // Keep track of whether the mousemove has reached a new cell (helps with performance, so we can just redraw
        // when a new cell is reached, not on every pixel change)
        const isNewCell = !prevCell || !prevCell.equals(cell);

        switch(tool) {
            case 'draw-rect':
            case 'draw-ellipse':
            case 'draw-textbox':
            case 'paint-brush':
                if (isDragging && isNewCell) handleDrawMousemove(cell, currentPoint);
                break;
            case 'draw-freeform':
                // Intentionally not checking if isNewCell; we update the char based on pixels not cells
                if (isDragging) handleDrawMousemove(cell, currentPoint);
                break;
            case 'draw-line':
                // Intentionally not checking if isDragging; mouseup can occur between points on polyline
                if (isNewCell) handleDrawMousemove(cell, currentPoint);
                break;
            case 'eraser':
                if (state.currentLayerType() === LAYER_TYPES.RASTER) {
                    if (isDragging && isNewCell) handleDrawMousemove(cell, currentPoint);
                } else {
                    if (isDragging && isNewCell) vectorEraser(cell);
                }
                break;
            case 'pan':
                if (isDragging) {
                    eventBus.emit(EVENTS.CANVAS.PAN_DELTA, {
                        delta: [originalPoint.x - currentPoint.x, originalPoint.y - currentPoint.y]
                    })
                }
                break;
            case 'move-all':
                if (isDragging && isNewCell) updateMoveAll(cell);
                break;
        }

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell, canvas, isDragging, mouseDownButton }) => {
        const tool = toolForMouseButton(mouseDownButton);

        // Draw cursor according to state tool (not toolForMouseButton which will be outdated soon) and as if isDragging was false
        $canvasContainer.css('cursor', cursorStyle(state.getConfig('tool'), false, mouseEvent, cell, canvas));

        if (!isDragging) return;

        switch(tool) {
            case 'draw-freeform':
            case 'draw-rect':
            case 'draw-line':
            case 'draw-ellipse':
            case 'draw-textbox':
            case 'paint-brush':
                handleDrawMouseup(cell, mouseEvent);
                break;
            case 'eraser':
                if (state.currentLayerType() === LAYER_TYPES.RASTER) {
                    handleDrawMouseup(cell, mouseEvent);
                } else {
                    vectorEraserFinished();
                }
                break;
            case 'move-all':
                finishMoveAll();
                break;
            default:
                return; // Ignore all other tools
        }
    });

    eventBus.on(EVENTS.CANVAS.DBLCLICK, ({ mouseEvent, cell, canvas }) => {
        $canvasContainer.css('cursor', cursorStyle(state.getConfig('tool'), false, mouseEvent, cell, canvas));

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

        if (selectionController.vector.hasSelectedShapes()) {
            shapeColorPicker.value(color)
        }
    })
    eventBus.on(EVENTS.UNICODE.CHAR_SELECTED, ({ char }) => {
        applyPrimaryChar(char);
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
                if (disableOnMove && selectionController.raster.movableContent()) { return false; }
                return true;
            },
            shortcutAbbr: shortcutAbbr
        });
    }

    registerAction('move', () => selectionController.raster.toggleMovingContent(), false, `${modifierAbbr('metaKey')}Click`);
    registerAction('flip-v', e => selectionController.raster.flipVertically(shouldModifyAction('tools.selection.flip-v.mirror', e)));
    registerAction('flip-h', e => selectionController.raster.flipHorizontally(shouldModifyAction('tools.selection.flip-h.mirror', e)));
    registerAction('clone', () => selectionController.raster.cloneToAllFrames());
    registerAction('fill-char', () => fillSelection(state.getConfig('primaryChar'), undefined));
    registerAction('fill-color', () => fillSelection(undefined, state.primaryColorIndex()));
    registerAction('convert-to-whitespace', () => replaceInSelection(EMPTY_CHAR, WHITESPACE_CHAR));
    registerAction('convert-to-empty', () => replaceInSelection(WHITESPACE_CHAR, EMPTY_CHAR));
    registerAction('resize', () => resizeToSelection());
    registerAction('close', () => selectionController.raster.clear(), true, 'Esc');

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
    const isVisible = selectionController.raster.hasSelection() && !selectionController.raster.caretCell();
    $selectionTools.toggle(isVisible);
    if (!isVisible) selectionTooltips.tooltips.forEach(tooltip => tooltip.hide())

    $selectionTools.find('.sub-tool[data-tool="move"]').toggleClass('active', !!selectionController.raster.movableContent());

    $selectionTools.find('.sub-tool').each((i, element) => {
        const $element = $(element);
        const actionId = actionIdForSelectionTool($element.data('tool'));
        $element.html(getIconHTML(actionId))
        $element.toggleClass('disabled', !actions.isActionEnabled(actionId));
    });

    $selectionTools.find('.color-tool').toggleClass('hidden', !state.isMultiColored())
}

function fillSelection(char, color) {
    selectionController.raster.getSelectedCells().forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, char, color);
    });

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function replaceInSelection(findChar, replaceChar) {
    selectionController.raster.getSelectedCells().forEach(cell => {
        if (state.getCurrentCelGlyph(cell.row, cell.col)[0] === findChar) {
            state.setCurrentCelGlyph(cell.row, cell.col, replaceChar);
        }
    });

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function resizeToSelection() {
    const area = selectionController.raster.getSelectedCellArea().bindToDrawableArea();
    state.resize([area.numRows, area.numCols], area.topLeft.row, area.topLeft.col);
    eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
    state.pushHistory({ requiresResize: true });
}


// -------------------------------------------------------------------------------- Brush

const BRUSH_TOOLS = ['draw-freeform', 'eraser', 'paint-brush'];

function isDrawBrushEnabled() {
    if (!BRUSH_TOOLS.includes(state.getConfig('tool'))) return false;

    switch(state.getConfig('tool')) {
        case 'draw-freeform':
            // Brush is only used when drawing irregular-monochar (not other types of freeform drawings)
            return state.getConfig('drawStrokeStyles')[SHAPE_TYPES.FREEFORM] === 'irregular-monochar';
        default:
            return true;
    }
}

export function hoveredCells(primaryCell) {
    if (!primaryCell) return [];
    if (!isDrawBrushEnabled()) return [primaryCell];
    const { type, size } = BRUSHES[state.getConfig('brush')];

    switch(type) {
        case BRUSH_TYPES.PIXEL_PERFECT:
            return squareBrushCells(primaryCell, 1);
        case BRUSH_TYPES.SQUARE:
            return squareBrushCells(primaryCell, size);
        case BRUSH_TYPES.DIAMOND:
            return diamondBrushCells(primaryCell, size);
        default:
            console.error('Unsupported brush type: ', type);
    }
}


function setupBrushSubMenu() {
    const $container = $('#context-tools-left');
    const $menu = $('<div>', {
        class: 'sub-tool-menu'
    }).appendTo($container);

    const menu = new IconMenu($menu, {
        items: Object.keys(BRUSHES).map(brush => {
            return {
                value: brush,
                icon: `tools.brush.${brush}`,
                tooltip: `tools.brush.${brush}`
            }
        }),
        visible: () => BRUSH_TOOLS.includes(state.getConfig('tool')),
        disabled: () => !isDrawBrushEnabled(),
        getValue: () => state.getConfig('brush'),
        onSelect: newValue => {
            state.setConfig('brush', newValue)
            refresh();
        }
    })

    subMenus.push(menu);
}

// -------------------------------------------------------------------------------- Shape Properties

let $shapeProperties, shapeTooltips;
const shapeSubMenus = {};

function setupShapeProperties() {
    $shapeProperties = $('#shape-properties')

    // Stroke dropdowns for each shape type
    const $strokeActions = $('#shape-stroke-menu-group').find('.group-actions')
    Object.values(SHAPE_TYPES).forEach(shapeType => {
        if (!STROKE_STYLE_PROPS[shapeType]) return; // Shape has no stroke prop

        setupStrokeMenu($('<div>', {
            class: 'flex-row',
            style: `gap:0.25rem;`
        }).appendTo($strokeActions), shapeType)
    });

    setupBrushMenu();

    setupFillMenu();

    setupTextAlignMenu($('#shape-text-align-h'), TEXT_ALIGN_H_PROP, Object.values(TEXT_ALIGN_H_OPTS));
    setupTextAlignMenu($('#shape-text-align-v'), TEXT_ALIGN_V_PROP, Object.values(TEXT_ALIGN_V_OPTS));

    setupOrderMenu();

    actions.registerAction('tools.shapes.delete', {
        callback: () => selectionController.vector.deleteSelectedShapes(),
        enabled: () => selectionController.vector.hasSelectedShapes(),
        shortcutAbbr: 'Delete'
    })

    actions.registerAction('tools.shapes.editText', {
        callback: () => selectionController.vector.selectAllText(),
        visible: () => selectionController.vector.hasTextProperty(),
        enabled: () => selectionController.vector.canEnterEditMode(),
        shortcutAbbr: 'Enter'
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
    const strokeProp = STROKE_STYLE_PROPS[shapeType];

    const styleMenu = new IconMenu($menu, {
        dropdown: true,
        dropdownBtnTooltip: `tools.shapes.${strokeProp}`,
        items: Object.values(STROKE_STYLE_OPTIONS[shapeType]).map(stroke => {
            return {
                value: stroke,
                icon: `tools.shapes.${strokeProp}.${stroke}`,
                tooltip: `tools.shapes.${strokeProp}.${stroke}`,
            }
        }),
        visible: () => selectionController.vector.selectedShapeTypes().includes(shapeType),
        getValue: () => selectionController.vector.selectedShapeProps()[strokeProp][0],
        onSelect: newValue => {
            selectionController.vector.updateSelectedShapes(shape => {
                return shape.type === shapeType && shape.updateProp(strokeProp, newValue);
            });
        },
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus[strokeProp] = styleMenu;
}


// Brush option is disabled if there is a linked prop enforcing a different brush option
function isBrushDisabled(brush, currentShapeProps) {
    return LINKED_PROPS.some(({ when, enforce }) => {
        return currentShapeProps[when.prop].includes(when.value) &&
            enforce.prop === BRUSH_PROP && enforce.value !== brush
    })
}

function setupBrushMenu() {
    const $menu = $('<div>').appendTo($('#shape-brush-menu-group').find('.group-actions'));

    const menu = new IconMenu($menu, {
        dropdown: true,
        dropdownBtnTooltip: `tools.shapes.${BRUSH_PROP}`,
        items: Object.keys(BRUSHES).map(option => {
            return {
                value: option,
                icon: `tools.brush.${option}`,
                tooltip: `tools.brush.${option}`,

                // Currently there is no need to disable individual items because linked prop causes entire menu to be hidden
                // disabled: () => isBrushDisabled(option, selectionController.vector.selectedShapeProps())
            }
        }),
        visible: () => {
            if (!selectionController.vector.selectedShapeProps()[BRUSH_PROP].length) return false;

            // Only visible if more than one option is enabled
            const shapeProps = selectionController.vector.selectedShapeProps();
            return Object.keys(BRUSHES).filter(brush => !isBrushDisabled(brush, shapeProps)).length > 1;
        },
        getValue: () => selectionController.vector.selectedShapeProps()[BRUSH_PROP][0],
        onSelect: newValue => selectionController.vector.updateSelectedShapes(shape => shape.updateProp(BRUSH_PROP, newValue)),
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus[BRUSH_PROP] = menu;
}

function setupTextAlignMenu($menu, prop, options) {
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
        visible: () => selectionController.vector.selectedShapeProps()[prop].length,
        getValue: () => selectionController.vector.selectedShapeProps()[prop][0],
        onSelect: newValue => selectionController.vector.updateSelectedShapes(shape => shape.updateProp(prop, newValue)),
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus[prop] = menu;
}

function setupFillMenu() {
    const $menu = $('<div>').appendTo($('#shape-fill-menu-group').find('.group-actions'));

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
        visible: () => selectionController.vector.selectedShapeProps()[FILL_PROP].length,
        getValue: () => selectionController.vector.selectedShapeProps()[FILL_PROP][0],
        onSelect: newValue => selectionController.vector.updateSelectedShapes(shape => shape.updateProp(FILL_PROP, newValue)),
        tooltipOptions: {
            placement: 'right'
        }
    })

    shapeSubMenus[FILL_PROP] = menu;
}

function setupOrderMenu() {
    const $menu = $('#shape-order');

    Object.values(REORDER_ACTIONS).forEach(action => {
        actions.registerAction(`tools.shapes.${action}`, {
            callback: () => selectionController.vector.reorderSelectedShapes(action),
            enabled: () => selectionController.vector.canReorderSelectedShapes(action),
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

    shapeSubMenus['ORDER'] = menu;
}

function refreshShapeProperties() {
    const isVisible = selectionController.vector.hasSelectedShapes();
    $shapeProperties.toggle(isVisible);

    if (isVisible) {
        // Toggle menu visibility
        Object.values(shapeSubMenus).forEach(menu => menu.refresh());

        // Toggle menu group visibility (the containers around groups of menus)
        $shapeProperties.find('#shape-stroke-menu-group').toggle(
            Object.values(STROKE_STYLE_PROPS).some(prop => shapeSubMenus[prop].isVisible())
        )
        $shapeProperties.find('#shape-brush-menu-group').toggle(shapeSubMenus[BRUSH_PROP].isVisible())
        $shapeProperties.find('#shape-text-align').toggle(
            shapeSubMenus[TEXT_ALIGN_H_PROP].isVisible() || shapeSubMenus[TEXT_ALIGN_V_PROP].isVisible()
        )
        $shapeProperties.find('#shape-fill-menu-group').toggle(shapeSubMenus[FILL_PROP].isVisible())
        $shapeProperties.find('#shape-color-menu-group').toggle(state.isMultiColored())
        $shapeProperties.find('#shape-char-menu-group').toggle(selectedShapesUseCharPicker())

        // Refresh action buttons
        $shapeProperties.find('.action-button').each((i, element) => {
            const $element = $(element);
            const actionId = $element.data('action');
            $element.html(getIconHTML(actionId))
            $element.toggleClass('disabled', !actions.isActionEnabled(actionId));
            $element.toggle(actions.isActionVisible(actionId));
        });
    } else {
        shapeTooltips.tooltips.forEach(tooltip => tooltip.hide())
        // todo hide tooltips for other stuff like shape char picker
    }
}

function selectedShapesUseCharPicker() {
    let strokeUsesChar = false;
    Object.values(STROKE_STYLE_PROPS).forEach(strokeProp => {
        const strokes = selectionController.vector.selectedShapeProps()[strokeProp];

        // TODO This is basing monochar styles off of their key name... change to a real property
        if (strokes.some(stroke => stroke.includes('monochar'))) strokeUsesChar = true;
    })

    const fillUsesChar = selectionController.vector.selectedShapeProps()[FILL_PROP].some(fill => fill === FILL_OPTIONS.MONOCHAR);

    return strokeUsesChar || fillUsesChar;
}

// -------------------------------------------------------------------------------- Color Tools

function fillConnectedCells(cell, char, colorIndex, options) {
    if (!state.isCellInBounds(cell)) return;

    selectionController.raster.getConnectedCells(cell, options).forEach(cell => {
        state.setCurrentCelGlyph(cell.row, cell.col, char, colorIndex);
    })

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory();
}

function colorSwap(cell, options) {
    if (!state.isCellInBounds(cell)) return;

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

    const strokeProp = STROKE_STYLE_PROPS[shapeType]

    const menu = new IconMenu($menu, {
        items: Object.values(STROKE_STYLE_OPTIONS[shapeType]).map(stroke => {
            return {
                value: stroke,
                icon: `tools.shapes.${strokeProp}.${stroke}`,
                tooltip: `tools.shapes.${strokeProp}.${stroke}`,
            }
        }),
        visible: () => state.getConfig('tool') === toolKey,
        getValue: () => state.getConfig('drawStrokeStyles')[shapeType],
        onSelect: newValue => {
            const currentStrokes = structuredClone(state.getConfig('drawStrokeStyles'));
            currentStrokes[shapeType] = newValue;
            state.setConfig('drawStrokeStyles', currentStrokes);
            refresh();
        },
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

function handleDrawMousedown(shapeType, cell, currentPoint, options = {}) {
    if (!drawingContent) {
        selectionController.vector.deselectAllShapes(false); // Don't push to history; we will push history when drawing finished

        // todo rename drawingShape?
        drawingContent = Shape.begin(shapeType, {
            [CHAR_PROP]: state.getConfig('primaryChar'),
            [COLOR_PROP]: state.primaryColorIndex(),
            [STROKE_STYLE_PROPS[shapeType]]: state.getConfig('drawStrokeStyles')[shapeType],
            [BRUSH_PROP]: state.getConfig('brush'),
            ...options
        });
    }

    drawingContent.handleDrawMousedown(cell, { point: currentPoint });
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function handleDrawMousemove(cell, currentPoint, options = {}) {
    if (!drawingContent) return;
    if (!cell) return;

    drawingContent.handleDrawMousemove(cell, { point: currentPoint, ...options });

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

    // If the drawn shape would be deleted (e.g. empty Textbox), immediately start editing its text
    if (drawingContent.deleteOnTextFinished()) {
        changeTool('select', false);
        selectionController.vector.setSelectedShapeIds([drawingContent.id])
        selectionController.vector.setTextCaret(0, { saveHistory: false });
    }

    drawingContent = null;
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}


// -------------------------------------------------------------------------------- Eraser

// Raster eraser is just a freeform line set to monochar style & empty char. After creating this shape,
// its mousemove/mouseup can simply be handled by the usual handleDrawMousemove/handleDrawMouseup.
function rasterEraser(cell, currentPoint) {
    handleDrawMousedown(SHAPE_TYPES.FREEFORM, cell, currentPoint, {
        [STROKE_STYLE_PROPS[SHAPE_TYPES.FREEFORM]]: STROKE_STYLE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_MONOCHAR,
        [CHAR_PROP]: EMPTY_CHAR,
        [COLOR_PROP]: undefined
    });
}

// Vector eraser deletes any shapes touched by the brush
function vectorEraser(primaryCell) {
    const shapeIds = new Set();

    hoveredCells(primaryCell).forEach(cell => {
        const handle = state.testCurrentCelShapeHitboxes(cell);
        if (handle && handle.shapeId) shapeIds.add(handle.shapeId);
    });

    shapeIds.forEach(shapeId => state.deleteCurrentCelShape(shapeId));

    if (shapeIds.size > 0) {
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    }
}

function vectorEraserFinished() {
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

function updateMoveAll(cell) {
    if (moveAllOrigin) {
        moveAllOffset = {
            row: cell.row - moveAllOrigin.row,
            col: cell.col - moveAllOrigin.col
        };
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    }
}

function finishMoveAll() {
    if (moveAllOffset) {
        state.iterateCels(moveAllModifiers.allLayers, moveAllModifiers.allFrames, cel => {
            state.translateCel(cel, moveAllOffset.row, moveAllOffset.col, moveAllModifiers.wrap)
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
        callback: () => toggleQuickSwap(true),
        shortcutAbbr: `Q to enter, Esc to exit`
    })

    primaryCharPicker = new CharPicker($charPicker, {
        initialValue: 'A',
        onLoad: newValue => setPrimaryChar(newValue),
        onChange: newValue => applyPrimaryChar(newValue),
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
        onChange: newValue => applyPrimaryChar(newValue),
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
    $quickSwap.off('click').on('click', () => toggleQuickSwap());

    charQuickSwapTooltip = setupTooltips($quickSwap.toArray(), 'tools.standard.quick-swap-char', {
        offset: tooltipOffset('center-corner-button')
    }).tooltips[0];
}

function refreshCharPicker() {
    const char = selectionController.vector.hasSelectedShapes() ?
        selectionController.vector.selectedShapeProps()[CHAR_PROP][0] :
        state.getConfig('primaryChar');

    setPrimaryChar(char);

    $charPicker.toggleClass('animated-border', isQuickSwapEnabled());
}

function isCharPickerOpen() {
    return primaryCharPicker.isOpen || shapeCharPicker.isOpen;
}
function toggleCharPicker(open) {
    if (open) {
        primaryCharPicker.toggle(true);
    } else {
        primaryCharPicker.toggle(false);
        shapeCharPicker.toggle(false);
    }
}

function applyPrimaryChar(char) {
    setPrimaryChar(char);

    // TODO MAYBE WRONG SPOT FOR THIS?
    selectionController.vector.updateSelectedShapes(shape => shape.updateProp(CHAR_PROP, char));
}

function setPrimaryChar(char) {
    if (primaryCharPicker) primaryCharPicker.value(char, true);
    if (shapeCharPicker) shapeCharPicker.value(char, true);
    state.setConfig('primaryChar', char);
    eventBus.emit(EVENTS.TOOLS.CHAR_CHANGED);
}

// "Quick Swap" is a toggle that lets the user instantly update the char picker's selected value by pressing a keyboard key
let quickSwapEnabled = false;

function isQuickSwapEnabled() {
    if (selectionController.raster.hasSelection()) return true;
    return quickSwapEnabled;
}

function toggleQuickSwap(enabled) {
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
        selectionController.vector.updateSelectedShapes(shape => shape.updateProp(COLOR_PROP, colorIndex));
    }
}

// When one picker selects a color, we update the value in the other picker. We call updateSelectedShapes
// with historyMode:false because the picker will trigger update events for every pixel that the mouse
// moves over while changing the color. We want the shapes to update in real time, but we do not commit the
// change to history until the picker's onDone is called.
function selectColorFromPicker(colorStr, fromPicker) {
    if (fromPicker !== primaryColorPicker) primaryColorPicker.value(colorStr, true);
    if (fromPicker !== shapeColorPicker) shapeColorPicker.value(colorStr, true);

    state.setConfig('primaryColor', colorStr);
    eventBus.emit(EVENTS.TOOLS.COLOR_CHANGED);

    const colorIndex = state.colorIndex(colorStr);
    selectionController.vector.updateSelectedShapes(shape => shape.updateProp(COLOR_PROP, colorIndex), false);
}

function refreshColorPicker() {
    const color = selectionController.vector.hasSelectedShapes() ?
        state.colorStr(selectionController.vector.selectedShapeProps()[COLOR_PROP][0]) :
        state.getConfig('primaryColor');

    selectColor(color, false);
}



// -------------------------------------------------------------------------------- Misc.

function cursorStyle(tool, isDragging, mouseEvent, cell, canvas) {
    const grab = isDragging ? 'grabbing' : 'grab'

    switch (tool) {
        case 'select':
            const handle = selectionController.vector.getHandle(cell, mouseEvent, canvas);
            return handle ? handle.cursor : 'default';
        case 'text-editor':
            return selectionController.raster.isSelectedCell(cell) && selectionController.raster.allowMovement(tool, mouseEvent) ? grab : 'text';
        case 'selection-rect':
        case 'selection-line':
        case 'selection-lasso':
        case 'selection-wand':
            return selectionController.raster.isSelectedCell(cell) && selectionController.raster.allowMovement(tool, mouseEvent) ? grab : 'cell';
        case 'draw-freeform':
        case 'draw-rect':
        case 'draw-line':
        case 'draw-ellipse':
        case 'draw-textbox':
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