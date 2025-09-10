import {registerAction} from "../../io/actions.js";
import {applyThemeToDocument, recalculateTheme, selectedTheme, setupOSPreference, THEMES} from "../../config/theme.js";
import {saveGlobalSetting} from "../../storage/local_storage.js";
import {eventBus, EVENTS} from "../../events/events.js";
import {getIconClass, getIconHTML} from "../../config/icons.js";

export function init() {
    registerThemeAction('themes.select-os', THEMES.OS);
    registerThemeAction('themes.select-light-mode', THEMES.LIGHT_MODE);
    registerThemeAction('themes.select-dark-mode', THEMES.DARK_MODE);

    setupOSPreference();
    setupEventBus();

    recalculateTheme();
    applyThemeToDocument();
}

function registerThemeAction(actionName, theme) {
    registerAction(actionName, {
        icon: getIconClass(theme),
        callback: () => {
            saveGlobalSetting('theme', theme);
            eventBus.emit(EVENTS.THEME.CHANGED);
        }
    });
}

function refresh() {
    $('#right-menu').find('.current-theme').html(getIconHTML(selectedTheme))
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())
}