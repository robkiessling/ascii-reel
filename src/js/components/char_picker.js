import SimpleBar from "simplebar";
import {isObject} from "../utils/objects.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../config/chars.js";


const SPECIAL_CHARS = new Map(Object.entries({
    [EMPTY_CHAR]: { label: 'Empty', value: EMPTY_CHAR, wellClass: 'ri-delete-back-2-line', large: true },
    [WHITESPACE_CHAR]: { label: 'Space', value: WHITESPACE_CHAR, wellClass: 'ri-space' },
}))
const WELL_CLASSES = [...SPECIAL_CHARS.values()].map(special => special.wellClass).filter(Boolean);
const ASCII_TITLE = 'ASCII';
const UNICODE_TITLE = 'Unicode';
const SPACER = '__spacer__'
const BREAK = '__break__'

const CHARS = [
    ASCII_TITLE,
    [
        SPECIAL_CHARS.get(EMPTY_CHAR), SPACER, SPECIAL_CHARS.get(WHITESPACE_CHAR)
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

const DEFAULT_OPTIONS = {
    initialValue: "A",
    popupDirection: 'right',
    popupOffset: 34
}

/**
 * A CharPicker is similar to a color picker, but for selecting chars.
 */
export default class CharPicker {
    /**
     * @param $container - jQuery element for the picker container
     * @param {Object} options - Picker options
     * @param {string} [options.initialValue="A"] - Initial char value
     * @param {"right"|"bottom"} [options.popupDirection="right"] - Direction to open popup
     * @param {Number} [options.popupOffset=34] - Amount to offset popup
     * @param {function} [options.onOpen] - Callback when picker is opened
     * @param {function} [options.onClose] - Callback when picker is closed
     * @param {function} [options.onLoad] - Callback when picker value is set for the first time
     * @param {function} [options.onChange] - Callback when picker value changes
     */
    constructor($container, options = {}) {
        this.$well = $container.find('.char-well');
        this.options = { ...DEFAULT_OPTIONS, ...options };

        this._init();
        this.value(this.options.initialValue, true)
        if (this.options.onLoad) this.options.onLoad(this.value())
    }

    _init() {
        this._buildPopupHTML();

        this._handleOutsideClick = e => {
            if (!this.$popup[0].contains(e.target) && !this.$well[0].contains(e.target)) {
                this.close()
            }
        };

        this.$well.on('click', () => this.toggle())

        this.$popup.on('click', '.char', e => {
            this.value($(e.currentTarget).attr('data-char'))
            this.close();
        });

        this.$popup.addClass(`position-${this.options.popupDirection}`)
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

    open() {
        window.addEventListener('click', this._handleOutsideClick, true);

        let position;
        switch(this.options.popupDirection) {
            case 'bottom':
                position = { my: "left top", at: `left bottom+${this.options.popupOffset}`, of: this.$well }
                break;
            case 'right':
                position = { my: "left bottom", at: `right+${this.options.popupOffset} bottom`, of: this.$well }
                break;
            default:
                console.warn(`Invalid char_picker popupDirection: ${this.options.popupDirection}`)
                return;
        }

        this.$popup.show().position(position);

        if (this.options.onOpen) this.options.onOpen();
    }
    close() {
        window.removeEventListener('click', this._handleOutsideClick, true);

        this.$popup.hide();

        if (this.options.onClose) this.options.onClose();
    }
    toggle(open) {
        if (open === undefined) {
            this.isOpen ? this.close() : this.open();
        }
        else {
            open ? this.open() : this.close();
        }
    }

    /**
     * Sets and gets the char picker value
     * @param {String} [newValue] - If defined, sets the value of char picker. If undefined, char picker is not changed
     * @param {Boolean} [silent=true] - If true, onChange event is not fired
     * @returns {String} - Current value of the char picker
     */
    value(newValue, silent = false) {
        if (newValue !== undefined) {
            this._value = newValue;

            this.$popup.find('.char').removeClass('selected');
            this.$popup.find(`.char[data-char="${this._value}"]`).addClass('selected');

            const special = SPECIAL_CHARS.get(this._value);
            this.$well.html(special && special.wellClass ? '' : this._value);
            this.$well.removeClass(WELL_CLASSES.join(' '))
            if (special && special.wellClass) this.$well.addClass(special.wellClass);

            if (!silent && this.options.onChange) this.options.onChange(newValue);
        }

        return this._value;
    }
}