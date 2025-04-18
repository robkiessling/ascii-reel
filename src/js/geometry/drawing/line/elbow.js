import DrawingLine from "./base.js";
import {create2dArray} from "../../../utils/arrays.js";
import {isObject} from "../../../utils/objects.js";
import Cell from "../../cell.js";
import {isFunction} from "../../../utils/utilities.js";


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
        let charSheet = RIGHT_ANGLE_CHARS[this.options.drawType];
        if (isFunction(charSheet)) charSheet = charSheet(this.options.char);

        if (charSheet === undefined) {
            console.error("Invalid char sheet for: ", this.options.drawType)
            return;
        }

        const numRows = Math.abs(this.start.row - this.end.row) + 1
        const numCols = Math.abs(this.start.col - this.end.col) + 1
        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols)
        }

        const getCharBetween = (type, ...cells) => {
            const direction = getDirectionBetweenCells(...cells);
            if (charSheet[type] === undefined) type = 'LINE';
            return isObject(charSheet[type]) ? charSheet[type][direction] : charSheet[type];
        }
        const getDirectionBetweenCells = (...cells) => {
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

            return directions.join('_')
        }
        const setGlyph = (row, col, char) => {
            if (char !== undefined) {
                this._glyphs.chars[row][col] = char;
                this._glyphs.colors[row][col] = this.options.colorIndex;
            }
        }
        const straightLineBetween = (fromCell, toCell, char) => {
            if (fromCell.row === toCell.row) {
                if (fromCell.col <= toCell.col) {
                    for (let c = fromCell.col + 1; c < toCell.col; c++) setGlyph(fromCell.row, c, char);
                }
                else {
                    for (let c = fromCell.col - 1; c > toCell.col; c--) setGlyph(fromCell.row, c, char);
                }
            }
            else if (fromCell.col === toCell.col) {
                if (fromCell.row <= toCell.row) {
                    for (let r = fromCell.row + 1; r < toCell.row; r++) setGlyph(r, fromCell.col, char);
                }
                else {
                    for (let r = fromCell.row - 1; r > toCell.row; r--) setGlyph(r, fromCell.col, char);
                }
            }
            else {
                console.warn(`Cannot draw straight line between ${fromCell} and ${toCell}`)
            }
        }

        this._origin = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col))
        const relativeStart = this.start.relativeTo(this._origin);
        const relativeEnd = this.end.relativeTo(this._origin);
        let bend = changeRoute ? new Cell(relativeStart.row, relativeEnd.col) : new Cell(relativeEnd.row, relativeStart.col);

        if (bend.equals(relativeStart) || bend.equals(relativeEnd)) {
            // There is no bend
            setGlyph(relativeStart.row, relativeStart.col, getCharBetween('START', relativeStart, relativeEnd));
            straightLineBetween(relativeStart, relativeEnd, getCharBetween('LINE', relativeStart, relativeEnd));
            setGlyph(relativeEnd.row, relativeEnd.col, getCharBetween('END', relativeStart, relativeEnd));
        }
        else {
            setGlyph(relativeStart.row, relativeStart.col, getCharBetween('START', relativeStart, bend));
            straightLineBetween(relativeStart, bend, getCharBetween('LINE', relativeStart, bend));
            setGlyph(bend.row, bend.col, getCharBetween('BEND', relativeStart, bend, relativeEnd));
            straightLineBetween(bend, relativeEnd, getCharBetween('LINE', bend, relativeEnd));
            setGlyph(relativeEnd.row, relativeEnd.col, getCharBetween('END', bend, relativeEnd));
        }
    }


}