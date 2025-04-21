/**
 * UI component for frame management. Can be rendered on the left or bottom of the screen depending on user settings.
 */

import SimpleBar from "simplebar";
import * as state from "../state/index.js";
import * as actions from "../io/actions.js";
import CanvasControl from "../components/canvas_control/index.js";
import ArrayRange from "../utils/arrays.js";
import {STRINGS} from "../config/strings.js";
import {eventBus, EVENTS} from "../events/events.js";
import * as tools from "./tools.js";
import {hideAll as hideAllTooltips} from "tippy.js";
import {readGlobalSetting, saveGlobalSetting} from "../storage/local_storage.js";
import Minimizer from "../components/minimizer.js";

let $container, $template, $list;
let simpleBar, frameComponents, actionButtons;
let minimizer;

export function init() {
    $container = $('#frame-controller');
    $template = $container.find('.frame-template');

    minimizer = new Minimizer($container, 'frames')
    setupList();
    setupActions();
    setupEventBus();
}

export function resize() {
    $container.toggleClass('hidden', !state.isAnimationProject());
    minimizer.refresh();

    $('#frames-and-canvas')
        .toggleClass('frames-on-left', alignFramesLeft())
        .toggleClass('frames-on-bottom', !alignFramesLeft());

    $list.sortable('option', 'axis', alignFramesLeft() ? 'y' : 'x');

    actionButtons.tooltips.forEach(tooltip => {
        tooltip.setProps({
            placement: alignFramesLeft() ? 'right' : 'top'
        });
    });

    // Frame canvases don't need to be resized here since refresh() will be called at end of EVENTS.RESIZE.ALL event
}

function refresh() {
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

    actionButtons.refreshContent();
}

function alignFramesLeft() {
    return readGlobalSetting('frameOrientation') !== 'bottom';
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

function setupActions() {
    actions.registerAction('frames.new-frame', {
        enabled: () => state.isAnimationProject(),
        callback: () => {
            const frameIndex = state.frameIndex() + 1; // Add blank frame right after current frame
            state.createFrame(frameIndex, {});
            selectFrame(frameIndex);
        }
    });

    actions.registerAction('frames.duplicate-frame', {
        enabled: () => state.isAnimationProject(),
        callback: () => {
            const currentRange = state.frameRangeSelection();
            state.duplicateFrames(currentRange);

            selectFrameRange(
                currentRange.clone().translate(currentRange.length),
                state.frameIndex() + currentRange.length
            )
        }
    });

    actions.registerAction('frames.delete-frame', {
        callback: () => {
            state.deleteFrames(state.frameRangeSelection());
            selectFrame(Math.min(state.frameIndex(), state.frames().length - 1));
        },
        enabled: () => state.isAnimationProject() && state.frames() && state.frames().length > 1
    });

    actions.registerAction('frames.reverse-frames', {
        callback: () => {
            const currentRange = state.frameRangeSelection();
            state.reverseFrames(currentRange);

            selectFrameRange(
                currentRange,
                state.frameIndex()
            )
        },
        enabled: () => state.isAnimationProject() && state.frameRangeSelection().length > 1,
        icon: () => alignFramesLeft() ? 'ri-arrow-up-down-line' : 'ri-arrow-left-right-line',
    });

    actions.registerAction('frames.toggle-onion', {
        enabled: () => state.isAnimationProject(),
        callback: () => {
            state.setConfig('onion', !state.getConfig('onion'));
            actionButtons.refreshContent();
            eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
        },
        icon: () => state.getConfig('onion') ? 'ri-stack-line active' : 'ri-stack-line'
    });

    actions.registerAction('frames.toggle-component', {
        name: () => STRINGS[minimizer.isMinimized ? 'frames.show-component.name' : 'frames.hide-component.name'],
        description: () => STRINGS[minimizer.isMinimized ? 'frames.show-component.description' : 'frames.hide-component.description'],
        callback: () => {
            minimizer.toggle();
            hideAllTooltips({ duration: 0 });
            eventBus.emit(EVENTS.RESIZE.ALL)
        },
        icon: () => {
            let icon = 'ri ri-fw ';
            icon += minimizer.isMinimized ? 'ri-sidebar-unfold-line active ' : 'ri-sidebar-fold-line ';
            if (!alignFramesLeft()) icon += 'rotate270 ';
            return icon;
        }
    });

    actions.registerAction('frames.align-left', {
        callback: () => {
            if (alignFramesLeft()) minimizer.toggle(false);
            saveGlobalSetting('frameOrientation', 'left');
            hideAllTooltips({ duration: 0 });
            eventBus.emit(EVENTS.RESIZE.ALL)
        },
        visible: () => !alignFramesLeft() && !minimizer.isMinimized,
        icon: () => 'ri ri-fw ri-layout-left-line'
    });

    actions.registerAction('frames.align-bottom', {
        callback: () => {
            if (!alignFramesLeft()) minimizer.toggle(false);
            saveGlobalSetting('frameOrientation', 'bottom');
            hideAllTooltips({ duration: 0 });
            eventBus.emit(EVENTS.RESIZE.ALL)
        },
        visible: () => alignFramesLeft() && !minimizer.isMinimized,
        icon: () => 'ri ri-fw ri-layout-bottom-line'
    });

    actions.registerAction('frames.previous-frame', {
        enabled: () => state.isAnimationProject(),
        callback: () => {
            let index = state.frameRangeSelection().startIndex;
            index -= 1;
            if (index < 0) index = state.frames().length - 1;
            selectFrame(index, 'changeFrameSingle');
        }
    })
    actions.registerAction('frames.next-frame', {
        enabled: () => state.isAnimationProject(),
        callback: () => {
            let index = state.frameRangeSelection().endIndex;
            index += 1;
            if (index >= state.frames().length) index = 0;
            selectFrame(index, 'changeFrameSingle');
        }
    })

    actionButtons = actions.setupActionButtons($container);
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())
    eventBus.on(EVENTS.REFRESH.CURRENT_FRAME, () => currentFrameComponent().redrawGlyphs())
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
        this._canvasController.drawGlyphs(state.layeredGlyphs(this._frame, {
            drawingContent: tools.drawingContent,
        }));
    }
}
