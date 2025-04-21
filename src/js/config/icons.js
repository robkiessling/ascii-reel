
const PRE = 'pre'
const CHAR = 'char'
const REMIXICON = 'remixicon'
const ICOMOON = 'icomoon'

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

    'themes.dark-mode': { type: REMIXICON, class: 'ri-moon-line' },
    'themes.light-mode': { type: REMIXICON, class: 'ri-sun-line' },
    'themes.os': { type: REMIXICON, class: 'ri-contrast-line' },
}

export function getIconClass(key) {
    const iconData = ICON_DATA[key];
    if (!iconData) return undefined;
    return iconData.class;
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
            return `<span class="ri ri-fw ${iconData.class}" style="${style}"></span>`
        case ICOMOON:
            return `<span class="${iconData.class}" style="${style}"></span>`
        default:
            console.warn(`Invalid icon type: ${iconData.type}`);
            return undefined;
    }
}