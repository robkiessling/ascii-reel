import * as selection from "../canvas/selection.js";
import * as state from "../state/state.js";
import * as editor from "../components/editor.js";
import * as actions from "./actions.js";
import {triggerRefresh} from "../index.js";

let standardKeyboard = false;
const $document = $(document);

export function init() {
    setupKeydownListener();
    setupCompositionListener();
}

// When standard keyboard is enabled, the keyboard works as normal (e.g. cmd-v will paste according to browser
// clipboard). When disabled, the keyboard uses this app's shortcuts (e.g. cmd-v will paste into selection).
export function toggleStandard(enable) {
    standardKeyboard = enable;
}

function setupKeydownListener() {
    $document.keydown(function(e) {
        const char = e.key; // E.g. x X 1 Control Alt Shift Meta Enter [ { \ /
        // console.log(char);

        if (standardKeyboard) {
            handleStandardKeyboard(char, e);
            return;
        }

        if (char === 'Unidentified') {
            console.warn(`Unidentified key for event: ${e}`);
            return;
        }

        // A 'Dead' char is received when composition starts (see composition section below)
        if (char === 'Dead' || isComposing) return;

        // Shortcuts
        if (e.metaKey || e.ctrlKey || e.altKey) {
            const modifiers = ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'].filter(modifier => e[modifier]);
            if (actions.callActionByShortcut({ char: char, modifiers: modifiers })) {
                e.preventDefault();
                return;
            }
        }

        // If the metaKey/ctrlKey did not reach one of our shortcuts, we return so that normal browser shortcuts work
        // (e.g. cmd-N for new window). We do not return early for altKey, because sometimes that key can be used to
        // write/compose special characters.
        if (e.metaKey || e.ctrlKey) return;

        switch (char) {
            case 'Escape':
                handleEscapeKey();
                break;
            case 'Tab':
                handleTabKey(e);
                break;
            case 'Enter':
                handleEnterKey(e);
                break;
            case 'Backspace':
            case 'Delete':
                handleBackspaceKey(char);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowDown':
                handleArrowKey(e, char);
                break;
            default:
                if (char.length !== 1) return; // Unrecognized input; let browser handle as normal
                handleSingleChar(char);
        }

        e.preventDefault();
    });
}

function handleEscapeKey() {
    state.endHistoryModification();

    if (state.config('tool') === 'text-editor') {
        selection.clear();
    }
    else {
        // Regular selection: If cursor is showing, escape just hides the cursor but keeps the selection intact
        selection.cursorCell ? selection.hideCursor() : selection.clear();
    }
}

function handleTabKey(e) {
    state.endHistoryModification();

    if (e.shiftKey) {
        // If shift key is pressed, we move in opposite direction
        selection.cursorCell ? selection.moveCursorInDirection('left', false) : selection.moveInDirection('left', 1);
    } else {
        selection.cursorCell ? selection.moveCursorInDirection('right', false) : selection.moveInDirection('right', 1);
    }
}

function handleEnterKey(e) {
    if (selection.movableContent) {
        selection.finishMovingContent();
    }
    else {
        // Push a state to the history where the cursor is at the end of the current line -- that way when
        // you undo, the first undo just jumps back to the previous line with cursor at end.
        if (selection.cursorCell) state.pushStateToHistory();

        if (e.shiftKey) {
            // If shift key is pressed, we move in opposite direction
            selection.cursorCell ? selection.moveCursorInDirection('up', false) : selection.moveInDirection('up', 1);
        } else {
            // 'Enter' key differs from 'ArrowDown' in that the cursor will go to the start of the next line (like Excel)
            selection.cursorCell ? selection.moveCursorCarriageReturn() : selection.moveInDirection('down', 1);
        }
    }
}

function handleBackspaceKey(char) {
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

    if (editor.shouldUpdateFreeformChar()) {
        editor.setFreeformChar('');
    }

    triggerRefresh('chars', 'backspace');
}

function handleArrowKey(e, arrowKey) {
    const direction = arrowKeyToDirection(arrowKey);

    if (selection.hasTarget()) {
        state.endHistoryModification();

        if (state.config('tool') === 'text-editor') {
            // text-editor tool has a special arrow key handler
            selection.handleTextEditorArrowKey(direction, e.shiftKey);
        }
        else {
            // For non-text-editor selections, if there is a cursor within the selection move that cursor, otherwise
            // move the entire selection
            selection.cursorCell ?
                selection.moveCursorInDirection(direction) :
                selection.moveInDirection(direction, 1, !e.shiftKey, true, false);
        }
    }
    else {
        switch(direction) {
            case 'left':
                return actions.callAction('frames.previous-frame')
            case 'up':
                return actions.callAction('frames.previous-frame')
            case 'right':
                return actions.callAction('frames.next-frame')
            case 'down':
                return actions.callAction('frames.next-frame')
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
    }
}

function arrowKeyToDirection(arrowKey) {
    switch (arrowKey) {
        case 'ArrowLeft':
            return 'left';
        case 'ArrowUp':
            return 'up'
        case 'ArrowRight':
            return 'right';
        case 'ArrowDown':
            return 'down';
    }
}

function handleSingleChar(char, moveCursor = true) {
    if (editor.shouldUpdateFreeformChar()) {
        editor.setFreeformChar(char);
    }

    selection.setSelectionToSingleChar(char, state.primaryColorIndex(), moveCursor);
}

function handleStandardKeyboard(char, e) {
    if (char === 'Enter') {
        $document.trigger('keyboard:enter');
        e.preventDefault();
    }
}



/**
 * ---------------------------------------------------------------------------------- Composition
 *
 * Composition is a way to type special characters by pressing a sequence of keys. For example, on macOS you can
 * press option+e once to create a ´ character (with an underline under it). Then you can press another character
 * such as e, i, or a, to create é, í, or á, respectively.
 *
 * We simulate this in the canvas by listening for compositionstart/update/end and drawing each intermediate
 * composition char.
 */

let isComposing = false;

function setupCompositionListener() {
    // To ensure composition works (even though the user is not typing into an input) we create a hidden input
    // offscreen that we focus on keydown
    let hiddenInput = $("<input>").css({
        position: "absolute",
        left: "-9999px",
        opacity: 0
    }).appendTo("body");

    $document.on("keydown.composition", () => {
        if (!standardKeyboard) hiddenInput.focus(); // Use hidden input to ensure composition starts
    });

    $document.on('compositionstart', e => {
        isComposing = true;
    });

    $document.on('compositionupdate', e => {
        const str = e.originalEvent.data;

        // The str can be two characters long if composition failed, e.g. "`" + "x" = "`x"
        // We always take the last character, so even if composition failed we still print the failing char (e.g. "x")
        const char = str.charAt(str.length - 1)

        // When writing the char, do not move the cursor yet (moveCursor=false) because we might not be done composing
        handleSingleChar(char, false);
    });

    $document.on('compositionend', e => {
        isComposing = false;

        // Since we didn't move the cursor in compositionupdate (moveCursor=false), we move the cursor now that
        // composition is finished
        selection.moveCursorInDirection('right', false)
    })
}