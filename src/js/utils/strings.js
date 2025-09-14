
const HORIZONTAL_MIRRORS = {
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
const VERTICAL_MIRRORS = {
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

for (let [key, value] of Object.entries(HORIZONTAL_MIRRORS)) {
    HORIZONTAL_MIRRORS[value] = key;
}
for (let [key, value] of Object.entries(VERTICAL_MIRRORS)) {
    VERTICAL_MIRRORS[value] = key;
}

export function mirrorCharHorizontally(char) {
    return HORIZONTAL_MIRRORS[char] === undefined ? char : HORIZONTAL_MIRRORS[char];
}
export function mirrorCharVertically(char) {
    return VERTICAL_MIRRORS[char] === undefined ? char : VERTICAL_MIRRORS[char];
}


export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getFormattedDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}${minutes}`;
}

// Convert string chars like \n to HTML elements like <br>
export function strToHTML(str) {
    if (!str) return '';
    return str.replace(/\n/g, '<br/>');
}

/**
 * Inserts a string at the given index.
 * @param {string} str - The original string
 * @param {number} index - Index at which to insert
 * @param {string} insertText - The string to insert (can be one or many chars)
 * @returns {string} - The new string
 */
export function insertAt(str, index, insertText) {
    if (index < 0) index = 0;
    if (index > str.length) index = str.length;
    return str.slice(0, index) + insertText + str.slice(index);
}

export function deleteBackward(str, caretIndex) {
    if (caretIndex <= 0) return str; // nothing to delete
    if (caretIndex > str.length) caretIndex = str.length;
    return str.slice(0, caretIndex - 1) + str.slice(caretIndex);
}

export function deleteForward(str, caretIndex) {
    if (caretIndex < 0) caretIndex = 0;
    if (caretIndex >= str.length) return str; // nothing to delete
    return str.slice(0, caretIndex) + str.slice(caretIndex + 1);
}

/**
 * Replaces characters in `str` starting at `caretIndex` with `replacementText`.
 * Only replaces as many characters as the replacement text length.
 *
 * @param {string} str - The original string
 * @param {number} caretIndex - Index at which to start replacing
 * @param {string} replacementText - The text to insert
 * @returns {string} - The new string
 */
export function replaceAt(str, caretIndex, replacementText) {
    if (caretIndex < 0) caretIndex = 0;
    if (caretIndex > str.length) caretIndex = str.length;

    const before = str.slice(0, caretIndex);
    const after = str.slice(caretIndex + replacementText.length);
    return before + replacementText + after;
}