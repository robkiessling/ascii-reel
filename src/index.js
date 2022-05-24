import $ from "jquery";
import './styles/app.scss'
import 'remixicon/fonts/remixicon.css';

import { registerAction } from "./actions.js";
import { CanvasControl } from "./canvas.js";
import { init as initClipboard } from "./clipboard.js"
import { init as initEditor, setupMouseEvents as setupEditorMouse, refresh as refreshEditor, updateMouseCoords } from "./editor.js"
import { init as initFile } from "./file.js";
import { init as initKeyboard } from "./keyboard.js";
import { init as initPalette, refresh as refreshPalette, refreshSelection as refreshPaletteSelection } from "./palette.js";
import { init as initPreview, canvasControl as previewCanvas, redraw as redrawPreview, reset as resetPreview } from "./preview.js";
import * as selection from './selection.js';
import * as state from "./state.js";
import { Timeline } from "./timeline.js";
import { init as initZoom, setupMouseEvents as setupZoomMouse } from './zoom.js';

// Note: The order of these initializers does not matter (they should not depend on other modules being initialized)
initClipboard();
initEditor();
initFile();
initKeyboard();
initPalette();
initPreview();
selection.init();
state.init();
initZoom();


// Set up various controller instances
export const timeline = new Timeline($('#frame-controller'), $('#layer-controller'));
export const charCanvas = new CanvasControl($('#char-canvas'), {});
export const selectionBorderCanvas = new CanvasControl($('#selection-border-canvas'), {});
export const hoveredCellCanvas = new CanvasControl($('#hovered-cell-canvas'), {});
export const selectionCanvas = new CanvasControl($('#selection-canvas'), {});

// Bind mouse events to controllers
selection.setupMouseEvents(selectionCanvas);
setupEditorMouse(selectionCanvas);
setupZoomMouse(selectionCanvas, previewCanvas,
    [selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas]
);

// TODO These will be moved to other files, such as a settings.js file, once they've been made
registerAction('font-settings', {
    name: 'Font Settings',
    callback: () => {},
    enabled: () => false
});
registerAction('preferences', {
    name: 'Preferences',
    callback: () => {},
    enabled: () => false
});
registerAction('keyboard-shortcuts', {
    name: 'Keyboard Shortcuts',
    callback: () => {},
    enabled: () => false
});

// Attach window resize listener
$(window).off('resize:debounced').on('resize:debounced', triggerResize);

// Load initial empty page
window.setTimeout(() => {
    state.loadNew();
}, 1);



/**
 * Resizes the components that depend on window size. Then triggers a full refresh.
 */
export function triggerResize(clearSelection) {
    if (clearSelection) {
        selection.clear();
    }

    timeline.refresh(); // This has to happen first, since its configuration can affect canvas boundaries

    charCanvas.resize();
    selectionBorderCanvas.resize();
    hoveredCellCanvas.resize();
    selectionCanvas.resize();
    previewCanvas.resize();
    // Note: timeline frames will be resized during triggerRefresh() since they all have to be rebuilt

    previewCanvas.zoomToFit(); // todo just do this once?
    triggerRefresh();
}

/**
 * Triggers a refresh that cascades through the different components of the app.
 *
 * @param type Can be a single string value, or an Array of string values. This narrows does the refresh scope to just
 *             refresh a subset of components.
 * @param saveState If true, state will be stored in history (for undo/redo purposes)
 */
export function triggerRefresh(type = 'full', saveState = false) {
    if (!Array.isArray(type)) {
        type = [type];
    }
    type.forEach(type => {
        switch(type) {
            case 'chars':
                redrawCharCanvas();
                redrawPreview();
                timeline.currentFrameComponent.redrawGlyphs();
                break;
            case 'selection':
                selection.clearCaches();
                drawSelection();
                drawHoveredCell();
                refreshEditor();
                break;
            case 'hoveredCell': // Can be called separately from 'selection' for performance reasons
                drawHoveredCell();
                break;
            case 'cursorCell': // Can be called separately from 'selection' for performance reasons
                drawSelection();
                refreshEditor();
                break;
            case 'zoom':
                redrawCharCanvas();
                redrawPreview();
                drawSelection();
                drawHoveredCell()
                break;
            case 'palette':
                refreshPalette();
                break;
            case 'paletteSelection':
                refreshPaletteSelection(); // less intensive that refreshing whole palette
                break;
            case 'full':
                selection.clearCaches();
                redrawCharCanvas();
                resetPreview();
                drawSelection();
                drawHoveredCell();
                refreshEditor();
                timeline.rebuildLayers();
                timeline.rebuildFrames();
                timeline.refresh();
                refreshPalette();
                break;
            default:
                console.warn(`triggerRefresh("${type}") is not a valid type`);
        }
    });

    if (saveState) {
        state.pushStateToHistory();
    }
}

function redrawCharCanvas() {
    charCanvas.clear();
    charCanvas.drawBackground(state.config('background'));
    charCanvas.drawGlyphs(state.layeredGlyphs(state.currentFrame(), { showMovingContent: true }));

    const grid = state.config('grid');
    if (grid.show) {
        charCanvas.drawGrid(grid.width, grid.spacing, grid.color);
    }

    if (state.config('onion')) {
        charCanvas.drawOnion(state.layeredGlyphs(state.previousFrame()));
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

    updateMouseCoords(selection.hoveredCell);
}
