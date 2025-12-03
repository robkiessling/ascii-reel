
// Note: This order determines the order tools appear in the toolbar
export const TOOLS = [
    { value: 'select', vector: true, group: 'mouse' },
    { value: 'text-editor', raster: true, group: 'mouse' },
    { value: 'pan', group: 'mouse' },
    { value: 'move-all', group: 'mouse' },

    { value: 'draw-rect' },
    { value: 'draw-diamond' },
    { value: 'draw-ellipse' },
    { value: 'draw-line' },

    { value: 'draw-freeform', },
    { value: 'draw-textbox', vector: true, rasterFallback: 'fill-char'},
    { value: 'fill-char', raster: true, vectorFallback: 'draw-textbox' },
    { value: 'eraser', },

    { value: 'selection-rect', group: 'selection', raster: true },
    { value: 'selection-lasso', group: 'selection', raster: true },
    { value: 'selection-line', group: 'selection', raster: true },
    { value: 'selection-wand', group: 'selection', raster: true },
    
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
