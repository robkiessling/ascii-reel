import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/slider.js';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-visible';
import 'simplebar/dist/simplebar.min.css'; // https://github.com/Grsmto/simplebar/issues/721#issuecomment-2880174890
import '../styles/app.scss'

import { init as initClipboard } from "./io/clipboard.js"
import { init as initTools } from "./controllers/tool_controller.js"
import { init as initMainMenu } from "./controllers/main_menu/index.js";
import { init as initKeyboard } from "./io/keyboard.js";
import { init as initActions } from "./io/actions.js";
import { init as initPalette } from "./controllers/palette_controller.js";
import { init as initPreview, resize as resizePreview } from "./controllers/preview_controller.js";
import { init as initUnicode } from "./controllers/unicode_controller.js";
import { init as initCanvas, resize as resizeCanvas } from './controllers/canvas_controller.js';
import { init as initSelection, clear as performClearSelection } from './controllers/selection/index.js'
import {
    init as initState,
    isValid as isStateValid,
    loadFromStorage,
    markClean,
    loadNewState,
    fontFamily
} from "./state/index.js";
import { init as initFrames, resize as resizeFrames } from "./controllers/frame_controller.js";
import { init as initLayers } from "./controllers/layer_controller.js";
import { init as initSidebar, resize as resizeSidebar } from "./controllers/sidebar_controller.js";
import { init as initLocalStorage, readState as readLocalStorage} from "./storage/local_storage.js";
import {debounce, defer} from "./utils/utilities.js";
import {eventBus, EVENTS} from './events/events.js'
import {calculateFontRatio} from "./config/font.js";
import {recalculateCanvasColors} from "./config/colors.js";
import {applyThemeToDocument, recalculateTheme} from "./config/theme.js";
import "./geometry/shapes/index.js"; // Importing all shape files because they register themselves

// Note: The order of these initializers does not matter (they should not depend on the other modules being initialized)
initClipboard();
initTools();
initMainMenu();
initKeyboard();
initActions();
initPalette();
initUnicode();
initPreview();
initState();
initCanvas();
initFrames();
initLayers();
initSidebar();
initSelection();
initLocalStorage();

setupEventBus();
defer(() => loadInitialContent());

/**
 * The index.js event bus manages app-wide events
 */
function setupEventBus() {
    eventBus.on(EVENTS.STATE.LOADED, () => {
        calculateFontRatio(fontFamily());
        recalculateCanvasColors();

        eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: false, resetZoom: true })

        // eventBus.emit(EVENTS.CANVAS.ZOOM_TO_DEFAULT);
    })

    $(window).on('resize', debounce(() => eventBus.emit(EVENTS.RESIZE.ALL)));
    
    // Resize listener: Resizes the components that depend on window size, then triggers a full refresh
    // We use an index.js-level event listener (as opposed to each controller individually listening to this event) so
    // we can ensure the correct processing order
    eventBus.on(EVENTS.RESIZE.ALL, ({ resetZoom, clearSelection }) => {
        if (!isStateValid()) return;

        if (clearSelection) performClearSelection(false);

        // Resize frames & sidebar first since their alignment affects canvas dimensions
        resizeFrames();
        resizeSidebar();

        // Resize all canvas controls
        resizeCanvas(resetZoom);
        resizePreview();
        // Frame canvases don't need to be resized here since EVENTS.REFRESH.ALL will rebuild them all anyway

        eventBus.emit(EVENTS.REFRESH.ALL);
    })
    
    // History state-change listener:
    eventBus.on(EVENTS.HISTORY.CHANGED, ({ requiresResize, recalculateFont, recalculateColors }) => {
        if (recalculateFont) calculateFontRatio(fontFamily())
        if (recalculateColors) recalculateCanvasColors()

        if (requiresResize) {
            eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
        }
        else {
            eventBus.emit(EVENTS.REFRESH.ALL);
        }
    })

    eventBus.on(EVENTS.FILE.SAVED, () => markClean());

    eventBus.on(EVENTS.THEME.CHANGED, () => {
        recalculateTheme();
        applyThemeToDocument();
        recalculateCanvasColors();
        eventBus.emit(EVENTS.REFRESH.ALL);
    })
}

function loadInitialContent() {
    /* Critical CSS -- not showing page until DOMContentLoaded to avoid flash of unstyled content */
    $('body').css('opacity', 1);

    // Load from local storage if possible, otherwise load blank state
    const storedState = readLocalStorage();
    storedState ? loadFromStorage(storedState) : loadNewState();

    // [Debug helper] - uncomment if you want to start from scratch
    // loadNewState();
}
