import RadioButtons from "./radio_buttons.js";

export default class ProjectTypePicker extends RadioButtons {
    constructor($container, options = {}) {
        super($container, $.extend({}, {
            inputData: [
                { text: 'Drawing (single frame)', value: 'drawing' },
                { text: 'Animation (multiple frames)', value: 'animation' },
            ]
        }, options));
    }
}