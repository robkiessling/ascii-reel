import './styles/app.scss'
import {create2dArray, randomPrintableChar} from "./utilities.js";
import * as canvas from './canvas.js';
import * as preview from './preview.js';
import './keyboard.js';
import './selection.js';
import './clipboard.js';

// canvas.loadChars(create2dArray(20, 40, ''));
canvas.loadChars(create2dArray(20, 40, () => randomPrintableChar()));

const BACKGROUND_COLOR = '#444'; // TODO This will be configurable
canvas.setBackgroundColor(BACKGROUND_COLOR);
preview.setBackgroundColor(BACKGROUND_COLOR);