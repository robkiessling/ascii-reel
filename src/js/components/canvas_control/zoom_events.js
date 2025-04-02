import {isFunction} from "../../utils/utilities.js";
import {eventBus, EVENTS} from "../../events/events.js";

const ZOOM_SCROLL_FACTOR = 1.1;

/**
 * Adds mouse event handlers to a canvasControl so scrolling the mouse wheel emits zoom events
 * @param canvasControl The canvas controller to apply mouse event handlers to
 * @param isTargeted If true, zooms in/out at mouse cursor. If false, zooms in/out at canvas center
 */
export function setupZoomEvents(canvasControl, isTargeted = false) {
    canvasControl.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) return;

        const scaledDelta = Math.pow(ZOOM_SCROLL_FACTOR, -deltaY / 100);
        const target = isTargeted ? canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY) : undefined;

        eventBus.emit(EVENTS.CANVAS.ZOOM_DELTA, { delta: scaledDelta, target: target })
    });
}
