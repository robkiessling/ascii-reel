import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import {refresh, resize} from "./index.js";
import SimpleBar from 'simplebar';
import 'jquery-ui/ui/widgets/sortable.js';
import 'jquery-ui/ui/widgets/dialog.js';
import * as state from "./state.js";
import * as keyboard from "./keyboard.js";

export class Timeline {
    constructor($frameContainer, $layerContainer) {
        this.$frameContainer = $frameContainer;
        this.$layerContainer = $layerContainer;
        this._initLayers();
        this._initFrames();
    }

    _initLayers() {
        this.$layers = this.$layerContainer.find('.layer-list');
        this.$layerTemplate = this.$layerContainer.find('.layer-template');

        this.layerSimpleBar = new SimpleBar(this.$layers.get(0), {
            autoHide: false,
            forceVisible: true
        });
        this.$layers = $(this.layerSimpleBar.getContentElement());

        let draggedIndex;
        this.$layers.sortable({
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

        this._setupLayerEditor();

        this.$layers.off('click', '.layer').on('click', '.layer', evt => {
            const newIndex = this._layerIndexFromDOM($(evt.currentTarget).index());
            if (newIndex !== state.layerIndex()) {
                this._selectLayer(newIndex);
            }
        });

        this.$layerContainer.find('.add-blank-layer').off('click').on('click', () => {
            const layerIndex = state.layerIndex() + 1; // Add blank layer right after current layer
            state.createLayer(layerIndex, {
                name: `Layer ${state.layers().length + 1}`
            });
            this._selectLayer(layerIndex);
        });

        this.$layerContainer.find('.edit-layer').off('click').on('click', () => {
            this._editLayer();
        });

        this.$layerContainer.find('.delete-layer').off('click').on('click', () => {
            state.deleteLayer(state.layerIndex());
            this._selectLayer(Math.min(state.layerIndex(), state.layers().length - 1));
        });

        this.$layerContainer.find('.toggle-visibility-all').off('click').on('click', () => {
            // const allVisible = state.layers().every(layer => layer.visible);
            // state.toggleAllLayerVisibility(!allVisible);

            const atLeastOneVisible = state.layers().some(layer => layer.visible);
            state.toggleAllLayerVisibility(!atLeastOneVisible);

            refresh();
        });


    }

    _initFrames() {
        this.$frames = this.$frameContainer.find('.frame-list');
        this.$frameTemplate = this.$frameContainer.find('.frame-template');

        this.frameSimpleBar = new SimpleBar(this.$frames.get(0), {
            autoHide: false,
            forceVisible: true
        });
        this.$frames = $(this.frameSimpleBar.getContentElement());

        let draggedIndex;
        this.$frames.sortable({
            placeholder: 'frame placeholder',
            start: (event, ui) => {
                draggedIndex = ui.item.index();
            },
            update: (event, ui) => {
                const newIndex = ui.item.index();
                state.reorderFrame(draggedIndex, newIndex);
                this._selectFrame(newIndex);
            }
        });

        this.$frames.off('click', '.frame').on('click', '.frame', evt => {
            const newIndex = $(evt.currentTarget).index();
            if (newIndex !== state.frameIndex()) {
                this._selectFrame(newIndex);
            }
        });

        this.$frameContainer.find('.add-blank-frame').off('click').on('click', () => {
            const frameIndex = state.frameIndex() + 1; // Add blank frame right after current frame
            state.createFrame(frameIndex, {});
            this._selectFrame(frameIndex);
        });

        this.$frameContainer.find('.duplicate-frame').off('click').on('click', () => {
            state.duplicateFrame(state.frameIndex());
            this._selectFrame(state.frameIndex() + 1);
        });

        this.$frameContainer.find('.delete-frame').off('click').on('click', () => {
            state.deleteFrame(state.frameIndex());
            this._selectFrame(Math.min(state.frameIndex(), state.frames().length - 1));
        });

        this.$frameContainer.find('.toggle-onion').off('click').on('click', () => {
            state.config('onion', !state.config('onion'));
            this._refreshOnion(); // have to refresh this manually since just refreshing chars
            refresh('chars');
        });

        this.$frameContainer.find('.align-frames-left').off('click').on('click', () => {
            state.config('frameOrientation', 'left');
            resize();
        });
        this.$frameContainer.find('.align-frames-bottom').off('click').on('click', () => {
            state.config('frameOrientation', 'bottom');
            resize();
        });
    }

    configUpdated() {
        this._refreshVisibilities();
        this._alignFrames();
        this._refreshOnion();
    }

    rebuildLayers() {
        const scrollElement = this.layerSimpleBar.getScrollElement();
        const scrollTop = scrollElement.scrollTop;

        this.$layers.empty();
        this._layerComponents = state.layers().map((layer, i) => new LayerComponent(this, layer, i));

        scrollElement.scrollTop = scrollTop;
        this.layerSimpleBar.recalculate();

        this.$layerContainer.find('.delete-layer').prop('disabled', state.layers().length <= 1);
    }

    rebuildFrames() {
        const scrollElement = this.frameSimpleBar.getScrollElement();
        const scrollLeft = scrollElement.scrollLeft;
        const scrollTop = scrollElement.scrollTop;

        this.$frames.empty();
        this._frameComponents = state.frames().map((frame, i) => new FrameComponent(this, frame, i));

        scrollElement.scrollLeft = scrollLeft;
        scrollElement.scrollTop = scrollTop;
        this.frameSimpleBar.recalculate();

        this.$frameContainer.find('.delete-frame').prop('disabled', state.frames().length <= 1);
    }

    get currentFrameComponent() {
        return this._frameComponents[state.frameIndex()];
    }
    get currentLayerComponent() {
        return this._layerComponents[state.layerIndex()];
    }

    _setupLayerEditor() {
        this.$editLayerDialog = $( "#edit-layer-dialog" ).dialog({
            autoOpen: false,
            width: 350,
            classes: {
                // "ui-dialog-titlebar-close": "ri ri-fw ri-close-line"
                "ui-dialog-titlebar-close": "hidden"
            },
            closeText: '',
            draggable: false,
            resizable: false,
            modal: true,
            open: () => {
                $('.ui-widget-overlay').on('click', () => {
                    this.$editLayerDialog.dialog('close');
                })

                keyboard.toggleStandard(true);
                $(document).on('keyboard:enter.layerEditor', () => this._saveLayer());
            },
            close: () => {
                console.log('close');
                keyboard.toggleStandard(false);
                $(document).off('keyboard:enter.layerEditor');
            },
            buttons: [
                {
                    text: 'Cancel',
                    click: () => this.$editLayerDialog.dialog("close")
                },
                {
                    text: 'Save',
                    class: 'call-out',
                    click: () => this._saveLayer()
                }
            ]
        });

        this.$layerName = this.$editLayerDialog.find('.name');

        this.$layerOpacitySlider = this.$editLayerDialog.find('.opacity-slider');
        const $layerOpacityHandler = this.$layerOpacitySlider.find('.ui-slider-handle');
        this.$layerOpacitySlider.slider({
            value: 0,
            min: 0,
            max: 1,
            step: 0.01,
            slide: (event, ui) => {
                $layerOpacityHandler.text(ui.value);
            },
            change: (event, ui) => {
                $layerOpacityHandler.text(ui.value);
            },
            classes: {
                "ui-slider-handle": "with-text"
            }
        });
    }

    _editLayer() {
        const layer = state.currentLayer();
        this.$layerOpacitySlider.slider('value', layer.opacity);
        this.$layerName.val(layer.name);
        this.$editLayerDialog.dialog('open');
    }

    _saveLayer() {
        state.updateLayer(state.currentLayer(), {
            name: this.$layerName.val(),
            opacity: this.$layerOpacitySlider.slider('value')
        });

        this.$editLayerDialog.dialog("close");

        refresh();
    }

    // Layers are sorted backwards in the DOM
    _layerIndexFromDOM(index) {
        return (state.layers().length - 1) - index;
    }

    _selectLayer(index) {
        state.layerIndex(index);
        refresh();
    }

    _selectFrame(index) {
        state.frameIndex(index);
        refresh();
    }

    _refreshVisibilities() {
        if (this._layerComponents) {
            this._layerComponents.forEach(layerComponent => layerComponent.refresh());

            const atLeastOneVisible = state.layers().some(layer => layer.visible);
            this.$layerContainer.find('.toggle-visibility-all').find('.ri')
                .toggleClass('active', atLeastOneVisible)
                .toggleClass('ri-eye-line', atLeastOneVisible)
                .toggleClass('ri-eye-off-line', !atLeastOneVisible);

        }
    }

    _alignFrames() {
        const orientation = state.config('frameOrientation');
        $('#main-content')
            .toggleClass('frames-on-left', orientation === 'left')
            .toggleClass('frames-on-bottom', orientation === 'bottom');
        this.$frameContainer.find('.align-frames-left').prop('disabled', orientation === 'left')
            .find('.ri').toggleClass('active', orientation === 'left');
        this.$frameContainer.find('.align-frames-bottom').prop('disabled', orientation === 'bottom')
            .find('.ri').toggleClass('active', orientation === 'bottom');
        this.$frames.sortable('option', 'axis', orientation === 'left' ? 'y' : 'x');
    }

    _refreshOnion() {
        this.$frameContainer.find('.toggle-onion').find('.ri').toggleClass('active', state.config('onion'));
    }
}

class LayerComponent {
    constructor(timeline, layer, index) {
        this._$container = timeline.$layerTemplate.clone();
        this._$container.removeClass('layer-template').prependTo(timeline.$layers).show();

        this._$container.toggleClass('selected', index === state.layerIndex());
        this._$container.find('.layer-name').html(layer.name);

        this._$container.find('.toggle-visibility').off('click').on('click', () => {
            state.toggleLayerVisibility(this._layer);
            refresh(); // Note: This is index refresh
        })

        this._layer = layer;

        this.refresh();
    }

    refresh() {
        this._$container.find('.toggle-visibility').find('.ri')
            .toggleClass('active', this._layer.visible)
            .toggleClass('ri-eye-line', this._layer.visible)
            .toggleClass('ri-eye-off-line', !this._layer.visible);
    }
}

class FrameComponent {
    constructor(timeline, frame, index) {
        this._$container = timeline.$frameTemplate.clone();
        this._$container.removeClass('frame-template').appendTo(timeline.$frames).show();

        this._$container.toggleClass('selected', index === state.frameIndex());
        this._$container.find('.frame-index').html(index + 1);

        this._canvasController = new CanvasControl(this._$container.find('canvas'), {});
        this._canvasController.resize();
        this._canvasController.zoomToFit();

        this._frame = frame;

        this.redrawChars();
    }

    redrawChars() {
        this._canvasController.drawChars(state.layeredChars(this._frame));
    }
}
