import $ from "jquery";
// import * as file from "./file.js"; // todo this doesn't work

let actions;
let shortcutLookup;

/**
 * @param key Unique string that can be used to call an action at a later time
 * @param data Object with attributes:
 *
 *     name: string             Display name
 *     description: string      (optional) Text used for tooltips
 *     callback: function       Function to call when action is performed
 *     enabled: function        (optional) If given, the function must return true for action to be called
 *     shortcut: char OR obj    (optional) If a char, pressing this char will call the action.
 *                                         If an obj, object should be of format { char: 'x', modifiers: ['alt', 'shift'] }
 *                                         (modifiers are optional). Pressing the char while correct modifiers are also
 *                                         pressed will call the action.
 */
export function registerAction(key, data) {
    if (actions === undefined) {
        actions = {}; shortcutLookup = {};
    }

    data.key = key;
    actions[key] = data;

    if (data.shortcut) {
        const shortcutKey = getShortcutKey(data.shortcut);
        if (shortcutLookup[shortcutKey]) {
            console.warn(`There is already a shortcut for: ${shortcutKey}`);
        }
        shortcutLookup[shortcutKey] = data;
    }
}

export function getActionInfo(key) {
    return actions[key];
}

export function callActionByKey(key) {
    return callAction(getActionInfo(key));
}

export function callActionByShortcut(shortcut) {
    const action = shortcutLookup[getShortcutKey(shortcut)];
    return callAction(action)
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

// Returns true if the action is successfully called
function callAction(action) {
    if (action && (action.enabled === undefined || action.enabled())) {
        action.callback();
        // file.refreshMenu();
        return true;
    }

    return false;
}

function getShortcutKey(shortcut) {
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
