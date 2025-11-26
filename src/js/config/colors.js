import Color from "@sphinxxxx/color-conversion";

export const COLOR_FORMAT = 'hex'; // vanilla-picker format we use to store colors
export const BLACK = new Color('#000')[COLOR_FORMAT];
export const WHITE = new Color('#fff')[COLOR_FORMAT];
export const DARK = new Color('#111113')[COLOR_FORMAT]; // Matches dark's --gray-1
export const LIGHT = new Color('#fcfcfd')[COLOR_FORMAT]; // Matches light's --gray-1

export const COLOR_MODES = {
    BLACK_AND_WHITE: 'monochrome',
    COLORED: 'multicolor'
}

export const BACKGROUND_MODES = {
    MATCH_THEME: 'match-theme',
    DARK: 'dark',
    LIGHT: 'light',
    TRANSPARENT: 'transparent',
    CUSTOM: 'custom',
}

// Returns the best default color that contrasts a given background color
export function contrastColor(forBackground) {
    if (!forBackground) return BLACK;

    const backgroundColor = new Color(forBackground);
    let [h, s, l, a] = backgroundColor.hsla;
    return l < 0.5 ? WHITE : BLACK;
}


// ------------------------------------------------------------- CSS Variables

const rootStyles = getComputedStyle(document.documentElement);

// The following colors are static; they do not change based on dark/light mode
export const PRIMARY_COLOR = rootStyles.getPropertyValue('--color-primary');
export const SELECTION_COLOR = rootStyles.getPropertyValue('--color-selection');
export const SELECTION_SUBTLE_COLOR = `color-mix(in srgb, ${SELECTION_COLOR.trim()} 75%, transparent)`;

// The following function can be used to get the current color value (based on dark/light mode)
export function getDynamicColor(cssProperty) {
    return rootStyles.getPropertyValue(cssProperty);
}

// ------------------------------------------------------------- Canvas Colors

export const CHECKERBOARD_DARK_A = '#4c4c4c';
export const CHECKERBOARD_DARK_B = '#555';
export const CHECKERBOARD_LIGHT_A = '#eee';
export const CHECKERBOARD_LIGHT_B = '#fafafa';

export const MINOR_GRID_LIGHTNESS_DELTA = 0.1;
export const MAJOR_GRID_LIGHTNESS_DELTA = 0.3;
export const HOVER_LIGHTNESS_DELTA = 0.5;
export const HOVER_CELL_OPACITY = 0.25;

// ------------------------------------------------------------- Palette

// Note: these values get used to look up strings->description value for tooltip. If this is changed need to update strings.
export const COLOR_SORT_OPTIONS = {
    DATE_ADDED: 'date-added',
    HUE: 'hue',
    SATURATION: 'saturation',
    LIGHTNESS: 'lightness',
    ALPHA: 'alpha'
}
