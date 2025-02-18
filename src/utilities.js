import $ from "jquery";
import 'jquery-ui/ui/widgets/dialog.js';
import * as keyboard from "./keyboard.js";
import {hideAll} from "tippy.js";

export function isFunction(value) {
    return typeof value === 'function';
}

export function isObject(val) {
    return val !== null && typeof val === 'object' && Array.isArray(val) === false;
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

// Builds an object while iterating over an array (similar to ruby's each_with_object method)
export function eachWithObject(array, initialObject = {}, callback) {
    return array.reduce((obj, element) => {
        callback(element, obj);
        return obj;
    }, initialObject);
}

// Returns a new object while transforming the object values (similar to ruby's transform_values method)
export function transformValues(obj, callback) {
    return Object.fromEntries(
        Object.entries(obj).map(
            ([k, v], i) => [k, callback(v, k, i)]
        )
    );
}

/**
 * Translates 2d arrays of chars/colors as if they were positioned at a Cell.
 * Note: The callback rows/cols can be out of bounds
 *
 * @param glyphs         An object like: { chars: [[2d array of chars]], colors: [[2d array of colors]] }
 * @param cell           Position to move the top-left Cell of the layout to
 * @param callback       function(row, col, char, color), where row and col are the coordinates if the layout was moved
 */
export function translateGlyphs(glyphs, cell, callback) {
    // Note: rows may have different number of columns (e.g. when pasting from a text editor) so not caching row/col length
    let r, c;

    for (r = 0; r < glyphs.chars.length; r++) {
        for (c = 0; c < glyphs.chars[r].length; c++) {
            callback(r + cell.row, c + cell.col, glyphs.chars[r][c], glyphs.colors[r][c]);
        }
    }
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

// https://stackoverflow.com/a/58326357
export function randomHexString(length) {
    return [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function isMacOS() {
    return navigator.platform.indexOf("Mac") === 0; // TODO deprecated?
}

// It seems like operating systems abbreviate shortcuts differently:
// Mac:     ⌘⇧N
// Windows: Ctrl-Shift-N
export function modifierAbbr(modifierKey) {
    switch(modifierKey) {
        case 'metaKey':
            return isMacOS() ? '⌘' : 'Win-';
        case 'altKey':
            return isMacOS() ? '⌥' : 'Alt-';
        case 'ctrlKey':
            return isMacOS() ? '^' : 'Ctrl-';
        case 'shiftKey':
            return isMacOS() ? '⇧' : 'Shift-';
        default:
            console.warn(`Unknown modifierKey: ${modifierKey}`);
            return '?'
    }
}

export function modifierWord(modifierKey) {
    switch(modifierKey) {
        case 'metaKey':
            return isMacOS() ? 'Cmd' : 'Win';
        case 'altKey':
            return isMacOS() ? 'Option' : 'Alt';
        case 'ctrlKey':
            return 'Ctrl';
        case 'shiftKey':
            return 'Shift';
    }
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

/**
 * Similar to window.setInterval, but built on top of requestAnimationFrame. This is better for animations
 * and can pause when the tab is inactive. Do not use if the callback needs to run at an extremely precise interval.
 *
 * @param callback The function to call every interval
 * @param delay Time in milliseconds between intervals
 * @param evaluateImmediately If true, callback immediately fires instead of waiting for first interval to pass
 * @returns {{stop: function}} `stop` is a function that can be called to clear the interval
 */
export function setIntervalUsingRAF(callback, delay, evaluateImmediately = false) {
    let now = performance.now();
    let then = performance.now();
    let progress = evaluateImmediately ? delay : 0;
    let stop = false;

    function loop() {
        if (stop) return;

        now = performance.now();
        progress += (now - then);
        then = now;

        if (progress >= delay) {
            callback();
            progress = progress % delay;
        }

        window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);

    return {
        stop: () => { stop = true; }
    }
}



export function createHorizontalMenu($menu, onOpen) {
    let isShowing = false;
    let $li = null;
    updateMenu();

    $menu.children('li').off('click').on('click', evt => {
        evt.stopPropagation();
        $li = $(evt.currentTarget);
        isShowing = !isShowing;
        updateMenu();
    });

    $menu.children('li').off('mouseenter').on('mouseenter', evt => {
        $li = $(evt.currentTarget);
        updateMenu();
    });

    $menu.children('li').off('mouseleave').on('mouseleave', evt => {
        if (!isShowing) {
            $li = null;
        }
        updateMenu();
    });

    function updateMenu() {
        $menu.find('li').removeClass('hovered visible');
        $(document).off('click.menu');

        if ($li) {
            $li.addClass('hovered');

            if (isShowing) {
                $li.addClass('visible');
                $(document).on('click.menu', evt => {
                    isShowing = false;
                    $li = null;
                    updateMenu();
                });
                if (onOpen) { onOpen($li); }
                // todo keybind 'esc' to close menu
            }
        }
    }

    // Return a small API we can use
    return {
        isShowing: () => isShowing,
        close: () => { isShowing = false; $li = null; updateMenu(); }
    }
}






const $confirmDialog = $('#confirm-dialog');
createDialog($confirmDialog, null);

export function confirmDialog(title, description, onAccept, acceptText = 'Ok') {
    $confirmDialog.dialog('option', 'title', title);
    $confirmDialog.find('p').html(description);

    $confirmDialog.dialog('option', 'buttons', [
        {
            text: 'Cancel',
            click: () => $confirmDialog.dialog("close")
        },
        {
            text: acceptText,
            class: 'call-out',
            click: () => {
                $confirmDialog.dialog('close');
                onAccept();
            }
        }
    ]);

    $confirmDialog.dialog('open');
}

export function createDialog($dialog, onAccept, acceptText = 'Save', overrides = {}) {
    $dialog.dialog($.extend({
        autoOpen: false,
        width: 350,
        classes: {
            // "ui-dialog-titlebar-close": "ri ri-fw ri-close-line"
            "ui-dialog-titlebar-close": "hidden"
        },
        closeText: '',
        draggable: false,
        resizable: false,
        modal: true,
        open: () => {
            $('.ui-widget-overlay').on('click', () => {
                $dialog.dialog('close');
            });

            if ($dialog.parent().find('.ui-dialog-title').text().trim() === '') {
                $dialog.parent().find('.ui-dialog-titlebar').hide();
            }

            keyboard.toggleStandard(true);
            $(document).on('keyboard:enter.dialog', onAccept);

            $dialog.find('.highlight:first').select();
        },
        close: () => {
            keyboard.toggleStandard(false);
            setTimeout(() => hideAll(), 1); // Hide all tooltips (sometimes tooltips get stifled by dialog popup)
            $(document).off('keyboard:enter.dialog');
        },
        buttons: [
            {
                text: 'Cancel',
                click: () => $dialog.dialog("close")
            },
            {
                text: acceptText,
                class: 'call-out',
                click: onAccept
            }
        ]
    }, overrides));
}

// Note: Indentation is purposely left-aligned since it gets put exactly as is into HTML file
export function createHTMLFile(title, script, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script>${script}</script>
</head>
<body>
    ${body}
</body>
</html>`;
}


// A Range represents a subarray between two indices: startIndex and endIndex
export class Range {
    constructor(startIndex, endIndex) {
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        if (this.endIndex < this.startIndex) {
            console.error(`Invalid Range initialization: ${startIndex}, ${endIndex}`);
            this.endIndex = this.startIndex;
        }
    }

    // Convert to/from its object representation (so we can store it in json state)
    static deserialize(data) {
        return new Range(data.startIndex, data.endIndex);
    }
    serialize() {
        return { startIndex: this.startIndex, endIndex: this.endIndex };
    }

    static fromSingleIndex(index) {
        return new Range(index, index);
    }

    includes(index) {
        return index >= this.startIndex && index <= this.endIndex;
    }

    get length() {
        return this.endIndex - this.startIndex + 1;
    }

    toDisplay() {
        return `${this.startIndex + 1}-${this.endIndex + 1}`
    }

    // Returns how far a given index is from the start of the range
    offset(index) {
        return index - this.startIndex;
    }

    iterate(callback) {
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            callback(i);
        }
    }

    // Extends the range so that it includes the given index
    extendTo(index) {
        this.startIndex = Math.min(this.startIndex, index);
        this.endIndex = Math.max(this.endIndex, index);
        return this;
    }

    // Translates the range a fixed distance
    translate(distance) {
        this.startIndex += distance;
        this.endIndex += distance;
        return this;
    }

    // Translates the range so that its startIndex equals the given index
    translateTo(index) {
        return this.translate(this.offset(index));
    }

    clone() {
        return new Range(this.startIndex, this.endIndex);
    }
}