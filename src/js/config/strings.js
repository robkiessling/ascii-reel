
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
    'tools.standard.text-editor.description': 'Use this tool to edit text directly on the canvas.\n\n' +
        'Click to place the cursor and start typing. Click and drag to select text for copying, moving, or applying transformations.',
    'tools.standard.eraser.name': 'Eraser',
    'tools.standard.eraser.description': 'Click and drag to remove characters.',
    'tools.standard.fill-char.name': 'Fill Character',
    // 'tools.standard.fill-char.description': 'Fill a connected area of matching characters with the selected character.',
    // 'tools.standard.fill-char.diagonal': 'Include diagonally connected cells',
    // 'tools.standard.fill-char.colorblind': 'Include connected cells regardless of color',
    'tools.standard.fill-char.description': 'Fill an area with the selected character.',
    'tools.standard.fill-char.diagonal': 'Fills across diagonal connections',
    'tools.standard.fill-char.colorblind': 'Fills connected cells regardless of color',
    'tools.standard.draw-freeform.name': 'Draw Freeform Line',
    'tools.standard.draw-freeform.description': 'Draws a freeform line. Can either use the selected character or an auto-generated ASCII sequence.',
    'tools.standard.draw-rect.name': 'Draw Rectangle',
    'tools.standard.draw-rect.description': 'Draws a rectangle out of ASCII characters.',
    'tools.standard.draw-line.name': 'Draw Straight Line',
    'tools.standard.draw-line.description': 'Draws a straight line out of ASCII characters.',
    'tools.standard.draw-ellipse.name': 'Draw Ellipse',
    'tools.standard.draw-ellipse.description': 'Draws an ellipse out of ASCII characters.',
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

    'tools.standard.char-picker.name': 'Selected Character',
    'tools.standard.char-picker.description': 'Click to open the character picker. Or press any key to change the selected character to that key.',
    'tools.standard.color-picker.name': 'Selected Color',
    'tools.standard.color-picker.description': 'Click to open the color picker.',
    'tools.standard.color-picker-add.name': 'Add Color To Palette',
    'tools.standard.color-picker-add.description': 'This color is not currently saved to your palette. Click here if you want to add it.',

    'tools.selection.move.name': 'Move Selected Content',
    'tools.selection.move.description': 'When activated, clicking and dragging on the selected area will move the content.',
    'tools.selection.flip-v.name': 'Flip Vertically',
    'tools.selection.flip-v.description': 'Mirrors the selected content vertically.',
    'tools.selection.flip-v.mirror': 'Mirrors characters when possible, e.g. b => p',
    'tools.selection.flip-h.name': 'Flip Horizontally',
    'tools.selection.flip-h.description': 'Mirrors the selected content horizontally.',
    'tools.selection.flip-h.mirror': 'Mirrors characters when possible, e.g. b => d',
    'tools.selection.clone.name': 'Clone Selection',
    'tools.selection.clone.description': 'Clones the current selection to all frames.',
    'tools.selection.fill-char.name': 'Fill Selection With Character',
    'tools.selection.fill-char.description': 'Paints the selected area with the selected character',
    'tools.selection.fill-color.name': 'Fill Selection With Color',
    'tools.selection.fill-color.description': 'Paints the selected area with the selected color.',
    'tools.selection.resize.name': 'Resize Canvas',
    'tools.selection.resize.description': 'Resizes the canvas to match the selected area.',
    'tools.selection.close.name': 'Close',
    'tools.selection.close.description': 'Closes the current selection.',

    'tools.draw-freeform-types.current-char.name': 'Single-Character Line',
    'tools.draw-freeform-types.current-char.description': 'Draws a line by repeating the selected character.',
    'tools.draw-freeform-types.ascii-generated.name': 'Autogenerated ASCII Line',
    'tools.draw-freeform-types.ascii-generated.description': 'Draws a smooth ASCII line. Characters are picked automatically based on how the line crosses each cell',
    'tools.draw-rect-types.printable-ascii-1.name': 'Characters: /---\\',
    'tools.draw-rect-types.printable-ascii-1.description': 'Uses only basic ASCII characters.',
    'tools.draw-rect-types.printable-ascii-2.name': 'Characters: +---+',
    'tools.draw-rect-types.printable-ascii-2.description': 'Uses only basic ASCII characters.',
    'tools.draw-rect-types.single-line.name': 'Characters: ┌───┐',
    'tools.draw-rect-types.single-line.description': 'Uses Unicode characters.',
    'tools.draw-rect-types.double-line.name': 'Characters: ╔═══╗',
    'tools.draw-rect-types.double-line.description': 'Uses Unicode characters.',
    'tools.draw-rect-types.current-char-outline.name': 'Single-Character Outline',
    'tools.draw-rect-types.current-char-outline.description': 'Draws a rectangle outline by repeating the selected character.',
    'tools.draw-rect-types.current-char-filled.name': 'Single-Character Filled',
    'tools.draw-rect-types.current-char-filled.description': 'Draws a filled rectangle by repeating the selected character.',
    'tools.draw-line-types.basic.name': 'Autogenerated ASCII Line',
    'tools.draw-line-types.basic.description': 'Draws a straight line using various ASCII characters to best fit the slope.',
    'tools.draw-line-types.current-char.name': 'Single-Character Line',
    'tools.draw-line-types.current-char.description': 'Draws a straight line by repeating the selected character.',
    'tools.draw-ellipse-types.current-char-outline.name': 'Ellipse Outline',
    'tools.draw-ellipse-types.current-char-outline.description': 'Draws an ellipse outline by repeating the selected character.',
    'tools.draw-ellipse-types.current-char-filled.name': 'Filled Ellipse',
    'tools.draw-ellipse-types.current-char-filled.description': 'Draws a filled ellipse by repeating the selected character.',

    'frames.new-frame.name': 'New Frame',
    'frames.new-frame.description': 'Creates a new blank frame.',
    'frames.duplicate-frame.name': 'Duplicate Frame',
    'frames.duplicate-frame.description': 'Duplicates the currently selected frame(s).',
    'frames.delete-frame.name': 'Delete Frame',
    'frames.delete-frame.description': 'Deletes the currently selected frame(s).',
    'frames.reverse-frames.name': 'Reverse Frames',
    'frames.reverse-frames.description': 'Reverses the order of the currently selected frames.',
    'frames.toggle-onion.name': 'Toggle Onion',
    'frames.toggle-onion.description': 'When enabled, the previous frame will be faintly displayed.',
    'frames.show-component.name': 'Maximize Frames View',
    'frames.show-component.description': 'Shows the frames component.',
    'frames.hide-component.name': 'Minimize Frames View',
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

    'preview.open-popup.name': 'Preview Popup',
    'preview.open-popup.description': 'Opens the preview in a resizeable popup window.',
    'preview.play.name': 'Play Preview',
    'preview.play.description': 'Plays the preview at the given FPS.',
    'preview.pause.name': 'Pause Preview',
    'preview.pause.description': 'Pauses the preview on the current frame.',

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
    'palette.empty': 'No colors added.',

    'unicode.information.name': 'Unicode Quick Reference',
    'unicode.information.description': "Unicode characters aren't part of standard ASCII, but they're sometimes used in " +
        "ASCII art for their unique shapes and styles. Any time you use a Unicode character in your drawing it'll automatically " +
        'appear here for easy access and reuse.\n\n' +
        'Click a character below to select it in the character picker. ' +
        "This may also have additional effects depending on the tool you're using:\n" +
        '• Text Editor: Pastes the character once\n' +
        '• Selections: Fill selected area with the character',
    'unicode.open-settings.name': 'Unicode Settings',
    'unicode.open-settings.description': 'Opens unicode character settings.',
    'unicode.empty': 'No characters added.',

    'warnings.current-layer-not-visible': 'The current layer is not visible!',

    'sidebar.show-component.name': 'Maximize Sidebar',
    'sidebar.show-component.description': 'Shows the sidebar content.',
    'sidebar.hide-component.name': 'Minimize Sidebar',
    'sidebar.hide-component.description': 'Hides the sidebar content.',

}
