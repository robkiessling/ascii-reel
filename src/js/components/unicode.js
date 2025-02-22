import $ from "jquery";
import SimpleBar from "simplebar";
import * as actions from "../io/actions.js";
import * as state from "../state/state.js";
import * as editor from "./editor.js";
import {copyChar} from "../io/clipboard.js";
import * as selection from "../canvas/selection.js";

let $container, $charList, $actions, tooltips;

export function init() {
    $container = $('#unicode-controller');
    $charList = $container.find('.list');
    $actions = $container.find('[data-action]');

    const charListSimpleBar = new SimpleBar($charList.get(0), {
        autoHide: false,
        forceVisible: true
    });
    $charList = $(charListSimpleBar.getContentElement());

    $charList.on('click', '.unicode-option', evt => {
        const char = $(evt.currentTarget).data('unicode-char');

        copyChar(char);
        selection.setSelectionToSingleChar(char, editor.currentColorIndex());
        if (state.config('tool') === 'draw-freeform') editor.setFreeformChar(char);
    });

    setupActionButtons();
}

function setupActionButtons() {
    actions.registerAction('unicode.information', () => {}); // No callback at the moment;

    tooltips = actions.setupTooltips(
        $container.find('[data-action]').toArray(),
        element => $(element).data('action'),
        { placement: 'top' }
    );
}

// Currently hardcoding the list of available unicode shortcuts.
// This is currently structured into rows 8 chars long because that's how many fit on a row with our current styling.
// TODO Maybe keep track of any additional unicode chars the user has pasted into the canvas and add them?
const UNICODE_CHARS = [
    '¯', '·', '¨', '°', '≡', '´', '¡', '÷',
    '┬', '┐', '┤', '┘', '┴', '└', '├', '┌',
    '│', '─', '┼', '«', '»', '║', '═', '╬',
    '╦', '╗', '╣', '╝', '╩', '╚', '╠', '╔',
    '░', '▒', '▓', '█', '▄', '▀', '■', '¦',
    'ø', '£', 'Ø', '×', 'í', 'î', 'ì', '¿',
    '¬', '¤',  '±', '‗', '¶', '§'
]

export function refresh() {
    $charList.empty();

    UNICODE_CHARS.forEach((char, i) => {
        $('<div></div>', {
            class: `unicode-option`,
            attr: { 'data-unicode-char': char },
            html: char
        }).appendTo($charList);
    });

    tooltips.refreshContent();
}