import * as state from "../state/state.js";
import {config} from "../state/state.js";

/**
 * Minimizes/maximizes the component according to the current state.
 * @param $container The component's container element
 * @param componentKey The component to minimize/maximize
 */
export function refreshComponentVisibility($container, componentKey) {
    const minimized = state.isMinimized(componentKey);

    $container.toggleClass('minimized', minimized)

    $container.find('.component-toggle-header .ri')
        .removeClass('ri-arrow-right-s-fill ri-arrow-down-s-fill')
        .addClass(minimized ? 'ri-arrow-right-s-fill' : 'ri-arrow-down-s-fill')
}

/**
 * Updates the state that controls whether a component is minimized/maximized. Typically, the component's refresh
 * function will be called after calling this.
 * @param componentKey The component to minimize/maximize
 * @param {boolean} [isMinimized] If true, will minimize the component. If false, will maximize the component. If
 *   undefined, will toggle the component from its current state.
 */
export function toggleComponent(componentKey, isMinimized) {
    const minimizedComponents = config('minimizedComponents') || {};
    minimizedComponents[componentKey] = isMinimized === undefined ? !minimizedComponents[componentKey] : !!isMinimized;
    config('minimizedComponents', minimizedComponents);
}