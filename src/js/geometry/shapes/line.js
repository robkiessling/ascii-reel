import {CHAR_PROP, COLOR_PROP, SHAPE_TYPES, STROKE_OPTIONS, STROKE_PROPS} from "./constants.js";
import Shape from "./shape.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import CellCache from "./cell_cache.js";
import {BodyHandle, CellHandle, HandleCollection} from "./handle.js";
import {elbowPath} from "./algorithms/line_elbow.js";


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

    handleInitialDraw(cell, modifiers) {
        super.handleInitialDraw(cell, modifiers);
        this.props.path = [this._initialDraw.start, this._initialDraw.end];
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
                this.props.path.at(0).lineTo(this.props.path.at(-1)).forEach(cell => {
                    const relativeCell = cell.relativeTo(boundingArea.topLeft);
                    this._setGlyph(glyphs, relativeCell, this.props[CHAR_PROP], this.props[COLOR_PROP]);
                    hitbox.addCell(cell); // use absolute position for hitbox
                });
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