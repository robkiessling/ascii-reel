import {readGlobalSetting, saveGlobalSetting} from "../storage/local_storage.js";

/**
 * Handles minimizing/maximizing various feature containers
 */
export default class Minimizer {
    constructor($container, componentKey, options = {}) {
        this.$container = $container;
        this.componentKey = componentKey;
        this.options = options;
    }

    refresh() {
        this.$container.toggleClass('minimized', this.isMinimized)

        this.$container.find('.component-toggle-header .ri')
            .removeClass('ri-arrow-right-s-fill ri-arrow-down-s-fill')
            .addClass(this.isMinimized ? 'ri-arrow-right-s-fill' : 'ri-arrow-down-s-fill')
    }

    get isMinimized() {
        const minimizedComponents = readGlobalSetting('minimizedComponents') || {};
        return !!minimizedComponents[this.componentKey];
    }

    toggle(minimize) {
        const minimizedComponents = readGlobalSetting('minimizedComponents') || {};
        minimizedComponents[this.componentKey] = minimize === undefined ? !this.isMinimized : minimize;
        saveGlobalSetting('minimizedComponents', minimizedComponents);

        if (this.options.onChange) this.options.onChange(this.isMinimized);
    }
}