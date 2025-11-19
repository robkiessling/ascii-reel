import tippy from "tippy.js";
import {STRINGS} from "../config/strings.js";
import {isFunction}from "../utils/utilities.js";
import {isMacOS, modifierAbbr, modifierWord} from "../utils/os.js";
import {eventBus, EVENTS} from "../events/events.js";
import {capitalizeFirstLetter, strToHTML} from "../utils/strings.js";
import {isObject} from "../utils/objects.js";
import {refreshableTooltips} from "../components/tooltips.js";

let actions;

// todo will move to preferences.js
// Format: { key: 'x', modifiers: ['altKey', 'shiftKey'] } // modifiers are optional
// If value is an array, that means the action has multiple shortcuts. The first element is displayed as the abbr.
let cmdKey = isMacOS() ? 'metaKey' : 'ctrlKey';
let actionIdToShortcut = {
    'file.open': { key: 'o', modifiers: [cmdKey] },
    'file.export-as': { key: 'e', modifiers: [cmdKey] },
    'file.export-active': { key: 'e', modifiers: [cmdKey, 'shiftKey'] },

    // Note: file.save is not shown in toolbar anywhere, it actually ends up calling either file.saveTo or file.saveAs
    'file.save': { key: 's', modifiers: [cmdKey] },

    'clipboard.cut': { key: 'x', modifiers: [cmdKey] },
    'clipboard.copy': { key: 'c', modifiers: [cmdKey] },
    'clipboard.paste': { key: 'v', modifiers: [cmdKey] },
    'clipboard.paste-in-selection': { key: 'v', modifiers: [cmdKey, 'shiftKey'] },
    // 'tools.standard.text-editor': { key: 'e', modifiers: [cmdKey] },
    'selection.select-all': { key: 'a', modifiers: [cmdKey] },
    'state.undo': { key: 'z', modifiers: [cmdKey] },
    'state.redo': { key: 'z', modifiers: [cmdKey, 'shiftKey'] },

    'frames.new-frame': { key: 'f', modifiers: [cmdKey, 'shiftKey'] }, // Not using 'n' since that is reserved for new window
    'frames.duplicate-frame': { key: 'd', modifiers: [cmdKey, 'shiftKey'] },
    'frames.delete-frame': [
        { key: 'Delete', modifiers: [cmdKey] },
        { key: 'Backspace', modifiers: [cmdKey] }
    ],
    'frames.toggle-onion': { key: 'o', modifiers: [cmdKey, 'shiftKey'] },
    'frames.previous-frame': { key: ',' },
    'frames.next-frame': { key: '.' },

    'view.toggle-grid': { key: 'g', modifiers: [cmdKey, 'shiftKey'] },
    'view.toggle-whitespace': { key: 'p', modifiers: [cmdKey, 'shiftKey'] },
    'view.zoom-in': { displayKey: '+', key: '=', modifiers: [cmdKey] },
    'view.zoom-out': { displayKey: '-', key: '-', modifiers: [cmdKey] },
    'view.zoom-default': { key: '0', modifiers: [cmdKey] },

    'tools.standard.select': { key: 's' },
    'tools.standard.text-editor': { key: 't' },
    'tools.standard.draw-freeform': { key: 'f' },
    'tools.standard.eraser': { key: 'e' },
    // 'tools.standard.draw-line': { key: 'l' },
    'tools.standard.draw-rect': { key: 'r' },
    'tools.standard.draw-ellipse': { key: 'o' },
    // 'tools.standard.draw-textbox': { key: 't' }, // todo same key
    'tools.standard.fill-char': { key: 'p' },
    // 'tools.standard.selection-lasso': { key: 's' },
    'tools.standard.selection-wand': { key: 'w' },
    'tools.standard.pan': { key: 'h' },
    'tools.standard.move-all': { key: 'm' },
    'tools.standard.paint-brush': { key: 'b' },
    'tools.shapes.charPicker': { key: 'c' },
    'tools.shapes.quickSwapChar': { key: 'q' },

    'themes.select-light-mode': { key: 'l' },
    'themes.select-dark-mode': { key: 'k' },
};

let shortcutToActionId = {};

export function init() {
    shortcutToActionId = {};

    for (let [actionId, shortcutData] of Object.entries(actionIdToShortcut)) {
        (Array.isArray(shortcutData) ? shortcutData : [shortcutData]).forEach(shortcut => {
            const shortcutKey = getFullKey(shortcut);
            if (shortcutToActionId[shortcutKey]) console.warn(`There is already a shortcut for: ${shortcutKey}`);
            shortcutToActionId[shortcutKey] = actionId;
        })
    }
}


/**
 * @param {string} id - Unique identifier string that can be used to call an action at a later time.
 * @param {function | Object} data - Action data. If param is a function, it is equivalent to passing { callback: fn }
 * @param {function} data.callback - Function to call when action is performed
 * @param {string|function:string} [data.name] - Name to display in menus/tooltips. Default: strings[<id>.name]
 * @param {string|function:string} [data.description] - Text to display in tooltips. Default: strings[<id>.description]
 * @param {boolean|function:boolean} [data.enabled=true] - Whether the action is allowed to be called. If disabled, the
 *   action will be greyed out and un-clickable.
 * @param {boolean|function:boolean} [data.visible=true] - Whether the action is visible in the UI. If an action is
 *   not visible it can still be called via shortcut -- if that is not desired make sure enabled is also false.
 * @param {string|function:string} [data.shortcutAbbr] - Hardcoded shortcut abbreviation (not common; most abbr will
 *   come from preferences)
 * @param {string|function:string} [data.icon] - Class name of an icon (e.g. remixicon class). If the action is shown in
 *   a <button>, the icon will be used for the button's content. If the action is shown in the menu, the icon will be
 *   shown next to the action name.
 */
export function registerAction(id, data) {
    if (actions === undefined) {
        actions = {};
    }

    if (isFunction(data)) {
        data = { callback: data };
    }

    if (data.name === undefined) { data.name = STRINGS[`${id}.name`]; }
    if (data.name === undefined) { data.name = ''; }
    if (data.description === undefined) { data.description = STRINGS[`${id}.description`]; }
    if (data.enabled === undefined) { data.enabled = true; }
    if (data.visible === undefined) { data.visible = true; }

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
    if (isFunction(info.visible)) { info.visible = info.visible(); }
    if (isFunction(info.icon)) { info.icon = info.icon(); }
    if (isFunction(info.shortcutAbbr)) { info.shortcutAbbr = info.shortcutAbbr(); }

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

export function isActionVisible(id) {
    if (actions[id] === undefined) {
        console.error('No action found for: ', id);
        return false;
    }

    return isFunction(actions[id].visible) ? actions[id].visible() : actions[id].visible;
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
    const actionId = shortcutToActionId[getFullKey(shortcut)];
    return actionId === undefined ? false : callAction(actionId, callbackData);
}

/**
 * Sets up tippy tooltips for a group of action buttons. Tooltips are built purely based on action-ids:
 * - the tooltip's title/content will come from STRINGS['action-id.name'] and STRINGS['action-id.description'], respectively.
 * - if the action has a shortcut, that shortcut will be shown next to the title.
 * - if the action has any modifiers, those modifier keys / descriptions will be shown at the bottom of the tooltip.
 * @param {string | Element[]} $elements - jQuery elements to attach tooltip(s) to
 * @param {string | function(JQuery):string} getActionId - Can be an action-id string, or a function that returns an
 *   action-id. All tooltip content will be derived based on this action-id.
 * @param overrides - Standard tippy options
 * @returns {{tooltips: import('tippy.js').Instance[], refreshContent: function}}
 */
export function setupActionTooltips($elements, getActionId, overrides = {}) {
    const contentBuilder = element => {
        const actionId = isFunction(getActionId) ? getActionId($(element)) : getActionId;
        const actionInfo = getActionInfo(actionId);
        if (!actionInfo) return '';
        if (!actionInfo.name && !actionInfo.description) return '';

        let modifiers = '';
        if (ACTION_MODIFIERS[actionId]) {
            ACTION_MODIFIERS[actionId].forEach(modification => {
                const modifierKey = modifierWord(MODIFIER_KEYS[modification]);
                const modifierDesc = STRINGS[modification];
                modifiers += `<div class="modifier-desc"><span class="modifier-key">${modifierKey}</span><span>${modifierDesc}</span></div>`;
            });
        }

        const htmlDescription = actionInfo.description ? strToHTML(actionInfo.description) : '';

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

    return refreshableTooltips($elements, contentBuilder, {
        onShow(tooltipInstance) {
            // If there is no tooltip content (e.g. action has no name/description), hide the tip (do not show an empty bubble)
            if (tooltipInstance.props.content.length === 0) return false;
        },
        ...overrides
    })
}

/**
 * Looks for any buttons with [data-action] attributes in the $container and attaches the appropriate action to them.
 * Also sets up tooltips (see setupActionTooltips for more info).
 * @param $container - Element containing buttons
 * @param {Object} [tooltipOptions] - Standard tippy options
 * @returns {{tooltips: Tippy[], refreshContent: function}}
 */
export function setupActionButtons($container, tooltipOptions = {}) {
    attachClickHandlers($container);

    const $buttons = $container.find('[data-action]');

    const { tooltips, refreshContent: refreshTooltips } = setupActionTooltips($buttons, $button => $button.data('action'), tooltipOptions)

    return {
        tooltips: tooltips,
        refreshContent: () => {
            // Refresh any button icons if the action has an `icon` attribute
            $buttons.each((index, button) => {
                const $button = $(button);
                const actionId = $button.data('action');
                const actionInfo = getActionInfo(actionId);

                $button.toggleClass('hidden', !actionInfo.visible)
                if (actionInfo.icon) $button.empty().append(`<span class="ri ri-fw ${actionInfo.icon}"></span>`);
            })

            refreshTooltips();
        }
    }
}

/**
 * Attaches click handlers to all buttons (that have a data-action attribute) within the container.
 * @param $container - Element containing buttons
 */
function attachClickHandlers($container) {
    $container.off('click', '[data-action]').on('click', '[data-action]', evt => {
        const $element = $(evt.currentTarget);
        if (!$element.hasClass('disabled')) {
            callAction($element.data('action'))
        }
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
    'tools.standard.fill-char': ['tools.standard.fill-char.diagonal'],
    'tools.standard.selection-rect': ['tools.standard.selection.multiple', 'tools.standard.selection-rect.outline'],
    'tools.standard.selection-line': ['tools.standard.selection.multiple'],
    'tools.standard.selection-lasso': ['tools.standard.selection.multiple'],
    'tools.standard.selection-wand': ['tools.standard.selection.multiple', 'tools.standard.selection-wand.diagonal'],
    'tools.standard.move-all': ['tools.standard.move-all.all-layers', 'tools.standard.move-all.all-frames', 'tools.standard.move-all.wrap'],
    'tools.standard.color-swap': ['tools.standard.color-swap.all-layers', 'tools.standard.color-swap.all-frames'],
    'tools.selection.flip-v': ['tools.selection.flip-v.mirror'],
    'tools.selection.flip-h': ['tools.selection.flip-h.mirror'],
}

// Defines what modifier key is used for the effect. These are static; they won't be customizable by the user.
const MODIFIER_KEYS = {
    'tools.standard.fill-char.diagonal': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.selection.multiple': 'shiftKey',
    'tools.standard.selection-rect.outline': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.selection-wand.diagonal': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.move-all.all-layers': 'shiftKey',
    'tools.standard.move-all.all-frames': isMacOS() ? 'metaKey' : 'ctrlKey',
    'tools.standard.move-all.wrap': 'altKey',
    'tools.standard.color-swap.all-layers': 'shiftKey',
    'tools.standard.color-swap.all-frames': isMacOS() ? 'metaKey' : 'ctrlKey',
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

    // Use first shortcut option as the abbreviation
    if (Array.isArray(shortcut)) shortcut = shortcut[0];

    if (isObject(shortcut)) {
        (shortcut.modifiers || []).forEach(modifier => result += modifierAbbr(modifier));
        result += capitalizeFirstLetter(shortcut.displayKey ? shortcut.displayKey : shortcut.key)
    }
    else {
        result += capitalizeFirstLetter(shortcut);
    }

    return result;
}

// Combines key with its modifiers into a single string value
function getFullKey(shortcut) {
    let key, modifiers;

    if (isObject(shortcut)) {
        key = shortcut.key.toLowerCase();
        modifiers = shortcut.modifiers;
    }
    else {
        key = shortcut.toLowerCase();
    }

    return modifiers && modifiers.length ? `${modifiers.sort().join('-')}-${key}` : key;
}
