import * as actions from "../../io/actions.js";
import {canRedo, canUndo, redo, undo} from "../../state/index.js";
import {eventBus, EVENTS} from "../../events/events.js";

let actionButtons;

export function init() {
    setupEventBus();

    actions.registerAction('state.undo', {
        callback: () => undo(),
        enabled: () => canUndo(),
    });

    actions.registerAction('state.redo', {
        callback: () => redo(),
        enabled: () => canRedo(),
    });

    actionButtons = actions.setupActionButtons($('#context-tools-bottom-left .edit-buttons'), {
        placement: 'top'
    })
}

export function refresh() {
    actionButtons.refreshContent();
}

function setupEventBus() {
    eventBus.on(
        [EVENTS.HISTORY.RECORDED, EVENTS.HISTORY.RESTORED],
        () => refresh()
    )
}