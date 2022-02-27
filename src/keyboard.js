import $ from "jquery";
import * as selection from "./selection.js";
import {frame} from "./index.js";
import {refresh} from "./canvas.js";

$(document).keydown(function(e) {
    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter
    console.log(code, char);

    if (char === 'Unidentified') {
        console.warn(`Unidentified key for event: ${e}`);
        return;
    }

    // Commands
    if (e.metaKey || e.ctrlKey) {
        switch (char) {
            // TODO Add keyboard commands if needed
            default:
                return;
        }

        e.preventDefault(); // One of the commands was used, prevent default
        return;
    }

    // Standard characters
    switch (char) {
        case 'Backspace':
        case 'Delete':
            selection.getSelectedCoordinates().forEach(coordinate => {
                frame[coordinate.row][coordinate.col] = '';
            });
            break;
        default:
            if (                                // Keyboard keycodes that produce output:
                (code === 32) ||                // space bar
                (code >= 48 && code <= 57) ||   // 0-9
                (code >= 65 && code <= 90) ||   // a-z
                (code >= 186 && code <= 192) || // ;=,-./`
                (code >= 219 && code <= 222)    // [\]'
            ) {
                selection.getSelectedCoordinates().forEach(coordinate => {
                    frame[coordinate.row][coordinate.col] = char;
                });
            }
            else {
                return;
            }
    }

    e.preventDefault();
    refresh();
});
