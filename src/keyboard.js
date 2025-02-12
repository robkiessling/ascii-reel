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
        if (e.metaKey || e.ctrlKey || e.altKey) {
            let modifiers = [];
            if (e.metaKey) { modifiers.push('metaKey'); }
            if (e.ctrlKey) { modifiers.push('ctrlKey'); }
            if (e.altKey) { modifiers.push('altKey'); }
            if (e.shiftKey) { modifiers.push('shiftKey'); }
            if (actions.callActionByShortcut({ char: char, modifiers: modifiers })) {
                e.preventDefault();
                return;
            }
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
                handleArrowKey(e, 'left');
                break;
            case 'ArrowUp':
                handleArrowKey(e, 'up');
                break;
            case 'ArrowRight':
                handleArrowKey(e, 'right');
                break;
            case 'ArrowDown':
                handleArrowKey(e, 'down');
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
                if (producesText(code) && char.length === 1) {
                    if (e.metaKey || e.ctrlKey) {
                        // Ignore browser commands (e.g. cmd-N) that we don't override with anything.
                        // Currently allowing altKey, because sometimes the option key is used to write special characters.
                        return;
                    }

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

function handleArrowKey(e, direction) {
    state.endHistoryModification();

    if (state.config('tool') === 'text-editor') {
        selection.handleTextEditorArrowKey(direction, e.shiftKey);
    }
    else {
        selection.cursorCell ? selection.moveCursorInDirection(direction) : selection.moveInDirection(direction, 1, !e.shiftKey);
    }
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