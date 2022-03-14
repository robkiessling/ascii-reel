import {iterate2dArray} from "./utilities.js";
import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import {refresh} from "./index.js";
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
                this._reorderLayer(draggedIndex, this._layerIndexFromDOM(ui.item.index()));
            }
        });

        this.$layers.off('click', '.layer').on('click', '.layer', evt => {
            this._selectLayer(this._layerIndexFromDOM($(evt.currentTarget).index()));
        });

        this.$layerContainer.find('.add-blank-layer').off('click').on('click', () => this._addBlankLayer());
        this.$layerContainer.find('.delete-layer').off('click').on('click', () => this._deleteLayer());
    }

    // Layers are sorted backwards in the DOM
    _layerIndexFromDOM(index) {
        return (state.layers().length - 1) - index;
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
            axis: 'x', // TODO Won't work if frames on left
            placeholder: 'frame placeholder',
            start: (event, ui) => {
                draggedIndex = ui.item.index();
            },
            update: (event, ui) => {
                this._reorderFrame(draggedIndex, ui.item.index());
            }
        });
        this.$frames.off('click', '.frame').on('click', '.frame', evt => {
            this._selectFrame($(evt.currentTarget).index());
        });

        this.$frameContainer.find('.add-blank-frame').off('click').on('click', () => this._addBlankFrame());
        this.$frameContainer.find('.duplicate-frame').off('click').on('click', () => this._duplicateFrame());
        this.$frameContainer.find('.delete-frame').off('click').on('click', () => this._deleteFrame());
    }

    reset() {
        this._layerIndex = 0;
        this._frameIndex = 0;
        this.$layers.empty();
        this.$frames.empty();
    }

    rebuildLayers() {
        const scrollElement = this.layerSimpleBar.getScrollElement();
        const scrollTop = scrollElement.scrollTop;

        this.$layers.empty();
        this._layerComponents = state.layers().map((layer, i) => new LayerComponent(this, layer, i));

        scrollElement.scrollTop = scrollTop;
        this.layerSimpleBar.recalculate();

        this.$frameContainer.find('.delete-frame').prop('disabled', state.layers().length <= 1);
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
        return this._frameComponents[this._frameIndex];
    }

    get currentLayer() {
        return state.layers()[this._layerIndex];
    }
    get currentFrame() {
        return state.frames()[this._frameIndex];
    }
    get currentCel() {
        return state.cel(this.currentLayer, this.currentFrame);
    }

    // Aggregates all layers for the current frame
    get layeredChars() {
        let result;

        state.layers().forEach((layer, index) => {
            const layerChars = state.cel(layer, this.currentFrame).chars;

            if (index === 0) {
                result = $.extend(true, [], layerChars);
            }
            else {
                iterate2dArray(layerChars, (value, cell) => {
                    // Only overwriting char if it is not blank
                    if (value !== '') {
                        result[cell.row][cell.col] = value;
                    }
                });
            }
        });

        return result;
    }
    
    _selectLayer(index) {
        this._layerIndex = index;
        this.rebuildLayers();
        refresh();
    }
    _addBlankLayer() {
        const layerIndex = this._layerIndex + 1; // Add blank layer right after current layer
        state.createLayer(layerIndex, {
            name: `Layer ${state.layers().length + 1}`
        });
        this._selectLayer(layerIndex);
    }
    _deleteLayer() {
        state.deleteLayer(this._layerIndex);
        this._selectLayer(Math.min(this._layerIndex, state.layers().length - 1));
    }
    _reorderLayer(oldIndex, newIndex) {
        state.reorderLayer(oldIndex, newIndex);
        this._selectLayer(newIndex);
    }

    _selectFrame(index) {
        this._frameIndex = index;
        // Not calling rebuildFrames; refresh will handle it
        refresh();
    }
    _addBlankFrame() {
        const frameIndex = this._frameIndex + 1; // Add blank frame right after current frame
        state.createFrame(frameIndex, {});
        this._selectFrame(frameIndex);
    }
    _duplicateFrame() {
        state.duplicateFrame(this._frameIndex);
        this._selectFrame(this._frameIndex + 1);
    }
    _deleteFrame() {
        state.deleteFrame(this._frameIndex);
        this._selectFrame(Math.min(this._frameIndex, state.frames().length - 1));
    }
    _reorderFrame(oldIndex, newIndex) {
        state.reorderFrame(oldIndex, newIndex);
        this._selectFrame(newIndex);
    }
}

class LayerComponent {
    constructor(timeline, layer, index) {
        this._$container = timeline.$layerTemplate.clone();
        this._$container.removeClass('layer-template').prependTo(timeline.$layers).show();

        this._$container.toggleClass('selected', index === timeline._layerIndex); // todo
        this._$container.find('.layer-name').html(layer.name);

        this._layer = layer;
    }
}

class FrameComponent {
    constructor(timeline, frame, index) {
        this._timeline = timeline;

        this._$container = timeline.$frameTemplate.clone();
        this._$container.removeClass('frame-template').appendTo(timeline.$frames).show();

        this._$container.toggleClass('selected', index === timeline._frameIndex); // todo
        this._$container.find('.frame-index').html(index + 1);

        this._canvasController = new CanvasControl(this._$container.find('canvas'), {});
        this._canvasController.resize();
        this._canvasController.zoomToFit();

        this._frame = frame;

        this.redrawChars();
    }

    redrawChars() {
        this._canvasController.drawChars(state.cel(this._timeline.currentLayer, this._frame).chars);
    }
}
