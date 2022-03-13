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
            this.selectFrame($(evt.currentTarget).index());
        });

        this.$container.find('.add-blank-frame').off('click').on('click', () => this.addBlankFrame());
        this.$container.find('.duplicate-frame').off('click').on('click', () => this.duplicateFrame());
        this.$container.find('.delete-frame').off('click').on('click', () => this.deleteFrame());
    }

    get numCols() {
        return this._dimensions[0];
    }
    get numRows() {
        return this._dimensions[1];
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

    loadFrames(frames) {
        this.$frames.empty();
        this._frames = [];
        this._frameIndex = 0;

        const firstFrame = frames[0]; // We base the dimensions off of just the first frame
        this._dimensions = [firstFrame[0].length, firstFrame.length];

        frames.forEach(chars => this._frames.push(new Frame(this, chars)));

        resize();
    }

    get currentFrame() {
        if (this._frameIndex < 0 || this._frameIndex >= this._frames.length) { this._frameIndex = 0; }
        return this._frames[this._frameIndex];
    }

    selectFrame(index) {
        this._frameIndex = index;
        refresh();
    }

    addBlankFrame() {
        const frame = new Frame(this, create2dArray(this.numRows, this.numCols, ''));
        this._frames.splice(this._frameIndex + 1, 0, frame);
        this.selectFrame(this._frameIndex + 1);
    }

    duplicateFrame() {
        const frame = new Frame(this, $.extend(true, [], this.currentFrame.chars));
        this._frames.splice(this._frameIndex + 1, 0, frame);
        this.selectFrame(this._frameIndex + 1);
    }

    deleteFrame() {
        this._frames.splice(this._frameIndex, 1);
        this.selectFrame(Math.min(this._frameIndex, this._frames.length - 1));
    }

    reorderFrame(oldIndex, newIndex) {

    }

}

class Frame {
    constructor(timeline, chars) {
        this._chars = chars;
        this._timeline = timeline;

        // Ensure chars are bounded to the dimensions
        this._chars.length = this._timeline.numRows;
        chars.forEach(row => row.length = this._timeline.numCols);
    }

    build() {
        this.$frame = this._timeline.$frameTemplate.clone();
        this.$frame.removeClass('frame-template').appendTo(this._timeline.$frames).show();

        this.$frame.toggleClass('selected', this === this._timeline.currentFrame);
        this.$frame.find('.frame-index').html(this.$frame.index() + 1);

        this._canvasController = new CanvasControl(this.$frame.find('canvas'), {});
        this._canvasController.resize();
        this._canvasController.zoomToFit();

        this.drawChars();
    }

    get chars() {
        return this._chars;
    }

    getChar(row, col) {
        return this.isInBounds(row, col) ? this._chars[row][col] : null;
    }

    updateChar(row, col, value) {
        if (this.isInBounds(row, col)) {
            this._chars[row][col] = value;
        }
    }

    drawChars() {
        this._canvasController.drawChars(this._chars);
    }

    isInBounds(row, col) {
        return row >= 0 && row < this._timeline.numRows && col >= 0 && col < this._timeline.numCols;
    }

}