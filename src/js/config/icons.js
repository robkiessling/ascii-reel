
const PRE = 'pre'
const CHAR = 'char'
const REMIXICON = 'remixicon'
const ICOMOON = 'icomoon'
const CUSTOM = 'custom'

const ICON_DATA = {
    // 'tools.draw-freeform-types.irregular-adaptive': { type: REMIXICON, content: 'ri-brush-line' },
    // 'tools.draw-freeform-types.irregular-monochar': { type: PRE, content: 'AAAAA\nBBBBB\nCCCCC' },

    'tools.draw-freeform-types.irregular-adaptive': { type: PRE, content: "  /'.\n| | |\n'./  " },
    'tools.draw-freeform-types.irregular-monochar': { type: PRE, content: "  AAA\nA A A\nAAA  " },

    'tools.draw-line-types.straight-adaptive': { type: PRE, content: "  _,-\n-'   " },
    'tools.draw-line-types.straight-monochar': { type: PRE, content: '    AA\n  AA  \nAA    ' },

    'tools.draw-line-types.elbow-line-ascii': { type: PRE, content: '+----\n|    \n|    ' },
    'tools.draw-line-types.elbow-arrow-ascii': { type: PRE, content: '+--->\n|    \n|    ' },
    'tools.draw-line-types.elbow-line-unicode': { type: PRE, content: '┌────\n│    \n│    ' },
    'tools.draw-line-types.elbow-arrow-unicode': { type: PRE, content: '┌───▶\n│    \n│    ' },
    'tools.draw-line-types.elbow-line-monochar': { type: PRE, content: 'AAAAA\nA    \nA    ' },

    'tools.draw-rect-types.outline-ascii-1': { type: PRE, content: "/---\\\n|   |\n\\---/" },
    'tools.draw-rect-types.outline-ascii-2': { type: PRE, content: "+---+\n|   |\n+---+" },
    'tools.draw-rect-types.outline-unicode-1': { type: PRE, content: "┌───┐\n│   │\n└───┘" },
    'tools.draw-rect-types.outline-unicode-2': { type: PRE, content: "╔═══╗\n║   ║\n╚═══╝" },
    'tools.draw-rect-types.outline-monochar': { type: PRE, content: "AAAAA\nA   A\nAAAAA" },
    'tools.draw-rect-types.filled-monochar': { type: PRE, content: "AAAAA\nAAAAA\nAAAAA" },

    'tools.draw-ellipse-types.outline-monochar': { type: PRE, content: " AAA \nA   A\n AAA " },
    'tools.draw-ellipse-types.filled-monochar': { type: PRE, content: " AAA \nAAAAA\n AAA " },

    'tools.selection.move': { type: REMIXICON, content: 'ri-drag-move-2-fill' },
    'tools.selection.flip-v': { type: REMIXICON, content: 'ri-flip-vertical-fill' },
    'tools.selection.flip-h': { type: REMIXICON, content: 'ri-flip-horizontal-fill' },
    'tools.selection.clone': { type: REMIXICON, content: 'ri-file-copy-2-line' },
    'tools.selection.fill-char': {
        type: CUSTOM,
        content: '<span class="ri ri-fw ri-paint-fill ri-paint-fill-no-droplet"></span><span class="picked-char">A</span>'
    },
    'tools.selection.fill-color': { type: REMIXICON, content: 'ri-paint-fill' },
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

export function getIconHTML(key) {
    const iconData = ICON_DATA[key];
    if (!iconData) return `<span>?</span>`;

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