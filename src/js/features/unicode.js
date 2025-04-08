/**
 * UI component for the unicode character selector on the bottom-right of the page.
 */

import SimpleBar from "simplebar";
import * as actions from "../io/actions.js";
import * as state from "../state/index.js";
import * as editor from "./tools.js";
import {copyChar} from "../io/clipboard.js";
import * as selection from "./selection.js";
import {refreshComponentVisibility, toggleComponent} from "../utils/components.js";
import {eventBus, EVENTS} from "../events/events.js";

let $container, $charList, $actions, actionButtons;

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
        selection.setSelectionToSingleChar(char, state.primaryColorIndex());
        if (state.getConfig('tool') === 'draw-freeform-char') editor.pickChar(char);
    });

    setupActions();
    setupEventBus();
}

function setupActions() {
    actions.registerAction('unicode.toggle-component', () => {
        toggleComponent('unicode');
        refresh();
    })

    actions.registerAction('unicode.information', () => {}); // No callback at the moment;

    actionButtons = actions.setupActionButtons($container, {
        placement: 'top'
    });
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())
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

function refresh() {
    refreshComponentVisibility($container, 'unicode');

    $charList.empty();

    UNICODE_CHARS.forEach((char, i) => {
        $('<div></div>', {
            class: `unicode-option`,
            attr: { 'data-unicode-char': char },
            html: char
        }).appendTo($charList);
    });

    actionButtons.refreshContent();
}