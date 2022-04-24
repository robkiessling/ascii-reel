import * as state from "./state.js";
import $ from "jquery";

import {confirmDialog, createDialog} from "./utilities.js";

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
    // https://stackoverflow.com/a/34156339
    const a = document.createElement("a");
    const file = new Blob([state.stringify()], {type: 'text/plain'});
    a.href = URL.createObjectURL(file);
    a.download = `${state.config('name')}.${FILE_EXTENSION}`;
    a.click();
}

function openSaveDialog() {
    $saveFileDialog.find('.name').val(state.config('name'));
    $saveFileDialog.find('.extension').html(`.${FILE_EXTENSION}`);
    $saveFileDialog.dialog('open');
}

