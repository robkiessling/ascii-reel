/**
 * UI component for palette management, rendered on the right sidebar.
 */

import SimpleBar from "simplebar";
import * as state from '../state/index.js';
import * as tools from './tools.js';
import * as actions from "../io/actions.js";
import {STRINGS} from "../config/strings.js";
import {eventBus, EVENTS} from "../events/events.js";
import Minimizer from "../components/minimizer.js";


let $container, $colorList, $actions, actionButtons, minimizer;

export function init() {
    $container = $('#palette-controller');
    $colorList = $container.find('.list');
    $actions = $container.find('[data-action]');

    const colorListSimpleBar = new SimpleBar($colorList.get(0), {
        autoHide: false,
        forceVisible: true
    });
    $colorList = $(colorListSimpleBar.getContentElement());

    $colorList.on('click', '.color', evt => {
        const $color = $(evt.currentTarget);
        tools.selectColor($color.data('color'));
    });

    minimizer = new Minimizer($container, 'palette')

    setupActions();
    setupEventBus();
}

function setupActions() {
    actions.registerAction('palette.toggle-component', () => {
        minimizer.toggle();
        refresh();
    })

    actions.registerAction('palette.sort-colors', {
        name: () => {
            return STRINGS[`palette.sort-colors.name.${state.getPaletteSortBy()}`]
        },
        callback: () => {
            let sortIndex = Object.values(state.PALETTE_SORT_BY_OPTIONS).indexOf(state.getPaletteSortBy());
            sortIndex = (sortIndex + 1) % Object.values(state.PALETTE_SORT_BY_OPTIONS).length;
            state.changePaletteSortBy(Object.values(state.PALETTE_SORT_BY_OPTIONS)[sortIndex]);
            refresh();
        }
    });
    actions.registerAction('palette.delete-color', {
        enabled: () => {
            return $colorList.find('.selected').length;
        },
        callback: () => {
            state.deleteColor($colorList.find('.selected').data('color'));
            refresh();
            state.pushHistory();
        }
    });
    actions.registerAction('palette.open-settings', () => {

    });

    actionButtons = actions.setupActionButtons($container, {
        placement: 'top'
    });
}

function setupEventBus() {
    eventBus.on(EVENTS.TOOLS.COLOR_CHANGED, () => refreshSelectedColor())
    eventBus.on([EVENTS.TOOLS.COLOR_ADDED, EVENTS.REFRESH.ALL], () => refresh())
}

function refresh() {
    $container.toggleClass('hidden', !state.isMultiColored());
    minimizer.refresh();

    $colorList.empty();

    const colors = state.sortedPalette();
    if (colors.length) {
        colors.forEach(colorStr => {
            $('<div></div>', {
                class: 'color',
                attr: { 'data-color': colorStr }, // using `attr` instead of `data` so we can select by it in DOM
                css: { 'background-color': colorStr }
            }).appendTo($colorList);
        });
    }
    else {
        $('<div></div>', {
            class: 'empty-list',
            html: STRINGS['palette.empty']
        }).appendTo($colorList);
    }

    refreshSelectedColor();
    actionButtons.refreshContent();
}

function refreshSelectedColor() {
    $colorList.find('.color.selected').removeClass('selected');
    $colorList.find(`.color[data-color="${state.getConfig('primaryColor')}"]`).addClass('selected');

    $actions.each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
    })
}

