import * as actions from "../io/actions.js";
import {getName, setConfig} from "../state/index.js";
import {toggleStandard} from "../io/keyboard.js";
import {confirmDialog} from "../utils/dialogs.js";
import * as fileSystem from "../storage/file_system.js";
import {triggerRefresh} from "../index.js";
import {strings} from "../config/strings.js";
import {hasActiveFile} from "../storage/file_system.js";
import tippy from "tippy.js";

let leftMenu, rightMenu
let $fileName, $activeFileIcon;

export function init() {
    leftMenu = new HorizontalMenu($('#left-menu'), {
        onOpen: () => rightMenu.close()
    });
    rightMenu = new HorizontalMenu($('#right-menu'), {
        onOpen: () => leftMenu.close(),
        rightAligned: true
    });

    setupFileName();
    setupActiveFileIcon();
}

export function refresh() {
    leftMenu.rebuildActions();
    rightMenu.rebuildActions();

    $fileName.html(getName(false));
    $activeFileIcon.toggle(hasActiveFile())
}

function setupActiveFileIcon() {
    $activeFileIcon = $('#active-file-icon');
    tippy($activeFileIcon.get(0), {
        content: `<span class="title">${strings['file.active-file-info.name']}</span><br>` +
            `<span>${strings['file.active-file-info.description']}</span>`,
        placement: 'bottom',
        allowHTML: true,
    })
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
        triggerRefresh('menu');
    }

    $fileName.on('blur', () => finishEditing());

    $fileName.on('mousedown', evt => {
        if (fileSystem.hasActiveFile()) {
            evt.preventDefault();

            confirmDialog(strings['file.cannot-rename-active-file.name'], strings['file.cannot-rename-active-file.description'], () => {
                fileSystem.saveFile()
                    .then(() => {
                        triggerRefresh('menu'); // For new file name
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

    constructor($menu, options = {}) {
        this.id = ++HorizontalMenu.idSequence;

        this.$menu = $menu;
        this.options = options;

        this._init();
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
            }
            else {
                $item.empty();
                $item.off('click');
            }
        });
    }

    _init() {
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