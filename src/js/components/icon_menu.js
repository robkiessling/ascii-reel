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
    transparentBtns: true,
}

const SINGLE_GROUP = '__SINGLE_GROUP__';

/**
 * Creates a menu bar of icon buttons. There are two main modes of function:
 * 1) As a <select>, meaning one of the buttons is considered the "selected" value (it will be highlighted). Clicking
 *    a different button will select that one instead. Requires `options.getValue`.
 * 2) As a menu of static buttons. In this case, options.getValue is not provided; there is no 'selected' value.
 *
 * The menu also has two main display modes:
 * 1) As a bar. All items will be visible at once. If functioning as a <select>, the current item is highlighted.
 *    Items may be grouped together; in this case a mini dropdown will appear for each group.
 * 2) As a dropdown. Only one item is visible at once. If functioning as a <select>, the current item is used as the
 *    dropdown icon. If functioning as a menu of buttons, dropdownBtnIcon is used to determine the dropdown icon.
 */
export default class IconMenu {
    static idSequence = 0;

    /**
     * @param $container - jQuery element for the menu
     * @param {Object} options - menu options
     * @param {Array<{
     *   value: string,            // Value to be returned by onSelect
     *   icon: string,             // Used for icons.js constant lookup
     *   tooltip?: string,         // Used for strings.js constant lookup to populate tooltip
     *   label?: string,           // (only applicable if dropdown:true) Optional label text next to the dropdown icon
     *   shortcut?: () => string,  // (only applicable if dropdown:true) Optional shortcut text next to the dropdown icon
     *   disabled?: () => boolean, // Function: determines if individual item is disabled (default: enabled)
     *   visible?: () => boolean,  // Function: determines if individual item is visible (default: visible). If all items
     *                             // are invisible, entire menu will be considered invisible (see options.visible)
     *   group?: string,           // (only applicable if dropdown:false) Members of same group will be grouped together
     *                             // in a mini-dropdown.
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
     * @param {string} [options.dropdownClass] - Classes to add to dropdown divs. E.g. `right-aligned`.
     * @param {string} [options.dropdownBtnClass] - Classes to add to dropdown buttons.
     * @param {() => Object} [options.getValue] - Callback to get the current value of the select. If provided,
     *   the current selected option will be highlighted. If no callback is provided, items will just function like buttons
     * @param {() => boolean} [options.visible] - Callback that controls whether the entire menu is visible.
     *   Default: always visible. Note: if you want to hide individual items, see options.items.visible
     * @param {() => boolean} [options.disabled] - Callback that controls whether the entire menu is disabled.
     *   Default: always enabled. Note: if you want to disable individual menu items, see options.items.disabled
     * @param {Object} [options.menuTooltipOptions] - tippy option overrides for menu bar tooltips.
     * @param {Object} [options.dropdownTooltipOptions] - tippy options overrides for dropdown tooltips.
     * @param {boolean} [options.actionTooltips=false] - Whether to instantiate item tooltips using standard tooltips or
     *   action tooltips. It does not currently affect dropdownBtnTooltip (that is always standard).
     * @param {boolean} [options.transparentBtns=true] - Whether button options should have transparent background
     */
    constructor($container, options = {}) {
        this.id = ++IconMenu.idSequence;

        this.$container = $container;
        this.options = {...DEFAULT_OPTIONS, ...options};
        this._init();
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

    _init() {
        this._valueToItemLookup = {};
        this.options.items.forEach(item => {
            this._valueToItemLookup[item.value] = item;
        });

        this._dropdowns = {};
        this._groupItems().forEach(groupOrItem => {
            if (groupOrItem.isGroup) {
                this._buildMenuDropdown(groupOrItem);
            } else {
                this._buildMenuOption(groupOrItem);
            }
        })
        
        this._attachClickHandlers();
        this._attachTooltips();
    }

    /**
     * Builds an array of items and/or groups of items, based on the `options.items` `group` attribute.
     *
     * E.g. here is a result with 3 ungrouped items and 1 group of 2 items.
     *
     * [
     *     { value: 'item 1' },
     *     { value: 'item 2' },
     *     { isGroup: true, name: 'group A', items: [{value: 'item 3'}, {value: 'item 4'}] },
     *     { value: 'item 5'}
     * ]
     *
     * @returns {Object[]}
     */
    _groupItems() {
        const groups = {};
        const groupsAndItems = [];

        this.options.items.forEach(item => {
            // If dropdown:true, we disregard any `group` attributes and just put everything in the same group
            const groupName = this.options.dropdown ? SINGLE_GROUP : item.group;

            if (groupName === undefined) {
                groupsAndItems.push(item);
                return;
            }

            if (groups[groupName] === undefined) {
                const group = { isGroup: true, name: groupName, items: [item] }
                groups[groupName] = group;
                groupsAndItems.push(group);
            } else {
                const group = groups[groupName];
                group.items.push(item);
            }
        })

        return groupsAndItems;
    }

    _buildMenuOption(item) {
        $('<div>', {
            class: `icon-menu-option ${this.options.transparentBtns ? '' : 'solid'}`,
            'data-value': item.value,
            'data-tooltip': item.tooltip,
            html: getIconHTML(item.icon)
        }).appendTo(this.$container);
    }

    _buildMenuDropdown(group) {
        const dropdown = { open: false, group: group };

        dropdown.$group = $('<div>', {
            class: `icon-dropdown ${this.options.dropdownClass || ''}`,
            'data-group': group.name
        }).appendTo(this.$container);

        if (group.name === SINGLE_GROUP) {
            // Single menu button that will toggle the dropdown
            dropdown.$button = $('<div>', {
                class: `icon-menu-toggle ${this.options.transparentBtns ? '' : 'solid'} ${this.options.dropdownBtnClass || ''}`,
                'data-dropdown': group.name,
                html: getIconHTML(group.items[0].icon)
            }).appendTo(dropdown.$group);
        } else {
            // Show a menu button that selects the group's current value, and a tiny dropdown arrow to select a different value
            dropdown.$button = $('<div>', {
                class: `icon-menu-option ${this.options.transparentBtns ? '' : 'solid'}`,
                'data-value': group.items[0].value,
                'data-tooltip': group.items[0].tooltip,
                html: getIconHTML(group.items[0].icon)
            }).appendTo(dropdown.$group);

            dropdown.$toggle = $('<div>', {
                class: `icon-menu-toggle tiny ${this.options.transparentBtns ? '' : 'solid'} ${this.options.dropdownBtnClass || ''}`,
                'data-dropdown': group.name,
                html: '<span class="ri ri-arrow-down-s-fill"></span>'
            }).appendTo(dropdown.$group);
        }

        dropdown.$ul = $('<ul>', {}).appendTo(dropdown.$group);
        group.items.forEach(item => {
            $('<li>', {
                class: `icon-dropdown-option ${item.label ? 'has-label' : ''}`,
                'data-value': item.value,
                'data-tooltip': item.tooltip,
                html: item.label || item.shortcut ?
                    `${getIconHTML(item.icon)}<span class="label">${item.label || ''}</span><span class="shortcut"></span>` :
                    getIconHTML(item.icon)
            }).appendTo(dropdown.$ul);
        })

        this._dropdowns[group.name] = dropdown;
    }
    
    _attachClickHandlers() {
        const buttonClasses = '.icon-menu-option, .icon-dropdown-option';
        this.$container.off('click', buttonClasses).on('click', buttonClasses, evt => {
            const $option = $(evt.currentTarget);
            if ($option.hasClass('disabled')) return; // have to manually abort; pointer events are allowed so tooltips work when disabled

            this.options.onSelect($option.attr('data-value'));

            if (this.options.closeDropdownOnSelect) {
                this.closeDropdowns();
            } else {
                this.refresh();
            }
        });

        this.$container.off('click', '.icon-menu-toggle').on('click', '.icon-menu-toggle', evt => {
            const $toggle = $(evt.currentTarget);
            defer(() => this._toggleDropdown($toggle.attr('data-dropdown')))
        });
    }

    _attachTooltips() {
        if (this.options.dropdownBtnTooltip && this.options.dropdown) {
            standardTip(this._dropdowns[SINGLE_GROUP].$button, this.options.dropdownBtnTooltip, {
                offset: [0, 15],
                ...this.options.menuTooltipOptions
            })
        }

        if (this.options.items.some(item => item.tooltip)) {
            this._menuTips = this._setupTooltips('.icon-menu-option', this.options.menuTooltipOptions);
            this._dropdownTips = this._setupTooltips('.icon-dropdown-option', this.options.dropdownTooltipOptions);
        }
    }

    _setupTooltips(selector, options) {
        const tooltipInstantiator = this.options.actionTooltips ? setupActionTooltips : standardTips;
        return tooltipInstantiator(this.$container.find(selector), $option => $option.attr('data-tooltip'), {
            offset: [0, 15],
            hideOnClick: false,
            ...options
        })
    }

    _toggleDropdown(key, open) {
        const dropdown = this._dropdowns[key];
        dropdown.open = open === undefined ? !dropdown.open : open;
        this.refresh();
    }

    closeDropdowns() {
        Object.values(this._dropdowns).forEach(dropdown => dropdown.open = false);
        this.refresh();
    }

    get isOpen() {
        return Object.values(this._dropdowns).some(dropdown => dropdown.open);
    }

    refresh() {
        let menuVisible = this.isVisible();
        this.$container.toggle(menuVisible);
        this.$container.toggleClass('disabled', !!this.options.disabled())
        this._toggleDocumentListener(false)

        this._refreshSelectedValue(menuVisible);
        this._refreshMenuOptions(menuVisible);
        this._refreshDropdowns(menuVisible);

        this.options.onRefresh(this);
    }

    _refreshSelectedValue(menuVisible) {
        if (!menuVisible || !this.options.getValue) return;

        this.$container.find('.icon-dropdown-option').toggleClass('active', false);
        this.$container.find('.icon-menu-option').toggleClass('active', false);

        const selectedValue = this.options.getValue();
        const selectedItem = this._valueToItemLookup[selectedValue];

        const dropdown = this.options.dropdown ? this._dropdowns[SINGLE_GROUP] : this._dropdowns[selectedItem.group];

        if (dropdown) {
            dropdown.$button.html(getIconHTML(selectedItem.icon));
            dropdown.$button.attr('data-value', selectedItem.value);
            dropdown.$button.attr('data-tooltip', selectedItem.tooltip);

            dropdown.$ul.find(`.icon-dropdown-option[data-value="${selectedValue}"]`).toggleClass('active', true);
        }

        if (!this.options.dropdown) {
            // Only highlighting the menu option if dropdown:false
            this.$container.find(`.icon-menu-option[data-value="${selectedValue}"]`).toggleClass('active', true);
        }

        if (this.options.actionTooltips) this._menuTips.refreshContentIf(element => $(element).hasClass('active'));
    }

    _refreshMenuOptions(menuVisible) {
        if (!menuVisible) return;

        // If menu option is invisible and has a dropdown, fallback to first visible item
        this.$container.find('.icon-menu-option').each((i, element) => {
            const $button = $(element);
            const item = this._valueToItemLookup[$button.attr('data-value')];
            if (item.visible === undefined || item.visible(item)) return;

            const dropdown = this._dropdowns[item.group];
            if (!dropdown) return;

            const firstVisibleItem = dropdown.group.items.find(item => item.visible === undefined || item.visible(item));
            if (!firstVisibleItem) return;

            dropdown.$button.html(getIconHTML(firstVisibleItem.icon));
            dropdown.$button.attr('data-value', firstVisibleItem.value);
            dropdown.$button.attr('data-tooltip', firstVisibleItem.tooltip);
            if (this.options.actionTooltips) this._menuTips.refreshContentIf(element => element === dropdown.$button[0]);
        })

        // Apply disabled/visible props
        this.$container.find('.icon-menu-option').each((i, element) => {
            const $option = $(element);
            const item = this._valueToItemLookup[$option.attr('data-value')];
            if (item.disabled) $option.toggleClass('disabled', item.disabled(item))
            if (item.visible) $option.toggle(item.visible(item))
        })
    }

    _refreshDropdowns(menuVisible) {
        Object.values(this._dropdowns).forEach(dropdown => {
            if (this.options.dropdownBtnIcon) dropdown.$button.html(getIconHTML(this.options.dropdownBtnIcon))
            const isOpen = menuVisible && dropdown.open;

            if (isOpen) this._toggleDocumentListener(true);

            let anyVisible = false;
            dropdown.$ul.find('.icon-dropdown-option').each((i, element) => {
                const $option = $(element);
                const item = this._valueToItemLookup[$option.attr('data-value')];
                if (item.disabled) $option.toggleClass('disabled', !!item.disabled(item))
                if (item.visible) {
                    const itemVisible = item.visible(item);
                    $option.toggle(!!itemVisible)
                    if (itemVisible) anyVisible = true;
                } else {
                    anyVisible = true;
                }
                if (item.shortcut) $option.find('.shortcut').html(item.shortcut(item))
            })
            dropdown.$group.toggle(anyVisible);

            dropdown.$group.toggleClass('show-dropdown', isOpen);
        })
    }

    _toggleDocumentListener(enable) {
        const namespace = `IconMenu-${this.id}`

        if (enable) {
            $(document).off(`click.${namespace}`).on(`click.${namespace}`, evt => {
                // If the click was outside the dropdown, close it
                if (!$(evt.target).closest('.show-dropdown').length) this.closeDropdowns();
            });
        } else {
            $(document).off(`click.${namespace}`);
        }
    }
}