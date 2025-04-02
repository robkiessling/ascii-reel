
import { EventEmitter } from 'events';

/**
 * Global Event Bus for app-wide events. It allows different parts of the app to communicate without direct references.
 *
 * This EventEmitter is used to broadcast and listen to events related to:
 * - State changes (e.g. frames, layers, cels)
 * - Transient UI state (e.g. selection changes, zoom level)
 *
 * eventBus.emit() is similar to EventEmitter's emit(), except:
 *   - Only supports ONE event arg (in addition to the event name). If provided, this is typically an object. For event
 *     data I've found named object attributes to be more robust than positional parameters.
 * eventBus.on() is similar to EventEmitter's on(), with some added features:
 *   - The eventName can be an array of strings (or just a single string, as normal)
 *   - There is a 3rd argument for `priority`. Listeners are always executed in priority order (highest to lowest),
 *     regardless of the order they were attached.
 */
export const eventBus = {
    emit: (eventName, data = {}) => emitter.emit(eventName, data), // Intentionally passing just one `data` arg (not `...args`)
    on: (eventNameOrNames, handler, priority = 0) => {
        if (Array.isArray(eventNameOrNames)) {
            eventNameOrNames.forEach(eventName => addListener(eventName, handler, priority))
        }
        else {
            addListener(eventNameOrNames, handler, priority);
        }
    },
    off: (eventNameOrNames, handler) => {
        if (Array.isArray(eventNameOrNames)) {
            eventNameOrNames.forEach(eventName => removeListener(eventName, handler))
        }
        else {
            removeListener(eventNameOrNames, handler);
        }
    },
    // once: (eventName, handler, priority = 0) => {
    //     const wrapper = (...args) => {
    //         handler(...args);
    //         eventBus.off(eventName, wrapper);
    //     };
    //     eventBus.on(eventName, wrapper, priority);
    // },
}

const emitter = new EventEmitter();
const priorityListeners = new Map();

// Supports adding event listeners with varying priority (higher priority listeners are always executed first)
function addListener(eventName, handler, priority) {
    if (!priorityListeners.has(eventName)) {
        priorityListeners.set(eventName, []);
        emitter.on(eventName, (...args) => {
            const listeners = priorityListeners.get(eventName) || [];
            listeners.forEach(({ handler }) => handler(...args));
        });
    }

    const orderedListeners = priorityListeners.get(eventName);
    orderedListeners.push({ handler, priority });
    orderedListeners.sort((a, b) => b.priority - a.priority);
}

function removeListener(eventName, handler) {
    const orderedListeners = priorityListeners.get(eventName) || [];
    priorityListeners.set(
        eventName,
        orderedListeners.filter(listener => listener.handler !== handler)
    );
}


export const EVENTS = {
    REFRESH: {
        ALL: 'refresh:all',
        CURRENT_FRAME: 'refresh:current-frame'
    },
    RESIZE: {
        /**
         * Event data: { clearSelection: boolean, resetZoom: boolean }
         * - clearSelection: If true, the selection will be cleared
         * - resetZoom: If true, the canvas will be zoomed all the way out
         * */
        ALL: 'resize:all'
    },
    SELECTION: {
        CHANGED: 'selection:changed',
        CURSOR_MOVED: 'selection:cursor-moved'
    },
    CANVAS: {
        ZOOM_DELTA: 'canvas:zoom-delta', /* Event data: { delta, target } */
        ZOOM_TO_FIT: 'canvas:zoom-to-fit',
        PAN_DELTA: 'canvas:pan-delta', /* Event data: { delta } */
        PAN_TO_TARGET: 'canvas:pan-to-target', /* Event data: { target } */

        /* Event data: { mouseEvent, cell, tool, canvasControl } */
        MOUSEDOWN: 'canvas:mousedown',
        MOUSEMOVE: 'canvas:mousemove',
        MOUSEUP: 'canvas:mouseup',
        DBLCLICK: 'canvas:dblclick',

        HOVERED: 'canvas:hovered', /* Event data: { cell } */
        HOVER_END: 'canvas:hover-end'
    },
    ZOOM: {
        ZOOMED: 'zoom:zoomed'
    },
    EDITOR: {
        COLOR_ADDED: 'editor:color-added',
        COLOR_CHANGED: 'editor:color-changed',
    },
    ACTIONS: {
        PERFORMED: 'actions:performed'
    },
    MENU: {
        CHANGED: 'menu:changed'
    },
    FILE: {
        CHANGED: 'file:changed'
    },
    HISTORY: {
        CHANGED: 'history:changed'
    },
    THEME: {
        CHANGED: 'theme:changed',
    }
}

