
export function isFunction(value) {
    return typeof value === 'function';
}

// @param defaultValue can be a primitive value (like an integer or string) or a function that returns the value to set.
// Do not pass an object as a default value; otherwise all the elements will point to the same object. You should pass
// a function that returns a new object.
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
            callback(array[row][col], row, col, array);
        }
    }
}

const MAX_CLIPBOARD_LENGTH = 100000; // Upper limit on clipboard for performance reasons

export function convertTextTo2dArray(text) {
    return text.slice(0, MAX_CLIPBOARD_LENGTH).split(/\r?\n/).map(line => {
        return line.split('');
    })
}

export function convert2dArrayToText(array) {
    return array.map(row => {
        return row.map(char => char === null ? ' ' : char).join('')
    }).join('\n');
}

export class Coord {
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }

    clone() {
        return new Coord(this.row, this.col);
    }
}

export class Rect {
    constructor(topLeft, bottomRight) {
        this.topLeft = topLeft;
        this.bottomRight = bottomRight;
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