/**
 * UI component for frame management. Can be rendered on the left or bottom of the screen depending on user settings.
 */

import SimpleBar from "simplebar";
import * as state from "../state/index.js";
import * as actions from "../io/actions.js";
import CanvasControl from "../canvas/canvas.js";
import ArrayRange from "../utils/arrays.js";
import {refreshComponentVisibility, toggleComponent} from "../utils/components.js";
import {strings} from "../config/strings.js";
import {eventBus, EVENTS} from "../events/events.js";

let $container, $template, $list;
let simpleBar, frameComponents, tooltips;

export function init() {
    $container = $('#frame-controller');
    $template = $container.find('.frame-template');

    setupList();
    setupActionButtons();
    setupEventBus();
}

export function refresh() { // todo do not export this once resize is implemented as an emitted event
    refreshAlignment();
    refreshOnion();
}

function rebuild() {
    const scrollElement = simpleBar.getScrollElement();
    const scrollLeft = scrollElement.scrollLeft;
    const scrollTop = scrollElement.scrollTop;
    const prevNumFrames = frameComponents ? frameComponents.length : 0;

    $list.empty();
    frameComponents = state.frames().map((frame, i) => {
        return new FrameComponent($template, $list, frame, i);
    });

    // Restore to previous scroll position since content was wiped & re-added
    scrollElement.scrollLeft = scrollLeft;
    scrollElement.scrollTop = scrollTop;

    // If there are frames added/subtracted since last time, scroll to the current selected frame
    // so user can see what's going on.
    if (frameComponents.length !== prevNumFrames) {
        const $selected = $list.find('.frame.selected').first();
        if (!$selected.visible()) { // Only need to scroll if it's not currently visible
            $selected.get(0).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    simpleBar.recalculate();

    $container.find('[data-action]').each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
    });

    refresh();
}

function currentFrameComponent() {
    return frameComponents[state.frameIndex()];
}

function setupList() {
    $list = $container.find('.list');

    // Custom scrollbar
    simpleBar = new SimpleBar($list.get(0), {
        autoHide: false,
        forceVisible: true
    });
    $list = $(simpleBar.getContentElement());

    // Setup drag-n-drop
    setupSortable();

    $list.off('click', '.frame').on('click', '.frame', evt => {
        const newIndex = $(evt.currentTarget).index();

        if (evt.shiftKey) {
            state.extendFrameRangeSelection(newIndex);
            eventBus.emit(EVENTS.REFRESH.ALL);
            state.pushHistory({ modifiable: 'changeFrameMulti' });
        }
        else {
            selectFrame(newIndex, 'changeFrameSingle');
        }
    });
}

// Adding functionality on top of jquery-ui `sortable` to handle dragging multiple frames
function setupSortable() {
    let draggedIndex, draggedRange;

    $list.sortable({
        placeholder: 'frame placeholder',
        start: (event, ui) => {
            draggedIndex = ui.item.index();
            draggedRange = state.frameRangeSelection();

            // If dragging a frame that is outside the current frameRangeSelection, use that frame as the draggedRange instead
            if (!draggedRange.includes(draggedIndex)) {
                draggedRange = new ArrayRange(draggedIndex, draggedIndex);
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
            selectFrameRange(
                draggedRange.clone().translateTo(newIndex),
                newIndex + draggedRange.offset(draggedIndex)
            )
        },
        stop: (event, ui) => {
            // In case multiple frames get dragged and then dropped at original position, this re-shows them
            ui.item.siblings('.range-selection-sibling').removeClass('range-selection-sibling');
        }
    });
}

function setupActionButtons() {
    actions.registerAction('frames.new-frame', () => {
        const frameIndex = state.frameIndex() + 1; // Add blank frame right after current frame
        state.createFrame(frameIndex, {});
        selectFrame(frameIndex);
    });

    actions.registerAction('frames.duplicate-frame', () => {
        const currentRange = state.frameRangeSelection();
        state.duplicateFrames(currentRange);

        selectFrameRange(
            currentRange.clone().translate(currentRange.length),
            state.frameIndex() + currentRange.length
        )
    });

    actions.registerAction('frames.delete-frame', {
        callback: () => {
            state.deleteFrames(state.frameRangeSelection());
            selectFrame(Math.min(state.frameIndex(), state.frames().length - 1));
        },
        enabled: () => state.frames() && state.frames().length > 1
    });

    actions.registerAction('frames.toggle-onion', () => {
        state.setConfig('onion', !state.getConfig('onion'));
        refreshOnion(); // have to refresh this manually since just refreshing chars
        eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    });

    actions.registerAction('frames.toggle-component', {
        name: () => strings[state.isMinimized('frames') ? 'frames.show-component.name' : 'frames.hide-component.name'],
        description: () => strings[state.isMinimized('frames') ? 'frames.show-component.description' : 'frames.hide-component.description'],
        callback: () => {
            toggleComponent('frames');
            eventBus.emit(EVENTS.RESIZE.ALL)
        }
    });

    actions.registerAction('frames.align-left', () => {
        toggleComponent('frames', false);
        state.setConfig('frameOrientation', 'left');
        eventBus.emit(EVENTS.RESIZE.ALL)
    });

    actions.registerAction('frames.align-bottom', () => {
        toggleComponent('frames', false);
        state.setConfig('frameOrientation', 'bottom');
        eventBus.emit(EVENTS.RESIZE.ALL)
    });

    actions.registerAction('frames.previous-frame', () => {
        let index = state.frameRangeSelection().startIndex;
        index -= 1;
        if (index < 0) index = state.frames().length - 1;
        selectFrame(index, 'changeFrameSingle');
    })
    actions.registerAction('frames.next-frame', () => {
        let index = state.frameRangeSelection().endIndex;
        index += 1;
        if (index >= state.frames().length) index = 0;
        selectFrame(index, 'changeFrameSingle');
    })

    actions.attachClickHandlers($container);

    tooltips = actions.setupTooltips(
        $container.find('[data-action]').toArray(),
        element => $(element).data('action')
    );
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => rebuild())
    eventBus.on(EVENTS.REFRESH.CURRENT_FRAME, () => currentFrameComponent().redrawGlyphs())
}

function refreshAlignment() {
    const orientation = state.getConfig('frameOrientation');

    // Minimized frames component:
    refreshComponentVisibility($container, 'frames');
    const minimized = state.isMinimized('frames');
    $container.find('[data-action="frames.toggle-component"]').find('.ri')
        .toggleClass('active', minimized)
        .toggleClass('ri-sidebar-fold-line', !minimized)
        .toggleClass('ri-sidebar-unfold-line', minimized)
        .toggleClass('rotate270', orientation === 'bottom');

    // Frames on left vs. bottom:
    $('#frames-and-canvas')
        .toggleClass('frames-on-left', orientation === 'left')
        .toggleClass('frames-on-bottom', orientation === 'bottom');

    const framesLeftActive = orientation === 'left' && !minimized;
    $container.find('[data-action="frames.align-left"]').toggleClass('disabled', framesLeftActive)
        .find('.ri').toggleClass('active', framesLeftActive);

    const framesBottomActive = orientation === 'bottom' && !minimized;
    $container.find('[data-action="frames.align-bottom"]').toggleClass('disabled', framesBottomActive)
        .find('.ri').toggleClass('active', framesBottomActive);

    $list.sortable('option', 'axis', orientation === 'left' ? 'y' : 'x');

    tooltips.refreshContent();

    tooltips.forEach(tooltip => {
        tooltip.setProps({
            placement: orientation === 'left' ? 'right' : 'top'
        });
    });
}

function refreshOnion() {
    $container.find('.toggle-onion').find('.ri').toggleClass('active', state.getConfig('onion'));
}

function selectFrame(index, historyModifiable) {
    state.frameRangeSelection(null); // Clear out any range selection
    state.frameIndex(index);
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory({ modifiable: historyModifiable });
}

function selectFrameRange(newRange, newFrameIndex) {
    state.frameRangeSelection(newRange);
    state.frameIndex(newFrameIndex);
    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
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
        this._canvasController.drawBackground(state.getConfig('background'));
        this._canvasController.drawGlyphs(state.layeredGlyphs(this._frame));
    }
}
