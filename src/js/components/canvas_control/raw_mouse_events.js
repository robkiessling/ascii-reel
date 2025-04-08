import {eventBus, EVENTS} from "../../events/events.js";
import {getConfig} from "../../state/index.js";

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
            tool: getConfig('tool'),
            canvasControl: canvasControl,
        })
    }

    canvasControl.$canvas.on('mousedown', evt => _emitEvent(EVENTS.CANVAS.MOUSEDOWN, evt));
    canvasControl.$canvas.on('mousemove', evt => _emitEvent(EVENTS.CANVAS.MOUSEMOVE, evt));
    $(document).on('mouseup', evt => _emitEvent(EVENTS.CANVAS.MOUSEUP, evt));
    canvasControl.$canvas.on('dblclick', evt => _emitEvent(EVENTS.CANVAS.DBLCLICK, evt));
}

