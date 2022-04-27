import $ from "jquery";
import './styles/app.scss'
import 'remixicon/fonts/remixicon.css';

import {create2dArray, randomPrintableChar} from "./utilities.js";
import {CanvasControl} from './canvas.js';
import './keyboard.js';
import * as selection from './selection.js';
import * as zoom from './zoom.js';
import './clipboard.js';
import {Timeline} from "./timeline.js";
import * as state from "./state.js";
import * as preview from "./preview.js";
import * as editor from "./editor.js";
import * as file from "./file.js";

export const timeline = new Timeline($('#frame-controller'), $('#layer-controller'));
export const charCanvas = new CanvasControl($('#char-canvas'), {});
export const selectionBorderCanvas = new CanvasControl($('#selection-border-canvas'), {});
export const hoveredCellCanvas = new CanvasControl($('#hovered-cell-canvas'), {});
export const selectionCanvas = new CanvasControl($('#selection-canvas'), {});

selection.setupMouseEvents(selectionCanvas);
editor.setupMouseEvents(selectionCanvas);
zoom.setupMouseEvents(selectionCanvas, preview.canvasControl,
    [selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas]
);

$(window).off('resize:debounced').on('resize:debounced', triggerResize);

export function onStateLoaded() {
    preview.refresh();
    editor.refresh();
    timeline.refresh();
    triggerResize();

    selection.clear();
}

/**
 * Resizes the components that depend on window size. Then triggers a full refresh.
 */
export function triggerResize() {
    timeline.refresh(); // This has to happen first, since its configuration can affect canvas boundaries

    charCanvas.resize();
    selectionBorderCanvas.resize();
    hoveredCellCanvas.resize();
    selectionCanvas.resize();
    preview.canvasControl.resize();
    // Note: timeline frames will be resized during triggerRefresh() since they all have to be rebuilt

    preview.canvasControl.zoomToFit(); // todo just do this once?
    triggerRefresh();
}

/**
 * Triggers a refresh that cascades through the different components of the app.
 *
 * @param type Can be a single string value, or an Array of string values. This narrows does the refresh scope to just
 *             refresh a subset of components.
 */
export function triggerRefresh(type = 'full') {
    if (!Array.isArray(type)) {
        type = [type];
    }
    type.forEach(type => {
        switch(type) {
            case 'chars':
                redrawCharCanvas();
                preview.redraw();
                timeline.currentFrameComponent.redrawChars();
                break;
            case 'selection':
                selection.clearCaches();
                drawSelection();
                drawHoveredCell();
                editor.refresh();
                break;
            case 'hoveredCell': // Can be called separately from 'selection' for performance reasons
                drawHoveredCell();
                break;
            case 'cursorCell': // Can be called separately from 'selection' for performance reasons
                drawSelection();
                editor.refresh();
                break;
            case 'zoom':
                redrawCharCanvas();
                preview.redraw();
                drawSelection();
                drawHoveredCell()
                break;
            case 'full':
                selection.clearCaches();
                redrawCharCanvas();
                preview.reset();
                drawSelection();
                drawHoveredCell();
                editor.refresh();
                timeline.rebuildLayers();
                timeline.rebuildFrames();
                timeline.refresh();
                break;
            default:
                console.warn(`triggerRefresh("${type}") is not a valid type`);
        }
    });
}

function redrawCharCanvas() {
    charCanvas.clear();
    charCanvas.drawBackground();
    charCanvas.drawChars(state.layeredChars(state.currentFrame(), { showMovingContent: true }));

    if (state.config('onion')) {
        charCanvas.drawOnion(state.layeredChars(state.previousFrame()));
    }
}

function drawSelection() {
    selectionCanvas.clear();
    selectionBorderCanvas.clear();

    // Not showing selection polygons if the only selection is the single cursor cell
    const skipPolygonRender = selection.cursorCell && selection.selectingSingleCell();

    if (!skipPolygonRender) {
        selectionCanvas.highlightPolygons(selection.polygons);

        if (selection.hasSelection() && !selection.isDrawing) {
            selectionBorderCanvas.outlinePolygon(selection.getSelectedRect(), selection.movableContent)
        }
    }

    if (selection.cursorCell) {
        selectionCanvas.drawCursorCell(selection.cursorCell);
    }
}

function drawHoveredCell() {
    hoveredCellCanvas.clear();

    if (selection.hoveredCell && !selection.isDrawing && !selection.isMoving && selection.hoveredCell.isInBounds()) {
        hoveredCellCanvas.highlightCell(selection.hoveredCell);
    }

    editor.updateMouseCoords(selection.hoveredCell);
}

// const rows = 25;
// const columns = 50;
window.setTimeout(() => {
    state.loadNew();
    // state.load({
    //     config: {
    //         dimensions: [columns, rows]
    //     },
    //     layers: [
    //         { id: 1, name: 'Bottom Layer' },
    //         { id: 2, name: 'Top Layer' }
    //     ],
    //     frames: [
    //         { id: 1 },
    //         { id: 2 },
    //         { id: 3 },
    //     ],
    //     cels: {
    //         '1,1': { chars: create2dArray(rows, columns, () => [randomPrintableChar(), Math.round(Math.random())]) },
    //         '1,2': { chars: create2dArray(2, 5, () => randomPrintableChar()) },
    //         '1,3': { chars: create2dArray(5, 10, () => randomPrintableChar()) },
    //         '2,1': { chars: create2dArray(2, 5, 'x') },
    //         '2,2': { chars: [[]] },
    //         '2,3': { chars: [[]] },
    //     },
    //     colors: [
    //         '#ffffffff', // TODO These currently have to match colorPicker format to avoid duplicates
    //         '#000000ff'
    //     ]
    // });
}, 1);
