/**
 * UI component for layer management, rendered on the right sidebar.
 */

import SimpleBar from "simplebar";
import * as state from "../state/index.js";
import * as actions from "../io/actions.js";
import {hideCanvasMessage, showCanvasMessage} from "./canvas_controller.js";
import {createDialog} from "../utils/dialogs.js";
import {STRINGS} from "../config/strings.js";
import {eventBus, EVENTS} from "../events/events.js";
import Minimizer from "../components/minimizer.js";
import {LAYER_TYPES} from "../state/constants.js";
import {delegateTips, standardTip} from "../components/tooltips.js";
import {getIconHTML} from "../config/icons.js";

let $container, $template, $list,
    $editDialog, $editName, $editType, $isNewLayer, $rasterizeWarning, $vectorizeWarning;
let simpleBar, layerComponents, minimizer, actionButtons;

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

    actionButtons.refreshContent();

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

    delegateTips($list, '.layer-type', $element => `layers.layerType.${$element.data('layer-type')}`, {
        placement: 'left',
        offset: [0, 23]
    })
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

    actions.registerAction('layers.add-layer', () => addLayer());
    actions.registerAction('layers.edit-layer', () => editLayer());

    actions.registerAction('layers.delete-layer', {
        callback: () => {
            state.deleteLayer(state.layerIndex());
            eventBus.emit(EVENTS.REFRESH.ALL);
            state.pushHistory()
        },
        enabled: () => state.layers() && state.layers().length > 1
    });

    actions.registerAction('layers.toggle-visibility-lock', {
        callback: () => {
            state.setConfig('lockLayerVisibility', !state.getConfig('lockLayerVisibility'));
            eventBus.emit(EVENTS.REFRESH.ALL);
        },
        icon: () => state.getConfig('lockLayerVisibility') ?
            getIconHTML('layers.toggle-visibility-lock.lock') : getIconHTML('layers.toggle-visibility-lock.unlock')
    });

    actionButtons = actions.setupActionButtons($container, {
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

        // When visibility is not locked, it can be easy to start editing a layer that is not actually visible on screen.
        // To help avoid this, we show a warning message if the current layer is not visible.
        hideCanvasMessage();
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

    $editName = $editDialog.find('[name="layer-name"]');
    $editType = $editDialog.find('[name="layer-type"]');
    $isNewLayer = $editDialog.find('[name="is-new-layer"]');
    $rasterizeWarning = $editDialog.find('.rasterize-warning').text(STRINGS['layers.layerType.rasterize.warning']);
    $vectorizeWarning = $editDialog.find('.vectorize-warning').text(STRINGS['layers.layerType.vectorize.warning']);

    $editType.each((i, element) => {
        const $input = $(element);
        const $label = $input.closest('label');
        standardTip($label, `layers.layerType.${$input.val()}`, {
            placement: 'left'
        })
    })

    $editType.on('change', () => {
        if ($isNewLayer.val() === 'true') {
            $rasterizeWarning.toggle(false);
            $vectorizeWarning.toggle(false);
        } else {
            const oldType = state.currentLayer().type;
            const newType = $editType.filter(':checked').val()
            $rasterizeWarning.toggle(oldType === LAYER_TYPES.VECTOR && newType === LAYER_TYPES.RASTER)
            $vectorizeWarning.toggle(oldType === LAYER_TYPES.RASTER)
        }
    })
}

function addLayer() {
    $isNewLayer.val(true);

    $editName.val(state.nextLayerName());
    $editType.filter(`[value="${state.currentLayer().type}"]`).prop('checked', true).trigger('change');
    $editType.prop('disabled', false);
    $editDialog.dialog('option', 'title', STRINGS['layers.add-layer.name']).dialog('open');
}

function editLayer() {
    $isNewLayer.val(false);

    const layer = state.currentLayer();
    $editName.val(layer.name);
    $editType.filter(`[value="${layer.type}"]`).prop('checked', true).trigger('change');
    $editType.prop('disabled', layer.type === LAYER_TYPES.RASTER);
    $editDialog.dialog('option', 'title', STRINGS['layers.edit-layer.name']).dialog('open');
}

function saveLayer() {
    const layerProps = {
        name: $editName.val() ? $editName.val() : undefined, // Use default if left blank
        type: $editType.filter(':checked').val(),
    }

    if ($isNewLayer.val() === 'true') {
        const layerIndex = state.layerIndex() + 1; // Add new layer right after current layer
        state.createLayer(layerIndex, layerProps);
        // selectLayer(layerIndex);
    } else {
        state.updateLayer(state.currentLayer(), layerProps);
    }

    $editDialog.dialog("close");

    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}

// Layers are sorted backwards in the DOM
function layerIndexFromDOM(index) {
    return (state.layers().length - 1) - index;
}

function selectLayer(index) {
    state.changeLayerIndex(index);
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory()
}




class LayerComponent {
    constructor($template, $parent, layer, index) {
        this._layer = layer;

        this._$container = $template.clone().removeClass('layer-template');
        this._$container.prependTo($parent);
        this._$container.show();

        this._$container.toggleClass('selected', index === state.layerIndex());
        this._$container.find('.layer-name').html(layer.name);
        this._setupLayerType();

        this._$container.find('.toggle-visibility').off('click').on('click', () => {
            state.toggleLayerVisibility(this._layer);
            eventBus.emit(EVENTS.REFRESH.ALL);
        })


        this.refresh();
    }

    refresh() {
        this._$container.find('.toggle-visibility')
            .toggleClass('invisible', state.getConfig('lockLayerVisibility'))
            .find('.ri')
            .toggleClass('ri-eye-line', this._layer.visible)
            .toggleClass('ri-eye-off-line', !this._layer.visible);
    }

    _setupLayerType() {
        switch (this._layer.type) {
            case LAYER_TYPES.RASTER:
                this._$container.find('.layer-type')
                    .addClass('ri-grid-line')
                    .attr('data-layer-type', this._layer.type);
                break;
            case LAYER_TYPES.VECTOR:
                this._$container.find('.layer-type')
                    .addClass('ri-shape-line')
                    .attr('data-layer-type', this._layer.type);
                break;
        }
    }
}