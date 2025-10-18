import Cell from "../../cell.js";
import CellArea from "../../cell_area.js";
import {AXES, DIRECTIONS} from "../constants.js";


export function orthogonalConnector(startCell, endCell, callback) {
    let startDir, endDir;
    if (longerAxis(startCell, endCell) === AXES.VERTICAL) {
        startDir = endCell.row >= startCell.row ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        endDir = endCell.row >= startCell.row ? DIRECTIONS.UP : DIRECTIONS.DOWN;
    } else {
        startDir = endCell.col >= startCell.col ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        endDir = endCell.col >= startCell.col ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
    }
    simpleConnector(startCell, startDir, endCell, endDir, callback);
}

function longerAxis(startCell, endCell) {
    const rowDelta = endCell.row - startCell.row;
    const colDelta = endCell.col - startCell.col;
    return Math.abs(rowDelta) >= Math.abs(colDelta) ? AXES.VERTICAL : AXES.HORIZONTAL;
}

/**
 * A "simple" connection between two points
 * @param startCell
 * @param startDir
 * @param endCell
 * @param endDir
 * @param callback
 */
function simpleConnector(startCell, startDir, endCell, endDir, callback) {
    if (startDir === endDir) throw new Error(`Cannot have same start/end direction: ${startDir}`)
    validateSimpleConnEndpoint(startDir, startCell, endCell);
    validateSimpleConnEndpoint(endDir, endCell, startCell);

    if (canBeStraightLine(startCell, startDir, endCell, endDir)) {
        straightLine(startCell, startDir, endCell, endDir, callback)
    } else if (isOpposite(startDir, endDir)) {
        doubleElbowLine(startCell, startDir, endCell, endDir, callback)
    } else {
        singleElbowLine(startCell, startDir, endCell, endDir, callback)
    }
}

function validateSimpleConnEndpoint(direction, fromCell, toCell) {
    if (
        (direction === DIRECTIONS.UP && fromCell.row < toCell.row) ||
        (direction === DIRECTIONS.RIGHT && fromCell.col > toCell.col) ||
        (direction === DIRECTIONS.DOWN && fromCell.row > toCell.row) ||
        (direction === DIRECTIONS.LEFT && fromCell.col < toCell.col)
    ) throw new Error(`Cannot move in ${direction} direction from ${fromCell} to ${toCell}`);
}

function canBeStraightLine(startCell, startDir, endCell, endDir) {
    if (startDir !== oppositeDir(endDir)) return false;

    switch(startDir) {
        case DIRECTIONS.UP:
            return startCell.row >= endCell.row && startCell.col === endCell.col;
        case DIRECTIONS.RIGHT:
            return startCell.col <= endCell.col && startCell.row === endCell.row;
        case DIRECTIONS.DOWN:
            return startCell.row <= endCell.row && startCell.col === endCell.col;
        case DIRECTIONS.LEFT:
            return startCell.col >= endCell.col && startCell.row === endCell.row;
        default:
            throw new Error(`Invalid startDir ${startDir}`)
    }
}

function straightLine(startCell, startDir, endCell, endDir, callback) {
    if (!startCell.equals(endCell)) callback(startCell, charFor(startDir, true));
    exclusiveLine(startCell, endCell, callback);
    callback(endCell, charFor(endDir, true));
}

function singleElbowLine(startCell, startDir, endCell, endDir, callback) {
    let bend;
    if (isVertical(startDir)) {
        bend = new Cell(endCell.row, startCell.col)
    } else {
        bend = new Cell(startCell.row, endCell.col)
    }

    callback(startCell, charFor(startDir, true))
    exclusiveLine(startCell, bend, callback);
    callback(bend, charFor(directionBetween(startCell, bend, endCell), false))
    exclusiveLine(bend, endCell, callback);
    callback(endCell, charFor(endDir, true))
}

function doubleElbowLine(startCell, startDir, endCell, endDir, callback) {
    const area = CellArea.fromCells([startCell, endCell]);
    if (area.numRows <= 2 && area.numCols <= 2) {
        // Edge case - cannot draw a double elbow line nicely since there is not enough room for two bends
        // We do not fallback to a singleElbowLine; we need directions to stay as they are. Instead, we just
        // draw the doubleElbowLine poorly.
        const bend = new Cell(startCell.row, endCell.col);
        callback(startCell, charFor(startDir, true))
        callback(bend, charFor(directionBetween(startCell, bend, endCell), false))
        callback(endCell, charFor(endDir, true))
        return;
    }

    let bend1, bend2;
    if (longerAxis(startCell, endCell) === AXES.VERTICAL) {
        const midRow = Math.floor((startCell.row + endCell.row) / 2);
        bend1 = new Cell(midRow, startCell.col)
        bend2 = new Cell(midRow, endCell.col)
    } else {
        const midCol = Math.floor((startCell.col + endCell.col) / 2);
        bend1 = new Cell(startCell.row, midCol);
        bend2 = new Cell(endCell.row, midCol);
    }
    callback(startCell, charFor(startDir, true))
    exclusiveLine(startCell, bend1, callback);
    callback(bend1, charFor(directionBetween(startCell, bend1, bend2), false))
    exclusiveLine(bend1, bend2, callback);
    callback(bend2, charFor(directionBetween(bend1, bend2, endCell), false))
    exclusiveLine(bend2, endCell, callback);
    callback(endCell, charFor(endDir, true))
}

function exclusiveLine(fromCell, toCell, callback) {
    const direction = directionBetween(fromCell, toCell);
    fromCell.lineTo(toCell, false).forEach(cell => callback(cell, charFor(direction, false)))
}

function directionBetween(...cells) {
    const directions = [];
    for (let i = 1; i < cells.length; i++) {
        const fromCell = cells[i - 1];
        const toCell = cells[i];
        if ((fromCell.row !== toCell.row) && (fromCell.col !== toCell.col)) {
            throw new Error('Cell points must be along a horizontal or vertical line')
        } else if (fromCell.row < toCell.row) {
            directions.push(DIRECTIONS.DOWN)
        } else if (fromCell.row > toCell.row) {
            directions.push(DIRECTIONS.UP)
        } else if (fromCell.col < toCell.col) {
            directions.push(DIRECTIONS.RIGHT)
        } else if (fromCell.col > toCell.col) {
            directions.push(DIRECTIONS.LEFT)
        } else {
            directions.push(DIRECTIONS.DOWN) // No movement; just show DOWN icon
        }
    }

    return directions.join('-')
}


// Note: arrowhead goes in opposite direction of connection direction
function charFor(dir, isEndpoint) {
    switch (dir) {
        case DIRECTIONS.UP:
            return isEndpoint ? 'v' : '|';
        case DIRECTIONS.RIGHT:
            return isEndpoint ? '<' : '-';
        case DIRECTIONS.DOWN:
            return isEndpoint ? '^' : '|';
        case DIRECTIONS.LEFT:
            return isEndpoint ? '>' : '-';
        case DIRECTIONS.UP_RIGHT:
        case DIRECTIONS.UP_LEFT:
        case DIRECTIONS.RIGHT_UP:
        case DIRECTIONS.RIGHT_DOWN:
        case DIRECTIONS.DOWN_RIGHT:
        case DIRECTIONS.DOWN_LEFT:
        case DIRECTIONS.LEFT_UP:
        case DIRECTIONS.LEFT_DOWN:
            return '+';
        default:
            throw new Error(`Invalid direction: ${dir}`)
    }
}

function oppositeDir(dir) {
    switch (dir) {
        case DIRECTIONS.UP:
            return DIRECTIONS.DOWN;
        case DIRECTIONS.RIGHT:
            return DIRECTIONS.LEFT;
        case DIRECTIONS.DOWN:
            return DIRECTIONS.UP;
        case DIRECTIONS.LEFT:
            return DIRECTIONS.RIGHT;
        default:
            throw new Error(`Cannot get opposite of ${dir}`)
    }
}

function isOpposite(dir1, dir2) {
    return dir1 === oppositeDir(dir2);
}

function isVertical(dir) {
    return dir === DIRECTIONS.UP || dir === DIRECTIONS.DOWN;
}
function isHorizontal(dir) {
    return dir === DIRECTIONS.LEFT || dir === DIRECTIONS.RIGHT;
}
