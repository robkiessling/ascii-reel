import Cell from "../../cell.js";

/**
 * Returns cells in a square shape, centered around the primaryCell.
 * @param {Cell} primaryCell
 * @param {number} size
 * @returns {Cell[]}
 */
export function squareBrushCells(primaryCell, size) {
    const result = []
    const offset = Math.floor(size / 2);

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            result.push(new Cell(primaryCell.row - offset + row, primaryCell.col - offset + col));
        }
    }
    return result;
}

/**
 * Returns cells in a diamond shape, centered around the primaryCell.
 * @param {Cell} primaryCell
 * @param {number} size
 * @returns {Cell[]}
 */
export function diamondBrushCells(primaryCell, size) {
    const result = [];
    const radius = Math.floor((size - 1) / 2);

    for (let row = -radius; row <= radius; row++) {
        for (let col = -radius; col <= radius; col++) {
            if (Math.abs(col) + Math.abs(row) <= radius) {
                result.push(new Cell(primaryCell.row + row, primaryCell.col + col));
            }
        }
    }

    return result;
}
