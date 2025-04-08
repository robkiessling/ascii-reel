import AsciiPolygon from "./ascii_polygon.js";
import {create2dArray} from "../../utils/arrays.js";
import Cell from "../cell.js";
import {roundToDecimal} from "../../utils/numbers.js";

const DEBUG = false;

/**
 * Represents one char in the freeform line being drawn. Keeps track of a startPixel (the first pixel moused over as the
 * mouse entered the cell) and an endPixel (the latest pixel moused over). Each of these pixels is an x,y coordinate
 * relative to the origin of the cell.
 *
 * A char is chosen based on these two pixels (using the slope between them, etc.)
 */
class FreeformChar {
    constructor(cell, startPixel) {
        this.cell = cell;
        this.startPixel = startPixel;
    }

    update(endPixel) {
        this.endPixel = endPixel;

        this.rise = this.endPixel.y - this.startPixel.y;
        this.run = this.endPixel.x - this.startPixel.x;
        this.distance = Math.hypot(this.rise, this.run)
        this.slope = this.run === 0 ? Infinity : this.rise / this.run;
        this.avgX = (this.startPixel.x + this.endPixel.x) / 2;
        this.avgY = (this.startPixel.y + this.endPixel.y) / 2;

        this.char = this._recalculateChar();

        if (DEBUG) {
            console.log(`[${this.cell.row}, ${this.cell.col}]`,
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
        return this.distance < 0.5;
    }

    // Calculate which char to use based on various factors (slope, avgY position, etc.)
    _recalculateChar() {
        let absSlope = Math.abs(this.slope);

        // This handles the initial char on mousedown (before any mousemove). We set slope equal to zero so that a
        // char is chosen as if it was a horizontal line drawing (goes to final else case).
        if (this.rise === 0 && this.run === 0) absSlope = 0;

        if (absSlope > 3) {
            // Handles vertical slopes (between 3 and infinity)
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
 * Creates FreeformChars between the fromCell and toCell. Uses Bresenham line approximation to calculate which cells
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
class FreeformInterpolator {
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

    interpolate(callback) {
        if (DEBUG) {
            console.log('interpolating! ', this.fromCell.row, this.fromCell.col, ' -> ', this.toCell.row, this.toCell.col,
                ' ... ', `groupBy:${this.groupBy}`, `ltr:${this.leftToRight}`, `ttb:${this.topToBottom}`);
        }

        const interpolatedCells = this.fromCell.lineTo(this.toCell, true); // Bresenham line approximation
        let indexWithinLine = 0;

        this._groupInterpolatedCells(interpolatedCells).forEach(group => {
            const groupSlope = this._calcGroupSlope(group);

            group.forEach((cell, indexWithinGroup) => {
                // We skip the first and last cells of the line. We included them in the interpolation because we want
                // them to count towards each group's size (and thus its rise/run), but we do not replace the chars at
                // these endpoints.
                if (indexWithinLine > 0 && indexWithinLine < interpolatedCells.length - 1) {
                    const { startPixel, endPixel } = this._calcCellPixels(groupSlope, indexWithinGroup);
                    callback(cell, startPixel, endPixel);
                }

                indexWithinLine++;
            })
        });
    }

    /**
     * This is similar to Object.groupBy, but I need the group keys (which are the row or col indexes) to stay in the
     * same order that they were in the original interpolatedCells array. This is important if for example we are
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
 * Handles drawing a freeform line out of ASCII characters. The line can have many twists and turns as the user draws.
 * Chars will be chosen to best fit the line; see FreeformChar class for details on how chars are chosen.
 */
export default class AsciiFreeform extends AsciiPolygon {
    constructor(...args) {
        super(...args);

        this._freeformChars = [];
        this.prevCell = null;
    }

    get lastFreeformChar() {
        if (this._freeformChars.length === 0) return null;
        return this._freeformChars[this._freeformChars.length - 1];
    }

    recalculate(mouseEvent) {
        const cellPixel = this.options.canvas.cellPixelAtExternalXY(mouseEvent.offsetX, mouseEvent.offsetY, true);

        // Start a new FreeformChar if we're entering a new cell:
        if (!this.prevCell || !this.prevCell.equals(this.end)) this._newFreeformChar(cellPixel);

        // Update the latest FreeformChar as the mouse moves:
        this.lastFreeformChar.update(cellPixel);

        // Convert _freeformChars array into glyphs/origin for rendering purposes:
        this._populateGlyphs();

        // Upkeep
        this.prevCell = this.end;
    }

    _newFreeformChar(cellPixel) {
        // If the last FreeformChar should be pruned, delete it (see FreeformChar.shouldPrune() for more details).
        // Never prune the char if it's the only one in our _freeformChars array.
        if (this._freeformChars.length > 1 && this.lastFreeformChar.shouldPrune()) {
            this._freeformChars.pop();
        }

        if (this.lastFreeformChar) {
            // Check if we are "doubling back" to the previous cell. If so, we do not create a new FreeformChar;
            // we go back to updating that previous cell.
            if (this.lastFreeformChar.cell.equals(this.end)) return;

            // If the new cell is not adjacent to the last cell, we must interpolate the missing cells. This can happen
            // if the user moves the mouse very fast across the canvas.
            if (!this.lastFreeformChar.cell.isAdjacentTo(this.end)) {
                this._interpolate(this.lastFreeformChar.cell, this.end)
            }
        }

        this._freeformChars.push(new FreeformChar(this.end, cellPixel));
    }

    _interpolate(fromCell, toCell) {
        const interpolator = new FreeformInterpolator(fromCell, toCell);

        interpolator.interpolate((cell, startPixel, endPixel) => {
            if (DEBUG) { console.log('  interpolated: ', cell.row, cell.col, startPixel, endPixel); }

            const freeformChar = new FreeformChar(cell, startPixel);
            freeformChar.update(endPixel);
            this._freeformChars.push(freeformChar);
        })
    }

    // Converts the array of FreeformChars (whose cells are using absolute positions for row/col) into a minimized
    // 2d array of glyphs (located at a given origin) for easy rendering.
    _populateGlyphs() {
        let minRow, minCol, maxRow, maxCol;
        this._iterateFreeformChars((freeformChar, absoluteR, absoluteC) => {
            if (minRow === undefined || absoluteR < minRow) minRow = absoluteR;
            if (minCol === undefined || absoluteC < minCol) minCol = absoluteC;
            if (maxRow === undefined || absoluteR > maxRow) maxRow = absoluteR;
            if (maxCol === undefined || absoluteC > maxCol) maxCol = absoluteC;
        })

        this._origin = new Cell(minRow, minCol);

        const numRows = maxRow - minRow + 1;
        const numCols = maxCol - minCol + 1;

        this._glyphs = {
            chars: create2dArray(numRows, numCols),
            colors: create2dArray(numRows, numCols),
        }

        this._iterateFreeformChars((freeformChar, absoluteR, absoluteC) => {
            this._glyphs.chars[absoluteR - minRow][absoluteC - minCol] = freeformChar.char;
            this._glyphs.colors[absoluteR - minRow][absoluteC - minCol] = this.options.colorIndex;
        })
    }

    _iterateFreeformChars(callback) {
        this._freeformChars.forEach(freeformChar => {
            const absoluteR = freeformChar.cell.row;
            const absoluteC = freeformChar.cell.col;
            callback(freeformChar, absoluteR, absoluteC)
        })
    }

}