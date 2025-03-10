
const rootStyles = getComputedStyle(document.documentElement);

// The following colors are static; they do not change based on dark/light mode
export const PRIMARY_COLOR = rootStyles.getPropertyValue('--color-primary');
export const SELECTION_COLOR = rootStyles.getPropertyValue('--color-selection');

// The following function can be used to get the current color value (based on dark/light mode)
export function getDynamicColor(cssProperty) {
    return rootStyles.getPropertyValue(cssProperty);
}