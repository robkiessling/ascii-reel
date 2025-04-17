import {STRINGS} from "../config/strings.js";
import {hasActiveFile, isPickerCanceledError, saveFile} from "../storage/file_system.js";
import {strToHTML} from "../utils/strings.js";

const DEFAULT_OPTIONS = {
    showCloseButton: false, // If true, a close button will show in the top-right corner of the warning
    successStringId: '', // string ID for message to show if save is successful
    onSave: () => {}, // callback if user clicks 'save' button
}

export default class UnsavedWarning {
    constructor($container, options = {}) {
        this.$container = $container;
        this.options = $.extend({}, DEFAULT_OPTIONS, options);
        
        this._createHTML(
            STRINGS['file.save-warning'],
            this.options.successStringId ? STRINGS[this.options.successStringId] : ''
        );

        this.$container.find('.save').on('click', () => {
            saveFile(hasActiveFile())
                .then(() => {
                    this.toggle(false, true)
                    this.options.onSave();
                })
                .catch(err => {
                    if (!isPickerCanceledError(err)) {
                        console.error(err);
                        alert(`Failed to save file: ${err.message}`);
                    }
                })
        });

        this.$container.find('.close').on('click', () => {
            this.toggle(false, false);
        })
    }

    toggle(showWarning, showSuccess = false) {
        this.$warning.toggle(!!showWarning);
        if (this.$success) this.$success.toggle(!!showSuccess);

        this.$container.toggle(!!showWarning || !!showSuccess)
    }

    _createHTML(warningMessage, successMessage) {
        this.$warning = $(`
            <div class="unsaved-warning warning-popup">
                <span class="ri ri-fw ri-error-warning-line warning flex-shrink"></span>
                <div>${strToHTML(warningMessage)}</div>
                <div class="flex-shrink">
                    <button class="save flex-shrink">
                        <span class="ri ri-fw ri-save-3-line"></span> Save
                    </button>
                </div>
            </div>
        `).appendTo(this.$container);

        if (this.options.showCloseButton) {
            $(`
                <button class="close">
                    <span class="ri ri-fw ri-close-line"></span>
                </button>
            `).appendTo(this.$warning);
        }

        if (successMessage) {
            this.$success = $(`
                <div class="save-successful">
                    ${strToHTML(successMessage)}
                </div>
            `).appendTo(this.$container);
        }
    }

}