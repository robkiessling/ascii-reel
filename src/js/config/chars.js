/**
 * In the ASCII canvas, EMPTY_CHAR and WHITESPACE_CHAR both appear visually blank, but they behave differently.
 * EMPTY_CHAR is transparent and allows lower layers to show through, while WHITESPACE_CHAR is blocking and obscures
 * layers beneath.
 *
 * This distinction also matters for features like paint bucket fill:
 * - If a shape is drawn with EMPTY_CHAR gaps, the fill will leak through.
 * - If the gaps use WHITESPACE_CHAR, the fill stays contained.
 *
 * To help users differentiate the two, there's a toggleable view mode that makes WHITESPACE_CHARs visible.
 */
export const EMPTY_CHAR = '';
export const WHITESPACE_CHAR = ' ';





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

