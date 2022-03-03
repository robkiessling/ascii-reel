import $ from "jquery";
import * as selection from "./selection.js";
import * as clipboard from "./clipboard.js";
import * as canvas from "./canvas.js";

$(document).keydown(function(e) {
    const code = e.which // Note: This is normalized by jQuery. Keycodes https://keycode.info/
    const char = e.key; // E.g. a A 1 Control Alt Shift Meta Enter [ { \ /
    console.log(code, char);

    if (char === 'Unidentified') {
        console.warn(`Unidentified key for event: ${e}`);
        return;
    }

    // Commands
    if (e.metaKey || e.ctrlKey) {
        switch (char) {
            case 'a':
                selection.selectAll();
                break;
            case 'x':
                clipboard.cut();
                break;
            case 'c':
                clipboard.copy();
                break;
            case 'v':
                clipboard.paste();
                break;
            default:
                // Unrecognized command; let browser handle as normal
                return;
        }

        e.preventDefault(); // One of our commands was used, prevent default browser command (if there was one)
        return;
    }

    // Standard input
    switch (char) {
        case 'Escape':
            selection.clear();
            break;
        case 'ArrowLeft':
            // If shift key is pressed, we only want to move the end cell
            selection.moveSelection('left', !e.shiftKey);
            break;
        case 'ArrowUp':
            selection.moveSelection('up', !e.shiftKey);
            break;
        case 'ArrowRight':
            selection.moveSelection('right', !e.shiftKey);
            break;
        case 'ArrowDown':
            selection.moveSelection('down', !e.shiftKey);
            break;
        case 'Tab':
            // If shift key is pressed, we move in opposite direction
            if (e.shiftKey) { selection.moveSelection('left'); } else { selection.moveSelection('right'); }
            break;
        case 'Enter':
            if (e.shiftKey) { selection.moveSelection('up'); } else { selection.moveSelection('down'); }
            break;

        case 'Backspace':
        case 'Delete':
            selection.getSelectedCells().forEach(cell => {
                canvas.updateChar(cell.row, cell.col, '');
            });
            canvas.refresh('chars');
            break;
        default:
            if (producesText(code)) {
                selection.getSelectedCells().forEach(cell => {
                    canvas.updateChar(cell.row, cell.col, char);
                });
                canvas.refresh('chars');
            }
            else {
                // Unrecognized input; let browser handle as normal
                return;
            }
    }

    e.preventDefault();
});

// Returns true if the keycode produces some kind of text character
function producesText(code) {
    return (code === 32) ||             // space bar
        (code >= 48 && code <= 57) ||   // 0-9
        (code >= 65 && code <= 90) ||   // a-z
        (code >= 186 && code <= 192) || // ;=,-./`
        (code >= 219 && code <= 222);   // [\]'
}