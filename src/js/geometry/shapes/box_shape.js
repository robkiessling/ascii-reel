import Shape from "./shape.js";
import Cell from "../cell.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import CellArea from "../cell_area.js";
import {EDGE_SIDES, VERTEX_CORNERS} from "./constants.js";
import {BodyHandle, EdgeHandle, HandleCollection, VertexHandle} from "./handle.js";

/**
 * Abstract base class for all shapes defined by a rectangular bounding box.
 *
 * A BoxShape has a top-left Cell (`topLeft`) and dimensions (`numRows`, `numCols`)
 * that determine its position and size on the canvas/grid.
 */
export default class BoxShape extends Shape {

    serializeProps() {
        const { topLeft, ...restProps } = this.props;
        const result = structuredClone(restProps);
        result.topLeft = topLeft.serialize();
        return result;
    }

    static deserializeProps(props) {
        const { topLeft, ...restProps } = props;
        const result = structuredClone(restProps);
        result.topLeft = Cell.deserialize(topLeft);
        return result;
    }

    _convertInitialDrawToProps() {
        const area = CellArea.fromCells([this._initialDraw.anchor, this._initialDraw.hover]);

        this.props.topLeft = area.topLeft;
        this.props.numRows = area.numRows;
        this.props.numCols = area.numCols;
        this._clearCache();
    }

    resize(oldBox, newBox) {
        const snapshot = this.resizeSnapshot;

        const oldArea = CellArea.fromOriginAndDimensions(snapshot.topLeft, snapshot.numRows, snapshot.numCols);
        const newArea = translateAreaWithBoxResizing(oldArea, oldBox, newBox).area;

        this.props.topLeft = newArea.topLeft;
        this.props.numRows = newArea.numRows;
        this.props.numCols = newArea.numCols;
        this._clearCache();
    }

    translate(rowOffset, colOffset) {
        this.props.topLeft.translate(rowOffset, colOffset);
        this._clearCache();
    }

    static vertexHandles(shape, boundingArea) {
        return [
            new VertexHandle(shape, VERTEX_CORNERS.TOP_LEFT_CORNER, boundingArea.topLeftVertex),
            new VertexHandle(shape, VERTEX_CORNERS.TOP_RIGHT_CORNER, boundingArea.topRightVertex),
            new VertexHandle(shape, VERTEX_CORNERS.BOTTOM_LEFT_CORNER, boundingArea.bottomLeftVertex),
            new VertexHandle(shape, VERTEX_CORNERS.BOTTOM_RIGHT_CORNER, boundingArea.bottomRightVertex),
        ]
    }

    static edgeHandles(shape, boundingArea) {
        return [
            new EdgeHandle(shape, EDGE_SIDES.TOP_EDGE, boundingArea.topLeftVertex, boundingArea.topRightVertex),
            new EdgeHandle(shape, EDGE_SIDES.LEFT_EDGE, boundingArea.topLeftVertex, boundingArea.bottomLeftVertex),
            new EdgeHandle(shape, EDGE_SIDES.RIGHT_EDGE, boundingArea.topRightVertex, boundingArea.bottomRightVertex),
            new EdgeHandle(shape, EDGE_SIDES.BOTTOM_EDGE, boundingArea.bottomLeftVertex, boundingArea.bottomRightVertex),
        ]
    }

    _buildHandleCollection(boundingArea, bodyHitbox) {
        return new HandleCollection([
            ...BoxShape.vertexHandles(this, boundingArea),
            ...BoxShape.edgeHandles(this, boundingArea),
            new BodyHandle(this, bodyHitbox),
        ])
    }


}