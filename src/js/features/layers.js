/**
 * UI component for layer management, rendered on the right sidebar.
 */

import SimpleBar from "simplebar";
import * as state from "../state/index.js";
import * as actions from "../io/actions.js";
import {hideCanvasMessage, showCanvasMessage} from "./main_canvas.js";
import {createDialog} from "../utils/dialogs.js";
import {STRINGS} from "../config/strings.js";
import {eventBus, EVENTS} from "../events/events.js";
import Minimizer from "../components/minimizer.js";

let $container, $template, $list, $editDialog, $editName;
let simpleBar, layerComponents, minimizer;

export function init() {
    $container = $('#layer-controller');
    $template = $container.find('.layer-template');

    minimizer = new Minimizer($container, 'layers')
    setupList();
    setupActions();
    setupEventBus();
}

function refresh() {
    minimizer.refresh();

    const scrollElement = simpleBar.getScrollElement();
    const scrollTop = scrollElement.scrollTop;

    $list.empty();
    layerComponents = state.layers().map((layer, i) => {
        return new LayerComponent($template, $list, layer, i);
    });

    scrollElement.scrollTop = scrollTop;
    simpleBar.recalculate();

    $container.find('[data-action]').each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
    });

    refreshVisibilities();
}

function setupList() {
    $list = $container.find('.list');

    // Custom scrollbar
    simpleBar = new SimpleBar($list.get(0), {
        autoHide: false,
        forceVisible: true
    });
    $list = $(simpleBar.getContentElement());

    // Setup drag-n-drop
    setupSortable();

    setupLayerEditor();

    $list.off('click', '.layer').on('click', '.layer', evt => {
        const newIndex = layerIndexFromDOM($(evt.currentTarget).index());
        if (newIndex !== state.layerIndex()) {
            selectLayer(newIndex);
        }
    });

    $list.off('dblclick', '.layer').on('dblclick', '.layer', evt => {
        actions.callAction('layers.edit-layer');
    });
}

function setupSortable() {
    let draggedIndex;
    $list.sortable({
        axis: 'y',
        placeholder: 'layer placeholder',
        start: (event, ui) => {
            draggedIndex = layerIndexFromDOM(ui.item.index());
        },
        update: (event, ui) => {
            const newIndex = layerIndexFromDOM(ui.item.index());
            state.reorderLayer(draggedIndex, newIndex);
            selectLayer(newIndex);
        }
    });
}

function setupActions() {
    actions.registerAction('layers.toggle-component', () => {
        minimizer.toggle();
        eventBus.emit(EVENTS.REFRESH.ALL);
    })

    actions.registerAction('layers.add-layer', () => {
        const layerIndex = state.layerIndex() + 1; // Add blank layer right after current layer
        state.createLayer(layerIndex);
        selectLayer(layerIndex);
    });

    actions.registerAction('layers.edit-layer', () => editLayer());

    actions.registerAction('layers.delete-layer', {
        callback: () => {
            state.deleteLayer(state.layerIndex());
            selectLayer(Math.min(state.layerIndex(), state.layers().length - 1));
        },
        enabled: () => state.layers() && state.layers().length > 1
    });

    actions.registerAction('layers.toggle-visibility-lock', () => {
        state.setConfig('lockLayerVisibility', !state.getConfig('lockLayerVisibility'));
        eventBus.emit(EVENTS.REFRESH.ALL);
    });

    actions.setupActionButtons($container, {
        placement: 'top'
    });
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())
}

function refreshVisibilities() {
    if (layerComponents) {
        layerComponents.forEach(layerComponent => layerComponent.refresh());

        const locked = state.getConfig('lockLayerVisibility');
        $container.find('.toggle-visibility-lock').find('.ri')
            .toggleClass('ri-lock-line', locked)
            .toggleClass('ri-lock-unlock-line', !locked);

        hideCanvasMessage();

        // When visibility is not locked, it can be easy to start editing a layer that is not actually visible on screen.
        // To help avoid this, we show a warning message if the current layer is not visible.
        if (!locked && !state.currentLayer().visible) {
            showCanvasMessage(
                "<span class='ri ri-fw ri-error-warning-line warning'></span>&emsp;" +
                STRINGS['warnings.current-layer-not-visible']
            )
        }
    }
}

function setupLayerEditor() {
    $editDialog = $("#edit-layer-dialog");
    createDialog($editDialog, () => saveLayer());

    $editName = $editDialog.find('.name');
}

function editLayer() {
    const layer = state.currentLayer();
    $editName.val(layer.name);
    $editDialog.dialog('open');
}

function saveLayer() {
    state.updateLayer(state.currentLayer(), {
        name: $editName.val()
    });

    $editDialog.dialog("close");

    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}

// Layers are sorted backwards in the DOM
function layerIndexFromDOM(index) {
    return (state.layers().length - 1) - index;
}

function selectLayer(index) {
    state.layerIndex(index);
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory()
}




class LayerComponent {
    constructor($template, $parent, layer, index) {
        this._$container = $template.clone().removeClass('layer-template');
        this._$container.prependTo($parent);
        this._$container.show();

        this._$container.toggleClass('selected', index === state.layerIndex());
        this._$container.find('.layer-name').html(layer.name);

        this._$container.find('.toggle-visibility').off('click').on('click', () => {
            state.toggleLayerVisibility(this._layer);
            eventBus.emit(EVENTS.REFRESH.ALL);
        })

        this._layer = layer;

        this.refresh();
    }

    refresh() {
        this._$container.find('.toggle-visibility')
            .toggleClass('invisible', state.getConfig('lockLayerVisibility'))
            .find('.ri')
            .toggleClass('ri-eye-line', this._layer.visible)
            .toggleClass('ri-eye-off-line', !this._layer.visible);
    }
}