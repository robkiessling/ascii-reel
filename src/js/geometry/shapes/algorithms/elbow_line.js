/**
 * Note: We don't draw elbow lines anymore, so this file is not in use
 */

import {SHAPE_TYPES, STROKE_OPTIONS} from "../constants.js";
import Cell from "../../cell.js";
import {isObject} from "../../../utils/objects.js";

const ELBOW_CHARS = {
    ascii: {
        LINE: {
            UP: '|',
            RIGHT: '-',
            DOWN: '|',
            LEFT: '-',
        },
        BEND: '+',
    },
    unicode: {
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
    monochar: char => {
        return {
            LINE: char,
            BEND: char
        }
    }
}

export function elbowPath(start, end, stroke, char, callback) {
    const bend = getBend(stroke, start, end);
    const charSheet = getCharSheet(stroke, char);

    const processLine = (fromCell, toCell) => {
        fromCell.lineTo(toCell, false).forEach(cell => {
            callback(cell, getChar(charSheet, 'LINE', fromCell, toCell))
        })
    }

    if (bend.equals(start) || bend.equals(end)) {
        // There is no bend; go straight from start to end
        callback(start, getChar(charSheet, 'START', start, end));
        processLine(start, end);
        callback(end, getChar(charSheet, 'END', start, end));
    } else {
        // There is a bend; go from start to bend to end
        callback(start, getChar(charSheet, 'START', start, bend));
        processLine(start, bend);
        callback(bend, getChar(charSheet, 'BEND', start, bend, end));
        processLine(bend, end);
        callback(end, getChar(charSheet, 'END', bend, end));
    }
}

function getBend(stroke, start, end) {
    switch(stroke) {
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_ASCII_VH:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_UNICODE_VH:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_MONOCHAR_VH:
            return new Cell(end.row, start.col);
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_ASCII_HV:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_UNICODE_HV:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_MONOCHAR_HV:
            return new Cell(start.row, end.col);
        default:
            throw new Error(`Invalid stroke: ${stroke}`)
    }
}

function getCharSheet(stroke, char) {
    switch(stroke) {
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_ASCII_VH:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_ASCII_HV:
            return ELBOW_CHARS.ascii;
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_UNICODE_VH:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_UNICODE_HV:
            return ELBOW_CHARS.unicode;
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_MONOCHAR_VH:
        case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_MONOCHAR_HV:
            return ELBOW_CHARS.monochar(char);
        default:
            throw new Error(`Invalid stroke: ${stroke}`)
    }
}

/**
 * Retrieves a char based on the direction between the provided cells.
 * - If 2 cells are provided, direction will be singular like DOWN or RIGHT
 * - If 3 cells are provided, direction will have multiple parts like DOWN_RIGHT or RIGHT_UP
 * @param charSheet
 * @param type
 * @param cells
 */
function getChar(charSheet, type, ...cells) {
    if (charSheet[type] === undefined) type = 'LINE';
    if (!isObject(charSheet[type])) return charSheet[type];

    const directions = [];

    for (let i = 1; i < cells.length; i++) {
        const fromCell = cells[i - 1];
        const toCell = cells[i];
        if ((fromCell.row !== toCell.row) && (fromCell.col !== toCell.col)) {
            console.warn('Cell points must be along a horizontal or vertical line')
            return '?';
        } else if (fromCell.row < toCell.row) {
            directions.push('DOWN')
        } else if (fromCell.row > toCell.row) {
            directions.push('UP')
        } else if (fromCell.col < toCell.col) {
            directions.push('RIGHT')
        } else if (fromCell.col > toCell.col) {
            directions.push('LEFT')
        } else {
            directions.push('DOWN') // No movement; default is to show DOWN icon
        }
    }

    const direction = directions.join('_')
    return charSheet[type][direction];
}










