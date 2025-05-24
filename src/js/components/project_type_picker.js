import RadioButtons from "./radio_buttons.js";

export default class ProjectTypePicker extends RadioButtons {
    constructor($container, options = {}) {
        super($container, $.extend(true, {}, {
            inputData: [
                { text: 'Animation (multiple frames)', value: 'animation' },
                { text: 'Drawing (single frame)', value: 'drawing' },
            ]
        }, options));
    }
}