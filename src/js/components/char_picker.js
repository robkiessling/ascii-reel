import SimpleBar from "simplebar";
import {isObject} from "../utils/objects.js";

const EMPTY = { label: 'Empty', value: '' }
const WHITESPACE = { label: 'Space', value: ' ' }
const ASCII_TITLE = 'ASCII';
const UNICODE_TITLE = 'Unicode';
const SPACER = '__spacer__'
const BREAK = '__break__'

const CHARS = [
    ASCII_TITLE,
    [
        EMPTY, SPACER, WHITESPACE
    ],
    [
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
        'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
        'w', 'x', 'y', 'z'
    ],
    [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
        'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
        'W', 'X', 'Y', 'Z'
    ],
    [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ],
    [
        '?', '@', '#', '$', '%', '&', '*', '+', SPACER, SPACER, '(', ')', '[', ']', '{', '}', '<', '>', '^',
    ],
    [
        '_', ',', '.', '-', '~', '=', "'", '"', '`', SPACER, '/', '|', '\\', ';', ':', '!',
    ],
    UNICODE_TITLE,
    [
        '‗', '…', '—', '≈', '·', '•', '°', '¨', '´', '¯', SPACER, '¦', '†', '‡', '¡', BREAK,
    ],
    [
        'Ì', 'Í', 'Î', 'Ï', 'ì', 'í', 'î', 'ï', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø',
    ],
    [
        '≡', '÷', '×', '±', '∑', 'φ', '∞', 'Ω', 'Φ', 'π', '√', '∩', '¶', '§', '¿', '¤', BREAK,
        '∆', '∇', 'Λ', 'λ', '‹', '›', '«', '»', '≤', '≥', '←', '↑', '→', '↓', '↔', '↕', '↖', '↗', '↘', '↙', BREAK,
        '░', '▒', '▓', '█', '▌', '▐', '▄', '■', '▀', '▲', '▶', '▼', '◀', '△', '▷', '▽', '◁', '★', '☆',
    ],
    [
        '┌', '┬', '┐', SPACER, SPACER, '╔', '╦', '╗', SPACER, BREAK,
        '├', '┼', '┤', '│',    SPACER, '╠', '╬', '╣', '║', BREAK,
        '└', '┴', '┘', '─',    SPACER, '╚', '╩', '╝', '═', BREAK
    ],

]

/**
 * A CharPicker is similar to a color picker, but for selecting chars.
 */
export default class CharPicker {
    /**
     * @param $well - jQuery element for the picker well
     * @param {Object} options - Picker options
     * @param {function} [options.initialValue] - Initial char value
     * @param {function} [options.onOpen] - Callback when picker is opened
     * @param {function} [options.onClose] - Callback when picker is closed
     * @param {function} [options.onChange] - Callback when picker value changes. Will be called when initial value is set.
     */
    constructor($well, options = {}) {
        this.$well = $well;
        this.options = options;

        this._init();
        this.value(this.options.initialValue || 'A')
    }

    _init() {
        this._buildPopupHTML();

        this._handleOutsideClick = e => {
            if (!this.$popup[0].contains(e.target) && !this.$well[0].contains(e.target)) {
                this._close()
            }
        };

        this.$well.on('click', () => this._toggle())

        this.$popup.on('click', '.char', e => {
            this.value($(e.currentTarget).data('char'))
            this._close();
        });
    }

    _buildPopupHTML() {
        this.$popup = $('<div>', {
            class: 'char-picker-popup',
        }).appendTo($('body')).hide();

        let $list = $('<div>', {
            class: 'char-list'
        }).appendTo(this.$popup);

        this.simpleBar = new SimpleBar($list.get(0), {
            autoHide: false,
            forceVisible: true
        });
        $list = $(this.simpleBar.getContentElement());

        CHARS.forEach(section => {
            if (Array.isArray(section)) {
                const $section = $('<div>', {
                    class: 'char-section'
                }).appendTo($list);
                section.forEach(char => {
                    if (char === SPACER) {
                        $('<div>', { class: 'spacer' }).appendTo($section);
                    }
                    else if (char === BREAK) {
                        $('<div>', { class: 'break' }).appendTo($section);
                    }
                    else {
                        const label = isObject(char) ? char.label : char;
                        const value = isObject(char) ? char.value : char;
                        $('<div>', {
                            class: `char ${label.length > 1 ? 'large' : ''}`,
                            html: label,
                            'data-char': value
                        }).appendTo($section);
                    }
                })
            }
            else {
                // Is title
                $('<div>', {
                    class: 'section-title no-select',
                    html: section
                }).appendTo($list);
            }
        })
    }

    get isOpen() {
        return this.$popup.is(':visible');
    }

    _open() {
        window.addEventListener('click', this._handleOutsideClick, true);

        this.$popup.show().position({
            my: "left bottom",
            at: "right+34 bottom",
            of: this.$well
        });

        if (this.options.onOpen) this.options.onOpen();
    }
    _close() {
        window.removeEventListener('click', this._handleOutsideClick, true);

        this.$popup.hide();

        if (this.options.onClose) this.options.onClose();
    }
    _toggle() {
        this.isOpen ? this._close() : this._open();
    }

    value(newValue) {
        if (newValue !== undefined) {
            this._value = newValue;
            this.$well.html(this._value);
            this.$well.toggleClass('empty', this._value === '');
            if (this.options.onChange) this.options.onChange(newValue);
        }

        return this._value;
    }
}