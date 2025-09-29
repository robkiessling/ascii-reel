import Cell from "./cell.js";

/**
 * Represents a grid cell that a path or line has passed through, including the points where the line entered
 * and exited the cell.
 */
export default class TraversedCell extends Cell {
    /**
     * @param {number} row
     * @param {number} col
     * @param {Point|{x: number, y: number}} entry - Entry point of line segment in world space units
     * @param {Point|{x: number, y: number}} exit - Exit point of line segment in world space units
     */
    constructor(row, col, entry, exit) {
        super(row, col);
        this.entry = entry;
        this.exit = exit;
    }

    // Allows you to build a TraversedCell from already-normalized (i.e. scaled between 0 and 1) entry/exit points.
    static fromNormalizedData(row, col, normalizedEntry, normalizedExit) {
        const realEntry = {
            x: normalizedEntry.x * Cell.width,
            y: normalizedEntry.y * Cell.height,
        }
        const realExit = {
            x: normalizedExit.x * Cell.width,
            y: normalizedExit.y * Cell.height,
        }
        return new TraversedCell(row, col, realEntry, realExit);
    }

    /**
     * Returns the entry point normalized to cell-relative coordinates (0 to 1 range).
     * For example, if the cell is 10 units wide and the entry point is at x=5, the resulting x will be 0.5.
     */
    get normalizedEntry() {
        return {
            x: this.entry.x / Cell.width,
            y: this.entry.y / Cell.height,
        }
    }

    /**
     * Returns the exit point normalized to cell-relative coordinates (0 to 1 range).
     * For example, if the cell is 10 units wide and the exit point is at x=5, the resulting x will be 0.5.
     */
    get normalizedExit() {
        return {
            x: this.exit.x / Cell.width,
            y: this.exit.y / Cell.height,
        }
    }
}
