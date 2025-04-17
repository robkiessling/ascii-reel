import tippy from "tippy.js";
import {strToHTML} from "../utils/strings.js";
import {STRINGS} from "../config/strings.js";

export function standardTip($element, stringsKey, overrides = {}) {
    const name = STRINGS[`${stringsKey}.name`];
    const description = STRINGS[`${stringsKey}.description`];

    return tippy($element.get(0), $.extend({}, {
        content: `<span class="title">${strToHTML(name)}</span><br>` +
            `<span>${strToHTML(description)}</span>`,
        placement: 'right',
        allowHTML: true,
    }, overrides))
}