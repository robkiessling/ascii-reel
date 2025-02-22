import $ from "jquery";
import 'jquery-ui/ui/widgets/sortable.js';
import SimpleBar from "simplebar";
import * as state from "../state/state.js";
import {Range} from "../utils/utilities.js";
import {triggerRefresh, triggerResize} from "../index.js";
import * as actions from "../io/actions.js";
import {CanvasControl} from "../canvas/canvas.js";

export default class Frames {
    constructor($container) {
        this._$container = $container;
        this._init();
    }

    _init() {
        this.$template = this._$container.find('.frame-template');

        this._setupList();
        this._setupActionButtons();
    }

    refresh() {
        this._refreshAlignment();
        this._refreshOnion();
    }

    rebuild() {
        const scrollElement = this._simpleBar.getScrollElement();
        const scrollLeft = scrollElement.scrollLeft;
        const scrollTop = scrollElement.scrollTop;

        this._$list.empty();
        this._frameComponents = state.frames().map((frame, i) => {
            return new FrameComponent(this.$template, this._$list, frame, i);
        });

        scrollElement.scrollLeft = scrollLeft;
        scrollElement.scrollTop = scrollTop;
        this._simpleBar.recalculate();

        this._$container.find('[data-action]').each((i, element) => {
            const $element = $(element);
            $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
        });

        this.refresh();
    }

    get currentFrameComponent() {
        return this._frameComponents[state.frameIndex()];
    }

    _setupList() {
        this._$list = this._$container.find('.frame-list');

        // Custom scrollbar
        this._simpleBar = new SimpleBar(this._$list.get(0), {
            autoHide: false,
            forceVisible: true
        });
        this._$list = $(this._simpleBar.getContentElement());

        // Setup drag-n-drop
        this._setupSortable();

        this._$list.off('click', '.frame').on('click', '.frame', evt => {
            const newIndex = $(evt.currentTarget).index();

            if (evt.shiftKey) {
                state.extendFrameRangeSelection(newIndex);
                triggerRefresh('full', 'changeFrameMulti');
            }
            else {
                this._selectFrame(newIndex, 'changeFrameSingle');
            }
        });
    }

    // Adding functionality on top of jquery-ui `sortable` to handle dragging multiple frames
    _setupSortable() {
        let draggedIndex, draggedRange;

        this._$list.sortable({
            placeholder: 'frame placeholder',
            start: (event, ui) => {
                draggedIndex = ui.item.index();
                draggedRange = state.frameRangeSelection();

                // If dragging a frame that is outside the current frameRangeSelection, use that frame as the draggedRange instead
                if (!draggedRange.includes(draggedIndex)) {
                    draggedRange = new Range(draggedIndex, draggedIndex);
                }

                // If dragging multiple frames, we update the frame-index to show the indices of the entire dragged
                // range, and we hide all other selected frames during the drag.
                if (draggedRange.length > 1) {
                    ui.item.find('.frame-index').html(draggedRange.toDisplay());
                    ui.item.siblings('.selected').addClass('range-selection-sibling')
                }
            },
            update: (event, ui) => {
                // Get newIndex without regarding any of the hidden frame siblings
                const newIndex = ui.item.parent().find('.frame:not(.range-selection-sibling)').index(ui.item)
                state.reorderFrames(draggedRange, newIndex);
                this._selectFrameRange(
                    draggedRange.clone().translateTo(newIndex),
                    newIndex + draggedRange.offset(draggedIndex),
                    true
                )
            },
            stop: (event, ui) => {
                // In case multiple frames get dragged and then dropped at original position, this re-shows them
                ui.item.siblings('.range-selection-sibling').removeClass('range-selection-sibling');
            }
        });
    }

    _setupActionButtons() {
        actions.registerAction('frames.new-frame', () => {
            const frameIndex = state.frameIndex() + 1; // Add blank frame right after current frame
            state.createFrame(frameIndex, {});
            this._selectFrame(frameIndex, true);
        });

        actions.registerAction('frames.duplicate-frame', () => {
            const currentRange = state.frameRangeSelection();
            state.duplicateFrames(currentRange);

            this._selectFrameRange(
                currentRange.clone().translate(currentRange.length),
                state.frameIndex() + currentRange.length,
                true
            )
        });

        actions.registerAction('frames.delete-frame', {
            callback: () => {
                state.deleteFrames(state.frameRangeSelection());
                this._selectFrame(Math.min(state.frameIndex(), state.frames().length - 1), true);
            },
            enabled: () => state.frames() && state.frames().length > 1
        });

        actions.registerAction('frames.toggle-onion', () => {
            state.config('onion', !state.config('onion'));
            this._refreshOnion(); // have to refresh this manually since just refreshing chars
            triggerRefresh('chars');
        });

        actions.registerAction('frames.align-left', () => {
            state.config('frameOrientation', 'left');
            triggerResize();
        });

        actions.registerAction('frames.align-bottom', () => {
            state.config('frameOrientation', 'bottom');
            triggerResize();
        });

        actions.registerAction('frames.previous-frame', () => {
            let index = state.frameRangeSelection().startIndex;
            index -= 1;
            if (index < 0) index = 0;
            this._selectFrame(index, 'changeFrameSingle');
        })
        actions.registerAction('frames.next-frame', () => {
            let index = state.frameRangeSelection().endIndex;
            index += 1;
            if (index >= state.frames().length) index = state.frames().length - 1;
            this._selectFrame(index, 'changeFrameSingle');
        })

        actions.attachClickHandlers(this._$container);

        this._tooltips = actions.setupTooltips(
            this._$container.find('[data-action]').toArray(),
            element => $(element).data('action')
        );
    }

    _refreshAlignment() {
        const orientation = state.config('frameOrientation');

        $('#frames-and-canvas')
            .toggleClass('frames-on-left', orientation === 'left')
            .toggleClass('frames-on-bottom', orientation === 'bottom');
        this._$container.find('.align-frames-left').toggleClass('disabled', orientation === 'left')
            .find('.ri').toggleClass('active', orientation === 'left');
        this._$container.find('.align-frames-bottom').toggleClass('disabled', orientation === 'bottom')
            .find('.ri').toggleClass('active', orientation === 'bottom');
        this._$list.sortable('option', 'axis', orientation === 'left' ? 'y' : 'x');

        this._tooltips.forEach(tooltip => {
            tooltip.setProps({
                placement: orientation === 'left' ? 'right' : 'top'
            });
        });
    }

    _refreshOnion() {
        this._$container.find('.toggle-onion').find('.ri').toggleClass('active', state.config('onion'));
    }

    _selectFrame(index, saveState) {
        state.frameRangeSelection(null); // Clear out any range selection
        state.frameIndex(index);
        triggerRefresh('full', saveState);
    }

    _selectFrameRange(newRange, newFrameIndex, saveState) {
        state.frameRangeSelection(newRange);
        state.frameIndex(newFrameIndex);
        triggerRefresh('full', saveState);
    }
}

class FrameComponent {
    constructor($template, $parent, frame, index) {
        this._$container = $template.clone().removeClass('frame-template');
        this._$container.appendTo($parent);
        this._$container.show();

        this._$container.toggleClass('selected', state.frameRangeSelection().includes(index));
        this._$container.find('.frame-index').html(index + 1);

        this._canvasController = new CanvasControl(this._$container.find('canvas'), {});
        this._canvasController.resize();
        this._canvasController.zoomToFit();

        this._frame = frame;

        this.redrawGlyphs();
    }

    redrawGlyphs() {
        this._canvasController.clear();
        this._canvasController.drawBackground(state.config('background'));
        this._canvasController.drawGlyphs(state.layeredGlyphs(this._frame));
    }
}
