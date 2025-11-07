import {readGlobalSetting} from "../storage/local_storage.js";
import {eventBus, EVENTS} from "../events/events.js";

export const THEMES = {
    DARK_MODE: 'themes.dark-mode',
    LIGHT_MODE: 'themes.light-mode',
    OS: 'themes.os',
}

const DEFAULT_THEME = THEMES.DARK_MODE;

export let selectedTheme; // The theme choice selected by user (light/dark/OS)
export let computedTheme; // The resulting theme based on their selection and OS (will either be light or dark)
let prefersDarkMode;

export function recalculateTheme() {
    selectedTheme = readGlobalSetting('theme');
    if (!selectedTheme || !Object.values(THEMES).includes(selectedTheme)) {
        selectedTheme = DEFAULT_THEME;
    }

    computedTheme = selectedTheme;
    if (selectedTheme === THEMES.OS) {
        computedTheme = prefersDarkMode ? THEMES.DARK_MODE : THEMES.LIGHT_MODE;
    }
}

export function setupOSPreference() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (newPrefersDarkMode) => {
        if (newPrefersDarkMode !== prefersDarkMode) {
            prefersDarkMode = newPrefersDarkMode;
            eventBus.emit(EVENTS.THEME.CHANGED);
        }
    }

    // Handle theme changes that happen while tab is active
    mediaQuery.addEventListener('change', e => handleThemeChange(e.matches));

    // Handle theme changes that happened while tab was inactive (in case tab processing was paused)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') handleThemeChange(mediaQuery.matches)
    });

    // Initial theme
    prefersDarkMode = mediaQuery.matches;
}

export function applyThemeToDocument() {
    let themeAttr;
    switch(computedTheme) {
        case THEMES.DARK_MODE:
            themeAttr = 'dark';
            break;
        case THEMES.LIGHT_MODE:
            themeAttr = 'light';
            break;
        default:
            console.warn(`Invalid computedTheme: ${computedTheme}`);
    }

    document.documentElement.setAttribute("data-theme", themeAttr);
}