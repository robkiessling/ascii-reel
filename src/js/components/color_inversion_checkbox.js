import {STRINGS} from "../config/strings.js";
import {BLACK, WHITE, hasCharContent, getConfig} from "../state/index.js";

const DEFAULT_OPTIONS = {}

/**
 * A lightweight helper class that manages warning messages triggered when a color inversion is necessary. For example,
 * if the background is changed to black and black text is detected, the class displays a warning and offers to convert
 * the text to white. The same logic applies in reverse for white backgrounds and white text.
 */
export default class ColorInversionCheckbox {
    constructor($container, options) {
        this.$container = $container;
        this.options = $.extend(true, {}, DEFAULT_OPTIONS, options);

        this._createHTML();
    }

    _createHTML() {
        this.$container.append(`
            <div class="info-popup">
                <div class="flex-row align-center" style="gap: 4px;">
                    <div class="align-center"><span class="ri ri-fw ri-lg ri-information-line"></span></div>
                    <div class="flex-1 info-description"></div>
                </div>
                <label>
                    <input type="checkbox" checked="checked">
                    <span class="cb-description"></span>
                </label>
            </div>
        `);

        this.$description = this.$container.find('.info-description');
        this.$checkboxDesc = this.$container.find('.cb-description');
        this.$checkbox = this.$container.find('input[type="checkbox"]');
    }

    // Snapshots the current state of the canvas (and whether it has any black/white chars)
    analyzeCanvas() {
        this.hasBlackChars = hasCharContent(BLACK);
        this.hasWhiteChars = hasCharContent(WHITE);
    }

    // Returns true if the user is opting to invert colors
    shouldInvert() {
        return this.$checkbox.is(':visible') && this.$checkbox.is(':checked')
    }

    setDefaultCbState() {
        this.$checkbox.prop('checked', true);
    }

    refresh(newColorMode, newBackground) {
        if (newColorMode === 'monochrome') {
            this.$container.hide();
            return;
        }

        if (newBackground === getConfig('background')) {
            this.$container.hide();
            return;
        }

        if (this.hasBlackChars && newBackground === BLACK) {
            this.$description.html(STRINGS['settings.change-background.invert-black.warning'])
            this.$checkboxDesc.html(STRINGS['settings.change-background.invert-black.checkbox'])
            this.$container.show();
        }
        else if (this.hasWhiteChars && newBackground === WHITE) {
            this.$description.html(STRINGS['settings.change-background.invert-white.warning'])
            this.$checkboxDesc.html(STRINGS['settings.change-background.invert-white.checkbox'])
            this.$container.show();
        }
        else {
            this.$container.hide();
        }
    }


}