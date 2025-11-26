import * as actions from "../../io/actions.js";
import {getName, isAnimationProject, setConfig} from "../../state/index.js";
import {toggleStandard} from "../../io/keyboard.js";
import {confirmDialog} from "../../utils/dialogs.js";
import * as fileSystem from "../../storage/file_system.js";
import {STRINGS} from "../../config/strings.js";
import {eventBus, EVENTS} from "../../events/events.js";

import {init as initFile} from "./file.js";
import {init as initTheme} from "./theme.js";
import {init as initTools} from "./tools.js";
import {init as initView, refresh as refreshView} from "./view.js";
import {init as initEdit, refresh as refreshEdit} from "./edit.js";
import {standardTip} from "../../components/tooltips.js";
import IconMenu from "../../components/icon_menu.js";
import {getActionInfo} from "../../io/actions.js";
import {hasActiveFile} from "../../storage/file_system.js";

let mainMenu, $fileName, $activeFileIcon;

const MAIN_MENU = [
    'file.new',
    'file.open',
    'file.save-active',
    'file.save-as',
    'file.export-as',
    'file.export-active',
    'settings.open-project-settings-dialog',
    'settings.open-font-dialog',
    'settings.open-background-dialog',
    'settings.open-resize-dialog',
]

export function init() {
    initFile();
    initEdit();
    initTheme();
    initTools();
    initView();

    setupFileName();
    setupActiveFileIcon();
    setupEventBus();

    mainMenu = new IconMenu($('#main-menu-button'), {
        dropdown: true,
        dropdownBtnClass: 'canvas-button',
        dropdownBtnIcon: 'mainMenu.open',

        // This used to handle having a button to the left of main-menu, it is not needed anymore
        // dropdownStyle: () => {
        //     return {
        //         left: isAnimationProject() ? -42 : 0
        //     }
        // },

        items: MAIN_MENU.map(item => {
            return {
                value: item,
                icon: item,
                visible: () => actions.isActionEnabled(item),
                disabled: () => !actions.isActionEnabled(item),
                label: STRINGS[`${item}.name`],
                shortcut: () => getActionInfo(item).shortcutAbbr
            }
        }),
        onSelect: newValue => actions.callAction(newValue),
    })
}

function refresh() {
    mainMenu.refresh();

    const fileName = getName(false);
    $fileName.html(fileName);
    $activeFileIcon.toggle(hasActiveFile())
    document.title = `${fileName} — Ascii Reel`;

    refreshView();
    refreshEdit();
}

function setupActiveFileIcon() {
    $activeFileIcon = $('#active-file-icon');

    standardTip($activeFileIcon, 'file.active-file-info', {
        placement: 'bottom',
        offset: [0, 28]
    })
}

function setupEventBus() {
    eventBus.on(
        [EVENTS.REFRESH.ALL, EVENTS.MENU.CHANGED, EVENTS.FILE.SAVED, EVENTS.ACTIONS.PERFORMED],
        () => refresh()
    )
}

function setupFileName() {
    $fileName = $('#file-name');

    let canceled, origName;
    $fileName.on('focus', () => {
        origName = $fileName.text();
        toggleStandard('file-name', true);
        canceled = false;
    });

    $fileName.on('keydown', function (e) {
        switch (e.key) {
            case 'Escape':
                canceled = true;
                $fileName.blur();
                break;
            case 'Enter':
                $fileName.blur();
                break;
        }

        e.stopPropagation();
    });

    function finishEditing() {
        toggleStandard('file-name', false);
        const newName = $fileName.text();
        if (newName && newName !== origName && !canceled) setConfig('name', newName);
        eventBus.emit(EVENTS.MENU.CHANGED);
    }

    $fileName.on('blur', () => finishEditing());

    $fileName.on('mousedown', evt => {
        if (fileSystem.hasActiveFile()) {
            evt.preventDefault();

            confirmDialog(STRINGS['file.cannot-rename-active-file.name'], STRINGS['file.cannot-rename-active-file.description'], () => {
                fileSystem.saveFile()
                    .then(() => {
                        eventBus.emit(EVENTS.MENU.CHANGED); // For new file name
                    })
                    .catch(err => {
                        if (!fileSystem.isPickerCanceledError(err)) {
                            console.error(err);
                            alert(`Failed to save file: ${err.message}`);
                        }
                    });
            }, 'Save as new file')
        }
    })
}