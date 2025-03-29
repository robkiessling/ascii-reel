import dedent from "dedent-js";
import Color from "@sphinxxxx/color-conversion";

import * as state from "../state/state.js";
import * as actions from "../io/actions.js";
import {defer} from "../utils/utilities.js";
import {fontRatio} from "../canvas/font.js";
import {createDialog} from "../utils/dialogs.js";
import exampleExportImg from "../../images/example-export.png";
import SimpleBar from "simplebar";
import { supported as isFileSystemAPISupported } from 'browser-fs-access';
import * as fileSystem from "../state/file_system.js";
import {ValidationError} from "../utils/errors.js";
import {exportAnimation} from "../state/exporter.js";
import DimensionsPicker from "../components/ui/dimensions_picker.js";
import BackgroundPicker from "../components/ui/background_picker.js";
import UnsavedWarning from "../components/ui/unsaved_warning.js";
import {defaultContrastColor} from "../components/palette.js";
import {modifierAbbr} from "../utils/os.js";
import Toast from "../components/ui/toast.js";
import {triggerRefresh} from "../index.js";

export function init() {
    setupNew();
    setupOpen();
    setupSave();
    setupExport();
}

// --------------------------------------------------------------------------------- New File

function setupNew() {
    const $newFileDialog = $('#new-file-dialog');

    createDialog($newFileDialog, () => {
        if (dimensionsPicker.validate()) {
            const dim = dimensionsPicker.value;

            fileSystem.resetHandles();

            state.newState({
                config: {
                    dimensions: [dim.numCols, dim.numRows],
                    background: backgroundPicker.value,
                    primaryColor: defaultContrastColor(backgroundPicker.value)
                }
            })

            $newFileDialog.dialog('close');
        }
    }, 'Create', {
        minWidth: 520
    });

    const dimensionsPicker = new DimensionsPicker($newFileDialog.find('.dimensions-area'));
    const backgroundPicker = new BackgroundPicker($newFileDialog.find('.background-area'));
    const unsavedWarning = new UnsavedWarning($newFileDialog.find('.unsaved-warning-area'), {
        showCloseButton: true,
        onSave: () => triggerRefresh('menu') // For new file name
    })

    actions.registerAction('file.new', () => {
        unsavedWarning.toggle(state.hasCharContent());
        dimensionsPicker.value = {
            numRows: state.CONFIG_DEFAULTS.dimensions[1],
            numCols: state.CONFIG_DEFAULTS.dimensions[0]
        }
        backgroundPicker.value = false; // Transparent
        $newFileDialog.dialog('open');
    });
}


// --------------------------------------------------------------------------------- Open File

// We show a short 'Open File' dialog purely to warn the user if their existing content will be overridden.
const $openFileDialog = $('#open-file-dialog');

function setupOpen() {
    createDialog($openFileDialog, () => {
        openFilePicker();
    }, 'Open File', {
        minWidth: 520
    });

    const unsavedWarning = new UnsavedWarning($openFileDialog.find('.unsaved-warning-area'), {
        successStringId: 'file.save-warning-cleared', // show a message since otherwise the dialog is completely blank
        onSave: () => triggerRefresh('menu') // For new file name
    })

    actions.registerAction('file.open', () => {
        if (state.hasCharContent()) {
            unsavedWarning.toggle(true);
            $openFileDialog.dialog('open');
        } else {
            openFilePicker()
        }
    });
}

function openFilePicker() {
    // Defer so main menu has time to close
    defer(() => {
        fileSystem.openFile()
            .then(() => $openFileDialog.dialog('close'))
            .catch(err => {
                if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to open file', err);
            })
    });
}


// --------------------------------------------------------------------------------- Save File

// This dialog is only used for browsers that do not support File System API (so we can name their downloaded file)
const $saveFileDialog = $('#save-file-dialog');

function setupSave() {
    createDialog($saveFileDialog, () => {
        state.config('name', $saveFileDialog.find('.name').val())

        fileSystem.saveFile()
            .then(() => {
                triggerRefresh('menu'); // For new file name

                $saveFileDialog.dialog('close')
            })
            .catch(err => {
                if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to save file', err);
            });
    });

    actions.registerAction('file.save-as', () => saveAs());

    actions.registerAction('file.save-active', {
        enabled: () => fileSystem.hasActiveFile(),
        callback: () => saveActive(),
        shortcutAbbr: `${modifierAbbr('metaKey')}S` // Show shortcut here, but cmd-S really goes to file.save
    })

    // The following action is NOT shown in the toolbar anywhere, but it is what cmd-S links to. That way
    // cmd-S always goes to one of our saves (saveAs/saveActive) instead of default browser save.
    actions.registerAction('file.save', () => fileSystem.hasActiveFile() ? saveActive() : saveAs());
}

/**
 * Saving the file to disk works differently based on whether the browser supports the File System API.
 *
 * If File System API is supported:
 * - An OS dialog will open allowing the user to name the file and save it to a location of their choosing.
 * - We will receive a handler after saving so that the saveActive functionality works (allowing us to directly update
 *   the file on their OS instead of having to re-download it each time).
 *
 * If File System API is not supported:
 * - We have to show our manually-created $saveFileDialog so that the user can name the file.
 * - Once they click 'OK' after naming the file, it will be downloaded directly to their /Downloads folder.
 */
function saveAs() {
    if (isFileSystemAPISupported) {
        fileSystem.saveFile()
            .then(() => triggerRefresh('menu')) // For new file name
            .catch(err => {
                if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to save file', err);
            });
    } else {
        $saveFileDialog.find('.name').val(state.getName());
        $saveFileDialog.find('.extension').html(`.${fileSystem.FILE_EXTENSION}`);
        $saveFileDialog.dialog('open');
    }
}

// Saves the file to the current active handler (directly updates the file on their OS)
function saveActive() {
    fileSystem.saveFile(true)
        .then(() => {
            triggerRefresh('menu'); // For new file name

            new Toast({
                key: 'save-active-file',
                textCenter: true,
                duration: 5000,
                text: `Saved to "${state.config('name')}.${fileSystem.FILE_EXTENSION}"`
            });
        })
        .catch(err => {
            if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to save file', err);
        });
}


// --------------------------------------------------------------- Export

const DEFAULT_FONT_SIZE = 16;

const EXPORT_OPTIONS = {
    png: ['width', 'height', 'background', 'frames', 'spritesheetColumns', 'spritesheetRows'],
    txt: ['frames', 'frameSeparator'],
    rtf: ['fontSize', 'background', 'frames', 'frameSeparator'],
    html: ['fontSize', 'fps', 'background', 'loop'],
    gif: ['width', 'height', 'fps', 'background'],
    json: ['frameStructure', 'colorFormat', 'mergeCharRows'],
    webm: ['width', 'height', 'fps', 'background']
}

const SHOW_EXPORT_PREVIEW_FOR = ['json']

// The following options are visible only if 'frames' is set to the given value
const EXPORT_FRAMES_DEPENDENCIES = {
    spritesheetColumns: 'spritesheet',
    spritesheetRows: 'spritesheet',
    frameSeparator: 'spritesheet'
}

const EXPORT_OPTION_VALIDATORS = {
    fontSize: { type: 'float' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    fps: { type: 'integer' }, // todo if > 1
    spritesheetColumns: { type: 'integer' },
    spritesheetRows: { type: 'integer' }
}

let $exportFileDialog, $exportFormat, $exportOptions, $exportPreview;
let firstTimeOpeningExport = true;
let exportTextSimpleBar;

function setupExport() {
    $exportFileDialog = $('#export-file-dialog');
    $exportFormat = $exportFileDialog.find('#export-file-format');
    $exportOptions = $exportFileDialog.find('#export-options');
    $exportPreview = $exportFileDialog.find('#example-container');

    createDialog($exportFileDialog, () => {
        exportFromForm();
    }, 'Export', {
        minWidth: 700,
        maxWidth: 700,
        minHeight: 600,
        maxHeight: 600
    });

    $exportFormat.on('change', evt => {
        const format = $(evt.currentTarget).val();
        $exportOptions.find('label').hide();

        EXPORT_OPTIONS[format].forEach(option => {
            $exportOptions.find(`[name="${option}"]`).closest('label').show();
        });

        toggleExportPreview(format);

        if (!state.config('background')) $exportOptions.find(`[name="background"]`).closest('label').hide();
        $('#spritesheet-png-warning').toggle(showPngSpritesheetWarning());

        if (EXPORT_OPTIONS[format].includes('frames')) {
            $exportOptions.find('[name="frames"]').trigger('change');
        }
    });

    $exportOptions.find('[name="frames"]').on('change', evt => {
        const framesValue = $(evt.currentTarget).val();
        for (let [option, dependency] of Object.entries(EXPORT_FRAMES_DEPENDENCIES)) {
            $exportOptions.find(`[name="${option}"]`).closest('label').toggle(
                EXPORT_OPTIONS[$exportFormat.val()].includes(option) && framesValue === dependency
            );
        }

        $('#spritesheet-png-warning').toggle(showPngSpritesheetWarning());
    });

    $exportOptions.find('[name="width"]').on('input', evt => {
        const width = $(evt.currentTarget).val();
        const height = Math.round(width / state.numCols() * state.numRows() / fontRatio);
        $exportOptions.find('[name="height"]').val(height);
    });
    $exportOptions.find('[name="height"]').on('input', evt => {
        const height = $(evt.currentTarget).val();
        const width = Math.round(height / state.numRows() * state.numCols() * fontRatio);
        $exportOptions.find('[name="width"]').val(width);
    });

    actions.registerAction('file.export-as', () => openExportDialog());

    actions.registerAction('file.export-active', {
        enabled: () => fileSystem.hasActiveExport(),
        callback: () => exportActive()
    })

    exportTextSimpleBar = new SimpleBar($('#example-text').get(0), {
        autoHide: false,
        forceVisible: true
    });
}

function toggleExportPreview(format) {
    const showPreview = SHOW_EXPORT_PREVIEW_FOR.includes(format);
    $exportPreview.toggle(showPreview);
    $exportOptions.find('input, select').off('change.example-text');

    if (showPreview) {
        $exportOptions.find('input, select').on('change.example-text', () => refreshPreview());
        refreshPreview();
    }

    function refreshPreview() {
        $exportPreview.find('#example-img').attr('src', exampleExportImg);
        let options;

        try {
            options = validateExportOptions();
        } catch (err) {
            if (err instanceof ValidationError) {
                $exportPreview.find('#example-text pre').html('Invalid options selected above.');
                return;
            } else {
                throw err;
            }
        }

        switch(format) {
            case 'json':
                return refreshJsonExportPreview(options);
            default:
                console.warn(`No preview handler for ${format}`)
        }
    }
}


function openExportDialog() {
    $exportFileDialog.dialog('open');

    $exportOptions.find(`[name="fps"]`).val(state.config('fps'));

    // If it's the first time opening the export dialog, set its values according to the last saved export settings
    if (firstTimeOpeningExport && state.config('lastExportOptions')) {
        // TODO format should be part of the options
        $exportFormat.val(state.config('lastExportOptions').format);
        if (!$exportFormat.val()) $exportFormat.val($exportFormat.find('option:first').val()); // Failsafe

        for (const [key, value] of Object.entries(state.config('lastExportOptions'))) {
            const $input = $exportOptions.find(`[name="${key}"]`);
            $input.is(':checkbox') ? $input.prop('checked', !!value) : $input.val(value);
        }

        firstTimeOpeningExport = false;
    }

    const $width = $exportOptions.find(`[name="width"]`);
    if (!$width.val()) {
        // Default dimensions should be multiplied by the devicePixelRatio so that they don't appear
        // blurry when downloaded. Reducing the image size smaller can actually increase blurriness
        // due to rastering. https://stackoverflow.com/questions/55237929/ has a similar problem I faced.
        $width.val(state.numCols() * DEFAULT_FONT_SIZE * window.devicePixelRatio).trigger('input');
    }

    const $fontSize = $exportOptions.find(`[name="fontSize"]`);
    if (!$fontSize.val()) {
        $fontSize.val(DEFAULT_FONT_SIZE);
    }

    const $spritesheetRows = $exportOptions.find(`[name="spritesheetRows"]`);
    const $spritesheetCols = $exportOptions.find(`[name="spritesheetColumns"]`);
    if (!$spritesheetRows.val() && !$spritesheetCols.val()) {
        const { rows, cols } = optimalSpritesheetLayout();
        $spritesheetRows.val(rows);
        $spritesheetCols.val(cols);
    }

    $exportFormat.trigger('change');
}

function optimalSpritesheetLayout() {
    const frameCount = state.frames().length;

    if (frameCount <= 0) return { rows: 0, cols: 0 };

    const rows = Math.ceil(Math.sqrt(frameCount));
    const cols = Math.ceil(frameCount / rows);

    return { rows, cols };
}

// Resets the export width input, so that the next time the export dialog is opened it recalculates good defaults
// for exported width/height
export function resetExportDimensions() {
    $exportOptions.find(`[name="width"]`).val('');
}

function exportFromForm() {
    let options;
    try {
        options = validateExportOptions();
    } catch (err) {
        if (err instanceof ValidationError) return; // Form errors will be highlighted in red so user can try again
        unhandledError('Failed to parse form', err);
    }

    exportAnimation(options)
        .then(() => {
            $exportFileDialog.dialog('close');
        })
        .catch(err => {
            if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to export file', err);
        })
}

function exportActive() {
    if (!state.config('lastExportOptions')) throw new Error(`no lastExportOptions found`);

    exportAnimation(state.config('lastExportOptions'), true)
        .then(filename => {
            new Toast({
                key: 'export-active-file',
                textCenter: true,
                duration: 5000,
                text: filename ? `Exported to "${filename}"` : 'Export finished.'
            });
        })
        .catch(err => {
            if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to export file', err);
        })
}

// TODO Special case: do not allow spritesheet export with png
function showPngSpritesheetWarning() {
    return $exportFormat.val() === 'png' && $exportOptions.find(`[name="frames"]`).val() === 'spritesheet';
}

function validateExportOptions() {
    $exportOptions.find('.error').removeClass('error');

    let options = {
        format: $exportFormat.val()
    };
    let isValid = true;

    if (showPngSpritesheetWarning()) {
        isValid = false;
    }

    EXPORT_OPTIONS[options.format].forEach(option => {
        // Special case: skip option if it is dependent on a different 'frames' value
        if (EXPORT_FRAMES_DEPENDENCIES[option] !== undefined) {
            const framesValue = $exportOptions.find(`[name="frames"]`).val();
            if (EXPORT_FRAMES_DEPENDENCIES[option] !== framesValue) {
                return;
            }
        }

        const $input = $exportOptions.find(`[name="${option}"]`);
        let value = $input.val();
        if ($input.is(':checkbox')) value = $input.is(':checked');

        if (EXPORT_OPTION_VALIDATORS[option]) {
            switch(EXPORT_OPTION_VALIDATORS[option].type) {
                case 'integer':
                    value = parseInt(value);
                    if (isNaN(value)) {
                        $input.addClass('error');
                        isValid = false;
                    }
                    break;
                case 'float':
                    value = parseFloat(value);
                    if (isNaN(value)) {
                        $input.addClass('error');
                        isValid = false;
                    }
                    break;
                default:
                    console.warn(`No validator found for: ${EXPORT_OPTION_VALIDATORS[option].type}`);
            }
        }

        options[option] = value;
    });

    if (!isValid) throw new ValidationError("Form is invalid");

    return options;
}

function refreshJsonExportPreview(options) {
    let frameExample = '';

    const getColor = (colorStr) => {
        const color = new Color(colorStr);
        switch (options.colorFormat) {
            case 'hex-str':
                return `'${color.hex}'`
            case 'rgba-str':
                return `'${color.rgbaString}'`
            case 'rgba-array':
                return `[${color.rgba.join(',')}]`
            default:
                return 'Invalid'
        }
    }
    const getCharRow = (str) => {
        return options.mergeCharRows ? `'${str}'` : `[${str.split('').map(char => `'${char}'`).join(', ')}]`
    }

    switch(options.frameStructure) {
        case 'array-chars':
            frameExample = dedent`
            {
                fps: 0,
                background: null,
                frames: [
                    ${getCharRow('aa')},
                    ${getCharRow('bb')},
                    ${getCharRow('%!')},
                ]
            }
            `;
            break;
        case 'obj-chars':
            frameExample = dedent`
            {
                fps: 0,
                background: null,
                frames: [
                    {
                        chars: [
                            ${getCharRow('aa')},
                            ${getCharRow('bb')},
                            ${getCharRow('%!')},
                        ]
                    }
                ]
            }`
            break;
        case 'obj-chars-colors':
            frameExample = dedent`
            {
                fps: 0,
                background: null,
                frames: [
                    {
                        chars: [
                            ${getCharRow('aa')},
                            ${getCharRow('bb')},
                            ${getCharRow('%!')},
                        ],
                        colors: [
                            [ ${getColor('#000000ff')}, ${getColor('#ff0000ff')} ],
                            [ ${getColor('#0000ffff')}, ${getColor('#ff0000ff')} ],
                            [ ${getColor('#00ff00ff')}, ${getColor('#ff0000ff')} ]
                        ]
                    }
                ]
            }`
            break;
        case 'obj-chars-colors-colorTable':
            frameExample = dedent`
            {
                fps: 0,
                background: null,
                frames: [
                    {
                        chars: [
                            ${getCharRow('aa')},
                            ${getCharRow('bb')},
                            ${getCharRow('%!')},
                        ],
                        colors: [
                            [ 0, 1 ],
                            [ 2, 1 ],
                            [ 3, 1 ]
                        ]
                    }
                ],
                colorTable: [
                    ${getColor('#000000ff')},
                    ${getColor('#ff0000ff')},
                    ${getColor('#0000ffff')},
                    ${getColor('#00ff00ff')}
                ]
            }`
            break;
        default:
            console.warn(`Unknown frameStructure: ${options.frameStructure}`);
    }

    $exportPreview.find('#example-text pre').html(frameExample);
    exportTextSimpleBar.recalculate();
}


function unhandledError(alertMessage = 'An error occurred', error) {
    console.error(error);
    alert(`${alertMessage}: ${error.message}`);
}
