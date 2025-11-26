import Cell from "../../cell.js";
import {create2dArray} from "../../../utils/arrays.js";
import {AXES, CARDINAL_DIRECTIONS, DIRECTIONS} from "../../../config/shapes.js";
import CellCache from "../../cell_cache.js";
import {roundForComparison} from "../../../utils/numbers.js";
import {axisForDir} from "./traverse_utils.js";

const NODE_TYPES = {
    STANDARD: 'standard',
    START: 'start',
    AFTER_START: 'afterStart',
    GOAL: 'goal',
    BEFORE_GOAL: 'beforeGoal'
}

// Cost increase to reduce number of turns (prevents "staircase" pathing)
const TURNING_PENALTY = 0.5;

const DEBUG_PATHFINDING = false;
const DEBUG_NEIGHBORS = false;

/**
 * Using A* algorithm to find shortest path.
 *
 * Code adapted from: https://www.datacamp.com/tutorial/a-star-algorithm
 */
export function findPathAStar(start, goal) {
    const open = new Set([start]);
    const closed = new Set();

    const heuristic = (nodeA, nodeB) => {
        // Using Manhattan distance as heuristic
        return Math.abs(nodeA.cell.row - nodeB.cell.row) + Math.abs(nodeA.cell.col - nodeB.cell.col);
    }

    start.g = 0;
    start.h = heuristic(start, goal);

    while (open.size > 0) {
        // Find node in open set with lowest f score. TODO could use priority queue for faster retrieval?
        let current = null;
        for (const node of open) {
            if (!current || node.f < current.f) current = node;
        }

        if (DEBUG_PATHFINDING) {
            console.log(
                `Exploring ${current.cell}, g=${roundForComparison(current.g)}, h=${roundForComparison(current.h)} ` +
                `-> f=${roundForComparison(current.f)}`
            );
        }

        if (current === goal) return reconstructPath(goal);

        // Move current node from open to closed list
        open.delete(current);
        closed.add(current);

        // Check all neighboring nodes
        for (const { node: neighbor, cost, axis } of current.neighbors) {
            if (closed.has(neighbor)) continue;

            let tentativeG = current.g + cost;

            const isTurn = current.cameFrom && current.cameFromAxis !== axis;
            if (isTurn) tentativeG += TURNING_PENALTY;

            if (!open.has(neighbor)) {
                open.add(neighbor)
            } else if (tentativeG >= neighbor.g) {
                continue; // This path is not better
            }

            // This path is the best so far
            neighbor.cameFrom = current
            neighbor.cameFromAxis = axis; // Keep track of axis we came from so we can determine if we turn
            neighbor.g = tentativeG
            neighbor.h = heuristic(neighbor, goal)

            if (DEBUG_PATHFINDING) {
                console.log(
                    `  Neighbor ${neighbor.cell} tentativeG=${roundForComparison(tentativeG)} `+
                    `h=${roundForComparison(neighbor.h)} -> f=${roundForComparison(neighbor.f)}`
                );
            }
        }
    }

    return []; // No path found
}

function reconstructPath(goal) {
    const path = [];
    let current = goal;
    while (current) {
        path.unshift(current.cell);
        current = current.cameFrom;
    }
    return path;
}

/**
 * Given a starting area/cell and ending area/cell, builds a grid of nodes that can be passed to the A* algorithm.
 *
 * See `buildGrid` for more information on how nodes are selected.
 */
export function buildRoutingGraph(startArea, startCell, startDir, endArea, endCell, endDir) {
    const nodesByCell = new CellCache();
    let centerRow, centerCol;

    if (startCell.equals(endCell)) {
        nodesByCell.set(startCell, new Node(startCell, NODE_TYPES.START))
    } else {
        let grid;
        ({ grid, centerRow, centerCol } = buildGrid(startArea, startCell, startDir, endArea, endCell, endDir))

        assignNeighbors(grid, startDir, endDir);

        grid.forEach(gridRow => {
            gridRow.forEach(node => {
                if (node) nodesByCell.set(node.cell, node);
            })
        })
    }

    return {
        nodesByCell,
        startNode: nodesByCell.get(startCell),
        endNode: nodesByCell.get(endCell),
        centerRow,
        centerCol
    };
}

/**
 * Builds a 2D grid of Node objects by finding the intersection of 7 horizontal and 7 vertical lines.
 *
 * The 7 horizontal lines are:
 *   - 2 on the upper and lower boundaries of the startArea/endArea (a total of 4)
 *   - 1 on the startCell/endCell rows (a total of 2)
 *   - 1 on the center line between the two areas
 * And likewise for the 7 vertical lines.
 *
 * If an intersection falls inside startArea/endArea and is not the startCell/endCell, it will be excluded.
 *
 * This grid forms the structural basis for the orthogonal routing graph used by the A* pathfinding algorithm.
 * 
 * For more information, see:
 * https://pubuzhixing.medium.com/drawing-technology-flow-chart-orthogonal-connection-algorithm-fe23215f5ada
 */
function buildGrid(startArea, startCell, startDir, endArea, endCell, endDir) {
    let horizontalLines = new Set();
    let verticalLines = new Set();

    // Add lines for the 2 areas
    [startArea, endArea].forEach(area => {
        if (!area) return;
        horizontalLines.add(area.topLeft.row);
        horizontalLines.add(area.bottomRight.row);
        verticalLines.add(area.topLeft.col);
        verticalLines.add(area.bottomRight.col);
    });

    // Add lines for the 2 cells
    [startCell, endCell].forEach(cell => {
        horizontalLines.add(cell.row);
        verticalLines.add(cell.col);
    });

    // Add center lines
    const centerRow = getCenterLine(startArea, startCell, endArea, endCell, 'row');
    const centerCol = getCenterLine(startArea, startCell, endArea, endCell, 'col');
    horizontalLines.add(centerRow);
    verticalLines.add(centerCol);

    // Sort lines
    horizontalLines = [...horizontalLines].sort((a, b) => a - b);
    verticalLines = [...verticalLines].sort((a, b) => a - b);

    // Build 2d grid based on the line intersections
    const grid = create2dArray(horizontalLines.length, verticalLines.length);
    const removeInnerNodes = shouldRemoveInnerNodes(startArea, startCell, endArea, endCell);
    const afterStart = findFirstHopCell(startCell, startDir, startArea);
    const beforeGoal = findFirstHopCell(endCell, endDir, endArea);

    horizontalLines.forEach((row, horizontalIndex) => {
        verticalLines.forEach((col, verticalIndex) => {
            const cell = new Cell(row, col);
            let nodeType = NODE_TYPES.STANDARD;
            if (cell.equals(startCell)) nodeType = NODE_TYPES.START;
            if (cell.equals(endCell)) nodeType = NODE_TYPES.GOAL;
            if (afterStart && cell.equals(afterStart)) nodeType = NODE_TYPES.AFTER_START;
            if (beforeGoal && cell.equals(beforeGoal)) nodeType = NODE_TYPES.BEFORE_GOAL;

            // Skip node if it falls inside one of the areas (unless it is a start/end/boundary cell)
            if (removeInnerNodes && nodeType === NODE_TYPES.STANDARD) {
                if (startArea && startArea.includesCell(cell, false)) return;
                if (endArea && endArea.includesCell(cell, false)) return;
            }

            grid[horizontalIndex][verticalIndex] = new Node(cell, nodeType);
        })
    })

    return { grid, centerRow, centerCol };
}

function getCenterLine(startArea, startCell, endArea, endCell, dimension) {
    const startTopLeft = startArea ? startArea.topLeft : startCell;
    const startBottomRight = startArea ? startArea.bottomRight : startCell;
    const endTopLeft = endArea ? endArea.topLeft : endCell;
    const endBottomRight = endArea ? endArea.bottomRight : endCell;

    if (startBottomRight[dimension] <= endTopLeft[dimension]) {
        return Math.floor((startBottomRight[dimension] + endTopLeft[dimension]) / 2);
    } else if (endBottomRight[dimension] <= startTopLeft[dimension]) {
        return Math.floor((endBottomRight[dimension] + startTopLeft[dimension]) / 2);
    } else {
        return Math.floor((startCell[dimension] + endCell[dimension]) / 2);
    }
}

// Normally, we remove all inner nodes from each shape (except for starting/ending nodes). However, if shapes overlap,
// we cannot remove these nodes otherwise it will be impossible to route from start to goal.
function shouldRemoveInnerNodes(startArea, startCell, endArea, endCell) {
    if (startArea && endArea && startArea.overlaps(endArea, false)) return false;
    if (startArea && !endArea && startArea.includesCell(endCell)) return false;
    if (endArea && !startArea && endArea.includesCell(startCell)) return false;

    return true;
}

// A "first hop" cell is the neighbor to the start/goal nodes.
function findFirstHopCell(endpoint, dir, area) {
    if (!area) return null;

    const offset = directionToOffset(dir)
    const boundary = endpoint.clone();

    for (let i = 0; i < 10; i++) {
        boundary.translate(offset[0], offset[1]);
        switch(dir) {
            case DIRECTIONS.UP:
                if (boundary.row === area.topLeft.row) return boundary;
                break;
            case DIRECTIONS.RIGHT:
                if (boundary.col === area.bottomRight.col) return boundary;
                break;
            case DIRECTIONS.DOWN:
                if (boundary.row === area.bottomRight.row) return boundary;
                break;
            case DIRECTIONS.LEFT:
                if (boundary.col === area.topLeft.col) return boundary;
                break;
        }
    }

    throw new Error(`Could not find boundary cell: ${endpoint} ${dir} ${area}`)
}

/**
 * Establishes bidirectional neighbor links between nodes in a 2D grid.
 *
 * Iterates through the provided grid of Node objects and assigns each node's neighboring references
 * based on its position:
 * - Standard/first-hop nodes are connected to any directly adjacent nodes (up, down, left, right) that are also of
 *   type standard/first-hop.
 * - Start and goal nodes are only connected to a single node in the specified direction (`startDir` or `endDir`).
 * - Undefined grid entries are ignored. Two nodes on opposite sides of an undefined space are not considered neighbors.
 */
function assignNeighbors(grid, startDir, endDir) {
    const cardinalOffsets = CARDINAL_DIRECTIONS.map(direction => directionToOffset(direction));

    if (DEBUG_NEIGHBORS) {
        console.log('PRE ASSIGNMENT:')
        grid.forEach((gridRow, rowIndex) => {
            console.log(gridRow.map(node => node === undefined ? '    undefined     ' : node).join(' | '))
        })
    }

    // Capture references to first-hop nodes. Note: We could improve performance by passing these in (since we
    // have references during buildGrid stage), but I'm trying to minimize number of arguments.
    let afterStart, beforeGoal;
    grid.forEach((gridRow, rowIndex) => {
        gridRow.forEach((node, colIndex) => {
            if (node && node.type === NODE_TYPES.AFTER_START) afterStart = node;
            if (node && node.type === NODE_TYPES.BEFORE_GOAL) beforeGoal = node;
        });
    });

    grid.forEach((gridRow, rowIndex) => {
        gridRow.forEach((node, colIndex) => {
            if (!node) return;

            switch (node.type) {
                case NODE_TYPES.STANDARD:
                case NODE_TYPES.AFTER_START:
                case NODE_TYPES.BEFORE_GOAL:
                    cardinalOffsets.forEach(([rowOffset, colOffset]) => {
                        const neighborRow = grid[rowIndex + rowOffset];
                        if (!neighborRow) return;
                        const neighbor = neighborRow[colIndex + colOffset];
                        if (!neighbor || neighbor.type === NODE_TYPES.START || neighbor.type === NODE_TYPES.GOAL) return;
                        if (DEBUG_NEIGHBORS) console.log(`(a) for ${node.type} ${node.cell} adding ${neighbor.cell}`)
                        node.addNeighbor(neighbor, rowOffset === 0 ? AXES.HORIZONTAL : AXES.VERTICAL);
                    })
                    break;
                case NODE_TYPES.START:
                case NODE_TYPES.GOAL:
                    const dir = node.type === NODE_TYPES.START ? startDir : endDir;

                    // Normally, we know the start/goal's neighbor is a first-hop node (afterStart/afterEnd). But if
                    // start/goal has no surrounding area there is no first hop. In these cases, have to find neighbor
                    // using the given direction.
                    let neighbor;
                    if (node.type === NODE_TYPES.START && afterStart) neighbor = afterStart;
                    if (node.type === NODE_TYPES.GOAL && beforeGoal) neighbor = beforeGoal;
                    if (!neighbor) {
                        const offset = directionToOffset(dir);
                        neighbor = grid[rowIndex + offset[0]][colIndex + offset[1]]
                    }
                    if (!neighbor) throw new Error(`neighbor must be defined for ${node.type} node`)
                    if (DEBUG_NEIGHBORS) console.log(`(b) for ${node.type} ${node.cell} ${dir} adding ${neighbor.cell}`)
                    node.addNeighbor(neighbor, axisForDir(dir))
                    neighbor.addNeighbor(node, axisForDir(dir));
                    break;
            }
        })
    })

    if (DEBUG_NEIGHBORS) {
        console.log('POST ASSIGNMENT:')
        grid.forEach((gridRow, rowIndex) => {
            console.log(gridRow.map(node => node === undefined ? '    undefined     ' : node).join(' | '))
        })
    }
}

function directionToOffset(direction) {
    switch(direction) {
        case DIRECTIONS.UP:
            return [-1, 0];
        case DIRECTIONS.RIGHT:
            return [0, 1];
        case DIRECTIONS.DOWN:
            return [1, 0];
        case DIRECTIONS.LEFT:
            return [0, -1];
        default:
            throw new Error(`Invalid direction: ${direction}`)
    }
}


class Node {
    constructor(cell, type) {
        this.cell = cell;
        this.type = type;
        this.neighbors = [];

        this.g = Infinity;
        this.h = 0;
        this.cameFrom = null;
        this.cameFromAxis = null;
    }

    addNeighbor(node, axis) {
        let cost;
        if (axis === AXES.HORIZONTAL) {
            cost = Math.abs(node.cell.col - this.cell.col)
        } else {
            cost = Math.abs(node.cell.row - this.cell.row)
        }

        this.neighbors.push({ node, cost, axis });
    }

    get f() {
        return this.g + this.h;
    }

    // -------------------------------------------------------- Debug functions:

    get debugChar() {
        switch (this.type) {
            case NODE_TYPES.STANDARD:
                return '*';
            case NODE_TYPES.START:
                return 'S';
            case NODE_TYPES.GOAL:
                return 'G';
            case NODE_TYPES.AFTER_START:
                return 's';
            case NODE_TYPES.BEFORE_GOAL:
                return 'g';
        }
    }

    toString() {
        return `${this.cell} (${this.debugChar}) n:${this.neighbors.length}`

        let neighbors = ``
        this.neighbors.forEach(({node, cost, axis}) => {
            const axisAbbr = axis === AXES.VERTICAL ? 'V' : 'H';
            neighbors += `\n  ${node.cell}, $${cost} (${axisAbbr})`
        })
        return `${this.cell},n:${this.neighbors.length}${neighbors}`
    }
}

