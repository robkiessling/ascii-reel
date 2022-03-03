import './styles/app.scss'
import {create2dArray} from "./utilities.js";
import * as canvas from './canvas.js';
import './keyboard.js';
import './selection.js';
import './clipboard.js';

// canvas.loadChars(create2dArray(10, 10, ''));

const range = [32,127];
canvas.loadChars(create2dArray(20, 40, () => { return String.fromCharCode(range[0] + Math.floor((range[1] - range[0]) * Math.random())); }));
