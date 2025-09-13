import * as selectionController from "../controllers/selection/index.js";
import * as state from "../state/index.js";
import * as tools from "../controllers/tool_controller.js";
import * as actions from "./actions.js";
import {EMPTY_CHAR} from "../config/chars.js";

const $document = $(document);

export function init() {
    setupKeydownListener();
    setupCompositionListener();
}


function setupKeydownListener() {
    $document.keydown(function(e) {
        const key = e.key; // Keyboard key. E.g., 'a', 'A', '1', '[', 'Shift', 'Enter', 'Backspace', etc.
        // console.log(key);

        if (useStandardKeyboard()) {
            handleStandardKeyboard(key, e);
            return;
        }

        if (key === 'Unidentified') {
            console.warn(`Unidentified key for event: ${e}`);
            return;
        }

        // A 'Dead' key is received when composition starts (see composition section below)
        if (key === 'Dead' || isComposing) return;

        // Ascii Reel Shortcuts
        if (e.metaKey || e.ctrlKey || e.altKey) {
            const modifiers = ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'].filter(modifier => e[modifier]);
            if (actions.callActionByShortcut({ key, modifiers })) {
                e.preventDefault();
                return;
            }
        }

        // If the metaKey/ctrlKey is down, and it did not reach one of our shortcuts, the user is likely performing
        // a standard browser shortcut (e.g. cmd-R to reload). Return early (without preventing default) so that the
        // browser shortcut works as normal. Note: a few browser shortcuts are prevented, see handleBrowserShortcut.
        if (e.metaKey || e.ctrlKey) {
            handleBrowserShortcut(e, key);
            return;
        }

        switch (key) {
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
                handleBackspaceKey(key);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowDown':
                handleArrowKey(key, e);
                break;
            default:
                if (key.length !== 1) return; // Unrecognized input; let browser handle as normal
                handleCharKey(key);
        }

        e.preventDefault();
    });
}

function handleEscapeKey() {
    state.endHistoryModification();

    if (tools.handleEscapeKey()) return;

    selectionController.clear();
}

function handleTabKey(e) {
    if (selectionController.raster.handleTabKey(e.shiftKey)) return;

    actions.callActionByShortcut({ key: 'Tab' })
}

function handleEnterKey(e) {
    selectionController.raster.handleEnterKey(e.shiftKey);
}

function handleBackspaceKey(key) {
    if (tools.handleCharKey(EMPTY_CHAR)) return;
    if (selectionController.raster.handleBackspaceKey(key === 'Delete')) return;
    actions.callActionByShortcut({ key });
}

function handleCharKey(char, isComposing = false) {
    if (tools.handleCharKey(char, isComposing)) return;
    if (selectionController.raster.handleCharKey(char, isComposing)) return;
    actions.callActionByShortcut({ key: char });
}

function handleArrowKey(arrowKey, e) {
    const direction = arrowKeyToDirection(arrowKey);

    if (selectionController.raster.handleArrowKey(direction, e.shiftKey)) return;
    if (selectionController.vector.handleArrowKey(direction, e.shiftKey)) return;

    actions.callActionByShortcut({ key: arrowKey });
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

function handleStandardKeyboard(key, e) {
    if (key === 'Enter') {
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
function handleBrowserShortcut(e, key) {
    if (PREVENT_DEFAULT_BROWSER_SHORTCUTS.has(key)) {
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
 * @param {string} lockingKey - A unique key to assign this toggle to. This allows multiple sources to call toggleStandard
 *   and the standard keyboard will be used if ANY locks remain.
 * @param {boolean} useStandard - If true, lock will be applied (standard keyboard will be used). If false, lock will be
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

        // When isComposing is true, the char picker will not be closed yet, and the selection caret will not be moved yet
        handleCharKey(char, true);
    });

    $document.on('compositionend', e => {
        isComposing = false;

        // Now that composition is finished, manually close char picker and move caret (if cursorCell)
        if (tools.isCharPickerOpen()) {
            tools.toggleCharPicker(false);
        }
        if (selectionController.raster.caretCell()) {
            selectionController.raster.moveInDirection('right', { updateCaretOrigin: false, saveHistory: false })
        }

        // TODO technically we should do something like this, otherwise redo doesn't fully work when final char has accent
        // state.pushHistory({ modifiable: 'rasterSelectionText' })
    })
}