

const rootStyles = getComputedStyle(document.documentElement);

export const PRIMARY = rootStyles.getPropertyValue('--primary-color');
export const SECONDARY = rootStyles.getPropertyValue('--secondary-color');
export const ALERT = rootStyles.getPropertyValue('--alert-color');
export const DARKEST = rootStyles.getPropertyValue('--darkest');
export const DARKER = rootStyles.getPropertyValue('--darker');
export const DARK = rootStyles.getPropertyValue('--dark');
export const GREY = rootStyles.getPropertyValue('--grey');
export const LIGHT = rootStyles.getPropertyValue('--light');
export const LIGHTER = rootStyles.getPropertyValue('--lighter');
export const LIGHTEST = rootStyles.getPropertyValue('--lightest');