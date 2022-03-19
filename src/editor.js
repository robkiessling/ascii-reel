import $ from "jquery";
import Picker from 'vanilla-picker/csp';
import * as state from './state.js';

let currentColorStr = '#fff';
let cachedColorIndex = null;

export function currentColorIndex() {
    if (cachedColorIndex !== null) {
        return cachedColorIndex;
    }
    return state.findOrCreateColor(currentColorStr);
}

const colorPickerElement = document.querySelector('#current-color');
const colorPicker = new Picker({
    parent: colorPickerElement,
    color: currentColorStr,
    popup: 'top',
    onOpen: () => {
        $(colorPickerElement).find('.picker_done button').html('Fill'); // todo only show 'Fill' if has selection
    },
    onChange: (color) => {
        colorPickerElement.style.background = color.hex;
        currentColorStr = color.hex;
        cachedColorIndex = null;
    },
    onDone: (color) => {

    }
});
