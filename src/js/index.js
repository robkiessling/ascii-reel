import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/slider.js';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-visible';
import '../styles/app.scss'
import 'remixicon/fonts/remixicon.css';

import { init as initClipboard } from "./io/clipboard.js"
import { init as initEditor, refresh as refreshEditor } from "./components/editor.js"
import { init as initMainMenu } from "./menu/main.js";
import { init as initFileMenu } from "./menu/file.js";
import { init as initToolsMenu } from "./menu/tools.js";
import { init as initViewMenu } from "./menu/view.js";
import { init as initKeyboard } from "./io/keyboard.js";
import { init as initPalette, refresh as refreshPalette, refreshSelection as refreshPaletteSelection } from "./components/palette.js";
import * as preview from "./components/preview.js";
import { init as initUnicode, refresh as refreshUnicode } from "./components/unicode.js";
import * as canvasStack from './components/canvas_stack.js';
import * as selection from './canvas/selection.js';
import * as state from "./state/state.js";
import * as localstorage from "./state/localstorage.js";
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
    const savedState = localstorage.loadState();
    savedState ? state.load(savedState) : state.loadNew();

    refreshShortcuts();

    if (state.config('tool') === 'text-editor') {
        selection.moveCursorToStart();
    }

    localstorage.setupAutoSave();
})





/**
 * Resizes the components that depend on window size. Then triggers a full refresh.
 */
export function triggerResize(clearSelection = false) {
    console.log('actual')
    if (clearSelection) {
        selection.clear();
    }

    // Refresh frames controller first, since its configuration can affect canvas boundaries
    frames.refresh();

    canvasStack.resize();
    preview.resize();
    // Note: frames canvases will be resized during triggerRefresh() since they all have to be rebuilt

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
                break;
            default:
                console.warn(`triggerRefresh("${type}") is not a valid type`);
        }
    });

    if (saveState) {
        state.pushStateToHistory(saveState === true ? undefined : { modifiable: saveState });
    }
}
