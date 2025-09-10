import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/slider.js';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-visible';
import '../styles/app.scss'

import { init as initClipboard } from "./io/clipboard.js"
import { init as initEditor } from "./features/tools.js"
import { init as initMainMenu } from "./features/menu/index.js";
import { init as initKeyboard } from "./io/keyboard.js";
import { init as initActions } from "./io/actions.js";
import { init as initPalette } from "./features/palette.js";
import { init as initPreview, resize as resizePreview } from "./features/preview.js";
import { init as initUnicode } from "./features/unicode.js";
import { init as initMainCanvas, resize as resizeMainCanvas } from './features/main_canvas.js';
import { init as initRasterSelection, clear as performClearSelection } from './features/selection/raster_selection.js'
import { init as initVectorSelection } from './features/selection/vector_selection.js';
import {
    init as initState, isValid as isStateValid,
    loadFromStorage, markClean, loadNewState, modifyHistory, serialize, pushHistory
} from "./state/index.js";
import { init as initFrames, resize as resizeFrames } from "./features/frames.js";
import { init as initLayers } from "./features/layers.js";
import { init as initSidebar, resize as resizeSidebar } from "./features/sidebar.js";
import { init as initLocalStorage, readState as readLocalStorage} from "./storage/local_storage.js";
import {debounce, defer} from "./utils/utilities.js";
import {eventBus, EVENTS} from './events/events.js'
import {calculateFontRatio} from "./config/font.js";
import {recalculateCanvasColors} from "./config/colors.js";
import {applyThemeToDocument, recalculateTheme} from "./config/theme.js";

// Note: The order of these initializers does not matter (they should not depend on the other modules being initialized)
initClipboard();
initEditor();
initMainMenu();
initKeyboard();
initActions();
initPalette();
initUnicode();
initPreview();
initState();
initMainCanvas();
initFrames();
initLayers();
initSidebar();
initRasterSelection();
initVectorSelection();
initLocalStorage();

setupEventBus();
defer(() => loadInitialContent());

function setupEventBus() {
    eventBus.on(EVENTS.STATE.LOADED, () => {
        calculateFontRatio();
        recalculateCanvasColors();

        eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: false, resetZoom: true })
    })

    $(window).on('resize', debounce(() => eventBus.emit(EVENTS.RESIZE.ALL)));
    
    // Resize listener: Resizes the components that depend on window size, then triggers a full refresh
    eventBus.on(EVENTS.RESIZE.ALL, ({ resetZoom, clearSelection }) => {
        if (!isStateValid()) return;

        if (clearSelection) performClearSelection(false);

        // Resize frames & sidebar first since their alignment affects canvas dimensions
        resizeFrames();
        resizeSidebar();

        // Resize all canvas controls
        resizeMainCanvas(resetZoom);
        resizePreview();
        // Frame canvases don't need to be resized here since EVENTS.REFRESH.ALL will rebuild them all anyway

        eventBus.emit(EVENTS.REFRESH.ALL);
    })
    
    // History state-change listener:
    eventBus.on(EVENTS.HISTORY.CHANGED, ({ requiresResize, recalculateFont, recalculateColors }) => {
        if (recalculateFont) calculateFontRatio()
        if (recalculateColors) recalculateCanvasColors()

        if (requiresResize) {
            eventBus.emit(EVENTS.RESIZE.ALL, { clearSelection: true, resetZoom: true })
        }
        else {
            eventBus.emit(EVENTS.REFRESH.ALL);
        }
    })

    eventBus.on(EVENTS.SELECTION.CHANGED, () => {
        // TODO [undo/redo issue]
        // modifyHistory(historySlice => historySlice.selection = serialize({ history: true }).selection)

        // This almost works, but movable content is janky
        // pushHistory({ modifiable: 'selection' })
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

    // Debug helper - starting from scratch
    // loadNewState();
}
