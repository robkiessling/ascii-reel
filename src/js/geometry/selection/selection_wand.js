import * as state from "../../state/state.js";
import Cell from "../cell.js";
import SelectionPolygon from "./selection_polygon.js";

/**
 * SelectionWand starts with a single cell and then finds all connected cells of the same color.
 * Supports the following options:
 * - diagonal: (boolean) Whether to include diagonally adjacent cells or not
 * - colorblind (boolean) If true, finds connected cells regardless of color.
 */
export default class SelectionWand extends SelectionPolygon {

    get cells() {
        return this._cells;
    }

    iterateCells(callback) {
        this._cells.forEach(cell => callback(cell.row, cell.col));
    }

    draw(context) {
        this._cells.forEach(cell => {
            if (cell.isInBounds()) {
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
        const cellHash = {};
        const [startChar, startColor] = state.getCurrentCelGlyph(this.start.row, this.start.col);
        const isBlank = startChar === '';
        const charblind = this.options.charblind;
        const colorblind = this.options.colorblind;
        const diagonal = this.options.diagonal;

        // A unique way of identifying a cell (for Set lookup purposes)
        function cellKey(cell) {
            return `${cell.row},${cell.col}`
        }

        function spread(cell) {
            if (cellHash[cellKey(cell)] === undefined) {
                const [char, color] = state.getCurrentCelGlyph(cell.row, cell.col);
                if (char === undefined) return;

                // If starting character was blank, only keep blank cells. Otherwise only keep non-blank cells
                if (isBlank ? char !== '' : char === '') return;

                // Character values have to match unless charblind option is true
                if (!isBlank && !charblind && char !== startChar) return;

                // Character colors have to match unless colorblind option is true
                if (!isBlank && !colorblind && color !== startColor) return;

                // Add cell to result
                cellHash[cellKey(cell)] = new Cell(cell.row, cell.col);

                // Recursive call to adjacent cells (note: not instantiating full Cell objects for performance reasons)
                spread({ row: cell.row - 1, col: cell.col });
                spread({ row: cell.row, col: cell.col + 1 });
                spread({ row: cell.row + 1, col: cell.col });
                spread({ row: cell.row, col: cell.col - 1 });

                if (diagonal) {
                    spread({ row: cell.row - 1, col: cell.col - 1 });
                    spread({ row: cell.row - 1, col: cell.col + 1 });
                    spread({ row: cell.row + 1, col: cell.col + 1 });
                    spread({ row: cell.row + 1, col: cell.col - 1 });
                }
            }
        }

        spread(this.start);

        this._cells = Object.values(cellHash);
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