import $ from "jquery";
import * as selection from "./selection.js";
import {charCanvas, chars, numCols, numRows, refresh} from "./index.js";

const MONOSPACE_RATIO = 3/5;
const CELL_HEIGHT = 16;
const CELL_WIDTH = CELL_HEIGHT * MONOSPACE_RATIO;

// Since monospace ratio has denominator of 5, this should be a multiple a 5 if you want cells to align with checkers
const CHECKERS_PER_CELL_COL = 5;
const CHECKERS_PER_CELL_ROW = CHECKERS_PER_CELL_COL * MONOSPACE_RATIO;
const CHECKER_WIDTH = CELL_WIDTH / CHECKERS_PER_CELL_ROW;
const CHECKER_HEIGHT = CELL_HEIGHT / CHECKERS_PER_CELL_COL;

const GRID = true;
const GRID_WIDTH = 0.25;
const GRID_COLOR = '#fff';

const SELECTION_COLOR = '#0066cc88';
const TEXT_COLOR = '#fff';

const CHAR_BACKGROUND = false; // false => transparent (will rarely NOT be transparent; only when you need to see spaces)
const CANVAS_BACKGROUND = '#4c4c4c'; // false => transparent
const CHECKERBOARD_A = '#4c4c4c';
const CHECKERBOARD_B = '#555';

const ZOOM_BOUNDARIES = [0.5, 5];
const ZOOM_SPEED = 1;

export class CanvasControl {
    constructor($canvas, config = {}) {
        this.$canvas = $canvas;
        this.canvas = this.$canvas.get(0);
        this.context = this.canvas.getContext("2d");
        this.config = config;

        // Fix canvas PPI https://stackoverflow.com/a/65124939/4904996
        let ratio = window.devicePixelRatio;
        this.canvas.width = this.outerWidth * ratio;
        this.canvas.height = this.outerHeight * ratio;
        this.canvas.style.width = this.outerWidth + "px";
        this.canvas.style.height = this.outerHeight + "px";
        this.context.scale(ratio, ratio);

        // Set up font
        this.context.font = '1rem monospace';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        this.zoom = new ZoomHandler(this, config.zoom);
    }

    get outerWidth() {
        return this.$canvas.outerWidth();
    }
    get outerHeight() {
        return this.$canvas.outerHeight();
    }

    clear() {
        this.context.clearRect(...Rect.fullArea(this).xywh);
    }

    // TODO Move to subclass?
    refreshChars() {
        this.clear();

        if (CANVAS_BACKGROUND === false) {
            this.fillCheckerboard(Rect.drawableArea(this));
        }
        else {
            this.context.fillStyle = CANVAS_BACKGROUND;
            this.context.fillRect(...Rect.drawableArea(this).xywh);
        }

        if (CHAR_BACKGROUND) {
            this.context.beginPath();
            this.context.fillStyle = CHAR_BACKGROUND;
            this._iterate2dArray(chars, (value, cell) => {
                if (value !== '') {
                    this.context.rect(...cell.xywh);
                }
            });
            this.context.fill();
        }

        // Draw all chars using fillText
        this._iterate2dArray(chars, (value, cell) => {
            this.context.fillStyle = TEXT_COLOR;
            this.context.fillText(value, ...cell.translate(0.5, 0.5).xy); // Translate by 50%, so we can draw char in center of cell
        });

        if (GRID) {
            this.drawGrid();
        }
    }
    refreshSelection() {
        this.clear();

        // Draw all selection rectangles
        selection.getSelectedCells().forEach(cell => {
            this.context.fillStyle = SELECTION_COLOR;
            this.context.fillRect(...cell.xywh);
        });
    }

    _iterate2dArray(array, callback) {
        for (let row = 0; row < array.length; row++) {
            for (let col = 0; col < array[row].length; col++) {
                callback(array[row][col], new Cell(this, row, col));
            }
        }
    }

    drawGrid() {
        this.context.strokeStyle = GRID_COLOR;
        this.context.lineWidth = GRID_WIDTH;

        this._iterate2dArray(chars, (value, cell) => {
            // Drawing a box around the cell. Only draw left/top borders for first cells in the row/col
            this.context.beginPath();
            this.context.moveTo(...cell.xy);
            cell.col === 0 ? this.context.lineTo(...cell.translate(1, 0).xy) : this.context.moveTo(...cell.translate(1, 0).xy);
            this.context.lineTo(...cell.translate(0, 1).xy);
            this.context.lineTo(...cell.translate(-1, 0).xy);
            cell.row === 0 ? this.context.lineTo(...cell.translate(0, -1).xy) : this.context.moveTo(...cell.translate(0, -1).xy)
            this.context.stroke();
        });
    }

    fillCheckerboard(canvas, rect) {
        this.context.beginPath();
        this.context.fillStyle = CHECKERBOARD_A;
        this.context.rect(...Rect.drawableArea(this).xywh);
        this.context.fill();

        this.context.beginPath();
        this.context.fillStyle = CHECKERBOARD_B;
        let rowStartsOnB = false;
        // TODO Hack subtracting 0.001 to account for floating point round errors
        for (let x = rect.x; x < (rect.x + rect.width - 0.001); x += CHECKER_WIDTH) {
            let isCheckered = rowStartsOnB;
            for (let y = rect.y; y < (rect.y + rect.height - 0.001); y += CHECKER_HEIGHT) {
                if (isCheckered) {
                    this.context.rect(x, y, CHECKER_WIDTH, CHECKER_HEIGHT);
                }
                isCheckered = !isCheckered;
            }
            rowStartsOnB = !rowStartsOnB;
        }
        this.context.fill();
    }
}





/**
 * Translates a 2d array as if it was positioned at a Cell. The callback value will be null for parts of the array
 * that go out of the frame.
 *
 * @param layout        2d array
 * @param cell         Position to move the top-left Cell of the layout to
 * @param callback      function(value, row, col), where row and col are the coordinates if the layout was moved
 */
export function translate(layout, cell, callback) {
    layout.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            const row = rowIndex + cell.row;
            const col = colIndex + cell.col;
            const inBounds = row >= 0 && row < numRows() && col >= 0 && col < numCols();
            callback(inBounds ? value : null, row, col);
        });
    });
}



class ZoomHandler {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.config = config;

        if (this.config.enabled) {
            this._setupScrollListener();
        }

        this.zoom(1);
    }

    zoom(newValue) {
        if (newValue < ZOOM_BOUNDARIES[0]) { newValue = ZOOM_BOUNDARIES[0]; }
        if (newValue > ZOOM_BOUNDARIES[1]) { newValue = ZOOM_BOUNDARIES[1]; }
        // if (newValue === this._zoom) { return; }
        if (newValue !== undefined) { this._zoom = newValue; }

        // Set context scale: Have to factor in device PPI like we did when we built the canvas
        const contextScale = window.devicePixelRatio * this._zoom;
        this.canvas.context.setTransform(1, 0, 0, 1, 0, 0); // reset scale
        this.canvas.context.scale(contextScale, contextScale); // scaled to desired amount

        /**
         * origin is the absolute x/y coordinates of the top-left point of the drawable rectangle.
         * The XY and Cell classes will use this origin to calculate their relative x/y positions.
         */
        this.origin = new XY(
            this.canvas,
            this.scale(this.canvas.outerWidth) / 2 - (numCols() * CELL_WIDTH) / 2,
            this.scale(this.canvas.outerHeight) / 2 - (numRows() * CELL_HEIGHT) / 2
        );
    }

    scale(value) {
        return value / this._zoom;
    }

    _setupScrollListener() {
        this.canvas.$canvas.off('wheel.ZoomHandler').on('wheel.ZoomHandler', evt => {
            const wheel = evt.originalEvent.deltaY;
            if (wheel === 0) { return; }
            this.zoom(this._zoom - wheel * ZOOM_SPEED / 300);
            // TODO HACK
            charCanvas.zoom.zoom(this._zoom - wheel * ZOOM_SPEED / 300);

            refresh();
            evt.preventDefault();
        });
    }
}

/**
 * An XY is simply an x/y coordinate. These values are relative to the top-left of the ENTIRE canvas element.
 * If you want x/y values relative to the top-left of the drawable area, use relativeX and relativeY.
 *
 * The x/y values are all scaled according to the zoomHandler. If you are creating an XY from "un-zoomed" x/y
 * values (e.g. from the width of the entire canvas, from a mouse events, etc.) you must use XY.fromExternal(x, y).
 */
class XY {
    constructor(canvas, x, y) {
        this.canvas = canvas;
        this.x = x;
        this.y = y;
    }

    static fromExternal(canvas, x, y) {
        return new XY(canvas, canvas.zoom.scale(x), canvas.zoom.scale(y));
    }

    get relativeX() {
        return this.x - this.canvas.zoom.origin.x;
    }
    get relativeY() {
        return this.y - this.canvas.zoom.origin.y;
    }

    // Used to spread (...) into functions that take (x, y) parameters
    get xy() {
        return [this.x, this.y];
    }
}

/**
 * A Cell is a particular row/column pair of the drawable area. It is useful so we can deal with rows/columns instead
 * of raw x/y values. However, it is built on top of an XY, so if you need to get a Cell's absolute or relative x/y
 * positions, you can call the normal XY getters.
 */
export class Cell extends XY {
    constructor(canvas, row, col) {
        super();

        this.canvas = canvas;
        this.row = row;
        this.col = col;
    }

    static fromExternalXY(canvas, x, y) {
        const xy = XY.fromExternal(canvas, x, y);
        return new Cell(canvas, Math.floor(xy.relativeY / CELL_HEIGHT), Math.floor(xy.relativeX / CELL_WIDTH));
    }

    clone() {
        return new Cell(this.canvas, this.row, this.col);
    }

    translate(rowDelta, colDelta) {
        this.row += rowDelta;
        this.col += colDelta;
        return this;
    }

    bindToDrawableArea(newValue) {
        this._boundToDrawableArea = newValue;

        // If turning on binding, immediately set the row/col values so the binding takes effect
        if (newValue) {
            this.row = this.row;
            this.col = this.col;
        }

        return this;
    }

    // Used to spread (...) into functions that take (x, y, width, height) parameters
    get xywh() {
        return [this.x, this.y, CELL_WIDTH, CELL_HEIGHT];
    }

    get row() {
        return this._row;
    }
    set row(newValue) {
        this._row = newValue;
        if (this._boundToDrawableArea) {
            if (this._row < 0) { this._row = 0; }
            if (this._row > numRows() - 1) { this._row = numRows() - 1; }
        }
        this._updateXY();
    }
    get col() {
        return this._col;
    }
    set col(newValue) {
        this._col = newValue;
        if (this._boundToDrawableArea) {
            if (this._col < 0) { this._col = 0; }
            if (this._col > numCols() - 1) { this._col = numCols() - 1; }
        }
        this._updateXY();
    }

    // Ensure underlying XY remains consistent
    _updateXY() {
        this.x = this.col * CELL_WIDTH + this.canvas.zoom.origin.x;
        this.y = this.row * CELL_HEIGHT + this.canvas.zoom.origin.y;
    }
}

/**
 * A Rect is a rectangle drawn between a topLeft Cell and a bottomRight Cell.
 */
export class Rect {
    constructor(canvas, topLeft, bottomRight) {
        this.canvas = canvas;
        this.topLeft = topLeft; // Cell
        this.bottomRight = bottomRight; // Cell
    }

    // TODO Move these to canvas
    static drawableArea(canvas) {
        return new Rect(canvas, new Cell(canvas, 0, 0), new Cell(canvas, numRows() - 1, numCols() - 1));
    }

    static fullArea(canvas) {
        return new Rect(canvas, Cell.fromExternalXY(canvas, 0, 0), Cell.fromExternalXY(canvas, canvas.outerWidth, canvas.outerHeight));
    }

    get x() {
        return this.topLeft.x;
    }
    get y() {
        return this.topLeft.y;
    }
    get width() {
        return this.numCols * CELL_WIDTH;
    }
    get height() {
        return this.numRows * CELL_HEIGHT;
    }

    get xywh() {
        return [this.x, this.y, this.width, this.height];
    }

    get numRows() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }

    get numCols() {
        return this.bottomRight.col - this.topLeft.col + 1;
    }

    clone() {
        return new Rect(this.canvas, this.topLeft.clone(), this.bottomRight.clone());
    }

    iterate(callback) {
        for (let r = this.topLeft.row; r <= this.bottomRight.row; r++) {
            for (let c = this.topLeft.col; c <= this.bottomRight.col; c++) {
                callback(r, c);
            }
        }
    }

    mergeRect(otherRect) {
        if (otherRect.topLeft.row < this.topLeft.row) { this.topLeft.row = otherRect.topLeft.row; }
        if (otherRect.topLeft.col < this.topLeft.col) { this.topLeft.col = otherRect.topLeft.col; }
        if (otherRect.bottomRight.row > this.bottomRight.row) { this.bottomRight.row = otherRect.bottomRight.row; }
        if (otherRect.bottomRight.col > this.bottomRight.col) { this.bottomRight.col = otherRect.bottomRight.col; }
    }
}


/**
 * A partial is like a Rect, but instead of having topLeft and bottomRight Cells, it has start and end Cells.
 * The start Cell may be to the bottom or right of the end Cell, depending on how the user draws the rectangle.
 * You can still call the helper methods topLeft / bottomRight if you need the absolute end points.
 * TODO Should this extend Rect?
 */
export class Partial {
    constructor(canvas, start, end) {
        this.canvas = canvas;
        this.start = start; // Cell
        this.end = end; // Cell
    }

    // TODO Move this to canvas
    static drawableArea(canvas) {
        return new Partial(canvas, new Cell(canvas, 0, 0), new Cell(canvas, numRows() - 1, numCols() - 1));
    }

    set start(cell) {
        this._start = cell.bindToDrawableArea(true);
    }
    get start() {
        return this._start;
    }
    set end(cell) {
        this._end = cell.bindToDrawableArea(true);
    }
    get end() {
        return this._end;
    }

    get topLeft() {
        return new Cell(this.canvas, Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }

    get bottomRight() {
        return new Cell(this.canvas, Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col))
    }

    toRect() {
        return new Rect(this.canvas, this.topLeft, this.bottomRight);
    }

    // Returns true if this partial can be moved 1 space in the given direction
    canMove(direction, moveStart = true, moveEnd = true) {
        switch(direction) {
            case 'left':
                if (moveStart && this.start.col <= 0) { return false; }
                if (moveEnd && this.end.col <= 0) { return false; }
                break;
            case 'up':
                if (moveStart && this.start.row <= 0) { return false; }
                if (moveEnd && this.end.row <= 0) { return false; }
                break;
            case 'right':
                if (moveStart && this.start.col >= numCols() - 1) { return false; }
                if (moveEnd && this.end.col >= numCols() - 1) { return false; }
                break;
            case 'down':
                if (moveStart && this.start.row >= numRows() - 1) { return false; }
                if (moveEnd && this.end.row >= numRows() - 1) { return false; }
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
                return false;
        }
        return true;
    }

    // Move this partial 1 space in the given direction. Does not respect boundaries (you should call canMove first)
    move(direction, moveStart = true, moveEnd = true) {
        switch(direction) {
            case 'left':
                if (moveStart) { this.start.col -= 1; }
                if (moveEnd) { this.end.col -= 1; }
                break;
            case 'up':
                if (moveStart) { this.start.row -= 1; }
                if (moveEnd) { this.end.row -= 1; }
                break;
            case 'right':
                if (moveStart) { this.start.col += 1; }
                if (moveEnd) { this.end.col += 1; }
                break;
            case 'down':
                if (moveStart) { this.start.row += 1; }
                if (moveEnd) { this.end.row += 1; }
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
    }
}
