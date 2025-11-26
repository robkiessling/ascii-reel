
// Note: This order determines the order tools appear in the toolbar
export const TOOLS = [
    { value: 'select', group: 'Mouse', vector: true },
    { value: 'text-editor', group: 'Mouse', raster: true },
    { value: 'pan', group: 'Mouse' },
    { value: 'move-all', group: 'Mouse' },

    { value: 'draw-rect', group: 'Draw Shape' },
    { value: 'draw-diamond', group: 'Draw Shape' },
    { value: 'draw-ellipse', group: 'Draw Shape' },
    { value: 'draw-line', group: 'Draw Shape' },

    { value: 'draw-freeform', },
    { value: 'draw-textbox', vector: true, rasterFallback: 'fill-char'},
    { value: 'eraser', },
    { value: 'fill-char', raster: true, vectorFallback: 'draw-textbox' },

    { value: 'selection-rect', group: 'Selection', raster: true },
    { value: 'selection-lasso', group: 'Selection', raster: true },
    { value: 'selection-line', group: 'Selection', raster: true },
    { value: 'selection-wand', group: 'Selection', raster: true },

    { value: 'paint-brush', group: 'Color', raster: true, multicolor: true },
    { value: 'color-swap', group: 'Color', raster: true, multicolor: true },
]

// Certain tools are only available for specific layer types / color modes
export const RASTER_TOOLS = new Set(TOOLS.filter(t => t.raster).map(t => t.value));
export const VECTOR_TOOLS = new Set(TOOLS.filter(t => t.vector).map(t => t.value));
export const MULTICOLOR_TOOLS = new Set(TOOLS.filter(t => t.multicolor).map(t => t.value));

// Tool fallbacks for when the current tool isn't valid for the current layer type
export const RASTER_TOOL_FALLBACKS = {
    default: 'text-editor',
    ...Object.fromEntries(TOOLS.filter(t => t.rasterFallback).map(t => [t.value, t.rasterFallback]))
};
export const VECTOR_TOOL_FALLBACKS = {
    default: 'select',
    ...Object.fromEntries(TOOLS.filter(t => t.vectorFallback).map(t => [t.value, t.vectorFallback]))
};
