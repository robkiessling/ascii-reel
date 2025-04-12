import {eventBus, EVENTS} from "../events/events.js";

const DEFAULT_STATE = {
    chars: [],
    autoAddAscii: false,
    autoAddUnicode: true,
}

const SETTINGS = new Set(['autoAddAscii', 'autoAddUnicode'])

let state = {};
let unicodeCache = new Set();

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE, newState);
    importChars(newState.chars || [])
}
export function replaceState(newState) {
    state = newState;
    unicodeCache = new Set(state.chars);
}
export function getState() {
    return state;
}

export function sortedChars() {
    return state.chars;
}

export function importChars(newChars) {
    unicodeCache = new Set(newChars); // Remove any dups
    state.chars = [...unicodeCache];
    eventBus.emit(EVENTS.UNICODE.CHANGED);
}

export function setUnicodeSetting(key, value) {
    if (!SETTINGS.has(key)) {
        console.warn(`${key} is not a unicode setting`)
        return;
    }
    state[key] = value;
}
export function getUnicodeSetting(key) {
    if (!SETTINGS.has(key)) {
        console.warn(`${key} is not a unicode setting`)
        return;
    }
    return state[key];
}

export function addToCache(char) {
    if (char.charCodeAt(0) < 128) {
        if (!state.autoAddAscii) return;
    }
    else {
        if (!state.autoAddUnicode) return;
    }

    if (!unicodeCache.has(char)) {
        unicodeCache.add(char);
        state.chars = [...unicodeCache];
        eventBus.emit(EVENTS.UNICODE.CHANGED);
    }
}