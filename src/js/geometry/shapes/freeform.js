import {CHAR_PROP, COLOR_PROP, SHAPE_TYPES, STROKE_OPTIONS, STROKE_PROPS} from "./constants.js";
import Shape from "./shape.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import {BodyHandle, CellHandle, HandleCollection} from "./handle.js";
import Point from "../point.js";
import BoxShape from "./box_shape.js";
import CellCache from "../cell_cache.js";
import {freeformAsciiPath} from "./algorithms/traverse_freeform.js";


export default class Freeform extends Shape {

    static beginFreeform(startCell, options) {
        const props = {
            // path: [startCell, startCell.clone()],
            [STROKE_PROPS[SHAPE_TYPES.FREEFORM]]: options.drawPreset,
            [CHAR_PROP]: options.char,
            [COLOR_PROP]: options.colorIndex,
        }

        return new Freeform(undefined, SHAPE_TYPES.FREEFORM, props);
    }

    serializeProps() {
        const { path, ...restProps } = this.props;
        const result = structuredClone(restProps);
        result.path = path.map(point => point.serialize());
        return result;
    }

    static deserializeProps(props) {
        const { path, ...restProps } = props;
        const result = structuredClone(restProps);
        result.path = path.map(point => Point.deserialize(point));
        return result;
    }

    handleDrawMousedown(cell, options) {
        this._initialDraw = {
            anchor: cell.clone(), // Original mousedown cell (unchanging)
            path: [options.point]
        }

        this._convertInitialDrawToProps();
    }

    /**
     * Called during initial shape drawing as mouse is moved across canvas.
     * @param {Cell} cell - mouse hover location
     * @param {Object} options - additional options
     * @param {{x: number, y: number}} options.point - Coordinates of the hovered pixel
     */
    handleDrawMousemove(cell, options) {
        const newPoint = options.point;
        const prevPoint = this._initialDraw.path.at(-1);
        const distance = Math.sqrt(
            Math.pow(newPoint.x - prevPoint.x, 2) +
            Math.pow(newPoint.y - prevPoint.y, 2)
        );

        if (distance > 3) {
            this._initialDraw.path.push(newPoint);
            this._convertInitialDrawToProps();
        }
    }

    _convertInitialDrawToProps() {
        this.props.path = this._initialDraw.path;
        this._clearCache();
    }

    resize(oldBox, newBox) {
        const snapshot = this.resizeSnapshot;

        const oldArea = CellArea.fromPoints(snapshot.path);
        const { area: newArea, pointMapper } = translateAreaWithBoxResizing(oldArea, oldBox, newBox);

        this.props.path = snapshot.path.map(point => pointMapper(point));
        this._clearCache();
    }

    _cacheGeometry() {
        const boundingArea = CellArea.fromPoints(this.props.path);
        const glyphs = this._initGlyphs(boundingArea);
        const hitbox = new CellCache();
        const stroke = this.props[STROKE_PROPS[SHAPE_TYPES.FREEFORM]]

        switch(stroke) {
            case STROKE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_ADAPTIVE:
                freeformAsciiPath(this.props.path, (cell, char) => {
                    const relativeCell = cell.relativeTo(boundingArea.topLeft);
                    this._setGlyph(glyphs, relativeCell, char, this.props[COLOR_PROP]);
                    hitbox.add(cell); // use absolute position for hitbox
                })
                break;
            case STROKE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_MONOCHAR:
                // TODO Do not prune for monochar?
                freeformAsciiPath(this.props.path, (cell, char) => {
                    const relativeCell = cell.relativeTo(boundingArea.topLeft);
                    this._setGlyph(glyphs, relativeCell, this.props[CHAR_PROP], this.props[COLOR_PROP]);
                    hitbox.add(cell); // use absolute position for hitbox
                })
                break;
            default:
                throw new Error(`Invalid stroke: ${stroke}`)
        }

        this._cache = {
            boundingArea,
            origin: boundingArea.topLeft,
            glyphs,
            handles: new HandleCollection([
                ...BoxShape.vertexHandles(this, boundingArea),
                ...BoxShape.edgeHandles(this, boundingArea),
                new BodyHandle(this, cell => hitbox.has(cell))
            ])
        }
    }

    translate(rowOffset, colOffset) {
        const xOffset = colOffset * Cell.width;
        const yOffset = rowOffset * Cell.height;
        this.props.path.forEach(point => point.translate(xOffset, yOffset))
        this._clearCache();
    }


}