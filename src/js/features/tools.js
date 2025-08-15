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
import {capitalizeFirstLetter} from "../utils/strings.js";
import {modifierAbbr, modifierWord} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";
import Cell from "../geometry/cell.js";
import CharPicker from "../components/char_picker.js";
import {getIconHTML} from "../config/icons.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";
import PolygonFactory from "../geometry/drawing/polygon_factory.js";
import BaseRect from "../geometry/shapes/rect/base.js";
import {
    CHAR_PROP, COLOR_PROP,
    REORDER_ACTIONS,
    SHAPE_NAMES,
    SHAPE_STYLES,
    SHAPES,
    STYLE_PROPS
} from "../geometry/shapes/constants.js";
import ColorPicker from "../components/color_picker.js";


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
            // case 'select':
            //     selectShape(cell, mouseEvent, canvasControl);
            //     break;
            case 'eraser':
                startDrawing(PolygonFactory.createFreeform, cell, mouseEvent, { drawType: 'eraser' })
                break;
            case 'paint-brush':
                startDrawing(PolygonFactory.createFreeform, cell, mouseEvent, { drawType: 'paint-brush' })
                break;
            case 'draw-freeform':
                // todo pass cell pixel, not entire canvasControl
                startDrawing(PolygonFactory.createFreeform, cell, mouseEvent, { canvas: canvasControl })
                break;
            case 'draw-rect':
                startDrawing(BaseRect.beginRect, cell, mouseEvent);
                break;
            case 'draw-line':
                startDrawing(PolygonFactory.createLine, cell, mouseEvent);
                break;
            case 'draw-ellipse':
                startDrawing(PolygonFactory.createEllipse, cell, mouseEvent);
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

        if (!isDragging) return;
        if (mouseEvent.buttons === 0) return; // Catch firefox mousemove bug where mouseEvent.which is 1 when no buttons pressed

        // Keep track of whether the mousemove has reached a new cell (helps with performance, so we can just redraw
        // when a new cell is reached, not on every pixel change)
        const isNewCell = !prevCell || !prevCell.equals(cell);

        switch(tool) {
            case 'eraser':
            case 'paint-brush':
                if (isNewCell) updateDrawing(cell, mouseEvent);
                break;
            case 'draw-freeform':
                // Intentionally not checking if isNewCell; we update the char based on pixels not cells
                updateDrawing(cell, mouseEvent);
                break;
            case 'draw-rect':
            case 'draw-line':
            case 'draw-ellipse':
                if (isNewCell) updateDrawing(cell, mouseEvent);
                break;
            case 'pan':
                eventBus.emit(EVENTS.CANVAS.PAN_DELTA, {
                    delta: [originalPoint.x - currentPoint.x, originalPoint.y - currentPoint.y]
                })
                break;
            case 'move-all':
                if (isNewCell) updateMoveAll(cell, isNewCell);
                break;
        }

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ mouseEvent, cell, canvasControl, isDragging, mouseDownButton }) => {
        const tool = toolForMouseButton(mouseDownButton);
        $canvasContainer.css('cursor', cursorStyle(state.getConfig('tool'), false, mouseEvent, cell, canvasControl));

        if (!isDragging) return;

        switch(tool) {
            case 'eraser':
            case 'paint-brush':
            case 'draw-freeform':
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

    eventBus.on(EVENTS.KEYBOARD.SHIFT_KEY, ({ shiftKey }) => {
        const tool = state.getConfig('tool')

        switch(tool) {
            case 'draw-rect':
            case 'draw-line':
            case 'draw-ellipse':
                // Immediately affects the drawing (e.g. for draw-line it could change the right-angle route) without
                // waiting for another mousemove
                updateDrawing(prevCell, { shiftKey: shiftKey });
                break;
        }
    })

    eventBus.on(EVENTS.PALETTE.COLOR_SELECTED, ({ color }) => {
        setPrimaryColorPicker(color);

        if (state.hasSelectedShapes()) {
            shapeColorPicker.value(color)
        }
    })
    eventBus.on(EVENTS.UNICODE.CHAR_SELECTED, ({ char }) => {
        selectChar(char);

        if (state.hasSelectedShapes()) {
            shapeCharPicker.value(char);
        }
    })
}


function toolForMouseButton(mouseButton) {
    switch(mouseButton) {
        case 2:
            return 'pan'; // Middle-click
        case 3:
            return 'eraser'; // Right-click
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
            enabled: () => state.isMultiColored() ? true : !state.MULTICOLOR_TOOLS.has(tool),
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
    $standardTools.find('.color-tool').toggleClass('hidden', !state.isMultiColored())

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

// -------------------------------------------------------------------------------- Shape Properties

let $shapeProperties, shapeTooltips, shapeSubMenus = [], shapeCharPicker, shapeColorPicker;

function setupShapeProperties() {
    $shapeProperties = $('#shape-properties')

    // Attach style options for each shape type
    Object.values(SHAPES).forEach(shapeType => {
        const styleProp = STYLE_PROPS[shapeType]; // E.g. rectStyle

        const actionsHTML = Object.values(SHAPE_STYLES[shapeType])
            .map(style => `<div class="sub-tool" data-style="${style}"></div>`)
            .join('')

        const $shapeStyles = $(`
            <div class="property-group">
                <span class="group-title">${SHAPE_NAMES[shapeType]} Style</span>
                <div class="group-actions">${actionsHTML}</div>
            </div>
        `);
        $shapeProperties.prepend($shapeStyles);

        // todo support initial drawing too
        const subMenu = new ToolSubMenu($shapeStyles, {
            visible: () => {
                return state.selectedShapeTypes().includes(shapeType)
            },
            getValue: () => {
                const styles = state.selectedShapeProps()[styleProp];
                return {
                    // If multiple styles are selected, cannot show a value
                    style: styles.length === 1 ? styles[0] : null
                }
            },
            onChange: newValue => {
                // changeDrawType(toolKey, newValue.type)
                vectorSelection.updateSelectedShapes(shape => {
                    if (shape.type === shapeType) shape.updateProp(styleProp, newValue.style)
                });
                console.log(state.selectedShapes())
            },
            icon: $tool => {
                console.log(`tools.shapes.${styleProp}.${$tool.data('style')}`)
                // getIconHTML(`tools.${typesKey}.${$tool.data('type')}`)
                return getIconHTML(`tools.shapes.${styleProp}.${$tool.data('style')}`)
            },
            tooltipContent: $tool => {
                const style = $tool.data('style');
                const name = STRINGS[`tools.shapes.${styleProp}.${style}.name`];
                const description = STRINGS[`tools.shapes.${styleProp}.${style}.description`];
                return `<div class="header">` +
                    `<span class="title">${name}</span>` +
                    `</div>` +
                    `<div class="description">${description}</div>`// +
                    // getDrawingModifiersTooltip(toolKey, type); // todo drawing modifiers don't work
            },
            tooltipOptions: {
                placement: 'bottom'
            }
        })

        shapeSubMenus.push(subMenu);
    })

    // Char prop
    shapeCharPicker = new CharPicker($('#shape-char'), {
        popupDirection: 'bottom',
        popupOffset: 22,
        onChange: (newValue) => {
            vectorSelection.updateSelectedShapes(shape => shape.updateProp(CHAR_PROP, newValue));
            // todo if not using monochar, switch shape to it
        }
    })

    // Color prop
    shapeColorPicker = new ColorPicker($('#shape-color'), {
        pickerOptions: {
            popup: 'bottom'
        },
        tooltipOptions: {
            // offset: tooltipOffset('center')
        },
        onCommit: color => {
            console.log('commit');
            const colorIndex = state.colorIndex(color);
            vectorSelection.updateSelectedShapes(shape => shape.updateProp(COLOR_PROP, colorIndex));
        },
    })

    // Static properties / actions:
    actions.registerAction('tools.shapes.send-to-back', {
        callback: () => vectorSelection.reorderSelectedShapes(REORDER_ACTIONS.SEND_TO_BACK),
        enabled: () => state.canReorderSelectedShapes(REORDER_ACTIONS.SEND_TO_BACK),
    })
    actions.registerAction('tools.shapes.send-backward', {
        callback: () => vectorSelection.reorderSelectedShapes(REORDER_ACTIONS.SEND_BACKWARD),
        enabled: () => state.canReorderSelectedShapes(REORDER_ACTIONS.SEND_BACKWARD),
    })
    actions.registerAction('tools.shapes.bring-forward', {
        callback: () => vectorSelection.reorderSelectedShapes(REORDER_ACTIONS.BRING_FORWARD),
        enabled: () => state.canReorderSelectedShapes(REORDER_ACTIONS.BRING_FORWARD),
    })
    actions.registerAction('tools.shapes.bring-to-front', {
        callback: () => vectorSelection.reorderSelectedShapes(REORDER_ACTIONS.BRING_TO_FRONT),
        enabled: () => state.canReorderSelectedShapes(REORDER_ACTIONS.BRING_TO_FRONT),
    })
    actions.registerAction('tools.shapes.delete', {
        callback: () => vectorSelection.deleteSelectedShapes()
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

function refreshShapeProperties() {
    const isVisible = state.hasSelectedShapes();
    $shapeProperties.toggle(isVisible);

    if (!isVisible) shapeTooltips.tooltips.forEach(tooltip => tooltip.hide())

    // todo hide tooltips for other stuff like shape char picker

    shapeSubMenus.forEach(subMenu => subMenu.refresh());

    const shapeProps = state.selectedShapeProps();
    shapeCharPicker.value(shapeProps[CHAR_PROP][0], true) // just showing the first shape's char
    shapeColorPicker.value(state.colorStr(shapeProps[COLOR_PROP][0]), true);

    $shapeProperties.find('.action-button').each((i, element) => {
        const $element = $(element);
        const actionId = $element.data('action');
        $element.html(getIconHTML(actionId))
        $element.toggleClass('disabled', !actions.isActionEnabled(actionId));
    });

    // todo hide if color-related and state isn't multicolored
    // $shapeProperties.find('.color-tool').toggleClass('hidden', !state.isMultiColored())

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
    setPrimaryColorPicker(colorStr);

    if (options.addToPalette) {
        state.addColor(colorStr);
        eventBus.emit(EVENTS.TOOLS.COLOR_ADDED);
        state.pushHistory();
    }
}


// -------------------------------------------------------------------------------- Drawing
export let drawingContent = null;

function setupDrawSubMenus() {
    setupDrawSubMenu('draw-freeform', SHAPES.FREEFORM);
    setupDrawSubMenu('draw-rect', SHAPES.RECT);
    setupDrawSubMenu('draw-line', SHAPES.LINE);
    setupDrawSubMenu('draw-ellipse', SHAPES.ELLIPSE);
}

function setupDrawSubMenu(toolKey, shapeType) {
    const $menu = $(`.sub-tool-menu[data-tool="${toolKey}"]`)
    const styleProp = STYLE_PROPS[shapeType]

    const subMenu = new ToolSubMenu($menu, {
        visible: () => state.getConfig('tool') === toolKey,
        getValue: () => ({ style: state.getConfig('drawTypes')[toolKey] }),
        onChange: newValue => changeDrawType(toolKey, newValue.style),
        icon: $tool => getIconHTML(`tools.shapes.${styleProp}.${$tool.data('style')}`),
        tooltipContent: $tool => {
            const style = $tool.data('style');
            const name = STRINGS[`tools.shapes.${styleProp}.${style}.name`];
            const description = STRINGS[`tools.shapes.${styleProp}.${style}.description`];
            return `<div class="header">` +
                `<span class="title">${name}</span>` +
                `</div>` +
                `<div class="description">${description}</div>` +
            getDrawingModifiersTooltip(toolKey, style);
        }
    })

    subMenus.push(subMenu);
}

function getDrawingModifiers(mouseEvent) {
    const result = {
        fullCellHandle: true
    }

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

function startDrawing(factory, cell, mouseEvent, options = {}) {
    vectorSelection.deselectAllShapes(false); // Don't push to history; we will push history when drawing finished

    drawingContent = factory(cell, $.extend({ // todo rename drawingShape?
        drawPreset: state.getConfig('drawTypes')[state.getConfig('tool')],
        colorIndex: state.primaryColorIndex(),
        char: state.getConfig('primaryChar'),
        // hoveredCells: hoveredCells, // todo this should be based on line thickness, don't pass hoveredCells fn
        // canvasDimensions: state.getConfig('dimensions'),
    }, options));

    drawingContent.beginResize();

    updateDrawing(cell, mouseEvent);
}

function updateDrawing(cell, mouseEvent) {
    if (!drawingContent) return;
    if (!cell) return;

    // drawingContent.end = cell;
    // drawingContent.recalculate(getDrawingModifiers(mouseEvent), mouseEvent);
    drawingContent.resize(undefined, cell, getDrawingModifiers(mouseEvent));

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
}

function finishDrawing() {
    if (!drawingContent) return;

    drawingContent.finishResize();
    state.addCurrentCelShape(drawingContent);

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

let $charPicker, charPicker, charWellTooltip, charQuickSwapTooltip;

function setupCharPicker() {
    $charPicker = $('#current-char');

    const onCharChange = newValue => {
        state.setConfig('primaryChar', newValue);

        // If you want the paint bucket char icon to change along with the selected char
        // let visibleChar = newValue;
        // if (visibleChar === WHITESPACE_CHAR) visibleChar = '␣';
        // if (visibleChar === EMPTY_CHAR) visibleChar = '∅';
        // $('.picked-char').html(visibleChar);

        eventBus.emit(EVENTS.TOOLS.CHAR_CHANGED);
    }

    charPicker = new CharPicker($charPicker, {
        initialValue: 'A',
        onChange: onCharChange,
        onLoad: onCharChange,
        onOpen: () => {
            charWellTooltip.disable();
            charQuickSwapTooltip.disable();
        },
        onClose: () => {
            charWellTooltip.enable();
            charQuickSwapTooltip.enable();
        }
    })

    actions.registerAction('tools.standard.char-picker', {
        callback: () => toggleCharPicker(true),
    })
    actions.registerAction('tools.standard.quick-swap-char', {
        callback: () => toggleQuickSwap(),
    })

    const $quickSwap = $charPicker.find('.char-well-corner-button');
    $quickSwap.off('click').on('click', () => actions.callAction('tools.standard.quick-swap-char'))

    charWellTooltip = setupTooltips(charPicker.$well.toArray(), 'tools.standard.char-picker', {
        offset: tooltipOffset('center')
    }).tooltips[0];
    charQuickSwapTooltip = setupTooltips($quickSwap.toArray(), 'tools.standard.quick-swap-char', {
        offset: tooltipOffset('center-corner-button')
    }).tooltips[0];
}

function refreshCharPicker() {
    selectChar(state.getConfig('primaryChar'))

    $charPicker.toggleClass('animated-border', isQuickSwapEnabled());
}

export function isCharPickerOpen() {
    return charPicker.isOpen;
}
export function toggleCharPicker(open) {
    charPicker.toggle(open);
}
export function selectChar(char) {
    charPicker.value(char);
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

let colorPicker;

function setupColorPicker() {
    const $colorPicker = $('#current-color');

    actions.registerAction('tools.standard.color-picker', {
        callback: () => toggleCharPicker(true),
    })

    colorPicker = new ColorPicker($colorPicker, {
        pickerOptions: {
            popup: 'right'
        },
        tooltipOptions: {
            offset: tooltipOffset('center')
        },
        onChange: color => {
            state.setConfig('primaryColor', color);
            eventBus.emit(EVENTS.TOOLS.COLOR_CHANGED);
        },
    })
}

function setPrimaryColorPicker(colorStr) {
    colorPicker.value(colorStr);
}

function refreshColorPicker() {
    setPrimaryColorPicker(state.getConfig('primaryColor'))
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



// Menu where many options are displayed, and only one can be 'selected' at a time.
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
     * @param {Object} [options.tooltipOptions] - Tooltip options to pass to tippy
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
            tippy(this.$menu.find('.sub-tool').toArray(), $.extend({
                content: element => this.options.tooltipContent($(element)),
                placement: 'right',
                offset: SUB_TOOL_MENU_TOOLTIP_OFFSET,
                hideOnClick: false,
                allowHTML: true
            }, this.options.tooltipOptions))
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