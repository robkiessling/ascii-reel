import {registerAction} from "../../io/actions.js";
import {THEMES} from "../../config/themes.js";
import {eventBus, EVENTS} from "../../events/events.js";
import {getIconClass, getIconHTML} from "../../config/icons.js";
import {
    getComputedTheme, getDarkModePref, getTheme, resetCachedCanvasColors,
    recalculateTheme, setDarkModePref, setTheme, validateColorMode
} from "../../state/index.js";

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
            setTheme(theme);
            eventBus.emit(EVENTS.THEME.CHANGED);
        }
    });
}

function refresh() {
    $('#right-menu').find('.current-theme').html(getIconHTML(getTheme()))
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())

    eventBus.on(EVENTS.THEME.CHANGED, () => {
        recalculateTheme();
        validateColorMode();
        applyThemeToDocument();
        eventBus.emit(EVENTS.REFRESH.ALL);
    })

}

// Sets up event handlers to listen to the user's dark-mode / light-mode OS preference
function setupOSPreference() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (newDarkModePref) => {
        if (newDarkModePref !== getDarkModePref()) {
            setDarkModePref(newDarkModePref);
            eventBus.emit(EVENTS.THEME.CHANGED);
        }
    }

    // Handle theme changes that happen while tab is active
    mediaQuery.addEventListener('change', e => handleThemeChange(e.matches));

    // Handle theme changes that happened while tab was inactive (in case tab processing was paused)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') handleThemeChange(mediaQuery.matches)
    });

    // Initial preference
    setDarkModePref(mediaQuery.matches);
}

// Adds an attribute to document for css selectors to use
function applyThemeToDocument() {
    let themeAttr;
    switch(getComputedTheme()) {
        case THEMES.DARK_MODE:
            themeAttr = 'dark';
            break;
        case THEMES.LIGHT_MODE:
            themeAttr = 'light';
            break;
        default:
            console.warn(`Invalid computedTheme: ${getComputedTheme()}`);
    }

    document.documentElement.setAttribute("data-theme", themeAttr);
}