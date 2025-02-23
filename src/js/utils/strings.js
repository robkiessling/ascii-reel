
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
