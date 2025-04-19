import DrawingLine from "./base.js";
import {isObject} from "../../../utils/objects.js";
import Cell from "../../cell.js";


const RIGHT_ANGLE_CHARS = {
    'elbow-line-ascii': {
        LINE: {
            UP: '|',
            RIGHT: '-',
            DOWN: '|',
            LEFT: '-',
        },
        BEND: '+',
    },
    'elbow-arrow-ascii': {
        LINE: {
            UP: '|',
            RIGHT: '-',
            DOWN: '|',
            LEFT: '-',
        },
        BEND: '+',
        END: {
            UP: '^',
            RIGHT: '>',
            DOWN: 'v',
            LEFT: '<',
        }
    },
    'elbow-line-unicode': {
        LINE: {
            UP: '│',
            RIGHT: '─',
            DOWN: '│',
            LEFT: '─',
        },
        BEND: {
            UP_RIGHT: '┌',
            UP_LEFT: '┐',
            RIGHT_UP: '┘',
            RIGHT_DOWN: '┐',
            DOWN_RIGHT: '└',
            DOWN_LEFT: '┘',
            LEFT_UP: '└',
            LEFT_DOWN: '┌'
        },
    },
    'elbow-arrow-unicode': {
        LINE: {
            UP: '│',
            RIGHT: '─',
            DOWN: '│',
            LEFT: '─',
        },
        BEND: {
            UP_RIGHT: '┌',
            UP_LEFT: '┐',
            RIGHT_UP: '┘',
            RIGHT_DOWN: '┐',
            DOWN_RIGHT: '└',
            DOWN_LEFT: '┘',
            LEFT_UP: '└',
            LEFT_DOWN: '┌'
        },
        END: {
            UP: '▲',
            RIGHT: '▶',
            DOWN: '▼',
            LEFT: '◀',
        }
    },
    'elbow-line-monochar': char => {
        return {
            LINE: char
        }
    }
}

export default class ElbowLine extends DrawingLine {
    recalculate(changeRoute) {
        this._setCharSheet(RIGHT_ANGLE_CHARS);
        this._initGlyphsToBoundingArea();

        const bend = changeRoute ? new Cell(this.start.row, this.end.col) : new Cell(this.end.row, this.start.col);
        
        if (bend.equals(this.start) || bend.equals(this.end)) {
            // There is no bend; just need start-->end
            this._setGlyph(this.start, this._getChar('START', this.start, this.end));
            this._setGlyphsAlongLine(this.start, this.end);
            this._setGlyph(this.end, this._getChar('END', this.start, this.end));
        }
        else {
            // There is a bend; need start-->bend-->end
            this._setGlyph(this.start, this._getChar('START', this.start, bend));
            this._setGlyphsAlongLine(this.start, bend);
            this._setGlyph(bend, this._getChar('BEND', this.start, bend, this.end));
            this._setGlyphsAlongLine(bend, this.end);
            this._setGlyph(this.end, this._getChar('END', bend, this.end));
        }
    }

    _setGlyph(cell, char) {
        if (char !== undefined) {
            super._setGlyph(cell.relativeTo(this.origin), char, this.options.colorIndex);
        }
    }

    _setGlyphsAlongLine(fromCell, toCell) {
        fromCell.lineTo(toCell, false).forEach(cell => {
            this._setGlyph(cell, this._getChar('LINE', fromCell, toCell))
        })
    }

    // Retrieves a char based on the direction between provided cells.
    //   - if 2 cells are provided, direction will be something like DOWN or RIGHT
    //   - if 3 cells are provided, direction will have a bend, e.g. DOWN_RIGHT or RIGHT_UP
    _getChar(type, ...cells) {
        if (this.charSheet[type] === undefined) type = 'LINE';
        if (!isObject(this.charSheet[type])) return this.charSheet[type];

        const directions = [];
        for (let i = 1; i < cells.length; i++) {
            const fromCell = cells[i - 1];
            const toCell = cells[i];
            if ((fromCell.row !== toCell.row) && (fromCell.col !== toCell.col)) {
                console.warn('Cell points must be along a horizontal or vertical line')
            } else if (fromCell.row < toCell.row) {
                directions.push('DOWN')
            } else if (fromCell.row > toCell.row) {
                directions.push('UP')
            } else if (fromCell.col < toCell.col) {
                directions.push('RIGHT')
            } else if (fromCell.col > toCell.col) {
                directions.push('LEFT')
            } else {
                directions.push('DOWN') // No movement; just show DOWN icon
            }
        }

        const direction = directions.join('_')
        return this.charSheet[type][direction];
    }


}