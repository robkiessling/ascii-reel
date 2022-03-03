import {CELL_HEIGHT, CELL_WIDTH} from "./canvas.js";

export function isFunction(value) {
    return typeof value === 'function';
}

// @param defaultValue can be a primitive value (like an integer or string) or a function that returns the desired value.
// Do not pass an object as a default value; otherwise all the elements will be a reference to the same object. You 
// should pass a function that returns a new object.
export function create2dArray(numRows, numCols, defaultValue = null) {
    let array = [];

    for (let row = 0; row < numRows; row++) {
        let rowValues = [];
        for (let col = 0; col < numCols; col++) {
            rowValues.push(isFunction(defaultValue) ? defaultValue(row, col) : defaultValue);
        }
        array.push(rowValues);
    }

    return array;
}

// @param defaultValue See notes in create2dArray
export function createArray(size, defaultValue = null) {
    let array = [];

    for (let i = 0; i < size; i++) {
        array.push(isFunction(defaultValue) ? defaultValue(i) : defaultValue);
    }

    return array;
}

export function iterate2dArray(array, callback) {
    for (let row = 0; row < array.length; row++) {
        for (let col = 0; col < array[row].length; col++) {
            callback(array[row][col], new Coord(row, col), array);
        }
    }
}

const MAX_TEXT_LENGTH = 100000; // Upper limit just in case the OS clipboard had a huge amount of text copied

export function convertTextTo2dArray(text) {
    return text.slice(0, MAX_TEXT_LENGTH).split(/\r?\n/).map(line => {
        return line.split('');
    })
}

export function convert2dArrayToText(array) {
    return array.map(row => {
        return row.map(char => char === null ? ' ' : char).join('')
    }).join('\n');
}

const PRINTABLE_CHAR_RANGE = [33, 126];
export function randomPrintableChar() {
    return String.fromCharCode(getRandomInt(PRINTABLE_CHAR_RANGE[0], PRINTABLE_CHAR_RANGE[1]));
}

// Returns a random integer between min (inclusive) and max (inclusive)
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// A class so we can deal with rows/columns, and it handles x/y positioning for us
export class Coord {
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }

    clone() {
        return new Coord(this.row, this.col);
    }

    translate(rowDelta, colDelta) {
        this.row += rowDelta;
        this.col += colDelta;
    }

    static fromXY(x, y) {
        return new Coord(Math.floor(y / CELL_HEIGHT), Math.floor(x / CELL_WIDTH));
    }

    x() {
        return this.col * CELL_WIDTH;
    }

    y() {
        return this.row * CELL_HEIGHT;
    }

    // Used to spread (...) into functions that take (x, y) parameters
    xy() {
        return [this.x(), this.y()];
    }

    // Used to spread (...) into functions that take (x, y, width, height) parameters
    xywh() {
        return [this.x(), this.y(), CELL_WIDTH, CELL_HEIGHT];
    }
}

export class Rect {
    constructor(topLeft, bottomRight) {
        this.topLeft = topLeft; // Coord
        this.bottomRight = bottomRight; // Coord
    }

    clone() {
        return new Rect(this.topLeft.clone(), this.bottomRight.clone());
    }

    height() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }

    width() {
        return this.bottomRight.col - this.topLeft.col + 1;
    }

    iterate(callback) {
        for (let r = this.topLeft.row; r <= this.bottomRight.row; r++) {
            for (let c = this.topLeft.col; c <= this.bottomRight.col; c++) {
                callback(r, c);
            }
        }
    }

    mergeRect(otherRect) {
        if (otherRect.topLeft.row < this.topLeft.row) { this.topLeft.row = otherRect.topLeft.row; }
        if (otherRect.topLeft.col < this.topLeft.col) { this.topLeft.col = otherRect.topLeft.col; }
        if (otherRect.bottomRight.row > this.bottomRight.row) { this.bottomRight.row = otherRect.bottomRight.row; }
        if (otherRect.bottomRight.col > this.bottomRight.col) { this.bottomRight.col = otherRect.bottomRight.col; }
    }
}