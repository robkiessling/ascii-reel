import * as state from "../state/index.js";
import exampleExportImg from "../../images/example-export.png";
import {ValidationError} from "../utils/errors.js";
import Color from "@sphinxxxx/color-conversion";
import dedent from "dedent-js";
import SimpleBar from "simplebar";
import {fontRatio} from "../config/font.js";

const DEFAULT_FONT_SIZE = 16;

const VALIDATORS = {
    fontSize: { type: 'float' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    fps: { type: 'integer' }, // todo also check if > 1
    spritesheetColumns: { type: 'integer' },
    spritesheetRows: { type: 'integer' }
}

export default class ExportForm {
    constructor($container, options = {}) {
        this.$container = $container;
        this.options = $.extend({}, options);
        this._init();
    }

    _init() {
        this._createHTML();
        this._setupExample();
        this._setupEventListeners();
    }

    /**
     * Loads the form with the export settings from the last export.
     * Useful for re-exporting a previously opened file with its original settings.
     */
    loadFromLastExport() {
        const options = state.getConfig('lastExportOptions');

        if (options) {
            // If there are export settings from a previous save, initialize the export form with those settings
            const $format = this._getOptionInput('format');
            $format.val(options.format);
            if (!$format.val()) $format.val($format.find('option:first').val()); // Ensure format is still valid

            for (const [key, value] of Object.entries(options)) {
                if (key === 'format') continue;
                const $input = this._getOptionInput(key);
                $input.is(':checkbox') ? $input.prop('checked', !!value) : $input.val(value);
            }
        }
        else {
            // No saved options found -> blank out any fields relevant to specific animations:
            this._getOptionInput('width').val('');
        }
    }

    /**
     * Loads the form according to the current canvas state
     */
    loadFromState() {
        this._getOptionInput('fps').val(state.getConfig('fps'))

        const $width = this._getOptionInput('width');
        if (!$width.val()) $width.val(this._defaultWidth());
        $width.trigger('input');

        const $fontSize = this._getOptionInput('fontSize');
        if (!$fontSize.val()) $fontSize.val(DEFAULT_FONT_SIZE);

        const $spritesheetRows = this._getOptionInput('spritesheetRows');
        const $spritesheetCols = this._getOptionInput('spritesheetColumns');
        if (!$spritesheetRows.val() && !$spritesheetCols.val()) {
            const { rows, cols } = this._optimalSpritesheetLayout();
            $spritesheetRows.val(rows);
            $spritesheetCols.val(cols);
        }

        this._refresh();
    }

    /**
     * Validates the form. If there are errors, red indicators will be displayed next to those fields, and a
     * ValidationError will be thrown. If there are no errors, the options hash will be returned.
     * @returns {Object} - Validated options hash
     */
    validateOptions() {
        this.$container.find('.error').removeClass('error');

        let isValid = true;
        let options = {};

        this.$container.find('input, select').each((i, element) => {
            const $input = $(element);
            if ($input.hasClass('hidden')) return;

            const name = $input.attr('name');
            let value = $input.val();
            if ($input.is(':checkbox')) value = $input.is(':checked')

            if (!this._validateOption($input, name, value)) {
                console.log('is invalid', name, value);
                isValid = false
            }

            options[name] = value;
        })

        if (!this.$container.find('.export-warning[data-prevent-export="true"]').hasClass('hidden')) isValid = false;

        if (!isValid) throw new ValidationError("Form is invalid");

        return options;
    }

    /**
     * Initializes the form's HTML structure.
     *
     * Elements can be conditionally displayed using the `data-show-if` attribute.
     * Example:
     *     data-show-if="format=png,json;frames=spritesheet"
     *
     * This means the element will be shown if:
     * - The input with name 'format' has the value 'png' or 'json', AND
     * - The input with name 'frames' has the value 'spritesheet'.
     */
    _createHTML() {
        this.$container.append(`
            <label>
                Format:
                <select class="w-7" name="format">
                    <option value="json">JSON</option>
                    <option value="gif">GIF</option>
                    <option value="png">PNG</option>
                    <option value="txt">TXT</option>
                    <option value="rtf">RTF</option>
                    <option value="html">HTML</option>
                    <option value="webm">WebM</option>
                </select>
            </label>
            <label data-show-if="format=rtf,html">
                Font size: <input type="text" name="fontSize">
            </label>
            <label data-show-if="format=json">
                Frame Structure:
                <select name="frameStructure">
                    <option value="array-chars">Array: chars</option>
                    <option value="obj-chars">Object: chars</option>
                    <option value="obj-chars-colors">Object: chars, colors</option>
                    <option value="obj-chars-colors-colorTable">Object: chars, colors, colorTable</option>
                </select>
            </label>
            <label data-show-if="format=json;frameStructure=obj-chars-colors,obj-chars-colors-colorTable">
                Color Format:
                <select name="colorFormat">
                    <option value="hex-str">Hex string</option>
                    <option value="rgba-str">RGBA string</option>
                    <option value="rgba-array">RGBA array</option>
                </select>
            </label>
            <label data-show-if="format=json">
                <input type="checkbox" name="mergeCharRows" checked="checked"> Merge char rows into strings
            </label>
            <div class="form-row" data-show-if="format=png,gif,webm">
                Dimensions:
                <input type="text" name="width" placeholder="width"> x
                <input type="text" name="height" placeholder="height">
                <a class="set-default-dimensions ml-1">Set to default</a>
            </div>
            <label data-show-if="format=html,gif,webm">
                FPS: <input type="text" name="fps">
            </label>
            <label data-show-if="format=png,rtf,html,gif,webm">
                <input type="checkbox" name="background" checked="checked"> Include Background
            </label>
            <label data-show-if="format=html">
                <input type="checkbox" name="loop" checked="checked"> Loop
            </label>
            <label data-show-if="format=png,txt,rtf">
                Frames:
                <select name="frames">
                    <option value="current">Current Frame</option>
                    <option value="zip">ZIP</option>
                    <option value="spritesheet">Spritesheet</option>
                </select>
            </label>
            <label data-show-if="format=png;frames=spritesheet">
                Spritesheet layout:
                <input type="number" name="spritesheetColumns"> columns,
                <input type="number" name="spritesheetRows"> rows
            </label>
            <label data-show-if="format=txt,rtf;frames=spritesheet">
                Frame Separator:
                <select name="frameSeparator">
                    <option value="none">None</option>
                    <option value="space">          </option>
                    <option value="spaceNumbered">#          </option>
                    <option value="dash">----------</option>
                    <option value="dashNumbered" selected="selected">#---------</option>
                    <option value="asterisk">**********</option>
                    <option value="asteriskNumbered">#*********</option>
                </select>
            </label>
            <div id="example-container" data-show-if="format=json">
                <div>Example JSON (for 1 sample frame, shown on left):</div>
                <div id="example-img-and-text">
                    <img id="example-img" alt="ABCDEF"/>
                    <div id="example-text"><pre></pre></div>
                </div>
            </div>
            <div class="export-warning" data-show-if="format=png;frames=spritesheet" data-prevent-export="true">
                <div>
                    <span class="ri ri-fw ri-error-warning-line"></span>
                    Spritesheet PNG export is not yet supported.
                </div>
            </div>
        `);
    }
    
    _setupExample() {
        this._exampleScrollbar = new SimpleBar(this.$container.find('#example-text').get(0), {
            autoHide: false,
            forceVisible: true
        });
    }

    _setupEventListeners() {
        this.$container.find('select, input').on('change', () => {
            this._refresh();
        })

        const $width = this._getOptionInput('width');
        const $height = this._getOptionInput('height');

        $width.on('input', () => {
            const width = $width.val();
            const height = Math.round(width / state.numCols() * state.numRows() / fontRatio);
            $height.val(height);
            this._refreshDimensionsVisibility();
        });
        $height.on('input', () => {
            const height = $height.val();
            const width = Math.round(height / state.numRows() * state.numCols() * fontRatio);
            $width.val(width);
            this._refreshDimensionsVisibility();
        });

        this.$container.find('.set-default-dimensions').on('click', () => {
            $width.val(this._defaultWidth()).trigger('input');
        })
    }

    /**
     * Refreshes the visibility of various form components, and updates the example if applicable.
     */
    _refresh() {
        this.$container.find('[data-show-if]:not([data-show-if=""])').each((i, element) => {
            const $element = $(element);

            const conditions = $element.data('show-if'); // e.g. "format=txt,rtf;frames=spritesheet;"
            let conditionsMet = true;
            conditions.split(';')
                .filter(condition => !!condition) // Remove empty strings (e.g. if conditions ended with ;)
                .forEach(condition => {
                    const [name, allowedValuesStr] = condition.split('=');
                    const allowedValues = allowedValuesStr.split(',');
                    const actualValue = this._getOptionVal(name);
                    if (!actualValue || !allowedValues.includes(actualValue)) conditionsMet = false;
                })

            $element.toggleClass('hidden', !conditionsMet);
        });

        if (!state.getConfig('background')) {
            this.$container.find(`[name="background"]`).closest('label').addClass('hidden');
        }

        this._refreshDimensionsVisibility();

        this._refreshExample();
    }

    _refreshDimensionsVisibility() {
        this.$container.find('.set-default-dimensions')
            .toggleClass('hidden', parseInt(this._getOptionVal('width')) === this._defaultWidth())
    }

    _getOptionInput(name) {
        return this.$container.find(`[name="${name}"]`);
    }

    _getOptionVal(name) {
        return this._getOptionInput(name).val();
    }

    _defaultWidth() {
        // Default dimensions should be multiplied by the devicePixelRatio so that they don't appear
        // blurry when downloaded. Reducing the image size smaller can actually increase blurriness
        // due to rastering. https://stackoverflow.com/questions/55237929/ has a similar problem I faced.
        // return state.numCols() * DEFAULT_FONT_SIZE * window.devicePixelRatio

        // UPDATE: I am no longer multiplying by devicePixelRatio -- blur seems to be limited to small gifs
        // TODO Maybe multiply by window.devicePixelRatio if width is below some threshold?
        return state.numCols() * DEFAULT_FONT_SIZE;
    }

    _optimalSpritesheetLayout() {
        const frameCount = state.frames().length;

        if (frameCount <= 0) return { rows: 0, cols: 0 };

        const rows = Math.ceil(Math.sqrt(frameCount));
        const cols = Math.ceil(frameCount / rows);

        return { rows, cols };
    }

    _validateOption($input, name, value) {
        if (!VALIDATORS[name]) return true;

        switch(VALIDATORS[name].type) {
            case 'integer':
                value = parseInt(value);
                if (isNaN(value)) {
                    $input.addClass('error');
                    return false;
                }
                break;
            case 'float':
                value = parseFloat(value);
                if (isNaN(value)) {
                    $input.addClass('error');
                    return false
                }
                break;
            default:
                console.warn(`No validator found for: ${VALIDATORS[name].type}`);
        }
        return true;
    }

    _refreshExample() {
        const $example = this.$container.find('#example-container');
        if ($example.hasClass('hidden')) return;

        $example.find('#example-img').attr('src', exampleExportImg);

        let options;
        try {
            options = this.validateOptions();
        } catch (err) {
            if (err instanceof ValidationError) {
                console.log(err);
                $example.find('#example-text pre').html('Invalid options selected above.');
                return;
            } else {
                throw err;
            }
        }

        switch(this._getOptionVal('format')) {
            case 'json':
                return this._refreshJsonExample(options);
            default:
                console.warn(`No preview handler for ${this._getOptionVal('format')}`)
        }
    }

    _refreshJsonExample(options) {
        const $example = this.$container.find('#example-container');

        let frameExample = '';

        const getColor = (colorStr) => {
            const color = new Color(colorStr);
            switch (options.colorFormat) {
                case 'hex-str':
                    return `'${color.hex}'`
                case 'rgba-str':
                    return `'${color.rgbaString}'`
                case 'rgba-array':
                    return `[${color.rgba.join(',')}]`
                default:
                    return 'Invalid'
            }
        }
        const getCharRow = (str) => {
            return options.mergeCharRows ? `'${str}'` : `[${str.split('').map(char => `'${char}'`).join(', ')}]`
        }

        switch(options.frameStructure) {
            case 'array-chars':
                frameExample = dedent`
                {
                    fps: 0,
                    background: null,
                    frames: [
                        [
                            ${getCharRow('aa')},
                            ${getCharRow('bb')},
                            ${getCharRow('%!')},
                        ]
                    ]
                }
                `;
                break;
            case 'obj-chars':
                frameExample = dedent`
                {
                    fps: 0,
                    background: null,
                    frames: [
                        {
                            chars: [
                                ${getCharRow('aa')},
                                ${getCharRow('bb')},
                                ${getCharRow('%!')},
                            ]
                        }
                    ]
                }`
                break;
            case 'obj-chars-colors':
                frameExample = dedent`
                {
                    fps: 0,
                    background: null,
                    frames: [
                        {
                            chars: [
                                ${getCharRow('aa')},
                                ${getCharRow('bb')},
                                ${getCharRow('%!')},
                            ],
                            colors: [
                                [ ${getColor('#000000ff')}, ${getColor('#ff0000ff')} ],
                                [ ${getColor('#0000ffff')}, ${getColor('#ff0000ff')} ],
                                [ ${getColor('#00ff00ff')}, ${getColor('#ff0000ff')} ]
                            ]
                        }
                    ]
                }`
                break;
            case 'obj-chars-colors-colorTable':
                frameExample = dedent`
                {
                    fps: 0,
                    background: null,
                    frames: [
                        {
                            chars: [
                                ${getCharRow('aa')},
                                ${getCharRow('bb')},
                                ${getCharRow('%!')},
                            ],
                            colors: [
                                [ 0, 1 ],
                                [ 2, 1 ],
                                [ 3, 1 ]
                            ]
                        }
                    ],
                    colorTable: [
                        ${getColor('#000000ff')},
                        ${getColor('#ff0000ff')},
                        ${getColor('#0000ffff')},
                        ${getColor('#00ff00ff')}
                    ]
                }`
                break;
            default:
                console.warn(`Unknown frameStructure: ${options.frameStructure}`);
        }

        $example.find('#example-text pre').html(frameExample);
        this._exampleScrollbar.recalculate();
    }


}