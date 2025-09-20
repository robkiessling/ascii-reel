import Cell from "../cell.js";
import SelectionShape from "./shape.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import {SELECTION_SHAPE_TYPES} from "./constants.js";
import {getCurrentCelGlyph, isCellInBounds} from "../../state/index.js";

/**
 * WandSelection starts with a single cell and then finds all connected cells of the same color.
 * Supports the following options:
 * - diagonal: (boolean) Whether to include diagonally adjacent cells or not
 * - colorblind (boolean) If true, finds connected cells regardless of color.
 */
export default class WandSelection extends SelectionShape {
    static type = SELECTION_SHAPE_TYPES.WAND;

    serialize() {
        return { type: this.type, cells: this._cells.map(cell => cell.serialize()) };
    }

    static deserialize(data) {
        const wand = new WandSelection(null, null);
        wand._cells = data.cells.map(cell => Cell.deserialize(cell));
        wand._cacheEndpoints();
        wand.completed = true;
        return wand;
    }

    get cells() {
        return this._cells;
    }

    iterateCells(callback) {
        this._cells.forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this._cells.forEach(cell => {
            if (isCellInBounds(cell)) {
                context.fillRect(...cell.xywh);
            }
        });
    }

    get topLeft() {
        return this._topLeft; // Using a cached value
    }

    get bottomRight() {
        return this._bottomRight; // Using a cached value
    }

    translate(rowDelta, colDelta) {
        this._cells.forEach(cell => {
            cell.row += rowDelta;
            cell.col += colDelta;
        });

        this._cacheEndpoints();
    }

    flipVertically(flipRow) {
        this._cells.forEach(cell => {
            cell.row = flipRow(cell.row);
        })

        this._cacheEndpoints();
    }

    flipHorizontally(flipCol) {
        this._cells.forEach(cell => {
            cell.col = flipCol(cell.col);
        })

        this._cacheEndpoints();
    }

    complete() {
        const [startChar, startColor] = getCurrentCelGlyph(this.start.row, this.start.col);
        const isBlank = startChar === EMPTY_CHAR;
        const charblind = this.options.charblind;
        const colorblind = this.options.colorblind;
        const diagonal = this.options.diagonal;

        // A unique way of identifying a cell
        const key = (cell) => `${cell.row},${cell.col}`;

        // Performing a breadth-first search (using a queue) to get all connected cells.
        const queue = [this.start.clone()];
        const visitedCells = {};

        while (queue.length > 0) {
            const cell = queue.shift();

            if (visitedCells[key(cell)]) continue; // Skip cell if we've already visited it

            const [char, color] = getCurrentCelGlyph(cell.row, cell.col);
            if (char === undefined) continue; // Skip cell if out of bounds

            // If starting character was blank, only keep blank cells. Otherwise only keep non-blank cells
            if (isBlank ? char !== EMPTY_CHAR : char === EMPTY_CHAR) continue;

            // Character values have to match unless charblind option is true
            if (!isBlank && !charblind && char !== startChar) continue;

            // Character colors have to match unless colorblind option is true
            if (!isBlank && !colorblind && color !== startColor) continue;

            visitedCells[key(cell)] = cell;

            queue.push(new Cell(cell.row + 1, cell.col));
            queue.push(new Cell(cell.row - 1, cell.col));
            queue.push(new Cell(cell.row, cell.col + 1));
            queue.push(new Cell(cell.row, cell.col - 1));

            if (diagonal) {
                queue.push(new Cell(cell.row + 1, cell.col + 1));
                queue.push(new Cell(cell.row + 1, cell.col - 1));
                queue.push(new Cell(cell.row - 1, cell.col + 1));
                queue.push(new Cell(cell.row - 1, cell.col - 1));
            }
        }

        this._cells = Object.values(visitedCells);
        this._cacheEndpoints();

        super.complete();
    }

    _cacheEndpoints() {
        const minRow = Math.min(...this._cells.map(cell => cell.row));
        const maxRow = Math.max(...this._cells.map(cell => cell.row));
        const minCol = Math.min(...this._cells.map(cell => cell.col));
        const maxCol = Math.max(...this._cells.map(cell => cell.col));

        this._topLeft = new Cell(minRow, minCol);
        this._bottomRight = new Cell(maxRow, maxCol);
    }

}