import {roundToDecimal} from "../../../utils/numbers.js";

const DEBUG = false;

/**
 * Chooses an ASCII character to best fit the line drawn between the entry and exit points of a TraversedCell.
 * @param {TraversedCell} traversedCell
 * @returns {{char: (string), disposable: boolean}} - `disposable` will be true if the line drawn through the
 *   cell is small. This means the char can likely be skipped during drawing. Note: It will be up to the outside
 *   function to ensure that you don't skip too many sequential chars.
 */
export function charForTraversedCell(traversedCell) {
    const entry = traversedCell.normalizedEntry;
    const exit = traversedCell.normalizedExit;

    const rise = exit.y - entry.y;
    const run = exit.x - entry.x;
    const distance = Math.hypot(rise, run)
    const slope = run === 0 ? Infinity : rise / run;
    const avgX = (entry.x + exit.x) / 2;
    const avgY = (entry.y + exit.y) / 2;
    const props = { rise, run, distance, slope, avgX, avgY, entry, exit }

    const char = chooseChar(props);

    if (DEBUG) {
        console.log(`[${traversedCell}]`,
            `d:${roundToDecimal(distance, 3)}`, `m:${roundToDecimal(slope, 3)}`,
            `avgX:${roundToDecimal(avgX, 3)}`, `avgY:${roundToDecimal(avgY, 3)}`,
            ` -> ${char}`
        );
    }

    return {
        char,
        disposable: isDisposable(slope, distance)
    }
}

function chooseChar(props) {
    const { rise, run, distance, slope, avgX, avgY, entry, exit } = props;

    let absSlope = Math.abs(slope);

    // This handles the initial char on mousedown (before any mousemove). We set slope equal to zero so that a
    // char is chosen as if it was a horizontal line drawing (since it will go to final else case).
    if (rise === 0 && run === 0) absSlope = 0;

    if (absSlope > 3) {
        // Handles vertical slopes (between 3 and infinity)
        if (entry.x < 0.05 && exit.x < 0.05) return ')';
        if (entry.x > 0.95 && exit.x > 0.95) return '(';
        return '|';
    }
    else if (absSlope > 0.85) {
        // Handles slopes between 3 and 0.85 -> represented by line with slope 1 (diagonal line)
        return slope > 0 ? '\\' : '/';
    }
    else if (absSlope > 0.35) {
        // Handles slopes between 0.85 and 0.35 -> represented by a line with slope ~0.5
        // Line is drawn by repeating the following pattern based on the avgY position:
        //     .'
        //   .'
        if (avgY < 1/2) return '\'';
        return '.';
    }
    else {
        // Handles slopes between 0 and 0.35 (near horizontal line). We choose characters based on the avgY
        // position; if the avgY position is high we choose a character like `, if low we choose a character like _.
        // Note: If the slope is zero, if the user draws a line along the bottom of the cells it will use the _ char
        // (not the - char).
        if (avgY <= 1/6) return '`';
        if (avgY <= 2/6) return '\'';
        if (avgY <= 3/6) return '-';
        if (avgY <= 4/6) return '.';
        if (avgY <= 5/6) return ',';
        return '_';
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
function isDisposable(slope, distance) {
    if (Math.abs(slope) > 0.85) {
        return distance < 0.7;
    } else {
        return distance < 0.5;
    }
}