import {DIRECTIONS, EDGE_SIDES, HANDLE_TYPES, VERTEX_CORNERS} from "../../../config/shapes.js";
import Cell from "../../cell.js";
import CellArea from "../../cell_area.js";
import VertexArea from "../../vertex_area.js";
import Point from "../../point.js";


/**
 * Using vector-based areas when resizing so that flipping works better. Flipping occurs over an edge BETWEEN
 * cells, not over a whole cell row.
 */

/**
 * Returns a new VertexArea after resizing the original VertexArea using the given handle's new position.
 *
 * This function interprets which edges or corners of the bounding box should move, based on which handle is
 * being dragged, and by how much. Handles may cause the box to flip (e.g. dragging topLeft past bottomRight),
 * but the returned box will preserve those inverted bounds. It's up to later logic to normalize or use it for
 * proportional transforms.
 *
 * @param {VertexArea} oldBox - original area before box resizing
 * @param {VertexHandle|EdgeHandle|BodyHandle|CellHandle} handle - the box handle being dragged
 * @param {Cell} newPosition - New position of the dragged handle
 * @returns {VertexArea}
 */
export function resizeBoundingBox(oldBox, handle, newPosition) {
    newPosition = newPosition.clone(); // do not mutate parameter

    // anchor is the corner/edge of the rectangle that is not moving (it will be opposite of the handle)
    let anchor;

    // This will be used to prevent zero width or zero height boxes. If the handle position overlaps the anchor, the
    // handle will be pushed in this direction.
    let anchorPushback = { row: 0, col: 0 };

    switch(handle.type) {
        case HANDLE_TYPES.VERTEX:
            switch(handle.corner) {
                case VERTEX_CORNERS.TOP_LEFT_CORNER:
                    anchor = oldBox.bottomRight;
                    anchorPushback = { row: -1, col: -1 }
                    break;
                case VERTEX_CORNERS.TOP_RIGHT_CORNER:
                    anchor = oldBox.bottomLeft;
                    anchorPushback = { row: -1, col: 1 }
                    break;
                case VERTEX_CORNERS.BOTTOM_LEFT_CORNER:
                    anchor = oldBox.topRight;
                    anchorPushback = { row: 1, col: -1 }
                    break;
                case VERTEX_CORNERS.BOTTOM_RIGHT_CORNER:
                    anchor = oldBox.topLeft;
                    anchorPushback = { row: 1, col: 1 }
                    break;
            }
            break;
        case HANDLE_TYPES.EDGE:
            switch(handle.side) {
                case EDGE_SIDES.TOP_EDGE:
                    // Setting anchor to bottomLeft. It could be any point on the bottom row, but we pick bottomLeft and
                    // then lock the newPosition to the right side so the box width stays constant.
                    anchor = oldBox.bottomLeft;
                    anchorPushback = { row: -1, col: 0 }
                    newPosition.col = oldBox.topRight.col; // Lock to right edge
                    break;
                case EDGE_SIDES.LEFT_EDGE:
                    anchor = oldBox.topRight;
                    anchorPushback = { row: 0, col: -1 }
                    newPosition.row = oldBox.bottomLeft.row; // Lock to bottom edge
                    break;
                case EDGE_SIDES.RIGHT_EDGE:
                    anchor = oldBox.topLeft;
                    anchorPushback = { row: 0, col: 1 }
                    newPosition.row = oldBox.bottomRight.row; // Lock to bottom edge
                    break;
                case EDGE_SIDES.BOTTOM_EDGE:
                    anchor = oldBox.topLeft;
                    anchorPushback = { row: 1, col: 0 }
                    newPosition.col = oldBox.bottomRight.col; // Lock to right edge
                    break;
            }
            break;
        default:
            throw new Error(`Invalid handle: ${handle}`);
    }

    if (newPosition.row === anchor.row) newPosition.row += anchorPushback.row;
    if (newPosition.col === anchor.col) newPosition.col += anchorPushback.col;

    // TODO newPosition is a Cell, not a Vertex
    return VertexArea.fromVertices([anchor, newPosition]);
}

/**
 * Translates and resizes a CellArea as its outer box changes. For example, if multiple shapes are selected, the
 * outer box will be the bounding rect that fits all shapes. As this bounding rect is moved/resized, each inner
 * shape will be handled by this function.
 *
 * For each inner shape, we cannot simply take all the points of a rect (e.g. topLeft & bottomRight) or Line and
 * proportionally map them from oldBox to newBox. If you do this, the difference between points may jitter as the shape
 * is resized due to rounding (because we must round to discrete cell indices). In other words, the shape's size
 * fluctuates as you resize a group, which looks bad.
 *
 * I've found that the smoothest way to resize is to instead:
 * 1) Determine the dimensions of the new shape. By calculating this first, it guarantees that as you resize
 *    a shape, its dimensions smoothly get smaller/larger; its height will not jump from 3 to 4 back to 3, etc.
 * 2) Pick a single anchor point on the shape to map from oldBox to newBox. This determines where the new shape
 *    will be placed. I'm currently just using the topLeft of every shape's boundaries as the point, but in the
 *    future it may be better to choose the anchor closest to the drag handle.
 * 3) Now that we have the new anchor point and dimensions of the new shape, we know exactly where and how big
 *    the new area of the shape is. Now we can proportionally map every cell in the old shape to a cell in the new shape.
 *    Note that this step is not required for all shapes - e.g. for a rect we already have everything needed from steps
 *    1 & 2 (since a rect is just defined by its topLeft and dimensions).
 *
 * @param {CellArea} cellArea - The inner shape's CellArea to translate/resize
 * @param {VertexArea} oldBox - The original bounding box
 * @param {VertexArea} newBox - The new location/size of the bounding box
 * @returns {{area: CellArea, cellMapper: function, pointMapper: function}} - The new location/dimensions of the
 *   given CellArea, along with functions to map any inner cells/points that were part of the original cellArea.
 */
export function translateAreaWithBoxResizing(cellArea, oldBox, newBox) {
    const newDimensions = calculateScaledDimensions(cellArea.numRows, cellArea.numCols, oldBox, newBox);
    const { cell: newTopLeft, flipRow, flipCol } = calculateNewTopLeft(cellArea.topLeft, newDimensions, oldBox, newBox);
    const newCellArea = CellArea.fromOriginAndDimensions(newTopLeft, newDimensions.numRows, newDimensions.numCols);
    return {
        area: newCellArea,
        cellMapper: buildCellMapper(cellArea, newCellArea, flipRow, flipCol),
        pointMapper: buildPointMapper(cellArea, newCellArea, flipRow, flipCol)
    };
}

function calculateScaledDimensions(numRows, numCols, oldBox, newBox, minSize = 1) {
    const rowScale = newBox.numRows / oldBox.numRows;
    const colScale = newBox.numCols / oldBox.numCols;

    let scaledNumRows = Math.round(numRows * rowScale);
    let scaledNumCols = Math.round(numCols * colScale);

    // Ensure minimum size
    scaledNumRows = Math.max(scaledNumRows, minSize);
    scaledNumCols = Math.max(scaledNumCols, minSize);

    return { numRows: scaledNumRows, numCols: scaledNumCols, rowScale, colScale };
}

function calculateNewTopLeft(oldPosition, dimensions, oldBox, newBox) {
    const flipRow = oldBox.topLeft.row === newBox.bottomRight.row || oldBox.bottomRight.row === newBox.topLeft.row;
    const flipCol = oldBox.topLeft.col === newBox.bottomRight.col || oldBox.bottomRight.col === newBox.topLeft.col;

    // Calculate percentage positions
    const rowPct = (oldPosition.row - oldBox.topLeft.row) / oldBox.numRows;
    const colPct = (oldPosition.col - oldBox.topLeft.col) / oldBox.numCols;

    let newRow, newCol;

    if (flipRow) {
        // Flipped vertically: calculate anchor based on distance from bottom edge
        newRow = Math.round(newBox.bottomRight.row - newBox.numRows * rowPct);
        newRow = Math.max(newRow, newBox.topLeft.row + dimensions.numRows); // Ensure shape fits within top bounds
        newRow = newRow - dimensions.numRows;
    } else {
        // Normal case: calculate anchor based on distance from top edge
        newRow = Math.round(newBox.topLeft.row + newBox.numRows * rowPct);
        newRow = Math.min(newRow, newBox.bottomRight.row - dimensions.numRows); // Ensure shape fits within bottom bounds
    }

    if (flipCol) {
        // Flipped horizontally: calculate anchor based on distance from right edge
        newCol = Math.round(newBox.bottomRight.col - newBox.numCols * colPct);
        newCol = Math.max(newCol, newBox.topLeft.col + dimensions.numCols); // Ensure shape fits within left bounds
        newCol = newCol - dimensions.numCols;
    } else {
        // Normal case: calculate anchor based on distance from left edge
        newCol = Math.round(newBox.topLeft.col + newBox.numCols * colPct);
        newCol = Math.min(newCol, newBox.bottomRight.col - dimensions.numCols); // Ensure shape fits within right bounds
    }

    return {
        cell: new Cell(newRow, newCol),
        flipRow,
        flipCol
    };
}

// Proportionally map points from an oldCellArea to a newCellArea
function buildPointMapper(oldCellArea, newCellArea, flipRow, flipCol) {
    return oldPoint => {
        let xPct = (oldPoint.x - oldCellArea.x) / oldCellArea.width;
        let yPct = (oldPoint.y - oldCellArea.y) / oldCellArea.height;

        xPct = flipCol ? (1 - xPct) : xPct;
        yPct = flipRow ? (1 - yPct) : yPct;

        return new Point(
            newCellArea.x + xPct * newCellArea.width,
            newCellArea.y + yPct * newCellArea.height
        );
    }
}

// If the cellArea is 1 dimensional, we have to choose where to map things as it scales back up
const MAP_1D_TO = 0.5; // Choosing to map to the center of new area


/**
 * Returns a function that can be used to proportionally map cells from an oldCellArea to a newCellArea
 * @param {CellArea} oldCellArea - Old CellArea
 * @param {CellArea} newCellArea - New CellArea
 * @param {boolean} flipRow - Whether rows should be inverted
 * @param {boolean} flipCol - Whether columns should be inverted
 * @returns {(oldCell: Cell) => Cell} - Mapping function
 */
function buildCellMapper(oldCellArea, newCellArea, flipRow, flipCol) {
    return oldCell => {
        let rowPct = (oldCellArea.numRows > 1) ?
            (oldCell.row - oldCellArea.topLeft.row) / (oldCellArea.numRows - 1) :
            MAP_1D_TO;

        let colPct = (oldCellArea.numCols > 1) ?
            (oldCell.col - oldCellArea.topLeft.col) / (oldCellArea.numCols - 1) :
            MAP_1D_TO;

        rowPct = flipRow ? (1 - rowPct) : rowPct;
        colPct = flipCol ? (1 - colPct) : colPct;

        let newRow = (newCellArea.numRows > 1) ?
            Math.round(newCellArea.topLeft.row + rowPct * (newCellArea.numRows - 1)) :
            newCellArea.topLeft.row;

        let newCol = (newCellArea.numCols > 1) ?
            Math.round(newCellArea.topLeft.col + colPct * (newCellArea.numCols - 1)) :
            newCellArea.topLeft.col;

        return new Cell(newRow, newCol);
    }
}




/**
 * Calculates the position of a cell along an attachment edge as a percentage (0 to 1).
 *
 * Attachment edges are the 1-cell-wide borders around a rectangle where connections can attach.
 * This function determines where along that edge a specific cell sits.
 *
 * For example, if an edge runs horizontally from columns 5-10:
 * - Cell at column 5 returns 0 (start)
 * - Cell at column 7.5 returns 0.5 (midpoint)
 * - Cell at column 10 returns 1 (end)
 *
 * @param {CellArea} attachmentEdge - The 1-cell-wide or 1-cell-tall border area where attachment occurs
 * @param {Cell} cell - The specific cell location along that edge
 * @returns {number} Percentage along edge from 0 (start) to 1 (end)
 */
export function getAttachmentEdgePct(attachmentEdge, cell) {
    if (!attachmentEdge.includesCell(cell)) throw new Error(`attachmentEdge ${attachmentEdge} does not include ${cell}`)
    if (attachmentEdge.numRows > 1 && attachmentEdge.numCols > 1) throw new Error(`attachmentEdge ${attachmentEdge} has area`)

    const { topLeft, bottomRight } = attachmentEdge;

    let edgeLength, positionOnEdge;
    if (isHorizontalArea(attachmentEdge)) {
        edgeLength = bottomRight.col - topLeft.col;
        positionOnEdge = cell.col - topLeft.col;
    } else {
        edgeLength = bottomRight.row - topLeft.row;
        positionOnEdge = cell.row - topLeft.row;
    }

    if (edgeLength === 0) return MAP_1D_TO;
    return positionOnEdge / edgeLength;
}

/**
 * Calculates which cell along an attachment edge corresponds to a given position percentage.
 *
 * This is the inverse of `getAttachmentEdgePct`. Given a percentage (0 to 1) along an edge,
 * it returns the cell coordinates at that position.
 *
 * For example, if an edge runs horizontally from columns 5-10:
 * - pct 0 returns cell at column 5 (start)
 * - pct 0.5 returns cell at column 7.5 (midpoint)
 * - pct 1 returns cell at column 10 (end)
 *
 * @param {CellArea} attachmentEdge - The 1-cell-wide or 1-cell-tall border area where attachment occurs
 * @param {number} pct - Percentage along edge from 0 (start) to 1 (end)
 * @returns {Cell} The cell coordinates at that position along the edge
 */
export function getAttachmentEdgeCell(attachmentEdge, pct) {
    if (attachmentEdge.numRows > 1 && attachmentEdge.numCols > 1) throw new Error(`attachmentEdge ${attachmentEdge} has area`)

    const { topLeft, bottomRight } = attachmentEdge;

    if (isHorizontalArea(attachmentEdge)) {
        return new Cell(
            topLeft.row,
            topLeft.col + Math.round(pct * (bottomRight.col - topLeft.col))
        )
    } else {
        return new Cell(
            topLeft.row + Math.round(pct * (bottomRight.row - topLeft.row)),
            topLeft.col
        )
    }
}


function isHorizontalArea(attachmentEdge) {
    const { topLeft, bottomRight } = attachmentEdge;
    return Math.abs(topLeft.col - bottomRight.col) > Math.abs(topLeft.row - bottomRight.row);
}
