import {DEFAULT_COLOR} from "../features/palette.js";
import {getFormattedDateTime} from "../utils/strings.js";

const DEFAULT_STATE = {
    name: '',
    createdAt: undefined,
    fps: 6,
    grid: {
        show: true,
        minorGridEnabled: true,
        minorGridSpacing: 1,
        majorGridEnabled: true,
        majorGridSpacing: 5,
    },
    whitespace: false,
    onion: false,
    lockLayerVisibility: true,
    frameOrientation: 'left',
    minimizedComponents: {
        layers: true
    },
    tool: 'draw-freeform-ascii',
    primaryColor: DEFAULT_COLOR,
    brush: {
        shape: 'square',
        size: 1
    },
    drawRect: {
        type: 'printable-ascii-1'
    },
    drawLine: {
        type: 'basic'
    },
    lastExportOptions: {},
}

let state = {};

export function load(newState = {}) {
    state = $.extend(true, {}, DEFAULT_STATE, { createdAt: new Date().toISOString() }, newState);
}
export function replaceState(newState) {
    state = newState;
}
export function getState() {
    return state;
}

export function setConfig(key, newValue) {
    state[key] = newValue;
}

export function getConfig(key) {
    return state[key];
}

export function getName(includeDefaultTimestamp = true) {
    if (getConfig('name')) return getConfig('name');

    if (includeDefaultTimestamp) {
        let name = 'Untitled';
        let createdAt = new Date(getConfig('createdAt'));
        if (isNaN(createdAt.getTime())) createdAt = new Date();
        name += `-${getFormattedDateTime(createdAt)}`;
        return name;
    }
    else {
        return 'Untitled animation'
    }
}

export function isMinimized(componentKey) {
    return !!(getConfig('minimizedComponents') || {})[componentKey];
}