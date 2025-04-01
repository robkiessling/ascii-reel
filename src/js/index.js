import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/slider.js';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-visible';
import '../styles/app.scss'

import { init as initClipboard } from "./io/clipboard.js"
import { init as initEditor, refresh as refreshEditor } from "./components/editor.js"
import { init as initMainMenu, refresh as refreshMenu } from "./menu/main.js";
import { init as initFileMenu } from "./menu/file.js";
import { init as initToolsMenu } from "./menu/tools.js";
import { init as initViewMenu } from "./menu/view.js";
import { init as initThemeMenu } from "./menu/theme.js";
import { init as initKeyboard } from "./io/keyboard.js";
import { init as initPalette, refresh as refreshPalette, refreshSelection as refreshPaletteSelection } from "./components/palette.js";
import * as preview from "./components/preview.js";
import { init as initUnicode, refresh as refreshUnicode } from "./components/unicode.js";
import * as canvasStack from './components/canvas_stack.js';
import * as selection from './canvas/selection.js';
import * as state from "./state/index.js";
import * as localstorage from "./storage/local_storage.js";
import * as frames from "./components/frames.js";
import * as layers from "./components/layers.js";
import {debounce, defer} from "./utils/utilities.js";
import {refreshShortcuts} from "./io/actions.js";

// Note: The order of these initializers does not matter (they should not depend on the other modules being initialized)
initClipboard();
initEditor();
initMainMenu();
initFileMenu();
initToolsMenu();
initViewMenu();
initThemeMenu();
initKeyboard();
initPalette();
initUnicode();
preview.init();
selection.init();
state.init();
canvasStack.init();
frames.init();
layers.init();

// Attach window resize listener
$(window).on('resize', debounce(triggerResize));

// Load initial content
defer(() => {
    /* Critical CSS -- not showing page until DOMContentLoaded to avoid flash of unstyled content */
    $('body').css('opacity', 1);

    const savedState = localstorage.readState();
    savedState ? state.loadFromLocalStorage(savedState) : state.loadBlankState();

    if (state.isValid()) {
        triggerResize({ clearSelection: true, resetZoom: true });
        refreshShortcuts();
        localstorage.setupAutoSave();
    }
})


/**
 * Resizes the components that depend on window size, then triggers a full refresh.
 * @param {Object} options - Resize options
 * @param {boolean} [options.clearSelection] - If true, the selection will be cleared
 * @param {boolean} [options.resetZoom] - If true, the canvas will be zoomed all the way out
 */
export function triggerResize(options = {}) {
    if (!state.isValid()) return;

    if (options.clearSelection) selection.clear(false);

    // Refresh frames controller first, since its configuration (align left/bottom) can affect canvas boundaries
    frames.refresh();

    // Resize all CanvasControls:
    canvasStack.resize(options.resetZoom);
    preview.resize(); // Don't need to resetZoom since it will zoomToFit anyway
    // Frame canvases don't need to be resized here since triggerRefresh() will rebuild them all anyway

    triggerRefresh();
}

/**
 * Triggers a refresh that cascades through the different components of the app.
 *
 * @param {string|Array<string>} type Can be a single string value, or an Array of string values. This narrows down the
 *   refresh scope to just refresh a subset of components.
 */
export function triggerRefresh(type = 'full') {
    if (!state.isValid()) return;

    if (!Array.isArray(type)) type = [type];

    type.forEach(type => {
        switch(type) {
            case 'chars':
                canvasStack.redrawCharCanvas();
                preview.redraw();
                frames.currentFrameComponent().redrawGlyphs();
                break;
            case 'selection':
                selection.clearCaches();
                canvasStack.drawSelection();
                canvasStack.drawHoveredCell();
                refreshEditor();
                break;
            case 'hoveredCell': // Can be called separately from 'selection' for performance reasons
                canvasStack.drawHoveredCell();
                break;
            case 'cursorCell': // Can be called separately from 'selection' for performance reasons
                canvasStack.drawSelection();
                refreshEditor();
                break;
            case 'zoom':
                canvasStack.redrawCharCanvas();
                preview.redraw();
                canvasStack.drawSelection();
                canvasStack.drawHoveredCell()
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
            case 'menu':
                refreshMenu();
                break;
            case 'full':
                selection.clearCaches();
                canvasStack.redrawCharCanvas();
                preview.reset();
                canvasStack.drawSelection();
                canvasStack.drawHoveredCell();
                refreshEditor();
                frames.rebuild();
                layers.rebuild();
                refreshPalette();
                refreshUnicode();
                refreshMenu();
                break;
            default:
                console.warn(`triggerRefresh("${type}") is not a valid type`);
        }
    });
}
