import $ from "jquery";
import 'jquery-ui/ui/widgets/sortable.js';
import SimpleBar from "simplebar";
import * as state from "../state/state.js";
import {triggerRefresh} from "../index.js";
import * as actions from "../io/actions.js";
import {hideCanvasMessage, showCanvasMessage} from "./editor.js";
import {createDialog} from "../utils/utilities.js";

export default class Layers {
    constructor($container) {
        this._$container = $container;
        this._init();
    }

    _init() {
        this._$template = this._$container.find('.layer-template');

        this._setupList();
        this._setupActionButtons();
    }

    refresh() {
        this._refreshVisibilities();
    }

    rebuild() {
        const scrollElement = this._simpleBar.getScrollElement();
        const scrollTop = scrollElement.scrollTop;

        this._$list.empty();
        this._layerComponents = state.layers().map((layer, i) => {
            return new LayerComponent(this._$template, this._$list, layer, i);
        });

        scrollElement.scrollTop = scrollTop;
        this._simpleBar.recalculate();

        this._$container.find('[data-action]').each((i, element) => {
            const $element = $(element);
            $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
        });

        this.refresh();
    }

    get currentLayerComponent() {
        return this._layerComponents[state.layerIndex()];
    }

    _setupList() {
        this._$list = this._$container.find('.list');

        // Custom scrollbar
        this._simpleBar = new SimpleBar(this._$list.get(0), {
            autoHide: false,
            forceVisible: true
        });
        this._$list = $(this._simpleBar.getContentElement());

        // Setup drag-n-drop
        this._setupSortable();

        this._setupLayerEditor();

        this._$list.off('click', '.layer').on('click', '.layer', evt => {
            const newIndex = this._layerIndexFromDOM($(evt.currentTarget).index());
            if (newIndex !== state.layerIndex()) {
                this._selectLayer(newIndex);
            }
        });

        this._$list.off('dblclick', '.layer').on('dblclick', '.layer', evt => {
            actions.callAction('timeline.edit-layer');
        });
    }

    _setupSortable() {
        let draggedIndex;
        this._$list.sortable({
            axis: 'y',
            placeholder: 'layer placeholder',
            start: (event, ui) => {
                draggedIndex = this._layerIndexFromDOM(ui.item.index());
            },
            update: (event, ui) => {
                const newIndex = this._layerIndexFromDOM(ui.item.index());
                state.reorderLayer(draggedIndex, newIndex);
                this._selectLayer(newIndex);
            }
        });
    }

    _setupActionButtons() {
        actions.registerAction('timeline.add-layer', () => {
            const layerIndex = state.layerIndex() + 1; // Add blank layer right after current layer
            state.createLayer(layerIndex, {
                name: `Layer ${state.layers().length + 1}`
            });
            this._selectLayer(layerIndex);
        });

        actions.registerAction('timeline.edit-layer', () => this._editLayer());

        actions.registerAction('timeline.delete-layer', {
            callback: () => {
                state.deleteLayer(state.layerIndex());
                this._selectLayer(Math.min(state.layerIndex(), state.layers().length - 1));
            },
            enabled: () => state.layers() && state.layers().length > 1
        });

        actions.registerAction('timeline.toggle-layer-visibility-lock', () => {
            state.config('lockLayerVisibility', !state.config('lockLayerVisibility'));
            triggerRefresh();
        });

        actions.attachClickHandlers(this._$container);

        this._tooltips = actions.setupTooltips(
            this._$container.find('[data-action]').toArray(),
            element => $(element).data('action'),
            { placement: 'top' }
        );
    }

    _refreshVisibilities() {
        if (this._layerComponents) {
            this._layerComponents.forEach(layerComponent => layerComponent.refresh());

            const locked = state.config('lockLayerVisibility');
            this._$container.find('.toggle-visibility-lock').find('.ri')
                .toggleClass('active', locked)
                .toggleClass('ri-lock-line', locked)
                .toggleClass('ri-lock-unlock-line', !locked);

            if (state.currentLayer().visible) {
                hideCanvasMessage();
            }
            else {
                showCanvasMessage("<span class='ri ri-fw ri-error-warning-line alert'></span>&emsp;The current layer is not visible")
            }
        }
    }

    _setupLayerEditor() {
        this._$editDialog = $("#edit-layer-dialog");
        createDialog(this._$editDialog, () => this._saveLayer());

        this._$editName = this._$editDialog.find('.name');
    }

    _editLayer() {
        const layer = state.currentLayer();
        this._$editName.val(layer.name);
        this._$editDialog.dialog('open');
    }

    _saveLayer() {
        state.updateLayer(state.currentLayer(), {
            name: this._$editName.val()
        });

        this._$editDialog.dialog("close");

        state.pushStateToHistory();
        triggerRefresh();
    }

    // Layers are sorted backwards in the DOM
    _layerIndexFromDOM(index) {
        return (state.layers().length - 1) - index;
    }

    _selectLayer(index) {
        state.layerIndex(index);
        triggerRefresh('full', true);
    }

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
            triggerRefresh();
        })

        this._layer = layer;

        this.refresh();
    }

    refresh() {
        this._$container.find('.toggle-visibility')
            .toggleClass('invisible', state.config('lockLayerVisibility'))
            .find('.ri')
            .toggleClass('active', this._layer.visible)
            .toggleClass('ri-eye-line', this._layer.visible)
            .toggleClass('ri-eye-off-line', !this._layer.visible);
    }
}