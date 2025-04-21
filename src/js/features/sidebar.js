import * as actions from "../io/actions.js";
import {STRINGS} from "../config/strings.js";
import {hideAll as hideAllTooltips} from "tippy.js";
import {eventBus, EVENTS} from "../events/events.js";
import Minimizer from "../components/minimizer.js";

let actionButtonsWhileOpen, actionButtonsWhileClosed;
let minimizer;

export function init() {
    minimizer = new Minimizer($('#side-content'), 'sidebar')
    setupActionButtons();
}

export function resize() {
    minimizer.refresh();

    actionButtonsWhileOpen.refreshContent()
    actionButtonsWhileClosed.refreshContent()
}

function setupActionButtons() {
    actions.registerAction('sidebar.toggle-component', {
        name: () => STRINGS[minimizer.isMinimized ? 'sidebar.show-component.name' : 'sidebar.hide-component.name'],
        description: () => STRINGS[minimizer.isMinimized ? 'sidebar.show-component.description' : 'sidebar.hide-component.description'],
        callback: () => {
            minimizer.toggle();
            hideAllTooltips({ duration: 0 }); // Instantly hide tooltips to avoid flash in top-left corner
            eventBus.emit(EVENTS.RESIZE.ALL);
        },
        icon: () => {
            return `ri ri-fw ri-sidebar-unfold-line ${minimizer.isMinimized ? 'rotate180 active' : ''}`
        }
    });

    actionButtonsWhileOpen = actions.setupActionButtons($('#sidebar-details'), {
        placement: 'top'
    })
    actionButtonsWhileClosed = actions.setupActionButtons($('#maximize-side-content'), {
        placement: 'top'
    })
}