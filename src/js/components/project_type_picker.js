import RadioButtons from "./radio_buttons.js";
import {PROJECT_TYPES} from "../config/state.js";

export default class ProjectTypePicker extends RadioButtons {
    constructor($container, options = {}) {
        super($container, $.extend(true, {}, {
            inputData: [
                { text: 'Drawing', value: PROJECT_TYPES.DRAWING },
                { text: 'Animation', value: PROJECT_TYPES.ANIMATION },
            ]
        }, options));
    }
}