import $ from "jquery";
import './styles/app.scss'
import 'remixicon/fonts/remixicon.css';

import {refreshShortcuts, registerAction} from "./actions.js";
import { CanvasControl } from "./canvas.js";
import { init as initClipboard } from "./clipboard.js"
import {
    init as initEditor,
    setupMouseEvents as setupEditorMouse,
    refresh as refreshEditor,
    refreshMouseCoords,
    refreshSelectionDimensions
} from "./editor.js"
import { init as initFile } from "./file.js";
import { init as initSettings } from "./settings.js";
import { setupMouseEvents as setupHoverMouse, hoveredCell, iterateHoveredCells } from "./hover.js";
import { init as initKeyboard } from "./keyboard.js";
import { init as initPalette, refresh as refreshPalette, refreshSelection as refreshPaletteSelection } from "./palette.js";
import { init as initPreview, canvasControl as previewCanvas, redraw as redrawPreview, reset as resetPreview } from "./preview.js";
import { init as initUnicode, refresh as refreshUnicode } from "./unicode.js";
import * as selection from './selection.js';
import * as state from "./state.js";
import * as localstorage from "./localstorage.js";
import { Timeline } from "./timeline.js";
import { init as initZoom, setupMouseEvents as setupZoomMouse } from './zoom.js';

// Note: The order of these initializers does not matter (they should not depend on other modules being initialized)
initClipboard();
initEditor();
initFile();
initSettings();
initKeyboard();
initPalette();
initPreview();
initUnicode();
selection.init();
state.init();
initZoom();
localstorage.setupAutoSave();


// Set up various controller instances
export const timeline = new Timeline($('#frame-controller'), $('#layer-controller'));
export const charCanvas = new CanvasControl($('#char-canvas'), {});
export const selectionBorderCanvas = new CanvasControl($('#selection-border-canvas'), {});
export const hoveredCellCanvas = new CanvasControl($('#hovered-cell-canvas'), {});
export const selectionCanvas = new CanvasControl($('#selection-canvas'), {});

// Bind mouse events to controllers (note: many controllers attach mouse events to the selectionCanvas since it is
// on top, even though they have their own canvases underneath).
selection.setupMouseEvents(selectionCanvas);
setupHoverMouse(selectionCanvas);
setupEditorMouse(selectionCanvas);
setupZoomMouse(selectionCanvas, previewCanvas,
    [selectionCanvas, selectionBorderCanvas, hoveredCellCanvas, charCanvas]
);

// TODO These will be moved to other files, such as a settings.js file, once they've been made
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

// Warn before changing page
// TODO Do we want this?
// window.addEventListener('beforeunload', event => {
//     if (state.hasChanges()) {
//         // Note: Most browsers use their own unload string instead of this one that is given
//         event.returnValue = 'Reload site? Changes you made may not be saved.';
//     }
// });

// Load initial empty page
window.setTimeout(() => {
    const savedState = localstorage.loadState();
    if (savedState) {
        state.load(savedState);
    }
    else {
        state.loadNew();
    }

    refreshShortcuts();

    if (state.config('tool') === 'text-editor') {
        selection.moveCursorToStart();
    }
}, 1);



/**
 * Resizes the components that depend on window size. Then triggers a full refresh.
 */
export function triggerResize(clearSelection = false) {
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
 * @param type Can be a single string value, or an Array of string values. This narrows down the refresh scope to just
 *             refresh a subset of components.
 * @param saveState If true, state will be stored in history (for undo/redo purposes)
 *                  If a string, state will be stored in history with the string used as the 'modifiable' key (see
 *                  pushStateToHistory for more information)
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
            case 'unicode':
                refreshUnicode();
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
                refreshUnicode();
                break;
            default:
                console.warn(`triggerRefresh("${type}") is not a valid type`);
        }
    });

    if (saveState) {
        state.pushStateToHistory(saveState === true ? undefined : { modifiable: saveState });
    }
}

function redrawCharCanvas() {
    charCanvas.clear();
    charCanvas.drawBackground(state.config('background'));
    charCanvas.drawGlyphs(state.layeredGlyphs(state.currentFrame(), { showMovingContent: true, showDrawingContent: true }));

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

    selectionCanvas.highlightPolygons(selection.polygons);

    if (selection.hasSelection() && !selection.isDrawing) {
        selectionBorderCanvas.outlinePolygon(selection.getSelectedRect(), selection.movableContent)
    }

    if (selection.cursorCell) {
        selectionCanvas.drawCursorCell(selection.cursorCell);
    }

    refreshSelectionDimensions(selection.getSelectedCellArea())
}

function drawHoveredCell() {
    hoveredCellCanvas.clear();

    if (hoveredCell && !selection.isDrawing && !selection.isMoving) {
        // Not showing if the tool is text-editor because when you click on a cell, the cursor doesn't necessarily
        // go to that cell (it gets rounded up or down, like a real text editor does).
        if (state.config('tool') !== 'text-editor') {
            iterateHoveredCells(cell => {
                if (cell.isInBounds()) {
                    hoveredCellCanvas.highlightCell(cell);
                }
            })
        }
    }

    // We don't show mouse coords if we're showing selection dimensions
    refreshMouseCoords(selection.hasSelection() ? null : hoveredCell);
}
