
export function isMacOS() {
    const platform = navigator.platform.toLowerCase(); // todo deprecated
    return platform.includes("mac");
}

// It seems like operating systems abbreviate shortcuts differently:
// Mac:     ⌘⇧N
// Windows: Ctrl-Shift-N
export function modifierAbbr(modifierKey) {
    switch(modifierKey) {
        case 'metaKey':
            return isMacOS() ? '⌘' : 'Win-';
        case 'altKey':
            return isMacOS() ? '⌥' : 'Alt-';
        case 'ctrlKey':
            return isMacOS() ? '^' : 'Ctrl-';
        case 'shiftKey':
            return isMacOS() ? '⇧' : 'Shift-';
        default:
            console.warn(`Unknown modifierKey: ${modifierKey}`);
            return '?'
    }
}

export function modifierWord(modifierKey) {
    switch(modifierKey) {
        case 'metaKey':
            return isMacOS() ? 'Cmd' : 'Win';
        case 'altKey':
            return isMacOS() ? 'Option' : 'Alt';
        case 'ctrlKey':
            return 'Ctrl';
        case 'shiftKey':
            return 'Shift';
    }
}
