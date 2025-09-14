
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

export function insertAt(str, index, char) {
    if (index < 0) index = 0;
    if (index > str.length) index = str.length;
    return str.slice(0, index) + char + str.slice(index);
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