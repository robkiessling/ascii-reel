import {CHAR_PROP, COLOR_PROP, SHAPE_TYPES, STROKE_OPTIONS, STROKE_PROPS} from "./constants.js";
import Shape from "./shape.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import CellCache from "./cell_cache.js";
import {BodyHandle, CellHandle, HandleCollection} from "./handle.js";
import {elbowPath} from "./algorithms/line_elbow.js";
import {forEachAdjPair} from "../../utils/arrays.js";
import BoxShape from "./box_shape.js";


export default class Line extends Shape {

    static beginLine(startCell, options) {
        const props = {
            path: [startCell, startCell.clone()],
            [STROKE_PROPS[SHAPE_TYPES.LINE]]: options.drawPreset,
            [CHAR_PROP]: options.char,
            [COLOR_PROP]: options.colorIndex,
        }

        return new Line(undefined, SHAPE_TYPES.LINE, props);
    }

    serializeProps() {
        const { path, ...restProps } = this.props;
        const result = structuredClone(restProps);
        result.path = path.map(cell => cell.serialize());
        return result;
    }

    static deserializeProps(props) {
        const { path, ...restProps } = props;
        const result = structuredClone(restProps);
        result.path = path.map(cell => Cell.deserialize(cell));
        return result;
    }

    handleDrawMouseup(cell) {
        // If already in a multi-point drawing, return false (shape is not finished)
        if (this._initialDraw.multiPointDrawing) return false;

        // If not yet in a multi-point drawing, determine if a multi-point drawing should be started.
        // If mouseup occurs on the starting point of the line, user wants to start a multi-point drawing
        if (cell.equals(this._initialDraw.anchor)) {
            this._initialDraw.multiPointDrawing = true;
            return false; // shape is not finished
        } else {
            return true; // shape is finished
        }
    }

    finishDraw() {
        if (this._initialDraw.multiPointDrawing) {
            // When finished, set props according to final path (does not include latest hover cell)
            this.props.path = this._initialDraw.path;
            this._clearCache();
        }
    }

    _convertInitialDrawToProps() {
        // During draw, include the latest hover cell as the final step in the path
        this.props.path = [...this._initialDraw.path, this._initialDraw.hover];

        this._clearCache();
    }

    resize(oldBox, newBox) {
        const snapshot = this.resizeSnapshot;

        const oldArea = CellArea.fromCells(snapshot.path);
        const { area: newArea, cellMapper } = translateAreaWithBoxResizing(oldArea, oldBox, newBox);

        this.props.path = snapshot.path.map(cell => cellMapper(cell));
        this._clearCache();
    }

    _cacheGeometry() {
        const boundingArea = CellArea.fromCells(this.props.path);
        const glyphs = this._initGlyphs(boundingArea);
        const hitbox = new CellCache();

        const stroke = this.props[STROKE_PROPS[SHAPE_TYPES.LINE]]

        switch(stroke) {
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].STRAIGHT_MONOCHAR:
                forEachAdjPair(this.props.path, (a, b) => {
                    a.lineTo(b).forEach(cell => {
                        const relativeCell = cell.relativeTo(boundingArea.topLeft);
                        this._setGlyph(glyphs, relativeCell, this.props[CHAR_PROP], this.props[COLOR_PROP]);
                        hitbox.addCell(cell); // use absolute position for hitbox
                    });
                })
                break;
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_ASCII_VH:
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_UNICODE_VH:
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_MONOCHAR_VH:
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_ASCII_HV:
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_UNICODE_HV:
            case STROKE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_LINE_MONOCHAR_HV:
                elbowPath(this.props.path.at(0), this.props.path.at(-1), stroke, this.props[CHAR_PROP], (cell, char) => {
                    const relativeCell = cell.relativeTo(boundingArea.topLeft);
                    this._setGlyph(glyphs, relativeCell, char, this.props[COLOR_PROP]);
                    hitbox.addCell(cell); // use absolute position for hitbox
                })
                break;
            default:
                throw new Error(`Invalid stroke: ${stroke}`)
        }

        const handles = new HandleCollection([
            ...this.props.path.map((cell, i) => new CellHandle(this, cell, i)),

            // Only including box handles if line has more than 2 points
            ...(this.props.path.length > 2 ? BoxShape.vertexHandles(this, boundingArea) : []),
            ...(this.props.path.length > 2 ? BoxShape.edgeHandles(this, boundingArea) : []),

            new BodyHandle(this, cell => hitbox.hasCell(cell))
        ])

        this._cache = {
            boundingArea,
            origin: boundingArea.topLeft,
            glyphs,
            handles
        }
    }

    dragCellHandle(handle, position, options) {
        this.props.path[handle.pointIndex].translateTo(position);
        this._clearCache();
    }

    translate(rowOffset, colOffset) {
        this.props.path.forEach(cell => cell.translate(rowOffset, colOffset))
        this._clearCache();
    }


}