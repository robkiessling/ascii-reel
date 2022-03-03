import './styles/app.scss'
import {create2dArray, randomPrintableChar} from "./utilities.js";
import * as canvas from './canvas.js';
import * as preview from './preview.js';
import './keyboard.js';
import './selection.js';
import './clipboard.js';

canvas.initialize();
// canvas.loadChars(create2dArray(20, 40, ''));
canvas.loadChars(create2dArray(30, 50, () => randomPrintableChar()));
// canvas.loadChars(create2dArray(90, 150, (row, col) => {
//     return row % 10 === 0 && col % 10 === 0 ? 'X' : '';
// }));

const BACKGROUND_COLOR = '#444'; // TODO This will be configurable
canvas.setBackgroundColor(BACKGROUND_COLOR);
preview.setBackgroundColor(BACKGROUND_COLOR);