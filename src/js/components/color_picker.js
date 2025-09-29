import Picker from "vanilla-picker";
import * as keyboard from "../io/keyboard.js";
import {standardTip} from "./tooltips.js";
import * as state from "../state/index.js";
import {eventBus, EVENTS} from "../events/events.js";
import {setupTooltips} from "../io/actions.js";
import Color from "@sphinxxxx/color-conversion";

export default class ColorPicker {
    /**
     * @param $picker - jQuery element for the picker container
     * @param {Object} options - Picker options
     * @param {string} [options.initialValue] - Initial char value
     * @param {function} [options.onLoad] - Callback when picker value is set for the first time
     * @param {function} [options.onChange] - Callback when picker value changes. Will be rapidly called if user clicks
     *   and drags their mouse in the rainbow. Use onDone instead to only fire when 'Ok' button is clicked / popup is closed
     * @param {function} [options.onDone] - Callback when picker 'Ok' button is clicked, picker is closed, or value
     *   is set programmatically
     * @param {function} [options.pickerOptions] - Options to pass to vanilla-picker
     * @param {() => tippy} [options.tooltip] - Function that attaches a tooltip to the picker
     */
    constructor($picker, options = {}) {
        this.$picker = $picker;
        this.options = options;

        this._init();
        this.value(this.options.initialValue || '#555', true)
        if (this.options.onLoad) this.options.onLoad(this.value())
    }

    _init() {
        this.picker = new Picker($.extend({
            parent: this.$picker.get(0),
            popup: 'right',
            onOpen: () => {
                keyboard.toggleStandard('color-picker', true);
                this._tooltip.disable();
                this.$picker.addClass('picker-open');

                if (!this._$addToPalette) {
                    this._$addToPalette = this.$picker.find('.picker_sample');
                    this._addToPaletteTooltip = standardTip(this._$addToPalette, 'tools.standard.color-picker-add', {
                        placement: 'right',
                        offset: [0, 20],
                    })
                }

                this._refreshAddToPalette();
            },
            onClose: () => {
                keyboard.toggleStandard('color-picker', false);
                this._tooltip.enable();
                this.$picker.removeClass('picker-open');

                if (this.options.onDone) this.options.onDone(this._value);
            },
            onChange: (color) => {
                this._storeValue(color[state.COLOR_FORMAT])
                if (this.options.onChange) this.options.onChange(this._value);
            },
        }, this.options.pickerOptions));

        if (this.options.tooltip) this._tooltip = this.options.tooltip();

        this.$picker.on('click', '.add-to-palette', () => {
            state.addColor(this._value);
            this._refreshAddToPalette();
            eventBus.emit(EVENTS.TOOLS.COLOR_ADDED);
            state.pushHistory();
        })
    }

    _refreshAddToPalette() {
        if (!this._$addToPalette) return;

        this._$addToPalette.empty();

        if (state.isNewColor(this._value)) {
            this._$addToPalette.addClass('add-to-palette');

            const [h, s, l, a] = new Color(this._value).hsla; // Break colorStr into hsla components

            $('<span>', {
                css: { color: l <= 0.5 ? 'white' : 'black' },
                class: 'ri ri-fw ri-alert-line'
            }).appendTo(this._$addToPalette);

            this._addToPaletteTooltip.enable();
        }
        else {
            this._$addToPalette.removeClass('add-to-palette');
            this._addToPaletteTooltip.disable();
        }
    }


    /**
     * Sets and gets the char picker value
     * @param {String} [newValue] - If defined, sets the value of char picker. If undefined, char picker is not changed
     * @param {Boolean} [silent=true] - If true, onChange/onDone events are not fired
     * @returns {String} - Current value of the char picker
     */
    value(newValue, silent = false) {
        if (newValue !== undefined) {
            this.picker.setColor(newValue, true); // Silent; so vanilla-picker's onDone doesn't fire
            this._storeValue(newValue);
            if (!silent && this.options.onChange) this.options.onChange(this._value);
            if (!silent && this.options.onDone) this.options.onDone(this._value);
        }

        return this._value;
    }
    
    _storeValue(newValue) {
        this._value = newValue;
        this.$picker.css('background', this._value);
        this._refreshAddToPalette();
    }


}