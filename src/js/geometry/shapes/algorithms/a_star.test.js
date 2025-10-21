import {findPathAStar, buildRoutingGraph} from "./a_star.js";
import CellArea from "../../cell_area.js";
import Cell from "../../cell.js";
import {DIRECTIONS} from "../constants.js";
import {create2dArray, forEachAdjPair} from "../../../utils/arrays.js";

const DEBUG = false;

// TODO We should expand this spec to also test final orthogonalPath, so it can test centerLineCorrection results

const SCENARIOS = [
    {
        // only: true,
        name: "Standard graph", // 2 completely separate areas, with a double elbow line between them
        startArea: new CellArea(new Cell(0, 0), new Cell(7, 6)),
        startCell: new Cell(4, 4),
        startDir: DIRECTIONS.RIGHT,
        endArea: new CellArea(new Cell(12, 15), new Cell(20, 23)),
        endCell: new Cell(17, 17),
        endDir: DIRECTIONS.LEFT,

        expectedNumNodes: 49,
        expectedNodes: [
            { cell: [0, 4], neighbors: [[0, 6], [0, 0]] },
            { cell: [0, 6], neighbors: 3 },
            { cell: [4, 4], neighbors: [[4, 6]] },
            { cell: [9, 10], neighbors: 4 },
        ],
        expectedPath: [
            // Note: A* algorithm will not use center line, that is performed later
            [4, 4], [4, 6], [4, 10], [4, 15], [7, 15], [9, 15], [12, 15], [17, 15], [17, 17]
        ],
    },

    {
        // only: true,
        name: "Same horizontal plane", // 2 areas in same horizontal plane
        startArea: new CellArea(new Cell(0, 0), new Cell(12, 6)),
        startCell: new Cell(7, 4),
        startDir: DIRECTIONS.RIGHT,
        endArea: new CellArea(new Cell(1, 14), new Cell(9, 19)),
        endCell: new Cell(5, 16),
        endDir: DIRECTIONS.LEFT,

        expectedNumNodes: 43,
        expectedNodes: [
            { cell: [0, 4], neighbors: 2 },
            { cell: [0, 6], neighbors: 3 },
            { cell: [1, 10], neighbors: 4 },
            { cell: [7, 4], neighbors: 1 },
            { cell: [5, 16], neighbors: 1 },
            { cell: [6, 10], neighbors: 4 },
        ],
        expectedPath: [
            [7, 4], [7, 6], [7, 10], [7, 14], [6, 14], [5, 14], [5, 16]
        ],
    },

    {
        // only: true,
        name: "Open ended (L shape)", // endpoint is not attached to a shape; also it is far away from start shape
        startArea: new CellArea(new Cell(0, 0), new Cell(7, 7)),
        startCell: new Cell(4, 5),
        startDir: DIRECTIONS.RIGHT,
        endArea: undefined,
        endCell: new Cell(17, 17),
        endDir: DIRECTIONS.LEFT,

        expectedNumNodes: 25,
        expectedNodes: [
            // check vertical center line
            { cell: [0, 12], neighbors: 3 },
            { cell: [4, 12], neighbors: 4 },

            // endpoint should point left
            { cell: [17, 17], neighbors: [[17, 12]] },
        ],
        expectedPath: [
            [4, 5], [4, 7], [4, 12], [7, 12], [12, 12], [17, 12], [17, 17]
        ],
    },

    {
        // only: true,
        name: "Open ended (almost vertical)", // endpoint is not attached to a shape; also it is almost vertical with start
        startArea: new CellArea(new Cell(0, 0), new Cell(7, 7)),
        startCell: new Cell(5, 4),
        startDir: DIRECTIONS.DOWN,
        endArea: undefined,
        endCell: new Cell(11, 5),
        endDir: DIRECTIONS.UP,

        expectedNumNodes: 19,
        expectedNodes: [
            // endpoint should point up
            { cell: [11, 5], neighbors: [[9, 5]] },
        ],
        expectedPath: [
            [5, 4], [7, 4], [9, 4], [9, 5], [11, 5]
        ],
    },

    {
        // only: true,
        name: "Open ended (overlapping)", // endpoint is not attached to a shape; also it is overlapping with start area
        startArea: new CellArea(new Cell(0, 0), new Cell(7, 7)),
        startCell: new Cell(5, 4),
        startDir: DIRECTIONS.DOWN,
        endArea: undefined,
        endCell: new Cell(7, 5),
        endDir: DIRECTIONS.UP,

        expectedNumNodes: 12,
        expectedNodes: [
            // TODO
        ],
        expectedPath: [
            // TODO this test is pretty weird path. Wraps all the way around shape
            [5, 4], [7, 4], [7, 0], [5, 0], [0, 0], [0, 4], [0, 5], [5, 5], [7, 5]
        ],
    },

    {
        // only: true,

        // The following test ensures that if the end node's horizontal line cuts between the start node and its
        // first hop, it doesn't cause problems.
        name: "Open ended (wrapping around rect)",
        startArea: new CellArea(new Cell(0, 0), new Cell(7, 7)),
        startCell: new Cell(5, 4),
        startDir: DIRECTIONS.DOWN,
        endArea: undefined,
        endCell: new Cell(6, 12),
        endDir: DIRECTIONS.LEFT,

        expectedNumNodes: 19,
        expectedNodes: [
            { cell: [5, 4], neighbors: [[7, 4]] }, // start cell neighbor hops over (6, 4)
            { cell: [6, 12], neighbors: [[6, 9]] }, // end cell
        ],
        expectedPath: [
            [5, 4], [7, 4], [7, 7], [7, 9], [6, 9], [6, 12]
        ],
    },

    {
        // only: true,

        name: "Overlapping areas",
        startArea: new CellArea(new Cell(9, 0), new Cell(19, 15)),
        startCell: new Cell(17, 8),
        startDir: DIRECTIONS.DOWN,
        endArea: new CellArea(new Cell(0, 6), new Cell(10, 21)),
        endCell: new Cell(8, 14),
        endDir: DIRECTIONS.DOWN,

        expectedNumNodes: 49, // overlapping means no nodes get removed
        expectedNodes: [
            // todo
        ],
        expectedPath: [
            [17, 8], [19, 8], [19, 11], [19, 14], [17, 14], [12, 14], [10, 14], [8, 14]
        ],
    },

    {
        // only: true,
        name: "Single cell", // pathing should when start/end is just the same single cell
        startArea: undefined,
        startCell: new Cell(4, 4),
        startDir: DIRECTIONS.DOWN,
        endArea: undefined,
        endCell: new Cell(4, 4),
        endDir: DIRECTIONS.UP,

        expectedNumNodes: 1,
        expectedNodes: [
            { cell: [4, 4], neighbors: 0 },
        ],
        expectedPath: [
            [4, 4]
        ],
    },


]

test(`Scenario configuration`, () => {
    const scenarioNames = SCENARIOS.map(scenario => scenario.name)
    expect((new Set(scenarioNames).size), `Expect all scenarios to have unique names`).toBe(scenarioNames.length);
})

SCENARIOS.forEach((
    {
        only,
        name, startArea, startCell, startDir, endArea, endCell, endDir,
        expectedNumNodes, expectedNodes, expectedPath
    }) => {

    // Testing node layout / node neighbors
    (only ? test.only : test)(`${name} - node layout`, () => {
        if (DEBUG) console.log(`\n---------------- ${name} ----------------`)
        if (DEBUG) printStartConditions(startArea, startCell, startDir, endArea, endCell, endDir);

        const {nodesByCell} = buildRoutingGraph(startArea, startCell, startDir, endArea, endCell, endDir);
        if (DEBUG) printRoutingGraph(startArea, startCell, endArea, endCell, nodesByCell);

        expect(nodesByCell.size, `Expected ${expectedNumNodes} nodes`).toBe(expectedNumNodes)

        expectedNodes.forEach(({ cell: expectedCell, neighbors: expectedNeighbors }) => {
            expectedCell = new Cell(expectedCell[0], expectedCell[1]); // convert from array form to a Cell
            const node = nodesByCell.get(expectedCell);
            expect(node, `Expected node ${expectedCell} to exist`).toBeTruthy();

            if (Array.isArray(expectedNeighbors)) {
                expect(
                    node.neighbors.length,
                    `Expected node ${node.cell} to have ${expectedNeighbors.length} neighbors`
                ).toBe(expectedNeighbors.length)
                expectedNeighbors.forEach((expectedNeighbor, i) => {
                    expectedNeighbor = new Cell(expectedNeighbor[0], expectedNeighbor[1]) // convert from array form to a Cell
                    expect(
                        node.neighbors[i].node.cell.equals(expectedNeighbor),
                        `Expected node ${node.cell} to have neighbor ${expectedNeighbor}`
                    ).toBeTruthy();
                })
            } else {
                expect(
                    node.neighbors.length,
                    `Expected node ${node.cell} to have ${expectedNeighbors} neighbors`
                ).toBe(expectedNeighbors)
            }
        })
    });

    // Testing A* pathfinding
    (only ? test.only : test)(`${name} - A* path`, () => {
        const {nodesByCell, startNode, endNode} = buildRoutingGraph(startArea, startCell, startDir, endArea, endCell, endDir);
        const path = findPathAStar(startNode, endNode);
        if (DEBUG) printRoutedPath(startArea, startCell, endArea, endCell, nodesByCell, path);

        expect(path.length, `Expected path to be ${expectedPath.length} steps long`).toBe(expectedPath.length)
        expectedPath.forEach((expectedCell, i) => {
            expectedCell = new Cell(expectedCell[0], expectedCell[1]); // convert from array form to a Cell
            expect(
                expectedCell.equals(path[i]),
                `Expected step ${i+1} to be at ${expectedCell} but it's at ${path[i]}`
            ).toBeTruthy()
        });
    });
})


function printStartConditions(startArea, startCell, startDir, endArea, endCell, endDir) {
    const { grid, totalArea } = setupPrintableGrid(startArea, startCell, endArea, endCell)
    grid[startCell.row][startCell.col] = 'S'
    grid[endCell.row][endCell.col] = 'G'

    console.log(`Start dir: ${startDir}, End dir: ${endDir}`)
    printGrid(grid, totalArea);
}

function printRoutingGraph(startArea, startCell, endArea, endCell, nodesByCell) {
    const { grid, totalArea } = setupPrintableGrid(startArea, startCell, endArea, endCell)
    nodesByCell.values().forEach(node => grid[node.cell.row][node.cell.col] = node.debugChar)

    console.log(`Nodes (*):`)
    printGrid(grid, totalArea);
}

function printRoutedPath(startArea, startCell, endArea, endCell, nodesByCell, path) {
    const { grid, totalArea } = setupPrintableGrid(startArea, startCell, endArea, endCell)
    nodesByCell.values().forEach(node => grid[node.cell.row][node.cell.col] = node.debugChar)
    forEachAdjPair(path, (a, b) => {
        a.lineTo(b).forEach(cell => grid[cell.row][cell.col] = '@')
    })

    console.log(`Path (@):`)
    printGrid(grid, totalArea);
}

function setupPrintableGrid(startArea, startCell, endArea, endCell) {
    const totalArea = CellArea.fromCells([
        new Cell(0, 0), // Always include origin so top left of printed grid is 0,0, even if no shapes intersect that
        ...(startArea ? [startArea.topLeft, startArea.bottomRight] : []),
        startCell,
        ...(endArea ? [endArea.topLeft, endArea.bottomRight] : []),
        endCell,
    ].filter(Boolean))

    const grid = create2dArray(totalArea.numRows, totalArea.numCols, ' ');
    if (startArea) startArea.iterate((r,c) => grid[r][c] = '.')
    if (endArea) endArea.iterate((r,c) => grid[r][c] = '.')

    return { grid, totalArea }
}

function printGrid(grid, totalArea) {
    const BORDER_CHAR = '#'

    console.log(BORDER_CHAR.repeat(totalArea.numCols + 2))
    grid.forEach(row => console.log(`${BORDER_CHAR}${row.join('')}${BORDER_CHAR}`))
    console.log(BORDER_CHAR.repeat(totalArea.numCols + 2))
    console.log('')
}

function comparePaths(expectedPath, actualPath) {
    expect(actualPath.length).toBe(expectedPath.length)
    expectedPath.forEach((expectedCell, i) => {
        expect(expectedCell.equals(actualPath[i].cell)).toBeTruthy()
    });
}
