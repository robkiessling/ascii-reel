import $ from "jquery";

const ZOOM_SCALE = 1.1;

export function bindScrollToCanvas(canvasControl, onScroll) {
    canvasControl.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) { return; }

        const scaledDelta = Math.pow(ZOOM_SCALE, -deltaY / 100);
        const target = {
            x: evt.offsetX,
            y: evt.offsetY
        };

        onScroll(scaledDelta, target);
        updateWindows(canvasControl.viewRect());
    });
}

let windowControl;

export function bindWindow(canvasControl) {
    windowControl = canvasControl;

    let isSliding;
    canvasControl.$canvas.off('mousedown.zoom').on('mousedown.zoom', evt => {
        isSliding = true;

        // if (evt.metaKey || evt.ctrlKey || !lastArea()) {
        //     startArea(canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY));
        // }
        //
        // if (evt.shiftKey) {
        //     lastArea().end = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
        //     refresh('selection');
        // }
    });
    canvasControl.$canvas.off('mousemove.zoom').on('mousemove.zoom', evt => {
        if (isSliding) {
            // lastArea().end = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
            // refresh('selection');
        }
    });

    $(document).off('mouseup.zoom').on('mouseup.zoom', evt => {
        if (isSliding) {
            isSliding = false;
            // refresh('selection');
        }
    });
}


function updateWindows(window) {
    if (windowControl) {
        windowControl.drawWindow(window);
    }
}
