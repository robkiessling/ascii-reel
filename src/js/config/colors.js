
const rootStyles = getComputedStyle(document.documentElement);

export const PRIMARY_COLOR = rootStyles.getPropertyValue('--color-primary');
export const SELECTION_COLOR = rootStyles.getPropertyValue('--color-selection');
export const ALERT_COLOR = rootStyles.getPropertyValue('--color-alert');