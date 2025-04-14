
const PRE = 'pre'
const CHAR = 'char'
const REMIXICON = 'remixicon'
const ICOMOON = 'icomoon'

const ICON_DATA = {
    // 'tools.draw-freeform-types.ascii-generated': { type: REMIXICON, content: 'ri-brush-line' },
    // 'tools.draw-freeform-types.current-char': { type: PRE, content: 'AAAAA\nBBBBB\nCCCCC' },

    'tools.draw-freeform-types.ascii-generated': { type: PRE, content: "  /'.\n| | |\n'./  " },
    'tools.draw-freeform-types.current-char': { type: PRE, content: "  AAA\nA A A\nAAA  " },

    'tools.draw-line-types.basic': { type: PRE, content: "  _,-\n-'   " },
    'tools.draw-line-types.current-char': { type: PRE, content: '  A\n A \nA  ' },

    'tools.draw-rect-types.printable-ascii-1': { type: PRE, content: "/---\\\n|   |\n\\---/" },
    'tools.draw-rect-types.printable-ascii-2': { type: PRE, content: "+---+\n|   |\n+---+" },
    'tools.draw-rect-types.single-line': { type: PRE, content: "┌───┐\n│   │\n└───┘" },
    'tools.draw-rect-types.double-line': { type: PRE, content: "╔═══╗\n║   ║\n╚═══╝" },
    'tools.draw-rect-types.current-char-outline': { type: PRE, content: "AAAAA\nA   A\nAAAAA" },
    'tools.draw-rect-types.current-char-filled': { type: PRE, content: "AAAAA\nAAAAA\nAAAAA" },

    'tools.draw-ellipse-types.current-char-outline': { type: PRE, content: " AAA \nA   A\n AAA " },
    'tools.draw-ellipse-types.current-char-filled': { type: PRE, content: " AAA \nAAAAA\n AAA " },
}



export function getIconHTML(key) {
    const iconData = ICON_DATA[key];
    if (!iconData) return undefined;

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
        default:
            console.warn(`Invalid icon type: ${iconData.type}`);
            return undefined;
    }
}