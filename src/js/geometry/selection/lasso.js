import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import SelectionShape from "./shape.js";
import {SELECTION_SHAPE_TYPES} from "./constants.js";
import {isCellInBounds} from "../../state/index.js";

/**
 * A LassoSelection starts off as just an array of Cells (_lassoCells) as the user clicks and drags the mouse. When
 * the mouse click is released the lasso will connect the end point to the start point to complete the polygon. Then
 * the polygon is filled in and stored as an array of rectangular CellAreas (_lassoAreas).
 */
export default class LassoSelection extends SelectionShape {
    static type = SELECTION_SHAPE_TYPES.LASSO;

    serialize() {
        return {
            type: this.type,
            areas: (this._lassoAreas || []).map(area => area.serialize())
        };
    }

    static deserialize(data) {
        const lasso = new LassoSelection(null, null);
        lasso._lassoAreas = data.areas.map(area => CellArea.deserialize(area));
        lasso._cacheEndpoints();
        lasso.completed = true;
        return lasso;
    }

    iterateCells(callback) {
        if (this._lassoAreas) {
            this._lassoAreas.forEach(area => area.iterate(callback));
        }
        else {
            this._lassoCells.forEach(cell => callback(cell.row, cell.col));
        }
    }

    draw(context) {
        if (this._boundedLassoAreas) {
            this._boundedLassoAreas.forEach(area => context.fillRect(...area.xywh));
        }
        else {
            this._lassoCells.forEach(cell => {
                if (isCellInBounds(cell)) {
                    context.fillRect(...cell.xywh);
                }
            });
        }
    }

    set start(cell) {
        super.start = cell;
        this._lassoCells = [];
    }

    set end(cell) {
        super.end = cell;

        const previousEnd = this._lassoCells[this._lassoCells.length - 1];
        if (previousEnd === undefined || previousEnd.row !== cell.row || previousEnd.col !== cell.col) {
            if (previousEnd && !cell.isAdjacentTo(previousEnd)) {
                // Mouse might skip cells if moved quickly, so fill in any skips
                previousEnd.lineTo(cell, cell => this._lassoCells.push(cell), {
                    inclusiveStart: false,
                    inclusiveEnd: false
                })
            }

            // Note: Duplicates cells ARE allowed, as long as they are not consecutive
            this._lassoCells.push(cell);
        }
    }

    get start() {
        return super.start; // Have to override get since set is overridden
    }
    get end() {
        return super.end; // Have to override get since set is overridden
    }

    get topLeft() {
        return this._topLeft; // Using a cached value
    }

    get bottomRight() {
        return this._bottomRight; // Using a cached value
    }

    complete() {
        // Connect the end point back to the start with a line to finish the full border chain
        let chain = this._lassoCells.map(cell => ({row: cell.row, col: cell.col}));
        this.end.lineTo(this.start, cell => chain.push({row: cell.row, col: cell.col}), {
            inclusiveStart: false,
            inclusiveEnd: false
        })

        // Update each link in the chain with a reference to its previous/next link
        for (let i = 0; i < chain.length; i++) {
            chain[i].prev = (i === 0) ? chain[chain.length - 1] : chain[i - 1];
            chain[i].next = (i === chain.length - 1) ? chain[0] : chain[i + 1];
        }

        // Organize chain links into a 2d array sorted by row/col
        let sortedLinks = [];
        let minRow, maxRow;
        chain.forEach(link => {
            if (sortedLinks[link.row] === undefined) {
                sortedLinks[link.row] = [];
                if(minRow === undefined || link.row < minRow) { minRow = link.row; }
                if(maxRow === undefined || link.row > maxRow) { maxRow = link.row; }
            }
            sortedLinks[link.row].push(link);
        });
        sortedLinks.splice(0, minRow); // Remove empty rows from 0 to the first row
        sortedLinks.forEach(row => row.sort((a, b) => a.col - b.col));

        /**
         * Iterate through the sortedLinks, applying "point in polygon" logic to determine if a cell is inside or outside
         * the polygon (https://en.wikipedia.org/wiki/Point_in_polygon).
         *
         * Because we have discrete cells, a polygon edge/corner can "double back" on itself along the same path. We
         * have to implement special handlers for these cases to calculate whether it counts as 1 or 2 "crossings" in
         * point-in-polygon test. For example:
         *
         *       .....###...
         *       ..####.###.
         *       ..#......#.
         *       ..#...#..#. <-- the # in the middle "doubles back" towards the bottom
         *       ..########.
         *       ...........
         *
         * A "lasso area" is a CellArea that is on a single row. There may be multiple lasso areas per row if they are
         * separated by gaps. In the above example, the 2nd row (row index 1) would have 2 lasso areas.
         * We use areas instead of keeping track of individual cells to maximize performance.
         */
        this._lassoAreas = [];
        sortedLinks.forEach(rowOfLinks => {
            let inside = false;

            // Iterate through the row. Each time we cross a polygon edge, we toggle whether we are inside the polygon or not.
            for (let i = 0; i < rowOfLinks.length; i++) {
                const link = rowOfLinks[i];
                const cell = new Cell(link.row, link.col);

                if (inside) {
                    this._lassoAreas[this._lassoAreas.length - 1].bottomRight = cell;
                }
                else {
                    this._lassoAreas.push(new CellArea(cell, cell.clone()));
                }

                // If crossing a boundary, toggle 'inside' boolean
                if ((link.next.row > link.row && link.prev.row <= link.row) ||
                    (link.prev.row > link.row && link.next.row <= link.row)) {
                    inside = !inside;
                }
            }
        });

        this._cacheEndpoints();

        super.complete();
    }

    translate(rowDelta, colDelta) {
        this._lassoAreas.forEach(area => {
            area.topLeft.row += rowDelta;
            area.topLeft.col += colDelta;
            area.bottomRight.row += rowDelta;
            area.bottomRight.col += colDelta;
        })

        this._cacheEndpoints();
    }

    flipVertically(flipRow) {
        this._lassoAreas.forEach(area => {
            const topLeftRow = area.topLeft.row, bottomRightRow = area.bottomRight.row;
            area.topLeft.row = flipRow(bottomRightRow);
            area.bottomRight.row = flipRow(topLeftRow);
        });

        this._cacheEndpoints();
    }

    flipHorizontally(flipCol) {
        this._lassoAreas.forEach(area => {
            const topLeftCol = area.topLeft.col, bottomRightCol = area.bottomRight.col;
            area.topLeft.col = flipCol(bottomRightCol);
            area.bottomRight.col = flipCol(topLeftCol);
        });

        this._cacheEndpoints();
    }

    _cacheEndpoints() {
        this._boundedLassoAreas = this._lassoAreas.map(area => area.clone().bindToDrawableArea(true));

        // _lassoAreas is sorted by row, so we can determine the min/max row just from the first/last areas
        const minRow = this._lassoAreas[0].topLeft.row;
        const maxRow = this._lassoAreas[this._lassoAreas.length - 1].bottomRight.row;

        // Any of the areas could have the min/max col, so have to search through all of them
        const minCol = Math.min(...this._lassoAreas.map(area => area.topLeft.col));
        const maxCol = Math.max(...this._lassoAreas.map(area => area.bottomRight.col));

        this._topLeft = new Cell(minRow, minCol);
        this._bottomRight = new Cell(maxRow, maxCol);
    }
}