import * as state from "../state/state.js";
import * as actions from "../io/actions.js";

import {resetExportDimensions} from "./file.js";
import {triggerRefresh, triggerResize} from "../index.js";
import {calculateFontRatio} from "../canvas/font.js";
import {pushStateToHistory} from "../state/state.js";
import {AVAILABLE_FONTS} from "../config/fonts.js";
import {createDialog} from "../utils/dialogs.js";
import {recalculateBGColors} from "../canvas/background.js";
import BackgroundPicker from "../components/ui/background_picker.js";
import DimensionsPicker from "../components/ui/dimensions_picker.js";

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
        triggerResize({ clearSelection: true, resetZoom: true });
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

function setupResizeDialog() {
    const $resizeDialog = $('#resize-dialog');

    createDialog($resizeDialog, () => {
        if (dimensionsPicker.validate()) {
            const dim = dimensionsPicker.value;
            state.resize([dim.numCols, dim.numRows], dim.anchor.row, dim.anchor.col);

            resetExportDimensions();
            $resizeDialog.dialog('close');
        }
    }, 'Resize', {
        minWidth: 400,
        maxWidth: 400,
        minHeight: 440,
        maxHeight: 440
    });

    const dimensionsPicker = new DimensionsPicker($resizeDialog, {
        anchorTool: true
    });

    actions.registerAction('settings.open-resize-dialog', () => {
        dimensionsPicker.value = {
            numRows: state.numRows(),
            numCols: state.numCols()
        }
        $resizeDialog.dialog('open');
    });
}


// --------------------------------------------------------------- Background

function setupBackgroundDialog() {
    const $backgroundDialog = $('#background-dialog');

    createDialog($backgroundDialog, () => {
        state.config('background', backgroundPicker.value);
        recalculateBGColors();
        triggerRefresh('full', true);
        $backgroundDialog.dialog('close');
    }, 'Save');

    const backgroundPicker = new BackgroundPicker($backgroundDialog);

    actions.registerAction('settings.open-background-dialog', () => {
        backgroundPicker.value = state.config('background');
        $backgroundDialog.dialog('open');
    });
}
