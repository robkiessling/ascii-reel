import Picker from "vanilla-picker";
import {COLOR_FORMAT, BLACK, WHITE} from "../state/index.js";
import Color from "@sphinxxxx/color-conversion";

// TODO Move these constants elsewhere and combine with color_mode_picker.js etc.
const BLACK_AND_WHITE_MODE = 'monochrome';
const COLORED_MODE = 'multicolor';

const DEFAULT_COLORED_BACKGROUND = new Color('rgba(160,208,230,1)')[COLOR_FORMAT];
const TRANSPARENT = 'transparent';
const CUSTOM = 'colored';

const DEFAULT_OPTIONS = {
    onChange: () => {} // Callback when value is changed by user interaction (not programmatically)
}

export default class BackgroundPicker {
    static idSequence = 0;

    constructor($container, options = {}) {
        this.id = ++BackgroundPicker.idSequence;

        this.$container = $container;
        this.options = $.extend({}, DEFAULT_OPTIONS, options);
        this._init();
    }

    // The background picker's visible options depend on the color mode
    set mode(newMode) {
        this._mode = newMode;
        this._refreshVisibility();
    }

    get mode() {
        return this._mode;
    }

    /**
     *
     * @param {string|false} newValue - rgba/hex string, or false to represent transparent background
     */
    set value(newValue) {
        newValue = newValue ? new Color(newValue)[COLOR_FORMAT] : false;

        if (newValue === false) {
            // Transparent
            this.$types.filter(`[value="${TRANSPARENT}"]`).prop('checked', true);
        }
        else if (this.$types.filter(`[value="${newValue}"]`).length) {
            // There is an exact match (e.g. if color is #ffffff, we select the exact match 'white' option)
            this.$types.filter(`[value="${newValue}"]`).prop('checked', true);
        }
        else {
            // All other colors
            this.$types.filter(`[value="${CUSTOM}"]`).prop('checked', true);
            this._ignoreNextOnChange();
            this.colorPicker.setColor(newValue, false);
        }
    }

    get value() {
        switch(this.$types.filter(':checked').val()) {
            case TRANSPARENT:
                return false;
            case WHITE:
                return WHITE;
            case BLACK:
                return BLACK;
            case CUSTOM:
                return this.pickerValue;
            default:
                console.warn(`Unknown background_picker option: ${this.$types.filter(':checked').val()}`)
        }
    }

    _init() {
        this._createHTML();

        this.$types = this.$container.find(`input[name="${this._radioInputName()}"]`);
        this.$types.on('change', () => this._onChange());

        const $colorWell = this.$container.find(`.color-well`);

        this._ignoreNextOnChange(); // Required since vanilla-picker's initial `color` property triggers its onChange
        this.colorPicker = new Picker({
            parent: $colorWell.get(0),
            popup: 'right',
            color: DEFAULT_COLORED_BACKGROUND,
            onOpen: () => {
                this.$types.filter(`[value="${CUSTOM}"]`).prop('checked', true)
            },
            onChange: (color) => {
                this.pickerValue = color[COLOR_FORMAT];
                $colorWell.css('background', this.pickerValue);
                this._onChange();
            },
        });
    }

    _createHTML() {
        this.$container.append(`
            <label class="conditional-field" data-show-if="mode=${BLACK_AND_WHITE_MODE},${COLORED_MODE}">
                <input type="radio" name="${this._radioInputName()}" value="${WHITE}"> White
            </label>
            <label class="conditional-field" data-show-if="mode=${BLACK_AND_WHITE_MODE},${COLORED_MODE}">
                <input type="radio" name="${this._radioInputName()}" value="${BLACK}"> Black
            </label>
            <label class="conditional-field" data-show-if="mode=${COLORED_MODE}">
                <input type="radio" name="${this._radioInputName()}" value="${CUSTOM}"> Custom
                <span class="color-well"></span>
            </label>
        `);

        // --- Not showing transparency grid option for now since it clashes hard with grid
        // <label class="conditional-field" data-show-if="mode=${BLACK_AND_WHITE_MODE},${COLORED_MODE}">
        //     <input type="radio" name="${this._radioInputName()}" value="${TRANSPARENT}"> Transparency Grid
        // </label>
    }

    // Workaround for when we need the vanilla-picker's onChange to fire, but don't want it to
    // trigger the background-picker's onChange
    _ignoreNextOnChange() {
        this._nextOnChangeIgnored = true;
    }

    _onChange() {
        if (this._nextOnChangeIgnored) {
            this._nextOnChangeIgnored = false;
            return;
        }

        this.options.onChange(this.value);
    }

    _refreshVisibility() {
        this.$container.find('.conditional-field').each((i, element) => {
            const $field = $(element);
            const condition = $field.data('show-if'); // e.g. "mode=mode1,mode2"
            const [attr, valuesString] = condition.split('=');
            $field.toggle(valuesString.split(',').includes(this[attr]))
        });

        if (!this.$types.filter(':checked').is(':visible')) {
            // If option is no longer visible, default to WHITE
            this.$types.filter(`[value="${WHITE}"]`).prop('checked', true);
        }
    }

    // This picker's radio input names need to be globally unique (e.g. if multiple BackgroundPickers are instantiated)
    _radioInputName() {
        return `background-type-${this.id}`;
    }

}