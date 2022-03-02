import './styles/app.scss'
import {create2dArray} from "./utilities.js";
import * as canvas from './canvas.js';
import './keyboard.js';
import './selection.js';
import './clipboard.js';

canvas.loadFrame(create2dArray(20, 50, ''));
