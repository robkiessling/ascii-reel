import * as state from "../../state/index.js";
import * as actions from "../../io/actions.js";
import {defer} from "../../utils/utilities.js";
import {createDialog} from "../../utils/dialogs.js";
import { supported as isFileSystemAPISupported } from 'browser-fs-access';
import * as fileSystem from "../../storage/file_system.js";
import {ValidationError} from "../../utils/errors.js";
import {exportAnimation} from "../../storage/exporter.js";
import DimensionsPicker from "../../components/dimensions_picker.js";
import BackgroundPicker from "../../components/background_picker.js";
import UnsavedWarning from "../../components/unsaved_warning.js";
import {modifierAbbr} from "../../utils/os.js";
import Toast from "../../components/toast.js";
import {DEFAULT_CONFIG} from "../../state/index.js";
import {eventBus, EVENTS} from "../../events/events.js";
import ColorModePicker from "../../components/color_mode_picker.js";
import ProjectTypePicker from "../../components/project_type_picker.js";
import ExportForm from "../../components/export_form.js";

export function init() {
    setupNew();
    setupOpen();
    setupSave();
    setupExport();
    setupEventBus();
}

function setupEventBus() {
    eventBus.on(EVENTS.STATE.LOADED, () => exportForm.loadFromLastExport())
}

function unhandledError(alertMessage = 'An error occurred', error) {
    console.error(error);
    alert(`${alertMessage}: ${error.message}`);
}


// --------------------------------------------------------------------------------- New File

function setupNew() {
    const $newFileDialog = $('#new-file-dialog');

    createDialog($newFileDialog, () => {
        if (dimensionsPicker.validate()) {
            fileSystem.resetHandles();

            state.loadNewState(
                projectTypePicker.value,
                [dimensionsPicker.value.numCols, dimensionsPicker.value.numRows],
                colorModePicker.value,
                backgroundPicker.value
            )

            $newFileDialog.dialog('close');
        }
    }, 'Create', {
        minHeight: 500,
        minWidth: 540
    });

    const projectTypePicker = new ProjectTypePicker($newFileDialog.find('.project-type-picker'))
    const dimensionsPicker = new DimensionsPicker($newFileDialog.find('.dimensions-area'));
    const colorModePicker = new ColorModePicker($newFileDialog.find('.color-mode-picker'), {
        onChange: value => backgroundPicker.mode = value
    })
    const backgroundPicker = new BackgroundPicker($newFileDialog.find('.background-picker'));
    const unsavedWarning = new UnsavedWarning($newFileDialog.find('.unsaved-warning-area'), {
        showCloseButton: true,
        onSave: () => eventBus.emit(EVENTS.FILE.CHANGED)
    })

    actions.registerAction('file.new', () => {
        unsavedWarning.toggle(state.hasCharContent());
        projectTypePicker.value = DEFAULT_CONFIG.projectType
        dimensionsPicker.value = {
            numRows: DEFAULT_CONFIG.dimensions[1],
            numCols: DEFAULT_CONFIG.dimensions[0]
        }
        colorModePicker.value = DEFAULT_CONFIG.colorMode
        backgroundPicker.mode = DEFAULT_CONFIG.colorMode;
        backgroundPicker.value = DEFAULT_CONFIG.background;
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
        onSave: () => eventBus.emit(EVENTS.FILE.CHANGED)
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
            .then(() => {
                $openFileDialog.dialog('close')
            })
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
        state.setConfig('name', $saveFileDialog.find('.name').val())

        fileSystem.saveFile()
            .then(() => {
                eventBus.emit(EVENTS.FILE.CHANGED);

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
            .then(() => eventBus.emit(EVENTS.FILE.CHANGED))
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
            eventBus.emit(EVENTS.FILE.CHANGED);

            new Toast({
                key: 'save-active-file',
                textCenter: true,
                duration: 5000,
                text: `Saved to "${state.getConfig('name')}.${fileSystem.FILE_EXTENSION}"`
            });
        })
        .catch(err => {
            if (!fileSystem.isPickerCanceledError(err)) unhandledError('Failed to save file', err);
        });
}


// --------------------------------------------------------------- Export

let $exportFileDialog, exportForm;

function setupExport() {
    $exportFileDialog = $('#export-file-dialog');

    exportForm = new ExportForm($exportFileDialog)

    createDialog($exportFileDialog, () => {
        exportFromForm();
    }, 'Export', {
        minWidth: 700,
        maxWidth: 700,
        minHeight: 600,
        maxHeight: 600
    });

    actions.registerAction('file.export-as', () => {
        exportForm.loadFromState();
        $exportFileDialog.dialog('open');
    });

    actions.registerAction('file.export-active', {
        enabled: () => fileSystem.hasActiveExport() && state.getConfig('lastExportOptions'),
        callback: () => exportActive()
    })
}

function exportFromForm() {
    let options;
    try {
        options = exportForm.validateOptions();
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
    if (!state.getConfig('lastExportOptions')) throw new Error(`no lastExportOptions found`);

    exportAnimation(state.getConfig('lastExportOptions'), true)
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

