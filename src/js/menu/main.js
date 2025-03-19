import * as actions from "../io/actions.js";

let leftMenu, rightMenu;

export function init() {
    leftMenu = new HorizontalMenu($('#left-menu'), {
        onOpen: () => rightMenu.close()
    });
    rightMenu = new HorizontalMenu($('#right-menu'), {
        onOpen: () => leftMenu.close(),
        rightAligned: true
    });
}

export function refresh() {
    leftMenu.rebuildActions();
    rightMenu.rebuildActions();
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