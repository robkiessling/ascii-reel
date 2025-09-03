import {roundToDecimal} from "../../../utils/numbers.js";

const DEBUG = false;

/**
 * Represents one char in the freeform line being drawn. Keeps track of a startPixel (the first pixel moused over as the
 * mouse entered the cell) and an endPixel (the latest pixel moused over). Each of these pixels is an x,y coordinate
 * relative to the origin of the cell.
 *
 * A char is chosen based on these two pixels (using the slope between them, etc.)
 */
class AdaptiveChar {
    constructor(cell, startPixel, endPixel) {
        this.cell = cell;
        this.startPixel = startPixel;
        this.endPixel = endPixel;
        this._calculateProps();
    }

    update(endPixel) {
        this.endPixel = endPixel;
        this._calculateProps();
    }

    _calculateProps() {
        this.rise = this.endPixel.y - this.startPixel.y;
        this.run = this.endPixel.x - this.startPixel.x;
        this.distance = Math.hypot(this.rise, this.run)
        this.slope = this.run === 0 ? Infinity : this.rise / this.run;
        this.avgX = (this.startPixel.x + this.endPixel.x) / 2;
        this.avgY = (this.startPixel.y + this.endPixel.y) / 2;

        this.char = this._calculateChar();

        if (DEBUG) {
            console.log(`[${this.cell}]`,
                `d:${roundToDecimal(this.distance, 3)}`, `m:${roundToDecimal(this.slope, 3)}`,
                `avgX:${roundToDecimal(this.avgX, 3)}`, `avgY:${roundToDecimal(this.avgY, 3)}`,
                ` -> ${this.char}`
            );
        }
    }

    /**
     * If the line drawn through the cell is less than a specified amount, we delete the freeform char. This is
     * important so that diagonal lines are limited to just being 1 char wide as they are drawn:
     * - As a diagonal line is drawn, it is unlikely that the mouse passes exactly through the corner of each cell
     * - It is much more likely to pass through sections of multiple cells as it makes its path. However, we don't want
     *   to draw chars in both of these cells or else the line will look too wide/tall (depending on direction).
     *
     * This function allows us to just keep the cell that the majority of the line passed through.
     */
    shouldPrune() {
        if (Math.abs(this.slope) > 0.85) {
            return this.distance < 0.7;
        } else {
            return this.distance < 0.5;
        }
    }

    // Calculate which char to use based on various factors (slope, avgY position, etc.)
    _calculateChar() {
        let absSlope = Math.abs(this.slope);

        // This handles the initial char on mousedown (before any mousemove). We set slope equal to zero so that a
        // char is chosen as if it was a horizontal line drawing (goes to final else case).
        if (this.rise === 0 && this.run === 0) absSlope = 0;

        if (absSlope > 3) {
            // Handles vertical slopes (between 3 and infinity)
            if (this.startPixel.x < 0.05 && this.endPixel.x < 0.05) return ')';
            if (this.startPixel.x > 0.95 && this.endPixel.x > 0.95) return '(';
            return '|';
        }
        else if (absSlope > 0.85) {
            // Handles slopes between 3 and 0.85 -> represented by line with slope 1 (diagonal line)
            return this.slope > 0 ? '\\' : '/';
        }
        else if (absSlope > 0.35) {
            // Handles slopes between 0.85 and 0.35 -> represented by a line with slope ~0.5
            // Line is drawn by repeating this pattern: .' based on the avgY position
            if (this.avgY < 1/2) return '\'';
            return '.';
        }
        else {
            // Handles slopes between 0 and 0.35 (near horizontal line). We choose characters based on the avgY
            // position; if the avgY position is high we choose a character like `, if low we choose a character like _.
            // Note: If the slope is zero, if the user draws a line along the bottom of the cells it will use the _ char
            // (not the - char).
            if (this.avgY <= 1/6) return '`';
            if (this.avgY <= 2/6) return '\'';
            if (this.avgY <= 3/6) return '-';
            if (this.avgY <= 4/6) return '.';
            if (this.avgY <= 5/6) return ',';
            return '_';
        }
    }
}

/**
 * Creates AdaptiveChars between the fromCell and toCell. Uses Bresenham line approximation to calculate which cells
 * are crossed, then calculates the slope of the line through each of the approximated cells.
 *
 * E.g. say we are drawing from [0,0] to [2,6]. The Bresenham line approximation would be:
 *
 *      AB
 *        CDE
 *           FG
 *
 * Where A is the first cell and G is the last cell. This line approximation is divided into 3 separate groups (group
 * AB, group CDE, and group FG). In this example the groups are rows, but if the line had a more vertical slope then
 * the groups would be columns.
 *
 * A line is drawn through each group from one corner to the next:
 * - For the AB group, the line would start from the top-left of A and end at the bottom-right of B
 * - For the CDE group, the line would start from the top-left of C and end at the bottom-right of E
 * - For the FG group, the line would start from the top-left of F and end at the bottom-right of G
 * Groups may have slightly different slopes: in this example CDE has a smaller slope since its run is longer than AB/FG.
 *
 * The lines that are drawn through each group are used to calculate the startPixel/endPixel of each cell within the
 * group (startPixel is the pixel where the line enters the cell, endPixel is the pixel where the line leaves the cell).
 */
class AdaptiveInterpolator {
    constructor(fromCell, toCell) {
        this.fromCell = fromCell;
        this.toCell = toCell;

        this.lineRise = toCell.row - fromCell.row;
        this.lineRun = toCell.col - fromCell.col;
        this.groupBy = Math.abs(this.lineRise) > Math.abs(this.lineRun) ? 'col' : 'row';

        // Keep track of the direction the line is being drawn (a line drawn from bottom-left to top-right will have the
        // same slope as a line drawn from top-right to bottom-left, but they need to be treated differently in some cases).
        this.leftToRight = toCell.col >= fromCell.col;
        this.topToBottom = toCell.row >= fromCell.row;
    }

    interpolate(inclusiveStart, inclusiveEnd, callback) {
        if (DEBUG) {
            console.log(`interpolating! ${this.fromCell} -> ${this.toCell}`,
                ' ... ', `groupBy:${this.groupBy}`, `ltr:${this.leftToRight}`, `ttb:${this.topToBottom}`);
        }

        const interpolatedCells = this.fromCell.lineTo(this.toCell, true); // Bresenham line approximation
        let indexWithinLine = 0;

        this._groupInterpolatedCells(interpolatedCells).forEach(group => {
            const groupSlope = this._calcGroupSlope(group);
            const startIndex = inclusiveStart ? 0 : 1;
            const length = inclusiveEnd ? interpolatedCells.length : interpolatedCells.length - 1;

            group.forEach((cell, indexWithinGroup) => {
                if (indexWithinLine >= startIndex && indexWithinLine < length) {
                    const { startPixel, endPixel } = this._calcCellPixels(groupSlope, indexWithinGroup);
                    callback(cell, startPixel, endPixel);
                }
                indexWithinLine++;
            })
        });
    }

    /**
     * This is similar to Object.groupBy, but I need the group keys (which are the row or col indexes) to stay in the
     * same order that they were in the original interpolatedCells array. This is important if, for example, we are
     * drawing the line from bottom to top.
     */
    _groupInterpolatedCells(interpolatedCells) {
        const groups = [];
        let currentGroupKey;

        interpolatedCells.forEach(cell => {
            if (cell[this.groupBy] !== currentGroupKey) {
                // start new group
                groups.push([cell])
                currentGroupKey = cell[this.groupBy];
            }
            else {
                // add to current group
                groups.at(-1).push(cell);
            }
        });

        return groups;
    }

    _calcGroupSlope(group) {
        const firstGroupItem = group[0]
        const lastGroupItem = group.at(-1);

        // We add/subtract 1 (depending on direction) because we want to calculate the slope to the far CORNER of the
        // lastGroupItem's cell (may not be its origin). However, if the line is perfectly vertical or horizontal, we
        // skip this step since we are not going from corner to corner.
        let groupRise = lastGroupItem.row - firstGroupItem.row;
        if (this.lineRise !== 0) groupRise += this.topToBottom ? 1 : -1;

        let groupRun = lastGroupItem.col - firstGroupItem.col;
        if (this.lineRun !== 0) groupRun += this.leftToRight ? 1 : -1;

        return groupRise / groupRun;
    }

    _calcCellPixels(groupSlope, indexWithinGroup) {
        let startPixel = {};
        let endPixel = {};

        if (this.groupBy === 'row') {
            startPixel.x = 0;
            endPixel.x = 1;

            if (this.lineRise === 0) {
                // Special case for purely horizontal interpolation; use middle y value
                startPixel.y = 0.5;
                endPixel.y = 0.5;
            }
            else {
                // Calculate start/end y based on position within group and overall slope
                startPixel.y = indexWithinGroup * Math.abs(groupSlope);
                endPixel.y = (indexWithinGroup + 1) * Math.abs(groupSlope);
            }
        }
        else {
            if (this.lineRun === 0) {
                // Special case for purely vertical interpolation; use middle x value
                startPixel.x = 0.5;
                endPixel.x = 0.5;
            }
            else {
                // Calculate start/end x based on position within group and overall slope
                startPixel.x = indexWithinGroup * Math.abs(1 / groupSlope);
                endPixel.x = (indexWithinGroup + 1) * Math.abs(1 / groupSlope);
            }

            startPixel.y = 0;
            endPixel.y = 1;
        }

        // Invert x's if going right to left:
        if (!this.leftToRight) {
            startPixel.x = 1 - startPixel.x;
            endPixel.x = 1 - endPixel.x;
        }

        // Invert y's if going bottom to top:
        if (!this.topToBottom) {
            startPixel.y = 1 - startPixel.y;
            endPixel.y = 1 - endPixel.y;
        }

        return { startPixel, endPixel }
    }
}


/**
 * @param {Cell} fromCell - Starting cell of the line
 * @param {Cell} toCell - Ending cell of the line
 * @param {(cell: Cell, char: string) => void} callback - Callback called for each char in the generated ascii line.
 * @param {boolean} [inclusiveStart=false] - Whether to include fromCell in the final line
 * @param {boolean} [inclusiveEnd=false] - Whether to include toCell in the final line
 */
export function straightAsciiLine(fromCell, toCell, callback, inclusiveStart = false, inclusiveEnd = false) {
    const interpolator = new AdaptiveInterpolator(fromCell, toCell);

    interpolator.interpolate(inclusiveStart, inclusiveEnd, (cell, startPixel, endPixel) => {
        if (DEBUG) { console.log(`  interpolated: ${cell}`, startPixel, endPixel); }

        const adaptiveChar = new AdaptiveChar(cell, startPixel, endPixel);
        callback(adaptiveChar.cell, adaptiveChar.char);
    })
}


export function traversedCellsToChars(traversedCells, callback) {
    let prevUsedCell; // Keep track of the previous cell that has something drawn to it

    for (const [i, traversedCell] of traversedCells.entries()) {
        const adaptiveChar = new AdaptiveChar(traversedCell, traversedCell.normalizedEntry, traversedCell.normalizedExit);

        // Check if char should be pruned (due to its size). This is only done if we have more than 2 cells so we don't
        // prune during initial draw stroke
        if (adaptiveChar.shouldPrune() && traversedCells.length > 2) {
            // If there is no previously used cell, allow prune
            if (!prevUsedCell) continue;

            // If there is a previously used cell, only prune if the next cell is adjacent to it. I.e. if we prune
            // the cell, the line will still be connected.
            const nextCell = traversedCells[i + 1];
            if (nextCell && (nextCell.equals(prevUsedCell) || nextCell.isAdjacentTo(prevUsedCell))) continue;
        }

        callback(adaptiveChar.cell, adaptiveChar.char)
        prevUsedCell = adaptiveChar.cell;
    }
}
