import {registerAction} from "../../io/actions.js";
import {currentTheme, THEMES} from "../../config/theme.js";
import {recalculateBGColors} from "../../config/background.js";
import {saveGlobalSetting} from "../../storage/local_storage.js";
import {eventBus, EVENTS} from "../../events/events.js";

export function init() {
    registerThemeAction('theme.system', 'system');
    registerThemeAction('theme.light', 'light');
    registerThemeAction('theme.dark', 'dark');

    setupOSPreference();
    setupEventBus();

    refresh(false); // Initial theme css (no need to redraw canvas, it will be loaded later)
}

function registerThemeAction(actionName, themeName) {
    registerAction(actionName, {
        icon: THEMES[themeName].remixicon,
        callback: () => {
            saveGlobalSetting('theme', themeName);
            refresh(true);
        }
    });
}

let prefersDarkMode;

function setupOSPreference() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Detect changes if user changes preference on OS
    mediaQuery.addEventListener('change', e => {
        prefersDarkMode = e.matches;
        refresh(true);
    });

    // Initial preference
    prefersDarkMode = mediaQuery.matches;
}

function refresh(redrawCanvas = false) {
    const theme = currentTheme(true);

    let resolvedTheme = theme.name;
    if (resolvedTheme === THEMES.system.name) resolvedTheme = prefersDarkMode ? THEMES.dark.name : THEMES.light.name;
    document.documentElement.setAttribute("data-theme", resolvedTheme);

    $('#right-menu').find('.current-theme')
        .removeClass(Object.values(THEMES).map(theme => theme.remixicon).join(' '))
        .addClass(theme.remixicon)

    if (redrawCanvas) {
        // checkerboard background may have changed, so refresh canvas & grid
        recalculateBGColors();
        eventBus.emit(EVENTS.REFRESH.ALL);
    }
}

function setupEventBus() {
    eventBus.on(EVENTS.THEME.CHANGED, () => refresh(true))
}