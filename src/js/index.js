import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/slider.js';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-visible';
import '../styles/app.scss'

import { init as initClipboard } from "./io/clipboard.js"
import { init as initEditor } from "./features/tools.js"
import { init as initMainMenu } from "./features/menu/main.js";
import { init as initFileMenu } from "./features/menu/file.js";
import { init as initToolsMenu } from "./features/menu/tools.js";
import { init as initViewMenu } from "./features/menu/view.js";
import { init as initThemeMenu } from "./features/menu/theme.js";
import { init as initKeyboard } from "./io/keyboard.js";
import { init as initActions } from "./io/actions.js";
import { init as initPalette } from "./features/palette.js";
import { init as initPreview, resize as resizePreview } from "./features/preview.js";
import { init as initUnicode } from "./features/unicode.js";
import { init as initMainCanvas, resize as resizeMainCanvas } from './features/main_canvas.js';
import { init as initSelection, clear as performClearSelection, syncTextEditorCursorPos } from './features/selection.js';
import { init as initState, isValid as isStateValid, loadFromLocalStorage, loadBlankState } from "./state/index.js";
import { init as initFrames, refresh as refreshFrames } from "./features/frames.js";
import { init as initLayers } from "./features/layers.js";
import { init as initLocalStorage, readState as readLocalStorage} from "./storage/local_storage.js";
import {debounce, defer} from "./utils/utilities.js";
import {eventBus, EVENTS} from './events/events.js'
import {calculateFontRatio} from "./config/font.js";
import {recalculateBGColors} from "./config/background.js";

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
initMainCanvas();
initFrames();
initLayers();
initSelection();
initLocalStorage();

setupEventBus();
defer(() => loadInitialContent());

function setupEventBus() {
    eventBus.on(EVENTS.STATE.LOADED, () => {
        calculateFontRatio();
        recalculateBGColors();

        eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
    })

    $(window).on('resize', debounce(() => eventBus.emit(EVENTS.RESIZE.ALL)));
    
    // Resize listener: Resizes the components that depend on window size, then triggers a full refresh
    eventBus.on(EVENTS.RESIZE.ALL, ({ resetZoom, clearSelection }) => {
        if (!isStateValid()) return;

        if (clearSelection) performClearSelection(false);

        // Refresh frames controller first, since its configuration (align left/bottom) can affect canvas boundaries
        refreshFrames();

        // Resize all CanvasControls:
        resizeMainCanvas(resetZoom);
        resizePreview(); // Don't care about resetZoom since it will zoomToFit anyway
        // Frame canvases don't need to be resized here since EVENTS.REFRESH.ALL will rebuild them all anyway

        eventBus.emit(EVENTS.REFRESH.ALL);
    })
    
    // History state-change listener:
    eventBus.on(EVENTS.HISTORY.CHANGED, ({ requiresResize, recalculateFont, recalculateBackground }) => {
        syncTextEditorCursorPos();

        if (recalculateFont) calculateFontRatio()
        if (recalculateBackground) recalculateBGColors()

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
}
