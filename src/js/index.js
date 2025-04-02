import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/slider.js';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-visible';
import '../styles/app.scss'

import { init as initClipboard } from "./io/clipboard.js"
import { init as initEditor } from "./components/editor.js"
import { init as initMainMenu } from "./menu/main.js";
import { init as initFileMenu } from "./menu/file.js";
import { init as initToolsMenu } from "./menu/tools.js";
import { init as initViewMenu } from "./menu/view.js";
import { init as initThemeMenu } from "./menu/theme.js";
import { init as initKeyboard } from "./io/keyboard.js";
import { init as initActions } from "./io/actions.js";
import { init as initPalette } from "./components/palette.js";
import * as preview from "./components/preview.js";
import { init as initUnicode } from "./components/unicode.js";
import * as canvasStack from './components/canvas_stack.js';
import * as selection from './canvas/selection.js';
import * as state from "./state/index.js";
import * as localstorage from "./storage/local_storage.js";
import * as frames from "./components/frames.js";
import * as layers from "./components/layers.js";
import {debounce, defer} from "./utils/utilities.js";
import {eventBus, EVENTS} from './events/events.js'
import {calculateFontRatio} from "./canvas/font.js";

// Note: The order of these initializers does not matter (they should not depend on the other modules being initialized)
initClipboard();
initEditor();
initMainMenu();
initFileMenu();
initToolsMenu();
initViewMenu();
initThemeMenu();
initKeyboard();
initActions();
initPalette();
initUnicode();
preview.init();
state.init();
canvasStack.init();
frames.init();
layers.init();
selection.init();

// Load initial content
defer(() => {
    /* Critical CSS -- not showing page until DOMContentLoaded to avoid flash of unstyled content */
    $('body').css('opacity', 1);

    const savedState = localstorage.readState();
    if (savedState) {
        state.loadFromLocalStorage(savedState)
    }
    else {
        state.loadBlankState();
    }

    triggerResize({ clearSelection: true, resetZoom: true });
    localstorage.setupAutoSave();
});

// Attach window resize listener
$(window).on('resize', debounce(triggerResize));

// Attach history state-change listener
eventBus.on(EVENTS.HISTORY.CHANGED, (newOptions, oldOptions) => {
    selection.syncTextEditorCursorPos();

    if (newOptions.requiresCalculateFontRatio || oldOptions.requiresCalculateFontRatio) calculateFontRatio();

    if (newOptions.requiresResize || oldOptions.requiresResize) {
        triggerResize({ clearSelection: true, resetZoom: true });
    }
    else {
        eventBus.emit(EVENTS.REFRESH.ALL);
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
    // Frame canvases don't need to be resized here since EVENTS.REFRESH.ALL will rebuild them all anyway

    eventBus.emit(EVENTS.REFRESH.ALL);
}

