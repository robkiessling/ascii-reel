import {refreshComponentVisibility, toggleComponent} from "../utils/components.js";
import * as actions from "../io/actions.js";
import {STRINGS} from "../config/strings.js";
import * as state from "../state/index.js";
import {hideAll as hideAllTooltips} from "tippy.js";
import {eventBus, EVENTS} from "../events/events.js";

let actionButtonsWhileOpen, actionButtonsWhileClosed;

export function init() {
    setupActionButtons();
}

export function resize() {
    refreshComponentVisibility($('#side-content'), 'sidebar');

    actionButtonsWhileOpen.refreshContent()
    actionButtonsWhileClosed.refreshContent()
}

function setupActionButtons() {
    actions.registerAction('sidebar.toggle-component', {
        name: () => STRINGS[state.isMinimized('sidebar') ? 'sidebar.show-component.name' : 'sidebar.hide-component.name'],
        description: () => STRINGS[state.isMinimized('sidebar') ? 'sidebar.show-component.description' : 'sidebar.hide-component.description'],
        callback: () => {
            toggleComponent('sidebar');
            hideAllTooltips({ duration: 0 }); // Instantly hide tooltips to avoid flash in top-left corner
            eventBus.emit(EVENTS.RESIZE.ALL);
        },
        icon: () => {
            return `ri ri-fw ri-sidebar-unfold-line ${state.isMinimized('sidebar') ? 'rotate180 active' : ''}`
        }
    });

    actionButtonsWhileOpen = actions.setupActionButtons($('#sidebar-details'), {
        placement: 'top'
    })
    actionButtonsWhileClosed = actions.setupActionButtons($('#maximize-side-content'), {
        placement: 'top'
    })
}