import ArrayRange from "../../utils/arrays.js";

const DEFAULT_STATE = {
    frames: [],
    currentIndex: 0,
    rangeSelection: null
};

const FRAME_DEFAULTS = {
    // id: value will be set on frame initialization

    ticks: 1
}

export const TICKS_OPTIONS = [0, 1, 2, 3, 4, 5, 10];

let state = {};
let idSequence = 0;

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        state = data;
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE);

    if (data.frames) {
        state.frames = data.frames.map(frame => $.extend(true, {}, FRAME_DEFAULTS, frame));
    }

    state.currentIndex = 0; // Do not import from data; always start at 0

    idSequence = Math.max(...state.frames.map(frame => frame.id), 0);
}

export function serialize() {
    return state;
}

export function frames() {
    return state.frames;
}

export function frameIndex() {
    return state.currentIndex;
}

export function changeFrameIndex(newIndex) {
    state.currentIndex = newIndex;
}

/**
 * Expands the frames array based on each frame's 'ticks' count (frame is repeated based on number of ticks).
 * @returns {Array} - A new array where each frame appears once per tick.
 */
export function expandedFrames() {
    const expanded = state.frames.flatMap(frame =>
        Array(frame.ticks).fill().map(() => {
            const { ticks, ...rest } = frame;
            return { ...rest }; // Remove 'ticks' attribute since it is no longer applicable
        })
    );

    // In the rare case all frame ticks are set to 0, return the current frame so that there is always at least 1 frame.
    return expanded.length ? expanded : [currentFrame()]
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
    const frame = $.extend(true, {}, FRAME_DEFAULTS, {
        id: ++idSequence
    }, data);

    state.frames.splice(index, 0, frame);

    return frame;
}

export function updateFrame(frame, updates) {
    $.extend(frame, updates);
}

export function duplicateFrames(range) {
    const mappings = [];
    range.iterate(frameIndex => {
        const originalFrame = state.frames[frameIndex];
        const dupFrame = $.extend(true, {}, originalFrame, {
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