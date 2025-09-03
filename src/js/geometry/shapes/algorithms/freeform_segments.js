import Cell from "../../cell.js";

export class TraversedCell extends Cell {
    constructor(row, col, entry, exit) {
        super(row, col);
        this.entry = entry;
        this.exit = exit;
    }

    get normalizedEntry() {
        return {
            x: this.entry.x / Cell.width,
            y: this.entry.y / Cell.height,
        }
    }

    get normalizedExit() {
        return {
            x: this.exit.x / Cell.width,
            y: this.exit.y / Cell.height,
        }
    }
}

/**
 * Given an array of points, returns an array of TraversedCells that represents how you would traverse cells
 * to go through all the points. If two sequential points are not in adjacent cells, all the cells between them will
 * be included as separate TraversedCells. If many points are within one cell, there will only be one TraversedCell
 * representing all of those points combined. The exception is if the points path leaves a given cell and then returns
 * to it again; that second returning will be a new TraversedCell.
 * @param {Point[]} points
 * @returns {TraversedCell[]}
 */
export function getTraversedCells(points) {
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
 * Returns the set of segments between two points, where a "segment" of a line is restricted to a single cell.
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
 * @returns {Array<{ row: number, col: number, entry, exit }>} Array of segments, where each segment has:
 *   - row/col of the cell it is in
 *   - entry {x, y} and exit {x, y} points in cell-local coordinates (values between 0 and 1)
 *
 * @returns {Array<TraversedCell>} - Array of
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