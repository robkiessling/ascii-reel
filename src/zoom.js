import $ from "jquery";
import {triggerRefresh} from "./index.js";

const ZOOM_SCROLL_FACTOR = 1.1;

let source, preview, canvases;

export function setupMouseEvents(sourceCanvas, previewCanvas, canvasControls) {
    source = sourceCanvas;
    preview = previewCanvas;
    canvases = canvasControls;

    setupScroll();
    setupPan();
    setupPreviewPan();
}

function setupScroll() {
    source.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) { return; }

        const scaledDelta = Math.pow(ZOOM_SCROLL_FACTOR, -deltaY / 100);
        const target = source.pointAtExternalXY(evt.offsetX, evt.offsetY);
        updateCanvases(canvasControl => canvasControl.zoomDelta(scaledDelta, target))
    });
}

function setupPan() {
    let isSliding;
    let originalPoint;

    disableRightClick(source);

    source.$canvas.off('mousedown.zoom').on('mousedown.zoom', evt => {
        if (evt.which !== 2 && evt.which !== 3) { return; } // Only apply to middle-click and right-click

        isSliding = true;
        originalPoint = source.pointAtExternalXY(evt.offsetX, evt.offsetY);
    });

    source.$canvas.off('mousemove.zoom').on('mousemove.zoom', evt => {
        if (isSliding) {
            const currentPoint = source.pointAtExternalXY(evt.offsetX, evt.offsetY);
            const deltas = [currentPoint.x - originalPoint.x, currentPoint.y - originalPoint.y];
            updateCanvases(canvasControl => canvasControl.translateAmount(...deltas));
        }
    });

    $(document).off('mouseup.zoom').on('mouseup.zoom', evt => {
        if (isSliding) {
            isSliding = false;
        }
    });
}

function setupPreviewPan() {
    let isSliding;

    disableRightClick(preview);

    preview.$canvas.off('mousedown.previewZoom').on('mousedown.previewZoom', evt => {
        isSliding = true;
        const target = preview.pointAtExternalXY(evt.offsetX, evt.offsetY);
        updateCanvases(canvasControl => canvasControl.translateToTarget(target));
    });

    preview.$canvas.off('mousemove.previewZoom').on('mousemove.previewZoom', evt => {
        if (isSliding) {
            const target = preview.pointAtExternalXY(evt.offsetX, evt.offsetY);
            updateCanvases(canvasControl => canvasControl.translateToTarget(target));
        }
    });

    $(document).off('mouseup.previewZoom').on('mouseup.previewZoom', evt => {
        if (isSliding) {
            isSliding = false;
        }
    });
}

function updateCanvases(callback) {
    canvases.forEach(canvasControl => {
        callback(canvasControl);
    });

    triggerRefresh('zoom');
}

function disableRightClick(canvasControl) {
    canvasControl.$canvas.off('contextmenu.zoom').on('contextmenu.zoom', evt => {
        return false;
    });
}