import Cell from "../../cell.js";
import TraversedCell from "../../traversed_cell.js";
import {charForTraversedCell} from "./char_approximation.js";
import CellCache from "../../cell_cache.js";
import {BRUSH_TYPES} from "../../../config/shapes.js";
import {diamondBrushCells, squareBrushCells} from "./brush.js";

/**
 * Calculates a "pixel perfect" freeform line that goes through the array of points; will ignore cells that the path
 * only slightly overlaps to reduce noise. Each returned cell will also have an ascii char that best fits its segment.
 * @param {Array<Point>} points
 * @param {(cell: TraversedCell, char: string) => void} callback - Callback called for each cell in the drawn path
 */
export function pixelPerfectFreeformPath(points, callback) {
    const traversedCells = getTraversedCells(points);

    let prevUsedCell; // Keep track of the previous cell that has something drawn to it

    for (const [i, traversedCell] of traversedCells.entries()) {
        const { char, disposable } = charForTraversedCell(traversedCell);

        // Check if char should be pruned (due to its size). This is only done if we have more than 2 cells so we don't
        // prune during initial draw stroke
        if (disposable && i > 0) {
            // If there is no previously used cell, allow prune
            if (!prevUsedCell) continue;

            // If there is a previously used cell, only prune if the next cell is adjacent to it. This is to ensure
            // that if we prune the cell, the line will still be connected.
            const nextCell = traversedCells[i + 1];
            if (nextCell && (nextCell.equals(prevUsedCell) || nextCell.isAdjacentTo(prevUsedCell))) continue;
        }

        callback(traversedCell, char)
        prevUsedCell = traversedCell;
    }
}

/**
 * Calculates a freeform line of a given thickness that goes through the array of points. Duplicate cells (e.g. if
 * the line is very thick) are skipped.
 * @param {Array<Point>} points
 * @param {string} brushType
 * @param {number} brushSize
 * @param {(cell: TraversedCell) => void} callback - Callback called for each cell in the drawn path
 */
export function standardFreeformPath(points, brushType, brushSize, callback) {
    const traversedCells = getTraversedCells(points);

    let getBrushCells;
    switch(brushType) {
        case BRUSH_TYPES.SQUARE:
            getBrushCells = squareBrushCells;
            break;
        case BRUSH_TYPES.DIAMOND:
            getBrushCells = diamondBrushCells;
            break;
        default:
            throw new Error(`Invalid brushType: ${brushType}`)
    }

    const cache = new CellCache();
    traversedCells.forEach(traversedCell => {
        getBrushCells(traversedCell, brushSize).forEach(cell => {
            if (cache.has(cell)) return;
            callback(cell);
            cache.add(cell);
        })
    })
}

/**
 * Given an array of points, returns an array of TraversedCells that represents how you would traverse cells
 * to go through all the points.
 * - If two sequential points are not in adjacent cells, all the cells between them will be included as separate
 *   TraversedCells. Each TraversedCell will have an entry/exit as if there were a straight line drawn between the points.
 * - If many points are within one cell, there will only be one TraversedCell representing all of those points
 *   combined. The exception is if the points path leaves a given cell and then returns to it again; that second
 *   returning will be a new separate TraversedCell in the final array.
 * @param {Array<Point>} points
 * @returns {Array<TraversedCell>}
 */
function getTraversedCells(points) {
    if (points.length === 1) {
        const cell = points[0].cell;
        return [TraversedCell.fromNormalizedData(cell.row, cell.col, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5})]
    }

    const result = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        getTraversedSegments(p0, p1).forEach(segment => {
            const currentCell = result.at(-1);
            if (currentCell && currentCell.equals(segment)) {
                // Segment is part of the same cell as the previous segment -> update the previous segment
                currentCell.exit = segment.exit;
            } else {
                // Segment is not part of the same cell -> include the new segment
                result.push(segment);
            }
        })
    }

    return result;
}


/**
 * Returns the set of segments between two points, where each "segment" is a piece of the line restricted to a single cell.
 * For example, if the two points were in the middle of cells (0,0) and (0,2) there would be 3 segments returned:
 * - The segment from the middle of (0,0) to the right edge of (0,0), with a distance of 0.5 cells
 * - The segment from the left edge of (0,1) to the right edge of (0,1), with a distance of 1 cell
 * - The segment from the left edge of (0,2) to the middle of (0,2), with a distance of 0.5 cells
 * Each segment also contains the entry and exit points for that cell, as a fraction of the cell's width/height.
 * For example, for the first segment above, the entry would be { x: 0.5, y: 0.5 } since it started in the middle
 * of the cell. The exit would be { x: 1.0, y: 0.5 } since it exited on the right side of the cell.
 *
 * All calculations are done using a DDA algorithm.
 *
 * @param {Point} p0 - The start point in world coordinates.
 * @param {Point} p1 - The end point in world coordinates.
 * @returns {Array<TraversedCell>}
 */
function getTraversedSegments(p0, p1) {
    const result = [];

    const x0 = p0.x, y0 = p0.y;
    const x1 = p1.x, y1 = p1.y;

    const dx = x1 - x0;
    const dy = y1 - y0;

    const stepX = Math.sign(dx); // +1, 0, or -1 depending on direction
    const stepY = Math.sign(dy);

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let { row, col } = p0.cell;

    // Compute t increment for each cell step along X and Y
    const tStepX = dx !== 0 ? Cell.width / absDx : Infinity;
    const tStepY = dy !== 0 ? Cell.height / absDy : Infinity;

    // Compute normalized t (from 0 to 1) for first X grid crossing
    let tNextX = dx !== 0
        ? ((stepX > 0 ? (col + 1) * Cell.width - x0 : x0 - col * Cell.width) / absDx)
        : Infinity;

    // Compute normalized t for first Y grid crossing
    let tNextY = dy !== 0
        ? ((stepY > 0 ? (row + 1) * Cell.height - y0 : y0 - row * Cell.height) / absDy)
        : Infinity;

    let t = 0;
    const endT = 1;

    while (t <= endT) {
        const cellOriginX = col * Cell.width;
        const cellOriginY = row * Cell.height;

        // Point where we enter this cell
        const entryX = x0 + dx * t;
        const entryY = y0 + dy * t;

        // Determine when we will exit the current cell
        const nextT = Math.min(tNextX, tNextY, endT); // clamp to line end
        const exitX = x0 + dx * nextT;
        const exitY = y0 + dy * nextT;

        result.push(new TraversedCell(
            row, col,
            { x: entryX - cellOriginX, y: entryY - cellOriginY },
            { x: exitX - cellOriginX, y: exitY - cellOriginY }
        ))

        // Advance to next cell based on which crossing comes first
        if (tNextX < tNextY) {
            col += stepX;
            t = tNextX;
            tNextX += tStepX;
        } else {
            row += stepY;
            t = tNextY;
            tNextY += tStepY;
        }
    }

    return result;
}