import $ from "jquery";
import 'jquery-ui/ui/widgets/sortable.js';
import SimpleBar from 'simplebar';
import {CanvasControl} from "./canvas.js";
import {triggerRefresh, triggerResize} from "./index.js";
import * as actions from "./actions.js";
import * as state from "./state.js";
import {createDialog} from "./utilities.js";
import {hideCanvasMessage, showCanvasMessage} from "./editor.js";
import {Range} from "./utilities.js"

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

        this.$layers.off('dblclick', '.layer').on('dblclick', '.layer', evt => {
            actions.callAction('timeline.edit-layer');
        });

        // ---------------- Layer actions
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

        this._layerTooltips = this._setupActionButtons(this.$layerContainer, { placement: 'top' });
    }

    _initFrames() {
        this.$frames = this.$frameContainer.find('.frame-list');
        this.$frameTemplate = this.$frameContainer.find('.frame-template');

        this.frameSimpleBar = new SimpleBar(this.$frames.get(0), {
            autoHide: false,
            forceVisible: true
        });
        this.$frames = $(this.frameSimpleBar.getContentElement());

        // Adding functionality on top of jquery-ui `sortable` to handle dragging multiple frames
        let draggedIndex, draggedRange;
        this.$frames.sortable({
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

        this.$frames.off('click', '.frame').on('click', '.frame', evt => {
            const newIndex = $(evt.currentTarget).index();

            if (evt.shiftKey) {
                state.extendFrameRangeSelection(newIndex);
                triggerRefresh('full', 'changeFrameMulti');
            }
            else {
                this._selectFrame(newIndex, 'changeFrameSingle');
            }
        });

        // ---------------- Frame actions

        actions.registerAction('timeline.new-frame', () => {
            const frameIndex = state.frameIndex() + 1; // Add blank frame right after current frame
            state.createFrame(frameIndex, {});
            this._selectFrame(frameIndex, true);
        });

        actions.registerAction('timeline.duplicate-frame', () => {
            const currentRange = state.frameRangeSelection();
            state.duplicateFrames(currentRange);

            this._selectFrameRange(
                currentRange.clone().translate(currentRange.length),
                state.frameIndex() + currentRange.length,
                true
            )
        });

        actions.registerAction('timeline.delete-frame', {
            callback: () => {
                state.deleteFrames(state.frameRangeSelection());
                this._selectFrame(Math.min(state.frameIndex(), state.frames().length - 1), true);
            },
            enabled: () => state.frames() && state.frames().length > 1
        });

        actions.registerAction('timeline.toggle-onion', () => {
            state.config('onion', !state.config('onion'));
            this._refreshOnion(); // have to refresh this manually since just refreshing chars
            triggerRefresh('chars');
        });

        actions.registerAction('timeline.align-frames-left', () => {
            state.config('frameOrientation', 'left');
            triggerResize();
        });

        actions.registerAction('timeline.align-frames-bottom', () => {
            state.config('frameOrientation', 'bottom');
            triggerResize();
        });

        actions.registerAction('timeline.previous-frame', () => {
            let index = state.frameRangeSelection().startIndex;
            index -= 1;
            if (index < 0) index = 0;
            this._selectFrame(index, 'changeFrameSingle');
        })
        actions.registerAction('timeline.next-frame', () => {
            let index = state.frameRangeSelection().endIndex;
            index += 1;
            if (index >= state.frames().length) index = state.frames().length - 1;
            this._selectFrame(index, 'changeFrameSingle');
        })

        this._frameTooltips = this._setupActionButtons(this.$frameContainer);
    }

    refresh() {
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

        this.$layerContainer.find('[data-action]').each((i, element) => {
            const $element = $(element);
            $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
        });
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

        this.$frameContainer.find('[data-action]').each((i, element) => {
            const $element = $(element);
            $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
        });
    }

    get currentFrameComponent() {
        return this._frameComponents[state.frameIndex()];
    }
    get currentLayerComponent() {
        return this._layerComponents[state.layerIndex()];
    }

    _setupActionButtons($container, tooltipOptions) {
        $container.off('click', '[data-action]').on('click', '[data-action]', evt => {
            const $element = $(evt.currentTarget);
            if (!$element.hasClass('disabled')) {
                actions.callAction($element.data('action'))
            }
        });

        return actions.setupTooltips(
            $container.find('[data-action]').toArray(),
            element => $(element).data('action'),
            tooltipOptions
        );
    }

    _setupLayerEditor() {
        this.$editLayerDialog = $("#edit-layer-dialog");
        createDialog(this.$editLayerDialog, () => this._saveLayer());

        this.$layerName = this.$editLayerDialog.find('.name');
    }

    _editLayer() {
        const layer = state.currentLayer();
        this.$layerName.val(layer.name);
        this.$editLayerDialog.dialog('open');
    }

    _saveLayer() {
        state.updateLayer(state.currentLayer(), {
            name: this.$layerName.val()
        });

        this.$editLayerDialog.dialog("close");

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

    _refreshVisibilities() {
        if (this._layerComponents) {
            this._layerComponents.forEach(layerComponent => layerComponent.refresh());

            const locked = state.config('lockLayerVisibility');
            this.$layerContainer.find('.toggle-visibility-lock').find('.ri')
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

    _alignFrames() {
        const orientation = state.config('frameOrientation');
        $('#frames-and-canvas')
            .toggleClass('frames-on-left', orientation === 'left')
            .toggleClass('frames-on-bottom', orientation === 'bottom');
        this.$frameContainer.find('.align-frames-left').toggleClass('disabled', orientation === 'left')
            .find('.ri').toggleClass('active', orientation === 'left');
        this.$frameContainer.find('.align-frames-bottom').toggleClass('disabled', orientation === 'bottom')
            .find('.ri').toggleClass('active', orientation === 'bottom');
        this.$frames.sortable('option', 'axis', orientation === 'left' ? 'y' : 'x');

        this._frameTooltips.forEach(tooltip => {
            tooltip.setProps({
                placement: orientation === 'left' ? 'right' : 'top'
            });
        });
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

class FrameComponent {
    constructor(timeline, frame, index) {
        this._$container = timeline.$frameTemplate.clone();
        this._$container.removeClass('frame-template').appendTo(timeline.$frames).show();

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
