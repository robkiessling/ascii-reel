import $ from "jquery";
import './styles/app.scss'
import {create2dArray, randomPrintableChar} from "./utilities.js";
import {CanvasControl} from './canvas.js';
import './keyboard.js';
import * as selection from './selection.js';
import * as zoomEvents from './zoom_events.js';
import './clipboard.js';
import {FrameController} from "./frames.js";

export const frameController = new FrameController($('#frames-container'));
const charCanvas = new CanvasControl($('#char-canvas'), {});
const selectionCanvas = new CanvasControl($('#selection-canvas'), {});
const previewCanvas = new CanvasControl($('#preview-canvas'), {});

selection.bindMouseToCanvas(selectionCanvas);
zoomEvents.setup(selectionCanvas, previewCanvas, [selectionCanvas, charCanvas]);

function loadFrames(frames) {
    // This has to come first, to set dimensions
    frameController.loadFrames(frames);

    // Resize everything now that dimensions are set
    charCanvas.resize();
    selectionCanvas.resize();
    previewCanvas.resize();
    frameController.resize();

    // Lock preview to dimensions
    previewCanvas.zoomToFit();

    refresh();
}

$(window).off('resize:debounced').on('resize:debounced', () => {
    charCanvas.resize();
    selectionCanvas.resize();
    previewCanvas.resize();
    frameController.resize();
    refresh();
});

export function refresh(type = 'full') {
    switch(type) {
        case 'chars':
            charCanvas.drawChars(frameController.currentFrame.chars);
            previewCanvas.drawChars(frameController.currentFrame.chars);
            frameController.currentFrame.drawChars();
            break;
        case 'selection':
            selectionCanvas.highlightCells(selection.getSelectedCells());
            break;
        case 'zoom':
            charCanvas.drawChars(frameController.currentFrame.chars);
            previewCanvas.drawChars(frameController.currentFrame.chars);
            zoomEvents.updateWindow();
            selectionCanvas.highlightCells(selection.getSelectedCells());
            break;
        case 'full':
            charCanvas.drawChars(frameController.currentFrame.chars);
            previewCanvas.drawChars(frameController.currentFrame.chars);
            zoomEvents.updateWindow();
            selectionCanvas.highlightCells(selection.getSelectedCells());
            frameController.fullRefresh();
            break;
        default:
            console.warn(`refresh("${type}") is not a valid type`);
    }
}

loadFrames([
    create2dArray(5, 10, () => randomPrintableChar()),
    create2dArray(10, 20, () => randomPrintableChar()),
    create2dArray(10, 20, () => randomPrintableChar()),
])
// loadChars(create2dArray(30, 50, (row, col) => {
//     return row % 10 === 0 && col % 10 === 0 ? 'X' : '';
// }));
