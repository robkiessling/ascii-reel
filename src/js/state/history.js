import * as actions from "../io/actions.js";
import {getStateForHistory as getConfigState, updateStateFromHistory as updateConfigState} from "./config.js";
import {getState as getTimelineState, replaceState as replaceTimelineState, hasCharContent} from "./timeline/index.js";
import {getState as getPaletteState, replaceState as replacePaletteState} from "./palette.js";
import {getState as getUnicodeState, replaceState as replaceUnicodeState} from "./unicode.js";
import {eventBus, EVENTS} from '../events/events.js'


// -------------------------------------------------------------------------------- History (undo / redo)
// Implementing undo/redo using the memento pattern https://en.wikipedia.org/wiki/Memento_pattern

let history; // History stack (of state snapshots)
let historyIndex; // Current index in history stack

const MAX_HISTORY = 30; // Max number of states to remember in the history. Increasing this value will use more memory.

export function reset() {
    history = [];
    historyIndex = undefined;
}

export function setupActions() {
    actions.registerAction('state.undo', {
        callback: () => undo(),
        enabled: () => canUndo(),
    });

    actions.registerAction('state.redo', {
        callback: () => redo(),
        enabled: () => canRedo(),
    });
}

/**
 * Adds the current state of the app as a new slice of the history.
 * @param {Object} options - Configuration options
 * @param {string} [options.modifiable] - If provided, further calls to pushHistory with the same `modifiable` string
 *   will update the latest history slice instead of adding a new slice. This is used for things like typing, where
 *   we don't want each new character to be a new slice.
 * @param {boolean} [options.requiresResize] - If true, undoing/redoing to this slice will force the canvas to be resized.
 * @param {boolean} [options.recalculateFont] - If true, undoing/redoing to this slice will recalculate the fontRatio.
 * @param {boolean} [options.recalculateColors] - If true, undoing/redoing to this slice will recalculate the canvas colors.
 */
export function pushHistory(options = {}) {
    // Remove anything in the future (all "redo" states are removed)
    if (historyIndex !== undefined) history.splice(historyIndex + 1, history.length);

    // Build the snapshot to be saved in the history
    const snapshot = {
        state: $.extend(true, {},
            { config: getConfigState() },
            { timeline: getTimelineState() },
            { palette: getPaletteState() },
            { unicode: getUnicodeState() },
        ),
        options: options,
    };

    // If modifiable option is a match, we just update the current slice and return
    if (history.length && options.modifiable && options.modifiable === history[historyIndex].options.modifiable) {
        history[historyIndex] = snapshot;
        return;
    }

    endHistoryModification();

    history.push(snapshot);
    historyIndex = historyIndex === undefined ? 0 : historyIndex + 1;

    // Limit history length
    if (history.length > MAX_HISTORY) {
        history.shift();
        historyIndex -= 1;
    }
}

function loadStateFromHistory(newIndex, oldIndex) {
    eventBus.emit(EVENTS.HISTORY.BEFORE_CHANGE);

    const newState = history[newIndex];
    const oldState = history[oldIndex];

    updateConfigState(structuredClone(newState.state.config));
    replaceTimelineState(structuredClone(newState.state.timeline));
    replacePaletteState(structuredClone(newState.state.palette));
    replaceUnicodeState(structuredClone(newState.state.unicode));

    // When emitting, include any options that were true in either the newState or the oldState:
    const trueOptions = Object.fromEntries(
        Array.from(new Set([...Object.keys(newState.options), ...Object.keys(oldState.options)]))
            .filter(key => newState.options[key] || oldState.options[key])
            .map(key => [key, true])
    );

    eventBus.emit(EVENTS.HISTORY.CHANGED, trueOptions);
}

function canUndo() {
    return historyIndex > 0;
}

function undo() {
    if (canUndo()) {
        endHistoryModification();
        loadStateFromHistory(historyIndex - 1, historyIndex);
        historyIndex -= 1;
    }
}

function canRedo() {
    return historyIndex < history.length - 1;
}

function redo() {
    if (canRedo()) {
        loadStateFromHistory(historyIndex + 1, historyIndex);
        historyIndex += 1;
    }
}

// Ends further modifications to the current history slice. See pushHistory for more info.
export function endHistoryModification() {
    if (history.length) {
        history[historyIndex].options.modifiable = undefined;
    }
}

// Modifies the current history slice
export function modifyHistory(callback) {
    if (history.length) {
        callback(history[historyIndex].state)
    }
}

// -------------------------------------------------------------------------------- Dirty / Clean
// Tracks whether the document has unsaved edits. If dirty, a warning is shown before opening a new file.
// After reload, the document is dirty by default since history is wiped. Blank documents are always considered clean.

// Returns true if there are unsaved changes
export function isDirty() {
    return !history[historyIndex].isSavedMarker && hasCharContent();
}

export function markClean() {
    history.forEach(slice => {
        slice.isSavedMarker = false;
    })
    history[historyIndex].isSavedMarker = true;
}
