
const PRE = 'pre'
const CHAR = 'char'
const REMIXICON = 'remixicon'
const ICOMOON = 'icomoon'
const CUSTOM = 'custom'

const ICON_DATA = {
    'mainMenu.open': { type: REMIXICON, content: 'ri-menu-line' },
    'file.new': { type: REMIXICON, content: 'ri-file-line' },
    'file.open': { type: REMIXICON, content: 'ri-folder-2-line' },
    'file.save-as': { type: REMIXICON, content: 'ri-download-2-line' },
    'file.save-active': { type: REMIXICON, content: 'ri-save-3-line' },
    'file.export-as': { type: REMIXICON, content: 'ri-export-line' },
    'file.export-active': { type: REMIXICON, content: 'ri-export-line' },
    'settings.open-project-settings-dialog': { type: REMIXICON, content: 'ri-settings-5-line' },
    'settings.open-font-dialog': { type: REMIXICON, content: 'ri-font-sans-serif' },
    'settings.open-background-dialog': { type: REMIXICON, content: 'ri-landscape-line' },
    'settings.open-resize-dialog': { type: REMIXICON, content: 'ri-aspect-ratio-line' },

    'view.zoom-out': { type: REMIXICON, content: 'ri-zoom-out-line' },
    'view.zoom-in': { type: REMIXICON, content: 'ri-zoom-in-line' },
    'view.toggle-grid': { type: REMIXICON, content: 'ri-grid-line' },
    'view.toggle-whitespace': { type: REMIXICON, content: 'ri-space' },

    'state.undo': { type: REMIXICON, content: 'ri-arrow-go-back-line', style: "font-size: 0.875rem;" },
    'state.redo': { type: REMIXICON, content: 'ri-arrow-go-forward-line', style: "font-size: 0.875rem;" },

    'frames.new-frame': { type: REMIXICON, content: 'ri-add-circle-line' },
    'frames.duplicate-frame': { type: REMIXICON, content: 'ri-file-copy-2-line' },
    'frames.delete-frame': { type: REMIXICON, content: 'ri-delete-bin-line' },
    'frames.reverse-frames.left-aligned': { type: REMIXICON, content: 'ri-arrow-up-down-line' },
    'frames.reverse-frames.bottom-aligned': { type: REMIXICON, content: 'ri-arrow-left-right-line' },
    'frames.toggle-onion': { type: REMIXICON, content: 'ri-stack-line' },
    'frames.toggle-ticks': { type: REMIXICON, content: 'ri-timer-line' },
    'frames.toggle-component': { type: REMIXICON, content: 'ri-slideshow-view' },
    'frames.align-left': { type: REMIXICON, content: 'ri-layout-left-line' },
    'frames.align-bottom': { type: REMIXICON, content: 'ri-layout-bottom-line' },

    'layers.add-layer': { type: REMIXICON, content: 'ri-add-circle-line' },
    'layers.edit-layer': { type: REMIXICON, content: 'ri-pencil-line' },
    'layers.delete-layer': { type: REMIXICON, content: 'ri-delete-bin-line' },
    'layers.toggle-visibility-lock.lock': { type: REMIXICON, content: 'ri-lock-line' },
    'layers.toggle-visibility-lock.unlock': { type: REMIXICON, content: 'ri-lock-unlock-line' },

    'preview.play': { type: REMIXICON, content: 'ri-play-circle-line' },
    'preview.pause': { type: REMIXICON, content: 'ri-pause-circle-line' },
    'preview.open-popup': { type: REMIXICON, content: 'ri-external-link-line' },

    'palette.sort-colors': { type: REMIXICON, content: 'ri-sort-desc' },
    'palette.delete-unused-colors': { type: REMIXICON, content: 'ri-delete-bin-line' },
    'palette.open-settings': { type: REMIXICON, content: 'ri-settings-5-line' },

    'unicode.information': { type: REMIXICON, content: 'ri-information-line' },
    'unicode.open-settings': { type: REMIXICON, content: 'ri-settings-5-line' },

    'sidebar.toggle-component': { type: REMIXICON, content: 'ri-sidebar-unfold-line' },

    'tools.standard.select': { type: REMIXICON, content: 'ri-cursor-line' },
    'tools.standard.text-editor': { type: REMIXICON, content: 'ri-input-field' },
    'tools.standard.pan': { type: REMIXICON, content: 'ri-hand' },
    'tools.standard.move-all': { type: REMIXICON, content: 'ri-drag-move-2-fill' },
    'tools.standard.selection-rect': { type: ICOMOON, content: 'icon-rect-dashed' },
    'tools.standard.selection-lasso': { type: ICOMOON, content: 'icon-lasso-dashed' },
    'tools.standard.selection-line': { type: ICOMOON, content: 'icon-line-dashed' },
    'tools.standard.selection-wand': { type: REMIXICON, content: 'ri-magic-line' },
    'tools.standard.draw-rect': { type: ICOMOON, content: 'icon-rect-solid' },
    'tools.standard.draw-line': { type: ICOMOON, content: 'icon-line-solid' },
    'tools.standard.draw-ellipse': { type: REMIXICON, content: 'ri-circle-line' },
    'tools.standard.draw-freeform': { type: REMIXICON, content: 'ri-sketching' },
    'tools.standard.draw-textbox': { type: REMIXICON, content: 'ri-t-box-line' },
    'tools.standard.eraser': { type: REMIXICON, content: 'ri-eraser-line' },
    'tools.standard.fill-char': {
        type: CUSTOM,
        content: '<span class="ri ri-fw ri-paint-fill ri-paint-fill-no-droplet"></span><span class="picked-char">A</span>'
    },
    'tools.standard.paint-brush': { type: REMIXICON, content: 'ri-brush-line' },
    'tools.standard.color-swap': { type: REMIXICON, content: 'ri-palette-line' },

    'tools.shapes.freeformStroke.irregular-adaptive': { type: PRE, content: "  /'.\n| | |\n'./  " },
    'tools.shapes.freeformStroke.irregular-monochar': { type: PRE, content: "  AAA\nA A A\nAAA  " },

    'tools.shapes.lineStroke.straight-adaptive': { type: PRE, content: "  _,-\n-'   " },
    'tools.shapes.lineStroke.straight-monochar': { type: PRE, content: '    AA\n  AA  \nAA    ' },
    'tools.shapes.lineStroke.elbow-adaptive': { type: PRE, content: "  +--\n  |  \n--+  " },
    'tools.shapes.lineStroke.elbow-monochar': { type: PRE, content: '  AAA\n  A  \nAAA  ' },

    'tools.shapes.rectStroke.outline-ascii-1': { type: PRE, content: "/---\\\n|   |\n\\---/" },
    'tools.shapes.rectStroke.outline-ascii-2': { type: PRE, content: "+---+\n|   |\n+---+" },
    'tools.shapes.rectStroke.outline-unicode-1': { type: PRE, content: "┌───┐\n│   │\n└───┘" },
    'tools.shapes.rectStroke.outline-unicode-2': { type: PRE, content: "╔═══╗\n║   ║\n╚═══╝" },
    'tools.shapes.rectStroke.outline-monochar': { type: PRE, content: "AAAAA\nA   A\nAAAAA" },

    'tools.shapes.ellipseStroke.outline-monochar': { type: PRE, content: " AAA \nA   A\n AAA " },

    // 'tools.shapes.fill.empty': { type: REMIXICON, content: 'ri-delete-back-2-line' },
    'tools.shapes.fill.empty': { type: REMIXICON, content: 'ri-forbid-line' },
    'tools.shapes.fill.whitespace': { type: REMIXICON, content: 'ri-space' },
    // 'tools.shapes.fill.monochar': { type: PRE, content: "A", style: "font-size: 1.5rem;" },
    'tools.shapes.fill.monochar': { type: REMIXICON, content: 'ri-input-method-line' },

    'tools.selection.move': { type: REMIXICON, content: 'ri-drag-move-2-fill' },
    'tools.selection.flip-v': { type: REMIXICON, content: 'ri-flip-vertical-fill' },
    'tools.selection.flip-h': { type: REMIXICON, content: 'ri-flip-horizontal-fill' },
    'tools.selection.clone': { type: REMIXICON, content: 'ri-file-copy-2-line' },
    'tools.selection.fill-char': {
        type: CUSTOM,
        content: '<span class="ri ri-fw ri-paint-fill ri-paint-fill-no-droplet"></span><span class="picked-char">A</span>'
    },
    'tools.selection.convert-to-whitespace': { type: REMIXICON, content: 'ri-space' },
    'tools.selection.convert-to-empty': {
        type: CUSTOM,
        content: '<span class="ri-stack">' +
            '<span class="ri ri-fw ri-space"></span>' +
            '<span class="ri ri-fw ri-forbid-line ri-forbid-line-no-border" style="font-size: 36px;"></span>' +
            '</span>'
    },
    'tools.selection.resize': { type: REMIXICON, content: 'ri-crop-line' },
    'tools.selection.close': { type: REMIXICON, content: 'ri-close-line' },

    'tools.shapes.brush.pixel-perfect': { type: REMIXICON, content: 'ri-crosshair-2-line' },
    'tools.shapes.brush.square-1': { type: REMIXICON, content: 'ri-checkbox-blank-fill', style: "font-size: 0.5rem;" },
    'tools.shapes.brush.square-2': { type: REMIXICON, content: 'ri-checkbox-blank-fill', style: "font-size: 0.75rem;" },
    'tools.shapes.brush.square-3': { type: REMIXICON, content: 'ri-checkbox-blank-fill', style: "font-size: 1rem;" },
    'tools.shapes.brush.square-5': { type: REMIXICON, content: 'ri-checkbox-blank-fill', style: "font-size: 1.25rem;" },
    'tools.shapes.brush.square-10': { type: REMIXICON, content: 'ri-checkbox-blank-fill', style: "font-size: 1.5rem;" },
    'tools.shapes.brush.diamond-3': { type: REMIXICON, content: 'ri-checkbox-blank-fill rotate45', style: "font-size: 1rem;" },
    'tools.shapes.brush.diamond-5': { type: REMIXICON, content: 'ri-checkbox-blank-fill rotate45', style: "font-size: 1.25rem;" },
    'tools.shapes.brush.diamond-10': { type: REMIXICON, content: 'ri-checkbox-blank-fill rotate45', style: "font-size: 1.5rem;" },

    'tools.shapes.order': { type: REMIXICON, content: 'ri-stack-line' },
    'tools.shapes.sendToBack': { type: REMIXICON, content: 'ri-contract-right-line rotate90' },
    'tools.shapes.sendBackward': { type: REMIXICON, content: 'ri-arrow-right-line rotate90' },
    'tools.shapes.bringForward': { type: REMIXICON, content: 'ri-arrow-right-line rotate270' },
    'tools.shapes.bringToFront': { type: REMIXICON, content: 'ri-contract-right-line rotate270' },

    'tools.shapes.delete': { type: REMIXICON, content: 'ri-delete-bin-line' },

    'tools.shapes.editText': { type: REMIXICON, content: 'ri-text' },
    'tools.shapes.quickSwapChar': { type: REMIXICON, content: 'ri-flashlight-line' },

    'tools.shapes.textAlignH.alignLeft': { type: REMIXICON, content: 'ri-align-left' },
    'tools.shapes.textAlignH.alignCenter': { type: REMIXICON, content: 'ri-align-center' },
    'tools.shapes.textAlignH.alignRight': { type: REMIXICON, content: 'ri-align-right' },
    // 'tools.shapes.textAlignV.alignTop': { type: REMIXICON, content: 'ri-align-top' },
    // 'tools.shapes.textAlignV.alignMiddle': { type: REMIXICON, content: 'ri-align-vertically' },
    // 'tools.shapes.textAlignV.alignBottom': { type: REMIXICON, content: 'ri-align-bottom' },
    'tools.shapes.textAlignV.alignTop': { type: REMIXICON, content: 'ri-align-item-top-line' },
    'tools.shapes.textAlignV.alignMiddle': { type: REMIXICON, content: 'ri-align-item-vertical-center-line' },
    'tools.shapes.textAlignV.alignBottom': { type: REMIXICON, content: 'ri-align-item-bottom-line' },

    'tools.shapes.arrowheadStart.none': { type: PRE, content: '---' },
    'tools.shapes.arrowheadStart.plus': { type: PRE, content: '+--' },
    'tools.shapes.arrowheadStart.ascii-1': { type: PRE, content: '<--' },
    'tools.shapes.arrowheadStart.unicode-1': { type: PRE, content: '◀--' },
    'tools.shapes.arrowheadEnd.none': { type: PRE, content: '---' },
    'tools.shapes.arrowheadEnd.plus': { type: PRE, content: '--+' },
    'tools.shapes.arrowheadEnd.ascii-1': { type: PRE, content: '-->' },
    'tools.shapes.arrowheadEnd.unicode-1': { type: PRE, content: '--▶' },

    'themes.dark-mode': { type: REMIXICON, content: 'ri-moon-line' },
    'themes.light-mode': { type: REMIXICON, content: 'ri-sun-line' },
    'themes.os': { type: REMIXICON, content: 'ri-contrast-line' },
}

export function getIconClass(key) {
    const iconData = ICON_DATA[key];
    if (!iconData) return undefined;

    switch(iconData.type) {
        case REMIXICON:
            return iconData.content;
        default:
            return undefined;
    }
}

export function getIconHTML(key, debugQuestionMark = true) {
    const iconData = ICON_DATA[key];
    if (!iconData) return debugQuestionMark ? `<span>?</span>` : undefined;

    const style = iconData.style ? iconData.style : ''

    switch(iconData.type) {
        case PRE:
            return `<pre class="pre-icon" style="${style}">${iconData.content}</pre>`
        case CHAR:
            return `<span class="char-icon" style="${style}">${iconData.content}</span>`
        case REMIXICON:
            return `<span class="ri ri-fw ${iconData.content}" style="${style}"></span>`
        case ICOMOON:
            return `<span class="${iconData.content}" style="${style}"></span>`
        case CUSTOM:
            return iconData.content;
        default:
            console.warn(`Invalid icon type: ${iconData.type}`);
            return undefined;
    }
}