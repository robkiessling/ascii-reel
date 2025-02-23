import $ from "jquery";
import * as state from "../state/state.js";
import * as actions from "../io/actions.js";
import Picker from 'vanilla-picker/csp';

import {createDialog} from "../utils/utilities.js";
import {resetExportDimensions} from "./file.js";
import {triggerRefresh, triggerResize} from "../index.js";
import {AVAILABLE_FONTS, calculateFontRatio} from "../canvas/fonts.js";
import {pushStateToHistory} from "../state/state.js";

export function init() {
    setupFontDialog();
    setupResizeDialog();
    setupBackgroundDialog();

    // TODO
    actions.registerAction('preferences', {
        name: 'Preferences',
        callback: () => {},
        enabled: () => false
    });
    actions.registerAction('keyboard-shortcuts', {
        name: 'Keyboard Shortcuts',
        callback: () => {},
        enabled: () => false
    });
}


// --------------------------------------------------------------- Font
let $fontDialog, $fontSelect;

function setupFontDialog() {
    $fontDialog = $('#font-dialog');
    $fontSelect = $fontDialog.find('#font-select');
    const $examples = $fontDialog.find('#font-examples');

    AVAILABLE_FONTS.forEach(font => {
        const fontName = font === 'monospace' ? 'System Default' : font;
        const style = `font-family: \"${font}\", monospace;`

        $('<option></option>', {
            value: font,
            html: fontName,
            style: style
        }).appendTo($fontSelect);

        $('<div/>', {
            html: `${fontName}<br> abcdefghijklmnopqrstuvwxyz<br/>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br/>1234567890!@#$%^&*()[]{}/\\|-_+=<>,.\`~`,
            style: style,
            class: 'font-example'
        }).appendTo($examples);
    })

    createDialog($fontDialog, () => {
        state.config('font', $fontSelect.val());

        calculateFontRatio();
        triggerResize(true);
        pushStateToHistory({ requiresResize: true, requiresCalculateFontRatio: true });

        $fontDialog.dialog('close');
    }, 'Save', {
        minWidth: 640,
        maxWidth: 640,
        // minHeight: 640,
        maxHeight: 640
    });

    actions.registerAction('settings.open-font-dialog', () => openFontDialog());
}

function openFontDialog() {
    $fontSelect.val(state.config('font'));
    $fontDialog.dialog('open');
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

    actions.registerAction('settings.open-resize-dialog', () => openResizeDialog());
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

    actions.registerAction('settings.open-background-dialog', () => openBackgroundDialog());
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
