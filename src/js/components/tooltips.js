import tippy from "tippy.js";
import {strToHTML} from "../utils/strings.js";
import {strings} from "../config/strings.js";

export function standardTip($element, stringsKey, overrides = {}) {
    const name = strings[`${stringsKey}.name`];
    const description = strings[`${stringsKey}.description`];

    return tippy($element.get(0), $.extend({}, {
        content: `<span class="title">${strToHTML(name)}</span><br>` +
            `<span>${strToHTML(description)}</span>`,
        placement: 'right',
        allowHTML: true,
    }, overrides))
}