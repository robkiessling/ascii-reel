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
    // 'tools.standard.text-editor': { char: 'e', modifiers: [cmdKey] },
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
 *     icon: string/fn          (optional) Class name of icon:
 *                                         - If this is a button, icon will replace button's content
 *                                         - If this is a menu action, icon is shown next to action name
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
    if (isFunction(info.icon)) { info.icon = info.icon(); }

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
 * @param {string | Element[]} targets Can be a DOM query selector or an Array of DOM elements. These elements are the
 *   action buttons that the tooltips will be attached to.
 * @param {string | function(element):string} getActionId Can be an action-id string, or a function that returns an action-id.
 *   The function will be passed an `element` that refers to each target.
 * @param options Standard tippy options
 * @returns {{tooltips: Tippy[], refreshContent: function}}
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

    const refreshContent = () => {
        tooltips.forEach(tooltip => {
            tooltip.setContent(tooltipContentBuilder(getActionId));
        })
    }

    return { tooltips, refreshContent };
}

/**
 * Looks for any buttons with [data-action] attributes in the $container and attaches the appropriate action to them.
 * Also sets up tooltips.
 * @param $container
 * @param tooltipOptions
 * @returns {{tooltips: Tippy[], refreshContent: function}}
 */
export function setupActionButtons($container, tooltipOptions) {
    attachClickHandlers($container);

    const $buttons = $container.find('[data-action]');
    const getActionId = (button) => $(button).data('action')

    const { tooltips, refreshContent: refreshTooltips } = setupTooltips($buttons.toArray(), getActionId, tooltipOptions)

    return {
        tooltips: tooltips,
        refreshContent: () => {
            // Refresh any button icons if the action has an `icon` attribute
            $buttons.each((index, button) => {
                const actionId = getActionId(button);
                const actionInfo = getActionInfo(actionId);
                if (actionInfo.icon) $(button).empty().append(`<span class="ri ri-fw ${actionInfo.icon}"></span>`);
            })

            refreshTooltips();
        }
    }
}

/**
 * Attaches click handlers to all buttons (that have a data-action attribute) within the container.
 * @param $container
 */
function attachClickHandlers($container) {
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
    'tools.standard.fill-char': ['tools.standard.fill-char.diagonal', 'tools.standard.fill-char.colorblind'],
    'tools.standard.selection-rect': ['tools.standard.selection.multiple', 'tools.standard.selection-rect.outline'],
    'tools.standard.selection-line': ['tools.standard.selection.multiple'],
    'tools.standard.selection-lasso': ['tools.standard.selection.multiple'],
    'tools.standard.selection-wand': ['tools.standard.selection.multiple', 'tools.standard.selection-wand.diagonal', 'tools.standard.selection-wand.colorblind'],
    'tools.standard.move-all': ['tools.standard.move-all.all-layers', 'tools.standard.move-all.all-frames', 'tools.standard.move-all.wrap'],
    'tools.standard.fill-color': ['tools.standard.fill-color.diagonal', 'tools.standard.fill-color.colorblind'],
    'tools.standard.color-swap': ['tools.standard.color-swap.all-layers', 'tools.standard.color-swap.all-frames'],
    'tools.standard.eyedropper': ['tools.standard.eyedropper.add-to-palette'],
    'tools.selection.flip-v': ['tools.selection.flip-v.mirror'],
    'tools.selection.flip-h': ['tools.selection.flip-h.mirror'],
}

// Defines what modifier key is used for the effect. These are static; they won't be customizable by the user.
const MODIFIER_KEYS = {
    'tools.standard.fill-char.diagonal': 'altKey',
    'tools.standard.fill-char.colorblind': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.selection.multiple': 'shiftKey',
    'tools.standard.selection-rect.outline': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.selection-wand.diagonal': 'altKey',
    'tools.standard.selection-wand.colorblind': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.fill-color.diagonal': 'altKey',
    'tools.standard.fill-color.colorblind': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.move-all.all-layers': 'shiftKey',
    'tools.standard.move-all.all-frames': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.move-all.wrap': 'altKey',
    'tools.standard.color-swap.all-layers': 'shiftKey',
    'tools.standard.color-swap.all-frames': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.eyedropper.add-to-palette': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.selection.flip-v.mirror': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.selection.flip-h.mirror': isMacOS() ? 'metaKey' : 'ctrlKey',
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
