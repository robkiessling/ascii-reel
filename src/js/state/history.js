import * as actions from "../io/actions.js";
import {getConfig} from "./config.js";
import Cell from "../geometry/cell.js";
import {moveCursorTo} from "../canvas/selection.js";
import {calculateFontRatio} from "../canvas/font.js";
import {triggerRefresh, triggerResize} from "../index.js";
import {getState as getConfigState, replaceState as replaceConfigState} from "./config.js";
import {getState as getTimelineState, replaceState as replaceTimelineState} from "./timeline/index.js";
import {getState as getPaletteState, replaceState as replacePaletteState} from "./palette.js";
import {getMetadata} from "./metadata.js";


// -------------------------------------------------------------------------------- History (undo / redo)
// Implementing undo/redo using the memento pattern https://en.wikipedia.org/wiki/Memento_pattern

let history;
let historyIndex;
const MAX_HISTORY = 30; // Max number of states to remember in the history. Increasing this value will use more memory.

export function reset() {
    history = [];
    historyIndex = undefined;
}

export function hasHistory() {
    return history.length > 1;
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
 * @param {boolean} [options.requiresCalculateFontRatio] - If true, undoing/redoing to this slice will force the canvas
 *   fontRatio to be recalculated. Only needed if font is changed.
 */
export function pushHistory(options = {}) {
    // console.log('pushHistory', historyIndex, options);

    // Remove anything in the future (all "redo" states are removed)
    if (historyIndex !== undefined) {
        history.splice(historyIndex + 1, history.length);
    }

    // The snapshot to be saved in the history
    const snapshot = buildHistorySnapshot(options);

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

// We only want to save a subset of the config state to history: certain things like what tool is selected, or whether
// the grid is showing, should not be part of the "undo" sequence.
function buildHistorySnapshot(options) {
    const historyState = $.extend(
        true,
        {},
        { config: getConfigState() },
        { timeline: getTimelineState() },
        { palette: getPaletteState() },
        // intentionally not storing metadata to history
    );

    return {
        state: historyState,
        options: options,
    }
}

// We are deep merging the config into our current state config, and replacing everything else.
// That way certain settings (e.g. what tool is selected) is inherited from the current state
function loadHistorySnapshot(snapshot) {
    replaceConfigState($.extend(true, {}, snapshot.state.config));
    replaceTimelineState($.extend(true, {}, snapshot.state.timeline));
    replacePaletteState($.extend(true, {}, snapshot.state.palette));
    // intentionally not loading metadata from history
}

function loadStateFromHistory(newIndex, oldIndex) {
    const newState = history[newIndex];
    const oldState = history[oldIndex];

    loadHistorySnapshot(newState);

    const cursorCell = Cell.deserialize(getConfig('cursorPosition'));
    if (getMetadata('tool') === 'text-editor' && cursorCell) {
        moveCursorTo(cursorCell, false)
    }

    if (newState.options.requiresCalculateFontRatio || oldState.options.requiresCalculateFontRatio) {
        calculateFontRatio();
    }

    if (newState.options.requiresResize || oldState.options.requiresResize) {
        triggerResize({ clearSelection: true, resetZoom: true });
    }
    else {
        triggerRefresh();
    }
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
        callback(history[historyIndex])
    }
}
