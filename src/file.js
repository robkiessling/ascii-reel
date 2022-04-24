import * as state from "./state.js";
import $ from "jquery";
import { saveAs } from 'file-saver';

import {confirmDialog, createDialog, createHTMLFile, hexToRgba} from "./utilities.js";

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
bindFileMenuItem('export', () => exportRTF(true));

function exportTXT() {
    const frames = exportableFrameStrings('\n');
    const frameSeparator = '*'.repeat(state.numCols()) + '\n';
    const txt = frames.join(frameSeparator);
    const blob = new Blob([txt], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${state.config('name')}.txt`);
}

// RTF format: https://www.oreilly.com/library/view/rtf-pocket-guide/9781449302047/ch01.html
function exportRTF(useColors) {
    const frames = useColors ?
        exportableFrameStrings('\\line ', line => `{\\cf${line.colorIndex} ${line.text}}`) :
        exportableFrameStrings('\\line ');
    const frameSeparator = '*'.repeat(state.numCols()) + '\\line ';

    let colorTable = '';
    if (useColors) {
        const rtfColors = state.colors().map(color => {
            const rgba = hexToRgba(color);
            return `\\red${rgba.r}\\green${rgba.g}\\blue${rgba.b}`; // Note: alpha cannot be shown in rtf
        })
        colorTable = `{\\colortbl ${rtfColors.join(';')};}`;
    }

    const font = 'Courier New';
    const fontSize = 14;
    const rtf = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 ${font};}}${colorTable}\\f0\\fs${fontSize * 2} ${frames.join(frameSeparator)}}`;

    const blob = new Blob([rtf], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${state.config('name')}.rtf`);
}

function exportHTML(useColors) {
    const frames = useColors ?
        exportableFrameStrings('<br>', line => `<span style="color:${state.colorStr(line.colorIndex)};">${line.text}</span>`) :
        exportableFrameStrings('<br>');

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


function exportableFrameStrings(newLineChar, lineFormatter = function(line) { return line.text; }) {
    return state.frames().map(frame => {
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
    });
}
