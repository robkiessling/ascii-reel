import {eventBus, EVENTS} from "../../events/events.js";
import {isFunction} from "../../utils/utilities.js";

const ZOOM_SCROLL_FACTOR = 1.1;

/**
 * Adds mouse event handlers to a canvasControl so hovering over the canvas emits hover events
 * @param {CanvasControl} canvasControl - The canvas controller to apply mouse event handlers to
 */
export function setupHoverEvents(canvasControl) {
    canvasControl.$canvas.on('mouseenter', evt => {
        if (!canvasControl.initialized) return;
        const cell = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
        eventBus.emit(EVENTS.CANVAS.HOVERED, { cell })
    });

    canvasControl.$canvas.on('mousemove', evt => {
        if (!canvasControl.initialized) return;
        const cell = canvasControl.cellAtExternalXY(evt.offsetX, evt.offsetY);
        eventBus.emit(EVENTS.CANVAS.HOVERED, { cell })
    });

    canvasControl.$canvas.on('mouseleave', () => {
        if (!canvasControl.initialized) return;
        eventBus.emit(EVENTS.CANVAS.HOVER_END)
    });
}


/**
 * Adds mouse event handlers to a canvasControl so clicking-and-dragging emits pan events
 * @param {CanvasControl} canvasControl - The canvas controller to apply mouse event handlers to
 * @param {Object} options - Pan event options
 * @param {boolean} [options.snapToCenter] - If true, canvas view will snap so that its center is at mouse
 * @param {Array|Function} [options.mouseButtons=[1,2,3]] - Which mouse buttons (left/right/middle) should trigger panning.
 *   If param is an array, the integers in the array are the allowed mouse buttons. If param is a function, the function
 *   will be evaluated on mousedown and should return an array of integers representing the allowed mouse buttons (this
 *   can be useful if the mouse buttons that affect panning can change over time). Mouse button integers are based on
 *   jQuery's `event.which` enum: 1=left, 2=middle, 3=right
 */
export function setupPanEvents(canvasControl, options = {}) {
    if (options.mouseButtons === undefined) options.mouseButtons = [1, 2, 3];

    if (!canvasControl.$canvas.attr('id')) console.warn("<canvas/> needs an `id` attr for mouse panning to function correctly")
    const jQueryNS = `pan-${canvasControl.$canvas.attr('id')}`; // Put each canvas listener into its own namespace

    let isPanning;
    let originalPoint;

    canvasControl.preventStandardRightClick();

    canvasControl.$canvas.off(`mousedown.${jQueryNS}`).on(`mousedown.${jQueryNS}`, evt => {
        const allowedMouseButtons = isFunction(options.mouseButtons) ? options.mouseButtons() : options.mouseButtons;
        if (!allowedMouseButtons.includes(evt.which)) return;

        isPanning = true;
        originalPoint = canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY);

        if (options.snapToCenter) {
            eventBus.emit(EVENTS.CANVAS.PAN_TO_TARGET, { target: originalPoint })
        }
    });

    canvasControl.$canvas.off(`mousemove.${jQueryNS}`).on(`mousemove.${jQueryNS}`, evt => {
        if (!isPanning) return;

        const target = canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY);

        if (options.snapToCenter) {
            eventBus.emit(EVENTS.CANVAS.PAN_TO_TARGET, { target })
        }
        else {
            eventBus.emit(EVENTS.CANVAS.PAN_DELTA, {
                delta: [target.x - originalPoint.x, target.y - originalPoint.y]
            })
        }
    });

    $(document).off(`mouseup.${jQueryNS}`).on(`mouseup.${jQueryNS}`, () => isPanning = false);
}

/**
 * Adds mouse event handlers to a canvasControl so that clicking/moving the mouse emits raw canvas events.
 * @param {CanvasControl} canvasControl - The canvas controller to apply mouse event handlers to.
 */
export function setupRawMouseEvents(canvasControl) {
    function _emitEvent(eventName, mouseEvent) {
        if (!canvasControl.initialized) return;

        eventBus.emit(eventName, {
            mouseEvent: mouseEvent,
            cell: canvasControl.cellAtExternalXY(mouseEvent.offsetX, mouseEvent.offsetY),
            canvasControl: canvasControl,
        })
    }

    canvasControl.$canvas.on('mousedown', evt => _emitEvent(EVENTS.CANVAS.MOUSEDOWN, evt));
    canvasControl.$canvas.on('mousemove', evt => _emitEvent(EVENTS.CANVAS.MOUSEMOVE, evt));
    $(document).on('mouseup', evt => _emitEvent(EVENTS.CANVAS.MOUSEUP, evt));
    canvasControl.$canvas.on('dblclick', evt => _emitEvent(EVENTS.CANVAS.DBLCLICK, evt));
}


/**
 * Adds mouse event handlers to a canvasControl so scrolling the mouse wheel emits zoom events
 * @param {CanvasControl} canvasControl - The canvas controller to apply mouse event handlers to.
 * @param {Object} options - Zoom event options
 * @param {boolean} [options.targeted] - If true, zooms in/out at mouse cursor. If false, zooms in/out at canvas center
 */
export function setupZoomEvents(canvasControl, options = {}) {
    canvasControl.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
        evt.preventDefault();

        const deltaY = evt.originalEvent.deltaY;
        if (deltaY === 0) return;

        const scaledDelta = Math.pow(ZOOM_SCROLL_FACTOR, -deltaY / 100);
        const target = options.targeted ? canvasControl.pointAtExternalXY(evt.offsetX, evt.offsetY) : undefined;

        eventBus.emit(EVENTS.CANVAS.ZOOM_DELTA, { delta: scaledDelta, target: target })
    });
}
