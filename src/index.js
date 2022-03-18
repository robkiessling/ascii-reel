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
import './editor.js';

export const timeline = new Timeline($('#frame-controller'), $('#layer-controller'));
export const charCanvas = new CanvasControl($('#char-canvas'), {});
export const selectionCanvas = new CanvasControl($('#selection-canvas'), {});

selection.bindMouseToCanvas(selectionCanvas);
zoomEvents.setup(selectionCanvas, preview.canvasControl, [selectionCanvas, charCanvas]);

$(window).off('resize:debounced').on('resize:debounced', resize);

function load(data) {
    state.loadState(data);
    preview.configUpdated();
    timeline.configUpdated();
    resize();
}

export function resize() {
    timeline.configUpdated(); // affects canvas boundaries

    charCanvas.resize();
    selectionCanvas.resize();
    preview.canvasControl.resize();
    // Note: timeline frames will be resized during refresh() since they all have to be rebuilt

    preview.canvasControl.zoomToFit(); // todo just do this once?
    refresh();
}

export function refresh(type = 'full') {
    switch(type) {
        case 'chars':
            redrawCharCanvas();
            preview.refresh();
            timeline.currentFrameComponent.redrawChars();
            break;
        case 'selection':
            selectionCanvas.highlightAreas(selection.getSelectedAreas());
            break;
        case 'zoom':
            redrawCharCanvas();
            preview.refresh();
            selectionCanvas.highlightAreas(selection.getSelectedAreas());
            break;
        case 'full':
            redrawCharCanvas();
            preview.reset();
            selectionCanvas.highlightAreas(selection.getSelectedAreas());
            timeline.rebuildLayers();
            timeline.rebuildFrames();
            timeline.configUpdated();
            break;
        default:
            console.warn(`refresh("${type}") is not a valid type`);
    }
}

function redrawCharCanvas() {
    charCanvas.drawChars(state.layeredChars(state.currentFrame()));

    if (state.config('onion')) {
        charCanvas.drawOnion(state.layeredChars(state.previousFrame()));
    }
}

const rows = 25;
const columns = 50;
window.setTimeout(() => {
    load({
        config: {
            dimensions: [columns, rows]
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
            { layerId: 1, frameId: 1, chars: create2dArray(rows, columns, () => {
                return [randomPrintableChar(), Math.round(Math.random())];
                }), colors: [[]] },
            { layerId: 1, frameId: 2, chars: create2dArray(2, 5, () => randomPrintableChar()), colors: [[]] },
            { layerId: 1, frameId: 3, chars: create2dArray(5, 10, () => randomPrintableChar()), colors: [[]] },
            { layerId: 2, frameId: 1, chars: create2dArray(2, 5, 'x'), colors: [[]] },
            { layerId: 2, frameId: 2, chars: [[]], colors: [[]] },
            { layerId: 2, frameId: 3, chars: [[]], colors: [[]] },
        ],
        colors: [
            '#ffffffff', // TODO These currently have to match colorPicker format to avoid duplicates
            '#000000ff'
        ]
    });
}, 1);
