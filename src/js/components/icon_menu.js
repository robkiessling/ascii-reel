import {getIconHTML} from "../config/icons.js";
import {standardTip, standardTips} from "./tooltips.js";
import {defer} from "../utils/utilities.js";
import {setupActionTooltips} from "../io/actions.js";

const DEFAULT_OPTIONS = {
    items: [],
    visible: () => true,
    disabled: () => false,
    onRefresh: (/* iconMenu */) => {},
    closeDropdownOnSelect: true,
    actionTooltips: false,
    transparentBtns: true
}

/**
 * Creates a menu bar of icon buttons. There are two main modes of function:
 * 1) as a <select> of sorts. If options.getValue is provided, then the menu is assumed to consist of item options,
 *    where one option is 'selected' at a time.
 * 2) as a menu of buttons. In this case, options.getValue is not provided; there is no 'selected' value
 *
 * The menu also has two main display modes:
 * 1) As a bar. All items will be visible at once. If functioning as a <select>, the current item is highlighted
 * 2) As a dropdown. Only one item is visible at once. If functioning as a <select>, the current item is used as the
 *    dropdown icon. If functioning as a menu of buttons, dropdownBtnIcon is used to determine the dropdown icon.
 */
export default class IconMenu {
    static idSequence = 0;

    /**
     * @param $container - jQuery element for the menu
     * @param {Object} options - menu options
     * @param {Array<{
     *   value: string,   // Value to be returned by onSelect
     *   icon: string,    // Used for icons.js constant lookup
     *   tooltip: string, // Used for strings.js constant lookup to populate tooltip
     *   disabled?: () => boolean, // Function: determines if individual item is disabled (default: enabled)
     *   visible?: () => boolean,  // Function: determines if individual item is visible (default: visible). If all items
     *                             // are invisible, entire menu will be considered invisible (see options.visible)
     *   group?: string   // (only applicable if dropdown:false) Members of same group will be grouped together in a mini-dropdown
     *                    // TODO grouping is not implemented yet
     * }>} options.items - Items to populate the menu
     * @param {(value: string) => void} options.onSelect - Callback when menu item is selected
     * @param {(IconMenu) => void} [options.onRefresh] - Callback when menu is refreshed
     * @param {boolean} [options.dropdown=false] - If false, renders as a menu bar. If true, renders as dropdown
     * @param {string} [options.dropdownBtnIcon] - (Only applicable if dropdown:true) If undefined, button icon will
     *   match whatever value is selected (based on item icon). If defined, button icon will be set to a static value
     * @param {string} [options.dropdownBtnTooltip] - (Only applicable if dropdown:true) If undefined, button will not
     *   have a tooltip. If defined, button tooltip will be set to a static value.
     * @param {boolean} [options.closeDropdownOnSelect=true] - (Only applicable if dropdown:true) If true, dropdown
     *   menu will be closed after a selection is made.
     * @param {() => Object} [options.getValue] - Callback to get the current value of the select. If provided,
     *   the current selected option will be highlighted. If no callback is provided, items will just function like buttons
     * @param {() => boolean} [options.visible] - Callback that controls whether the entire menu is visible. Default: always visible
     * @param {() => boolean} [options.disabled] - Callback that controls whether the entire menu is disabled. Default: always enabled
     *   Note: if you want to disable individual menu items, see options.items
     * @param {Object} [options.tooltipOptions] - (Only applicable if items:tooltips is used) tippy options for item
     *   tooltips. It does not currently affect dropdownBtnTooltip.
     * @param {boolean} [options.actionTooltips] - (Only applicable if items:tooltips is used) Whether to instantiate
     *   standard tooltips or action tooltips. It does not currently affect dropdownBtnTooltip.
     * @param {boolean} [options.transparentBtns=true] - (Only applicable if dropdown:false) Whether button options
     *   should have transparent background or not
     */
    constructor($container, options = {}) {
        this.id = ++IconMenu.idSequence;

        this.$container = $container;
        this.options = {...DEFAULT_OPTIONS, ...options};
        this._init();
    }

    _init() {
        this.valueToItemLookup = {};
        this.options.items.forEach(item => {
            this.valueToItemLookup[item.value] = item;
        });

        this.options.dropdown ? this._initDropdown() : this._initBar();
    }

    refresh() {
        this.options.dropdown ? this._refreshDropdown() : this._refreshBar();
        this.options.onRefresh(this);
    }

    isVisible() {
        return !!this.options.visible();
    }

    /**
     * IconMenu does not store current menu value; it is managed by the outside process and passed in through
     * getValue callback. This is just a helper method to retrieve that outside value.
     */
    value() {
        if (!this.options.getValue) throw new Error(`IconMenu#value is only valid if getValue method provided`)
        return this.options.getValue();
    }


    // ------------------------------------------------- Bar Version:

    _initBar() {
        this.options.items.forEach(item => {
            $('<div>', {
                class: `icon-menu-option ${this.options.transparentBtns ? '' : 'solid'}`,
                'data-value': item.value,
                'data-tooltip': item.tooltip,
                html: getIconHTML(item.icon)
            }).appendTo(this.$container);
        })

        this.$container.off('click', '.icon-menu-option').on('click', '.icon-menu-option', evt => {
            const $option = $(evt.currentTarget);
            if ($option.hasClass('disabled')) return; // have to manually abort; pointer events are allowed so tooltips work when disabled

            this.options.onSelect($option.data('value'));
            this.refresh();
        });

        if (this.options.items.some(item => item.tooltip)) {
            this._tooltipInstantiator()(this.$container.find('.icon-menu-option'), $option => $option.data('tooltip'), {
                offset: [0, 15],
                hideOnClick: false,
                ...this.options.tooltipOptions
            })
        }
    }

    _refreshBar() {
        let visible = this.isVisible();
        this.$container.toggle(visible);
        this.$container.toggleClass('disabled', !!this.options.disabled())

        if (visible && this.options.getValue) {
            const currentValue = this.options.getValue();
            this.$container.find('.icon-menu-option').toggleClass('active', false);
            this.$container.find(`.icon-menu-option[data-value="${currentValue}"]`).toggleClass('active', true);
        }

        this.$container.find('.icon-menu-option').each((i, element) => {
            const $option = $(element);
            const item = this.valueToItemLookup[$option.data('value')];
            if (item.disabled) $option.toggleClass('disabled', item.disabled(item))
            if (item.visible) $option.toggle(item.visible(item))
        })
    }

    _tooltipInstantiator() {
        return this.options.actionTooltips ? setupActionTooltips : standardTips;
    }

    // ------------------------------------------------- Dropdown Version:

    _initDropdown() {
        this._dropdown = { open: false };
        this.$container.addClass('icon-dropdown')

        this._dropdown.$button = $('<span>', {
            class: 'icon-dropdown-button'
        }).appendTo(this.$container);

        this._dropdown.$ul = $('<ul>', {}).appendTo(this.$container);

        this.options.items.forEach(item => {
            $('<li>', {
                class: 'icon-dropdown-option',
                'data-value': item.value,
                'data-tooltip': item.tooltip,
                html: getIconHTML(item.icon)
            }).appendTo(this._dropdown.$ul);
        });

        this._dropdown.$button.off('click').on('click', evt => {
            defer(() => this.toggleDropdown())
        });

        this._dropdown.$ul.off('click', '.icon-dropdown-option').on('click', '.icon-dropdown-option', evt => {
            const $option = $(evt.currentTarget);
            if ($option.hasClass('disabled')) return; // have to manually abort; pointer events are allowed so tooltips work when disabled

            if (this.options.closeDropdownOnSelect) this.toggleDropdown(false);
            this.options.onSelect($option.data('value'));
            this.refresh();
        });

        if (this.options.items.some(item => item.tooltip)) {
            this._tooltipInstantiator()(this._dropdown.$ul.find('.icon-dropdown-option'), $option => $option.data('tooltip'), {
                offset: [0, 15],
                hideOnClick: false,
                ...this.options.tooltipOptions
            })
        }

        if (this.options.dropdownBtnTooltip) {
            this._dropdown.buttonTip = standardTip(this._dropdown.$button, this.options.dropdownBtnTooltip, {
                placement: 'bottom',
                offset: [0, 15],
                // delay: [500, null],
            })
        }
    }

    toggleDropdown(open) {
        if (!this.options.dropdown) return; // Not applicable

        if (open === undefined) open = !this._dropdown.open;
        this._dropdown.open = open;
        this.refresh();
    }
    
    get isOpen() {
        if (!this.options.dropdown) return false; // Not applicable

        return this._dropdown.open;
    }

    _refreshDropdown() {
        let visible = this.isVisible();
        this.$container.toggle(visible);
        this.$container.toggleClass('disabled', !!this.options.disabled())
        this._toggleDocumentListener(false)

        if (visible && this.options.getValue) {
            const currentValue = this.options.getValue();
            const currentItem = this.valueToItemLookup[currentValue];

            this._dropdown.$button.html(getIconHTML(currentItem?.icon));

            this._dropdown.$ul.find('.icon-dropdown-option').toggleClass('active', false);
            this._dropdown.$ul.find(`.icon-dropdown-option[data-value="${currentValue}"]`).toggleClass('active', true);
        }

        if (this.options.dropdownBtnIcon) this._dropdown.$button.html(getIconHTML(this.options.dropdownBtnIcon));

        this._dropdown.$ul.find('.icon-dropdown-option').each((i, element) => {
            const $option = $(element);
            const item = this.valueToItemLookup[$option.data('value')];
            if (item.disabled) $option.toggleClass('disabled', item.disabled(item))
            if (item.visible) $option.toggle(item.visible(item))
        })

        const open = visible && this._dropdown.open;
        if (open) {
            this._toggleDocumentListener(true);
            if (this._dropdown.buttonTip) this._dropdown.buttonTip.disable();
        } else {
            if (this._dropdown.buttonTip) this._dropdown.buttonTip.enable();
        }
        this.$container.toggleClass('show-dropdown', open);
    }

    _toggleDocumentListener(enable) {
        const namespace = `IconMenu-${this.id}`

        if (enable) {
            $(document).off(`click.${namespace}`).on(`click.${namespace}`, evt => {
                // If the click was outside the dropdown, close it
                if (!this.$container.get(0).contains(evt.target)) this.toggleDropdown(false);
            });
        } else {
            $(document).off(`click.${namespace}`);
        }
    }
}