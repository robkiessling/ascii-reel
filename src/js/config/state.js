import {LAYER_TYPES} from "./timeline.js";
import {BACKGROUND_MODES, COLOR_MODES} from "./colors.js";
import {DEFAULT_DRAW_PROPS} from "./shapes.js";

export const PROJECT_TYPES = {
    DRAWING: 'drawing',
    ANIMATION: 'animation',
}

// TODO There are a lot of strings that should be constants
// TODO Organize this better? E.g. projectSettings could contain certain keys
export const DEFAULT_PROJECT_CONFIG = {
    name: '',
    projectType: PROJECT_TYPES.DRAWING,
    layerType: LAYER_TYPES.RASTER,
    colorMode: COLOR_MODES.BLACK_AND_WHITE,
    createdAt: undefined,
    dimensions: [30, 60], // [numRows, numCols]
    background: BACKGROUND_MODES.MATCH_THEME,
    font: 'monospace',
    fps: 6,
    playPreview: true,
    grid: {
        show: true,
        minorGridEnabled: true,
        minorGridSpacing: 1,
        majorGridEnabled: false,
        majorGridSpacing: 5,
    },
    showWhitespace: false,
    showOnion: false,
    showTicks: false,
    lockLayerVisibility: true,
    tool: 'text-editor',
    drawProps: DEFAULT_DRAW_PROPS,
    lastExportOptions: null,
    caretStyle: 'I-beam', // vs. block
}
