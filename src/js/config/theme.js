import {readGlobalSetting, saveGlobalSetting} from "../state/localstorage.js";
import {triggerRefresh} from "../index.js";
import {recalculateBGColors} from "../canvas/background.js";
import tippy from "tippy.js";

export const THEMES = {
    dark: { name: 'dark', remixicon: 'ri-moon-line', nextTheme: 'light' },
    light: { name: 'light', remixicon: 'ri-sun-line', nextTheme: 'dark' },
}

let cachedTheme;

export function init() {
    setupThemeButton()
    refresh();
}

function setupThemeButton() {
    const $themeButton =$('#theme-button');
    $themeButton.off('click').on('click', () => {
        saveGlobalSetting('theme', currentTheme(true).nextTheme);
        refresh(true);
    })

    tippy($themeButton.get(0), {
        content: () => `Toggle Dark-Mode`,
        placement: 'left'
    })
}

export function currentTheme(reload = false) {
    if (reload) cachedTheme = null;

    if (!cachedTheme) {
        const storedTheme = readGlobalSetting('theme');

        if (storedTheme && Object.keys(THEMES).includes(storedTheme)) {
            cachedTheme = THEMES[storedTheme];
        }
        else {
            // Set initial value by detecting system preference:
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            cachedTheme = prefersDark ? THEMES.dark : THEMES.light

            // Or, always start with dark:
            // cachedTheme = THEMES.dark;
        }
    }

    return cachedTheme;
}

export function refresh(redrawCanvas = false) {
    const theme = currentTheme(true);

    document.documentElement.setAttribute("data-theme", theme.name);

    $('#theme-button').find('span')
        .removeClass(`${THEMES.dark.remixicon} ${THEMES.light.remixicon}`)
        .addClass(theme.remixicon);

    if (redrawCanvas) {
        // checkerboard background may have changed, so refresh canvas & grid
        recalculateBGColors();
        triggerRefresh();
    }
}


