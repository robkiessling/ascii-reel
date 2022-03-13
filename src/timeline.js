import {create2dArray} from "./utilities.js";
import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import {refresh, resize} from "./index.js";
import SimpleBar from 'simplebar';

export class Timeline {
    constructor($container) {
        this.$container = $container;
        this._init();
    }

    _init() {
        this.$frames = this.$container.find('.frame-list');
        this.$frameTemplate = this.$container.find('.frame-template');

        this.simpleBar = new SimpleBar(this.$frames.get(0), {
            autoHide: false,
            forceVisible: true
        });
        this.$frames = $(this.simpleBar.getContentElement());

        this.$frames.off('click', '.frame').on('click', '.frame', evt => {
            this._selectFrame($(evt.currentTarget).index());
        });

        this.$container.find('.add-blank-frame').off('click').on('click', () => this._addBlankFrame());
        this.$container.find('.duplicate-frame').off('click').on('click', () => this._duplicateFrame());
        this.$container.find('.delete-frame').off('click').on('click', () => this._deleteFrame());
    }

    get numCols() {
        return this._dimensions[0];
    }
    get numRows() {
        return this._dimensions[1];
    }

    loadLayers(layers) {
        const firstLayer = layers[0]; // We base frames off of the first layer received
        const firstCel = firstLayer[0]; // We base the dimensions off of the first cel received
        this._dimensions = [firstCel[0].length, firstCel.length];

        this._layers = [];
        this._layerIndex = 0;
        layers.forEach(celData => this._layers.push(new Layer(this, celData)));

        this._frames = [];
        this._frameIndex = 0;
        firstLayer.forEach(() => this._frames.push(new Frame(this)));

        resize();
    }

    rebuildFrames() {
        const scrollElement = this.simpleBar.getScrollElement();
        const scrollLeft = scrollElement.scrollLeft;
        const scrollTop = scrollElement.scrollTop;

        this.$frames.empty();
        this._frames.forEach(frame => frame.build());

        scrollElement.scrollLeft = scrollLeft;
        scrollElement.scrollTop = scrollTop;
        this.simpleBar.recalculate();

        this.$container.find('.delete-frame').prop('disabled', this._frames.length <= 1);
    }

    get currentLayer() {
        return this._layers[this._layerIndex];
    }
    get currentFrame() {
        return this._frames[this._frameIndex];
    }
    get currentCel() {
        return this.currentLayer.cels[this._frameIndex];
    }

    celForFrameIndex(frameIndex) { // assuming current layer
        return this.currentLayer.cels[frameIndex];
    }
    celForLayerIndex(layerIndex) { // assuming current frame
        return this._layers[layerIndex].cels[this._frameIndex];
    }

    _selectFrame(index) {
        this._frameIndex = index;
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

    }

}

class Layer {
    constructor(timeline, celData) {
        this._timeline = timeline;

        this._cels = celData.map(chars => {
            return new Cel(this._timeline, chars);
        });
    }

    get cels() {
        return this._cels;
    }

    addCel(index, cel) {
        this._cels.splice(index, 0, cel);
    }

    deleteCel(index) {
        this._cels.splice(index, 1);
    }
}

/**
 * A cel (from celluloid) is one image in a specific Frame and Layer.
 */
class Cel {
    constructor(timeline, chars) {
        this._timeline = timeline;
        this._chars = chars;

        // Ensure chars are bounded to the dimensions
        this._chars.length = this._timeline.numRows;
        chars.forEach(row => row.length = this._timeline.numCols);
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

/**
 * A Frame is the set of cels for all layers in a specific time
 */
class Frame {
    constructor(timeline) {
        this._timeline = timeline;
    }

    build() {
        this.$frame = this._timeline.$frameTemplate.clone();
        this.$frame.removeClass('frame-template').appendTo(this._timeline.$frames).show();

        this.$frame.toggleClass('selected', this === this._timeline.currentFrame);
        this.$frame.find('.frame-index').html(this.index + 1);

        this._canvasController = new CanvasControl(this.$frame.find('canvas'), {});
        this._canvasController.resize();
        this._canvasController.zoomToFit();

        this.drawChars();
    }

    get index() {
        return this.$frame.index();
    }

    drawChars() {
        this._canvasController.drawChars(this._timeline.celForFrameIndex(this.index).chars);
    }
}