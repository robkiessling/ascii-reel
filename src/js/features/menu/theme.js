import {registerAction} from "../../io/actions.js";
import {currentTheme, THEMES} from "../../config/theme.js";
import {recalculateBGColors} from "../../config/background.js";
import {saveGlobalSetting} from "../../storage/local_storage.js";
import {eventBus, EVENTS} from "../../events/events.js";

export function init() {
    registerThemeAction('theme.system', 'system');
    registerThemeAction('theme.light', 'light');
    registerThemeAction('theme.dark', 'dark');

    refresh(false);

    setupEventBus();
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

function refresh(redrawCanvas = false) {
    const theme = currentTheme(true);

    let themeName = theme.name;
    if (themeName === THEMES.system.name) {
        // Detect OS preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        themeName = prefersDark ? THEMES.dark.name : THEMES.light.name
    }
    document.documentElement.setAttribute("data-theme", themeName);

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