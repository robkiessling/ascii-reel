import * as selection from "../features/selection.js";
import * as state from "../state/index.js";
import * as editor from "../features/editor.js";
import * as actions from "./actions.js";
import {eventBus, EVENTS} from "../events/events.js";

const $document = $(document);

export function init() {
    setupKeydownListener();
    setupCompositionListener();
}


function setupKeydownListener() {
    $document.keydown(function(e) {
        const char = e.key; // E.g. x X 1 Control Alt Shift Meta Enter [ { \ /
        // console.log(char);

        if (useStandardKeyboard()) {
            handleStandardKeyboard(char, e);
            return;
        }

        if (char === 'Unidentified') {
            console.warn(`Unidentified key for event: ${e}`);
            return;
        }

        // A 'Dead' char is received when composition starts (see composition section below)
        if (char === 'Dead' || isComposing) return;

        // Ascii Reel Shortcuts
        if (e.metaKey || e.ctrlKey || e.altKey) {
            const modifiers = ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'].filter(modifier => e[modifier]);
            if (actions.callActionByShortcut({ char: char, modifiers: modifiers })) {
                e.preventDefault();
                return;
            }
        }

        // If the metaKey/ctrlKey is down, and it did not reach one of our shortcuts, the user is likely performing
        // a standard browser shortcut (e.g. cmd-R to reload). Return early (without preventing default) so that the
        // browser shortcut works as normal. Note: a few browser shortcuts are prevented, see handleBrowserShortcut.
        if (e.metaKey || e.ctrlKey) {
            handleBrowserShortcut(e, char);
            return;
        }

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

    if (state.getConfig('tool') === 'text-editor') {
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
        if (selection.cursorCell) state.pushHistory();

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

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'backspace' });
}

function handleArrowKey(e, arrowKey) {
    const direction = arrowKeyToDirection(arrowKey);

    if (selection.hasTarget()) {
        state.endHistoryModification();

        if (state.getConfig('tool') === 'text-editor') {
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

const PREVENT_DEFAULT_BROWSER_SHORTCUTS = new Set([
    // Preventing normal browser zoom in/out since we use these same keys to zoom in/out of the canvas. Normally our
    // own shortcut already prevents normal browser behavior, but if the canvas is zoomed all the way in/out our action
    // will actually be disabled, meaning our shortcut does not prevent default browser behavior.
    '-', '=', '0'
])

// A few browser shortcuts are prevented. See PREVENT_DEFAULT_BROWSER_SHORTCUTS for details.
function handleBrowserShortcut(e, char) {
    if (PREVENT_DEFAULT_BROWSER_SHORTCUTS.has(char)) {
        e.preventDefault();
    }
}

// ---------------------------------------------------------------------------------- Standard Keyboard

let standardKeyboardLocks = {};

/**
 * Toggles the standard browser keyboard:
 * - If the standard browser keyboard is enabled, the keyboard works as normal. E.g. Pressing a char key will type it
 *   into an <input> (if focused) as opposed to typing it into the <canvas>. Only browser shortcuts will be enabled.
 * - If the standard browser keyboard is disabled, our "app" keyboard functionality will be enabled. E.g. Pressing a
 *   char will type it into the <canvas>. Our app shortcuts will have priority over browser shortcuts (if possible).
 *
 * The toggle is implemented using a `lockingKey` to support multiple sources calling toggleStandard. The standard
 * keyboard will be used if ANY sources have toggled it. For example, if:
 *   1. Source A calls toggleStandard('A', true)    -> standard keyboard is enabled
 *   2. Source B calls toggleStandard('B', true)    -> standard keyboard is enabled (now with 2 "locks")
 *   3. Source A calls toggleStandard('A', false)   -> standard keyboard is still enabled ("B" lock is still applied)
 *   4. Source B calls toggleStandard('B', false)   -> app keyboard is enabled (all locks have been removed)
 *
 * @param {String} lockingKey A unique key to assign this toggle to. This allows multiple sources to call toggleStandard
 *   and the standard keyboard will be used if ANY locks remain.
 * @param {boolean} useStandard If true, lock will be applied (standard keyboard will be used). If false, lock will be
 *   removed (app keyboard will be used, assuming this was the final lock).
 */
export function toggleStandard(lockingKey, useStandard) {
    if (useStandard) {
        standardKeyboardLocks[lockingKey] = true
    }
    else {
        delete standardKeyboardLocks[lockingKey]
    }
}

function useStandardKeyboard() {
    return Object.values(standardKeyboardLocks).some(value => value === true)
}



// ---------------------------------------------------------------------------------- Composition
/**
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
        if (!useStandardKeyboard()) hiddenInput.focus(); // Use hidden input to ensure composition starts
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