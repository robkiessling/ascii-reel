import $ from "jquery";
import * as selection from "./selection.js";
import * as file from "./file.js";
import * as clipboard from "./clipboard.js";

export function callShortcut(shortcut) {
    const action = shortcutLookup[shortcutKey(shortcut)];

    if (action) {
        if (action.enabled === undefined || action.enabled()) {
            action.callback();
            return true;
        }
    }

    return false;
}

export function getAction(key) {
    return ACTIONS[key];
}

// todo ctrl if windows
export function shortcutAbbr(shortcut) {
    let result = '⌘';

    if ($.isPlainObject(shortcut)) {
        shortcut.modifiers.forEach(modifier => {
            switch(modifier) {
                case 'alt':
                    result += '⌥';
                    break;
                case 'shift':
                    result += '⇧';
                    break;
                default:
                    console.warn(`Unknown modifier: ${modifier}`);
            }
        });

        if (shortcut.displayChar) {
            result += shortcut.displayChar.toUpperCase();
        }
        else {
            result += shortcut.char.toUpperCase();
        }
    }
    else {
        result += shortcut.toUpperCase();
    }

    return result;
}

/**
 * Action format:
 *
 * key: {                       The key is how the action is referred to throughout the app
 *     name: string             Display name
 *     description: string      (optional) Text used for tooltips
 *     callback: function       Function to call when action is performed
 *     enabled: function        (optional) If given, the function must return true for action to be called
 *     shortcut: char OR obj    (optional) If a char, pressing this char will call the action.
 *                                         If an obj, object should be of format { char: 'x', modifiers: ['alt', 'shift'] }
 *                                         (modifiers are optional). Pressing the char while correct modifiers are also
 *                                         pressed will call the action.
 * }
 *
 */
const ACTIONS = {
    // ---------------------------------------------------------------- File
    'new-file': {
        name: 'New File',
        callback: () => file.newFile(),
        shortcut: 'n',
    },
    'open-file': {
        name: 'Open File',
        callback: () => file.openFile(),
        shortcut: 'o'
    },
    'save-file': {
        name: 'Save File',
        callback: () => file.openSaveDialog(),
        shortcut: 's'
    },
    'export-file': {
        name: 'Export File',
        callback: () => file.openExportDialog(),
        shortcut: 'e'
    },

    // ---------------------------------------------------------------- Edit
    undo: {
        name: 'Undo',
        description: '',
        callback: () => {}, // todo
        enabled: () => false,
        shortcut: 'z'
    },
    redo: {
        name: 'Redo',
        description: '',
        callback: () => {}, // todo
        enabled: () => false,
        shortcut: { char: 'z', modifiers: ['shift'] }
    },
    cut: {
        name: 'Cut',
        description: '',
        callback: () => clipboard.cut(),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: 'x'
    },
    copy: {
        name: 'Copy',
        description: '',
        callback: () => clipboard.copy(),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: 'c'
    },
    paste: {
        name: 'Paste',
        description: '',
        callback: () => clipboard.paste(),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: 'v'
    },
    'paste-in-selection': {
        name: 'Paste In Selection',
        description: '',
        callback: () => clipboard.paste(true),
        enabled: () => selection.hasSelection() && !selection.movableContent,
        shortcut: { char: 'v', modifiers: ['shift'] }
    },
    'commit-selection': {
        name: 'Commit Selection',
        description: '',
        callback: () => selection.finishMovingContent(),
        enabled: () => !!selection.movableContent
    },
    'select-all': {
        name: 'Select All',
        callback: () => selection.selectAll(),
        shortcut: 'a'
    },

    // ---------------------------------------------------------------- Edit
    'toggle-grid': {
        name: 'Show Grid',
        description: '',
        callback: () => {},
        enabled: () => false,
        shortcut: 'g'
    },
    'zoom-in': {
        name: 'Zoom In',
        description: '',
        callback: () => {},
        enabled: () => false,
        shortcut: { displayChar: '+', char: '=', modifiers: ['shift'] }
    },
    'zoom-out': {
        name: 'Zoom Out',
        description: '',
        callback: () => {},
        enabled: () => false,
        shortcut: { displayChar: '-', char: '-', modifiers: ['shift'] }
    },
    'zoom-fit': {
        name: 'Zoom Fit',
        description: '',
        callback: () => {},
        enabled: () => false,
        shortcut: { char: '0', modifiers: ['shift'] }
    },

    // ---------------------------------------------------------------- Tools
    'font-settings': {
        name: 'Font Settings',
        description: '',
        callback: () => {},
        enabled: () => false
    },
    'background-settings': {
        name: 'Background',
        description: '',
        callback: () => {},
        enabled: () => false
    },
    'resize-canvas': {
        name: 'Resize Canvas',
        description: '',
        callback: () => file.openResizeDialog()
    },
    'preferences': {
        name: 'Preferences',
        description: '',
        callback: () => {},
        enabled: () => false
    },
    'keyboard-shortcuts': {
        name: 'Keyboard Shortcuts',
        description: '',
        callback: () => {},
        enabled: () => false
    },

};


let shortcutLookup;
buildShortcutLookup();

function shortcutKey(shortcut) {
    let char, modifiers;

    if ($.isPlainObject(shortcut)) {
        char = shortcut.char.toLowerCase();
        modifiers = shortcut.modifiers;
    }
    else {
        char = shortcut.toLowerCase();
    }

    return modifiers && modifiers.length ? `${modifiers.sort().join('-')}-${char}` : char;
}

function buildShortcutLookup() {
    shortcutLookup = {};

    for (let [action, data] of Object.entries(ACTIONS)) {
        if (data.shortcut) {
            const key = shortcutKey(data.shortcut);
            if (shortcutLookup[key]) {
                console.warn(`There is already a shortcut for: ${key}`);
            }
            shortcutLookup[key] = data;
        }
    }
}
