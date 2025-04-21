/**
 * UI component for the canvas preview in the top-right area of the page.
 */

import * as state from "../state/index.js";
import CanvasControl from "../components/canvas_control/index.js";
import * as actions from "../io/actions.js";
import {setIntervalUsingRAF} from "../utils/utilities.js";
import {getCurrentViewRect} from "./main_canvas.js";
import {eventBus, EVENTS} from "../events/events.js";
import {STRINGS} from "../config/strings.js";
import * as tools from "./tools.js";
import {getDynamicColor} from "../config/colors.js";
import Minimizer from "../components/minimizer.js";

const MAX_FPS = 24;
const POPUP_INITIAL_SIZE = [640, 640]; // width, height
const POPUP_RESIZE_DEBOUNCE_LENGTH = 200;

let $container, $fpsValue, $fpsSlider, $previewControls;
let previewCanvas;
let previewInterval, previewIndex;
let actionButtons;
let popup, popupCanvas;
let minimizer;

export function init() {
    $container = $('#preview-container');
    previewCanvas = new CanvasControl($('#preview-canvas'), {
        emitZoomEvents: {
            targeted: false
        },
        emitPanEvents: {
            snapToCenter: true
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
    previewCanvas.drawGlyphs(state.layeredGlyphs(state.frames()[previewIndex], { drawingContent: tools.drawingContent }));
    previewCanvas.drawWindow(getCurrentViewRect());

    if (popup && !popup.closed && popupCanvas) {
        popupCanvas.clear();
        popupCanvas.drawBackground(state.getConfig('background'));
        popupCanvas.drawGlyphs(state.layeredGlyphs(state.frames()[previewIndex]));
    }
}

// Reset the preview interval (e.g. if fps changes, if a frame got deleted, etc.)
function reset() {
    if (previewInterval) { previewInterval.stop(); }

    const fps = state.getConfig('fps');
    const usableFps = state.getConfig('isPreviewPlaying') ? state.getConfig('fps') : 0;

    $fpsSlider.slider('value', fps);
    $fpsValue.html(`${fps} FPS`);
    actionButtons.refreshContent();

    previewIndex = state.frameIndex();
    redraw();

    if (usableFps === 0) {
        // Even if FPS is zero, we still redraw the canvas at a slow interval. This is mainly to support the popup.
        previewInterval = setIntervalUsingRAF(() => {
            redraw();
        }, 1000);
    }
    else {
        previewInterval = setIntervalUsingRAF(() => {
            previewIndex += 1;
            if (previewIndex >= state.frames().length) {
                previewIndex = 0;
            }
            redraw();
        }, 1000 / usableFps);
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
        name: () => state.getConfig('isPreviewPlaying') ? STRINGS['preview.pause.name'] : STRINGS['preview.play.name'],
        description: () => state.getConfig('isPreviewPlaying') ? STRINGS['preview.pause.description'] : STRINGS['preview.play.description'],
        icon: () => state.getConfig('isPreviewPlaying') ? 'ri-pause-circle-line' : 'ri-play-circle-line',
        enabled: () => state.isAnimationProject(),
        callback: () => {
            state.setConfig('isPreviewPlaying', !state.getConfig('isPreviewPlaying'));
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
            EVENTS.REFRESH.CURRENT_FRAME,
            EVENTS.CANVAS.ZOOM_DELTA, EVENTS.CANVAS.ZOOM_TO_FIT, EVENTS.CANVAS.PAN_DELTA, EVENTS.CANVAS.PAN_TO_TARGET
        ],
        () => redraw()
    )

    eventBus.on([EVENTS.REFRESH.ALL], () => reset())
}


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

    // Set up the CanvasControl in the popup (it will be updated at the same time as the normal preview canvas)
    popupCanvas = new CanvasControl($(popup.document.getElementById("canvas")), {});
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