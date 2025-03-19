import {strings} from "../../config/strings.js";
import {hasActiveFile, saveFile, saveToActiveFile} from "../../state/file_system.js";

const DEFAULT_OPTIONS = {
    showCloseButton: false, // If true, a close button will show in the top-right corner of the warning
    successStringId: '', // string ID for message to show if save is successful
}

export default class UnsavedWarning {
    constructor($container, options = {}) {
        this.$container = $container;
        this.options = $.extend({}, DEFAULT_OPTIONS, options);
        
        this._createHTML(
            strings['file.save-warning'],
            this.options.successStringId ? strings[this.options.successStringId] : ''
        );

        this.$container.find('.save').on('click', () => {
            if (hasActiveFile()) {
                saveToActiveFile()
                    .then(saved => this.toggle(!saved, saved))
                    .catch(error => alert(`Failed to save file: ${error.message}`))
            }
            else {
                saveFile()
                    .then(saved => this.toggle(!saved, saved))
                    .catch(error => alert(`Failed to save file: ${error.message}`))
            }
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
                <div>${warningMessage.replace(/\n/g, "<br>")}</div>
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
                    ${successMessage.replace(/\n/g, "<br>")}
                </div>
            `).appendTo(this.$container);
        }
    }

}