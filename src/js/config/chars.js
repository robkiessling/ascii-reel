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
