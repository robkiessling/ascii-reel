import Shape from "./shape.js";
import Cell from "../cell.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import CellArea from "../cell_area.js";
import {
    ATTACHMENT_OFFSET,
    CHAR_PROP,
    DIRECTIONS,
    EDGE_SIDES,
    FILL_OPTIONS,
    FILL_PROP,
    VERTEX_CORNERS
} from "../../config/shapes.js";
import {AttachmentHandle, BodyHandle, CaretHandle, EdgeHandle, HandleCollection, VertexHandle} from "./handle.js";

/**
 * Abstract base class for all shapes defined by a rectangular bounding box.
 *
 * A BoxShape has a top-left Cell (`topLeft`) and dimensions (`numRows`, `numCols`)
 * that determine its position and size on the canvas/grid.
 */
export default class BoxShape extends Shape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: 'topLeft' },
        { prop: 'numRows' },
        { prop: 'numCols' },
        { prop: FILL_PROP, default: FILL_OPTIONS.WHITESPACE },
    ];

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
        const { area: newArea } = translateAreaWithBoxResizing(oldArea, oldBox, newBox);

        this.props.topLeft = newArea.topLeft;
        this.props.numRows = newArea.numRows;
        this.props.numCols = newArea.numCols;
        this._clearCache();
    }

    translate(rowOffset, colOffset) {
        this.props.topLeft.translate(rowOffset, colOffset);
        this._clearCache();
        return true;
    }

    get topLeft() {
        return this.props.topLeft;
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

    _buildHandleCollection(boundingArea, bodyHitbox, caretHitbox) {
        return new HandleCollection([
            ...BoxShape.vertexHandles(this, boundingArea),
            ...BoxShape.edgeHandles(this, boundingArea),
            ...(bodyHitbox ? [new BodyHandle(this, bodyHitbox)] : []),
            ...(caretHitbox ? [new CaretHandle(this, caretHitbox)] : []),
            ...this._buildAttachmentHandles(boundingArea)
        ])
    }

    _buildAttachmentHandles(boundingArea) {
        const handles = [];

        const topArea = new CellArea(
            boundingArea.topLeft.clone().translate(-ATTACHMENT_OFFSET, 0),
            boundingArea.topRight.clone().translate(-ATTACHMENT_OFFSET, 0)
        )
        handles.push(new AttachmentHandle(this, topArea, DIRECTIONS.UP))

        const rightArea = new CellArea(
            boundingArea.topRight.clone().translate(0, ATTACHMENT_OFFSET),
            boundingArea.bottomRight.clone().translate(0, ATTACHMENT_OFFSET),
        )
        handles.push(new AttachmentHandle(this, rightArea, DIRECTIONS.RIGHT))

        const bottomArea = new CellArea(
            boundingArea.bottomLeft.clone().translate(ATTACHMENT_OFFSET, 0),
            boundingArea.bottomRight.clone().translate(ATTACHMENT_OFFSET, 0),
        )
        handles.push(new AttachmentHandle(this, bottomArea, DIRECTIONS.DOWN))

        const leftArea = new CellArea(
            boundingArea.topLeft.clone().translate(0, -ATTACHMENT_OFFSET),
            boundingArea.bottomLeft.clone().translate(0, -ATTACHMENT_OFFSET),
        )
        handles.push(new AttachmentHandle(this, leftArea, DIRECTIONS.LEFT))

        return handles;
    }


}