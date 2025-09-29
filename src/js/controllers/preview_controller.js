/**
 * UI component for the canvas preview in the top-right area of the page.
 */

import * as state from "../state/index.js";
import Canvas from "../components/canvas.js";
import * as actions from "../io/actions.js";
import {setIntervalUsingRAF} from "../utils/utilities.js";
import {getCurrentViewRect} from "./canvas_controller.js";
import {eventBus, EVENTS} from "../events/events.js";
import {STRINGS} from "../config/strings.js";
import {getDynamicColor} from "../config/colors.js";
import Minimizer from "../components/minimizer.js";
import {MOUSE} from "../io/mouse.js";

const MAX_FPS = 30;
const POPUP_INITIAL_SIZE = [640, 640]; // width, height
const POPUP_RESIZE_DEBOUNCE_LENGTH = 200;

let $container, $fpsValue, $fpsSlider, $previewControls;
let previewCanvas;
let previewInterval, previewIndex, numPreviewFrames, previewFps;
let actionButtons;
let popup, popupCanvas;
let minimizer;

export function init() {
    $container = $('#preview-container');
    previewCanvas = new Canvas($('#preview-canvas'), {
        onWheel: ({zoomY, evt}) => {
            if (evt.shiftKey) return;
            eventBus.emit(EVENTS.CANVAS.ZOOM_DELTA, { delta: zoomY })
        },
        onMouseDown: ({currentPoint, mouseDownButton}) => {
            if (mouseDownButton === MOUSE.LEFT || mouseDownButton === MOUSE.MIDDLE) {
                eventBus.emit(EVENTS.CANVAS.PAN_TO_TARGET, { target: currentPoint })
            }
        },
        onMouseMove: ({currentPoint, mouseDownButton, isDragging}) => {
            if (isDragging && (mouseDownButton === MOUSE.LEFT || mouseDownButton === MOUSE.MIDDLE)) {
                eventBus.emit(EVENTS.CANVAS.PAN_TO_TARGET, { target: currentPoint })
            }
        }
    });

    $previewControls = $container.find('#preview-controls');
    $fpsValue = $('#preview-fps-value');

    $fpsSlider = $('#preview-fps-slider').slider({
        min: 0,
        max: MAX_FPS,
        slide: (event, ui) => {
            state.setConfig('fps', ui.value);
            reset();
        }
    });

    minimizer = new Minimizer($container, 'preview')

    setupActions();
    setupEventBus();
}

export function resize() {
    $previewControls.toggleClass('hidden', !state.isAnimationProject())
    minimizer.refresh();

    previewCanvas.resize(true);
    previewCanvas.zoomToFit();
}

// Just redraw the current preview frame (e.g. if chars got updated)
function redraw() {
    previewCanvas.clear();
    previewCanvas.drawBackground(state.getConfig('background'));
    previewCanvas.drawGlyphs(getPreviewGlyphs());
    previewCanvas.drawWindow(getCurrentViewRect());

    if (popup && !popup.closed && popupCanvas) {
        popupCanvas.clear();
        popupCanvas.drawBackground(state.getConfig('background'));
        popupCanvas.drawGlyphs(getPreviewGlyphs());
    }
}

// Reset the preview interval (e.g. if fps changes, if a frame got deleted, etc.)
function reset() {
    resetCache();

    // Update fps slider/label
    const fps = state.getConfig('fps');
    $fpsSlider.slider('value', fps);
    $fpsValue.html(`${fps} FPS`);
    actionButtons.refreshContent();

    const expandedFrames = state.expandedFrames();
    const usableFps = state.getConfig('playPreview') ? fps : 0;
    let restartInterval = false; // Only restart the interval if we have to; this makes preview smoother during edits

    // Restart the interval if the number of frames has changed or FPS is zero.
    // If FPS is zero we always want to show the current frame, so we reset the interval starting from it.
    if (numPreviewFrames !== expandedFrames.length || usableFps === 0) {
        numPreviewFrames = expandedFrames.length;
        previewIndex = expandedFrames.findIndex(frame => frame.id === state.currentFrame().id);
        restartInterval = true;
    }

    // If FPS changes we have to restart the interval
    if (previewFps !== usableFps) {
        previewFps = usableFps;
        restartInterval = true;
    }

    redraw();

    if (restartInterval) {
        if (previewInterval) previewInterval.stop();

        // Even if FPS is zero, we still redraw the canvas at a slow interval. This is mainly to support the popup.
        const intervalDelay = previewFps === 0 ? 1000 : 1000 / previewFps;

        previewInterval = setIntervalUsingRAF(() => {
            if (previewFps !== 0) previewIndex = (previewIndex + 1) % numPreviewFrames;
            redraw();
        }, intervalDelay)
    }
}

function setupActions() {
    actions.registerAction('preview.toggle-component', () => {
        minimizer.toggle();
        resize();
    })

    actions.registerAction('preview.open-popup', {
        callback: () => openPopup()
    });

    actions.registerAction('preview.toggle-play', {
        name: () => state.getConfig('playPreview') ? STRINGS['preview.pause.name'] : STRINGS['preview.play.name'],
        description: () => state.getConfig('playPreview') ? STRINGS['preview.pause.description'] : STRINGS['preview.play.description'],
        icon: () => state.getConfig('playPreview') ? 'ri-pause-circle-line' : 'ri-play-circle-line',
        enabled: () => state.isAnimationProject(),
        callback: () => {
            state.setConfig('playPreview', !state.getConfig('playPreview'));
            reset();
        }
    });

    actionButtons = actions.setupActionButtons($container, {
        placement: 'top'
    })
}

function setupEventBus() {
    eventBus.on(
        [
            EVENTS.CANVAS.ZOOM_DELTA, EVENTS.CANVAS.ZOOM_TO_FIT, EVENTS.CANVAS.ZOOM_TO_DEFAULT,
            EVENTS.CANVAS.PAN_DELTA, EVENTS.CANVAS.PAN_TO_TARGET
        ],
        () => redraw()
    )

    eventBus.on(EVENTS.REFRESH.CURRENT_FRAME, () => {
        // current frame changed -> clear cache for that frame and redraw
        deletedCachedFrame(state.currentFrame().id);
        redraw();
    })

    eventBus.on([EVENTS.REFRESH.ALL], () => reset())

    eventBus.on([EVENTS.STATE.INVALIDATED], () => resetCache())
}

// --------------------------------------------------------------------------- Glyph cache
// When preview is running, it needs to render the layeredGlyphs over and over for each frame (often at high fps).
// We cache these layeredGlyphs so they don't have to be recalculated every frame.

let previewGlyphsCache;

function getPreviewGlyphs() {
    let frame = state.expandedFrames()[previewIndex];

    if (!previewGlyphsCache) previewGlyphsCache = new Map();
    if (!previewGlyphsCache.has(frame.id)) previewGlyphsCache.set(frame.id, state.layeredGlyphs(frame));

    return previewGlyphsCache.get(frame.id);
}

function resetCache() {
    previewGlyphsCache = null;
}

function deletedCachedFrame(frameId) {
    if (previewGlyphsCache) previewGlyphsCache.delete(frameId);
}


// --------------------------------------------------------------------------- Popup

function openPopup() {
    // Manually hide 'open-popup' button tooltip since we are leaving the page and it won't detect mouseleave
    actionButtons.tooltips.forEach(tooltip => tooltip.hide());

    // Check if popup already open. If so, just focus it and return.
    if (popup && !popup.closed) {
        popup.focus();
        return;
    }

    // Create new popup window
    popup = window.open("", "_blank", `width=${POPUP_INITIAL_SIZE[0]},height=${POPUP_INITIAL_SIZE[1]}`);
    if (!popup) return alert("Popup blocked! Please allow popups.");

    popup.document.head.innerHTML = `
       <style>
            body { margin: 0; background: ${getDynamicColor('--color-background')}; }
            #canvas { background: ${getDynamicColor('--color-background')}; }
        </style>
    `;
    popup.document.body.innerHTML = '<canvas id="canvas">';

    // Set up the Canvas in the popup (it will be updated at the same time as the normal preview canvas)
    popupCanvas = new Canvas($(popup.document.getElementById("canvas")), {});
    popupCanvas.resize(true);
    popupCanvas.zoomToFit();

    // Popup window resize handler (debounced)
    let resizeTimeoutId;
    popup.addEventListener('resize', () => {
        clearTimeout(resizeTimeoutId);
        resizeTimeoutId = setTimeout(() => {
            popupCanvas.resize(true);
            popupCanvas.zoomToFit();
        }, POPUP_RESIZE_DEBOUNCE_LENGTH);
    })
}