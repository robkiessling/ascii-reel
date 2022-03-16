import $ from "jquery";
import './styles/app.scss'
import 'remixicon/fonts/remixicon.css';
import {create2dArray, randomPrintableChar} from "./utilities.js";
import {CanvasControl} from './canvas.js';
import './keyboard.js';
import * as selection from './selection.js';
import * as zoomEvents from './zoom_events.js';
import './clipboard.js';
import {Timeline} from "./timeline.js";
import * as state from "./state.js";
import * as preview from "./preview.js";

export const timeline = new Timeline($('#frame-controller'), $('#layer-controller'));
export const charCanvas = new CanvasControl($('#char-canvas'), {});
export const selectionCanvas = new CanvasControl($('#selection-canvas'), {});

selection.bindMouseToCanvas(selectionCanvas);
zoomEvents.setup(selectionCanvas, preview.canvasControl, [selectionCanvas, charCanvas]);

$(window).off('resize:debounced').on('resize:debounced', resize);

function load(data) {
    state.loadState(data);
    preview.init();
    resize();
}

export function resize() {
    console.log(`A: w: ${charCanvas.outerWidth}, h: ${charCanvas.outerHeight}`)
    charCanvas.resize();
    console.log(`B: w: ${charCanvas.outerWidth}, h: ${charCanvas.outerHeight}`)
    selectionCanvas.resize();
    preview.canvasControl.resize();
    // Note: timeline frames will be resized during refresh() since they all have to be rebuilt

    preview.canvasControl.zoomToFit(); // todo just do this once?
    refresh();
}

export function refresh(type = 'full') {
    switch(type) {
        case 'chars':
            charCanvas.drawChars(state.currentCel().chars);
            preview.refresh();
            timeline.currentFrameComponent.redrawChars();
            break;
        case 'selection':
            selectionCanvas.highlightCells(selection.getSelectedCells());
            break;
        case 'zoom':
            charCanvas.drawChars(state.currentCel().chars);
            preview.refresh();
            selectionCanvas.highlightCells(selection.getSelectedCells());
            break;
        case 'full':
            charCanvas.drawChars(state.currentCel().chars);
            preview.reset();
            selectionCanvas.highlightCells(selection.getSelectedCells());
            timeline.rebuildLayers();
            timeline.rebuildFrames();
            break;
        default:
            console.warn(`refresh("${type}") is not a valid type`);
    }
}

load({
    config: {
        dimensions: [10, 5]
    },
    layers: [
        { id: 1, name: 'Bottom Layer', opacity: 1 },
        { id: 2, name: 'Top Layer', opacity: 1 }
    ],
    frames: [
        { id: 1, duration: 0.5 },
        { id: 2, duration: 0.5 },
        { id: 3, duration: 0.5 },
    ],
    cels: [
        { layerId: 1, frameId: 1, chars: create2dArray(5, 10, () => randomPrintableChar()), colors: [[]] },
        { layerId: 1, frameId: 2, chars: create2dArray(2, 5, () => randomPrintableChar()), colors: [[]] },
        { layerId: 1, frameId: 3, chars: create2dArray(5, 10, () => randomPrintableChar()), colors: [[]] },
        { layerId: 2, frameId: 1, chars: create2dArray(2, 5, 'x'), colors: [[]] },
        { layerId: 2, frameId: 2, chars: [[]], colors: [[]] },
        { layerId: 2, frameId: 3, chars: [[]], colors: [[]] },
    ]
});

// loadChars(create2dArray(30, 50, (row, col) => {
//     return row % 10 === 0 && col % 10 === 0 ? 'X' : '';
// }));
