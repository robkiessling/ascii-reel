import * as state from "./state.js";
import $ from "jquery";
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

import {confirmDialog, createDialog, createHTMLFile, hexToRgba} from "./utilities.js";
import {CanvasControl, MONOSPACE_RATIO} from "./canvas.js";

const FILE_EXTENSION = 'ascii'; // TODO Think of a file extension to use


const $fileMenu = $('#file-menu');
function bindFileMenuItem(item, onClick) {
    $fileMenu.find(`.file-menu-item[data-item="${item}"]`).off('click').on('click', evt => {
        onClick(evt);
    })
}



// --------------------------------------------------------------- New
bindFileMenuItem('new', () => newFile());

function newFile() {
    // TODO ask for dimensions, etc.
    confirmDialog('Create new sprite?', 'Any unsaved changes will be lost.', () => state.loadNew())
}



// --------------------------------------------------------------- Uploading
bindFileMenuItem('open', () => uploadFile());

const $uploadInput = $('#upload-file');
$uploadInput.attr('accept', `.${FILE_EXTENSION}`);

$uploadInput.off('change').on('change', function(evt) {
    const file = evt.target.files[0];
    $uploadInput.val(null); // null out <input> so if the user uploads same file it gets refreshed

    if (file) {
        const reader = new FileReader();

        reader.addEventListener("load", function() {
            try {
                state.load(JSON.parse(reader.result));
            }
            catch (exception) {
                console.error(exception.message, exception.stack);
                alert(exception.message + '\n\nView browser console for full stack trace.');
            }
        }, false);

        reader.readAsText(file);
    }
});

function uploadFile() {
    $uploadInput.trigger('click');
}


// --------------------------------------------------------------- Saving
bindFileMenuItem('save', () => openSaveDialog());

const $saveFileDialog = $('#save-file-dialog');
createDialog($saveFileDialog, () => {
    state.config('name', $saveFileDialog.find('.name').val());
    saveFile();
    $saveFileDialog.dialog('close');
});

function saveFile() {
    const blob = new Blob([state.stringify()], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${state.config('name')}.${FILE_EXTENSION}`)
}

function openSaveDialog() {
    $saveFileDialog.find('.name').val(state.config('name'));
    $saveFileDialog.find('.extension').html(`.${FILE_EXTENSION}`);
    $saveFileDialog.dialog('open');
}

// --------------------------------------------------------------- Export
bindFileMenuItem('export', () => exportFile({ format: 'png', frames: 'zip' }));

const $exportCanvasContainer = $('#export-canvas-container');
const $exportCanvas = $('#export-canvas');
const exportCanvas = new CanvasControl($exportCanvas, {});

function exportFile(options) {
    switch(options.format) {
        case 'txt':
            exportTxt(options);
            break;
        case 'rtf':
            exportRtf(options);
            break;
        case 'html':
            exportHtml(options);
            break;
        case 'png':
            exportPng(options);
            break;
        default:
            console.warn(`Invalid export format: ${options.format}`);
    }
}

/**
 * options:
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - frameSeparator: (only applicable if frames:spritesheet) character to separate frames with
 */
function exportTxt(options = {}) {
    let txt, blob;

    function _frameToTxt(frame) {
        return exportableFrameString(frame, '\n');
    }

    switch(options.frames) {
        case 'zip':
            const zip = new JSZip();
            state.frames().forEach((frame, index) => {
                zip.file(`${index}.txt`, _frameToTxt(frame));
            });
            zip.generateAsync({type:"blob"}).then(function(content) {
                saveAs(content, `${state.config('name')}.zip`);
            });
            break;
        case 'current':
            txt = _frameToTxt(state.currentFrame());
            blob = new Blob([txt], {type: "text/plain;charset=utf-8"});
            saveAs(blob, `${state.config('name')}.txt`);
            break;
        case 'spritesheet':
            const frameSeparator = options.frameSeparator ? options.frameSeparator.repeat(state.numCols()) + '\n' : '';
            txt = state.frames().map(frame => _frameToTxt(frame)).join(frameSeparator);
            blob = new Blob([txt], {type: "text/plain;charset=utf-8"});
            saveAs(blob, `${state.config('name')}.txt`);
            break;
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}

/**
 * options:
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - frameSeparator: (only applicable if frames:spritesheet) character to separate frames with
 *
 * For more information on RTF format: https://www.oreilly.com/library/view/rtf-pocket-guide/9781449302047/ch01.html
 */
function exportRtf(options) {
    let rtf, blob;

    const rtfColors = state.colors().map(color => {
        const rgba = hexToRgba(color);
        return `\\red${rgba.r}\\green${rgba.g}\\blue${rgba.b}`; // Note: alpha cannot be shown in rtf
    })
    const colorTable = `{\\colortbl ${rtfColors.join(';')};}`;
    const font = 'Courier New';
    const fontSize = 14;

    function _buildRtfFile(content) {
        return `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 ${font};}}${colorTable}\\f0\\fs${fontSize * 2} ${content}}`;
    }

    function _frameToRtf(frame) {
        return exportableFrameString(frame, '\\line ', line => `{\\cf${line.colorIndex} ${line.text}}`)
    }

    switch(options.frames) {
        case 'zip':
            const zip = new JSZip();
            state.frames().forEach((frame, index) => {
                zip.file(`${index}.rtf`, _buildRtfFile(_frameToRtf(frame)));
            });
            zip.generateAsync({type:"blob"}).then(function(content) {
                saveAs(content, `${state.config('name')}.zip`);
            });
            break;
        case 'current':
            rtf = _buildRtfFile(_frameToRtf(state.currentFrame()));
            blob = new Blob([rtf], {type: "text/plain;charset=utf-8"});
            saveAs(blob, `${state.config('name')}.rtf`);
            break;
        case 'spritesheet':
            const frameSeparator = options.frameSeparator ? options.frameSeparator.repeat(state.numCols()) + '\\line ' : '';
            rtf = _buildRtfFile(state.frames().map(frame => _frameToRtf(frame)).join(frameSeparator));
            blob = new Blob([rtf], {type: "text/plain;charset=utf-8"});
            saveAs(blob, `${state.config('name')}.rtf`);
            break;
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}

function exportHtml(options) {
    const frames = state.frames().map(frame => {
        return exportableFrameString(frame, '<br>', line => `<span style="color:${state.colorStr(line.colorIndex)};">${line.text}</span>`)
    });

    // <script> that will animate the <pre> contents
    const script = `
        document.addEventListener("DOMContentLoaded", function() {
            var sprite = document.getElementById('sprite');
            var frames = ${JSON.stringify(frames)};
            var frameIndex = 0;
            var fps = ${state.config('fps')};
            
            function draw() {
                sprite.innerHTML = frames[frameIndex];
                frameIndex++;
                if (frameIndex >= frames.length) { frameIndex = 0; }
                if (fps !== 0) { setTimeout(draw, 1000 / fps); }
            }
            
            draw();
        });
    `;
    const body = `<pre id="sprite" style="font-family: monospace;"></pre>`;
    const html = createHTMLFile(state.config('name'), script, body);
    const blob = new Blob([html], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${state.config('name')}.html`);
}

function exportPng(options) {
    const width = 800;
    const height = width / state.numCols() * state.numRows() / MONOSPACE_RATIO;

    $exportCanvasContainer.toggleClass('is-exporting', true)
        .width(width / window.devicePixelRatio)
        .height(height / window.devicePixelRatio);

    exportCanvas.resize();
    exportCanvas.zoomToFit();

    function _frameToPng(frame, callback) {
        exportCanvas.clear();
        exportCanvas.drawChars(state.layeredChars(frame, { showAllLayers: true }));
        exportCanvas.canvas.toBlob(function(blob) {
            callback(blob);
        });
    }

    function complete() {
        $exportCanvasContainer.toggleClass('is-exporting', false);
    }

    switch(options.frames) {
        case 'zip':
            const zip = new JSZip();

            // Build the zip file using callbacks since canvas.toBlob is asynchronous
            function addFrameToZip(index) {
                if (index <= state.frames().length - 1) {
                    _frameToPng(state.frames()[index], blob => {
                        zip.file(`${index}.png`, blob);
                        addFrameToZip(index + 1);
                    });
                }
                else {
                    // Finished adding all frames; save the zip file
                    zip.generateAsync({type:"blob"}).then(function(content) {
                        saveAs(content, `${state.config('name')}.zip`);
                        complete();
                    });
                }
            }
            addFrameToZip(0);
            break;
        case 'current':
            _frameToPng(state.currentFrame(), blob => {
                saveAs(blob, `${state.config('name')}.png`);
                complete();
            });
            break;
        case 'spritesheet':
            console.error('not yet implemented');
            break;
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}

// Converts a frame to a string using the given newLineChar and (optional) lineFormatter
function exportableFrameString(frame, newLineChar, lineFormatter = function(line) { return line.text; }) {
    const chars = state.layeredChars(frame, { showAllLayers: true });

    let image = '';

    for (let row = 0; row < chars.length; row++) {
        // Convert individual chars into lines of text (of matching color), so we can draw as few <span> as possible
        let lines = [];
        let line, colorIndex;

        for (let col = 0; col < chars[row].length; col++) {
            colorIndex = chars[row][col][1];

            if (line && colorIndex !== line.colorIndex) {
                // New color; have to make new line
                lines.push(line);
                line = null;
            }
            if (!line) {
                line = { colorIndex: colorIndex, text: '' }
            }
            line.text += (chars[row][col][0] === '' ? ' ' : chars[row][col][0]);
        }

        if (line) { lines.push(line); }

        lines.forEach(line => image += lineFormatter(line));

        image += newLineChar;
    }

    return image;
}
