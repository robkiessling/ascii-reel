import RadioButtons from "./radio_buttons.js";

export default class ColorModePicker extends RadioButtons {
    constructor($container, options = {}) {
        super($container, $.extend({}, {
            inputData: [
                { text: 'Monochrome', value: 'monochrome' },
                { text: 'Multicolor', value: 'multicolor' },
            ],
        }, options));
    }
}