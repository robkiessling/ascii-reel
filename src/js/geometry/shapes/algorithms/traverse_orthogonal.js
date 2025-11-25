import Cell from "../../cell.js";
import CellArea from "../../cell_area.js";
import {DIRECTIONS} from "../constants.js";
import {buildRoutingGraph, findPathAStar} from "./a_star.js";
import {directionFrom} from "./traverse_utils.js";

const DEBUG = false;

/**
 * Builds an orthogonal path between a startCell and an endCell. Each Cell can be associated with an area
 * (startArea/endArea), and the path will try to avoid pathing through these areas.
 * @param {Cell} startCell
 * @param {Cell} endCell
 * @param {CellArea} [startArea]
 * @param {CellArea} [endArea]
 * @param {string} [startDir]
 * @param {string} [endDir]
 * @param {(cell: Cell, direction: string, type: 'start'|'end'|'middle'|'connector') => void} callback
 */
export function orthogonalPath(startCell, endCell, startArea, endArea, startDir, endDir, callback) {
    if (startDir === undefined) startDir = directionFrom(startCell, endCell);
    if (endDir === undefined) endDir = directionFrom(endCell, startCell);

    if (DEBUG) console.log(`${startArea}, ${startCell}, ${startDir}\n${endArea}, ${endCell}, ${endDir}`)

    const { startNode, endNode, centerRow, centerCol } = buildRoutingGraph(startArea, startCell, startDir, endArea, endCell, endDir)
    let path = findPathAStar(startNode, endNode);

    path = centerLineCorrection(path, centerRow, centerCol, [startArea, endArea].filter(Boolean), [startCell, endCell]);

    // Iterate through each cell in the path
    for (let i = 0; i < path.length; i++) {
        const cell = path[i];

        // If we're on the first cell, just draw it (start char)
        if (i === 0) {
            callback(cell, startDir, 'start');
            continue;
        }

        // For later cells, draw a straight line from prevCell to current cell (without endpoints)
        const prevCell = path[i - 1];
        const direction = directionBetween(prevCell, cell);
        prevCell.lineTo(cell, cell => callback(cell, direction, 'connector'), {
            inclusiveStart: false,
            inclusiveEnd: false
        })

        // Draw current cell, differing based on whether it's an end or middle point
        if (i === path.length - 1) {
            callback(cell, endDir, 'end')
        } else {
            const nextCell = path[i + 1];
            callback(cell, directionBetween(prevCell, cell, nextCell), 'middle')
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
            if (hitIndex === turnIndex) return null; // Turn is already on center line
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

/**
 * Returns direction between 2 or 3 orthogonal cells. If 3 cells are provided, direction will be a two-step direction
 * such as DOWN_RIGHT. Will throw an error if the path between two sequential cells is not vertical or horizontal.
 * @param {...Cell} cells - Individual Cell arguments
 * @returns {string}
 */
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
