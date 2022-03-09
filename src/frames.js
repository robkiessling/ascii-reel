import {create2dArray} from "./utilities.js";
import {CanvasControl} from "./canvas.js";
import $ from "jquery";
import {refresh} from "./index.js";

const DEFAULT_DIMENSIONS = [20, 20];

export class FrameController {
    constructor($container) {
        this.$container = $container;
        this._dimensions = [0,0];
        this.loadFrames(); // default: one empty frame
    }

    get numCols() {
        return this._dimensions[0];
    }
    get numRows() {
        return this._dimensions[1];
    }
    get dimensions() {
        return this._dimensions;
    }
    set dimensions(dimensions) {
        this._dimensions = dimensions;
        // TODO refresh
    }

    clearFrames() {
        this.$container.empty();
        this._frames = [];
        this._frameIndex = 0;
    }

    resize() {
        this._frames.forEach(frame => frame.resize());
    }

    fullRefresh() {
        this._frames.forEach(frame => {
            frame.drawChars();
            frame.toggleSelectedClass(frame === this.currentFrame);
        });
    }

    loadFrames(frames) {
        this.clearFrames();

        if (!frames || !frames.length) {
            frames = [create2dArray(DEFAULT_DIMENSIONS[1], DEFAULT_DIMENSIONS[0], '')];
        }

        const firstFrame = frames[0]; // We base the dimensions off of just the first frame
        this._dimensions = [firstFrame[0].length, firstFrame.length];

        frames.forEach(chars => {
            // Ensure all char arrays are bounded to same dimensions
            chars.length = this.numRows;
            chars.forEach(row => row.length = this.numCols);
            this._frames.push(new Frame(this, chars));
        });
    }

    get currentFrame() {
        if (this._frameIndex < 0 || this._frameIndex >= this._frames.length) { this._frameIndex = 0; }
        return this._frames[this._frameIndex];
    }

    indexOf(frame) {
        return this._frames.indexOf(frame);
    }

    selectFrame(index) {
        this._frameIndex = index;
        refresh();
    }

    copyFrame(index) {

    }

    reorderFrame(oldIndex, newIndex) {

    }

    deleteFrame(index) {

    }


}

class Frame {
    constructor(frameController, chars) {
        this._chars = chars;
        this._frameController = frameController;
        this._buildCanvas();
    }

    get chars() {
        return this._chars;
    }

    get index() {
        return this._frameController.indexOf(this);
    }

    getChar(row, col) {
        return this._chars[row][col];
    }
    updateChar(row, col, value) {
        this._chars[row][col] = value;
    }
    resize() {
        this._canvasController.resize();
        this._canvasController.zoomToFit();
    }

    drawChars() {
        this._canvasController.drawChars(this._chars);
    }

    toggleSelectedClass(isSelected) {
        this.$frame.toggleClass('selected', isSelected);
    }

    _buildCanvas() {
        this.$frame = $('<div>', {
            'class': 'frame'
        }).appendTo(this._frameController.$container);
        const $canvas = $('<canvas>', {
            'class': 'absolute-center full'
        }).appendTo(this.$frame);

        this._canvasController = new CanvasControl($canvas, {});

        this.$frame.off('click').on('click', () => {
            this._frameController.selectFrame(this.index);
        });
    }

}