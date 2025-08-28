import Shape from "./shape.js";
import Cell from "../cell.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import CellArea from "../cell_area.js";

/**
 * Abstract base class for all shapes defined by a rectangular bounding box.
 *
 * A BoxShape has a top-left Cell (`topLeft`) and dimensions (`numRows`, `numCols`)
 * that determine its position and size on the canvas/grid.
 *
 * This class encapsulates shared logic for shape layout, geometry,
 * and interactive resizing (e.g., resize handles, bounding box updates).
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

    handleInitialDraw(cell, modifiers) {
        super.handleInitialDraw(cell, modifiers);

        const area = CellArea.fromCells([this._initialDraw.start, this._initialDraw.end]);

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

}