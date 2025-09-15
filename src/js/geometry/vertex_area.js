import PixelRect from "./pixel_rect.js";
import Vertex from "./vertex.js";
import CellArea from "./cell_area.js";

/**
 * Represents a rectangular region of the grid using cell corners (vertices), rather than cell centers.
 *
 * A vertex is defined as the top-left corner of a Cell. For example, a Cell at (2, 2) has:
 * - top-left vertex at (2, 2)
 * - top-right vertex at (2, 3)
 * - bottom-right vertex at (3, 3)
 * - bottom-left vertex at (3, 2)
 *
 * Unlike CellAreas, VertexAreas use an exclusive `bottomRight` corner. For example, a 2x2 square
 * VertexArea that visually covers cells (0,0), (0,1), (1,0), and (1,1) would have:
 * - `topLeft` vertex at (0, 0)
 * - `bottomRight` vertex at (2, 2) -> this is the top-left corner of Cell (2, 2), which lies just beyond the area
 *
 * This exclusive convention makes resizing math cleaner, as width and height are simply:
 *   `numCols = bottomRight.col - topLeft.col`
 *   `numRows = bottomRight.row - topLeft.row`
 * with no `+1` offset needed as in CellArea. VertexAreas are also a better fit for resize math because
 * resize handles typically sit on the corners or edges between cells rather than inside cells.
 */
export default class VertexArea extends PixelRect {

    /**
     * @param {Vertex} topLeft - Area's top-left vertex (inclusive)
     * @param {Vertex} bottomRight - Area's bottom-right vertex (exclusive)
     */
    constructor(topLeft, bottomRight) {
        super();
        this.topLeft = topLeft;
        this.bottomRight = bottomRight;
    }

    static fromOriginAndDimensions(topLeft, numRows, numCols) {
        const bottomRight = topLeft.clone().translate(numRows, numCols);
        return new VertexArea(topLeft.clone(), bottomRight);
    }

    static fromVertices(vertices) {
        const top = Math.min(...vertices.map(vertex => vertex.row));
        const left = Math.min(...vertices.map(vertex => vertex.col));
        const bottom = Math.max(...vertices.map(vertex => vertex.row));
        const right = Math.max(...vertices.map(vertex => vertex.col));
        return new VertexArea(new Vertex(top, left), new Vertex(bottom, right));
    }

    static mergeVertexAreas(vertexAreas) {
        const top = Math.min(...vertexAreas.map(vertexArea => vertexArea.topLeft.row));
        const left = Math.min(...vertexAreas.map(vertexArea => vertexArea.topLeft.col));
        const bottom = Math.max(...vertexAreas.map(vertexArea => vertexArea.bottomRight.row));
        const right = Math.max(...vertexAreas.map(vertexArea => vertexArea.bottomRight.col));
        return new VertexArea(new Vertex(top, left), new Vertex(bottom, right));
    }

    get numRows() {
        return this.bottomRight.row - this.topLeft.row;
    }

    get numCols() {
        return this.bottomRight.col - this.topLeft.col;
    }

    get topRight() {
        return this.topLeft.clone().translate(0, this.numCols);
    }
    get bottomLeft() {
        return this.topLeft.clone().translate(this.numRows, 0);
    }

    clone() {
        return new VertexArea(this.topLeft.clone(), this.bottomRight.clone());
    }

    /**
     * Converts the VertexArea to a CellArea.
     *
     * If the VertexArea has zero rows or zero cols, the CellArea must be expanded (CellAreas
     * cannot have zero rows/cols). The direction of expansion can be specified by parameters.
     * @param {boolean} [expandDown=true] - Direction to vertically expand if zero rows
     * @param {boolean} [expandRight=true] - Direction to horizontally expand if zero cols
     * @returns {CellArea}
     */
    toCellArea(expandDown = true, expandRight = true) {
        const topLeftCell = this.topLeft.bottomRightCell;
        const bottomRightCell = this.bottomRight.topLeftCell;

        if (bottomRightCell.col < topLeftCell.col) {
            if (expandRight) {
                bottomRightCell.translate(0, 1)
            } else {
                topLeftCell.translate(0, -1)
            }
        }

        if (bottomRightCell.row < topLeftCell.row) {
            if (expandDown) {
                bottomRightCell.translate(1, 0)
            } else {
                topLeftCell.translate(-1, 0)
            }
        }

        return new CellArea(topLeftCell, bottomRightCell);
    }

    toString() {
        return `VA[${this.topLeft}-${this.bottomRight}]`
    }

}