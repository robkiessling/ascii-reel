import $ from "jquery";
import * as file from "./file.js";
import tippy from "tippy.js";
import {strings} from "./strings.js";
import {modifierWord, isFunction, isMacOS, modifierAbbr} from "./utilities.js";

let actions;

// todo will move to preferences.js
// Format: { char: 'x', modifiers: ['altKey', 'shiftKey'] } // modifiers are optional

let cmdKey = isMacOS() ? 'metaKey' : 'ctrlKey';
let actionIdToShortcut = {
    'clipboard.cut': { char: 'x', modifiers: [cmdKey] },
    'clipboard.copy': { char: 'c', modifiers: [cmdKey] },
    'clipboard.paste': { char: 'v', modifiers: [cmdKey] },
    'clipboard.paste-in-selection': { char: 'v', modifiers: [cmdKey, 'shiftKey'] },
    'editor.tools.text-editor': { char: 'e', modifiers: [cmdKey] },
    'selection.select-all': { char: 'a', modifiers: [cmdKey] },
    'state.undo': { char: 'z', modifiers: [cmdKey] },
    'state.redo': { char: 'z', modifiers: [cmdKey, 'shiftKey'] },

    'timeline.add-frame': { char: 'f', modifiers: [cmdKey, 'shiftKey'] },
    'timeline.duplicate-frame': { char: 'd', modifiers: [cmdKey, 'shiftKey'] },
    // 'timeline.delete-frame': { char: 'e', modifiers: [cmdKey, 'shiftKey'] },

    'view.toggle-grid': { char: 'g', modifiers: [cmdKey] },
    'view.grid-settings': { char: 'g', modifiers: [cmdKey, 'shiftKey'] },
    'zoom.zoom-in': { displayChar: '+', char: '=', modifiers: [cmdKey, 'shiftKey'] },
    'zoom.zoom-out': { displayChar: '-', char: '-', modifiers: [cmdKey, 'shiftKey'] },
    'zoom.zoom-fit': { char: '0', modifiers: [cmdKey, 'shiftKey'] },
};
let shortcutToActionId; // populated by refreshShortcuts()


/**
 * @param id   Unique identifier string that can be used to call an action at a later time
 * @param data Object with attributes:
 *
 *     callback: fn             (required) Function to call when action is performed
 *     name: string/fn          (optional) Name to display in menus/tooltips. Default: strings[<id>.name]
 *     description: string/fn   (optional) Text to display in tooltips. Default: strings[<id>.description]
 *     enabled: boolean/fn      (optional) Whether the action is allowed to be called. Default: true
 *     shortcutAbbr: string/fn  (optional) Hardcoded shortcut abbreviation (not common; most abbr will come from preferences)
 *
 *     Alternatively, if `data` is just a function, it will be used as the callback
 *
 */
export function registerAction(id, data) {
    if (actions === undefined) {
        actions = {};
    }

    if (isFunction(data)) {
        data = { callback: data };
    }

    if (data.name === undefined) { data.name = strings[`${id}.name`]; }
    if (data.name === undefined) { console.warn(`No string found for: ${id}.name`); data.name = '(Unknown)'; }
    if (data.description === undefined) { data.description = strings[`${id}.description`]; }
    if (data.enabled === undefined) { data.enabled = true; }

    if (actions[id] !== undefined) { console.warn(`Re-registering action: ${id}`); }
    actions[id] = data;
}

export function refreshShortcuts() {
    shortcutToActionId = {};

    for (let [actionId, shortcut] of Object.entries(actionIdToShortcut)) {
        const shortcutKey = getShortcutKey(shortcut);
        if (shortcutToActionId[shortcutKey]) {
            console.warn(`There is already a shortcut for: ${shortcutKey}`);
        }
        shortcutToActionId[shortcutKey] = actionId;
    }
}

export function getActionInfo(id) {
    if (actions[id] === undefined) {
        console.error('No action found for: ', id);
        return null;
    }

    let info = $.extend({}, actions[id]);

    if (isFunction(info.name)) { info.name = info.name(); }
    if (isFunction(info.description)) { info.description = info.description(); }
    if (isFunction(info.enabled)) { info.enabled = info.enabled(); }

    if (info.shortcutAbbr === undefined && actionIdToShortcut[id]) {
        info.shortcutAbbr = shortcutAbbr(actionIdToShortcut[id]);
    }

    return info;
}

export function isActionEnabled(id) {
    if (actions[id] === undefined) {
        console.error('No action found for: ', id);
        return false;
    }

    return isFunction(actions[id].enabled) ? actions[id].enabled() : actions[id].enabled;
}

// Returns true if the action is successfully called
export function callAction(id, callbackData) {
    if (isActionEnabled(id)) {
        actions[id].callback(callbackData);
        file.refreshMenu();
        return true;
    }

    return false;
}

export function callActionByShortcut(shortcut, callbackData) {
    const actionId = shortcutToActionId[getShortcutKey(shortcut)];
    return actionId === undefined ? false : callAction(actionId, callbackData);
}

export function setupTooltips(targets, getActionId, options = {}) {
    return tippy(targets, $.extend({}, {
        content: element => {
            const actionId = isFunction(getActionId) ? getActionId(element) : getActionId;
            const actionInfo = getActionInfo(actionId);

            if (actionInfo) {
                let modifiers = '';
                if (ACTION_MODIFIERS[actionId]) {
                    ACTION_MODIFIERS[actionId].forEach(modification => {
                        const modifierKey = modifierWord(MODIFIER_KEYS[modification]);
                        const modifierDesc = strings[modification];
                        modifiers += `<div class="modifier-desc"><span class="modifier-key">${modifierKey}</span><span>${modifierDesc}</span></div>`;
                    });
                }

                return  `<div class="header">` +
                    `<span class="title">${actionInfo.name}</span>` +
                    `<span class="shortcut">${actionInfo.shortcutAbbr ? actionInfo.shortcutAbbr : ''}</span>` +
                    `</div>` +
                    `<div class="description">${actionInfo.description ? actionInfo.description : ''}</div>` +
                    modifiers;
            }

            return '(Unknown)';
        },
        placement: 'right',
        hideOnClick: false,
        allowHTML: true
    }, options));
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
    'editor.tools.selection-wand.diagonal': isMacOS() ? 'metaKey' : 'ctrlKey',
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









function shortcutAbbr(shortcut) {
    let result = '';

    if ($.isPlainObject(shortcut)) {
        shortcut.modifiers.forEach(modifier => result += modifierAbbr(modifier));

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
