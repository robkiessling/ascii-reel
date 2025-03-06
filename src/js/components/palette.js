/**
 * UI component for palette management, rendered on the right sidebar.
 */

import SimpleBar from "simplebar";
import {triggerRefresh} from "../index.js";
import * as state from '../state/state.js';
import * as editor from './editor.js';
import * as actions from "../io/actions.js";
import Color from "@sphinxxxx/color-conversion";
import {strings} from "../config/strings.js";

export const DEFAULT_PALETTE = ['rgba(0,0,0,1)', 'rgba(255,255,255,1)'];
export const DEFAULT_COLOR = 'rgba(0,0,0,1)';

// Note: these values get used to look up strings->description value for tooltip. If this is changed need to update strings.
export const SORT_BY = {
    DATE_ADDED: 'date-added',
    HUE: 'hue',
    SATURATION: 'saturation',
    LIGHTNESS: 'lightness',
    ALPHA: 'alpha'
}

let $container, $colorList, $actions, tooltips;

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
        editor.selectColor($color.data('color'));
    });

    setupActionButtons();
}

function setupActionButtons() {
    actions.registerAction('palette.sort-colors', {
        name: () => {
            return strings[`palette.sort-colors.name.${state.getPaletteSortBy()}`]
        },
        callback: () => {
            let sortIndex = Object.values(SORT_BY).indexOf(state.getPaletteSortBy());
            sortIndex = (sortIndex + 1) % Object.values(SORT_BY).length;
            state.changePaletteSortBy(Object.values(SORT_BY)[sortIndex]);
            triggerRefresh('palette', false);
        }
    });
    actions.registerAction('palette.delete-color', {
        enabled: () => {
            return $colorList.find('.selected').length;
        },
        callback: () => {
            state.deleteColor($colorList.find('.selected').data('color'));
            triggerRefresh('palette', true);
        }
    });
    actions.registerAction('palette.open-settings', () => {

    });

    actions.attachClickHandlers($container);

    tooltips = actions.setupTooltips(
        $container.find('[data-action]').toArray(),
        element => $(element).data('action'),
        { placement: 'top' }
    );
}

export function refresh() {
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
            class: 'message',
            html: 'No colors...'
        }).appendTo($colorList);
    }

    refreshSelection();
    tooltips.refreshContent();
}

export function refreshSelection() {
    $colorList.find('.color.selected').removeClass('selected');
    $colorList.find(`.color[data-color="${state.config('primaryColor')}"]`).addClass('selected');

    $actions.each((i, element) => {
        const $element = $(element);
        $element.toggleClass('disabled', !actions.isActionEnabled($element.data('action')));
    })
}

export function sortPalette(colors, sortBy) {
    switch (sortBy) {
        case SORT_BY.DATE_ADDED:
            return [...colors];
        case SORT_BY.HUE:
            return sortColorsByHslaAttr(colors, 'h');
        case SORT_BY.SATURATION:
            return sortColorsByHslaAttr(colors, 's');
        case SORT_BY.LIGHTNESS:
            return sortColorsByHslaAttr(colors, 'l');
        case SORT_BY.ALPHA:
            return sortColorsByHslaAttr(colors, 'a');
        default:
            console.warn(`Could not sort by: ${sortBy}`)
            return [...colors];
    }
}

function sortColorsByHslaAttr(colors, hslaAttr) {
    const hslaColors = colors.map(colorStr => {
        const [h, s, l, a] = new Color(colorStr).hsla;
        return { h, s, l, a, colorStr };
    });
    hslaColors.sort((a, b) => {
        // Sorting by hue
        if (hslaAttr === 'h') {
            return sortByHue(a, b)
        }

        // Sorting by saturation/lightness/alpha, and use hue as a secondary sort if equivalent
        if (a[hslaAttr] === b[hslaAttr]) {
            return sortByHue(a, b);
        }
        return a[hslaAttr] > b[hslaAttr] ? 1 : -1;
    })
    return hslaColors.map(hslaColor => hslaColor.colorStr);
}

// Sorts by hue, and uses lightness as a secondary sort if equivalent
// There is also a special handler for grey colors (which are all hue:0 -- red) so that they are sorted in front of reds
function sortByHue(a, b) {
    if (a.h === b.h) {
        if (isGreyColor(a) && !isGreyColor(b)) {
            return -1;
        }
        else if (!isGreyColor(a) && isGreyColor(b)) {
            return 1;
        }
        else {
            return a.l > b.l ? 1 : -1;
        }
    }

    return a.h > b.h ? 1 : -1;
}

function isGreyColor(hslaColor) {
    return hslaColor.h === 0 && hslaColor.s === 0;
}
