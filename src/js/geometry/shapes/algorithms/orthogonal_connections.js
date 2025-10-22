import Cell from "../../cell.js";
import CellArea from "../../cell_area.js";
import {AXES, DIRECTIONS} from "../constants.js";
import {buildRoutingGraph, findPathAStar} from "./a_star.js";

const DEBUG = false;

/**
 * Builds an orthogonal path between a startCell and an endCell. Each Cell can be associated with an area
 * (startArea/endArea), and the path will try to avoid pathing through these areas.
 * @param {Cell} startCell
 * @param {Cell} endCell
 * @param {CellArea} [startArea]
 * @param {string} [startDir]
 * @param {CellArea} [endArea]
 * @param {string} [endDir]
 * @param {(cell: Cell, char: string) => void} callback
 */
export function orthogonalPath(startCell, endCell, startArea, startDir, endArea, endDir, callback) {
    // If directions are undefined, infer them based on which axes is longer between them
    if (longerAxis(startCell, endCell) === AXES.VERTICAL) {
        if (startDir === undefined) startDir = endCell.row >= startCell.row ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        if (endDir === undefined) endDir = endCell.row >= startCell.row ? DIRECTIONS.UP : DIRECTIONS.DOWN;
    } else {
        if (startDir === undefined) startDir = endCell.col >= startCell.col ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        if (endDir === undefined) endDir = endCell.col >= startCell.col ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
    }

    if (DEBUG) console.log(`${startArea}, ${startCell}, ${startDir}\n${endArea}, ${endCell}, ${endDir}`)

    const { startNode, endNode, centerRow, centerCol } = buildRoutingGraph(startArea, startCell, startDir, endArea, endCell, endDir)
    let path = findPathAStar(startNode, endNode);

    path = centerLineCorrection(path, centerRow, centerCol, [startArea, endArea].filter(Boolean), [startCell, endCell]);

    for (let i = 0; i < path.length; i++) {
        const cell = path[i];

        if (i === 0) {
            callback(cell, charForDirection(startDir, true));
            continue;
        }

        const prevCell = path[i - 1];
        exclusiveLine(prevCell, cell, callback);

        if (i === path.length - 1) {
            callback(cell, charForDirection(endDir, true))
        } else {
            const nextCell = path[i + 1];
            callback(cell, charForDirection(directionBetween(prevCell, cell, nextCell)));
        }
    }
}


// ------------------------------------------------------------------- A* Center line correction
/**
 * The path returned by the A* algorithm is not always the final path we use. When people hand-draw flow charts,
 * they often want to follow the "center line" in order to make the path look more symmetrical (where "center line"
 * is the perpendicular line between the two shapes).
 *
 * It is quite hard to code this into the A* algorithm itself (by reducing costs), because we already have coded
 * in increased costs to reduce turns. Instead, we manually alter the A* path to use the center line, as long as
 * it does not increase the number of turns.
 *
 * The following blog post goes into much more detail (see "Center line correction" section):
 * https://pubuzhixing.medium.com/drawing-technology-flow-chart-orthogonal-connection-algorithm-fe23215f5ada
 */
function centerLineCorrection(path, centerRow, centerCol, blockedAreas, blockedCells) {
    if (path.length < 3) return path; // trivial path

    const numTurns = countTurns(path)

    // Attempt to correct to center column
    const centerColPath = findCenterCorrectedPath(path, numTurns, 'col', centerCol, blockedAreas, blockedCells);
    if (centerColPath) path = centerColPath;

    // Attempt to correct to center row
    const centerRowPath = findCenterCorrectedPath(path, numTurns, 'row', centerRow, blockedAreas, blockedCells);
    if (centerRowPath) path = centerRowPath;

    return path;
}


/**
 * Centerline correction: Correct the shortest path route based on the horizontal/vertical centerline.
 *
 * Note: See blogpost linked above for detailed description/examples.
 */
function findCenterCorrectedPath(path, numTurns, attr, centerLine, blockedAreas, blockedCells) {
    path = path.map(cell => cell.clone());

    if (DEBUG) path.forEach((cell, i) => console.log(`${i}, ${cell}`))

    // Step 1: Find the point at which the path intersects ("hits") the center line, as well as the line segment
    //         parallel to the center line.
    let hitIndex, turnIndex, endIndex;
    let hitDir;
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const current = path[i];
        const currentDir = directionBetween(prev, current);

        // Go until you hit center line
        if (hitIndex === undefined && current[attr] === centerLine) {
            hitIndex = i;
            hitDir = currentDir;
        }

        // Then keep going until you turn (parallel line starts after this turn)
        if (hitIndex !== undefined && turnIndex === undefined && currentDir !== hitDir) {
            turnIndex = i - 1;
        }

        // Then keep going until you turn again (this is the end of the parallel line)
        if (hitIndex !== undefined && turnIndex !== undefined && endIndex === undefined && currentDir === hitDir) {
            endIndex = i - 1;
        }
    }

    // If we didn't reach the end of the parallel line, there is no center path to correct to
    if (endIndex === undefined) return null;

    // Step 2: Build a rectangle out of the hit point and the parallel line
    const hit = path[hitIndex];
    const oldTurn = path[turnIndex];
    const end = path[endIndex]

    // "new" turning point is the opposite corner of the rectangle from the old turn
    const newTurn = attr === 'row' ? new Cell(centerLine, end.col) : new Cell(end.row, centerLine)
    const rect = CellArea.fromCells([oldTurn, newTurn])

    // Step 3: If this rectangle collides with start/end shapes or start/end cells, cannot use it.
    for (const blockedArea of blockedAreas) {
        if (blockedArea.overlaps(rect, false)) return null;
    }
    for (const blockedCell of blockedCells) {
        if (hit.equals(blockedCell)) return null;
        if (end.equals(blockedCell)) return null;
    }

    // Step 4: Change path to use this alternate rectangle edge.
    path.splice(hitIndex + 1, endIndex - hitIndex - 1, newTurn)

    // Step 5: Ensure we didn't increase the number of turns
    const correctedNumTurns = countTurns(path);
    if (correctedNumTurns > numTurns) return null;

    return path;
}


// --------------------------------------------------------------------------- Helper methods

function longerAxis(startCell, endCell) {
    const rowDelta = endCell.row - startCell.row;
    const colDelta = endCell.col - startCell.col;
    return Math.abs(rowDelta) >= Math.abs(colDelta) ? AXES.VERTICAL : AXES.HORIZONTAL;
}

function countTurns(path) {
    if (path.length < 3) return 0; // need at least 3 points to turn
    let turns = 0;
    let prevDir;

    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const current = path[i];
        const currentDir = directionBetween(prev, current);
        if (prevDir && currentDir !== prevDir) turns += 1;
        prevDir = currentDir;
    }
    return turns;
}

function exclusiveLine(fromCell, toCell, callback) {
    const direction = directionBetween(fromCell, toCell);
    fromCell.lineTo(toCell, false).forEach(cell => callback(cell, charForDirection(direction, false)))
}

function directionBetween(...cells) {
    if (cells.length < 2) throw new Error('Must have at least 2 cells');
    if (cells.length > 3) throw new Error('Cannot have more than 3 cells');

    const directions = [];
    for (let i = 1; i < cells.length; i++) {
        const fromCell = cells[i - 1];
        const toCell = cells[i];
        if ((fromCell.row !== toCell.row) && (fromCell.col !== toCell.col)) {
            throw new Error(`Cell points must be along a horizontal or vertical line ${fromCell} -> ${toCell}`)
        } else if (fromCell.row < toCell.row) {
            directions.push(DIRECTIONS.DOWN)
        } else if (fromCell.row > toCell.row) {
            directions.push(DIRECTIONS.UP)
        } else if (fromCell.col < toCell.col) {
            directions.push(DIRECTIONS.RIGHT)
        } else if (fromCell.col > toCell.col) {
            directions.push(DIRECTIONS.LEFT)
        } else {
            directions.push(DIRECTIONS.DOWN) // No movement; just show DOWN icon
        }
    }

    if (directions[0] === directions[1]) return directions[0];

    return directions.join('-')
}

// Note: arrowhead goes in opposite direction of connection direction
function charForDirection(dir, isEndpoint) {
    switch (dir) {
        case DIRECTIONS.UP:
            return isEndpoint ? 'v' : '|';
        case DIRECTIONS.RIGHT:
            return isEndpoint ? '<' : '-';
        case DIRECTIONS.DOWN:
            return isEndpoint ? '^' : '|';
        case DIRECTIONS.LEFT:
            return isEndpoint ? '>' : '-';
        case DIRECTIONS.UP_RIGHT:
        case DIRECTIONS.UP_LEFT:
        case DIRECTIONS.RIGHT_UP:
        case DIRECTIONS.RIGHT_DOWN:
        case DIRECTIONS.DOWN_RIGHT:
        case DIRECTIONS.DOWN_LEFT:
        case DIRECTIONS.LEFT_UP:
        case DIRECTIONS.LEFT_DOWN:
            return '+';
        default:
            // return '?'; // for debugging

            // In some cases, the line gets really wrapped up when the two endpoints are near each other;
            // we just hide these extra wrapped points
            return '';
    }
}

export function axisForDir(dir) {
    switch (dir) {
        case DIRECTIONS.UP:
        case DIRECTIONS.DOWN:
            return AXES.VERTICAL;
        case DIRECTIONS.LEFT:
        case DIRECTIONS.RIGHT:
            return AXES.HORIZONTAL;
        default:
            throw new Error(`Cannot get axis for ${dir}`)
    }
}