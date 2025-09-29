import {fontHeight, fontWidth} from "../config/font.js";
import Cell from "./cell.js";

export default class Point {
    constructor(x, y) {
        this._x = x;
        this._y = y;
    }

    static deserialize(data) {
        return new Point(data.x, data.y);
    }

    serialize() {
        return { x: this.x, y: this.y };
    }

    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }

    // Allows x/y values to be easily passed to other methods using javascript spread syntax (...)
    get xy() {
        return [this.x, this.y];
    }

    translate(x, y) {
        this._x += x;
        this._y += y;
        return this;
    }

    toString() {
        return `P{x:${this.x.toFixed(3)},y:${this.y.toFixed(3)}}`
    }


    // -------------------------------------------------------- Point -> Cell conversions
    // The following functions will only work if the point is in world space (not screen space)

    get cell() {
        const row = Math.floor(this.y / fontHeight);
        const col = Math.floor(this.x / fontWidth);
        return new Cell(row, col);
    }
    
    get roundedCell() {
        const row = Math.round(this.y / fontHeight);
        const col = Math.round(this.x / fontWidth);
        return new Cell(row, col);
    }


    /**
     * Getting a caret's position is slightly different from simply retrieving the corresponding cell: we round the x
     * position up or down depending on where the user clicks in the cell. This is how real text editors work - if you
     * click on the right half of a character, it will round up to the next character.
     * @returns {Cell}
     */
    get caretCell() {
        const row = Math.floor(this.y / fontHeight);
        const col = Math.round(this.x / fontWidth);
        return new Cell(row, col);
    }

}