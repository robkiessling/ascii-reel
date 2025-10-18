import {CHAR_PROP, COLOR_PROP, SHAPE_TYPES, STROKE_STYLE_OPTIONS, STROKE_STYLE_PROPS,} from "./constants.js";
import Shape from "./shape.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {getFractionalPosition, translateAreaWithBoxResizing} from "./algorithms/box_sizing.js";
import CellCache from "../cell_cache.js";
import {BodyHandle, CellHandle, HandleCollection} from "./handle.js";
import {forEachAdjPair} from "../../utils/arrays.js";
import BoxShape from "./box_shape.js";
import {straightAsciiLine} from "./algorithms/traverse_straight.js";
import {registerShape} from "./registry.js";
import {orthogonalConnector} from "./algorithms/orthogonal_connections.js";


export default class Line extends Shape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: 'path' },
        { prop: 'startAttachment', default: null },
        { prop: 'endAttachment', default: null },
        { prop: STROKE_STYLE_PROPS[SHAPE_TYPES.LINE] },
    ];

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


    handleDrawMousedown(cell, options) {
        if (!this._initialDraw) {
            this._initialDraw = {
                anchor: cell.clone(), // Original mousedown cell (unchanging)
                hover: cell.clone(), // Represents current cell being hovered over (will rapidly update)
                path: [cell.clone()], // If multiple mousedowns occur, stores the path they create
                multiPointDrawing: false // Whether this drawing uses multiple points (true) or just 2 (false)
            }

            this._setAttachment('startAttachment', options.attachTarget, cell);
        }

        // Add further mousedown cells to path (if they are different than previous path cell)
        if (this._initialDraw.multiPointDrawing && !cell.equals(this._initialDraw.path.at(-1))) {
            this._initialDraw.path.push(cell.clone());

            this._setAttachment('endAttachment', options.attachTarget, cell);
        }

        this._convertInitialDrawToProps();
    }

    handleDrawMouseup(cell, options) {
        // If already in a multi-point drawing, return false (shape is not finished)
        if (this._initialDraw.multiPointDrawing) return false;

        // If not yet in a multi-point drawing, determine if a multi-point drawing should be started.
        // If mouseup occurs on the starting point of the line, user wants to start a multi-point drawing
        if (cell.equals(this._initialDraw.anchor)) {
            this._initialDraw.multiPointDrawing = true;
            return false; // shape is not finished
        } else {
            this._setAttachment('endAttachment', options.attachTarget, cell);
            return true; // shape is finished
        }
    }

    finishDraw() {
        if (this._initialDraw.multiPointDrawing) {
            // When finished, set props according to final path (does not include latest hover cell)
            this.props.path = this._initialDraw.path;
            this._clearCache();
        }
        super.finishDraw();
    }

    get canAttachTo() {
        return true;
    }

    _convertInitialDrawToProps() {
        // During draw, include the latest hover cell as the final step in the path
        this.props.path = [...this._initialDraw.path, this._initialDraw.hover];

        this._clearCache();
    }

    resize(oldBox, newBox) {
        const snapshot = this.resizeSnapshot;

        const oldArea = CellArea.fromCells(snapshot.path);
        const { cellMapper } = translateAreaWithBoxResizing(oldArea, oldBox, newBox);

        this.props.path = snapshot.path.map(cell => cellMapper({cell}));
        this._clearCache();

        return { cellMapper }
    }

    _cacheGeometry() {
        const boundingArea = CellArea.fromCells(this.props.path);
        const glyphs = this._initGlyphs(boundingArea);
        const hitbox = new CellCache();

        const setGlyph = (absCell, char) => {
            const relativeCell = absCell.relativeTo(boundingArea.topLeft);
            this._setGlyph(glyphs, relativeCell, char, this.props[COLOR_PROP]);
            hitbox.add(absCell);
        }

        switch(this._strokeStyle) {
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].STRAIGHT_MONOCHAR:
                forEachAdjPair(this.props.path, (a, b) => {
                    a.lineTo(b).forEach(cell => setGlyph(cell, this.props[CHAR_PROP]))
                })
                break;
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].STRAIGHT_ADAPTIVE:
                const cornerChar = '+';
                setGlyph(this.props.path.at(0), cornerChar)
                forEachAdjPair(this.props.path, (a, b) => {
                    straightAsciiLine(a, b, (cell, char) => setGlyph(cell, char))
                    setGlyph(b, cornerChar)
                })
                break;
            // TODO IS this better? inclusive start/ends
            // case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].STRAIGHT_ADAPTIVE:
            //     forEachAdjPair(this.props.path, (a, b, i) => {
            //         straightAsciiLine(a, b, (cell, char) => setGlyph(cell, char), i === 0, true);
            //     })
            //     break;

            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_MONOCHAR:
                orthogonalConnector(this.props.path.at(0), this.props.path.at(-1), (cell, char) => setGlyph(cell, this.props[CHAR_PROP]))
                break;
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_ADAPTIVE:
                // TODO only using first and last points, maybe better to update path?
                orthogonalConnector(this.props.path.at(0), this.props.path.at(-1), (cell, char) => setGlyph(cell, char))
                break;
            default:
                throw new Error(`Invalid stroke: ${this._strokeStyle}`)
        }

        const handles = new HandleCollection([
            ...this.props.path.map((cell, i) => new CellHandle(this, cell, i, i === 0 || i === this.props.path.length - 1)),

            // Only including box handles if line has more than 2 points
            ...(this.props.path.length > 2 ? BoxShape.vertexHandles(this, boundingArea) : []),
            ...(this.props.path.length > 2 ? BoxShape.edgeHandles(this, boundingArea) : []),

            new BodyHandle(this, cell => hitbox.has(cell), !this.props.startAttachment && !this.props.endAttachment)
        ])

        this._cache = {
            boundingArea,
            origin: boundingArea.topLeft,
            glyphs,
            handles
        }
    }

    updateAttachmentsTo(shape, updater) {
        let updated = false;

        if (this.props.startAttachment && this.props.startAttachment.shapeId === shape.id) {
            updater(this.props.path.at(0), this.props.startAttachment)
            this._clearCache()
            updated = true;
        }

        if (this.props.endAttachment && this.props.endAttachment.shapeId === shape.id) {
            updater(this.props.path.at(-1), this.props.endAttachment)
            this._clearCache()
            updated = true;
        }

        return updated;
    }

    removeAttachmentsTo(shape) {
        if (this.props.startAttachment && this.props.startAttachment.shapeId === shape.id) {
            this.props.startAttachment = null;
            this._clearCache()
        }

        if (this.props.endAttachment && this.props.endAttachment.shapeId === shape.id) {
            this.props.endAttachment = null;
            this._clearCache()
        }
    }

    dragCellHandle(handle, position, attachTarget) {
        this.props.path[handle.pointIndex].translateTo(position);

        if (handle.canAttachTo) {
            this._setAttachment(handle.pointIndex === 0 ? 'startAttachment' : 'endAttachment', attachTarget, position);
        }

        this._clearCache();
    }

    _setAttachment(propKey, attachTarget, cell) {
        let attachmentData = null;

        if (attachTarget) {
            const { rowPct, colPct } = getFractionalPosition(attachTarget.shape.boundingArea, cell)
            attachmentData = {
                shapeId: attachTarget.shapeId,
                rowPct,
                colPct,
                direction: attachTarget.direction
            }
        }

        this.props[propKey] = attachmentData
    }

    translate(rowOffset, colOffset) {
        let moved = false;

        this.props.path.forEach((cell, i) => {
            if (i === 0 && this.props.startAttachment) return; // Cannot move attached point
            if (i === this.props.path.length - 1 && this.props.endAttachment) return; // Cannot move attached point
            cell.translate(rowOffset, colOffset);
            moved = true; // `moved` becomes true if at least one cell moved
        })

        if (moved) this._clearCache();
        return moved;
    }

    get topLeft() {
        if (this.props.path.length === 0) throw new Error("Cannot compute topLeft of empty path");

        let top = Infinity, left = Infinity;

        for (const cell of this.props.path) {
            if (cell.row < top) top = cell.row;
            if (cell.col < left) left = cell.col;
        }

        return new Cell(top, left);
    }


}

registerShape(SHAPE_TYPES.LINE, Line);