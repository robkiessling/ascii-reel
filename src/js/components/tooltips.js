import tippy, {delegate} from "tippy.js";
import {strToHTML} from "../utils/strings.js";
import {STRINGS} from "../config/strings.js";
import {isFunction} from "../utils/utilities.js";

/**
 * Creates a single tippy tooltip with content based on STRINGS
 * @param $element - Element to attach tip to
 * @param {string} stringsKey - STRINGS key partial. E.g. 'file.new' will create a tooltip with
 *   title STRINGS['file.new.name'] and content STRINGS['file.new.description']
 * @param {Object} overrides - tippy overrides
 * @returns {import('tippy.js').Instance} - Single tippy instance
 */
export function standardTip($element, stringsKey, overrides = {}) {
    return tippy($element.get(0), $.extend({
        content: standardTipContentBuilder(stringsKey),
        placement: 'right',
        allowHTML: true,
    }, overrides))
}

/**
 * Creates multiple tippy tooltips with content based on STRINGS
 * @param $elements - Elements to attach tips to
 * @param {string|(() => string)} stringsKeyGetter - STRINGS key partial, or function that returns a STRINGS
 *   key partial. See standardTip for use cases.
 * @param {Object} overrides - tippy overrides
 * @returns {import('tippy.js').Instance[]} - Array of tippy instances
 */
export function standardTips($elements, stringsKeyGetter, overrides = {}) {
    return tippy($elements.toArray(), $.extend({
        content: standardTipContentBuilder(stringsKeyGetter),
        allowHTML: true,
        placement: 'right',
    }, overrides))
}

/**
 * Attaches tooltips to future elements that match a selector, even if those elements
 * don't exist yet.
 * @param $container - Container element that will contain the future elements
 * @param targetSelector - CSS selector for future child elements
 * @param stringsKeyGetter - Key used for STRINGS lookup
 * @param overrides - tippy overrides
 */
export function delegateTips($container, targetSelector, stringsKeyGetter, overrides = {}) {
    delegate($container.get(0), $.extend({
        target: targetSelector,
        content: standardTipContentBuilder(stringsKeyGetter),
        allowHTML: true,
    }, overrides))
}

/**
 * Builds tooltips whose content can be refreshed/update at a later time.
 * @param $elements - jQuery elements to attach tooltip(s) to
 * @param {(Element) => string} contentBuilder - Function that builds tooltip content. This function will be
 *   called on initialization and when refreshing.
 * @param {Object} overrides - tippy overrides
 * @returns {{
 *   tooltips: import('tippy.js').Instance[],
 *   refreshContent: function,
 *   enable: function,
 *   disable: function
 * }} - tooltip control object. `tooltips` is the array of tippy instances. `refreshContent` is a function that can
 *   be called to refresh the tooltip content. `enable`/`disable` are standard tippy methods that will be called on
 *   all tippy instances.
 */
export function refreshableTooltips($elements, contentBuilder, overrides = {}) {
    const tooltips = tippy($elements.toArray(), {
        content: element => contentBuilder(element),
        placement: 'right',
        hideOnClick: false,
        allowHTML: true,
        ...overrides
    });

    return {
        // tippy instances:
        tooltips,

        // Custom refresh function that reloads all tooltip content
        refreshContent: () => tooltips.forEach(tooltip => tooltip.setContent(element => contentBuilder(element))),

        // Standard tippy instance methods. I've only piped a few needed methods so far, we can add more if needed:
        enable: () => tooltips.forEach(tooltip => tooltip.enable()),
        disable: () => tooltips.forEach(tooltip => tooltip.disable()),
    };
}

/**
 * Builds tip content for a given STRINGS key
 * @param {string|(() => string)} stringsKeyGetter - Key used for STRINGS lookup
 * @returns {(Element) => string} - tippy content builder: can be passed as `content` prop to tippy constructor
 */
export function standardTipContentBuilder(stringsKeyGetter) {
    return element => {
        const stringsKey = isFunction(stringsKeyGetter) ? stringsKeyGetter($(element)) : stringsKeyGetter;
        const name = STRINGS[`${stringsKey}.name`];
        const description = STRINGS[`${stringsKey}.description`];

        return `<span class="title">${strToHTML(name)}</span><br>` +
            `<span>${strToHTML(description)}</span>`
    }
}

