import {defer} from "../utils/utilities.js";

const DEFAULT_OPTIONS = {
    key: undefined, // If defined, duplicate Toasts with the same key will just update each other; not make more rows
    duration: 5000,
    text: 'Empty Toast',
    textCenter: false
}

const FADE_OUT_DURATION = 500; // Should match scss toast transition
const visibleToastsByKey = {};

/**
 * Makes a small notification in the top-right corner of the screen. See DEFAULT_OPTIONS constant for options.
 */
export default class Toast {
    constructor(options) {
        this.options = $.extend(true, {}, DEFAULT_OPTIONS, options);
        this._init();
    }
    
    static instantlyRemoveKey(key) {
        const toast = visibleToastsByKey[key];
        if (toast) toast.instantlyRemove();
    }

    _init() {
        if (this.options.key) {
            if (visibleToastsByKey[this.options.key]) {
                // Toast already is showing. Restart it; do not make a new one
                visibleToastsByKey[this.options.key].restart(this.options);
                return;
            }
            else {
                visibleToastsByKey[this.options.key] = this;
            }
        }

        this.$toast = $('<div>', {
            class: `toast ${this.options.textCenter ? 'text-center' : ''}`,
            html: this.options.text
        }).appendTo($('#toasts'));

        defer(() => this.$toast.addClass('show'), 100);

        this._startRemovalTimer();
    }

    restart(newOptions) {
        this.options = $.extend(true, {}, this.options, newOptions);
        clearTimeout(this.fadeTimeout);
        clearTimeout(this.removalTimeout);
        this.$toast.addClass('show');
        this._startRemovalTimer();
    }
    
    instantlyRemove() {
        clearTimeout(this.fadeTimeout);
        clearTimeout(this.removalTimeout);
        this.$toast.remove();
        if (this.options.key) delete visibleToastsByKey[this.options.key];
    }

    _startRemovalTimer() {
        if (this.options.duration) {
            this.fadeTimeout = setTimeout(() => {
                // When timer duration ends, start fading
                this.$toast.removeClass('show');

                // Remove element once fade-out is finished
                this.removalTimeout = setTimeout(() => {
                    this.$toast.remove();
                    if (this.options.key) delete visibleToastsByKey[this.options.key];
                }, FADE_OUT_DURATION);

            }, this.options.duration);
        }
    }

}