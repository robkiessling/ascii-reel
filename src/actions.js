import $ from "jquery";
import * as file from "./file.js";
import tippy from "tippy.js";
import {strings} from "./strings.js";
import {formattedModifierKey, isFunction} from "./utilities.js";

let actions;

// todo will move to preferences.js
// Format: { char: 'x', modifiers: ['alt', 'shift'] } // modifiers are optional
let actionToShortcut = {
    'clipboard.cut': { char: 'x', modifiers: ['meta'] },
    'clipboard.copy': { char: 'c', modifiers: ['meta'] },
    'clipboard.paste': { char: 'v', modifiers: ['meta'] },
    'clipboard.paste-in-selection': { char: 'v', modifiers: ['meta', 'shift'] },
    'editor.tools.text-editor': { char: 'e', modifiers: ['meta'] },
    'selection.select-all': { char: 'a', modifiers: ['meta'] },
    'state.undo': { char: 'z', modifiers: ['meta'] },
    'state.redo': { char: 'z', modifiers: ['meta', 'shift'] },

    'view.toggle-grid': { char: 'g', modifiers: ['meta'] },
    'view.grid-settings': { char: 'g', modifiers: ['meta', 'shift'] },
    'zoom.zoom-in': { displayChar: '+', char: '=', modifiers: ['meta', 'shift'] },
    'zoom.zoom-out': { displayChar: '-', char: '-', modifiers: ['meta', 'shift'] },
    'zoom.zoom-fit': { char: '0', modifiers: ['meta', 'shift'] },
};
let shortcutToAction; // populated by refreshShortcuts()


/**
 * @param key Unique string that can be used to call an action at a later time
 * @param data Object with attributes:
 *
 *     callback: fn             (required) Function to call when action is performed
 *     name: string/fn          (optional) Name to display in menus/tooltips. Default: strings[<key>.name]
 *     description: string/fn   (optional) Text to display in tooltips. Default: strings[<key>.description]
 *     enabled: boolean/fn      (optional) Whether the action is allowed to be called. Default: true
 *     shortcutAbbr: string/fn  (optional) Hardcoded shortcut abbreviation (not common; most abbr will come from preferences)
 *
 *     Alternatively, if `data` is just a function, it will be used as the callback
 *
 */
export function registerAction(key, data) {
    if (actions === undefined) {
        actions = {};
    }

    if (isFunction(data)) {
        data = { callback: data };
    }

    if (data.name === undefined) { data.name = strings[`${key}.name`]; }
    if (data.name === undefined) { console.warn(`No string found for: ${key}.name`); data.name = '(Unknown)'; }
    if (data.description === undefined) { data.description = strings[`${key}.description`]; }
    if (data.enabled === undefined) { data.enabled = true; }

    actions[key] = data;
}

export function refreshShortcuts() {
    shortcutToAction = {};

    for (let [action, shortcut] of Object.entries(actionToShortcut)) {
        const shortcutKey = getShortcutKey(shortcut);
        if (shortcutToAction[shortcutKey]) {
            console.warn(`There is already a shortcut for: ${shortcutKey}`);
        }
        shortcutToAction[shortcutKey] = action;
    }
}

export function getActionInfo(key) {
    if (actions[key] === undefined) {
        console.error('No action found for: ', key);
        return null;
    }

    let info = $.extend({}, actions[key]);

    if (isFunction(info.name)) { info.name = info.name(); }
    if (isFunction(info.description)) { info.description = info.description(); }
    if (isFunction(info.enabled)) { info.enabled = info.enabled(); }

    if (info.shortcutAbbr === undefined && actionToShortcut[key]) {
        info.shortcutAbbr = shortcutAbbr(actionToShortcut[key]);
    }

    return info;
}

// Returns true if the action is successfully called
export function callAction(key, callbackData) {
    const action = getActionInfo(key);

    if (action && action.enabled) {
        action.callback(callbackData);
        file.refreshMenu();
        return true;
    }

    return false;
}

export function callActionByShortcut(shortcut, callbackData) {
    const actionKey = shortcutToAction[getShortcutKey(shortcut)];
    if (actionKey !== undefined) {
        return callAction(actionKey, callbackData);
    }
}

export function setupTooltips(targets, getActionKey) {
    tippy(targets, {
        content: reference => {
            const actionKey = isFunction(getActionKey) ? getActionKey(reference) : getActionKey;
            const actionInfo = getActionInfo(actionKey);

            if (actionInfo) {
                let modifiers = '';
                if (ACTION_MODIFIERS[actionKey]) {
                    ACTION_MODIFIERS[actionKey].forEach(modification => {
                        const modifierKey = formattedModifierKey(MODIFIER_KEYS[modification]);
                        const modifierDesc = strings[modification];
                        modifiers += `<div class="modifier-desc"><span class="modifier-key">${modifierKey}</span><span>${modifierDesc}</span></div>`;
                    });
                }

                return  `<div class="header">` +
                    `<span class="title">${actionInfo.name}</span>` +
                    `<span class="shortcut">${actionInfo.shortcutAbbr ? actionInfo.shortcutAbbr : ''}</span>` +
                    `</div>` +
                    `<div class="description">${actionInfo.description}</div>` +
                    modifiers;
            }

            return '(Unknown)';
        },
        placement: 'right',
        hideOnClick: false,
        allowHTML: true
    });
}



/**
 * Some actions have modifiers (e.g. shift, alt) that affect what they do. These modifiers are determined by the following
 * constants and will not be customizable by the end user. ACTION_MODIFIERS has the format:
 *
 *      action: [ modification A, modification B, ... ]
 *
 * Where each modification is represented by a string that should be present in both:
 *      a) the MODIFIER_KEYS const (this is where it gets the type of modifier - i.e. shift, alt, etc.)
 *      b) the strings.js const (this is where it gets the modification description)
 */
const ACTION_MODIFIERS = {
    'editor.tools.selection-rect': ['editor.tools.selection.multiple'],
    'editor.tools.selection-line': ['editor.tools.selection.multiple'],
    'editor.tools.selection-lasso': ['editor.tools.selection.multiple'],
    'editor.tools.selection-wand': ['editor.tools.selection.multiple', 'editor.tools.selection-wand.diagonal', 'editor.tools.selection-wand.colorblind'],
    'editor.tools.paint-bucket': ['editor.tools.selection-wand.diagonal', 'editor.tools.selection-wand.colorblind'],
    'editor.selection.flip-v': ['editor.selection.flip-v.mirror'],
    'editor.selection.flip-h': ['editor.selection.flip-h.mirror'],
}

// Defines what modifier key is used for the effect. These are static; they won't be customizable by the user.
const MODIFIER_KEYS = {
    'editor.tools.selection.multiple': 'shiftKey',
    'editor.tools.selection-wand.diagonal': 'metaKey',
    'editor.tools.selection-wand.colorblind': 'altKey',
    'editor.selection.flip-v.mirror': 'altKey',
    'editor.selection.flip-h.mirror': 'altKey',
}

// Returns true if the given modification should be applied (based on the mouseEvent's modifier keys)
export function shouldModifyAction(modification, mouseEvent) {
    const modifierKey = MODIFIER_KEYS[modification];

    if (modifierKey === undefined) {
        console.error('Could not find modifier key for: ', modification);
        return false;
    }

    return mouseEvent[modifierKey];
}









// todo ctrl if windows
function shortcutAbbr(shortcut) {
    let result = '';

    if ($.isPlainObject(shortcut)) {
        shortcut.modifiers.forEach(modifier => {
            switch(modifier) {
                case 'meta':
                    result += '⌘';
                    break;
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
