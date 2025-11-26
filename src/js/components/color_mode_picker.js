import RadioButtons from "./radio_buttons.js";
import {COLOR_MODES} from "../config/colors.js";

export default class ColorModePicker extends RadioButtons {
    constructor($container, options = {}) {
        super($container, $.extend(true, {}, {
            inputData: [
                { text: 'Monochrome (black & white)', value: COLOR_MODES.BLACK_AND_WHITE },
                { text: 'Colored', value: COLOR_MODES.COLORED },
            ],
        }, options));
    }
}