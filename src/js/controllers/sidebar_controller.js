import * as actions from "../io/actions.js";
import {STRINGS} from "../config/strings.js";
import {hideAll as hideAllTooltips} from "tippy.js";
import {eventBus, EVENTS} from "../events/events.js";
import Minimizer from "../components/minimizer.js";
import {setupActionButtons} from "../io/actions.js";
import {COMPONENT_KEYS} from "../config/preferences.js";

let minimizer, toggleComponentButton;

export function init() {
    minimizer = new Minimizer($('#side-content'), COMPONENT_KEYS.SIDEBAR, { fullyHide: true })
    setupActions();
}

export function resize() {
    minimizer.refresh();
    toggleComponentButton.refreshContent()
}

function setupActions() {
    actions.registerAction('sidebar.toggle-component', {
        callback: () => {
            minimizer.toggle();
            hideAllTooltips({ duration: 0 }); // Instantly hide tooltips to avoid flash in top-left corner
            eventBus.emit(EVENTS.RESIZE.ALL);
        },
        active: () => !minimizer.isMinimized
    });

    toggleComponentButton = setupActionButtons($('#context-tools-top-right'), {
        placement: 'bottom'
    })
}