import {THEMES} from "../config/themes.js";
import {readGlobalSetting, saveGlobalSetting} from "../storage/local_storage.js";
import {resetCachedCanvasColors} from "./config.js";

const DEFAULT_THEME = THEMES.OS;
let selectedTheme, computedTheme, prefersDarkMode;

export function recalculateTheme() {
    selectedTheme = readGlobalSetting('theme');
    if (!selectedTheme || !Object.values(THEMES).includes(selectedTheme)) {
        selectedTheme = DEFAULT_THEME;
    }

    computedTheme = selectedTheme;
    if (computedTheme === THEMES.OS) {
        computedTheme = prefersDarkMode ? THEMES.DARK_MODE : THEMES.LIGHT_MODE;
    }

    resetCachedCanvasColors();
}

export function getDarkModePref() {
    return prefersDarkMode;
}
export function setDarkModePref(newDarkModePref) {
    prefersDarkMode = newDarkModePref;
}

export function setTheme(theme) {
    saveGlobalSetting('theme', theme);
}

// The theme choice selected by user (light/dark/OS)
export function getTheme() {
    return selectedTheme;
}

// The resulting theme based on their selection and OS (will either be light or dark)
export function getComputedTheme() {
    return computedTheme;
}