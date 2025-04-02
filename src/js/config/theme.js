import {readGlobalSetting} from "../storage/local_storage.js";

export const THEMES = {
    system: { name: 'system', remixicon: 'ri-contrast-line' },
    dark: { name: 'dark', remixicon: 'ri-moon-line' },
    light: { name: 'light', remixicon: 'ri-sun-line' },
}

let cachedTheme;

export function currentTheme(reload = false) {
    if (reload) cachedTheme = null;

    if (!cachedTheme) {
        const storedTheme = readGlobalSetting('theme');

        if (storedTheme && Object.keys(THEMES).includes(storedTheme)) {
            cachedTheme = THEMES[storedTheme];
        }
        else {
            // Default: system
            cachedTheme = THEMES.system;
        }
    }

    return cachedTheme;
}

