
// Format: { key: 'x', modifiers: ['altKey', 'shiftKey'] } // modifiers are optional
// If value is an array, that means the action has multiple shortcuts. The first element is displayed as the abbr.
import {isMacOS} from "../utils/os.js";

const cmdKey = isMacOS() ? 'metaKey' : 'ctrlKey';

export const actionIdToShortcut = {
    'file.open': { key: 'o', modifiers: [cmdKey] },
    'file.export-as': { key: 'e', modifiers: [cmdKey] },
    'file.export-active': { key: 'e', modifiers: [cmdKey, 'shiftKey'] },

    // Note: file.save is not shown in toolbar anywhere, it actually ends up calling either file.saveTo or file.saveAs
    'file.save': { key: 's', modifiers: [cmdKey] },

    'clipboard.cut': { key: 'x', modifiers: [cmdKey] },
    'clipboard.copy': { key: 'c', modifiers: [cmdKey] },
    'clipboard.paste': { key: 'v', modifiers: [cmdKey] },
    'clipboard.paste-in-selection': { key: 'v', modifiers: [cmdKey, 'shiftKey'] },

    'selection.select-all': { key: 'a', modifiers: [cmdKey] },

    'state.undo': { key: 'z', modifiers: [cmdKey] },
    'state.redo': { key: 'z', modifiers: [cmdKey, 'shiftKey'] },

    'frames.new-frame': { key: 'f', modifiers: [cmdKey, 'shiftKey'] }, // Not using 'n' since that is reserved for new window
    'frames.duplicate-frame': { key: 'd', modifiers: [cmdKey, 'shiftKey'] },
    'frames.delete-frame': [
        { key: 'Delete', modifiers: [cmdKey] },
        { key: 'Backspace', modifiers: [cmdKey] }
    ],
    'frames.toggle-onion': { key: 'o', modifiers: [cmdKey, 'shiftKey'] },
    'frames.previous-frame': { key: ',' },
    'frames.next-frame': { key: '.' },
    'frames.toggle-component': { key: "'" },

    'layers.previous-layer': { key: '[', modifiers: ['altKey'] },
    'layers.next-layer': { key: ']', modifiers: ['altKey'] },

    'view.toggle-grid': { key: 'g', modifiers: [cmdKey, 'shiftKey'] },
    'view.toggle-whitespace': { key: 'p', modifiers: [cmdKey, 'shiftKey'] },
    'view.zoom-in': { displayKey: '+', key: '=', modifiers: [cmdKey] },
    'view.zoom-out': { displayKey: '-', key: '-', modifiers: [cmdKey] },
    'view.zoom-default': { key: '0', modifiers: [cmdKey] },

    // todo 's' and 'f' could toggle shape's stroke/fill?
    'tools.standard.select': { key: 'v' },
    'tools.standard.text-editor': { key: 'v' },
    'tools.standard.eraser': { key: 'e' },
    'tools.standard.draw-line': { key: 'l' },
    'tools.standard.draw-rect': { key: 'r' },
    'tools.standard.draw-ellipse': { key: 'o' },
    'tools.standard.draw-diamond': { key: 'd' },
    'tools.standard.draw-textbox': { key: 't' },
    'tools.standard.draw-freeform': { key: 'p' },
    'tools.standard.fill-char': { key: 'k' },
    'tools.standard.selection-rect': { key: 'm' },
    'tools.standard.pan': { key: 'h' },
    'tools.standard.paint-brush': { key: 'b' },
    'tools.shapes.charPicker': { key: 'c' },
    'tools.shapes.quickSwapChar': { key: 'w' },

    'tools.shapes.sendToBack': { key: '[', modifiers: [cmdKey, 'altKey'] },
    'tools.shapes.sendBackward': { key: '[', modifiers: [cmdKey] },
    'tools.shapes.bringForward': { key: ']', modifiers: [cmdKey] },
    'tools.shapes.bringToFront': { key: ']', modifiers: [cmdKey, 'altKey'] },

    'sidebar.toggle-component': { key: ']' },

    // 'themes.select.light-mode': { key: 'l' },
    // 'themes.select.dark-mode': { key: 'k' },
    // 'themes.select.system': { key: 'j' },
};


// The following browser shortcuts will always be prevented. Note: some shortcuts like cmd-N cannot be prevented.
export const PREVENT_DEFAULT_BROWSER_SHORTCUTS = new Set([
    // Preventing normal browser zoom in/out since we use these same keys to zoom in/out of the canvas. Normally our
    // own shortcut already prevents normal browser behavior, but if the canvas is zoomed all the way in/out our action
    // will actually be disabled, meaning our shortcut does not prevent default browser behavior.
    '-', '=', '0',

    // Cmd-[ and Cmd-] usually cause the browser to navigate forward/back. We prevent that since we use variations
    // of these commands and don't want the user accidentally navigating back as they use our commands.
    '[', ']',
])
