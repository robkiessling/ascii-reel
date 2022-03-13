import {create2dArray, eachWithObject, iterate2dArray} from "./utilities.js";
import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import {refresh, resize} from "./index.js";
import SimpleBar from 'simplebar';
import 'jquery-ui/ui/widgets/sortable.js';

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
        return (this._layers.length - 1) - index;
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

    get numCols() {
        return this._dimensions[0];
    }
    get numRows() {
        return this._dimensions[1];
    }
    get numFrames() {
        // Note: This doesn't return this._frames.length, since this is used when generating how many frames to make
        return this._layers[0].numCels;
    }

    loadLayers(layers) {
        // this._normalizeLayers(layers);
        const firstLayerCels = layers[0].cels;
        const firstCel = firstLayerCels[0]; // We base the dimensions off of the first cel received
        this._dimensions = [firstCel[0].length, firstCel.length];

        this._layers = [];
        this._layerIndex = 0;
        layers.forEach((data, i) => this._layers.push(new Layer(this, data, i !== 0)));

        this._frames = [];
        this._frameIndex = 0;
        firstLayerCels.forEach(() => this._frames.push(new Frame(this)));

        this.rebuildLayers();
        // Not calling rebuildFrames; resize will handle it
        resize();
    }

    rebuildLayers() {
        const scrollElement = this.layerSimpleBar.getScrollElement();
        const scrollTop = scrollElement.scrollTop;

        this.$layers.empty();
        this._layers.forEach(layer => layer.build());

        scrollElement.scrollTop = scrollTop;
        this.layerSimpleBar.recalculate();

        this.$frameContainer.find('.delete-frame').prop('disabled', this._layers.length <= 1);
    }

    rebuildFrames() {
        const scrollElement = this.frameSimpleBar.getScrollElement();
        const scrollLeft = scrollElement.scrollLeft;
        const scrollTop = scrollElement.scrollTop;

        this.$frames.empty();
        this._frames.forEach(frame => frame.build());

        scrollElement.scrollLeft = scrollLeft;
        scrollElement.scrollTop = scrollTop;
        this.frameSimpleBar.recalculate();

        this.$frameContainer.find('.delete-frame').prop('disabled', this._frames.length <= 1);
    }

    get currentLayer() {
        return this._layers[this._layerIndex];
    }
    get currentFrame() {
        return this._frames[this._frameIndex];
    }
    get currentCel() {
        return this.currentLayer.celAtFrameIndex(this._frameIndex);
    }

    celForFrameIndex(frameIndex) { // assuming current layer
        return this.currentLayer.celAtFrameIndex(frameIndex);
    }
    celForLayerIndex(layerIndex) { // assuming current frame
        return this._layers[layerIndex].celAtFrameIndex(this._frameIndex);
    }
    
    get layeredChars() {
        let chars;

        this._layers.forEach((layer, index) => {
            const celChars = layer.celAtFrameIndex(this._frameIndex).chars;

            if (index === 0) {
                chars = $.extend(true, [], celChars);
            }
            else {
                iterate2dArray(celChars, (value, cell) => {
                    // Only overwriting char if it is not blank
                    if (value !== '') {
                        chars[cell.row][cell.col] = value;
                    }
                });
            }
        });

        return chars;
    }
    
    _selectLayer(index) {
        this._layerIndex = index;
        this.rebuildLayers();
        refresh();
    }
    _addBlankLayer() {
        const layerIndex = this._layerIndex + 1; // Add blank layer right after current layer

        this._layers.splice(layerIndex, 0, new Layer(this, {
            name: `Layer ${this._layers.length + 1}`,
            cels: []
        }));

        this._selectLayer(layerIndex);
    }
    _deleteLayer() {
        this._layers.splice(this._layerIndex, 1);
        this._selectLayer(Math.min(this._layerIndex, this._layers.length - 1));
    }
    _reorderLayer(oldIndex, newIndex) {
        this._layers.splice(newIndex, 0, this._layers.splice(oldIndex, 1)[0]);
        this._selectLayer(newIndex);
    }

    _selectFrame(index) {
        this._frameIndex = index;
        // Not calling rebuildFrames; refresh will handle it
        refresh();
    }

    _addBlankFrame() {
        const frameIndex = this._frameIndex + 1; // Add blank frame right after current frame

        this._layers.forEach(layer => {
            layer.addCel(frameIndex, new Cel(this, create2dArray(this.numRows, this.numCols, '')));
        });

        this._frames.splice(frameIndex, 0, new Frame(this));

        this._selectFrame(frameIndex);
    }

    _duplicateFrame() {
        const frameIndex = this._frameIndex + 1; // Add duplicated frame right after current frame

        this._layers.forEach((layer, layerIndex) => {
            layer.addCel(frameIndex, this.celForLayerIndex(layerIndex).clone());
        });

        this._frames.splice(frameIndex, 0, new Frame(this));

        this._selectFrame(frameIndex);
    }

    _deleteFrame() {
        this._layers.forEach(layer => layer.deleteCel(this._frameIndex));
        this._frames.splice(this._frameIndex, 1);
        this._selectFrame(Math.min(this._frameIndex, this._frames.length - 1));
    }

    _reorderFrame(oldIndex, newIndex) {
        this._layers.forEach(layer => {
            layer.reorderCel(oldIndex, newIndex);
        });

        this._frames.splice(newIndex, 0, this._frames.splice(oldIndex, 1)[0]);

        this._selectFrame(newIndex);
    }
}

/**
 * Example data:
 * {
 *     name: 'My layer',
 *     opacity: 1.0,
 *     visible: true,
 *     connectionType: 'TODO',
 *     cels: [
 *         [['a']],
 *         [['b']]
 *     ]
 * }
 */
const LAYER_ATTRIBUTES = ['name', 'opacity', 'visible', 'connectionType'];
class Layer {
    constructor(timeline, data, normalizeCels = true) {
        this._timeline = timeline;
        this._cels = (normalizeCels ? this._normalizeCels(data.cels) : data.cels).map(chars => {
            return new Cel(this._timeline, chars);
        });
        this._attributes = eachWithObject(LAYER_ATTRIBUTES, {}, (attribute, obj) => obj[attribute] = data[attribute]);
    }

    _normalizeCels(cels) {
        if (!cels) { cels = []; } // Ensure cels exist

        let cel, row, col;
        for (let i = 0; i < this._timeline.numFrames; i++) {
            if (!cels[i]) { cels[i] = [[]]; } // Ensure cel exists
            cel = cels[i];
            for (row = 0; row < this._timeline.numRows; row++) {
                if (!cel[row]) { cel[row] = []; } // Ensure row exists
                for (col = 0; col < this._timeline.numCols; col++) {
                    if (cel[row][col] === undefined) { cel[row][col] = ''; } // Ensure col exists
                }
            }
            cel.length = this._timeline.numRows; // Limit number of rows
            cel.forEach(row => row.length = this._timeline.numCols); // Limit number of cols
        }
        cels.length = this._timeline.numFrames; // Limit number of cels

        return cels;
    }

    export() {
        let data = $.extend(true, {}, this._attributes);
        data.cels = this._cels.map(cel => cel.chars);
        return data;
    }

    build() {
        this._$container = this._timeline.$layerTemplate.clone();
        this._$container.removeClass('layer-template').prependTo(this._timeline.$layers).show();

        this._$container.toggleClass('selected', this === this._timeline.currentLayer);
        this._$container.find('.layer-name').html(this._attributes.name);
    }

    get index() {
        return this._timeline._layers.indexOf(this);
    }

    get numCels() {
        return this._cels.length;
    }

    reorderCel(oldIndex, newIndex) {
        this._cels.splice(newIndex, 0, this._cels.splice(oldIndex, 1)[0]);
    }

    celAtFrameIndex(index) {
        return this._cels[index];
    }

    addCel(index, cel) {
        this._cels.splice(index, 0, cel);
    }

    deleteCel(index) {
        this._cels.splice(index, 1);
    }
}


/**
 * A Frame is the set of cels for all layers in a specific time
 */
class Frame {
    constructor(timeline) {
        this._timeline = timeline;
    }

    build() {
        this._$container = this._timeline.$frameTemplate.clone();
        this._$container.removeClass('frame-template').appendTo(this._timeline.$frames).show();

        this._$container.toggleClass('selected', this === this._timeline.currentFrame);
        this._$container.find('.frame-index').html(this.index + 1);

        this._canvasController = new CanvasControl(this._$container.find('canvas'), {});
        this._canvasController.resize();
        this._canvasController.zoomToFit();

        this.drawChars();
    }

    get index() {
        return this._timeline._frames.indexOf(this);
    }

    drawChars() {
        this._canvasController.drawChars(this._timeline.celForFrameIndex(this.index).chars);
    }
}

/**
 * A cel (from celluloid) is one image in a specific Frame and Layer.
 */
class Cel {
    constructor(timeline, chars) {
        this._timeline = timeline;
        this._chars = chars;
    }

    clone() {
        return new Cel(this._timeline, $.extend(true, [], this.chars));
    }

    get chars() {
        return this._chars;
    }

    getChar(row, col) {
        return this._isInBounds(row, col) ? this._chars[row][col] : null;
    }

    updateChar(row, col, value) {
        if (this._isInBounds(row, col)) {
            this._chars[row][col] = value;
        }
    }

    _isInBounds(row, col) {
        return row >= 0 && row < this._timeline.numRows && col >= 0 && col < this._timeline.numCols;
    }
}
