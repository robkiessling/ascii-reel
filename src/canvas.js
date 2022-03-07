import {numCols, numRows} from "./index.js";
import {iterate2dArray} from "./utilities.js";

const MONOSPACE_RATIO = 3/5;
const CELL_HEIGHT = 16;
const CELL_WIDTH = CELL_HEIGHT * MONOSPACE_RATIO;

// Since monospace ratio has denominator of 5, this should be a multiple a 5 if you want cells to align with checkers
const CHECKERS_PER_CELL_COL = 5;
const CHECKERS_PER_CELL_ROW = CHECKERS_PER_CELL_COL * MONOSPACE_RATIO;
const CHECKER_WIDTH = CELL_WIDTH / CHECKERS_PER_CELL_ROW;
const CHECKER_HEIGHT = CELL_HEIGHT / CHECKERS_PER_CELL_COL;

const GRID = false;
const GRID_WIDTH = 0.25;
const GRID_COLOR = '#fff';

const WINDOW_COLOR = '#ffff00';
const WINDOW_WIDTH = 4;

const SELECTION_COLOR = '#0066cc88';
const TEXT_COLOR = '#fff';

const CHAR_BACKGROUND = false; // false => transparent (will rarely NOT be transparent; only when you need to see spaces)
const CANVAS_BACKGROUND = '#4c4c4c'; // false => transparent
const CHECKERBOARD_A = '#4c4c4c';
const CHECKERBOARD_B = '#555';

const ZOOM_BOUNDARIES = [0.25, 5];
const ZOOM_MARGIN = 1.1;

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

        // Store the base transformation (after fixing PPI). Deltas have to be calculated according to
        // this originalTransform (not the identity matrix)
        this.originalTransform = this.context.getTransform();

        // Set up font
        this.context.font = '1rem monospace';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        this.buildBoundaries();
    }

    get outerWidth() {
        return this.$canvas.outerWidth();
    }
    get outerHeight() {
        return this.$canvas.outerHeight();
    }

    // If numRows or numCols changes, entire canvas will need to be rebuilt
    rebuild() {
        this.buildBoundaries();
        this.clear();
    }

    clear() {
        this.usingFullArea((fullArea) => {
            this.context.clearRect(...fullArea.xywh(this));
        });
    }

    drawChars(chars) {
        this.clear();

        if (CANVAS_BACKGROUND === false) {
            this.fillCheckerboard(CellArea.drawableArea());
        }
        else {
            this.context.fillStyle = CANVAS_BACKGROUND;
            this.context.fillRect(...CellArea.drawableArea().xywh(this));
        }

        if (CHAR_BACKGROUND) {
            this.context.beginPath();
            this.context.fillStyle = CHAR_BACKGROUND;
            iterate2dArray(chars, (value, cell) => {
                if (value !== '') {
                    this.context.rect(...cell.xywh(this));
                }
            });
            this.context.fill();
        }

        // Draw all chars using fillText
        iterate2dArray(chars, (value, cell) => {
            this.context.fillStyle = TEXT_COLOR;

            // Translate by 50%, so we can draw char in center of cell
            this.context.fillText(value, ...cell.translate(0.5, 0.5).xy(this));
        });

        if (GRID) {
            this.drawGrid(chars);
        }
    }

    highlightCells(cells) {
        this.clear();

        // Draw all selection rectangles
        cells.forEach(cell => {
            this.context.fillStyle = SELECTION_COLOR;
            this.context.fillRect(...cell.xywh(this));
        });
    }

    drawWindow(rect) {
        this.context.strokeStyle = WINDOW_COLOR;
        this.context.lineWidth = WINDOW_WIDTH;
        this.context.strokeRect(...rect.xywh(this));
    }

    drawGrid(chars) {
        this.context.strokeStyle = GRID_COLOR;
        this.context.lineWidth = GRID_WIDTH;

        iterate2dArray(chars, (value, cell) => {
            // Drawing a box around the cell. Only draw left/top borders for first cells in the row/col
            this.context.beginPath();
            this.context.moveTo(...cell.xy(this));
            cell.col === 0 ? this.context.lineTo(...cell.translate(1, 0).xy(this)) : this.context.moveTo(...cell.translate(1, 0).xy(this));
            this.context.lineTo(...cell.translate(0, 1).xy(this));
            this.context.lineTo(...cell.translate(-1, 0).xy(this));
            cell.row === 0 ? this.context.lineTo(...cell.translate(0, -1).xy(this)) : this.context.moveTo(...cell.translate(0, -1).xy(this))
            this.context.stroke();
        });
    }

    fillCheckerboard(area) {
        this.context.beginPath();
        this.context.fillStyle = CHECKERBOARD_A;
        this.context.rect(...area.xywh(this));
        this.context.fill();

        this.context.beginPath();
        this.context.fillStyle = CHECKERBOARD_B;
        let rowStartsOnB = false;
        // TODO Hack subtracting 0.001 to account for floating point round errors
        for (let x = area.x(this); x < (area.x(this) + area.width(this) - 0.001); x += CHECKER_WIDTH) {
            let isCheckered = rowStartsOnB;
            for (let y = area.y(this); y < (area.y(this) + area.height(this) - 0.001); y += CHECKER_HEIGHT) {
                if (isCheckered) {
                    this.context.rect(x, y, CHECKER_WIDTH, CHECKER_HEIGHT);
                }
                isCheckered = !isCheckered;
            }
            rowStartsOnB = !rowStartsOnB;
        }
        this.context.fill();
    }

    // When you call getTransform(), it contains values relative to our originalTransform (which could be a scale of 2).
    // If you want the absolute transform, have to divide by the starting point (originalTransform)
    //      getTransform() => 0.5
    //      we are actually at 0.25 from absolute
    absoluteTransform() {
        const current = this.context.getTransform();
        current.a /= this.originalTransform.a;
        current.d /= this.originalTransform.d;
        current.e /= this.originalTransform.a;
        current.f /= this.originalTransform.d;
        return current;
    }

    currentZoom() {
        return this.context.getTransform().a / this.originalTransform.a;
    }

    pointAtExternalXY(x, y) {
        const absTransform = this.absoluteTransform();
        return {
            x: (x - absTransform.e) / absTransform.a,
            y: (y - absTransform.f) / absTransform.d
        };
    }

    cellAtExternalXY(x, y) {
        const point = this.pointAtExternalXY(x, y);
        return new Cell(Math.floor(point.y / CELL_HEIGHT), Math.floor(point.x / CELL_WIDTH))
    }

    zoomTo(newZoom) {
        // Reset scale
        this.context.setTransform(this.originalTransform);

        // Center around absolute midpoint of drawableArea
        const drawableArea = CellArea.drawableArea();
        const target = {
            x: this.outerWidth / 2 - drawableArea.width(this) * newZoom / 2,
            y: this.outerHeight / 2 - drawableArea.height(this) * newZoom / 2
        }
        this.context.translate(target.x, target.y);

        // Scale to desired level
        this.context.scale(newZoom, newZoom);
    }

    zoomDelta(delta, target) {
        const originalZoom = this.currentZoom();
        let newZoom = originalZoom * delta;

        if (newZoom < ZOOM_BOUNDARIES[0]) { newZoom = ZOOM_BOUNDARIES[0]; delta = newZoom / originalZoom; }
        if (newZoom > ZOOM_BOUNDARIES[1]) { newZoom = ZOOM_BOUNDARIES[1]; delta = newZoom / originalZoom; }
        if (newZoom === originalZoom) { return; }
        if (newZoom < this._minZoom) { newZoom = this._minZoom; delta = newZoom / originalZoom; }

        target = this.pointAtExternalXY(target.x, target.y);

        this.context.translate(target.x, target.y)
        this.context.scale(delta, delta);
        this.context.translate(-target.x, -target.y)

        if (this._boundaries) {
            const newTopLeft = this.pointAtExternalXY(0, 0);
            const newBottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);

            if (newTopLeft.x < this._boundaries.x()) {
                this.context.translate(-(this._boundaries.x() - newTopLeft.x), 0);
            }
            if (newTopLeft.y < this._boundaries.y()) {
                this.context.translate(0, -(this._boundaries.y() - newTopLeft.y));
            }
            const farRightBoundary = this._boundaries.x() + this._boundaries.width();
            if (newBottomRight.x > farRightBoundary) {
                this.context.translate((newBottomRight.x - farRightBoundary), 0);
            }
            const forBottomBoundary = this._boundaries.y() + this._boundaries.height();
            if (newBottomRight.y > forBottomBoundary) {
                this.context.translate(0, (newBottomRight.y - forBottomBoundary));
            }
        }
    }

    zoomToFit() {
        this.zoomTo(this._zoomLevelForFit());
    }

    _zoomLevelForFit() {
        const drawableArea = CellArea.drawableArea();

        // We want origin to be [0, 0]. I.e. this.outerWidth / this._zoom = drawableArea.width(this);
        const xZoom = this.outerWidth / drawableArea.width(this);
        const yZoom = this.outerHeight / drawableArea.height(this);

        // Use whichever axis needs to be zoomed out more
        return Math.min(xZoom, yZoom);
    }

    buildBoundaries() {
        this._minZoom = this._zoomLevelForFit() / ZOOM_MARGIN;
        this.zoomTo(this._minZoom);
        this._boundaries = this.viewRect();
    }

    viewRect() {
        const topLeft = this.pointAtExternalXY(0, 0);
        const bottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);
        return new Rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }

    usingFullArea(callback) {
        // Note: The Rect we create only makes sense at the originalTransform, so we temporarily transform the context
        //       back to the original
        const currentTransform = this.context.getTransform();
        this.context.setTransform(this.originalTransform);
        callback(new Rect(0, 0, this.outerWidth, this.outerHeight));
        this.context.setTransform(currentTransform);
    }

}






/**
 * A mixin that provide additional helper methods for classes that implement x, y, width, and height methods.
 * This allows x/y/width/height values to be easily passed to other methods using javascript spread syntax (...)
 */
const RectMixin = {
    xy(canvas) {
        return [this.x(canvas), this.y(canvas)];
    },

    xywh(canvas) {
        return [this.x(canvas), this.y(canvas), this.width(canvas), this.height(canvas)];
    }
}

/**
 * A Cell is a particular row/column pair of the drawable area. It is useful so we can deal with rows/columns instead
 * of raw x/y values.
 */
export class Cell {
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }

    clone() {
        return new Cell(this.row, this.col);
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

    get row() {
        return this._row;
    }

    set row(newValue) {
        this._row = newValue;
        if (this._boundToDrawableArea) {
            if (this._row < 0) { this._row = 0; }
            if (this._row > numRows() - 1) { this._row = numRows() - 1; }
        }
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
    }

    x(canvas) {
        return this.col * CELL_WIDTH;
    }
    y(canvas) {
        return this.row * CELL_HEIGHT;
    }
    width(/* canvas */) {
        return CELL_WIDTH;
    }
    height(/* canvas */) {
        return CELL_HEIGHT;
    }
}
Object.assign(Cell.prototype, RectMixin);

/**
 * A CellArea is a rectangle of Cells between a topLeft Cell and a bottomRight Cell.
 */
export class CellArea {
    constructor(topLeft, bottomRight) {
        this.topLeft = topLeft; // Cell
        this.bottomRight = bottomRight; // Cell
    }

    static drawableArea() {
        return new CellArea(new Cell(0, 0), new Cell(numRows() - 1, numCols() - 1));
    }

    get numRows() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }

    get numCols() {
        return this.bottomRight.col - this.topLeft.col + 1;
    }

    clone() {
        return new CellArea(this.topLeft.clone(), this.bottomRight.clone());
    }

    iterate(callback) {
        for (let r = this.topLeft.row; r <= this.bottomRight.row; r++) {
            for (let c = this.topLeft.col; c <= this.bottomRight.col; c++) {
                callback(r, c);
            }
        }
    }

    mergeArea(otherRect) {
        if (otherRect.topLeft.row < this.topLeft.row) { this.topLeft.row = otherRect.topLeft.row; }
        if (otherRect.topLeft.col < this.topLeft.col) { this.topLeft.col = otherRect.topLeft.col; }
        if (otherRect.bottomRight.row > this.bottomRight.row) { this.bottomRight.row = otherRect.bottomRight.row; }
        if (otherRect.bottomRight.col > this.bottomRight.col) { this.bottomRight.col = otherRect.bottomRight.col; }
    }

    x(canvas) {
        return this.topLeft.x(canvas);
    }
    y(canvas) {
        return this.topLeft.y(canvas);
    }
    width(/* canvas */) {
        return this.numCols * CELL_WIDTH;
    }
    height(/* canvas */) {
        return this.numRows * CELL_HEIGHT;
    }
}
Object.assign(CellArea.prototype, RectMixin);


export class Rect {
    constructor(x, y, width, height) {
        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;
    }
    x() {
        return this._x;
    }
    y() {
        return this._y;
    }
    width() {
        return this._width;
    }
    height() {
        return this._height;
    }
}
Object.assign(Rect.prototype, RectMixin);
