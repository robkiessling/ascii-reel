
export const strings = {
    'file.new.name': 'New File',
    'file.open.name': 'Open File',
    'file.save-as.name': 'Save to...',
    'file.save-active.name': 'Save to Current File',
    'file.export-as.name': 'Export to...',
    'file.export-active.name': 'Export to Current File',
    'file.save-warning': 'Opening a new file will replace your existing content.\n' +
        'Click \'Save\' if you want to back up your drawing first.',
    'file.save-warning-cleared': 'Your current file has been saved. You may proceed to opening a new file.',
    'file.cannot-rename-active-file.name': 'Cannot rename disk file',
    'file.cannot-rename-active-file.description': 'This file exists on your computer and cannot be renamed from the browser. ' +
        'To rename it, save a copy with a new name and manually delete the original file.',
    'file.active-file-info.name': 'Linked to Disk File',
    'file.active-file-info.description': 'Saving will directly update the linked file on your computer.',

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
    'view.show-whitespace.name': 'Show Whitespace',
    'view.hide-whitespace.name': 'Hide Whitespace',
    'view.zoom-in.name': 'Zoom In',
    'view.zoom-out.name': 'Zoom Out',
    'view.zoom-fit.name': 'Zoom Fit',

    'settings.open-font-dialog.name': 'Font Settings',
    'settings.open-resize-dialog.name': 'Resize Canvas',
    'settings.open-background-dialog.name': 'Background Settings',

    'theme.system.name': 'System Default',
    'theme.light.name': 'Light',
    'theme.dark.name': 'Dark',

    'tools.standard.text-editor.name': 'Text Editor',
    'tools.standard.text-editor.description': 'Functions similarly to a normal text editing program.\n\n' +
        'Click to place your cursor, then type to enter text characters. Click and drag to highlight text. ',
    'tools.standard.eraser.name': 'Eraser',
    'tools.standard.eraser.description': 'Click and drag to remove characters.',
    'tools.standard.draw-freeform-char.name': 'Freeform Character Line',
    'tools.standard.draw-freeform-char.description': 'Draw a freeform line using the selected character. Press any key to change the character.',
    'tools.standard.fill-char.name': 'Fill Character',
    // 'tools.standard.fill-char.description': 'Fill a connected area of matching characters with the selected character. Press any key to change the character.',
    // 'tools.standard.fill-char.diagonal': 'Include diagonally connected cells',
    // 'tools.standard.fill-char.colorblind': 'Include connected cells regardless of color',
    'tools.standard.fill-char.description': 'Fill an area with the selected character. Press any key to change the character.',
    'tools.standard.fill-char.diagonal': 'Fills across diagonal connections',
    'tools.standard.fill-char.colorblind': 'Fills connected cells regardless of color',
    'tools.standard.draw-rect.name': 'ASCII Rectangle',
    'tools.standard.draw-rect.description': 'Draw a rectangle out of autogenerated ASCII characters.',
    'tools.standard.draw-line.name': 'Straight ASCII Line',
    'tools.standard.draw-line.description': 'Draw a straight line out of autogenerated ASCII characters.',
    'tools.standard.draw-freeform-ascii.name': 'Freeform ASCII Line',
    'tools.standard.draw-freeform-ascii.description': 'Draw a freeform line out of autogenerated ASCII characters.',
    'tools.standard.selection.multiple': 'Create multiple selections',
    'tools.standard.selection-rect.name': 'Rectangle Selection',
    'tools.standard.selection-rect.description': 'Select a rectangular area to move, copy, or modify. ' +
        'After a selection has been made, press any key to fill the selection with that character.',
    'tools.standard.selection-rect.outline': 'Only select rectangle outline',
    'tools.standard.selection-line.name': 'Line Selection',
    'tools.standard.selection-line.description': 'Select a linear area to move, copy, or modify. ' +
        'After a selection has been made, press any key to fill the selection with that character.',
    'tools.standard.selection-lasso.name': 'Lasso Selection',
    'tools.standard.selection-lasso.description': 'Select an irregular area to move, copy, or modify. ' +
        'After a selection has been made, press any key to fill the selection with that character.',
    'tools.standard.selection-wand.name': 'Shape Selection',
    'tools.standard.selection-wand.description': 'Select a connected area of matching colors. ',
    'tools.standard.selection-wand.diagonal': 'Include diagonally connected cells',
    'tools.standard.selection-wand.colorblind': 'Include connected cells regardless of color',
    'tools.standard.pan.name': 'Pan',
    'tools.standard.pan.description': 'Click and drag to pan the view.',
    'tools.standard.move-all.name': 'Move All Content',
    'tools.standard.move-all.description': 'Click and drag to move all canvas content.',
    'tools.standard.move-all.all-layers': 'Apply to all layers',
    'tools.standard.move-all.all-frames': 'Apply to all frames',
    'tools.standard.move-all.wrap': 'Wrap canvas borders',
    'tools.standard.paint-brush.name': 'Paint Brush',
    'tools.standard.paint-brush.description': 'Click and drag to color cells with the selected color.',
    'tools.standard.fill-color.name': 'Fill Color',
    'tools.standard.fill-color.description': 'Fill a connected area of matching colors with the selected color.',
    'tools.standard.fill-color.diagonal': 'Include diagonally connected cells',
    'tools.standard.fill-color.colorblind': 'Include connected cells regardless of color',
    'tools.standard.color-swap.name': 'Color Swap',
    'tools.standard.color-swap.description': 'Click on a cell to replace all instances of that cell\'s color with the selected color.',
    'tools.standard.color-swap.all-layers': 'Apply to all layers',
    'tools.standard.color-swap.all-frames': 'Apply to all frames',
    'tools.standard.eyedropper.name': 'Eyedropper',
    'tools.standard.eyedropper.description': 'Click on a cell to put its color in the color picker.',
    'tools.standard.eyedropper.add-to-palette': 'Also add the color to the current palette.',

    'tools.selection.move.name': 'Move Selected Content',
    'tools.selection.move.description': 'When activated, clicking and dragging on the selected area will move the content.',
    'tools.selection.typewriter.name': 'Type Within Selection',
    'tools.selection.typewriter.description': 'When activated, content can be typed into the selection one character at a time. ' +
        'The cursor can be moved with the arrow keys, and will wrap when it reaches the end of the selection.',
    'tools.selection.flip-v.name': 'Flip Vertically',
    'tools.selection.flip-v.description': 'Mirrors the selected content vertically.',
    'tools.selection.flip-v.mirror': 'Mirrors characters when possible, e.g. b => p',
    'tools.selection.flip-h.name': 'Flip Horizontally',
    'tools.selection.flip-h.description': 'Mirrors the selected content horizontally.',
    'tools.selection.flip-h.mirror': 'Mirrors characters when possible, e.g. b => d',
    'tools.selection.clone.name': 'Clone Selection',
    'tools.selection.clone.description': 'Clones the current selection to all frames.',
    'tools.selection.fill-color.name': 'Paint Selection',
    'tools.selection.fill-color.description': 'Paints the selected area with the current color.',
    'tools.selection.resize.name': 'Resize Canvas',
    'tools.selection.resize.description': 'Resizes the canvas to match the selected area.',
    'tools.selection.close.name': 'Close',
    'tools.selection.close.description': 'Closes the current selection.',

    'tools.draw-rect-types.printable-ascii-1.name': 'Characters: /---\\',
    'tools.draw-rect-types.printable-ascii-1.description': 'Uses only basic ASCII characters.',
    'tools.draw-rect-types.printable-ascii-2.name': 'Characters: +---+',
    'tools.draw-rect-types.printable-ascii-2.description': 'Uses only basic ASCII characters.',
    'tools.draw-rect-types.single-line.name': 'Characters: ┌───┐',
    'tools.draw-rect-types.single-line.description': 'Uses extended ASCII characters.',
    'tools.draw-rect-types.double-line.name': 'Characters: ╔═══╗',
    'tools.draw-rect-types.double-line.description': 'Uses extended ASCII characters.',
    'tools.draw-line-types.basic.name': 'Basic Line',
    'tools.draw-line-types.basic.description': 'Uses only basic ASCII characters.',

    'frames.new-frame.name': 'New Frame',
    'frames.new-frame.description': 'Creates a new blank frame.',
    'frames.duplicate-frame.name': 'Duplicate Frame',
    'frames.duplicate-frame.description': 'Duplicates the currently selected frame(s).',
    'frames.delete-frame.name': 'Delete Frame',
    'frames.delete-frame.description': 'Deletes the currently selected frame(s).',
    'frames.toggle-onion.name': 'Toggle Onion',
    'frames.toggle-onion.description': 'When enabled, the previous frame will be faintly displayed.',
    'frames.show-component.name': 'Maximize',
    'frames.show-component.description': 'Shows the frames component.',
    'frames.hide-component.name': 'Minimize',
    'frames.hide-component.description': 'Hides the frames component.',
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
    'palette.sort-colors.description': 'Click to change sorting method.',
    'palette.delete-color.name': 'Delete Color',
    'palette.delete-color.description': 'Removes the selected color from your palette. This does not affect characters already using the color.',
    'palette.open-settings.name': 'Palette Settings',
    'palette.open-settings.description': 'TODO',

    'unicode.information.name': 'Character Reference',
    'unicode.information.description': 'The following table provides quick access to several extended ASCII characters. ' +
        'These characters are not technically ASCII, but can be useful if you are not strictly limited to the 128 ASCII characters.\n\n' +
        'Click on a character below to copy it to your clipboard. ' +
        'This can also have additional effects depending on your current tool:\n' +
        '- Text Editor: Pastes the character once\n' +
        '- Freeform Character Line: Sets the character\n' +
        '- Character Fill: Sets the character\n' +
        '- Selections: Fill selected areas with the character',

    'warnings.current-layer-not-visible': 'The current layer is not visible!'
}
