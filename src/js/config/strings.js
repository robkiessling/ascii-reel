
export const strings = {
    'file.new-file.name': 'New File',
    'file.open-file.name': 'Open File',
    'file.save-file.name': 'Save File',
    'file.export-file.name': 'Export To...',

    'clipboard.cut.name': 'Cut',
    'clipboard.copy.name': 'Copy',
    'clipboard.paste.name': 'Paste',
    'clipboard.paste-in-selection.name': 'Paste In Selection',

    'selection.select-all.name': 'Select All',

    'state.undo.name': 'Undo',
    'state.redo.name': 'Redo',
    
    'view.grid-settings.name': 'Grid Settings',
    'view.show-grid.name': 'Show Grid',
    'view.hide-grid.name': 'Hide Grid',
    'view.zoom-in.name': 'Zoom In',
    'view.zoom-out.name': 'Zoom Out',
    'view.zoom-fit.name': 'Zoom Fit',

    'settings.open-font-dialog.name': 'Font Settings',
    'settings.open-resize-dialog.name': 'Resize Canvas',
    'settings.open-background-dialog.name': 'Background Settings',

    'editor.tools.text-editor.name': 'Text Editor Tool',
    'editor.tools.text-editor.description': 'Click to place your cursor, then type to enter text characters. Click and drag to highlight text.',
    'editor.tools.eraser.name': 'Eraser Tool',
    'editor.tools.eraser.description': 'Click and drag to remove characters.',
    'editor.tools.draw-freeform.name': 'Draw Character Tool',
    'editor.tools.draw-freeform.description': 'Click and drag to continuously draw the chosen character. Type a key to change the character.',
    'editor.tools.draw-rect.name': 'Draw Rectangle Tool',
    'editor.tools.draw-rect.description': 'Click and drag to draw a rectangle out of ASCII characters.',
    'editor.tools.draw-line.name': 'Draw Line Tool',
    'editor.tools.draw-line.description': 'Click and drag to draw a line out of ASCII characters.',
    'editor.tools.selection.multiple': 'Create multiple selections',
    'editor.tools.selection-rect.name': 'Rectangle Selection',
    'editor.tools.selection-rect.description': 'Click and drag to select a rectangular area.',
    'editor.tools.selection-rect.outline': 'Only select rectangle outline',
    'editor.tools.selection-line.name': 'Line Selection',
    'editor.tools.selection-line.description': 'Click and drag to select a linear area.',
    'editor.tools.selection-lasso.name': 'Lasso Selection',
    'editor.tools.selection-lasso.description': 'Click and drag to select an irregular area.',
    'editor.tools.selection-wand.name': 'Shape Selection',
    'editor.tools.selection-wand.description': 'Click on a cell to select it and all connected cells of the same color.',
    'editor.tools.selection-wand.colorblind': 'Include connected cells regardless of color',
    'editor.tools.paint-brush.name': 'Paint Brush Tool',
    'editor.tools.paint-brush.description': 'Click and drag to paint cells.',
    'editor.tools.paint-bucket.name': 'Paint Bucket Tool',
    'editor.tools.paint-bucket.description': 'Paints all connected cells that share the same color.',
    'editor.tools.paint-bucket.colorblind': 'Paints all connected cells regardless of color',
    'editor.tools.color-swap.name': 'Color Swap Tool',
    'editor.tools.color-swap.description': 'Paints all cells that share the same color.',
    'editor.tools.color-swap.all-layers': 'Apply to all layers',
    'editor.tools.color-swap.all-frames': 'Apply to all frames',
    'editor.tools.eyedropper.name': 'Eyedropper Tool',
    'editor.tools.eyedropper.description': 'Click on a cell to put its color in the color picker.',
    'editor.tools.eyedropper.add-to-palette': 'Add the color to the current palette.',

    'editor.selection.move.name': 'Move Selected Content',
    'editor.selection.move.description': 'When activated, clicking and dragging on the selected area will move the content.',
    'editor.selection.typewriter.name': 'Type Within Selection',
    'editor.selection.typewriter.description': 'When activated, content can be typed into the selection one character at a time. ' +
        'The cursor can be moved with the arrow keys, and will wrap when it reaches the end of the selection.' +
        '\n\nNote: When not activated (i.e. the default), typing a character will fill the entire selection with that character.',
    // 'editor.selection.typewriter.description': 'Normally, typing any character will fill the entire selection with that character. ' +
    //     '\n\nHowever, when Type Within Selection is activated, content can be typed into the selection one character at a time. ' +
    //     'The cursor can be moved with the arrow keys, and will wrap when it reaches the end of the selection.',
    'editor.selection.flip-v.name': 'Flip Vertically',
    'editor.selection.flip-v.description': 'Mirrors the selected content vertically.',
    'editor.selection.flip-v.mirror': 'Mirrors characters when possible, e.g. b => p',
    'editor.selection.flip-h.name': 'Flip Horizontally',
    'editor.selection.flip-h.description': 'Mirrors the selected content horizontally.',
    'editor.selection.flip-h.mirror': 'Mirrors characters when possible, e.g. b => d',
    'editor.selection.clone.name': 'Clone Selection',
    'editor.selection.clone.description': 'Clones the current selection to all frames.',
    'editor.selection.paint-bucket.name': 'Paint Selection',
    'editor.selection.paint-bucket.description': 'Paints the selected area with the current color.',
    'editor.selection.resize.name': 'Resize Canvas',
    'editor.selection.resize.description': 'Resizes the canvas to match the selected area.',
    'editor.selection.close.name': 'Close',
    'editor.selection.close.description': 'Closes the current selection.',

    'editor.draw-rect-types.printable-ascii-1.name': 'Characters: /---\\',
    'editor.draw-rect-types.printable-ascii-1.description': 'Uses only basic ASCII characters.',
    'editor.draw-rect-types.printable-ascii-2.name': 'Characters: +---+',
    'editor.draw-rect-types.printable-ascii-2.description': 'Uses only basic ASCII characters.',
    'editor.draw-rect-types.single-line.name': 'Characters: ┌───┐',
    'editor.draw-rect-types.single-line.description': 'Uses extended ASCII characters.',
    'editor.draw-rect-types.double-line.name': 'Characters: ╔═══╗',
    'editor.draw-rect-types.double-line.description': 'Uses extended ASCII characters.',

    'editor.draw-line-types.basic.name': 'Basic Line',
    'editor.draw-line-types.basic.description': 'Uses only basic ASCII characters.',

    'frames.new-frame.name': 'New Frame',
    'frames.new-frame.description': 'Creates a new blank frame.',
    'frames.duplicate-frame.name': 'Duplicate Frame',
    'frames.duplicate-frame.description': 'Duplicates the currently selected frame(s).',
    'frames.delete-frame.name': 'Delete Frame',
    'frames.delete-frame.description': 'Deletes the currently selected frame(s).',
    'frames.toggle-onion.name': 'Toggle Onion',
    'frames.toggle-onion.description': 'When enabled, the previous frame will be faintly displayed.',
    'frames.align-left.name': 'Align Frames: Left',
    'frames.align-left.description': 'Positions the frames on the left side of the screen.',
    'frames.align-bottom.name': 'Align Frames: Bottom',
    'frames.align-bottom.description': 'Positions the frames on the bottom of the screen.',
    'frames.previous-frame.name': 'Previous Frame',
    'frames.next-frame.name': 'Next Frame',

    'layers.add-layer.name': 'Add Layer',
    'layers.add-layer.description': 'Creates a new layer.',
    'layers.edit-layer.name': 'Edit Layer',
    'layers.edit-layer.description': 'Edit the current layer\'s name. Layers can also be reordered by clicking and dragging them.',
    'layers.delete-layer.name': 'Delete Layer',
    'layers.delete-layer.description': 'Deletes the current layer.',
    'layers.toggle-visibility-lock.name': 'Toggle Layer Visibility',
    'layers.toggle-visibility-lock.description': 'When locked, only the current layer is shown in the main canvas. When unlocked, you can manually show/hide all layers.',

    'preview.open-popup.description': 'Open preview in popup',

    'palette.sort-colors.name.date-added': 'Sorting By: Date Added',
    'palette.sort-colors.name.hue': 'Sorting By: Hue',
    'palette.sort-colors.name.saturation': 'Sorting By: Saturation',
    'palette.sort-colors.name.lightness': 'Sorting By: Lightness',
    'palette.sort-colors.name.alpha': 'Sorting By: Alpha',
    'palette.delete-color.name': 'Delete Color',
    'palette.delete-color.description': 'Removes the selected color from your palette. This does not affect characters already using the color.',
    'palette.open-settings.name': 'Palette Settings',
    'palette.open-settings.description': 'TODO',

    'unicode.information.name': 'Extended ASCII Helper',
    'unicode.information.description': 'The following table provides quick access to several Extended ASCII characters. ' +
        'These characters are not technically ASCII, but can be helpful if you are not limited to the 128 Standard ASCII characters.\n\n' +
        'Click on a character below to copy it to your clipboard. ' +
        'It can also have additional effects depending on your current tool:\n' +
        '- Text Editor Tool: Pastes the character once\n' +
        '- Draw Character Tool: Sets the character\n' +
        '- Selections: Fill selected areas with the character',

    // 'unicode.information.name': 'Unicode Helper',
    // 'unicode.information.description': 'The following table provides quick access to several Unicode characters. ' +
    //     'These characters are not ASCII, but can be helpful if you are not limited to the 128 printable ASCII characters.\n\n' +
    //     'Click on a Unicode character below to copy it to your clipboard. ' +
    //     'It can also have additional effects depending on your current tool:\n' +
    //     '- Text Editor Tool: Pastes the character once\n' +
    //     '- Draw Character Tool: Sets the character\n' +
    //     '- Selections: Fill selected areas with the character',
}
