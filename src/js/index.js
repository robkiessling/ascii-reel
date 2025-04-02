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
import { init as initPreview, resize as resizePreview } from "./components/preview.js";
import { init as initUnicode } from "./components/unicode.js";
import { init as initCanvasStack, resize as resizeCanvasStack } from './components/canvas_stack.js';
import { init as initSelection, clear as performClearSelection, syncTextEditorCursorPos } from './canvas/selection.js';
import { init as initState, isValid as isStateValid, loadFromLocalStorage, loadBlankState } from "./state/index.js";
import { init as initFrames, refresh as refreshFrames } from "./components/frames.js";
import { init as initLayers } from "./components/layers.js";
import {debounce, defer} from "./utils/utilities.js";
import {eventBus, EVENTS} from './events/events.js'
import {calculateFontRatio} from "./canvas/font.js";
import {setupAutoSave, readState as readLocalStorage} from "./storage/local_storage.js";

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
initPreview();
initState();
initCanvasStack();
initFrames();
initLayers();
initSelection();

setupEventListeners();
defer(() => loadInitialContent());

function setupEventListeners() {
    $(window).on('resize', debounce(() => eventBus.emit(EVENTS.RESIZE.ALL)));
    
    // Resize listener: Resizes the components that depend on window size, then triggers a full refresh
    eventBus.on(EVENTS.RESIZE.ALL, ({ resetZoom, clearSelection }) => {
        if (!isStateValid()) return;

        if (clearSelection) performClearSelection(false);

        // Refresh frames controller first, since its configuration (align left/bottom) can affect canvas boundaries
        refreshFrames();

        // Resize all CanvasControls:
        resizeCanvasStack(resetZoom);
        resizePreview(); // Don't care about resetZoom since it will zoomToFit anyway
        // Frame canvases don't need to be resized here since EVENTS.REFRESH.ALL will rebuild them all anyway

        eventBus.emit(EVENTS.REFRESH.ALL);
    })
    
    // History state-change listener:
    eventBus.on(EVENTS.HISTORY.CHANGED, ({ requiresResize, requiresCalculateFontRatio }) => {
        syncTextEditorCursorPos();

        if (requiresCalculateFontRatio) calculateFontRatio();

        if (requiresResize) {
            eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
        }
        else {
            eventBus.emit(EVENTS.REFRESH.ALL);
        }
    })
}

function loadInitialContent() {
    /* Critical CSS -- not showing page until DOMContentLoaded to avoid flash of unstyled content */
    $('body').css('opacity', 1);

    // Load from local storage if possible, otherwise load blank state
    const storedState = readLocalStorage();
    storedState ? loadFromLocalStorage(storedState) : loadBlankState();

    eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
    setupAutoSave();
}