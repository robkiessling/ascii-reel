import tippy from "tippy.js";
import {strings} from "../config/strings.js";
import {isFunction}from "../utils/utilities.js";
import {isMacOS, modifierAbbr, modifierWord} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";

let actions;

// todo will move to preferences.js
// Format: { char: 'x', modifiers: ['altKey', 'shiftKey'] } // modifiers are optional
// If value is an array, that means the action has multiple shortcuts. The first element is displayed as the abbr.
let cmdKey = isMacOS() ? 'metaKey' : 'ctrlKey';
let actionIdToShortcut = {
    'file.open': { char: 'o', modifiers: [cmdKey] },
    'file.export-as': { char: 'e', modifiers: [cmdKey, 'shiftKey'] },
    'file.export-active': { char: 'e', modifiers: [cmdKey] },

    // Note: file.save is not shown in toolbar anywhere, it actually ends up calling either file.saveTo or file.saveAs
    'file.save': { char: 's', modifiers: [cmdKey] },

    'clipboard.cut': { char: 'x', modifiers: [cmdKey] },
    'clipboard.copy': { char: 'c', modifiers: [cmdKey] },
    'clipboard.paste': { char: 'v', modifiers: [cmdKey] },
    'clipboard.paste-in-selection': { char: 'v', modifiers: [cmdKey, 'shiftKey'] },
    // 'editor.tools.text-editor': { char: 'e', modifiers: [cmdKey] },
    'selection.select-all': { char: 'a', modifiers: [cmdKey] },
    'state.undo': { char: 'z', modifiers: [cmdKey] },
    'state.redo': { char: 'z', modifiers: [cmdKey, 'shiftKey'] },

    'frames.new-frame': { char: 'f', modifiers: [cmdKey, 'shiftKey'] }, // Not using 'n' since that is reserved for new window
    'frames.duplicate-frame': { char: 'd', modifiers: [cmdKey, 'shiftKey'] },
    'frames.delete-frame': [
        { char: 'Delete', modifiers: [cmdKey] },
        { char: 'Backspace', modifiers: [cmdKey] }
    ],
    'frames.toggle-onion': { char: 'o', modifiers: [cmdKey, 'shiftKey'] },

    'view.toggle-grid': { char: 'g', modifiers: [cmdKey, 'shiftKey'] },
    'view.toggle-whitespace': { char: 'p', modifiers: [cmdKey, 'shiftKey'] },
    'view.zoom-in': { displayChar: '+', char: '=', modifiers: [cmdKey] },
    'view.zoom-out': { displayChar: '-', char: '-', modifiers: [cmdKey] },
    'view.zoom-fit': { char: '0', modifiers: [cmdKey] },
};

let shortcutToActionId = {};

export function init() {
    shortcutToActionId = {};

    for (let [actionId, shortcutData] of Object.entries(actionIdToShortcut)) {
        (Array.isArray(shortcutData) ? shortcutData : [shortcutData]).forEach(shortcut => {
            const shortcutKey = getShortcutKey(shortcut);
            if (shortcutToActionId[shortcutKey]) console.warn(`There is already a shortcut for: ${shortcutKey}`);
            shortcutToActionId[shortcutKey] = actionId;
        })
    }
}


/**
 * @param id   Unique identifier string that can be used to call an action at a later time
 * @param data Object with attributes:
 *
 *     callback: fn             (required) Function to call when action is performed
 *     name: string/fn          (optional) Name to display in menus/tooltips. Default: strings[<id>.name]
 *     description: string/fn   (optional) Text to display in tooltips. Default: strings[<id>.description]
 *     enabled: boolean/fn      (optional) Whether the action is allowed to be called. Default: true
 *     shortcutAbbr: string/fn  (optional) Hardcoded shortcut abbreviation (not common; most abbr will come from preferences)
 *     icon: string             (optional) Icon class to show next to action (currently only applies to menu actions)
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
    if (data.name === undefined) { data.name = ''; }
    if (data.description === undefined) { data.description = strings[`${id}.description`]; }
    if (data.enabled === undefined) { data.enabled = true; }

    if (actions[id] !== undefined) { console.warn(`Re-registering action: ${id}`); }
    actions[id] = data;
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
        eventBus.emit(EVENTS.ACTIONS.PERFORMED);
        return true;
    }

    return false;
}

export function callActionByShortcut(shortcut, callbackData) {
    const actionId = shortcutToActionId[getShortcutKey(shortcut)];
    return actionId === undefined ? false : callAction(actionId, callbackData);
}

/**
 * Sets up tippy tooltips for a group of action buttons
 * @param targets Can be an Array of DOM elements or a DOM query selector. These elements are the action buttons that
 *   the tooltips will be attached to.
 * @param getActionId Can be an action-id string, or a function that returns an action-id. The function will be passed
 *   an `element` that refers to each target.
 * @param options Standard tippy options
 * @returns {Array.<Tippy>} The array also has a `refreshContent` function that can be called to refresh
 *   the content of all its tooltips (e.g. useful if action->description is a function and needs to be re-evaluated)
 */
export function setupTooltips(targets, getActionId, options = {}) {
    const tooltips = tippy(targets, $.extend({}, {
        content: tooltipContentBuilder(getActionId),
        placement: 'right',
        hideOnClick: false,
        allowHTML: true,
        onShow(tooltipInstance) {
            // If there is no tooltip content (e.g. action has no name/description), hide the tip (do not show an empty bubble)
            if (tooltipInstance.props.content.length === 0) return false;
        }
    }, options));

    tooltips.refreshContent = () => {
        tooltips.forEach(tooltip => {
            tooltip.setContent(tooltipContentBuilder(getActionId));
        })
    }

    return tooltips;
}

/**
 * Attaches click handlers to all buttons (that have a data-action attribute) within the container.
 * @param $container
 */
export function attachClickHandlers($container) {
    $container.off('click', '[data-action]').on('click', '[data-action]', evt => {
        const $element = $(evt.currentTarget);
        if (!$element.hasClass('disabled')) {
            callAction($element.data('action'))
        }
    });
}

function tooltipContentBuilder(getActionId) {
    return element => {
        const actionId = isFunction(getActionId) ? getActionId(element) : getActionId;
        const actionInfo = getActionInfo(actionId);
        if (!actionInfo) return '';
        if (!actionInfo.name && !actionInfo.description) return '';

        let modifiers = '';
        if (ACTION_MODIFIERS[actionId]) {
            ACTION_MODIFIERS[actionId].forEach(modification => {
                const modifierKey = modifierWord(MODIFIER_KEYS[modification]);
                const modifierDesc = strings[modification];
                modifiers += `<div class="modifier-desc"><span class="modifier-key">${modifierKey}</span><span>${modifierDesc}</span></div>`;
            });
        }

        const htmlDescription = actionInfo.description ? actionInfo.description.replace(/\n/g, '<br/>') : '';

        if (actionInfo.name) {
            return `<div class="header">` +
                `<span class="title">${actionInfo.name}</span>` +
                `<span class="shortcut">${actionInfo.shortcutAbbr ? actionInfo.shortcutAbbr : ''}</span>` +
                `</div>` +
                `<div class="description">${htmlDescription}</div>` +
                modifiers;
        }
        else {
            return `<div class="description">${htmlDescription}</div>` +
                modifiers;
        }
    }
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
    'editor.tools.fill-char': ['editor.tools.fill-char.diagonal', 'editor.tools.fill-char.colorblind'],
    'editor.tools.selection-rect': ['editor.tools.selection.multiple', 'editor.tools.selection-rect.outline'],
    'editor.tools.selection-line': ['editor.tools.selection.multiple'],
    'editor.tools.selection-lasso': ['editor.tools.selection.multiple'],
    'editor.tools.selection-wand': ['editor.tools.selection.multiple', 'editor.tools.selection-wand.diagonal', 'editor.tools.selection-wand.colorblind'],
    'editor.tools.move-all': ['editor.tools.move-all.all-layers', 'editor.tools.move-all.all-frames', 'editor.tools.move-all.wrap'],
    'editor.tools.fill-color': ['editor.tools.fill-color.diagonal', 'editor.tools.fill-color.colorblind'],
    'editor.tools.color-swap': ['editor.tools.color-swap.all-layers', 'editor.tools.color-swap.all-frames'],
    'editor.tools.eyedropper': ['editor.tools.eyedropper.add-to-palette'],
    'editor.selection.flip-v': ['editor.selection.flip-v.mirror'],
    'editor.selection.flip-h': ['editor.selection.flip-h.mirror'],
}

// Defines what modifier key is used for the effect. These are static; they won't be customizable by the user.
const MODIFIER_KEYS = {
    'editor.tools.fill-char.diagonal': 'altKey',
    'editor.tools.fill-char.colorblind': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.tools.selection.multiple': 'shiftKey',
    'editor.tools.selection-rect.outline': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.tools.selection-wand.diagonal': 'altKey',
    'editor.tools.selection-wand.colorblind': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.tools.fill-color.diagonal': 'altKey',
    'editor.tools.fill-color.colorblind': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.tools.move-all.all-layers': 'shiftKey',
    'editor.tools.move-all.all-frames': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.tools.move-all.wrap': 'altKey',
    'editor.tools.color-swap.all-layers': 'shiftKey',
    'editor.tools.color-swap.all-frames': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.tools.eyedropper.add-to-palette': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.selection.flip-v.mirror': isMacOS() ? 'metaKey' : 'ctrlKey',
    'editor.selection.flip-h.mirror': isMacOS() ? 'metaKey' : 'ctrlKey',
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

    if (Array.isArray(shortcut)) {
        shortcut = shortcut[0]; // Use first shortcut option as the abbreviation
    }

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
