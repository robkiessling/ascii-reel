import {
    EDGE_SIDES,
    HANDLE_CORNER_RADIUS,
    HANDLE_CORNER_SIZE,
    HANDLE_TYPES,
    SHAPE_BOX_PADDING,
    VERTEX_CORNERS
} from "./constants.js";

class Handle {
    /**
     * @type {Shape} The shape this handle belongs to
     */
    shape;

    /**
     * @type {String} The type of handle (vertex, edge, etc.)
     */
    type;

    get shapeId() {
        return this.shape ? this.shape.id : null;
    }
}

export class HandleCollection {
    constructor(handles) {
        this.handles = handles;
        this.handlesByType = {};

        handles.forEach(handle => {
            this.handles.push(handle);
            this.handlesByType[handle.type] ||= [];
            this.handlesByType[handle.type].push(handle);
        });

        this.showBoundingBox = handles.some(handle => handle.type === HANDLE_TYPES.VERTEX || handle.type === HANDLE_TYPES.EDGE);
    }

    [Symbol.iterator]() {
        return this.handles[Symbol.iterator]();
    }

    /**
     * Find the first handle matching the given handleType and criteria
     * @param {string|string[]} handleTypes - Single handleType or array of handleTypes to check
     * @param criteria - Matching criteria to send to the individual handle's `matches` function
     * @returns {Handle|null}
     */
    matches(handleTypes, criteria) {
        if (!Array.isArray(handleTypes)) handleTypes = [handleTypes];

        for (const handleType of handleTypes) {
            const handles = this.handlesByType[handleType] || [];
            for (const handle of handles) {
                if (handle.matches(criteria)) return handle;
            }
        }

        return null;
    }
}

export class VertexHandle extends Handle {
    constructor(shape, corner, vertex) {
        super();
        this.type = HANDLE_TYPES.VERTEX
        this.shape = shape;
        this.corner = corner;
        this.vertex = vertex;
    }

    get cursor() {
        switch (this.corner) {
            case VERTEX_CORNERS.TOP_LEFT_CORNER:
                return 'nwse-resize';
            case VERTEX_CORNERS.TOP_RIGHT_CORNER:
                return 'nesw-resize';
            case VERTEX_CORNERS.BOTTOM_LEFT_CORNER:
                return 'nesw-resize';
            case VERTEX_CORNERS.BOTTOM_RIGHT_CORNER:
                return 'nwse-resize';
            default:
                throw new Error(`Invalid corner: ${this.corner}`);
        }
    }

    geometry(canvas) {
        let { x, y } = canvas.worldToScreen(this.vertex.x, this.vertex.y)

        switch (this.corner) {
            case VERTEX_CORNERS.TOP_LEFT_CORNER:
                x -= SHAPE_BOX_PADDING
                y -= SHAPE_BOX_PADDING;
                break;
            case VERTEX_CORNERS.TOP_RIGHT_CORNER:
                x += SHAPE_BOX_PADDING;
                y -= SHAPE_BOX_PADDING;
                break;
            case VERTEX_CORNERS.BOTTOM_LEFT_CORNER:
                x -= SHAPE_BOX_PADDING;
                y += SHAPE_BOX_PADDING;
                break;
            case VERTEX_CORNERS.BOTTOM_RIGHT_CORNER:
                x += SHAPE_BOX_PADDING;
                y += SHAPE_BOX_PADDING;
                break;
            default:
                throw new Error(`Invalid corner: ${this.corner}`);
        }

        return {
            x, y, size: HANDLE_CORNER_SIZE, radius: HANDLE_CORNER_RADIUS,
        }
    }

    matches({mouseEvent, canvas}) {
        const { x, y, size } = this.geometry(canvas);

        return (Math.abs(mouseEvent.offsetX - x) <= size / 2) &&
            (Math.abs(mouseEvent.offsetY - y) <= size / 2)
    }
}

const EDGE_WIDTH = 8;

export class EdgeHandle extends Handle {
    constructor(shape, side, vertex1, vertex2) {
        super();
        this.type = HANDLE_TYPES.EDGE
        this.shape = shape;
        this.side = side;
        this.vertex1 = vertex1;
        this.vertex2 = vertex2;
    }

    get cursor() {
        switch (this.side) {
            case EDGE_SIDES.TOP_EDGE:
                return 'ns-resize';
            case EDGE_SIDES.LEFT_EDGE:
                return 'ew-resize';
            case EDGE_SIDES.RIGHT_EDGE:
                return 'ew-resize';
            case EDGE_SIDES.BOTTOM_EDGE:
                return 'ns-resize';
            default:
                throw new Error(`Invalid side: ${this.side}`);
        }
    }

    geometry(canvas) {
        let { x: x1, y: y1 } = canvas.worldToScreen(this.vertex1.x, this.vertex1.y)
        let { x: x2, y: y2 } = canvas.worldToScreen(this.vertex2.x, this.vertex2.y)

        switch (this.side) {
            case EDGE_SIDES.TOP_EDGE:
                x1 -= SHAPE_BOX_PADDING;
                x2 += SHAPE_BOX_PADDING;
                y1 = y1 - EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                y2 = y2 + EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                break;
            case EDGE_SIDES.LEFT_EDGE:
                x1 = x1 - EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                x2 = x2 + EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                y1 -= SHAPE_BOX_PADDING;
                y2 += SHAPE_BOX_PADDING;
                break;
            case EDGE_SIDES.RIGHT_EDGE:
                x1 = x1 - EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                x2 = x2 + EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                y1 -= SHAPE_BOX_PADDING;
                y2 += SHAPE_BOX_PADDING;
                break;
            case EDGE_SIDES.BOTTOM_EDGE:
                x1 -= SHAPE_BOX_PADDING;
                x2 += SHAPE_BOX_PADDING;
                y1 = y1 - EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                y2 = y2 + EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                break;
            default:
                throw new Error(`Invalid side: ${this.side}`);
        }

        return { x1, y1, x2, y2 }
    }

    matches({mouseEvent, canvas}) {
        const { x1, y1, x2, y2 } = this.geometry(canvas);
        return mouseEvent.offsetX >= x1 && mouseEvent.offsetX <= x2 &&
            mouseEvent.offsetY >= y1 && mouseEvent.offsetY <= y2
    }
}

export class BodyHandle extends Handle {
    constructor(shape, hitbox, canMove = true) {
        super();
        this.type = HANDLE_TYPES.BODY
        this.shape = shape;
        this.hitbox = hitbox;
        this.canMove = canMove; // true if body handle can be used to move the shape; false if body handle is just for selection
    }

    get cursor() {
        return this.canMove ? 'move' : 'default'
    }

    matches({ cell }) {
        return this.hitbox(cell);
    }
}


export class AttachmentHandle extends Handle {
    constructor(shape, hitbox, direction) {
        super();
        this.type = HANDLE_TYPES.ATTACHMENT
        this.shape = shape;
        this.hitbox = hitbox;
        this.direction = direction;
    }

    get cursor() {
        return 'copy'
    }

    matches({ cell }) {
        return this.hitbox(cell);
    }
}

export class CaretHandle extends Handle {
    constructor(shape, hitbox) {
        super();
        this.type = HANDLE_TYPES.CARET
        this.shape = shape;
        this.hitbox = hitbox;
    }

    get cursor() {
        return 'text'
    }

    matches({ cell }) {
        return this.hitbox(cell);
    }

    /**
     * The selection granularity for this caret.
     * @type {CaretSelectionMode}
     */
    selectionMode;

    /**
     * The text selection range at the moment of the initial single/double/triple click.
     *
     * Stored as a tuple of [startIndex, endIndex], where:
     * - startIndex is always ≤ endIndex (normalized order)
     * - If startIndex === endIndex, the selection is collapsed (caret only)
     *
     * Used later to compare against the current selection during drag/expansion.
     *
     * @type {[number, number]}
     */
    initialSelection;
}

export class CellHandle extends Handle {
    constructor(shape, cell, pointIndex, canAttachTo) {
        super();
        this.type = HANDLE_TYPES.CELL
        this.shape = shape;
        this.cell = cell;
        this.pointIndex = pointIndex;
        this.canAttachTo = canAttachTo;
    }

    get cursor() {
        return 'pointer'
    }

    matches({ cell }) {
        return this.cell.equals(cell)
    }

    geometry(canvas) {
        let { x: x1, y: y1 } = canvas.worldToScreen(this.vertex1.x, this.vertex1.y)
        let { x: x2, y: y2 } = canvas.worldToScreen(this.vertex2.x, this.vertex2.y)

        switch (this.side) {
            case EDGE_SIDES.TOP_EDGE:
                x1 -= SHAPE_BOX_PADDING;
                x2 += SHAPE_BOX_PADDING;
                y1 = y1 - EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                y2 = y2 + EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                break;
            case EDGE_SIDES.LEFT_EDGE:
                x1 = x1 - EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                x2 = x2 + EDGE_WIDTH / 2 - SHAPE_BOX_PADDING;
                y1 -= SHAPE_BOX_PADDING;
                y2 += SHAPE_BOX_PADDING;
                break;
            case EDGE_SIDES.RIGHT_EDGE:
                x1 = x1 - EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                x2 = x2 + EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                y1 -= SHAPE_BOX_PADDING;
                y2 += SHAPE_BOX_PADDING;
                break;
            case EDGE_SIDES.BOTTOM_EDGE:
                x1 -= SHAPE_BOX_PADDING;
                x2 += SHAPE_BOX_PADDING;
                y1 = y1 - EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                y2 = y2 + EDGE_WIDTH / 2 + SHAPE_BOX_PADDING;
                break;
            default:
                throw new Error(`Invalid side: ${this.side}`);
        }

        return { x1, y1, x2, y2 }

    }


}