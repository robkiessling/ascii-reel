import * as state from "../../state/index.js";
import * as actions from "../../io/actions.js";
import {strings} from "../../config/strings.js";
import {createDialog} from "../../utils/dialogs.js";
import {canZoomIn, canZoomOut} from "../main_canvas.js";
import {eventBus, EVENTS} from "../../events/events.js";

const GRID_SPACING_LIMITS = [1, 1000];

export function init() {
    setupGridToggle();
    setupGridDialog();
    setupWhitespaceToggle();

    actions.registerAction('view.zoom-in', {
        callback: () => eventBus.emit(EVENTS.CANVAS.ZOOM_DELTA, { delta: 2 }),
        enabled: () => canZoomIn(),
    });
    actions.registerAction('view.zoom-out', {
        callback: () => eventBus.emit(EVENTS.CANVAS.ZOOM_DELTA, { delta: 0.5 }),
        enabled: () => canZoomOut(),
    });
    actions.registerAction('view.zoom-fit', {
        callback: () => eventBus.emit(EVENTS.CANVAS.ZOOM_TO_FIT, { delta: 0.5 }),
    });
}



let $gridDialog, minorGridSettings, majorGridSettings;

function setupGridToggle() {
    actions.registerAction('view.toggle-grid', {
        name: () => state.getConfig('grid').show ? strings['view.hide-grid.name'] : strings['view.show-grid.name'],
        callback: () => {
            let grid = $.extend({}, state.getConfig('grid'));
            grid.show = !grid.show;
            state.setConfig('grid', grid);
            eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
        }
    });
}

function setupGridDialog() {
    $gridDialog = $('#grid-dialog');

    majorGridSettings = new GridSettings($('#major-grid-settings'), 'majorGridEnabled', 'majorGridSpacing');
    minorGridSettings = new GridSettings($('#minor-grid-settings'), 'minorGridEnabled', 'minorGridSpacing');

    createDialog($gridDialog, () => {
        if (!majorGridSettings.checkValidity() || !minorGridSettings.checkValidity()) return;

        state.setConfig('grid', $.extend(
            {},
            state.getConfig('grid'),
            { show: true },
            majorGridSettings.toState(),
            minorGridSettings.toState(),
        ));

        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
        $gridDialog.dialog('close');
    }, 'Save', {
        minWidth: 300,
        maxWidth: 300,
        minHeight: 350,
        maxHeight: 350
    });

    actions.registerAction('view.grid-settings',  () => openGridDialog());
}

function openGridDialog() {
    majorGridSettings.loadFromState();
    minorGridSettings.loadFromState();

    $gridDialog.dialog('open');
}

class GridSettings {
    constructor($container, enabledKey, spacingKey) {
        this.$container = $container;
        this.enabledKey = enabledKey;
        this.spacingKey = spacingKey;

        this.$enabled = this.$container.find('.enable-grid');
        this.$spacing = this.$container.find('.grid-spacing');

        // Fix chrome/edge <input type="number"> infinite scroll bug: https://stackoverflow.com/a/65250689
        this.$spacing.off('mouseup').on('mouseup', e => e.stopPropagation());

        // Refresh widget on any state change
        this.$enabled.off('change').on('change', () => this._refresh());
        this.$spacing.off('input').on('input', () => this._refresh())
    }

    loadFromState() {
        this.$enabled.prop('checked', state.getConfig('grid')[this.enabledKey]);
        this.$spacing.val(state.getConfig('grid')[this.spacingKey]);
        this._refresh();
    }

    toState() {
        const updates = {
            [this.enabledKey]: this.enabled,
        }

        if (this.enabled) {
            updates[this.spacingKey] = this.spacing;
        }

        return updates;
    }

    checkValidity() {
        if (!this.enabled) return true;

        this.$spacing.toggleClass('error', this.spacing === undefined);
        return this.spacing !== undefined;
    }

    get enabled() {
        return this.$enabled.prop('checked');
    }
    get spacing() {
        const spacing = parseInt(this.$spacing.val());
        if (isNaN(spacing) || spacing < GRID_SPACING_LIMITS[0] || spacing > GRID_SPACING_LIMITS[1]) {
            return undefined;
        }
        return spacing;
    }

    _refresh() {
        this.$container.find('.grid-settings').toggle(this.enabled)
        this.$spacing.removeClass('error')
    }
}

function setupWhitespaceToggle() {
    actions.registerAction('view.toggle-whitespace', {
        name: () => state.getConfig('whitespace') ? strings['view.hide-whitespace.name'] : strings['view.show-whitespace.name'],
        callback: () => {
            state.setConfig('whitespace', !state.getConfig('whitespace'));
            eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
        }
    });
}