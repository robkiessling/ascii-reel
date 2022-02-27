
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