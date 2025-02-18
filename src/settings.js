import $ from "jquery";
import * as state from "./state.js";
import * as actions from "./actions.js";
import Picker from 'vanilla-picker/csp';

import {confirmDialog, createDialog} from "./utilities.js";
import {resetExportDimensions} from "./file.js";
import {triggerRefresh} from "./index.js";

export function init() {
    setupResizeDialog();
    setupBackgroundDialog();

}


// --------------------------------------------------------------- Resize
let $resizeDialog;

function setupResizeDialog() {
    $resizeDialog = $('#resize-dialog');

    createDialog($resizeDialog, () => {
        resize(() => {
            resetExportDimensions();
            $resizeDialog.dialog('close');
        })
    }, 'Resize', {
        minWidth: 400,
        maxWidth: 400,
        minHeight: 400,
        maxHeight: 400
    });

    $resizeDialog.find('[name="aspect-ratio"]').on('change', evt => {
        const $rows = $resizeDialog.find('[name="rows"]');
        const $columns = $resizeDialog.find('[name="columns"]');

        $rows.off('input.ratio');
        $columns.off('input.ratio');

        if ($(evt.currentTarget).is(':checked')) {
            $rows.on('input.ratio', evt => {
                const rows = $(evt.currentTarget).val();
                const columns = Math.round(rows / state.numRows() * state.numCols());
                $columns.val(columns);
            }).trigger('input.ratio');
            $columns.on('input.ratio', evt => {
                const columns = $(evt.currentTarget).val();
                const rows = Math.round(columns / state.numCols() * state.numRows());
                $rows.val(rows);
            });
        }
    });

    $resizeDialog.on('click', '.anchor-option', evt => {
        $resizeDialog.find('.anchor-option').removeClass('selected');
        $(evt.currentTarget).addClass('selected');
    });

    // Initial option: middle/middle
    $resizeDialog.find('.anchor-option').removeClass('selected');
    $resizeDialog.find('.anchor-option[data-row-anchor="middle"][data-col-anchor="middle"]').addClass('selected');

    actions.registerAction('file.resize-canvas', () => openResizeDialog());
}

function openResizeDialog() {
    $resizeDialog.find('[name="rows"]').val(state.numRows());
    $resizeDialog.find('[name="aspect-ratio"]').prop('checked', true).trigger('change');

    $resizeDialog.dialog('open');
}

const MAX_ROWS = 500;
const MAX_COLUMNS = 500;

function resize(onSuccess) {
    let isValid = true;

    const rows = parseInt($resizeDialog.find('[name="rows"]').val());
    if (isNaN(rows) || rows > MAX_ROWS) {
        $resizeDialog.find('[name="rows"]').addClass('error');
        isValid = false;
    }

    const columns = parseInt($resizeDialog.find('[name="columns"]').val());
    if (isNaN(columns) || columns > MAX_COLUMNS) {
        $resizeDialog.find('[name="columns"]').addClass('error');
        isValid = false;
    }

    if (isValid) {
        const $anchor = $resizeDialog.find('.anchor-option.selected');
        state.resize([columns, rows], $anchor.data('row-anchor'), $anchor.data('col-anchor'));
        onSuccess();
    }
}

// --------------------------------------------------------------- Background
let $backgroundDialog, $backgroundTypes, backgroundColorPicker, backgroundColorPickerVal;
const DEFAULT_COLORED_BACKGROUND = 'rgba(160,208,230,1)';

function setupBackgroundDialog() {
    $backgroundDialog = $('#background-dialog');
    $backgroundTypes = $backgroundDialog.find('input[name="background-type"]');

    createDialog($backgroundDialog, () => {
        state.config('background', getBackgroundValue());
        triggerRefresh('full', true);
        $backgroundDialog.dialog('close');
    }, 'Save', {
        minWidth: 400,
        maxWidth: 400,
        minHeight: 450,
        maxHeight: 450
    });

    const $colorPickerContainer = $backgroundDialog.find('.color-picker-container');
    const $colorPicker = $colorPickerContainer.find('.color-picker');

    backgroundColorPicker = new Picker({
        parent: $colorPicker.get(0),
        popup: false,
        color: DEFAULT_COLORED_BACKGROUND,
        onChange: (color) => {
            backgroundColorPickerVal = color[state.COLOR_FORMAT];
        },
    });

    $backgroundTypes.on('change', () => {
        $colorPickerContainer.toggle(!!getBackgroundValue());
    });

    actions.registerAction('file.background-settings', () => openBackgroundDialog());
}

function openBackgroundDialog() {
    const radioValue = state.config('background') ? 'colored' : 'transparent';
    $backgroundTypes.filter(`[value="${radioValue}"]`).prop('checked', true).trigger('change');

    if (state.config('background')) {
        backgroundColorPicker.setColor(state.config('background'), false);
    }

    $backgroundDialog.dialog('open');
}

function getBackgroundValue() {
    if ($backgroundTypes.filter(':checked').val() === 'transparent') {
        return false;
    }

    return backgroundColorPickerVal;
}
