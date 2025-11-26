import {AXES, DIRECTIONS} from "../../../config/shapes.js";

export function longerAxis(startCell, endCell) {
    const rowDelta = endCell.row - startCell.row;
    const colDelta = endCell.col - startCell.col;
    return Math.abs(rowDelta) >= Math.abs(colDelta) ? AXES.VERTICAL : AXES.HORIZONTAL;
}

export function axisForDir(dir) {
    switch (dir) {
        case DIRECTIONS.UP:
        case DIRECTIONS.DOWN:
            return AXES.VERTICAL;
        case DIRECTIONS.LEFT:
        case DIRECTIONS.RIGHT:
            return AXES.HORIZONTAL;
        default:
            throw new Error(`Cannot get axis for ${dir}`)
    }
}

export function directionFrom(cellA, cellB) {
    if (longerAxis(cellA, cellB) === AXES.VERTICAL) {
        return cellB.row >= cellA.row ? DIRECTIONS.DOWN : DIRECTIONS.UP;
    } else {
        return cellB.col >= cellA.col ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    }
}