import * as state from "../state/state.js";
import CanvasControl from "../canvas/canvas.js";
import * as actions from "../io/actions.js";
import {setIntervalUsingRAF} from "../utils/utilities.js";
import {getCurrentViewRect} from "./canvas_stack.js";
import {setupMousePan, setupScrollZoom} from "../canvas/zoom.js";

const MAX_FPS = 24;
const POPUP_INITIAL_SIZE = [640, 640]; // width, height
const POPUP_BACKGROUND = '#202124'; // same as $darkest
const POPUP_RESIZE_DEBOUNCE_LENGTH = 200;

let canvasControl;
let previewInterval, previewIndex;
let $fpsValue, $fpsSlider;
let tooltips;
let popup, popupCanvas;

export function init() {
    const $container = $('#preview-controller');
    canvasControl = new CanvasControl($('#preview-canvas'), {});

    setupScrollZoom(canvasControl, false);
    setupMousePan(canvasControl, true)

    $fpsValue = $('#preview-fps-value');

    $fpsSlider = $('#preview-fps-slider').slider({
        min: 0,
        max: MAX_FPS,
        slide: (event, ui) => {
            state.config('fps', ui.value);
            reset();
        }
    });

    setupActionButtons($container);
}

export function resize() {
    canvasControl.resize();
    canvasControl.zoomToFit();
}

// Just redraw the current preview frame (e.g. if chars got updated)
export function redraw() {
    canvasControl.clear();
    canvasControl.drawBackground(state.config('background'));
    canvasControl.drawGlyphs(state.layeredGlyphs(state.frames()[previewIndex], { showAllLayers: true }));
    canvasControl.drawWindow(getCurrentViewRect());

    if (popup && !popup.closed && popupCanvas) {
        popupCanvas.clear();
        popupCanvas.drawBackground(state.config('background'));
        popupCanvas.drawGlyphs(state.layeredGlyphs(state.frames()[previewIndex], { showAllLayers: true }));
    }
}

// Reset the preview interval (e.g. if fps changes, if a frame got deleted, etc.)
export function reset() {
    if (previewInterval) { previewInterval.stop(); }

    $fpsSlider.slider('value', state.config('fps'));
    $fpsValue.html(`${state.config('fps')} FPS`);

    previewIndex = state.frameIndex();
    redraw();

    if (state.config('fps') === 0) {
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
        }, 1000 / state.config('fps'));
    }
}

function setupActionButtons($container) {
    actions.registerAction('preview.open-popup', {
        callback: () => openPopup()
    });

    actions.attachClickHandlers($container);

    tooltips = actions.setupTooltips(
        $container.find('[data-action]').toArray(),
        element => $(element).data('action'),
        { placement: 'top' }
    )
}


function openPopup() {
    // Manually hide 'open-popup' button tooltip since we are leaving the page and it won't detect mouseleave
    tooltips.forEach(tooltip => tooltip.hide());

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
            body { margin: 0; }
            #canvas { background: ${POPUP_BACKGROUND}; }
        </style>
    `;
    popup.document.body.innerHTML = '<canvas id="canvas">';

    // Set up the CanvasControl in the popup (it will be updated at the same time as the normal preview canvas)
    popupCanvas = new CanvasControl($(popup.document.getElementById("canvas")), {});
    popupCanvas.resize();
    popupCanvas.zoomToFit();

    // Popup window resize handler (debounced)
    let resizeTimeoutId;
    popup.addEventListener('resize', () => {
        clearTimeout(resizeTimeoutId);
        resizeTimeoutId = setTimeout(() => {
            popupCanvas.resize();
            popupCanvas.zoomToFit();
        }, POPUP_RESIZE_DEBOUNCE_LENGTH);
    })
}