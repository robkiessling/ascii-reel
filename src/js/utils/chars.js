
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

export function isWordBreaker(char) {
    return /[ \t\n\r.,;:!?()[\]{}'"`~!@#$%^&*+=|\\/<>-]/.test(char);
}


// ---------------------------------------------------------------------------------- Monospace unsafe chars
// Certain characters (e.g., emojis, braille, CJK) may render wider than one cell even in monospace fonts.
// To keep visual alignment and string length consistent, we treat them as single-width during rendering.
// This may lead to overlapping glyphs, but ensures that grid-based layouts remain the correct dimensions.
// However, if the user exports to something like txt, it will look different than in the editor.
// TODO Show a warning to the user if they use one of these unsafe chars.

const monospaceUnsafeChars = new Map();

/**
 * Determines whether a given character is visually problematic in a monospaced grid.
 *
 * Characters flagged as "monospace unsafe" may appear wider or misaligned in ASCII art displays.
 * E.g. Braille patterns, emojis, CJK ideographs, and invisible marks.
 *
 * @param {string} char - A single Unicode character to evaluate.
 * @returns {boolean} - True if the character is likely to break monospace layout.
 */
function computeIsMonospaceUnsafeChar(char) {
    if (!char || typeof char !== 'string') return false;

    const code = char.codePointAt(0);

    if (code >= 0x2800 && code <= 0x28FF) return true; // Braille
    if (code >= 0x1F300 && code <= 0x1FAFF) return true; // Emoji
    if (code >= 0x4E00 && code <= 0x9FFF) return true; // CJK
    if (code === 0x200B || (code >= 0x200C && code <= 0x200F)) return true; // ZWSP, RTL
    return false;
}

/**
 * Cached wrapper around `computeIsMonospaceUnsafeChar`.
 *
 * Evaluates whether a character is visually unsafe for monospaced rendering.
 *
 * @param {string} char - A single Unicode character to check.
 * @returns {boolean} - True if the character is considered unsafe in a monospaced layout.
 */
export function isMonospaceUnsafeChar(char) {
    const code = char.codePointAt(0);
    if (!monospaceUnsafeChars.has(code)) monospaceUnsafeChars.set(code, computeIsMonospaceUnsafeChar(char))
    return monospaceUnsafeChars.get(code);
}

