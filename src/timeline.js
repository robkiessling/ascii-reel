import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import {refresh, resize} from "./index.js";
import SimpleBar from 'simplebar';
import 'jquery-ui/ui/widgets/sortable.js';
import * as state from "./state.js";

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

        this.$layers.off('click', '.layer').on('click', '.layer', evt => {
            this._selectLayer(this._layerIndexFromDOM($(evt.currentTarget).index()));
        });

        this.$layerContainer.find('.add-blank-layer').off('click').on('click', () => {
            const layerIndex = state.layerIndex() + 1; // Add blank layer right after current layer
            state.createLayer(layerIndex, {
                name: `Layer ${state.layers().length + 1}`
            });
            this._selectLayer(layerIndex);
        });

        this.$layerContainer.find('.delete-layer').off('click').on('click', () => {
            state.deleteLayer(state.layerIndex());
            this._selectLayer(Math.min(state.layerIndex(), state.layers().length - 1));
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
            this._selectFrame($(evt.currentTarget).index());
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

        this.$frameContainer.find('.align-frames-left').off('click').on('click', () => {
            this._alignFrames('left');
            window.setTimeout(() => { resize() }, 1);
        });
        this.$frameContainer.find('.align-frames-bottom').off('click').on('click', () => {
            this._alignFrames('bottom');
            window.setTimeout(() => { resize() }, 1); // TODO For some reason it takes a little time for heights to update
        });
        this._alignFrames('left'); // initial value
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

    _alignFrames(orientation) {
        $('#main-content')
            .toggleClass('frames-on-left', orientation === 'left')
            .toggleClass('frames-on-bottom', orientation === 'bottom');
        this.$frameContainer.find('.align-frames-left').prop('disabled', orientation === 'left');
        this.$frameContainer.find('.align-frames-bottom').prop('disabled', orientation === 'bottom');
        this.$frames.sortable('option', 'axis', orientation === 'left' ? 'y' : 'x');
    }
}

class LayerComponent {
    constructor(timeline, layer, index) {
        this._$container = timeline.$layerTemplate.clone();
        this._$container.removeClass('layer-template').prependTo(timeline.$layers).show();

        this._$container.toggleClass('selected', index === state.layerIndex());
        this._$container.find('.layer-name').html(layer.name);

        // this._layer = layer;
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
        this._canvasController.drawChars(state.cel(state.currentLayer(), this._frame).chars);
    }
}
