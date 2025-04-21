import ArrayRange from "../../utils/arrays.js";

const DEFAULT_STATE = {
    frames: [],
    currentIndex: 0,
    rangeSelection: null
};

const FRAME_DEFAULTS = {}

let state = {};
let idSequence = 0;

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE);

    if (newState.frames) {
        state.frames = newState.frames.map(frame => $.extend(true, {}, FRAME_DEFAULTS, frame));
    }

    state.currentIndex = 0; // Do not import from newState; always start at 0

    idSequence = Math.max(...state.frames.map(frame => frame.id), 0);
}
export function replaceState(newState) {
    state = newState;
}
export function getState() {
    return state;
}

export function frames() {
    return state.frames;
}

export function frameIndex(newIndex) {
    if (newIndex !== undefined) state.currentIndex = newIndex;
    return state.currentIndex;
}

/**
 * Gets and/or sets the frameRangeSelection.
 * @param {ArrayRange|null} [newRange] - If defined, will set the current rangeSelection. A value of null means the
 *   frameRangeSelection will match the currently selected frameIndex().
 * @returns {ArrayRange}
 */
export function frameRangeSelection(newRange) {
    if (newRange !== undefined) state.rangeSelection = newRange ? newRange.serialize() : null;
    return state.rangeSelection ? ArrayRange.deserialize(state.rangeSelection) : ArrayRange.fromSingleIndex(frameIndex());
}

export function extendFrameRangeSelection(index) {
    frameRangeSelection(frameRangeSelection().extendTo(index));
}

export function currentFrame() {
    return state.frames[frameIndex()];
}

export function previousFrame() {
    let index = frameIndex();
    index -= 1;
    if (index < 0) { index = frames().length - 1; }
    return state.frames[index];
}

export function createFrame(index, data) {
    const frame = $.extend({}, FRAME_DEFAULTS, {
        id: ++idSequence
    }, data);

    state.frames.splice(index, 0, frame);

    return frame;
}

export function duplicateFrames(range) {
    const mappings = [];
    range.iterate(frameIndex => {
        const originalFrame = state.frames[frameIndex];
        const dupFrame = $.extend({}, originalFrame, {
            id: ++idSequence
        });
        mappings.push({ originalFrame, dupFrame })
    });
    state.frames.splice(range.startIndex, 0, ...mappings.map(mapping => mapping.dupFrame));

    return mappings;
}

export function deleteFrames(range) {
    state.frames.splice(range.startIndex, range.length);
}

export function reorderFrames(oldRange, newIndex) {
    state.frames.splice(newIndex, 0, ...state.frames.splice(oldRange.startIndex, oldRange.length));
}

export function reverseFrames(range) {
    let start = range.startIndex;
    let end = range.endIndex;

    while (start < end) {
        // Swap elements at start and end
        [state.frames[start], state.frames[end]] = [state.frames[end], state.frames[start]];
        start++;
        end--;
    }
}