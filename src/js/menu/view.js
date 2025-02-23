import * as state from "../state/state.js";
import {triggerRefresh} from "../index.js";
import Picker from "vanilla-picker";
import * as actions from "../io/actions.js";
import {strings} from "../config/strings.js";
import {createDialog} from "../utils/dialogs.js";

const ALLOWED_GRID_WIDTHS = [1, 2, 3, 4];
const ALLOWED_GRID_SPACINGS = [1, 2, 4, 5, 8, 10, 16, 20, 32, 50, 64, 100];

export function init() {
    setupGridToggle();
    setupGridDialog();

    actions.registerAction('view.zoom-in', {
        callback: () => {},
        enabled: () => false
    });
    actions.registerAction('view.zoom-out', {
        callback: () => {},
        enabled: () => false
    });
    actions.registerAction('view.zoom-fit', {
        callback: () => {},
        enabled: () => false
    });
}



let $gridDialog, $gridWidth, $gridSpacing, gridColorPicker, gridColorPickerVal;

function setupGridToggle() {
    actions.registerAction('view.toggle-grid', {
        name: () => state.config('grid').show ? strings['view.hide-grid.name'] : strings['view.show-grid.name'],
        callback: () => {
            let grid = $.extend({}, state.config('grid'));
            grid.show = !grid.show;
            state.config('grid', grid);
            triggerRefresh('chars');
        }
    });
}

function setupGridDialog() {
    $gridDialog = $('#grid-dialog');

    $gridWidth = $gridDialog.find('#grid-width');
    ALLOWED_GRID_WIDTHS.forEach(value => $('<option/>', { value: value, html: `${value}px` }).appendTo($gridWidth));

    $gridSpacing = $gridDialog.find('#grid-spacing');
    ALLOWED_GRID_SPACINGS.forEach(value => $('<option/>', { value: value, html: `${value} cell(s)` }).appendTo($gridSpacing));

    createDialog($gridDialog, () => {
        state.config('grid', $.extend({}, state.config('grid'), {
            show: true,
            width: parseInt($gridWidth.val()),
            spacing: parseInt($gridSpacing.val()),
            color: gridColorPickerVal
        }));
        triggerRefresh('chars');
        $gridDialog.dialog('close');
    }, 'Save', {
        minWidth: 400,
        maxWidth: 400,
        minHeight: 500,
        maxHeight: 500
    });

    const $colorPicker = $gridDialog.find('.color-picker');

    gridColorPicker = new Picker({
        parent: $colorPicker.get(0),
        popup: false,
        onChange: (color) => {
            gridColorPickerVal = color[state.COLOR_FORMAT];
        },
    });

    actions.registerAction('view.grid-settings',  () => openGridDialog());
}

function openGridDialog() {
    $gridWidth.val(state.config('grid').width);
    $gridSpacing.val(state.config('grid').spacing);
    gridColorPicker.setColor(state.config('grid').color, false);

    $gridDialog.dialog('open');
}
