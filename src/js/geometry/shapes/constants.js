
// Note: This is in a priority order - the earlier handles are checked for mouse events before later handles
import {transformObject, transformValues} from "../../utils/objects.js";
import Color from "@sphinxxxx/color-conversion";

export const HANDLE_TYPES = {
    VERTEX: 'vertex',
    EDGE: 'edge',
    CELL: 'cell',
    BODY: 'body',
    CARET: 'caret'
}

/**
 * @typedef {'char' | 'word' | 'paragraph'} CaretSelectionMode
 */
/**
 * Modes for caret selection granularity.
 */
export const CARET_HANDLE_SELECTION_MODES = {
    CHAR: 'char',
    WORD: 'word',
    PARAGRAPH: 'paragraph',
};

export const VERTEX_CORNERS = {
    TOP_LEFT_CORNER: 'top-left-corner',
    TOP_RIGHT_CORNER: 'top-right-corner',
    BOTTOM_LEFT_CORNER: 'bottom-left-corner',
    BOTTOM_RIGHT_CORNER: 'bottom-right-corner'
}
export const EDGE_SIDES = {
    TOP_EDGE: 'top-edge',
    LEFT_EDGE: 'left-edge',
    RIGHT_EDGE: 'right-edge',
    BOTTOM_EDGE: 'bottom-edge'
}

export const REORDER_ACTIONS = {
    BRING_TO_FRONT: "bringToFront",
    BRING_FORWARD: "bringForward",
    SEND_BACKWARD: "sendBackward",
    SEND_TO_BACK: "sendToBack",
}


export const SHAPE_TYPES = {
    FREEFORM: 'freeform',
    RECT: 'rect',
    LINE: 'line',
    ELLIPSE: 'ellipse',
    TEXTBOX: 'textbox'
}

// TODO Are these called stroke or strokeStyle?
export const STROKE_STYLE_PROPS = {
    [SHAPE_TYPES.FREEFORM]: 'freeformStroke',
    [SHAPE_TYPES.RECT]: 'rectStroke',
    [SHAPE_TYPES.LINE]: 'lineStroke',
    [SHAPE_TYPES.ELLIPSE]: 'ellipseStroke',
}

export const STROKE_STYLE_OPTIONS = {
    [SHAPE_TYPES.FREEFORM]: {
        IRREGULAR_ADAPTIVE: 'irregular-adaptive',
        IRREGULAR_MONOCHAR: 'irregular-monochar',
    },
    [SHAPE_TYPES.RECT]: {
        OUTLINE_ASCII_1: 'outline-ascii-1',
        OUTLINE_ASCII_2: 'outline-ascii-2',
        OUTLINE_UNICODE_1: 'outline-unicode-1',
        OUTLINE_UNICODE_2: 'outline-unicode-2',
        OUTLINE_MONOCHAR: 'outline-monochar',
    },
    [SHAPE_TYPES.LINE]: {
        STRAIGHT_ADAPTIVE: 'straight-adaptive',
        STRAIGHT_MONOCHAR: 'straight-monochar',
    },
    [SHAPE_TYPES.ELLIPSE]: {
        OUTLINE_MONOCHAR: 'outline-monochar',
    }
}

export const BRUSH_PROP = 'brush';

export const BRUSH_TYPES = {
    PIXEL_PERFECT: 'pixelPerfect',
    SQUARE: 'square',
    DIAMOND: 'diamond',
}
export const BRUSHES = {
    'pixel-perfect': { type: BRUSH_TYPES.PIXEL_PERFECT },
    'square-1': { type: BRUSH_TYPES.SQUARE, size: 1 },
    'square-2': { type: BRUSH_TYPES.SQUARE, size: 2 },
    'square-3': { type: BRUSH_TYPES.SQUARE, size: 3 },
    'square-5': { type: BRUSH_TYPES.SQUARE, size: 5 },
    'square-10': { type: BRUSH_TYPES.SQUARE, size: 10 },
    'diamond-3': { type: BRUSH_TYPES.DIAMOND, size: 3 },
    'diamond-5': { type: BRUSH_TYPES.DIAMOND, size: 5 },
    'diamond-10': { type: BRUSH_TYPES.DIAMOND, size: 10 },
}

export const AUTO_TEXT_WIDTH_PROP = 'autoTextWidth';

export const FILL_PROP = 'fill';
export const FILL_OPTIONS = {
    EMPTY: 'empty',
    WHITESPACE: 'whitespace',
    MONOCHAR: 'monochar',
}

export const ARROWHEAD_PROP = 'arrowhead';
export const ARROWHEAD_OPTIONS = {
    NONE: 'none',
    START: 'start',
    END: 'end',
    START_AND_END: 'startAndEnd'
}

export const CHAR_PROP = 'char';
export const COLOR_PROP = 'color'; // todo rename COLOR_INDEX_PROP/'colorIndex'?
export const COLOR_STR_PROP = 'colorString';

export const TEXT_PROP = 'text';

export const TEXT_ALIGN_H_PROP = 'textAlignH';
export const TEXT_ALIGN_V_PROP = 'textAlignV';
export const TEXT_PADDING_PROP = 'textPadding';
export const TEXT_OVERFLOW_PROP = 'textOverflow';

export const TEXT_ALIGN_H_OPTS = {
    LEFT: 'alignLeft',
    CENTER: 'alignCenter',
    RIGHT: 'alignRight',
}
export const TEXT_ALIGN_V_OPTS = {
    TOP: 'alignTop',
    MIDDLE: 'alignMiddle',
    BOTTOM: 'alignBottom',
}

// ------------------------------------------------------ Prop bundles

export const DEFAULT_DRAW_PROPS = {
    ...transformObject(STROKE_STYLE_OPTIONS, (shapeType, options) => [STROKE_STYLE_PROPS[shapeType], Object.values(options)[0]]),
    [BRUSH_PROP]: Object.keys(BRUSHES)[0],
    [FILL_PROP]: Object.values(FILL_OPTIONS)[0],
    [CHAR_PROP]: 'A',
    [COLOR_STR_PROP]: new Color('rgba(0,0,0,1)').hex, // todo this should use DEFAULT_COLOR, once we move that to a constants file
    [TEXT_PROP]: '',
    [TEXT_ALIGN_H_PROP]: TEXT_ALIGN_H_OPTS.CENTER,
    [TEXT_ALIGN_V_PROP]: TEXT_ALIGN_V_OPTS.MIDDLE
};

/**
 * A list of linked property rules used to enforce consistency between shape props. This is useful when one prop
 * being set to a particular value should force another prop to another particular value.
 * @type {[{when: {prop: string, value: string}, enforce: {prop: string, value: string}}]}
 */
export const LINKED_PROPS = [
    // freeform's adaptive stroke requires pixel-perfect brush:
    {
        when: { prop: STROKE_STYLE_PROPS[SHAPE_TYPES.FREEFORM], value: STROKE_STYLE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_ADAPTIVE },
        enforce: { prop: BRUSH_PROP, value: 'pixel-perfect' }
    }
]




// Drawing

export const SHAPE_OUTLINE_WIDTH = 2;
export const SHAPE_BOX_PADDING = 2;
export const SHAPE_DASHED_OUTLINE_LENGTH = 5;
export const HANDLE_CORNER_SIZE = 8;
export const HANDLE_CORNER_RADIUS = 2;
export const HANDLE_CELL_RADIUS = 5;


// Shape text modification actions
export const SHAPE_TEXT_ACTIONS = {
    INSERT: 'insert',
    DELETE_BACKWARD: 'deleteBackward',
    DELETE_FORWARD: 'deleteForward',
    DELETE_RANGE: 'deleteRange',
    REPLACE: 'replace'
}