import {eventBus, EVENTS} from "../events/events.js";

const DEFAULT_STATE = {
    chars: [],
    autoAddAscii: false,
    autoAddUnicode: true,
}

const SETTINGS = new Set(['autoAddAscii', 'autoAddUnicode'])

let state = {};
let unicodeCache = new Set();

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        state = data;
        unicodeCache = new Set(state.chars);
        return;
    }

    state = $.extend(true, {}, DEFAULT_STATE, data);
    importChars(data.chars || [])
}

export function serialize() {
    return state;
}

export function sortedChars() {
    return state.chars;
}

export function importChars(newChars) {
    unicodeCache = new Set(newChars); // Remove any dups
    state.chars = [...unicodeCache].filter(char => char.length === 1);
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
    if (char.length !== 1) return;

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