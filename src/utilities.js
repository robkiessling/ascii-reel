import {Cell} from "./canvas.js";
import $ from "jquery";

export function isFunction(value) {
    return typeof value === 'function';
}

// @param defaultValue can be a primitive value (like an integer or string) or a function that returns the desired value.
// Do not pass an object as a default value; otherwise all the elements will be a reference to the same object. You 
// should pass a function that returns a new object.
export function create2dArray(numRows, numCols, defaultValue) {
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

// Used for converting an array into a new object (similar to ruby's each_with_object method)
export function eachWithObject(array, initialObject = {}, callback) {
    return array.reduce((obj, element) => {
        callback(element, obj);
        return obj;
    }, initialObject);
}

/**
 * Translates a 2d array as if it was positioned at a Cell. The callback value will be null for parts of the array
 * that go out of the frame.
 *
 * @param array         2d array of values
 * @param cell          Position to move the top-left Cell of the layout to
 * @param callback      function(value, row, col), where row and col are the coordinates if the layout was moved
 */
export function translate(array, cell, callback) {
    array.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            callback(value, rowIndex + cell.row, colIndex + cell.col);
        });
    });
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


const EPSILON = 0.000001; // Adding an epsilon to handle floating point rounding errors

export function roundToDecimal(number, numDecimals) {
    if (numDecimals === 0) {
        return Math.round(number + EPSILON)
    }
    else {
        const factor = Math.pow(10, numDecimals);
        return Math.round((number + EPSILON) * factor) / factor;
    }
}

// Rounds a float to 5 decimals. This should be used before any numerical comparisons (e.g. < <= > >=) because of floating point rounding errors
export function roundForComparison(number) {
    return roundToDecimal(number, 5);
}

const horizontalMirrors = {
    '(': ')',
    '/': '\\',
    // '2': '5',
    // '3': 'E',
    // '9': 'P',
    'b': 'd',
    'p': 'q',
    '<': '>',
    '[': ']',
    '{': '}'
}
for (let [key, value] of Object.entries(horizontalMirrors)) {
    horizontalMirrors[value] = key;
}
const verticalMirrors = {
    '!': 'i',
    "'": '.',
    ',': '`',
    '/': '\\',
    // '2': '5',
    // '6': 'g',
    // '9': 'd',
    // 'A': 'V',
    'M': 'W',
    'd': 'q',
    'm': 'w',
    'n': 'u',
    'p': 'b',
    'v': '^'
}
for (let [key, value] of Object.entries(verticalMirrors)) {
    verticalMirrors[value] = key;
}

export function mirrorCharHorizontally(char) {
    return horizontalMirrors[char] === undefined ? char : horizontalMirrors[char];
}
export function mirrorCharVertically(char) {
    return verticalMirrors[char] === undefined ? char : verticalMirrors[char];
}


// Debounce window resize events
let resizeId;
$(window).on('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => {
        $(window).trigger('resize:debounced');
    }, 500);
});
