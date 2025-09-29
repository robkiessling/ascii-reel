import RadioButtons from "./radio_buttons.js";

export default class ColorModePicker extends RadioButtons {
    constructor($container, options = {}) {
        super($container, $.extend(true, {}, {
            inputData: [
                { text: 'Black and White', value: 'monochrome' },
                { text: 'Colored', value: 'multicolor' },
            ],
        }, options));
    }
}