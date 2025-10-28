import {
    ARROWHEAD_CHARS,
    ARROWHEAD_END_PROP,
    ARROWHEAD_START_PROP,
    CHAR_PROP,
    COLOR_PROP, DIRECTIONS,
    HANDLE_TYPES,
    SHAPE_TYPES,
    STROKE_STYLE_OPTIONS,
    STROKE_STYLE_PROPS,
} from "./constants.js";
import Shape from "./shape.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {
    getAttachmentEdgePct,
    getAttachmentEdgeCell,
    translateAreaWithBoxResizing
} from "./algorithms/box_sizing.js";
import CellCache from "../cell_cache.js";
import {BodyHandle, CellHandle, HandleCollection} from "./handle.js";
import BoxShape from "./box_shape.js";
import {straightAsciiLine} from "./algorithms/traverse_straight.js";
import {registerShape} from "./registry.js";
import {orthogonalPath} from "./algorithms/traverse_orthogonal.js";
import {directionFrom} from "./algorithms/traverse_utils.js";

const START_ATTACHMENT = 'startAttachment';
const END_ATTACHMENT = 'endAttachment';
const STROKES_REQUIRING_2_POINTS = new Set([
    STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_ADAPTIVE,
    STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_MONOCHAR,
])

export default class Line extends Shape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: 'path' },
        { prop: START_ATTACHMENT, default: null },
        { prop: END_ATTACHMENT, default: null },
        { prop: ARROWHEAD_START_PROP },
        { prop: ARROWHEAD_END_PROP },
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

    updateProp(propKey, newValue) {
        switch(propKey) {
            case STROKE_STYLE_PROPS[SHAPE_TYPES.LINE]:
                // When changing stroke style, if changing to an elbow stroke we require path to only have two points
                const pathUpdate = STROKES_REQUIRING_2_POINTS.has(newValue) && this.props.path ?
                    super.updateProp('path', [this.props.path.at(0), this.props.path.at(-1)]) : false;
                const strokeUpdate = super.updateProp(propKey, newValue);
                return pathUpdate || strokeUpdate;
            default:
                return super.updateProp(propKey, newValue);
        }
    }

    handleDrawMousedown(cell, options) {
        if (!this._initialDraw) {
            this._initialDraw = {
                anchor: cell.clone(), // Original mousedown cell (unchanging)
                hover: cell.clone(), // Represents current cell being hovered over (will rapidly update)
                path: [cell.clone()], // If multiple mousedowns occur, stores the path they create
                multiPointDrawing: false // Whether this drawing uses multiple points (true) or just 2 (false)
            }

            this._setAttachment(START_ATTACHMENT, options.attachTarget, cell);
        }

        // In rare cases, drawing may finish upon mousedown (e.g. if drawing an elbow line and 2nd point is drawn)
        let drawingFinished = false;

        // Add further mousedown cells to path (if they are different than previous path cell)
        if (this._initialDraw.multiPointDrawing && !cell.equals(this._initialDraw.path.at(-1))) {
            this._initialDraw.path.push(cell.clone());

            this._setAttachment(END_ATTACHMENT, options.attachTarget, cell);

            if (STROKES_REQUIRING_2_POINTS.has(this.props[STROKE_STYLE_PROPS[SHAPE_TYPES.LINE]])) {
                drawingFinished = true;
            }
        }

        this._convertInitialDrawToProps();

        return drawingFinished;
    }

    handleDrawMousemove(cell, options) {
        this._setAttachment(END_ATTACHMENT, options.attachTarget, cell);

        super.handleDrawMousemove(cell, options);
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
            this._setAttachment(END_ATTACHMENT, options.attachTarget, cell);
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

    _convertInitialDrawToProps() {
        // During draw, include the latest hover cell as the final step in the path
        this.props.path = [...this._initialDraw.path, this._initialDraw.hover];

        this._clearCache();
    }

    shouldFinishDrawOnKeypress() {
        return true;
    }

    shouldDeleteOnDrawFinished() {
        return this.props.path.length < 2;
    }

    resize(oldBox, newBox) {
        const snapshot = this.resizeSnapshot;

        const oldArea = CellArea.fromCells(snapshot.path);
        const { cellMapper } = translateAreaWithBoxResizing(oldArea, oldBox, newBox);

        this.props.path = snapshot.path.map((cell, i) => {
            // If this point is attached to a shape, resync it and return its updated value
            if (this.props[this._attachmentKeyForPathIndex(i)]) {
                this._resyncAttachment(i);
                return this.props.path.at(i);
            }

            // Otherwise use the cellMapper provided by the bounding box transformation
            return cellMapper(cell);
        });

        this._clearCache();
    }

    _cacheGeometry() {
        let boundingArea = CellArea.fromCells(this.props.path);
        let origin = boundingArea.topLeft;
        let glyphs = this._initGlyphs(boundingArea, true);
        const hitbox = new CellCache();

        this._drawLines(boundingArea, glyphs, hitbox);

        // Bounding area / origin may have changed if orthogonal path pushed a boundary
        ({ boundingArea, origin, glyphs } = this._processAnchoredGrid(glyphs, origin))

        const handles = new HandleCollection([
            ...this.props.path.map((cell, i) => new CellHandle(this, cell, i, i === 0 || i === this.props.path.length - 1)),

            // Only including box handles if line has more than 2 points
            ...(this.props.path.length > 2 ? BoxShape.vertexHandles(this, boundingArea) : []),
            ...(this.props.path.length > 2 ? BoxShape.edgeHandles(this, boundingArea) : []),

            new BodyHandle(this, cell => hitbox.has(cell), !this.props.startAttachment && !this.props.endAttachment)
        ])

        this._cache = {
            boundingArea,
            origin,
            glyphs,
            handles
        }
    }

    _drawLines(boundingArea, glyphs, hitbox) {
        const setGlyph = (absCell, char) => {
            const relativeCell = absCell.relativeTo(boundingArea.topLeft);
            this._setGlyph(glyphs, relativeCell, char, this.props[COLOR_PROP]);
            hitbox.add(absCell);
        }

        switch(this._strokeStyle) {
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].STRAIGHT_MONOCHAR:
                this._drawStraightLines(false, setGlyph);
                break;
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].STRAIGHT_ADAPTIVE:
                this._drawStraightLines(true, setGlyph);
                break;
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_MONOCHAR:
                this._drawOrthogonalLines(false, setGlyph)
                break;
            case STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_ADAPTIVE:
                this._drawOrthogonalLines(true, setGlyph)
                break;
            default:
                throw new Error(`Invalid stroke: ${this._strokeStyle}`)
        }
    }

    _drawStraightLines(isAdaptive, setGlyph) {
        for (let i = 1; i < this.props.path.length; i++) {
            const aIndex = i - 1;
            const bIndex = i;
            const a = this.props.path[aIndex];
            const b = this.props.path[bIndex];

            if (isAdaptive) {
                straightAsciiLine(a, b, (cell, char) => setGlyph(cell, char))
            } else {
                a.lineTo(b).forEach(cell => setGlyph(cell, this.props[CHAR_PROP]))
            }

            // TODO adaptive could use calculated chars instead of just '+'
            let aChar = isAdaptive ? '+' : undefined;
            if (i === 1) {
                const aAttachment = this.props[this._attachmentKeyForPathIndex(aIndex)];
                const aDir = aAttachment ? aAttachment.direction : directionFrom(a, b);
                aChar = ARROWHEAD_CHARS[this.props[ARROWHEAD_START_PROP]][aDir]
            }
            if (aChar !== undefined) setGlyph(a, aChar);

            let bChar = isAdaptive ? '+' : undefined;
            if (i === this.props.path.length - 1) {
                const bAttachment = this.props[this._attachmentKeyForPathIndex(bIndex)];
                const bDir = bAttachment ? bAttachment.direction : directionFrom(b, a);
                bChar = ARROWHEAD_CHARS[this.props[ARROWHEAD_END_PROP]][bDir]
            }
            if (bChar !== undefined) setGlyph(b, bChar);
        }
    }

    _drawOrthogonalLines(isAdaptive, setGlyph) {
        orthogonalPath(
            this.props.path.at(0),
            this.props.path.at(-1),
            this.props.startAttachment ? this._resolveAttachmentShape(this.props.startAttachment.shapeId).bufferArea : undefined,
            this.props.endAttachment ? this._resolveAttachmentShape(this.props.endAttachment.shapeId).bufferArea : undefined,
            this.props.startAttachment ? this.props.startAttachment.direction : undefined,
            this.props.endAttachment ? this.props.endAttachment.direction : undefined,
            (cell, direction, type) => setGlyph(cell, this._orthogonalChar(direction, type))
        )
    }

    _orthogonalChar(direction, type) {
        if (type === 'start') {
            const startChar = ARROWHEAD_CHARS[this.props[ARROWHEAD_START_PROP]][direction];
            if (startChar) return startChar;
        }
        if (type === 'end') {
            const endChar = ARROWHEAD_CHARS[this.props[ARROWHEAD_END_PROP]][direction];
            if (endChar) return endChar;
        }

        if (this._strokeStyle === STROKE_STYLE_OPTIONS[SHAPE_TYPES.LINE].ELBOW_MONOCHAR) return this.props[CHAR_PROP];

        switch (direction) {
            case DIRECTIONS.UP:
            case DIRECTIONS.DOWN:
                return '|';
            case DIRECTIONS.RIGHT:
            case DIRECTIONS.LEFT:
                return '-';
            case DIRECTIONS.UP_RIGHT:
            case DIRECTIONS.UP_LEFT:
            case DIRECTIONS.RIGHT_UP:
            case DIRECTIONS.RIGHT_DOWN:
            case DIRECTIONS.DOWN_RIGHT:
            case DIRECTIONS.DOWN_LEFT:
            case DIRECTIONS.LEFT_UP:
            case DIRECTIONS.LEFT_DOWN:
                return '+';
            default:
                // return '?'; // for debugging

                // In some cases, the line gets really wrapped up when the two endpoints are near each other;
                // we just hide these extra wrapped points
                return '';
        }
    }

    resyncAttachmentsTo(shape) {
        let updated = false;

        if (this.props.startAttachment && this.props.startAttachment.shapeId === shape.id) {
            this._resyncAttachment(START_ATTACHMENT);
            this._clearCache()
            updated = true;
        }

        if (this.props.endAttachment && this.props.endAttachment.shapeId === shape.id) {
            this._resyncAttachment(END_ATTACHMENT);
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

    remapAttachments(idMap) {
        [START_ATTACHMENT, END_ATTACHMENT].forEach(attachmentKey => {
            if (!this.props[attachmentKey]) return;

            const currentId = this.props[attachmentKey].shapeId;
            if (idMap.has(currentId)) {
                this.props[attachmentKey].shapeId = idMap.get(currentId);
            } else {
                this.props[attachmentKey] = null;
            }
            this._resyncAttachment(attachmentKey);

            this._clearCache();
        });
    }

    dragCellHandle(handle, position, attachTarget) {
        this.props.path[handle.pointIndex].translateTo(position);

        if (handle.canAttachTo) {
            this._setAttachment(this._attachmentKeyForPathIndex(handle.pointIndex), attachTarget, position);
        }

        this._clearCache();
    }

    _setAttachment(propKey, attachTarget, cell) {
        let attachmentData = null;

        if (attachTarget) {
            attachmentData = {
                shapeId: attachTarget.shapeId,
                pct: getAttachmentEdgePct(attachTarget.attachmentArea, cell),
                direction: attachTarget.direction
            }
        }

        this.props[propKey] = attachmentData
    }

    /**
     * Refreshes the location of an attached point (if it exists).
     * @param {number|'startAttachment'|'endAttachment'} attachmentKeyOrPathIndex - Attachment point identifier.
     *   - If a number, will be interpreted as the path index. Supports `-1` to represent final path index.
     *   - If an attachmentKey (e.g. 'startAttachment'), will use that attachment point
     */
    _resyncAttachment(attachmentKeyOrPathIndex) {
        let attachmentKey;
        let pathIndex;

        if (typeof attachmentKeyOrPathIndex === 'number') {
            attachmentKey = this._attachmentKeyForPathIndex(attachmentKeyOrPathIndex);
            pathIndex = attachmentKeyOrPathIndex;
        } else if (typeof attachmentKeyOrPathIndex === 'string') {
            attachmentKey = attachmentKeyOrPathIndex;
            pathIndex = this._pathIndexForAttachmentKey(attachmentKeyOrPathIndex);
        } else {
            return;
        }

        const attachment = this.props[attachmentKey];
        if (!attachment) return;

        const attachedToShape = this._resolveAttachmentShape(attachment.shapeId);
        const attachmentHandle = /** @type {AttachmentHandle} */ attachedToShape.handles.find(
            HANDLE_TYPES.ATTACHMENT, 
            { direction: attachment.direction }
        );
        const attachmentCell = getAttachmentEdgeCell(attachmentHandle.attachmentArea, attachment.pct);
        this.props.path.at(pathIndex).translateTo(attachmentCell);
    }

    _attachmentKeyForPathIndex(pathIndex) {
        if (pathIndex === 0) return START_ATTACHMENT;
        if (pathIndex === -1 || pathIndex === this.props.path.length - 1) return END_ATTACHMENT;
        return null;
    }

    _pathIndexForAttachmentKey(attachmentKey) {
        switch(attachmentKey) {
            case START_ATTACHMENT:
                return 0;
            case END_ATTACHMENT:
                return -1;
            default:
                throw new Error(`Invalid attachmentKey: ${attachmentKey}`)
        }
    }

    translate(rowOffset, colOffset) {
        let moved = false;

        this.props.path.forEach((cell, i) => {
            if (this.props[this._attachmentKeyForPathIndex(i)]) return; // cannot move attached point

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