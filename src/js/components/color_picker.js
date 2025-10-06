import Picker from "vanilla-picker";
import Color from "@sphinxxxx/color-conversion";
import * as keyboard from "../io/keyboard.js";
import {COLOR_FORMAT} from "../state/index.js";

export default class ColorPicker {
    /**
     * Wrapper around vanilla-picker's color picker.
     *
     * Sets up a vanilla-picker with 'Ok' and 'Cancel' buttons. This wrapper's onDone event will only fire when the 'Ok'
     * button is clicked; clicking 'Cancel' or anywhere else in the window to close the picker will cause the changes
     * to be lost. Clicking 'Ok' will update the picker's color-well element with the new color.
     *
     * Picker supports a "split" mode, where the color picker shows two UI buttons:
     * - A large "apply" button on the left with a paint-bucket fill icon
     * - A small dropdown button on the right that opens the color picker
     * This UX mirrors tools like Word/PowerPoint, where a main button applies the color and a dropdown opens the palette.
     *
     * @param $container - jQuery element for the picker container
     * @param {Object} options - Picker options
     * @param {string} [options.initialValue] - Initial char value
     * @param {function} [options.onLoad] - Callback when picker value is set for the first time
     * @param {function} [options.onOpen] - Callback when picker is opened
     * @param {function} [options.onClose] - Callback when picker is closed
     * @param {function} [options.onDone] - Callback when picker 'Ok' button is clicked, or value is set programmatically
     * @param {function} [options.pickerOptions] - Options to pass to vanilla-picker. Do not override vanilla-picker's
     *   onOpen, onClose, or onDone here; those are already overridden by this class. Instead, use this class's
     *   `options.onOpen` option, etc.
     * @param {() => boolean} [options.splitMode] - Function that returns whether the color picker should be in "split"
     *   mode (true) or normal mode (false). See documentation above for more info on split mode.
     * @param {() => tippy} [options.tooltip] - If the picker should have a tooltip, provide a function that instantiates
     *   the tooltip. Tooltip will be enabled/disabled when picker is open.
     */
    constructor($container, options = {}) {
        this.$container = $container;
        this.options = options;

        this._init();
        this.value(this.options.initialValue || '#555', true)
        if (this.options.onLoad) this.options.onLoad(this.value())
    }

    _init() {
        this.$apply = $('<div class="apply-color"><span class="ri ri-fw ri-paint-fill"></span></div>')
            .appendTo(this.$container);

        this.$well = $('<div class="color-well"><span class="ri ri-arrow-down-s-fill"></span></div>')
            .appendTo(this.$container);

        this.picker = new Picker({
            parent: this.$well.get(0),
            popup: 'right',
            cancelButton: true,
            template: this._pickerTemplate(),
            onOpen: () => {
                keyboard.toggleStandard('color-picker', true);
                if (this._tooltip) this._tooltip.disable();
                this.$container.addClass('picker-open');
                this.picker.setColor(this._value, true);
                if (this.options.onOpen) this.options.onOpen();
            },
            onDone: (color) => {
                this._storeValue(color[COLOR_FORMAT])
                if (this.options.onDone) this.options.onDone(this._value);
            },
            onClose: () => {
                keyboard.toggleStandard('color-picker', false);
                if (this._tooltip) this._tooltip.enable();
                this.$container.removeClass('picker-open');
                if (this.options.onClose) this.options.onClose();
            },
            ...this.options.pickerOptions
        });

        if (this.options.tooltip) this._tooltip = this.options.tooltip();

        this.$apply.on('click', () => {
            if (this.options.onDone) this.options.onDone(this._value);
        })
    }

    _getIconColor() {
        const [h, s, l, a] = new Color(this._value).hsla; // Break colorStr into hsla components
        return l <= 0.5 ? 'white' : 'black';
    }

    /**
     * Sets and gets the char picker value
     * @param {String} [newValue] - If defined, sets the value of char picker. If undefined, char picker is not changed
     * @param {Boolean} [silent=true] - If true, onDone event is not fired
     * @returns {String} - Current value of the char picker
     */
    value(newValue, silent = false) {
        if (newValue !== undefined) {
            this.picker.setColor(newValue, true); // Silent; so vanilla-picker's onDone doesn't fire
            this._storeValue(newValue);
            if (!silent && this.options.onDone) this.options.onDone(this._value);
        }

        return this._value;
    }
    
    _storeValue(newValue) {
        this._value = newValue;
        this._refreshWell();
    }

    _refreshWell() {
        const isSplitMode = this.options.splitMode ? !!this.options.splitMode() : false;

        this.$container.toggleClass('split-mode', isSplitMode)
        this.$apply.toggle(isSplitMode)

        if (isSplitMode) {
            this.$well.css('background', '');
            this.$apply.css('background', this._value);
            this.$apply.css('color', this._getIconColor());
        } else {
            this.$well.css('background', this._value);
        }

        // If tooltip is refreshable, refresh its content
        if (this._tooltip && this._tooltip.refreshContent) this._tooltip.refreshContent();
    }

    // This is the same as the default color-picker template, except:
    // - I've re-ordered the bottom row so the picker_sample is on the far-left
    _pickerTemplate() {
        return `
            <div class="picker_wrapper" tabindex="-1">
                <div class="picker_arrow"></div>
                <div class="picker_hue picker_slider">
                    <div class="picker_selector"></div>
                </div>
                <div class="picker_sl">
                    <div class="picker_selector"></div>
                </div>
                <div class="picker_alpha picker_slider">
                    <div class="picker_selector"></div>
                </div>
                <div class="picker_sample"></div>
                <div class="picker_editor">
                    <input aria-label="Type a color name or hex value"/>
                </div>
                <div class="picker_done">
                    <button>Ok</button>
                </div>
                <div class="picker_cancel">
                    <button>Cancel</button>
                </div>
            </div>
        `;
    }

}