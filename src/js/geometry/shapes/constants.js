
// Note: This is in a priority order - the earlier handles are checked for mouse events before later handles
import {transformValues} from "../../utils/objects.js";

export const HANDLES = {
    TOP_LEFT_CORNER: 'top-left-corner',
    TOP_RIGHT_CORNER: 'top-right-corner',
    BOTTOM_LEFT_CORNER: 'bottom-left-corner',
    BOTTOM_RIGHT_CORNER: 'bottom-right-corner',

    TOP_EDGE: 'top-edge',
    LEFT_EDGE: 'left-edge',
    RIGHT_EDGE: 'right-edge',
    BOTTOM_EDGE: 'bottom-edge',

    BODY: 'body',
}

export const TRANSLATABLE_PROPS = [
    'topLeft'
]

export const REORDER_ACTIONS = {
    BRING_TO_FRONT: "bringToFront",
    BRING_FORWARD: "bringForward",
    SEND_TO_BACK: "sendToBack",
    SEND_BACKWARD: "sendBackward"
}


export const SHAPES = {
    FREEFORM: 'freeform',
    RECT: 'rect',
    LINE: 'line',
    ELLIPSE: 'ellipse',
}
export const SHAPE_NAMES = {
    [SHAPES.FREEFORM]: 'Freeform',
    [SHAPES.RECT]: 'Rectangle',
    [SHAPES.LINE]: 'Line',
    [SHAPES.ELLIPSE]: 'Ellipse',
}
export const SHAPE_STYLES = {
    [SHAPES.FREEFORM]: {
        IRREGULAR_ADAPTIVE: 'irregular-adaptive',
        IRREGULAR_MONOCHAR: 'irregular-monochar',
    },
    [SHAPES.RECT]: {
        OUTLINE_ASCII_1: 'outline-ascii-1',
        OUTLINE_ASCII_2: 'outline-ascii-2',
        OUTLINE_UNICODE_1: 'outline-unicode-1',
        OUTLINE_UNICODE_2: 'outline-unicode-2',
        OUTLINE_MONOCHAR: 'outline-monochar',
        FILLED_MONOCHAR: 'filled-monochar',
    },
    [SHAPES.LINE]: {
        STRAIGHT_ADAPTIVE: 'straight-adaptive',
        STRAIGHT_MONOCHAR: 'straight-monochar',
        ELBOW_LINE_ASCII: 'elbow-line-ascii',
        ELBOW_ARROW_ASCII: 'elbow-arrow-ascii',
        ELBOW_LINE_UNICODE: 'elbow-line-unicode',
        ELBOW_ARROW_UNICODE: 'elbow-arrow-unicode',
        ELBOW_LINE_MONOCHAR: 'elbow-line-monochar',
    },
    [SHAPES.ELLIPSE]: {
        OUTLINE_MONOCHAR: 'outline-monochar',
        FILLED_MONOCHAR: 'filled-monochar',
    }
}
export const DEFAULT_SHAPE_STYLES = transformValues(SHAPE_STYLES, (k, v) => Object.values(v)[0])

export const CHAR_PROP = 'char';
export const COLOR_PROP = 'color';
export const STYLE_PROPS = {
    [SHAPES.FREEFORM]: 'freeformStyle',
    [SHAPES.RECT]: 'rectStyle',
    [SHAPES.LINE]: 'lineStyle',
    [SHAPES.ELLIPSE]: 'ellipseStyle',
}

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
    ...Object.values(STYLE_PROPS), 
    CHAR_PROP, 
    COLOR_PROP,
    TEXT_PROP,
    TEXT_ALIGN_H_PROP,
    TEXT_ALIGN_V_PROP
]; // todo textPadding


// switch(handle) {
//     case HANDLES.TOP_LEFT:
//         break;
//     case HANDLES.TOP_CENTER:
//         break;
//     case HANDLES.TOP_RIGHT:
//         break;
//     case HANDLES.CENTER_LEFT:
//         break;
//     case HANDLES.CENTER_CENTER:
//         break;
//     case HANDLES.CENTER_RIGHT:
//         break;
//     case HANDLES.BOTTOM_LEFT:
//         break;
//     case HANDLES.BOTTOM_CENTER:
//         break;
//     case HANDLES.BOTTOM_RIGHT:
//         break;
//     default:
//         throw new Error(`Invalid handle: ${handle}`);
// }
