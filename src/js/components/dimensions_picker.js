import {DEFAULT_CONFIG} from "../state/index.js";

const DEFAULT_OPTIONS = {
    anchorTool: false
}

const MAX_ROWS = 250;
const MAX_COLUMNS = 500;

export default class DimensionsPicker {
    constructor($container, options = {}) {
        this.$container = $container;
        this.options = $.extend(true, {}, DEFAULT_OPTIONS, options);
        this._init();
    }

    set value(newValue) {
        this.$rows.val(newValue.numRows);
        this.$columns.val(newValue.numCols);
        this.$aspectRatio.trigger('change');
    }

    get value() {
        const $anchor = this.$anchor.filter('.selected');

        return {
            numRows: parseInt(this.$rows.val()),
            numCols: parseInt(this.$columns.val()),
            anchor: {
                row: $anchor.data('row-anchor'),
                col: $anchor.data('col-anchor'),
            }
        }
    }

    validate() {
        let isValid = true;
        const currentValue = this.value;

        this.$rows.removeClass('error');
        if (isNaN(currentValue.numRows) || currentValue.numRows > MAX_ROWS) {
            this.$rows.addClass('error');
            this.$rowsError.html(`Max: ${MAX_ROWS}`).show();
            isValid = false;
        }

        this.$columns.removeClass('error');
        if (isNaN(currentValue.numCols) || currentValue.numCols > MAX_COLUMNS) {
            this.$columns.addClass('error');
            this.$columnsError.html(`Max: ${MAX_COLUMNS}`).show();
            isValid = false;
        }

        return isValid;
    }

    _init() {
        this._createHTML();

        this.$rows = this.$container.find('[name="rows"]');
        this.$columns = this.$container.find('[name="columns"]');
        this.$rowsError = this.$rows.siblings('.error');
        this.$columnsError = this.$columns.siblings('.error');

        this.$aspectRatio = this.$container.find('[name="aspect-ratio"]');
        this.$aspectRatio.on('change', evt => this._toggleAspectRatio($(evt.currentTarget).is(':checked')));

        this.$anchor = this.$container.find('.anchor-option');
        this.$container.on('click', '.anchor-option', evt => {
            this.$anchor.removeClass('selected');
            $(evt.currentTarget).addClass('selected');
        });

        // initial option: middle/middle
        this.$anchor.filter('[data-row-anchor="middle"][data-col-anchor="middle"]').trigger('click');
    }

    _createHTML() {
        this.$container.append(`
            <label>
                Width:
                <input type="text" name="columns"> columns
                <span class="error ml-1"></span>
            </label>
            <label>
                Height:
                <input type="text" name="rows"> rows
                <span class="error ml-1"></span>
            </label>
            <label>
                <input type="checkbox" name="aspect-ratio" checked="checked"> Maintain aspect ratio
            </label>
        `);

        if (this.options.anchorTool) {
            this.$container.append(`
                <div class="mt-2">
                    <div class="label-header">Anchor:</div>
                    <div class="anchor-options">
                        <div>
                            <div class="anchor-option" data-row-anchor="top" data-col-anchor="left"></div>
                            <div class="anchor-option" data-row-anchor="top" data-col-anchor="middle"></div>
                            <div class="anchor-option" data-row-anchor="top" data-col-anchor="right"></div>
                        </div>
                        <div>
                            <div class="anchor-option" data-row-anchor="middle" data-col-anchor="left"></div>
                            <div class="anchor-option" data-row-anchor="middle" data-col-anchor="middle"></div>
                            <div class="anchor-option" data-row-anchor="middle" data-col-anchor="right"></div>
                        </div>
                        <div>
                            <div class="anchor-option" data-row-anchor="bottom" data-col-anchor="left"></div>
                            <div class="anchor-option" data-row-anchor="bottom" data-col-anchor="middle"></div>
                            <div class="anchor-option" data-row-anchor="bottom" data-col-anchor="right"></div>
                        </div>
                    </div>
                </div>
            `);
        }
    }

    _toggleAspectRatio(enabled) {
        this._hideErrors();

        this.$rows.off('input.ratio');
        this.$columns.off('input.ratio');

        if (enabled) {
            // Snapshot the current ratio
            this._fixInvalidData();
            const ratio = this.value.numRows / this.value.numCols;

            this.$rows.on('input.ratio', evt => {
                const rows = $(evt.currentTarget).val();
                const columns = Math.round(rows / ratio);
                this.$columns.val(columns);
                this._hideErrors();
            }).trigger('input.ratio');

            this.$columns.on('input.ratio', evt => {
                const columns = $(evt.currentTarget).val();
                const rows = Math.round(columns * ratio);
                this.$rows.val(rows);
                this._hideErrors();
            });
        }
    }

    _fixInvalidData() {
        const currentValue = this.value;

        if (isNaN(currentValue.numRows) || currentValue.numRows <= 0) this.$rows.val(DEFAULT_CONFIG.dimensions[0]);
        if (isNaN(currentValue.numCols) || currentValue.numCols <= 0) this.$columns.val(DEFAULT_CONFIG.dimensions[1]);
    }

    _hideErrors() {
        this.$rows.removeClass('error');
        this.$columns.removeClass('error');

        this.$rowsError.hide();
        this.$columnsError.hide();
    }


}