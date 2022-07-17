import $ from "jquery";
import Picker from 'vanilla-picker/csp';

import {triggerRefresh} from "./index.js";
import * as actions from "./actions.js";
import * as state from './state.js';
import {createDialog} from "./utilities.js";

const ZOOM_SCROLL_FACTOR = 1.1;

let source, preview, canvases;

export function init() {
    setupGridToggle();
    setupGridDialog();

    actions.registerAction('zoom-in', {
        name: 'Zoom In',
        callback: () => {},
        enabled: () => false,
        shortcut: { displayChar: '+', char: '=', modifiers: ['shift'] }
    });
    actions.registerAction('zoom-out', {
        name: 'Zoom Out',
        callback: () => {},
        enabled: () => false,
        shortcut: { displayChar: '-', char: '-', modifiers: ['shift'] }
    });
    actions.registerAction('zoom-fit', {
        name: 'Zoom Fit',
        callback: () => {},
        enabled: () => false,
        shortcut: { char: '0', modifiers: ['shift'] }
    });
}


export function setupMouseEvents(sourceCanvas, previewCanvas, canvasControls) {
    source = sourceCanvas;
    preview = previewCanvas;
    canvases = canvasControls;

    setupScroll();
    setupPreviewScroll();

    setupPan();
    setupPreviewPan();
}

function setupScroll() {
    source.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) { return; }

        const scaledDelta = Math.pow(ZOOM_SCROLL_FACTOR, -deltaY / 100);
        const target = source.pointAtExternalXY(evt.offsetX, evt.offsetY);
        updateCanvases(canvasControl => canvasControl.zoomDelta(scaledDelta, target))
    });
}

function setupPreviewScroll() {
    preview.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) { return; }

        const scaledDelta = Math.pow(ZOOM_SCROLL_FACTOR, -deltaY / 100);
        updateCanvases(canvasControl => canvasControl.zoomDelta(scaledDelta))
    });
}

function setupPan() {
    let isSliding;
    let originalPoint;

    disableRightClick(source);

    source.$canvas.off('mousedown.zoom').on('mousedown.zoom', evt => {
        if (evt.which !== 2 && evt.which !== 3) { return; } // Only apply to middle-click and right-click

        isSliding = true;
        originalPoint = source.pointAtExternalXY(evt.offsetX, evt.offsetY);
    });

    source.$canvas.off('mousemove.zoom').on('mousemove.zoom', evt => {
        if (isSliding) {
            const currentPoint = source.pointAtExternalXY(evt.offsetX, evt.offsetY);
            const deltas = [currentPoint.x - originalPoint.x, currentPoint.y - originalPoint.y];
            updateCanvases(canvasControl => canvasControl.translateAmount(...deltas));
        }
    });

    $(document).off('mouseup.zoom').on('mouseup.zoom', evt => {
        if (isSliding) {
            isSliding = false;
        }
    });
}

function setupPreviewPan() {
    let isSliding;

    disableRightClick(preview);

    preview.$canvas.off('mousedown.previewZoom').on('mousedown.previewZoom', evt => {
        isSliding = true;
        const target = preview.pointAtExternalXY(evt.offsetX, evt.offsetY);
        updateCanvases(canvasControl => canvasControl.translateToTarget(target));
    });

    preview.$canvas.off('mousemove.previewZoom').on('mousemove.previewZoom', evt => {
        if (isSliding) {
            const target = preview.pointAtExternalXY(evt.offsetX, evt.offsetY);
            updateCanvases(canvasControl => canvasControl.translateToTarget(target));
        }
    });

    $(document).off('mouseup.previewZoom').on('mouseup.previewZoom', evt => {
        if (isSliding) {
            isSliding = false;
        }
    });
}

function updateCanvases(callback) {
    canvases.forEach(canvasControl => {
        callback(canvasControl);
    });

    triggerRefresh('zoom');
}

function disableRightClick(canvasControl) {
    canvasControl.$canvas.off('contextmenu.zoom').on('contextmenu.zoom', evt => {
        return false;
    });
}



// -------------------------------------------------------------------------------- Grid

let $gridDialog, $gridWidth, $gridSpacing, gridColorPicker, gridColorPickerVal;

function setupGridDialog() {
    $gridDialog = $('#grid-dialog');
    $gridWidth = $gridDialog.find('#grid-width');
    $gridSpacing = $gridDialog.find('#grid-spacing');

    createDialog($gridDialog, () => {
        state.config('grid', $.extend({}, state.config('grid'), {
            width: parseInt($gridWidth.val()),
            spacing: parseInt($gridSpacing.val()),
            color: gridColorPickerVal
        }));
        triggerRefresh('chars');
        $gridDialog.dialog('close');
    }, 'Save', {
        minWidth: 400,
        maxWidth: 400,
        minHeight: 500,
        maxHeight: 500
    });

    const $colorPicker = $gridDialog.find('.color-picker');

    gridColorPicker = new Picker({
        parent: $colorPicker.get(0),
        popup: false,
        onChange: (color) => {
            gridColorPickerVal = color[state.COLOR_FORMAT];
        },
    });

    actions.registerAction('grid-settings', {
        name: 'Grid Settings',
        callback: () => openGridDialog(),
        shortcut: { char: 'g', modifiers: ['shift'] }
    });
}

function openGridDialog() {
    $gridWidth.val(state.config('grid').width);
    $gridSpacing.val(state.config('grid').spacing);
    gridColorPicker.setColor(state.config('grid').color, false);

    $gridDialog.dialog('open');
}

function setupGridToggle() {
    actions.registerAction('toggle-grid', {
        name: () => state.config('grid').show ? 'Hide Grid' : 'Show Grid',
        callback: () => {
            let grid = $.extend({}, state.config('grid'));
            grid.show = !grid.show;
            state.config('grid', grid);
            triggerRefresh('chars');
        },
        shortcut: 'g'
    });
}
