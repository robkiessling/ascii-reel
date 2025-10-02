/**
 * In the ASCII canvas, both EMPTY_CHAR ('') and WHITESPACE_CHAR (' ') appear visually blank, but they have
 * distinct behaviors:
 * - EMPTY_CHAR is fully transparent and allows lower layers to show through.
 * - WHITESPACE_CHAR is an opaque character; it looks blank but blocks layers beneath.
 *
 * To help users distinguish the two, there's a toggleable view mode that reveals WHITESPACE_CHARs by showing a
 * visible dot placeholder.
 *
 * ---
 *
 * Layers start out empty by default and can have shapes or text drawn on top of them.
 * Restoring a region of a layer to an empty (transparent) state depends on the layer type:
 * - For raster layers, you can restore emptiness using the eraser tool, or by selecting an area and pressing
 *   backspace - including within the text-editor tool.
 * - For vector layers, you can update a drawn shape to have an empty fill.
 *
 * Importantly, you cannot restore emptiness to a region by drawing a new shape. When a shape is configured with an
 * "empty fill", it simply skips drawing in those areas; it does not actively erase or clear the content underneath.
 * It only ensures that it does not overwrite the canvas at those positions. The only exception is if the shape has
 * its WRITE_EMPTY_CHARS_PROP enabled; this allows certain shapes to be specifically used for erasing (e.g. freeform
 * shape is used to handle eraser).
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

