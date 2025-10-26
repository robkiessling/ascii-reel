import TraversedCell from "../../traversed_cell.js";
import {charForTraversedCell} from "./char_approximation.js";

const DEBUG = false;

/**
 * Interpolates a line between the two given cells and chooses an ascii character for each cell to best fit the slope.
 * @param {Cell} fromCell - Starting cell of the line
 * @param {Cell} toCell - Ending cell of the line
 * @param {(cell: Cell, char: string) => void} callback - Callback called for each char in the generated ascii line.
 * @param {boolean} [inclusiveStart=true] - Whether to include fromCell in the final line
 * @param {boolean} [inclusiveEnd=true] - Whether to include toCell in the final line
 */
export function straightAsciiLine(fromCell, toCell, callback, inclusiveStart = true, inclusiveEnd = true) {
    interpolate(fromCell, toCell, inclusiveStart, inclusiveEnd).forEach(traversedCell => {
        if (DEBUG) { console.log(`  interpolated: ${traversedCell}`); }

        // We don't need to care about `disposable` flag for the char; our interpolated lines always go through
        // cells cleanly (due to bresenham approx), so we do not need to dispose any cells.
        const { char } = charForTraversedCell(traversedCell);
        callback(traversedCell, char)
    })
}

/**
 * Interpolates TraversedCells between the fromCell and toCell. Uses Bresenham line approximation to calculate which
 * cells are crossed, then calculates the slope of the line through each of the approximated cells.
 *
 * E.g. say we are drawing from [0,0] to [2,6]. The Bresenham line approximation would be:
 *
 *      AB
 *        CDE
 *           FG
 *
 * Where A is the first cell and G is the last cell. This line approximation is divided into 3 separate groups (group
 * AB, group CDE, and group FG). In this example, the groups are rows, but if the line had a more-vertical slope then
 * the groups would be columns.
 *
 * A line is drawn through each group from one corner to the next:
 * - For the AB group, the line would start from the top-left of A and end at the bottom-right of B
 * - For the CDE group, the line would start from the top-left of C and end at the bottom-right of E
 * - For the FG group, the line would start from the top-left of F and end at the bottom-right of G
 * Groups may have slightly different slopes: in this example CDE has a smaller slope since its run is longer than AB/FG.
 *
 * The lines that are drawn through each group are used to calculate the entry/exit points of each cell within the group.
 *
 * TODO re-implement this using cell vertices... I think it might be cleaner
 */
function interpolate(fromCell, toCell, inclusiveStart, inclusiveEnd) {
    const overallRise = toCell.row - fromCell.row;
    const overallRun = toCell.col - fromCell.col;
    const groupBy = Math.abs(overallRise) > Math.abs(overallRun) ? 'col' : 'row';

    // Keep track of the direction the line is being drawn (a line drawn from bottom-left to top-right will have the
    // same slope as a line drawn from top-right to bottom-left, but they need to be treated differently in some cases).
    const leftToRight = toCell.col >= fromCell.col;
    const topToBottom = toCell.row >= fromCell.row;

    const props = { overallRise, overallRun, groupBy, leftToRight, topToBottom };

    if (DEBUG) {
        console.log(`interpolating! ${fromCell} -> ${toCell}`,
            ' ... ', `groupBy:${groupBy}`, `ltr:${leftToRight}`, `ttb:${topToBottom}`);
    }

    const interpolatedCells = fromCell.lineTo(toCell, true); // Bresenham line approximation
    let indexWithinLine = 0;
    const result = [];

    groupInterpolatedCells(interpolatedCells, props).forEach(group => {
        const groupSlope = calcGroupSlope(group, props);
        const startIndex = inclusiveStart ? 0 : 1;
        const length = inclusiveEnd ? interpolatedCells.length : interpolatedCells.length - 1;

        group.forEach((cell, indexWithinGroup) => {
            if (indexWithinLine >= startIndex && indexWithinLine < length) {
                result.push(buildTraversedCell(cell, groupSlope, indexWithinGroup, props));
            }
            indexWithinLine++;
        })
    });

    return result;
}

/**
 * This is similar to Object.groupBy, but I need the group keys (which are the row or col indexes) to stay in the
 * same order that they were in the original interpolatedCells array. This is important if, for example, we are
 * drawing the line from bottom to top.
 */
function groupInterpolatedCells(interpolatedCells, props) {
    const { groupBy } = props;

    const groups = [];
    let currentGroupKey;

    interpolatedCells.forEach(cell => {
        if (cell[groupBy] !== currentGroupKey) {
            // start new group
            groups.push([cell])
            currentGroupKey = cell[groupBy];
        }
        else {
            // add to current group
            groups.at(-1).push(cell);
        }
    });

    return groups;
}

function calcGroupSlope(group, props) {
    const { overallRise, overallRun, leftToRight, topToBottom } = props;

    const firstGroupItem = group[0]
    const lastGroupItem = group.at(-1);

    // We add/subtract 1 (depending on direction) because we want to calculate the slope to the far CORNER of the
    // lastGroupItem's cell (may not be its origin). However, if the line is perfectly vertical or horizontal, we
    // skip this step since we are not going from corner to corner.
    let groupRise = lastGroupItem.row - firstGroupItem.row;
    if (overallRise !== 0) groupRise += topToBottom ? 1 : -1;

    let groupRun = lastGroupItem.col - firstGroupItem.col;
    if (overallRun !== 0) groupRun += leftToRight ? 1 : -1;

    return groupRise / groupRun;
}

function buildTraversedCell(cell, groupSlope, indexWithinGroup, props) {
    const { groupBy, overallRise, overallRun, leftToRight, topToBottom } = props;

    let entry = {};
    let exit = {};

    if (groupBy === 'row') {
        entry.x = 0;
        exit.x = 1;

        if (overallRise === 0) {
            // Special case for purely horizontal interpolation; use middle y value
            entry.y = 0.5;
            exit.y = 0.5;
        }
        else {
            // Calculate start/end y based on position within group and overall slope
            entry.y = indexWithinGroup * Math.abs(groupSlope);
            exit.y = (indexWithinGroup + 1) * Math.abs(groupSlope);
        }
    }
    else {
        if (overallRun === 0) {
            // Special case for purely vertical interpolation; use middle x value
            entry.x = 0.5;
            exit.x = 0.5;
        }
        else {
            // Calculate start/end x based on position within group and overall slope
            entry.x = indexWithinGroup * Math.abs(1 / groupSlope);
            exit.x = (indexWithinGroup + 1) * Math.abs(1 / groupSlope);
        }

        entry.y = 0;
        exit.y = 1;
    }

    // Invert x's if going right to left:
    if (!leftToRight) {
        entry.x = 1 - entry.x;
        exit.x = 1 - exit.x;
    }

    // Invert y's if going bottom to top:
    if (!topToBottom) {
        entry.y = 1 - entry.y;
        exit.y = 1 - exit.y;
    }

    return TraversedCell.fromNormalizedData(cell.row, cell.col, entry, exit);
}