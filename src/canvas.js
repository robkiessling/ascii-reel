import {numCols, numRows} from "./index.js";

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
        this.context.scale(ratio, ratio); // Note: This is not really necessary; it will get overriden by zoom

        // Set up font
        this.context.font = '1rem monospace';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        this.zoomTo(1);
    }

    get outerWidth() {
        return this.$canvas.outerWidth();
    }
    get outerHeight() {
        return this.$canvas.outerHeight();
    }

    // If numRows or numCols changes, entire canvas will need to be rebuilt
    rebuild() {
        this.zoomTo(this._zoom);
        this.clear();
    }

    clear() {
        this.context.clearRect(...new FullAreaRect().xywh(this));
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
            this._iterate2dArray(chars, (value, cell) => {
                if (value !== '') {
                    this.context.rect(...cell.xywh(this));
                }
            });
            this.context.fill();
        }

        // Draw all chars using fillText
        this._iterate2dArray(chars, (value, cell) => {
            this.context.fillStyle = TEXT_COLOR;

            // Translate by 50%, so we can draw char in center of cell
            this.context.fillText(value, ...cell.translate(0.5, 0.5).xy(this));
        });

        if (GRID) {
            this.drawGrid(chars);
        }
    }

    highlightSelection(cells) {
        this.clear();

        // Draw all selection rectangles
        cells.forEach(cell => {
            this.context.fillStyle = SELECTION_COLOR;
            this.context.fillRect(...cell.xywh(this));
        });
    }

    drawGrid(chars) {
        this.context.strokeStyle = GRID_COLOR;
        this.context.lineWidth = GRID_WIDTH;

        this._iterate2dArray(chars, (value, cell) => {
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

    cellAtExternalXY(x, y) {
        x = this.relativeX(this.scale(x)); // Scale external value & make relative to origin
        y = this.relativeY(this.scale(y)); // Scale external value & make relative to origin
        return new Cell(Math.floor(y / CELL_HEIGHT), Math.floor(x / CELL_WIDTH))
    }

    absoluteX(relativeX) {
        return relativeX + this._origin.x;
    }
    absoluteY(relativeY) {
        return relativeY + this._origin.y;
    }
    relativeX(absoluteX) {
        return absoluteX - this._origin.x;
    }
    relativeY(absoluteY) {
        return absoluteY - this._origin.y;
    }

    zoomTo(level) {
        this._zoom = level;

        // Set context scale: Have to factor in device PPI like we did when we built the canvas
        const contextScale = window.devicePixelRatio * this._zoom;
        this.context.setTransform(1, 0, 0, 1, 0, 0); // reset scale
        this.context.scale(contextScale, contextScale); // scaled to desired amount

        /**
         * _origin is the absolute x/y coordinates of the top-left point of the drawable area
         */
        const drawableArea = CellArea.drawableArea();
        this._origin = {
            x: this.scale(this.outerWidth) / 2 - drawableArea.width(this) / 2,
            y: this.scale(this.outerHeight) / 2 - drawableArea.height(this) / 2
        }
    }

    zoomDelta(delta) {
        const originalZoom = this._zoom;
        let newZoom = originalZoom + delta;

        if (newZoom < ZOOM_BOUNDARIES[0]) { newZoom = ZOOM_BOUNDARIES[0]; }
        if (newZoom > ZOOM_BOUNDARIES[1]) { newZoom = ZOOM_BOUNDARIES[1]; }
        if (newZoom === originalZoom) { return; }

        this.zoomTo(newZoom);
    }

    scale(value) {
        return value / this._zoom;
    }

    _iterate2dArray(array, callback) {
        for (let row = 0; row < array.length; row++) {
            for (let col = 0; col < array[row].length; col++) {
                callback(array[row][col], new Cell(row, col));
            }
        }
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
 *
 * If you want to get the computed x/y value of a cell, you can call the x/y methods. You have to pass in the canvas as
 * a parameter because the x/y value is dependent on the canvas zoom/dimensions.
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
        return canvas.absoluteX(this.col * CELL_WIDTH);
    }
    y(canvas) {
        return canvas.absoluteY(this.row * CELL_HEIGHT);
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


/**
 * A special Rect that is always the full dimensions of the canvas.
 * Note: This does not have the normal row/col methods of a regular CellArea.
 */
class FullAreaRect {
    x(canvas) {
        return canvas.scale(0);
    }
    y(canvas) {
        return canvas.scale(0);
    }
    width(canvas) {
        return canvas.scale(canvas.outerWidth);
    }
    height(canvas) {
        return canvas.scale(canvas.outerHeight);
    }
}
Object.assign(FullAreaRect.prototype, RectMixin);
