import * as selectionController from "../controllers/selection/index.js";
import * as state from "../state/index.js";
import * as tools from "../controllers/tool_controller.js";
import * as actions from "./actions.js";
import {EMPTY_CHAR} from "../config/chars.js";

export function init() {
    setupKeydownListener();
    setupCompositionListener();
}

const $document = $(document);
let prevKey;

function setupKeydownListener() {
    $document.keydown(function(e) {
        const key = e.key; // Keyboard key. E.g., 'a', 'A', '1', '+', 'Shift', 'Enter', 'Backspace', etc.

        // console.log(`key: "${key}", prevKey: "${prevKey}"`)

        try {
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

            // App Shortcuts
            if (e.metaKey || e.ctrlKey || e.altKey) {
                const modifiers = ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'].filter(modifier => e[modifier]);
                if (actions.callActionByShortcut({ key, modifiers })) {
                    e.preventDefault();
                    return;
                }
            }

            // If the metaKey/ctrlKey is down, and it did not call an app shortcut, the user is likely performing
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
                    handleEnterKey(key, e);
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
        } finally {
            prevKey = key;
        }
    });
}

// -------------------------------------------------------------------------- Key handlers
/**
 * Each controller is given a chance to handle the key in order. If a controller consumes the event (by returning
 * true), subsequent controllers are skipped.
 */

function handleEscapeKey() {
    state.endHistoryModification();

    if (tools.handleEscapeKey()) return;
    if (selectionController.raster.handleEscapeKey()) return;
    if (selectionController.vector.handleEscapeKey()) return;
}

function handleTabKey(e) {
    if (selectionController.raster.handleTabKey(e.shiftKey)) return;

    actions.callActionByShortcut({ key: 'Tab' })
}

function handleEnterKey(key, e) {
    if (selectionController.raster.handleEnterKey(e.shiftKey)) return;
    if (selectionController.vector.handleEnterKey(e.shiftKey)) return;

    actions.callActionByShortcut({ key });
}

function handleBackspaceKey(key) {
    if (selectionController.raster.handleBackspaceKey(key === 'Delete')) return;
    if (selectionController.vector.handleBackspaceKey(key === 'Delete')) return;
    actions.callActionByShortcut({ key });
}

function handleCharKey(char) {
    if (tools.handleCharKey(char)) return;
    if (selectionController.raster.handleCharKey(char)) return;
    if (selectionController.vector.handleCharKey(char)) return;
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

// ---------------------------------------------------------------------------------- Composition
/**
 * Composition is a way to enter special characters by pressing a sequence of keys.
 * There are two common types of composition:
 *
 * 1) Dead key composition. For example, on macOS you can press Option+E once to start an accent composition. The
 *    accent "´" appears with an underline, indicating that the accent is pending. The next key determines the
 *    final character: pressing e → "é", i → "í", a → "á", etc. In this case the first keystroke ("´") is reported
 *    as a 'Dead' key and composition begins immediately.
 *
 * 2) IME composition. For example, when using Chinese Pinyin input on macOS, typing "mei" is converted to "美".
 *    However, the first keystroke "m" is inserted as normal text because composition has not started yet.
 *    When the second key "e" is pressed, composition begins, and editors must roll back the previously
 *    inserted "m" so it can be included in the composition buffer.
 *
 * We try to simulate this as best we can in the canvas by listening for compositionstart/update/end and drawing each
 * intermediate composition char.
 */

let isComposing = false;

function setupCompositionListener() {
    // To ensure composition works (even though the user is not typing into an input) we create a hidden input
    // offscreen that we focus on keydown.
    // TODO For IME composition, it may be helpful if this <input> is shown near the cursor, so they can see autocompletes
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

        // IME compositions need to rollback the previous character. See comment at start of this section for more info.
        const rollbackPrevChar = prevKey !== 'Dead';

        if (tools.handleCompositionStart(rollbackPrevChar)) return;
        if (selectionController.raster.handleCompositionStart(rollbackPrevChar)) return;
        if (selectionController.vector.handleCompositionStart(rollbackPrevChar)) return;
    });

    $document.on('compositionupdate', e => {
        const str = e.originalEvent.data;

        // The composed str can be multiple characters long if dead char composition failed (e.g. "´" + "x" = "´x"), or
        // if using IME composition. We pass the last string char as a second parameter to handlers in case they only
        // support strings of length 1.
        const char = str.charAt(str.length - 1);

        if (tools.handleCompositionUpdate(str, char)) return;
        if (selectionController.raster.handleCompositionUpdate(str, char)) return;
        if (selectionController.vector.handleCompositionUpdate(str, char)) return;
    });

    $document.on('compositionend', e => {
        isComposing = false;

        if (tools.handleCompositionEnd()) return;
        if (selectionController.raster.handleCompositionEnd()) return;
        if (selectionController.vector.handleCompositionEnd()) return;
    })
}