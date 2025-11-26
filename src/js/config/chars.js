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
 * Layers start out empty (transparent) by default and can have shapes or text drawn on top of them.
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
