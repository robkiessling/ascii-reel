import $ from "jquery";
import 'jquery-ui/ui/widgets/slider.js';

import * as state from "./state.js";
import {CanvasControl} from "./canvas.js";
import {selectionCanvas} from "./index.js";

const MAX_FPS = 30;

export let canvasControl;
let previewInterval, previewIndex;
let $fpsValue, $fpsSlider;

export function init() {
    canvasControl = new CanvasControl($('#preview-canvas'), {});

    $fpsValue = $('#preview-fps-value');

    $fpsSlider = $('#preview-fps-slider').slider({
        min: 0,
        max: MAX_FPS,
        slide: (event, ui) => {
            state.config('fps', ui.value);
            reset();
        }
    });
}

// Just redraw the current preview frame (e.g. if chars got updated)
export function redraw() {
    canvasControl.clear();
    canvasControl.drawBackground(state.config('background'));
    canvasControl.drawGlyphs(state.layeredGlyphs(state.frames()[previewIndex], { showAllLayers: true }));
    canvasControl.drawWindow(selectionCanvas.currentViewRect());
}

// Reset the preview interval (e.g. if fps changes, if a frame got deleted, etc.)
export function reset() {
    window.clearInterval(previewInterval);

    $fpsSlider.slider('value', state.config('fps'));
    $fpsValue.html(`${state.config('fps')} FPS`);

    previewIndex = state.frameIndex();
    redraw();

    if (state.config('fps') !== 0) {
        previewInterval = window.setInterval(() => {
            previewIndex += 1;
            if (previewIndex >= state.frames().length) {
                previewIndex = 0;
            }
            redraw();
        }, 1000 / state.config('fps'));
    }
}
