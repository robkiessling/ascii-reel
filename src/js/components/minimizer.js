import {isMinimizedComponent, setMinimizedComponent} from "../state/index.js";

/**
 * Handles minimizing/maximizing various feature containers
 */
export default class Minimizer {
    /**
     *
     * @param {JQuery} $container
     * @param {string} componentKey - Key to store minimized state in global settings
     * @param {Object} [options={}] - Additional options
     * @param {boolean} [options.fullyHide=false] If true, component will be hidden instead of minimized
     */
    constructor($container, componentKey, options = {}) {
        this.$container = $container;
        this.componentKey = componentKey;
        this.options = options;
    }

    refresh() {
        const minimized = this.isMinimized;
        this.$container.toggleClass('minimized', minimized)
        if (this.options.fullyHide) this.$container.toggle(!minimized);

        this.$container.find('.component-toggle-header .ri')
            .removeClass('ri-arrow-right-s-fill ri-arrow-down-s-fill')
            .addClass(minimized ? 'ri-arrow-right-s-fill' : 'ri-arrow-down-s-fill')
    }

    get isMinimized() {
        return isMinimizedComponent(this.componentKey);
    }

    toggle(minimize) {
        setMinimizedComponent(this.componentKey, minimize);

        if (this.options.onChange) this.options.onChange(this.isMinimized);
    }
}