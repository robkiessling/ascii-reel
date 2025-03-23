import dedent from "dedent-js";
import Color from "@sphinxxxx/color-conversion";

import * as state from "../state/state.js";
import * as actions from "../io/actions.js";
import {setIntervalUsingRAF, defer} from "../utils/utilities.js";
import CanvasControl from "../canvas/canvas.js";
import {fontRatio} from "../canvas/font.js";
import {createDialog} from "../utils/dialogs.js";
import exampleExportImg from "../../images/example-export.png";
import {importJSZip, importAnimated_GIF} from "../utils/lazy_loaders.js";
import SimpleBar from "simplebar";
import { supported as isFileSystemAPISupported } from 'browser-fs-access';
import {
    hasActiveFile,
    openFile,
    FILE_EXTENSION,
    saveFile,
    saveToActiveFile,
    exportFile, isPickerCanceledError
} from "../state/file_system.js";
import DimensionsPicker from "../components/ui/dimensions_picker.js";
import BackgroundPicker from "../components/ui/background_picker.js";
import UnsavedWarning from "../components/ui/unsaved_warning.js";
import {defaultContrastColor} from "../components/palette.js";
import {modifierAbbr} from "../utils/os.js";
import Toast from "../components/ui/toast.js";
import {ValidationError} from "../utils/errors.js";

export function init() {
    setupNew();
    setupOpen();
    setupSave();
    setupExport();
}

function setupNew() {
    const $newFileDialog = $('#new-file-dialog');

    createDialog($newFileDialog, () => {
        if (dimensionsPicker.validate()) {
            const dim = dimensionsPicker.value;

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
        showCloseButton: true
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


// We show a short 'Open File' dialog purely to warn the user if their existing content will be overridden.
const $openFileDialog = $('#open-file-dialog');

function setupOpen() {
    createDialog($openFileDialog, () => {
        openFilePicker();
    }, 'Open File', {
        minWidth: 520
    });

    const unsavedWarning = new UnsavedWarning($openFileDialog.find('.unsaved-warning-area'), {
        successStringId: 'file.save-warning-cleared' // show a message since otherwise the dialog is completely blank
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
    defer(() => { // Defer so main menu has time to close
        openFile()
            .then(data => {
                if (data) { // data can be undefined if user cancels the dialog
                    $openFileDialog.dialog('close');
                    state.load(data);
                }
            })
            .catch(error => alert(`Failed to open file: ${error.message}`))
    });
}


/**
 * Saving the file to disk works differently based on whether the browser supports the File System API.
 *
 * If File System API is supported:
 * - An OS dialog will open allowing the user to name the file and save it to a location of their choosing.
 * - We will receive a handler after saving so that the save-active functionality works (allowing us to directly update
 *   the file on their OS instead of having to re-download it each time).
 *
 * If File System API is not supported:
 * - We have to show our manually-created #save-file-dialog so that the user can name the file.
 * - Once they click 'OK' after naming the file, it will be downloaded directly to their /Downloads folder.
 */
function setupSave() {
    // This dialog is only used for browsers that do not support File System API (so we can name their downloaded file)
    const $saveFileDialog = $('#save-file-dialog');
    createDialog($saveFileDialog, () => {
        state.config('name', $saveFileDialog.find('.name').val())

        saveFile()
            .then(() => $saveFileDialog.dialog('close'))
            .catch(error => alert(`Failed to save file: ${error.message}`));
    });

    function saveAs() {
        if (isFileSystemAPISupported) {
            saveFile().catch(error => alert(`Failed to save file: ${error.message}`))
        } else {
            $saveFileDialog.find('.name').val(state.getName());
            $saveFileDialog.find('.extension').html(`.${FILE_EXTENSION}`);
            $saveFileDialog.dialog('open');
        }
    }

    function saveActive() {
        saveToActiveFile()
            .then(saved => {
                if (saved) {
                    new Toast({
                        key: 'save-active-file',
                        textCenter: true,
                        duration: 5000,
                        text: `Saved to "${state.config('name')}.${FILE_EXTENSION}"`
                    });
                }
            })
            .catch(error => alert(`Failed to save file: ${error.message}`));
    }

    actions.registerAction('file.save-as', () => saveAs());

    actions.registerAction('file.save-active', {
        enabled: () => hasActiveFile(),
        callback: () => saveActive(),
        shortcutAbbr: `${modifierAbbr('metaKey')}S` // Show shortcut here, but cmd-S really goes to file.save
    })

    // The following action is NOT shown in the toolbar anywhere, but it is what cmd-S links to. That way
    // cmd-S always goes to one of our saves (saveAs/saveActive) instead of default browser save.
    actions.registerAction('file.save', () => hasActiveFile() ? saveActive() : saveAs());
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
let $exportCanvasContainer, exportCanvas;
let firstTimeOpeningExport = true;
let exportTextSimpleBar;

function setupExport() {
    $exportFileDialog = $('#export-file-dialog');
    $exportFormat = $exportFileDialog.find('#export-file-format');
    $exportOptions = $exportFileDialog.find('#export-options');
    $exportPreview = $exportFileDialog.find('#example-container');
    $exportCanvasContainer = $('#export-canvas-container');
    exportCanvas = new CanvasControl($('#export-canvas'), {
        willReadFrequently: true
    });

    createDialog($exportFileDialog, () => {
        processExport().then(() => {
            $exportFileDialog.dialog('close');
        }).catch(err => {
            if (!(err instanceof ValidationError) && !isPickerCanceledError(err)) {
                // An unhandled error occurred
                alert(`Failed to export: ${err}`);
            }
        })
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

    actions.registerAction('file.export', () => openExportDialog());

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

async function processExport() {
    const options = validateExportOptions();

    state.vacuumColorTable(); // We embed the colorTable into some formats; this ensures it is as small as possible

    switch($exportFormat.val()) {
        case 'json':
            await exportJson(options);
            break;
        case 'png':
            await exportPng(options);
            break;
        case 'txt':
            await exportTxt(options);
            break;
        case 'rtf':
            await exportRtf(options);
            break;
        case 'html':
            await exportHtml(options);
            break;
        case 'gif':
            await exportGif(options);
            break;
        case 'webm':
            await exportWebm(options);
            break;
        default:
            console.error(`Invalid export format: ${options.format}`);
            return;
    }

    state.config('lastExportOptions', options);
}

// TODO Special case: do not allow spritesheet export with png
function showPngSpritesheetWarning() {
    return $exportFormat.val() === 'png' && $exportOptions.find(`[name="frames"]`).val() === 'spritesheet';
}

function validateExportOptions() {
    $exportOptions.find('.error').removeClass('error');

    let options = {};
    let isValid = true;

    if (showPngSpritesheetWarning()) {
        isValid = false;
    }

    EXPORT_OPTIONS[$exportFormat.val()].forEach(option => {
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

async function exportJson(options = {}) {
    const encodeColor = (colorStr) => {
        const color = new Color(colorStr);
        switch (options.colorFormat) {
            case 'hex-str':
                return color.hex
            case 'rgba-str':
                return color.rgbaString
            case 'rgba-array':
                return color.rgba
            default:
                return null
        }
    }

    const blobPromise = lazyBlobPromise(async () => {
        const jsonData = {
            width: state.numCols(),
            height: state.numRows(),
            fps: state.config('fps'),
            background: state.config('background') ? encodeColor(state.config('background')) : null,
            frames: []
        }

        state.frames().forEach((frame, i) => {
            const glyphs = state.layeredGlyphs(frame, { showAllLayers: true, convertEmptyStrToSpace: true });
            let jsonFrame;
            switch (options.frameStructure) {
                case 'array-chars':
                    jsonFrame = glyphs.chars;
                    if (options.mergeCharRows) jsonFrame = jsonFrame.map(row => row.join(''));
                    break;
                case 'obj-chars':
                    jsonFrame = { chars: glyphs.chars };
                    if (options.mergeCharRows) jsonFrame.chars = jsonFrame.chars.map(row => row.join(''));
                    break;
                case 'obj-chars-colors':
                    jsonFrame = { chars: glyphs.chars, colors: glyphs.colors };
                    if (options.mergeCharRows) jsonFrame.chars = jsonFrame.chars.map(row => row.join(''));
                    jsonFrame.colors = jsonFrame.colors.map(row => row.map(colorIndex => {
                        return encodeColor(state.colorStr(colorIndex))
                    }));
                    break;
                case 'obj-chars-colors-colorTable':
                    jsonFrame = { chars: glyphs.chars, colors: glyphs.colors };
                    if (options.mergeCharRows) jsonFrame.chars = jsonFrame.chars.map(row => row.join(''));
                    jsonData.colorTable = state.colorTable().map(colorStr => encodeColor(colorStr))
                    break;
            }
            jsonData.frames.push(jsonFrame);
        });

        return new Blob([JSON.stringify(jsonData)], { type: "application/json" });
    })

    await exportFile(blobPromise, 'json', 'application/json')
}


/**
 * options:
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - frameSeparator: (only applicable if frames:spritesheet) characters to separate frames with
 */
async function exportTxt(options = {}) {
    let blobPromise;

    switch(options.frames) {
        case 'current':
            blobPromise = lazyBlobPromise(async () => {
                const txtContent = frameToTxt(state.currentFrame(), options);
                return new Blob([txtContent], {type: "text/plain"});
            })
            await exportFile(blobPromise, 'txt', 'text/plain')
            break;
        case 'spritesheet':
            blobPromise = lazyBlobPromise(async () => {
                let txtContent = '';
                for (const [index, frame] of state.frames().entries()) {
                    txtContent += buildFrameSeparator(options, index, '\n');
                    txtContent += frameToTxt(frame, options);
                }
                return new Blob([txtContent], {type: "text/plain"});
            })
            await exportFile(blobPromise, 'txt', 'text/plain')
            break;
        case 'zip':
            blobPromise = lazyBlobPromise(async () => {
                const JSZip = await importJSZip();
                const zip = new JSZip();

                for (const [index, frame] of state.frames().entries()) {
                    zip.file(`${index}.txt`, frameToTxt(frame, options));
                }
                return zip.generateAsync({type:"blob"});
            });
            await exportFile(blobPromise, 'zip', 'application/zip');
            break;
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}

function frameToTxt(frame, options) {
    return exportableFrameString(frame, '\n');
}

/**
 * options:
 *  - fontSize: font size
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - frameSeparator: (only applicable if frames:spritesheet) character to separate frames with
 *
 * For more information on RTF format: https://www.oreilly.com/library/view/rtf-pocket-guide/9781449302047/ch01.html
 */
async function exportRtf(options) {
    let blobPromise;

    switch(options.frames) {
        case 'current':
            blobPromise = lazyBlobPromise(async () => {
                const rtfFrame = frameToRtf(state.currentFrame(), options);
                const rtfFile = buildRtfFile(rtfFrame, options);
                return new Blob([rtfFile], {type: "application/rtf"});
            });
            await exportFile(blobPromise, 'rtf', 'application/rtf');
            break;
        case 'spritesheet':
            blobPromise = lazyBlobPromise(async () => {
                let rtfContent = '';
                for (const [index, frame] of state.frames().entries()) {
                    rtfContent += `{\\cf0 ${buildFrameSeparator(options, index, '\\line ')}}`; // use index 0 of color table
                    rtfContent += frameToRtf(frame, options);
                }
                const rtfFile = buildRtfFile(rtfContent, options);
                return new Blob([rtfFile], {type: "application/rtf"});
            });
            await exportFile(blobPromise, 'rtf', 'application/rtf');
            break;
        case 'zip':
            blobPromise = lazyBlobPromise(async () => {
                const JSZip = await importJSZip();
                const zip = new JSZip();

                for (const [index, frame] of state.frames().entries()) {
                    const rtfFrame = frameToRtf(frame, options);
                    const rtfFile = buildRtfFile(rtfFrame, options);
                    zip.file(`${index}.rtf`, rtfFile);
                }
                return zip.generateAsync({type:"blob"});
            });
            await exportFile(blobPromise, 'zip', 'application/zip');
            break;
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}


function buildRtfFile(content, options) {
    function _encodeRtfColor(colorStr) {
        const [r, g, b, a] = new Color(colorStr).rgba; // Break colorStr into rgba components
        return `\\red${r}\\green${g}\\blue${b}`; // Note: alpha cannot be shown in rtf
    }

    // Value fmodern tells the OS to use a monospace font in case the given font is not found
    const fontTable = `{\\fonttbl {\\f0\\fmodern ${state.config('font')};}}`;

    const rtfColors = [
        // First color (black) reserved for frameSeparators
        _encodeRtfColor('rgba(0,0,0,1)'),

        // Second color reserved for background
        _encodeRtfColor(state.config('background') ? state.config('background') : 'rgba(0,0,0,1)'),

        // Then merge in all colors used in the drawing
        ...state.colorTable().map(colorStr => _encodeRtfColor(colorStr))
    ]

    const colorTable = `{\\colortbl ${rtfColors.join(';')};}`;

    // rtf font size is in half pt, so multiply desired font size by 2
    const fontSize = options.fontSize * 2;

    return `{\\rtf1\\ansi\\deff0 ${fontTable}${colorTable}\\f0\\fs${fontSize} ${content}}`;
}

function frameToRtf(frame, options) {
    // char background: use index 1 of color table. Note: chshdng / chcbpat is for MS Word compatibility
    const charBg = options.background && state.config('background') ? `\\chshdng0\\chcbpat${1}\\cb${1}` : '';

    return exportableFrameString(frame, '\\line ', line => {
        // The first replace handles special RTF chars: { } \
        // The next 3 replace calls handle escaping unicode chars (see oreilly doc above for more info)
        const escapedText = line.text
            .replace(/[{}\\]/g, match => "\\" + match) // Escape special RTF chars: { } \
            .replace(/[\u0080-\u00FF]/g, match => `\\'${match.charCodeAt(0).toString(16)}`)
            .replace(/[\u0100-\u7FFF]/g, match => `\\uc1\\u${match.charCodeAt(0)}*`)
            .replace(/[\u8000-\uFFFF]/g, match => `\\uc1\\u${match.charCodeAt(0)-0xFFFF}*`)

        // For foreground color, add 2 to colorIndex since we prepended 2 colors to the color table
        return `{\\cf${line.colorIndex + 2}${charBg} ${escapedText}}`;
    })
}


/**
 * options:
 *  - fontSize: font size
 *  - fps: frames per second
 *  - background: (boolean) whether to include background or not TODO
 *  - loop: (boolean) whether to loop the animation continuously
 */
async function exportHtml(options) {
    const blobPromise = lazyBlobPromise(async () => {
        const frames = state.frames().map(frame => {
            return exportableFrameString(frame, '<br>', line => `<span style="color:${state.colorStr(line.colorIndex)};">${line.text}</span>`)
        });

        // <script> that will animate the <pre> contents
        const script = `
            document.addEventListener("DOMContentLoaded", function() {
                var sprite = document.getElementById('sprite');
                var frames = ${JSON.stringify(frames)};
                var fps = ${frames.length > 1 ? options.fps : 0};
                var loop = ${options.loop};
                var frameIndex = 0;
    
                function draw() {
                    sprite.innerHTML = frames[frameIndex];
                    frameIndex++;
                    if (frameIndex >= frames.length) { 
                        frameIndex = 0;
                    }
                    if (fps !== 0 && (loop || frameIndex !== 0)) { 
                        setTimeout(draw, 1000 / fps); 
                    }
                }
                
                draw();
            });
        `;

        const width = state.numCols() * options.fontSize * fontRatio;
        const background = options.background && state.config('background') ? `background: ${state.config('background')};` : '';
        const fontStyles = `font-family: ${state.fontFamily()};font-size: ${options.fontSize}px;`;

        const body = `<pre id="sprite" style="width:${width}px;${background};${fontStyles}"></pre>`;
        const html = createHTMLFile(state.getName(), script, body);
        return new Blob([html], {type: "text/html"});
    });

    await exportFile(blobPromise, 'html', 'text/html');
}

/**
 * options:
 *  - width: width of result
 *  - height: height of result
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - spritesheetColumns: # of columns in the spritesheet todo
 *  - spritesheetRows: # of rows in the spritesheet todo
 */
async function exportPng(options) {
    try {
        setupExportCanvas(options);
        let blobPromise;

        switch(options.frames) {
            case 'current':
                blobPromise = lazyBlobPromise(() => {
                    renderExportFrame(state.currentFrame(), options);
                    return canvasToBlob(exportCanvas.canvas);
                })
                await exportFile(blobPromise, 'png', 'image/png');
                break;
            case 'spritesheet':
                // TODO implement this
                console.error('not yet implemented');
                break;
            case 'zip':
                blobPromise = lazyBlobPromise(async () => {
                    const JSZip = await importJSZip();
                    const zip = new JSZip();

                    for (const [index, frame] of state.frames().entries()) {
                        renderExportFrame(frame, options);
                        zip.file(`${index}.png`, canvasToBlob(exportCanvas.canvas));
                    }

                    return zip.generateAsync({type:"blob"});
                })
                await exportFile(blobPromise, 'zip', 'application/zip');
                break;
            default:
                console.error(`Invalid options.frames: ${options.frames}`);
        }
    } finally {
        hideExportCanvas();
    }
}


/**
 * options:
 *  - width: width of result
 *  - height: height of result
 *  - fps: frames per second
 *  - background: (boolean) whether to include background or not
 */
async function exportGif(options) {
    let animatedGif;

    try {
        setupExportCanvas(options);

        const blobPromise = lazyBlobPromise(async () => {
            const Animated_GIF = await importAnimated_GIF();

            animatedGif = new Animated_GIF.default({
                // disposal value of 2 => Restore to background color after each frame
                // https://github.com/deanm/omggif/blob/master/omggif.js#L151
                disposal: 2,

                // All colors with alpha values less than this cutoff will be made completely transparent, all colors above the
                // cutoff will be made fully opaque (this is a gif limitation: pixels are either fully transparent or fully opaque).
                // Setting the cutoff very low so nothing really gets turned transparent; everything is made fully opaque.
                transparencyCutOff: 0.01
            })

            animatedGif.setSize(options.width, options.height);
            animatedGif.setDelay(1000 / options.fps);
            animatedGif.setRepeat(0); // loop forever

            state.frames().forEach(frame => {
                renderExportFrame(frame, options);
                animatedGif.addFrameImageData(exportCanvas.context.getImageData(0, 0, options.width, options.height));
            });

            // getBlobGIF is asynchronous but uses callback form -> converting it to a Promise
            return new Promise(resolve => animatedGif.getBlobGIF(resolve));
        })

        await exportFile(blobPromise, 'gif', 'image/gif');
    } finally {
        if (animatedGif) animatedGif.destroy();
        hideExportCanvas();
    }
}

// Adapted from: https://stackoverflow.com/a/50683349
// TODO Make numLoops or videoLength options... how long should video go for?
// TODO Display some kind of status as video is recorded (however long your total video is is how long it takes to record)
async function exportWebm(options) {
    try {
        setupExportCanvas(options);

        // We don't need to lazyBlobPromise because the majority of code in this promise is already asynchronous.
        // We also wrap all asynchronous callbacks in try/catch so that we can reject the promise correctly.
        const blobPromise = new Promise((resolve, reject) => {
            const numLoops = 1;
            const videoLength = options.fps === 0 ? 1000 : state.frames().length / options.fps * 1000 * numLoops;

            let frameIndex = 0;
            setIntervalUsingRAF(() => {
                try {
                    renderExportFrame(state.frames()[frameIndex], options);
                    frameIndex = (frameIndex + 1) % state.frames().length;
                } catch (error) {
                    reject(error);
                }
            }, 1000 / options.fps, true);

            const chunks = []; // here we will store our recorded media chunks (Blobs)
            const stream = exportCanvas.canvas.captureStream(); // grab our canvas MediaStream
            const rec = new MediaRecorder(stream); // init the recorder

            // every time the recorder has new data, we will store it in our array
            rec.ondataavailable = e => {
                try {
                    chunks.push(e.data);
                } catch (error) {
                    reject(error);
                }
            }

            // only when the recorder stops, we construct a complete Blob from all the chunks
            rec.onstop = e => {
                try {
                    resolve(new Blob(chunks, {type: 'video/webm'}))
                } catch (error) {
                    reject(error);
                }
            }

            rec.start();
            setTimeout(() => rec.stop(), videoLength);
        })

        await exportFile(blobPromise, 'webm', 'video/webm');
    } finally {
        hideExportCanvas();
    }
}








// Note: Indentation is purposely left-aligned since it gets put exactly as is into HTML file
function createHTMLFile(title, script, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script>${script}</script>
</head>
<body>
    ${body}
</body>
</html>`;
}

// Converts a frame to a string using the given newLineChar and (optional) lineFormatter
function exportableFrameString(frame, newLineChar, lineFormatter = function(line) { return line.text; }) {
    let image = '';

    const glyphs = state.layeredGlyphs(frame, { showAllLayers: true, convertEmptyStrToSpace: true });
    let row, col, rowLength = glyphs.chars.length, colLength = glyphs.chars[0].length;

    for (row = 0; row < rowLength; row++) {
        // Convert individual chars into lines of text (of matching color), so we can draw as few <span> as possible
        let lines = [];
        let line, colorIndex;

        for (col = 0; col < colLength; col++) {
            colorIndex = glyphs.colors[row][col];

            if (line && colorIndex !== line.colorIndex) {
                // New color; have to make new line
                lines.push(line);
                line = null;
            }
            if (!line) {
                line = { colorIndex: colorIndex, text: '' }
            }
            line.text += glyphs.chars[row][col];
        }

        if (line) { lines.push(line); }

        lines.forEach(line => image += lineFormatter(line));

        image += newLineChar;
    }

    return image;
}

function buildFrameSeparator(options, index, newLineChar) {
    let char;
    let numbered = false;

    switch(options.frameSeparator) {
        case 'none':
            return '';
        case 'space':
            char = ' ';
            break;
        case 'spaceNumbered':
            char = ' ';
            numbered = true;
            break;
        case 'dash':
            char = '-';
            break;
        case 'dashNumbered':
            char = '-';
            numbered = true;
            break;
        case 'asterisk':
            char = '*';
            break;
        case 'asteriskNumbered':
            char = '*';
            numbered = true;
            break;
        default:
            console.warn(`Invalid frameSeparator: ${options.frameSeparator}`);
            return '';
    }

    return numbered ? index.toString() + char.repeat(state.numCols() - index.toString().length) + newLineChar :
        char.repeat(state.numCols()) + newLineChar;
}




/**
 * Creates a deferred Promise that resolves with a Blob generated by the provided function.
 *
 * This function defers execution of `generateBlob`, ensuring that the expensive operation does not block the main thread
 * immediately. This is required so that when we pass the Promise<Blob> to browser-fs-access's fileSave, fileSave is not
 * delayed by the potentially expensive blob generation. Any delays to its showSaveFilePicker call will cause a "must
 * be handling a user gesture" error to occur: https://developer.mozilla.org/en-US/docs/Web/Security/User_activation
 *
 * @param {function:Promise<Blob>} generateBlob An asynchronous function that returns a Promise resolving to a Blob.
 * @returns {Promise<Blob>} A Promise that resolves with the generated Blob.
 */
function lazyBlobPromise(generateBlob) {
    return new Promise((resolve, reject) => {
        defer(() => {
            /**
             * Note: we cannot just call `resolve(generateBlob())` here. Because this executor is running asynchronously,
             * if generateBlob throws an error it WON'T cause the promise to reject (https://stackoverflow.com/a/33446005).
             * To reject the promise on a generateBlob error we have to manually call reject.
             */
            generateBlob()
                .then(blob => resolve(blob))
                .catch(err => reject(err));
        })
    });
}


function setupExportCanvas(options) {
    $exportCanvasContainer.toggleClass('is-exporting', true)
        .width(options.width / window.devicePixelRatio)
        .height(options.height / window.devicePixelRatio);

    exportCanvas.resize(true);
    exportCanvas.zoomToFit();
}

function hideExportCanvas() {
    $exportCanvasContainer.toggleClass('is-exporting', false);
}

function renderExportFrame(frame, options) {
    exportCanvas.clear();
    if (options.background && state.config('background')) exportCanvas.drawBackground(state.config('background'));
    exportCanvas.drawGlyphs(state.layeredGlyphs(frame, { showAllLayers: true }));
}

// Converts canvas.toBlob's asynchronous callback-based function into a Promise for await support
function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve));
}
