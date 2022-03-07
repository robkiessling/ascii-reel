import $ from "jquery";
import {refresh} from "./index.js";

const ZOOM_SCROLL_FACTOR = 1.1;

let source, preview, canvases;

export function setup(sourceCanvas, previewCanvas, zoomCanvases) {
    source = sourceCanvas;
    preview = previewCanvas;
    canvases = zoomCanvases;

    setupScroll();
    setupMouse();
}

export function updateWindow() {
    if (source && preview) {
        preview.drawWindow(source.currentViewRect());
    }
}

function setupScroll() {
    source.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) { return; }

        const scaledDelta = Math.pow(ZOOM_SCROLL_FACTOR, -deltaY / 100);

        canvases.forEach(canvasControl => {
            canvasControl.zoomDelta(scaledDelta, canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY));
        });

        refresh();
    });
}

function setupMouse() {
    let isSliding;

    preview.$canvas.off('mousedown.zoom').on('mousedown.zoom', evt => {
        isSliding = true;

        panWindow(preview.pointAtExternalXY(evt.offsetX, evt.offsetY))
    });

    preview.$canvas.off('mousemove.zoom').on('mousemove.zoom', evt => {
        if (isSliding) {
            panWindow(preview.pointAtExternalXY(evt.offsetX, evt.offsetY))
        }
    });

    $(document).off('mouseup.zoom').on('mouseup.zoom', evt => {
        if (isSliding) {
            isSliding = false;
        }
    });
}

function panWindow(target) {
    canvases.forEach(canvasControl => {
        canvasControl.translateZoom(target);
    });

    refresh();
}

