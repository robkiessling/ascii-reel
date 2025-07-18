
// Note: This is in a priority order - the earlier handles are checked for mouse events before later handles
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

export const COLOR_PROPS = [
    'strokeColor',
    'fillColor',
    'textColor',
]
export const TRANSLATABLE_PROPS = [
    'topLeft'
]

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
