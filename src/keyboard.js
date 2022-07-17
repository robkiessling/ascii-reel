import $ from "jquery";
import * as selection from "./selection.js";
import * as state from "./state.js";
import * as editor from "./editor.js";
import * as actions from "./actions.js";
import {triggerRefresh} from "./index.js";

let standardKeyboard = false;
const $document = $(document);

export function init() {
    setupKeydownListener();
}

export function toggleStandard(enable) {
    standardKeyboard = enable;
}

function setupKeydownListener() {
    $document.keydown(function(e) {
        const code = e.which // Note: This is normalized by jQuery. Keycodes https://keycode.info/
        const char = e.key; // E.g. a A 1 Control Alt Shift Meta Enter [ { \ /
        // console.log(code, char);

        if (standardKeyboard) {
            handleStandardKeyboard(char, e);
            return;
        }

        if (char === 'Unidentified') {
            console.warn(`Unidentified key for event: ${e}`);
            return;
        }

        // Shortcuts
        // TODO Make sure everything in the app considers metaKey === ctrlKey
        if (e.metaKey || e.ctrlKey) {
            let modifiers = [];
            if (e.shiftKey) { modifiers.push('shift'); }
            if (e.altKey) { modifiers.push('alt'); }
            if (actions.callActionByShortcut({ char: char, modifiers: modifiers })) {
                e.preventDefault();
            }
            return;
        }

        switch (char) {
            case 'Escape':
                state.endHistoryModification();
                if (state.config('tool') === 'text-editor') {
                    selection.clear();
                }
                else {
                    // Regular selection: If cursor is showing, escape just hides the cursor but keeps the selection intact
                    selection.cursorCell ? selection.hideCursor() : selection.clear();
                }
                break;
            case 'ArrowLeft':
                state.endHistoryModification();
                selection.cursorCell ? selection.moveCursorInDirection('left') : selection.moveInDirection('left', 1, !e.shiftKey);
                break;
            case 'ArrowUp':
                state.endHistoryModification();
                selection.cursorCell ? selection.moveCursorInDirection('up') : selection.moveInDirection('up', 1, !e.shiftKey);
                break;
            case 'ArrowRight':
                state.endHistoryModification();
                selection.cursorCell ? selection.moveCursorInDirection('right') : selection.moveInDirection('right', 1, !e.shiftKey);
                break;
            case 'ArrowDown':
                state.endHistoryModification();
                selection.cursorCell ? selection.moveCursorInDirection('down') : selection.moveInDirection('down', 1, !e.shiftKey);
                break;
            case 'Tab':
                state.endHistoryModification();
                if (e.shiftKey) {
                    // If shift key is pressed, we move in opposite direction
                    selection.cursorCell ? selection.moveCursorInDirection('left', false) : selection.moveInDirection('left', 1);
                } else {
                    selection.cursorCell ? selection.moveCursorInDirection('right', false) : selection.moveInDirection('right', 1);
                }
                break;
            case 'Enter':
                if (selection.movableContent) {
                    selection.finishMovingContent();
                }
                else {
                    state.endHistoryModification();
                    if (e.shiftKey) {
                        // If shift key is pressed, we move in opposite direction
                        selection.cursorCell ? selection.moveCursorInDirection('up', false) : selection.moveInDirection('up', 1);
                    } else {
                        // 'Enter' key differs from 'ArrowDown' in that the cursor will go to the start of the next line (like Excel)
                        selection.cursorCell ? selection.moveCursorCarriageReturn() : selection.moveInDirection('down', 1);
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
                        selection.moveCursorInDirection('left', false);
                    }
                    state.setCurrentCelGlyph(selection.cursorCell.row, selection.cursorCell.col, '', 0);
                }
                else {
                    selection.empty();
                }
                triggerRefresh('chars', 'backspace');
                break;
            default:
                if (producesText(code)) {
                    if (state.config('tool') === 'draw-freeform') {
                        editor.setFreeformChar(char);
                        return;
                    }

                    if (selection.movableContent) {
                        selection.updateMovableContent(char, editor.currentColorIndex());
                    }
                    else if (selection.cursorCell) {
                        // update cursor cell and then move to next cell
                        state.setCurrentCelGlyph(selection.cursorCell.row, selection.cursorCell.col, char, editor.currentColorIndex());
                        selection.moveCursorInDirection('right', false);
                    }
                    else {
                        // update entire selection
                        selection.getSelectedCells().forEach(cell => {
                            state.setCurrentCelGlyph(cell.row, cell.col, char, editor.currentColorIndex());
                        });
                    }

                    triggerRefresh('chars', 'producesText');
                }
                else {
                    // Unrecognized input; let browser handle as normal
                    return;
                }
        }

        e.preventDefault();
    });
}

function handleStandardKeyboard(char, e) {
    if (char === 'Enter') {
        $document.trigger('keyboard:enter');
        e.preventDefault();
    }
}

// Returns true if the keycode produces some kind of text character
function producesText(code) {
    return (code === 32) ||             // space bar
        (code >= 48 && code <= 57) ||   // 0-9
        (code >= 65 && code <= 90) ||   // a-z
        (code >= 186 && code <= 192) || // ;=,-./`
        (code >= 219 && code <= 222);   // [\]'
}