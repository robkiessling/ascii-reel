
// Note: This is in a priority order - the earlier handles are checked for mouse events before later handles
import {transformValues} from "../../utils/objects.js";

export const HANDLE_TYPES = {
    VERTEX: 'vertex',
    EDGE: 'edge',
    CELL: 'cell',
    BODY: 'body',
}
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
}

export const STROKE_PROPS = {
    [SHAPE_TYPES.FREEFORM]: 'freeformStroke',
    [SHAPE_TYPES.RECT]: 'rectStroke',
    [SHAPE_TYPES.LINE]: 'lineStroke',
    [SHAPE_TYPES.ELLIPSE]: 'ellipseStroke',
}

export const STROKE_OPTIONS = {
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
        ELBOW_LINE_ASCII_VH: 'elbow-line-ascii-vh',
        ELBOW_LINE_ASCII_HV: 'elbow-line-ascii-hv',
        ELBOW_LINE_UNICODE_VH: 'elbow-line-unicode-vh',
        ELBOW_LINE_UNICODE_HV: 'elbow-line-unicode-hv',
        ELBOW_LINE_MONOCHAR_VH: 'elbow-line-monochar-vh',
        ELBOW_LINE_MONOCHAR_HV: 'elbow-line-monochar-hv',
    },
    [SHAPE_TYPES.ELLIPSE]: {
        OUTLINE_MONOCHAR: 'outline-monochar',
    }
}

export const DEFAULT_STROKES = transformValues(STROKE_OPTIONS, (k, v) => Object.values(v)[0])

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
export const COLOR_PROP = 'color';

export const TEXT_PROP = 'text';

export const TEXT_ALIGN_H_PROP = 'textAlignH';
export const TEXT_ALIGN_V_PROP = 'textAlignV';

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

export const SHARED_SHAPE_PROPS = [
    ...Object.values(STROKE_PROPS),
    FILL_PROP,
    CHAR_PROP, 
    COLOR_PROP,
    TEXT_PROP,
    TEXT_ALIGN_H_PROP,
    TEXT_ALIGN_V_PROP
]; // todo textPadding

export const BRUSH_TYPES = {
    SQUARE: 'square',
    CIRCLE: 'circle',
}
export const BRUSHES = {
    'square-1': { type: BRUSH_TYPES.SQUARE, size: 1 },
    'square-2': { type: BRUSH_TYPES.SQUARE, size: 2 },
    'square-3': { type: BRUSH_TYPES.SQUARE, size: 3 },
    'square-5': { type: BRUSH_TYPES.SQUARE, size: 5 },
    'square-10': { type: BRUSH_TYPES.SQUARE, size: 10 },
    'circle-3': { type: BRUSH_TYPES.CIRCLE, size: 3 },
    'circle-5': { type: BRUSH_TYPES.CIRCLE, size: 5 },
    'circle-10': { type: BRUSH_TYPES.CIRCLE, size: 10 },
}


// Drawing

export const SHAPE_OUTLINE_WIDTH = 2;
export const SHAPE_BOX_PADDING = 2;
export const SHAPE_DASHED_OUTLINE_LENGTH = 5;
export const HANDLE_CORNER_SIZE = 8;
export const HANDLE_CORNER_RADIUS = 2;
export const HANDLE_CELL_RADIUS = 5;
