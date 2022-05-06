import $ from "jquery";
import * as selection from "./selection.js";
import * as clipboard from "./clipboard.js";
import * as state from "./state.js";
import * as editor from "./editor.js";
import {triggerRefresh} from "./index.js";

let standard = false;

export function toggleStandard(enable) {
    standard = enable;
}

const $document = $(document);

$document.keydown(function(e) {
    const code = e.which // Note: This is normalized by jQuery. Keycodes https://keycode.info/
    const char = e.key; // E.g. a A 1 Control Alt Shift Meta Enter [ { \ /
    // console.log(code, char);

    if (standard) {
        if (char === 'Enter') {
            $document.trigger('keyboard:enter');
            e.preventDefault();
        }
        return;
    }

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
                clipboard.paste(e.shiftKey);
                break;
            case 'Enter':
                if (selection.movableContent) {
                    selection.finishMovingContent();
                }
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
            // If cursor is showing, escape just hides the cursor but keeps the selection intact
            selection.cursorCell ? selection.hideCursor() : selection.clear();
            break;
        case 'ArrowLeft':
            selection.cursorCell ? selection.moveCursorInDirection('left') : selection.moveInDirection('left', 1, !e.shiftKey);
            break;
        case 'ArrowUp':
            selection.cursorCell ? selection.moveCursorInDirection('up') : selection.moveInDirection('up', 1, !e.shiftKey);
            break;
        case 'ArrowRight':
            selection.cursorCell ? selection.moveCursorInDirection('right') : selection.moveInDirection('right', 1, !e.shiftKey);
            break;
        case 'ArrowDown':
            selection.cursorCell ? selection.moveCursorInDirection('down') : selection.moveInDirection('down', 1, !e.shiftKey);
            break;
        case 'Tab':
            if (e.shiftKey) {
                // If shift key is pressed, we move in opposite direction
                selection.cursorCell ? selection.moveCursorInDirection('left') : selection.moveInDirection('left', 1);
            } else {
                selection.cursorCell ? selection.moveCursorInDirection('right') : selection.moveInDirection('right', 1);
            }
            break;
        case 'Enter':
            if (selection.movableContent) {
                selection.finishMovingContent();
            }
            else {
                if (e.shiftKey) {
                    // If shift key is pressed, we move in opposite direction
                    selection.cursorCell ? selection.moveCursorInDirection('up') : selection.moveInDirection('up', 1);
                } else {
                    selection.cursorCell ? selection.moveCursorInDirection('down') : selection.moveInDirection('down', 1);
                }
            }
            break;

        case 'Backspace':
        case 'Delete':
            if (selection.movableContent) {
                selection.updateMovableContent('', 0);
            }
            else if (selection.cursorCell) {
                if (char === 'Backspace') {
                    selection.moveCursorInDirection('left');
                }
                state.setCurrentCelChar(selection.cursorCell.row, selection.cursorCell.col, ['', 0]);
            }
            else {
                selection.empty();
            }
            triggerRefresh('chars');
            break;
        default:
            if (producesText(code)) {
                if (selection.movableContent) {
                    selection.updateMovableContent(char, editor.currentColorIndex());
                }
                else if (selection.cursorCell) {
                    // update cursor cell and then move to next cell
                    state.setCurrentCelChar(selection.cursorCell.row, selection.cursorCell.col, [char, editor.currentColorIndex()]);
                    selection.moveCursorInDirection('right');
                }
                else {
                    // update entire selection
                    selection.getSelectedCells().forEach(cell => {
                        state.setCurrentCelChar(cell.row, cell.col, [char, editor.currentColorIndex()]);
                    });
                }

                triggerRefresh('chars');
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