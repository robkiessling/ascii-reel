import Picker from "vanilla-picker";
import {COLOR_FORMAT} from "../../state/index.js";

const DEFAULT_COLORED_BACKGROUND = 'rgba(160,208,230,1)';
const TRANSPARENT = 'transparent';
const COLORED = 'colored';
const DEFAULT_OPTIONS = {}

export default class BackgroundPicker {
    static idSequence = 0;

    constructor($container, options = {}) {
        this.id = ++BackgroundPicker.idSequence;

        this.$container = $container;
        this.options = $.extend({}, DEFAULT_OPTIONS, options);
        this._init();
    }

    set value(newValue) {
        this.$types.filter(`[value="${newValue ? COLORED : TRANSPARENT}"]`).prop('checked', true);
        if (newValue) this.colorPicker.setColor(newValue, false);
    }

    get value() {
        if (this.$types.filter(':checked').val() === TRANSPARENT) return false;
        return this.pickerValue;
    }

    _init() {
        this._createHTML();

        this.$types = this.$container.find(`input[name="${this._radioInputName()}"]`);

        const $colorWell = this.$container.find(`.color-well`);

        this.colorPicker = new Picker({
            parent: $colorWell.get(0),
            popup: 'top',
            color: DEFAULT_COLORED_BACKGROUND,
            onOpen: () => {
                this.$types.filter(`[value="${COLORED}"]`).prop('checked', true)
            },
            onChange: (color) => {
                this.pickerValue = color[COLOR_FORMAT];
                $colorWell.css('background', this.pickerValue);
            },
        });
    }

    _createHTML() {
        this.$container.append(`
            <label>
                <input type="radio" name="${this._radioInputName()}" value="transparent"> Transparent
            </label>
            <label>
                <input type="radio" name="${this._radioInputName()}" value="colored"> Colored
                <span class="color-well"></span>
            </label>
        `);
    }

    // This picker's radio input names need to be globally unique (e.g. if multiple BackgroundPickers are instantiated)
    _radioInputName() {
        return `background-type-${this.id}`;
    }

}