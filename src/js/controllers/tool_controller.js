/**
 * This is the UI component for the canvas toolbar:
 * - The standard toolbar on the left of the main canvas (e.g. free draw, draw line, paint brush, etc.)
 * - The submenu toolbar that appears on the left when you've made a selection, or to choose a brush size, etc.
 * - The color picker on the left toolbar
 */

import * as state from '../state/index.js';
import * as selectionController from "./selection/index.js";
import * as actions from "../io/actions.js";
import {setupActionTooltips, shouldModifyAction} from "../io/actions.js";
import {modifierAbbr} from "../utils/os.js";
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
    BRUSH_PROP, LINKED_PROPS, COLOR_STR_PROP, WRITE_EMPTY_CHARS_PROP, HANDLE_TYPES, ARROWHEAD_START_PROP,
    ARROWHEAD_END_PROP, ARROWHEAD_OPTIONS
} from "../geometry/shapes/constants.js";
import ColorPicker from "../components/color_picker.js";
import {refreshableTooltips, standardTip, standardTipContentBuilder} from "../components/tooltips.js";
import IconMenu from "../components/icon_menu.js";
import {MOUSE} from "../io/mouse.js";
import {LAYER_TYPES} from "../state/constants.js";
import {diamondBrushCells, squareBrushCells} from "../geometry/shapes/algorithms/brush.js";
import Shape from "../geometry/shapes/shape.js";
import {selectedShapes} from "../state/selection/vector_selection.js";
import {filterObject, isEmptyObject, transformValues} from "../utils/objects.js";
import {getConstructor} from "../geometry/shapes/registry.js";
import SimpleBar from "simplebar";


// -------------------------------------------------------------------------------- Main External API

let $standardTools, $canvasContainer;

export function init() {
    $canvasContainer = $('#canvas-container');

    setupEventBus();
    setupTools();
    setupColorPicker();
    setupCharPicker();
    setupShapeProperties();
}

function refresh() {
    refreshTools();
    refreshCharPicker();
    refreshColorPicker();
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
 * Handles the enter key being pressed.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEnterKey() {
    if (drawingContent && drawingContent.shouldFinishDrawOnKeypress()) {
        finishDrawing();
        return true;
    }

    return false;
}

/**
 * Handles the escape key being pressed.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEscapeKey() {
    // Close char picker if it's open
    if (isCharPickerOpen()) {
        toggleCharPicker(false);
        return true;
    }

    // Close any submenus if they are open
    if (Object.values(shapeProperties).some(property => property.menu.isOpen)) {
        Object.values(shapeProperties).forEach(property => property.menu.toggleDropdown(false))
        return true;
    }

    // Disable quick-swap if it's enabled
    if (isQuickSwapEnabled()) {
        toggleQuickSwap(false);

        // Normally, we consume this event to prevent further handling. However, if a raster selection exists, we allow
        // the event through. This is because raster selections are tied to quick-swap mode, and letting the event
        // propagate allows the selection to be cleared as well.
        return !selectionController.raster.hasSelection();
    }

    // Some drawing shapes (e.g. multipoint lines) may be terminated with esc key
    if (drawingContent && drawingContent.shouldFinishDrawOnKeypress()) {
        finishDrawing();
        return true;
    }

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
            case 'draw-diamond':
                handleDrawMousedown(SHAPE_TYPES.DIAMOND, cell, currentPoint);
                break;
            case 'draw-textbox':
                handleDrawMousedown(SHAPE_TYPES.TEXTBOX, cell, currentPoint);
                break;
            case 'eraser':
                if (state.currentLayerType() === LAYER_TYPES.RASTER) {
                    rasterEraser(cell, currentPoint);
                } else {
                    vectorEraserStarted(cell);
                }
                break;
            case 'paint-brush':
                // Paint brush is just a freeform line set to monochar style with undefined char and defined color
                handleDrawMousedown(SHAPE_TYPES.FREEFORM, cell, currentPoint, {
                    [STROKE_STYLE_PROPS[SHAPE_TYPES.FREEFORM]]: STROKE_STYLE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_MONOCHAR,
                    [CHAR_PROP]: undefined,
                    [COLOR_PROP]: state.primaryColorIndex(),
                    [WRITE_EMPTY_CHARS_PROP]: true
                });
                break;
            case 'fill-char':
                fillConnectedCells(cell, state.getDrawingChar(), state.primaryColorIndex(), {
                    diagonal: shouldModifyAction('tools.standard.fill-char.diagonal', mouseEvent),
                    charblind: false,
                    colorblind: false
                });
                break;
            case 'color-swap':
                colorSwap(cell, {
                    allLayers: shouldModifyAction('tools.standard.color-swap.all-layers', mouseEvent),
                    allFrames: shouldModifyAction('tools.standard.color-swap.all-frames', mouseEvent)
                })
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
            case 'draw-diamond':
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
            case 'draw-diamond':
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

    eventBus.on(EVENTS.PALETTE.COLOR_SELECTED, ({ color }) => applyColor(color));
    eventBus.on(EVENTS.UNICODE.CHAR_SELECTED, ({ char }) => applyPrimaryChar(char));
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

let $tools, toolsMenu;

const TOOLS = [
    { value: 'select', group: 'Mouse' },
    { value: 'text-editor', group: 'Mouse' },
    { value: 'pan', group: 'Mouse' },
    { value: 'move-all', group: 'Mouse' },

    { value: 'draw-rect', group: 'Draw Shape' },
    { value: 'draw-diamond', group: 'Draw Shape' },
    { value: 'draw-ellipse', group: 'Draw Shape' },
    { value: 'draw-line', group: 'Draw Shape' },

    { value: 'draw-freeform', },
    { value: 'draw-textbox', },
    { value: 'eraser', },
    { value: 'fill-char', },

    { value: 'selection-rect', group: 'Selection' },
    { value: 'selection-lasso', group: 'Selection' },
    { value: 'selection-line', group: 'Selection' },
    { value: 'selection-wand', group: 'Selection' },

    { value: 'paint-brush', group: 'Color' },
    { value: 'color-swap', group: 'Color' },
]

function setupTools() {
    $tools = $('#tools');

    TOOLS.forEach(tool => {
        const actionData = {
            callback: () => changeTool(tool.value),
            enabled: () => {
                if (state.MULTICOLOR_TOOLS.has(tool.value) && !state.isMultiColored()) return false;
                if (state.layers()) {
                    if (state.RASTER_TOOLS.has(tool.value) && state.currentLayerType() !== LAYER_TYPES.RASTER) return false;
                    if (state.VECTOR_TOOLS.has(tool.value) && state.currentLayerType() !== LAYER_TYPES.VECTOR) return false;
                }
                return true;
            },
        }

        // Some tools have custom shortcuts
        switch (tool.value) {
            case 'pan':
                actionData.shortcutAbbr = 'H, Middle Click'
                break;
            case 'eraser':
                actionData.shortcutAbbr = 'E, Right Click'
                break;
            case 'draw-textbox':
                actionData.shortcutAbbr = 'Double Click'
                break;
        }

        actions.registerAction(`tools.standard.${tool.value}`, actionData);
    });

    toolsMenu = new IconMenu($tools, {
        dropdown: false,
        items: TOOLS.map(tool => {
            return {
                value: tool.value,
                icon: `tools.standard.${tool.value}`,
                tooltip: `tools.standard.${tool.value}`,
                visible: () => actions.isActionEnabled(`tools.standard.${tool.value}`),
                disabled: () => !actions.isActionEnabled(`tools.standard.${tool.value}`),
                group: tool.group
            }
        }),
        getValue: () => state.getConfig('tool'),
        onSelect: newValue => actions.callAction(`tools.standard.${newValue}`),
        tooltipOptions: {
            placement: 'bottom'
        },
        actionTooltips: true
    });
}

function refreshTools() {
    toolsMenu.refresh();
}

// -------------------------------------------------------------------------------- Raster Selection Tools


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

// Brush option is disabled if there is a linked prop enforcing a different brush option
function isBrushDisabled(brush, currentShapeProps) {
    return LINKED_PROPS.some(({ when, enforce }) => {
        return currentShapeProps[when.prop] &&
            currentShapeProps[when.prop].includes(when.value) &&
            enforce.prop === BRUSH_PROP && enforce.value !== brush
    })
}

export function hoveredCells(primaryCell) {
    if (!primaryCell) return [];
    if (!BRUSH_TOOLS.includes(state.getConfig('tool'))) return [primaryCell];

    const brush = firstActiveShapeProp(BRUSH_PROP);
    if (isBrushDisabled(brush, activeShapeProps())) return [primaryCell];

    const { type, size } = BRUSHES[brush];

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

export function showHoverForTool() {
    switch(state.getConfig('tool')) {
        case 'text-editor':
            // If text-editor is in I-beam mode, not showing hover because clicking on a cell does not necessarily
            // go to that cell (it gets rounded up/down -- see Point.caretCell)
            return state.getConfig('caretStyle') !== 'I-beam';
        case 'pan':
        case 'move-all':
            // Not showing hover cell for these tools since they affect entire canvas, not one cell
            return false;
        default:
            return true;
    }
}


// -------------------------------------------------------------------------------- Shape Properties

let $shapeProperties, shapeTooltips = [], shapePropScrollbar;
const shapeProperties = {};

// Most menus are based on shape props and are keyed off the prop. There is no 'prop' for order, so we give it its own key.
const ORDER_MENU = '__ORDER__';

function setupShapeProperties() {
    $shapeProperties = $('#shape-properties');
    shapePropScrollbar = new SimpleBar($shapeProperties.get(0), {
        autoHide: false,
        // forceVisible: true
    });

    Object.values(SHAPE_TYPES).forEach(shapeType => {
        if (!STROKE_STYLE_PROPS[shapeType]) return; // Shape has no stroke prop
        setupStrokeMenu(shapeType)
    });

    setupBrushMenu();
    setupFillMenu();
    setupLineMarkerMenus();
    setupTextAlignMenus();
    setupOrderMenu();

    actions.registerAction('tools.shapes.delete', {
        callback: () => selectionController.vector.deleteSelectedShapes(),
        visible: () => selectionController.vector.hasSelectedShapes(),
        enabled: () => selectionController.vector.hasSelectedShapes(),
        shortcutAbbr: 'Delete'
    })

    actions.registerAction('tools.shapes.editText', {
        callback: () => selectionController.vector.selectAllText(),
        visible: () => selectionController.vector.hasTextProperty(),
        enabled: () => selectionController.vector.canEnterEditMode(),
        shortcutAbbr: 'Enter'
    })

    registerRasterSelectionAction('move', () => {
        selectionController.raster.toggleMovingContent()
    }, {
        enabled: () => true,
        shortcutAbbr: `${modifierAbbr('metaKey')}Click`
    });
    registerRasterSelectionAction('flip-v', e => {
        selectionController.raster.flipVertically(shouldModifyAction('tools.selection.flip-v.mirror', e))
    });
    registerRasterSelectionAction('flip-h', e => {
        selectionController.raster.flipHorizontally(shouldModifyAction('tools.selection.flip-h.mirror', e))
    });
    registerRasterSelectionAction('clone', () => selectionController.raster.cloneToAllFrames(), {
        visible: () => state.isAnimationProject() && selectionController.raster.hasSelection(),
    });
    registerRasterSelectionAction('convert-to-whitespace', () => replaceInSelection(EMPTY_CHAR, WHITESPACE_CHAR));
    registerRasterSelectionAction('convert-to-empty', () => replaceInSelection(WHITESPACE_CHAR, EMPTY_CHAR));
    registerRasterSelectionAction('resize', () => resizeToSelection());

    // quickSwapChar action-button is handled separately by char picker
    const $standardActionButtons = $shapeProperties.find('.action-button:not([data-action="tools.shapes.quickSwapChar"])')

    $standardActionButtons.on('click', evt => {
        const $element = $(evt.currentTarget);
        actions.callAction($element.data('action'), evt);
    });

    shapeTooltips.concat(setupActionTooltips(
        $standardActionButtons,
        $element => $element.data('action'),
        shapeMenuTooltipOptions($shapeProperties.find('#shape-actions').find('.group-actions'))
    ).tooltips);
}

function registerRasterSelectionAction(tool, callback, overrides = {}) {
    actions.registerAction(`tools.selection.${tool}`, {
        callback: callback,
        enabled: () => !selectionController.raster.movableContent(), // Default is to disable action while moving
        visible: () => selectionController.raster.hasSelection(),
        ...overrides
    });
}

function activeShapeTypes() {
    if (selectionController.vector.hasSelectedShapes()) {
        return [...new Set(selectedShapes().map(shape => shape.type))];
    } else {
        switch(state.getConfig('tool')) {
            case 'draw-rect': return [SHAPE_TYPES.RECT];
            case 'draw-freeform': return [SHAPE_TYPES.FREEFORM];
            case 'draw-line': return [SHAPE_TYPES.LINE];
            case 'draw-ellipse': return [SHAPE_TYPES.ELLIPSE];
            case 'draw-diamond': return [SHAPE_TYPES.DIAMOND];
            case 'draw-textbox': return [SHAPE_TYPES.TEXTBOX];
            default: return [];
        }
    }
}

/**
 * Collects the shared prop values across all currently selected shapes.
 *
 * @returns {Object.<string, any[]>} An object where each key is a prop name, and each value is an array of all
 *   distinct values for that property across the selection. All strings listed in SHARED_SHAPE_PROPS will be included
 *   as result keys (their values may be empty arrays). Array values will not contain duplicates.
 */
function activeShapeProps() {
    if (selectionController.vector.hasSelectedShapes()) {
        // If there are one or more shapes selected, we gather props from all the selected shapes. If, for example,
        // one shape had `fill:none` and one had `fill:whitespace`, the result would be `fill:[none,whitespace]`.
        let result = {};
        selectedShapes().forEach(shape => {
            for (const [propKey, propValue] of Object.entries(shape.props)) {
                if (!result[propKey]) result[propKey] = new Set();
                result[propKey].add(propValue);
            }
        })
        return transformValues(result, (k, v) => [...v]);
    } else {
        // If there are no shapes selected, we use portions of config's drawProps based on the current tool
        let allowedProps;
        switch(state.getConfig('tool')) {
            case 'draw-rect':
            case 'draw-freeform':
            case 'draw-line':
            case 'draw-ellipse':
            case 'draw-diamond':
            case 'draw-textbox':
                allowedProps = new Set(getConstructor(activeShapeTypes()[0]).allowedProps);
                // TODO [color prop issue]
                if (allowedProps.has(COLOR_PROP)) {
                    allowedProps.delete(COLOR_PROP);
                    allowedProps.add(COLOR_STR_PROP);
                }
                break;
            case 'fill-char':
                allowedProps = new Set([CHAR_PROP, COLOR_STR_PROP]);
                break;
            case 'paint-brush':
                allowedProps = new Set([BRUSH_PROP, COLOR_STR_PROP]);
                break;
            case 'eraser':
                allowedProps = new Set([BRUSH_PROP]);
                break;
            case 'color-swap':
            case 'text-editor':
                allowedProps = new Set([COLOR_STR_PROP]);
                break;
            case 'selection-rect':
            case 'selection-lasso':
            case 'selection-line':
            case 'selection-wand':
                // Note: I used to show char prop when there was a raster selection (because quick mode is always
                //       enabled in that case), but turned it off for two reasons:
                //       1) The char picker doesn't represent the current state of the selection (we should make it like
                //          the color picker where it has a split mode).
                //       2) Choosing a char doesn't fill the selection (this is probably an easy fix though).
                //       There is a drawback with hiding the char picker: it is hard to set a selection to a new unicode char.
                allowedProps = new Set(selectionController.raster.hasSelection() ? [COLOR_STR_PROP] : [])
                break;
            default:
                allowedProps = new Set();
        }

        const filteredProps = filterObject(state.getConfig('drawProps'), (prop, _) => {
            if (prop === COLOR_STR_PROP && !state.isMultiColored()) return false;
            return allowedProps.has(prop)
        });
        return transformValues(filteredProps, (propKey, propValue) => [propValue]);
    }
}

// TODO [color prop issue] - would something like this be cleaner?
// function drawPropsForShape() {
//     const drawProps = structuredClone(state.getConfig('drawProps'));
//     drawProps[COLOR_PROP] = state.colorIndex(drawProps[COLOR_STR_PROP]);
//     delete drawProps[COLOR_STR_PROP];
//     return drawProps;
// }
// function drawPropsForConfig() {
//     const drawProps = structuredClone(state.getConfig('drawProps'));
//     drawProps[COLOR_PROP] = state.colorIndex(drawProps[COLOR_STR_PROP]);
//     delete drawProps[COLOR_STR_PROP];
//     return drawProps;
// }


function firstActiveShapeProp(propKey) {
    const props = activeShapeProps();
    return props[propKey] === undefined ? undefined : props[propKey][0];
}

function updateActiveShapeProp(propKey, propValue, propagate = true) {
    let refreshTools = state.getConfig('drawProps')[propKey] !== propValue; // refresh tools if drawing property changes

    // Always update the drawing prop
    state.updateDrawingProp(propKey, propValue);

    // Also update any selected shape's props, if propagate is true
    if (propagate && selectionController.vector.hasSelectedShapes()) {
        const shapesUpdated = selectionController.vector.updateSelectedShapes(shape => shape.updateProp(propKey, propValue))
        if (shapesUpdated) refreshTools = false; // if shapes were updated, that will refresh tools, no need to refresh again
    }

    if (propagate && refreshTools) refresh();
}

function setupShapeMenu($group, prop, options, overrides = {}) {
    const $actions = $group.find('.group-actions');

    shapeProperties[prop] = {
        $group: $group,
        menu: new IconMenu($actions, {
            dropdown: false,
            dropdownBtnTooltip: `tools.shapes.${prop}`,
            items: options.map(option => {
                return {
                    value: option,
                    icon: `tools.shapes.${prop}.${option}`,
                    tooltip: `tools.shapes.${prop}.${option}`,
                }
            }),
            visible: () => activeShapeProps()[prop] !== undefined,
            getValue: () => firstActiveShapeProp(prop),
            onSelect: newValue => updateActiveShapeProp(prop, newValue),
            transparentBtns: false,
            tooltipOptions: shapeMenuTooltipOptions($actions),
            ...overrides
        })
    }
}

function shapeMenuTooltipOptions($container, placement = 'outside') {
    switch (placement) {
        case 'outside':
            // Offsets the tooltips to be outside the shape properties island with consistent placement
            return {
                placement: 'right',
                getReferenceClientRect: () => $container.get(0).getBoundingClientRect(),
                offset: [0, 20]
            }
        default:
            return {
                placement: placement,
                offset: [0, 15]
            }
    }
}

function setupStrokeMenu(shapeType) {
    const $group = $(`#shape-${shapeType}-stroke-menu-group`)

    setupShapeMenu(
        $group,
        STROKE_STYLE_PROPS[shapeType],
        Object.values(STROKE_STYLE_OPTIONS[shapeType]),
        {
            visible: () => activeShapeTypes().includes(shapeType),
        }
    )
}

function setupBrushMenu() {
    setupShapeMenu($('#shape-brush-menu-group'), BRUSH_PROP, Object.keys(BRUSHES), {
        visible: () => {
            const shapeProps = activeShapeProps();
            if (shapeProps[BRUSH_PROP] === undefined) return false;

            // Only visible if more than one option is enabled
            return Object.keys(BRUSHES).filter(brush => !isBrushDisabled(brush, shapeProps)).length > 1;
        }
    })
}

function setupTextAlignMenus() {
    [
        { $group: $('#shape-text-align-h-group'), prop: TEXT_ALIGN_H_PROP, options: Object.values(TEXT_ALIGN_H_OPTS) },
        { $group: $('#shape-text-align-v-group'), prop: TEXT_ALIGN_V_PROP, options: Object.values(TEXT_ALIGN_V_OPTS) },
    ].forEach(({ $group, prop, options }) => {
        setupShapeMenu($group, prop, options, {
            visible: () => {
                if (activeShapeProps()[prop] === undefined) return false;

                // Show if shape already contains text, or we're actively editing text
                return activeShapeProps()[TEXT_PROP].some(text => text.length > 0) ||
                    selectionController.vector.isEditingText();
            },
        })
    })
}

function setupFillMenu() {
    setupShapeMenu($('#shape-fill-menu-group'), FILL_PROP, Object.values(FILL_OPTIONS))
}

function setupLineMarkerMenus() {
    setupShapeMenu($('#shape-line-arrowhead-start-menu-group'), ARROWHEAD_START_PROP, Object.values(ARROWHEAD_OPTIONS))
    setupShapeMenu($('#shape-line-arrowhead-end-menu-group'), ARROWHEAD_END_PROP, Object.values(ARROWHEAD_OPTIONS))
}

function setupOrderMenu() {
    Object.values(REORDER_ACTIONS).forEach(action => {
        actions.registerAction(`tools.shapes.${action}`, {
            callback: () => selectionController.vector.reorderSelectedShapes(action),
            enabled: () => selectionController.vector.canReorderSelectedShapes(action),
        })
    })

    const $group = $('#shape-order-group');
    const $actions = $group.find('.group-actions');

    shapeProperties[ORDER_MENU] = {
        $group: $group,
        menu: new IconMenu($actions, {
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
            visible: () => selectionController.vector.hasSelectedShapes(),
            onSelect: newValue => actions.callAction(`tools.shapes.${newValue}`),
            transparentBtns: false,
            tooltipOptions: shapeMenuTooltipOptions($actions)
        })
    }
}

function refreshShapeProperties() {
    const isVisible = !isEmptyObject(activeShapeProps()) || selectionController.raster.hasSelection();
    $shapeProperties.toggle(isVisible);

    if (isVisible) {
        Object.values(shapeProperties).forEach(properties => {
            properties.menu.refresh()
            properties.$group.toggle(properties.menu.isVisible())
        });

        $shapeProperties.find('#shape-color-menu-group').toggle(showColorPicker())
        $shapeProperties.find('#shape-char-menu-group').toggle(showCharPicker())

        $shapeProperties.find('#shape-actions').toggle(
            selectionController.vector.hasSelectedShapes() || selectionController.raster.hasSelection()
        )

        // Refresh custom action buttons (not part of a menu)
        $shapeProperties.find('.action-button').each((i, element) => {
            const $element = $(element);
            const actionId = $element.data('action');
            $element.html(getIconHTML(actionId))
            $element.toggleClass('disabled', !actions.isActionEnabled(actionId));
            $element.toggle(actions.isActionVisible(actionId));
        });

        // CSS needs to do different things depending on if a group is the first, subsequent, or last group.
        // Cannot use :first-child, :not(:first-child), etc. because that doesn't account for hidden children.
        let $firstVisible, $lastVisible;
        $shapeProperties.find('.property-group').each((i, group) => {
            const $group = $(group);
            $group.removeClass('first-child subsequent-child last-child');

            if ($group.is(':visible')) {
                if ($firstVisible) {
                    $group.addClass('subsequent-child')
                } else {
                    $firstVisible = $group;
                }
                $lastVisible = $group;
            }
        });
        if ($firstVisible) $firstVisible.addClass('first-child')
        if ($lastVisible) $lastVisible.addClass('last-child')
    } else {
        shapeTooltips.forEach(tooltip => tooltip.hide())
        // todo hide tooltips for other stuff like shape char picker
    }
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


// -------------------------------------------------------------------------------- Drawing
export let drawingContent = null;

function handleDrawMousedown(shapeType, cell, currentPoint, options = {}) {
    if (!drawingContent) {
        selectionController.vector.deselectAllShapes(false); // Don't push to history; we will push history when drawing finished

        // TODO [color prop issue]
        const drawProps = structuredClone(state.getConfig('drawProps'));
        drawProps[COLOR_PROP] = state.colorIndex(drawProps[COLOR_STR_PROP]);
        delete drawProps[COLOR_STR_PROP];

        drawingContent = Shape.begin(shapeType, {
            ...drawProps,
            ...options
        });

        // todo hack - it'd probably be better to immediately add shape to current cel so we don't have to do this,
        //             rather than adding at to the cel at the end
        drawingContent.provideAttachmentResolver(shapeId => state.getCurrentCelShape(shapeId))
    }

    const drawingFinished = drawingContent.handleDrawMousedown(cell, {
        point: currentPoint,
        attachTarget: selectionController.vector.getAttachTarget(cell)
    });

    if (drawingFinished) {
        finishDrawing()
    } else {
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    }
}

function handleDrawMousemove(cell, currentPoint) {
    if (!drawingContent) return;
    if (!cell) return;

    drawingContent.handleDrawMousemove(cell, {
        point: currentPoint,
        attachTarget: selectionController.vector.getAttachTarget(cell)
    });

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function handleDrawMouseup(cell, mouseEvent) {
    if (!drawingContent) return;

    if (!drawingContent.handleDrawMouseup(cell, {
        attachTarget: selectionController.vector.getAttachTarget(cell)
    })) return;

    finishDrawing();
}

function finishDrawing() {
    if (!drawingContent) return;

    drawingContent.finishDraw();

    if (drawingContent.shouldDeleteAfterDraw()) {
        drawingContent = null;
        eventBus.emit(EVENTS.REFRESH.ALL);
        return;
    }

    state.addCurrentCelShape(drawingContent);

    // If the drawn shape would be deleted (e.g. empty Textbox), immediately start editing its text
    if (drawingContent.type === SHAPE_TYPES.TEXTBOX) {
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
        [COLOR_PROP]: undefined,
        [WRITE_EMPTY_CHARS_PROP]: true
    });
}

let erasedShapes;

function vectorEraserStarted(primaryCell) {
    erasedShapes = false;
    vectorEraser(primaryCell)
}

// Vector eraser deletes any shapes touched by the brush
function vectorEraser(primaryCell) {
    const shapeIds = new Set();

    hoveredCells(primaryCell).forEach(cell => {
        const handle = state.testCurrentCelHandles(cell, HANDLE_TYPES.BODY);
        if (handle && handle.shapeId) shapeIds.add(handle.shapeId);
    });

    let needsFrameRefresh = false;
    let needsSelectionRefresh = false;
    shapeIds.forEach(shapeId => {
        if (selectionController.vector.deleteShape(shapeId)) needsSelectionRefresh = true;
        needsFrameRefresh = true;
        erasedShapes = true;
    });

    if (needsFrameRefresh) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    if (needsSelectionRefresh) eventBus.emit(EVENTS.SELECTION.CHANGED);
}

function vectorEraserFinished() {
    eventBus.emit(EVENTS.REFRESH.ALL);
    if (erasedShapes) state.pushHistory();
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

let $shapeChar, shapeCharPicker, $quickSwap;

function setupCharPicker() {
    actions.registerAction('tools.shapes.charPicker', {
        callback: () => toggleCharPicker(true),
        enabled: () => showCharPicker()
    })
    actions.registerAction('tools.shapes.quickSwapChar', {
        callback: () => toggleQuickSwap(true),
        shortcutAbbr: `Q to enter, Esc to exit`
    })

    $shapeChar = $('#shape-char');
    shapeCharPicker = new CharPicker($shapeChar, {
        // onLoad: newValue => setPrimaryChar(newValue),
        onChange: newValue => applyPrimaryChar(newValue),
        popupDirection: 'right',
        popupOffset: 22,
        tooltip: () => {
            return setupActionTooltips(
                $shapeChar,
                'tools.shapes.charPicker',
                shapeMenuTooltipOptions($shapeChar.closest('.group-actions'))
            ).tooltips[0];
        }
    })

    $quickSwap = $('#shape-char-menu-group').find('[data-action="tools.shapes.quickSwapChar"]');

    shapeTooltips.concat(setupActionTooltips(
        $quickSwap,
        $element => $element.data('action'),
        shapeMenuTooltipOptions($quickSwap.closest('.group-title'))
    ).tooltips);

    // Override quick-swap action button: we do not want to call the actual action. The actual action always just
    // enables quick-swap mode since we have different shortcuts for enabling (q) vs disabling (esc). Instead, we make
    // clicking the button manually toggle the mode.
    $quickSwap.off('click').on('click', () => toggleQuickSwap());
}

function showCharPicker() {
    if (!shapeCharPicker) return false;

    const shapeProps = activeShapeProps();

    const strokeUsesChar = Object.values(STROKE_STYLE_PROPS).some(strokeProp => {
        const shapeStrokes = shapeProps[strokeProp];

        // TODO This is basing monochar styles off of their key name... change to a real property
        return shapeStrokes && shapeStrokes.some(stroke => stroke.includes('monochar'));
    })
    if (strokeUsesChar) return true;

    const shapeFills = shapeProps[FILL_PROP];
    const fillUsesChar = shapeFills && shapeFills.some(fill => fill === FILL_OPTIONS.MONOCHAR);
    if (fillUsesChar) return true;

    const toolUsesChar = state.getConfig('tool') === 'fill-char';
    if (toolUsesChar) return true;

    return false;
}

function refreshCharPicker() {
    const char = firstActiveShapeProp(CHAR_PROP);
    if (char === undefined) return; // if active shape has no char prop, cannot refresh picker

    setPrimaryChar(char);
    $shapeChar.toggleClass('animated-border', isQuickSwapEnabled());
    $quickSwap.toggleClass('active', isQuickSwapEnabled());
}

function isCharPickerOpen() {
    return shapeCharPicker.isOpen;
}
function toggleCharPicker(open) {
    shapeCharPicker.toggle(open)
}

function applyPrimaryChar(char) {
    setPrimaryChar(char);

    // TODO MAYBE WRONG SPOT FOR THIS?
    selectionController.vector.updateSelectedShapes(shape => shape.updateProp(CHAR_PROP, char));
}

function setPrimaryChar(char) {
    if (shapeCharPicker) shapeCharPicker.value(char, true);
    updateActiveShapeProp(CHAR_PROP, char, false);
    eventBus.emit(EVENTS.TOOLS.CHAR_CHANGED);
}

// "Quick Swap" is a toggle that lets the user instantly update the char picker's selected value by pressing a keyboard key
let quickSwapEnabled = false;

function isQuickSwapEnabled() {
    if (selectionController.raster.hasSelection()) return true;
    if (!showCharPicker()) return false;
    return quickSwapEnabled;
}

function toggleQuickSwap(enabled) {
    quickSwapEnabled = enabled === undefined ? !quickSwapEnabled : !!enabled;
    refresh();
}


// -------------------------------------------------------------------------------- Color Picker

let shapeColorPicker;

function setupColorPicker() {
    actions.registerAction('tools.shapes.colorPicker', {
        // callback: () => toggleColorPicker(true),
    })

    const $shapeColor = $('#shape-color');
    shapeColorPicker = new ColorPicker($shapeColor, {
        tooltip: () => {
            return refreshableTooltips(
                $shapeColor,
                standardTipContentBuilder(() => {
                    if (!state.isValid()) return ''; // TODO [pending state init] - can't call this until state initialized
                    if (state.currentLayerType() === LAYER_TYPES.RASTER) {
                        return selectionController.raster.hasSelection() ? 'tools.standard.selection.color' : 'tools.standard.color'
                    }
                    return 'tools.shapes.colorPicker';
                }),
                shapeMenuTooltipOptions($shapeColor.closest('.group-actions'))
            )
        },
        onDone: color => applyColor(color),
        attachToBody: true,

        // For raster selections, the color picker is shown in split mode. This allows users to apply the current color
        // to highlighted text with a single click. Without split mode, they'd have to reopen the color picker and
        // manually reselect the same color.
        splitMode: () => selectionController.raster.hasSelection()
    })
}

function showColorPicker() {
    if (!state.isMultiColored()) return false;

    return activeShapeProps()[useColorIndex() ? COLOR_PROP : COLOR_STR_PROP] !== undefined;
}

function refreshColorPicker() {
    const color = useColorIndex() ? state.colorStr(firstActiveShapeProp(COLOR_PROP)) : firstActiveShapeProp(COLOR_STR_PROP)

    if (color === undefined) return; // if active shape has no color prop, cannot refresh picker

    setColor(color);
}

// TODO [color prop issue]
function useColorIndex() {
    return selectionController.vector.hasSelectedShapes();
}

function setColor(colorStr) {
    if (shapeColorPicker) shapeColorPicker.value(colorStr, true);

    // Always save to COLOR_STR_PROP, regardless of whether we are editing shapes or not (do not set draw CHAR_PROP)
    updateActiveShapeProp(COLOR_STR_PROP, colorStr, false);

    eventBus.emit(EVENTS.TOOLS.COLOR_CHANGED);
}

function applyColor(colorStr) {
    setColor(colorStr);

    const colorIndex = state.colorIndex(colorStr);

    if (selectionController.raster.hasSelection()) {
        fillSelection(undefined, colorIndex)
    } else if (selectionController.vector.hasSelectedShapes()) {
        selectionController.vector.updateSelectedShapes(shape => shape.updateProp(COLOR_PROP, colorIndex));
    }
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
        case 'draw-diamond':
        case 'draw-textbox':
        case 'fill-char':
        case 'eraser':
        case 'paint-brush':
        case 'color-swap':
            return 'crosshair';
        case 'pan':
        case 'move-all':
            return grab;
        default:
            return 'default';
    }
}