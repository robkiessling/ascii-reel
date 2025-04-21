/**
 * UI component for the unicode character selector on the bottom-right of the page.
 */

import SimpleBar from "simplebar";
import * as actions from "../io/actions.js";
import * as state from "../state/index.js";
import * as tools from "./tools.js";
import {copyChar} from "../io/clipboard.js";
import * as selection from "./selection.js";
import {eventBus, EVENTS} from "../events/events.js";
import {createDialog} from "../utils/dialogs.js";
import {STRINGS} from "../config/strings.js";
import Minimizer from "../components/minimizer.js";

let $container, $charList, $actions, actionButtons, $unicodeDialog, minimizer;

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
        const char = $(evt.currentTarget).data('char');

        // TODO Is this useful?
        // copyChar(char);

        selection.setSelectionToSingleChar(char, selection.cursorCell() ? state.primaryColorIndex() : undefined);
        tools.selectChar(char);
    });

    minimizer = new Minimizer($container, 'unicode')

    setupSettings();
    setupActions();
    setupEventBus();
}

function setupSettings() {
    $unicodeDialog = $("#unicode-dialog");

    createDialog($unicodeDialog, () => {
        state.importChars($unicodeDialog.find('#unicode-chars').val().split(''))
        state.setUnicodeSetting('autoAddAscii', $unicodeDialog.find('.auto-add-ascii').is(':checked'));
        state.setUnicodeSetting('autoAddUnicode', $unicodeDialog.find('.auto-add-unicode').is(':checked'));
        $unicodeDialog.dialog('close');
    }, 'Save', {
        minWidth: 520,
        minHeight: 400,
        maxHeight: 720,
    });
}

function setupActions() {
    actions.registerAction('unicode.toggle-component', () => {
        minimizer.toggle();
        refresh();
    })

    actions.registerAction('unicode.information', () => {}); // No callback; just displays information

    actions.registerAction('unicode.open-settings', () => {
        $unicodeDialog.find('#unicode-chars').val(state.sortedChars().join(''));
        $unicodeDialog.find('.auto-add-ascii').prop('checked', state.getUnicodeSetting('autoAddAscii'));
        $unicodeDialog.find('.auto-add-unicode').prop('checked', state.getUnicodeSetting('autoAddUnicode'))
        $unicodeDialog.dialog('open');
    });

    actionButtons = actions.setupActionButtons($container, {
        placement: 'top'
    });
}

function setupEventBus() {
    eventBus.on(EVENTS.REFRESH.ALL, () => refresh())

    eventBus.on(EVENTS.UNICODE.CHANGED, () => refresh())

    eventBus.on(EVENTS.TOOLS.CHAR_CHANGED, () => refreshSelectedChar())
}

function refresh() {
    minimizer.refresh();

    $charList.empty();

    if (state.sortedChars().length) {
        // Inserting Unicode option char <divs> as one string for improved performance
        const charsString = state.sortedChars().map(char => {
            return `<div class="unicode-option" data-char="${char}">${char}</div>`
        }).join('');
        $charList.append(charsString);

        refreshSelectedChar();
    }
    else {
        $('<div>', {
            class: 'empty-list',
            html: STRINGS['unicode.empty']
        }).appendTo($charList);
    }

    actionButtons.refreshContent();
}

function refreshSelectedChar() {
    $charList.find('.unicode-option.selected').removeClass('selected');
    $charList.find(`.unicode-option[data-char="${state.getConfig('primaryChar')}"]`).addClass('selected');
}