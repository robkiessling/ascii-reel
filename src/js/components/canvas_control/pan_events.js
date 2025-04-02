import {isFunction} from "../../utils/utilities.js";
import {eventBus, EVENTS} from "../../events/events.js";

/**
 * Adds mouse event handlers to a canvasControl so clicking-and-dragging emits pan events
 * @param canvasControl The canvas controller to apply mouse event handlers to
 * @param snapToCenter If true, canvas view will snap so that its center is at mouse
 * @param {Array|Function} forMouseButtons Which mouse buttons (left/right/middle) should trigger panning. If param is
 *   an array, the integers in the array are the allowed mouse buttons. If param is a function, the function will be
 *   evaluated on mousedown and should return an array of integers representing the allowed mouse buttons (this can be
 *   useful if the mouse buttons that affect panning can change over time). Mouse button integers are based on jQuery's
 *   event.which enum: 1=left, 2=middle, 3=right
 */
export function setupPanEvents(canvasControl, snapToCenter, forMouseButtons = [1,2,3]) {
    if (!canvasControl.$canvas.attr('id')) console.warn("<canvas/> needs an `id` attr for mouse panning to function correctly")
    const jQueryNS = `pan-${canvasControl.$canvas.attr('id')}`; // Put each canvas listener into its own namespace

    let isPanning;
    let originalPoint;

    canvasControl.preventStandardRightClick();

    canvasControl.$canvas.off(`mousedown.${jQueryNS}`).on(`mousedown.${jQueryNS}`, evt => {
        const allowedMouseButtons = isFunction(forMouseButtons) ? forMouseButtons() : forMouseButtons;
        if (!allowedMouseButtons.includes(evt.which)) return;

        isPanning = true;
        originalPoint = canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY);
    });

    canvasControl.$canvas.off(`mousemove.${jQueryNS}`).on(`mousemove.${jQueryNS}`, evt => {
        if (!isPanning) return;

        const target = canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY);

        if (snapToCenter) {
            eventBus.emit(EVENTS.CANVAS.PAN_TO_TARGET, { target })
        }
        else {
            eventBus.emit(EVENTS.CANVAS.PAN_DELTA, {
                delta: { x: target.x - originalPoint.x, y: target.y - originalPoint.y }
            })
        }
    });

    $(document).off(`mouseup.${jQueryNS}`).on(`mouseup.${jQueryNS}`, () => isPanning = false);
}
