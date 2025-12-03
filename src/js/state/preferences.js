import {COMPONENT_KEYS, FRAME_ORIENTATIONS, GLOBAL_SETTINGS, THEMES} from "../config/preferences.js";
import {readGlobalSetting, saveGlobalSetting} from "../storage/local_storage.js";

// ------------------------------------------------------ Themes

const DEFAULT_THEME = THEMES.SYSTEM;

let prefersDarkMode;

export function getDarkModePref() {
    return prefersDarkMode;
}
export function setDarkModePref(newDarkModePref) {
    prefersDarkMode = newDarkModePref;
}

export function setTheme(theme) {
    saveGlobalSetting(GLOBAL_SETTINGS.THEME, theme);
}

// The theme choice selected by user (light/dark/OS)
export function getTheme() {
    let theme = readGlobalSetting(GLOBAL_SETTINGS.THEME);
    if (!theme || !Object.values(THEMES).includes(theme)) theme = DEFAULT_THEME;
    return theme;
}

// The resulting theme based on their selection and OS (will either be light or dark)
export function getComputedTheme() {
    let computedTheme = getTheme();
    if (computedTheme === THEMES.SYSTEM) computedTheme = prefersDarkMode ? THEMES.DARK_MODE : THEMES.LIGHT_MODE;
    return computedTheme;
}

// ------------------------------------------------------ Panels

const DEFAULT_MINIMIZED_COMPONENTS = {
    [COMPONENT_KEYS.FRAMES]: true,

    [COMPONENT_KEYS.SIDEBAR]: true,

    [COMPONENT_KEYS.PREVIEW]: false,
    [COMPONENT_KEYS.LAYERS]: false,
    [COMPONENT_KEYS.PALETTE]: false,
    [COMPONENT_KEYS.UNICODE]: false,
}

export function isMinimizedComponent(componentKey) {
    const minimizedComponents = readGlobalSetting(GLOBAL_SETTINGS.MINIMIZED_COMPONENTS) || {};
    let minimized = minimizedComponents[componentKey];
    if (minimized === undefined) minimized = DEFAULT_MINIMIZED_COMPONENTS[componentKey];
    return !!minimized;
}

export function setMinimizedComponent(componentKey, minimized) {
    const minimizedComponents = readGlobalSetting(GLOBAL_SETTINGS.MINIMIZED_COMPONENTS) || {};
    minimizedComponents[componentKey] = minimized === undefined ? !isMinimizedComponent(componentKey) : minimized;
    saveGlobalSetting(GLOBAL_SETTINGS.MINIMIZED_COMPONENTS, minimizedComponents);
}


const DEFAULT_FRAME_ORIENTATION = FRAME_ORIENTATIONS.BOTTOM;

export function getFramesOrientation() {
    return readGlobalSetting(GLOBAL_SETTINGS.FRAME_ORIENTATION) || DEFAULT_FRAME_ORIENTATION;
}

export function setFramesOrientation(orientation) {
    saveGlobalSetting(GLOBAL_SETTINGS.FRAME_ORIENTATION, orientation);
}