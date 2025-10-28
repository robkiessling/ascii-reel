import {
    BRUSH_PROP, BRUSH_TYPES, BRUSHES,
    CHAR_PROP,
    COLOR_PROP,
    SHAPE_TYPES,
    STROKE_STYLE_OPTIONS,
    STROKE_STYLE_PROPS
} from "./constants.js";
import Shape from "./shape.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import {BodyHandle, HandleCollection} from "./handle.js";
import Point from "../point.js";
import BoxShape from "./box_shape.js";
import CellCache from "../cell_cache.js";
import {pixelPerfectFreeformPath, standardFreeformPath} from "./algorithms/traverse_freeform.js";
import {registerShape} from "./registry.js";


export default class Freeform extends Shape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: 'path' },
        { prop: STROKE_STYLE_PROPS[SHAPE_TYPES.FREEFORM] },
        { prop: BRUSH_PROP },
    ];

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

        return false;
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
        const { pointMapper } = translateAreaWithBoxResizing(oldArea, oldBox, newBox);

        this.props.path = snapshot.path.map(point => pointMapper(point));
        this._clearCache();
    }

    _cacheGeometry() {
        let boundingArea = CellArea.fromPoints(this.props.path);
        let origin = boundingArea.topLeft;
        let glyphs = this._initGlyphs(boundingArea, true);
        const hitbox = new CellCache();
        const brush = BRUSHES[this.props[BRUSH_PROP]];

        if (brush.type === BRUSH_TYPES.PIXEL_PERFECT) {
            const generateAsciiChar = this._strokeStyle === STROKE_STYLE_OPTIONS[SHAPE_TYPES.FREEFORM].IRREGULAR_ADAPTIVE;
            pixelPerfectFreeformPath(this.props.path, (cell, char) => {
                const relativeCell = cell.relativeTo(origin);
                this._setGlyph(glyphs, relativeCell, generateAsciiChar ? char : this.props[CHAR_PROP], this.props[COLOR_PROP]);
                hitbox.add(cell); // use absolute position for hitbox
            })
        } else {
            standardFreeformPath(this.props.path, brush.type, brush.size, cell => {
                const relativeCell = cell.relativeTo(origin);
                this._setGlyph(glyphs, relativeCell, this.props[CHAR_PROP], this.props[COLOR_PROP]);
                hitbox.add(cell); // use absolute position for hitbox
            })
        }

        // Bounding area / origin may have changed if line thickness pushed a boundary
        ({ boundingArea, origin, glyphs } = this._processAnchoredGrid(glyphs, boundingArea.topLeft))

        this._cache = {
            boundingArea,
            origin,
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
        return true;
    }

    get topLeft() {
        if (this.props.path.length === 0) throw new Error("Cannot compute topLeft of empty path");

        let top = Infinity, left = Infinity;

        for (const point of this.props.path) {
            const cell = point.cell;
            if (cell.row < top) top = cell.row;
            if (cell.col < left) left = cell.col;
        }

        return new Cell(top, left);
    }


}


registerShape(SHAPE_TYPES.FREEFORM, Freeform);