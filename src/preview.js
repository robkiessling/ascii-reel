import * as state from "./state.js";
import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import 'jquery-ui/ui/widgets/slider.js';
import {selectionCanvas} from "./index.js";

const MAX_FPS = 30;

export const canvasControl = new CanvasControl($('#preview-canvas'), {});
let previewInterval;
let previewIndex;

const $fpsValue = $('#preview-fps-value');

const fpsSlider = $('#preview-fps-slider').slider({
    min: 0,
    max: MAX_FPS,
    slide: (event, ui) => {
        state.fps(ui.value);
        reset();
    }
});

export function init() {
    fpsSlider.slider('value', state.fps());
}

// Just refresh the current preview frame (e.g. if chars got updated)
export function refresh() {
    canvasControl.drawChars(state.layeredChars(previewIndex));
    canvasControl.drawWindow(selectionCanvas.currentViewRect());
}

// Reset the preview interval (e.g. if fps changes, if a frame got deleted, etc.)
export function reset() {
    window.clearInterval(previewInterval);

    $fpsValue.html(`${state.fps()} FPS`);

    previewIndex = state.frameIndex();
    refresh();

    if (state.fps() !== 0) {
        previewInterval = window.setInterval(() => {
            previewIndex += 1;
            if (previewIndex >= state.frames().length) {
                previewIndex = 0;
            }
            refresh();
        }, 1000 / state.fps());
    }
}
