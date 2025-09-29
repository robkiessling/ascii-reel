
const DEFAULT_OPTIONS = {
    inputData: [], // Array of inputs, where each input is of format: { text: 'Hello', value: 'hello' }
    onChange: () => {} // Callback when value is changed by user interaction (not programmatically)
}

export default class RadioButtons {
    static idSequence = 0;

    constructor($container, options = {}) {
        this.id = ++RadioButtons.idSequence;

        this.$container = $container;
        this.options = $.extend(true, {}, DEFAULT_OPTIONS, options);
        this._init();
    }

    set value(newValue) {
        this.$inputs.filter(`[value="${newValue}"]`).prop('checked', true).trigger('change');
    }

    get value() {
        return this.$inputs.filter(':checked').val();
    }

    _init() {
        this._createHTML();

        this.$inputs = this.$container.find(`input[name="${this._radioInputName()}"]`);
        this.$inputs.on('change', () => this.options.onChange(this.value));
    }

    _createHTML() {
        this.options.inputData.forEach(input => {
            this.$container.append(`
                <label>
                    <input type="radio" name="${this._radioInputName()}" value="${input.value}"> ${input.text}
                </label>
            `)
        })
    }

    // This picker's radio input names need to be globally unique (e.g. if multiple RadioButtons are instantiated)
    _radioInputName() {
        return `radio-type-${this.id}`;
    }

}