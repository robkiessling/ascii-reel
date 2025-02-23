import $ from "jquery";
import {createDialog} from "../utils/utilities.js";
import * as state from "../state/state.js";
import {triggerRefresh} from "../index.js";
import Picker from "vanilla-picker";
import * as actions from "../io/actions.js";
import {strings} from "../config/strings.js";

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

function setupGridDialog() {
    $gridDialog = $('#grid-dialog');
    $gridWidth = $gridDialog.find('#grid-width');
    $gridSpacing = $gridDialog.find('#grid-spacing');

    createDialog($gridDialog, () => {
        state.config('grid', $.extend({}, state.config('grid'), {
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
