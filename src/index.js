import './styles/app.scss'
import {create2dArray, randomPrintableChar} from "./utilities.js";
import * as canvas from './canvas.js';
import './preview.js';
import './keyboard.js';
import './selection.js';
import './clipboard.js';

canvas.initialize();
canvas.loadChars(create2dArray(20, 40, ''));
// canvas.loadChars(create2dArray(30, 50, () => randomPrintableChar()));
// canvas.loadChars(create2dArray(6, 10, (row, col) => {
//     if (row < 2) {
//         return randomPrintableChar();
//     } else if (row < 4) {
//         return ' ';
//     }
//     else {
//         return '';
//     }
// }));
// canvas.loadChars(create2dArray(90, 150, (row, col) => {
//     return row % 10 === 0 && col % 10 === 0 ? 'X' : '';
// }));
