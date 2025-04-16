import * as actions from "../../io/actions.js";
import {getName, setConfig} from "../../state/index.js";
import {toggleStandard} from "../../io/keyboard.js";
import {confirmDialog} from "../../utils/dialogs.js";
import * as fileSystem from "../../storage/file_system.js";
import {strings} from "../../config/strings.js";
import {hasActiveFile} from "../../storage/file_system.js";
import tippy from "tippy.js";
import {eventBus, EVENTS} from "../../events/events.js";

import {init as initFile} from "./file.js";
import {init as initTheme} from "./theme.js";
import {init as initTools} from "./tools.js";
import {init as initView} from "./view.js";
import {standardTip} from "../../components/tooltips.js";

const SPACER = 'spacer';
const LEFT_MENU_BAR = [
    {
        name: "File",
        actions: [
            'file.new',
            'file.open',
            SPACER,
            'file.save-as',
            'file.save-active',
            SPACER,
            'file.export-as',
            'file.export-active',
        ]
    },
    {
        name: "Edit",
        actions: [
            'state.undo',
            'state.redo',
            SPACER,
            'clipboard.cut',
            'clipboard.copy',
            'clipboard.paste',
            'clipboard.paste-in-selection',
            SPACER,
            'selection.select-all'
        ]
    },
    {
        name: "View",
        actions: [
            'view.toggle-grid',
            'view.grid-settings',
            'view.toggle-whitespace',
            SPACER,
            'view.zoom-in',
            'view.zoom-out',
            'view.zoom-fit',
        ]
    },
    {
        name: "Tools",
        actions: [
            'settings.open-font-dialog',
            'settings.open-background-dialog',
            'settings.open-resize-dialog',
            SPACER,
            'preferences',
            'keyboard-shortcuts'
        ]
    }
]

const RIGHT_MENU_BAR = [
    {
        nameClass: 'current-theme',
        actions: [
            'theme.system',
            'theme.light',
            'theme.dark'
        ]
    }
]

let leftMenu, rightMenu
let $fileName, $activeFileIcon;

export function init() {
    // Build menu html before initializing various menus
    leftMenu = new HorizontalMenu($('#left-menu'), LEFT_MENU_BAR, {
        onOpen: () => rightMenu.close()
    });
    rightMenu = new HorizontalMenu($('#right-menu'), RIGHT_MENU_BAR, {
        onOpen: () => leftMenu.close(),
        rightAligned: true
    });

    initFile();
    initTheme();
    initTools();
    initView();

    setupFileName();
    setupActiveFileIcon();
    setupEventBus();
}

function refresh() {
    leftMenu.rebuildActions();
    rightMenu.rebuildActions();

    $fileName.html(getName(false));
    $activeFileIcon.toggle(hasActiveFile())
}

function setupActiveFileIcon() {
    $activeFileIcon = $('#active-file-icon');

    standardTip($activeFileIcon, 'file.active-file-info', {
        placement: 'bottom',
    })
}

function setupEventBus() {
    eventBus.on(
        [EVENTS.REFRESH.ALL, EVENTS.MENU.CHANGED, EVENTS.FILE.CHANGED, EVENTS.ACTIONS.PERFORMED],
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
        if (e.key === 'Escape') {
            canceled = true;
            $fileName.blur();
        }
        switch (e.key) {
            case 'Escape':
                canceled = true;
                $fileName.blur();
                break;
            case 'Enter':
                finishEditing();
        }
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

            confirmDialog(strings['file.cannot-rename-active-file.name'], strings['file.cannot-rename-active-file.description'], () => {
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


class HorizontalMenu {
    static idSequence = 0;

    constructor($menu, barData, options = {}) {
        this.id = ++HorizontalMenu.idSequence;

        this.$menu = $menu;
        this.options = options;

        this._init(barData);
    }

    close() {
        this.isOpen = false;
        this.$currentLi = null;
        this._refresh();
    }

    rebuildActions() {
        if (!this.isOpen) return;

        this.$menu.find('.action-item').each((index, item) => {
            const $item = $(item);
            const action = actions.getActionInfo($item.data('action'));

            if (action) {
                let html = '';
                if (action.icon) {
                    html += `<span><span class="ri ri-fw ${action.icon}"></span> ${action.name}</span>`;
                }
                else {
                    html += `<span>${action.name}</span>`;
                }
                if (action.shortcutAbbr) {
                    html += `<span class="shortcut">${action.shortcutAbbr}</span>`;
                }
                $item.html(html);
                $item.off('click').on('click', () => action.callback());
                $item.toggleClass('disabled', !action.enabled);
                $item.toggleClass('hidden', !action.visible);
            }
            else {
                $item.empty();
                $item.off('click');
            }
        });
    }

    _init(barData) {
        this._buildHTML(barData);

        this.isOpen = false;
        this.$currentLi = null;

        this.$menu.toggleClass('right-aligned', !!this.options.rightAligned);

        this.$menu.children('li').off('click').on('click', evt => {
            evt.stopPropagation();
            this.$currentLi = $(evt.currentTarget);
            this.isOpen = !this.isOpen;

            if (this.isOpen) {
                // Always rebuild actions when menu is opened
                this.rebuildActions();

                if (this.options.onOpen) this.options.onOpen();
            }

            this._refresh();
        });

        this.$menu.children('li').off('mouseenter').on('mouseenter', evt => {
            this.$currentLi = $(evt.currentTarget);
            this._refresh();
        });

        this.$menu.children('li').off('mouseleave').on('mouseleave', evt => {
            if (!this.isOpen) this.$currentLi = null;
            this._refresh();
        });

        this._refresh();
    }

    _buildHTML(barData) {
        barData.forEach(menuData => {
            const $li = $('<li>').appendTo(this.$menu);

            $('<span>', {
                class: menuData.nameClass,
                html: menuData.name
            }).appendTo($li);

            const $ul = $('<ul>').appendTo($li);
            menuData.actions.forEach(action => {
                $('<li>', {
                    class: action === SPACER ? 'break' : 'action-item',
                    'data-action': action
                }).appendTo($ul);
            })
        })
    }

    _refresh() {
        this.$menu.find('li').removeClass('hovered visible');
        this._toggleDocumentListener(false);

        if (this.$currentLi) {
            this.$currentLi.addClass('hovered');

            if (this.isOpen) {
                this._toggleDocumentListener(true);
                this.$currentLi.addClass('visible');
            }
        }
    }

    _toggleDocumentListener(enable) {
        const namespace = `menu-${this.id}`

        if (enable) {
            $(document).on(`click.${namespace}`, () => {
                this.isOpen = false;
                this.$currentLi = null;
                this._refresh();
            });
        }
        else {
            $(document).off(`click.${namespace}`);
        }
    }
}