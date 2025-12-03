import {callAction, registerAction} from "../../io/actions.js";
import {THEMES} from "../../config/preferences.js";
import {eventBus, EVENTS} from "../../events/events.js";
import {
    getComputedTheme, getDarkModePref, getTheme,
    setDarkModePref, setTheme, validateColorMode
} from "../../state/index.js";
import IconMenu from "../../components/icon_menu.js";
import {STRINGS} from "../../config/strings.js";

let themeMenu;

export function init() {
    Object.values(THEMES).forEach(theme => {
        const action = `themes.select.${theme}`;
        registerAction(action, {
            callback: () => {
                setTheme(theme);
                eventBus.emit(EVENTS.THEME.CHANGED);
            }
        });
    })

    themeMenu = new IconMenu($('#theme-button'), {
        dropdown: true,
        dropdownBtnClass: 'canvas-button',
        items: Object.values(THEMES).map(theme => {
            return {
                value: theme,
                icon: `themes.select.${theme}`,
                // tooltip: `themes.select.${theme}`,
                label: STRINGS[`themes.select.${theme}.name`],
            }
        }),
        onSelect: newValue => callAction(`themes.select.${newValue}`),
        getValue: () => getTheme(),
        dropdownClass: 'right-aligned'
    })

    setupOSPreference();
    setupEventBus();

    applyThemeToDocument();
}

function refresh() {
    themeMenu.refresh();
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())

    eventBus.on(EVENTS.THEME.CHANGED, () => {
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