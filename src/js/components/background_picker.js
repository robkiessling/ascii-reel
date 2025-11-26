import Color from "@sphinxxxx/color-conversion";
import ColorPicker from "./color_picker.js";
import {BACKGROUND_MODES, COLOR_FORMAT, COLOR_MODES} from "../config/colors.js";

const DEFAULT_COLORED_BACKGROUND = new Color('rgba(160,208,230,1)')[COLOR_FORMAT];

const DEFAULT_OPTIONS = {
    onChange: () => {} // Callback when value is changed by user interaction (not programmatically)
}

export default class BackgroundPicker {
    static idSequence = 0;

    constructor($container, options = {}) {
        this.id = ++BackgroundPicker.idSequence;

        this.$container = $container;
        this.options = $.extend(true, {}, DEFAULT_OPTIONS, options);
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

    set value(newValue) {
        if (this.$types.filter(`[value="${newValue}"]`).length) {
            // There is an exact match (e.g. 'dark', 'transparent')
            this.$types.filter(`[value="${newValue}"]`).prop('checked', true);
        }
        else {
            // All other colors
            this.$types.filter(`[value="${BACKGROUND_MODES.CUSTOM}"]`).prop('checked', true);
            this.colorPicker.value(new Color(newValue)[COLOR_FORMAT]);
        }
    }

    get value() {
        const checkedVal = this.$types.filter(':checked').val();
        return checkedVal === BACKGROUND_MODES.CUSTOM ? this.pickerValue : checkedVal;
    }

    _init() {
        this._createHTML();

        this.$types = this.$container.find(`input[name="${this._radioInputName()}"]`);
        this.$types.on('change', () => this._onChange());

        this.colorPicker = new ColorPicker(this.$container.find('.color-picker'), {
            initialValue: DEFAULT_COLORED_BACKGROUND,
            pickerOptions: {
                popup: 'top'
            },
            onOpen: () => {
                this.$types.filter(`[value="${BACKGROUND_MODES.CUSTOM}"]`).prop('checked', true);
                this._onChange();
            },
            onDone: color => {
                this.pickerValue = color;
                this._onChange();
            }
        });

        this.pickerValue = this.colorPicker.value();
    }

    _createHTML() {
        this.$container.append(`
            <label class="conditional-field" data-show-if="mode=${COLOR_MODES.BLACK_AND_WHITE}">
                <input type="radio" name="${this._radioInputName()}" value="${BACKGROUND_MODES.MATCH_THEME}"> Match UI Theme
            </label>
            <label class="conditional-field" data-show-if="mode=${COLOR_MODES.BLACK_AND_WHITE},${COLOR_MODES.COLORED}">
                <input type="radio" name="${this._radioInputName()}" value="${BACKGROUND_MODES.LIGHT}"> Light
            </label>
            <label class="conditional-field" data-show-if="mode=${COLOR_MODES.BLACK_AND_WHITE},${COLOR_MODES.COLORED}">
                <input type="radio" name="${this._radioInputName()}" value="${BACKGROUND_MODES.DARK}"> Dark
            </label>
            <label class="conditional-field" data-show-if="mode=${COLOR_MODES.COLORED}">
                <input type="radio" name="${this._radioInputName()}" value="${BACKGROUND_MODES.CUSTOM}"> Custom
                <div class="color-picker"></div>
            </label>
        `);

        // --- Not showing transparency grid option for now since it clashes hard with grid
        // <label class="conditional-field" data-show-if="mode=${COLOR_MODES.BLACK_AND_WHITE},${COLOR_MODES.COLORED}">
        //     <input type="radio" name="${this._radioInputName()}" value="${BACKGROUND_MODES.TRANSPARENT}"> Transparency Grid
        // </label>
    }

    _onChange() {
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
            this.$types.filter(':visible').first().prop('checked', true);
        }
    }

    // This picker's radio input names need to be globally unique (e.g. if multiple BackgroundPickers are instantiated)
    _radioInputName() {
        return `background-type-${this.id}`;
    }

}