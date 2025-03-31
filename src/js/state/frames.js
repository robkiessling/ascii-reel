import ArrayRange from "../utils/arrays.js";
import {layers} from "./layers.js";
import {cel, celIdsForFrame, createCel, deleteCel} from "./cels.js";

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
 * @param {ArrayRange|null} [newRange] A value of null means the frameRangeSelection will match the currently selected frameIndex().
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

    // create blank cels for all layers
    layers().forEach(layer => createCel(layer, frame));
}

export function duplicateFrames(range) {
    const newFrames = [];
    range.iterate(frameIndex => {
        const originalFrame = state.frames[frameIndex];
        const newFrame = $.extend({}, originalFrame, {
            id: ++idSequence
        });
        newFrames.push(newFrame);
        layers().forEach(layer => {
            const originalCel = cel(layer, originalFrame);
            createCel(layer, newFrame, originalCel);
        });
    });
    state.frames.splice(range.startIndex, 0, ...newFrames);
}

export function deleteFrames(range) {
    range.iterate(frameIndex => {
        celIdsForFrame(state.frames[frameIndex]).forEach(celId => deleteCel(celId));
    });
    state.frames.splice(range.startIndex, range.length);
}

export function reorderFrames(oldRange, newIndex) {
    state.frames.splice(newIndex, 0, ...state.frames.splice(oldRange.startIndex, oldRange.length));
}

// Ensure at least 1 frame
export function validate() {
    if (state.frames.length === 0) {
        console.warn(`No frames found; creating new frame`)
        createFrame(0)
    }
}
