import {strings} from "../../config/strings.js";
import {hasActiveFile, saveFile, saveToActiveFile} from "../../state/file_system.js";

export default class UnsavedWarning {
    constructor($container, options = {}) {
        this.$container = $container;
        
        this._createHTML(
            strings['file.save-warning'],
            options.successStringId ? strings[options.successStringId] : ''
        );

        this.$container.find('button').on('click', () => {
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
    }

    toggle(showWarning, showSuccess = false) {
        this.$warning.toggle(!!showWarning);
        if (this.$success) this.$success.toggle(!!showSuccess);
    }

    _createHTML(warningMessage, successMessage) {
        this.$warning = $(`
            <div class="unsaved-warning warning-popup">
                <span class="ri ri-fw ri-error-warning-line warning flex-shrink"></span>
                <div>${warningMessage.replace(/\n/g, "<br>")}</div>
                <button class="flex-shrink">
                    <span class="ri ri-fw ri-add-circle-line"></span>
                </button>
            </div>
        `).appendTo(this.$container);

        if (successMessage) {
            this.$success = $(`
                <div class="save-successful">
                    ${successMessage.replace(/\n/g, "<br>")}
                </div>
            `).appendTo(this.$container);
        }
    }

}