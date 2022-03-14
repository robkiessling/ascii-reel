import {iterate2dArray, roundForComparison} from "./utilities.js";
import * as state from "./state.js";

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

// const WINDOW_BORDER = '#f48225'; // TODO Get this from scss?
const WINDOW_BORDER = '#4c8bf5';
const WINDOW_WIDTH = 5;

// const SELECTION_COLOR = '#0066cc88';
const SELECTION_COLOR = '#4c8bf588';
const TEXT_COLOR = '#fff';

const CHECKERBOARD_A = '#4c4c4c';
const CHECKERBOARD_B = '#555';
const CHAR_BACKGROUND = CHECKERBOARD_A; // false => transparent. We use non-transparent so you can see spaces
const CANVAS_BACKGROUND = false; // false => transparent

const ZOOM_BOUNDARIES = [0.25, 30];
const ZOOM_MARGIN = 1.2;

export class CanvasControl {
    constructor($canvas, config = {}) {
        this.$canvas = $canvas;
        this.canvas = this.$canvas.get(0);
        this.context = this.canvas.getContext("2d");
        this.config = config;
    }

    // TODO Currently it will always zoom all the way out after a resize event, due to buildBoundaries
    resize() {
        // Reset any width/height attributes that may have been set previously
        this.canvas.removeAttribute('width');
        this.canvas.removeAttribute('height');
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";

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

    clear() {
        this.usingFullArea((fullArea) => {
            this.context.clearRect(...fullArea.xywh);
        });
    }

    // Note: If numRows or numCols changes, canvas will need to be rezoomed
    drawChars(chars) {
        this.clear();

        if (CANVAS_BACKGROUND === false) {
            this._fillCheckerboard(CellArea.drawableArea());
        }
        else {
            this.context.fillStyle = CANVAS_BACKGROUND;
            this.context.fillRect(...CellArea.drawableArea().xywh);
        }

        if (CHAR_BACKGROUND) {
            this.context.beginPath();
            this.context.fillStyle = CHAR_BACKGROUND;
            iterate2dArray(chars, (value, cell) => {
                if (value !== '') {
                    this.context.rect(...cell.xywh);
                }
            });
            this.context.fill();
        }

        // Draw all chars using fillText
        iterate2dArray(chars, (value, cell) => {
            this.context.fillStyle = TEXT_COLOR;

            // Translate by 50%, so we can draw char in center of cell
            this.context.fillText(value, ...cell.translate(0.5, 0.5).xy);
        });

        if (GRID) {
            this._drawGrid(chars);
        }
    }

    // Note: This conflicts with drawChars. We use different canvases for chars/selections stacked on top of each other.
    highlightCells(cells) {
        this.clear();

        // Draw all selection rectangles
        cells.forEach(cell => {
            this.context.fillStyle = SELECTION_COLOR;
            this.context.fillRect(...cell.xywh);
        });
    }

    drawWindow(rect) {
        this.context.strokeStyle = WINDOW_BORDER;
        this.context.lineWidth = WINDOW_WIDTH / this._currentZoom();
        this.context.strokeRect(...rect.xywh);
    }

    _drawGrid(chars) {
        this.context.strokeStyle = GRID_COLOR;
        this.context.lineWidth = GRID_WIDTH;

        iterate2dArray(chars, (value, cell) => {
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

    _fillCheckerboard(area) {
        this.context.beginPath();
        this.context.fillStyle = CHECKERBOARD_A;
        this.context.rect(...area.xywh);
        this.context.fill();

        this.context.beginPath();
        this.context.fillStyle = CHECKERBOARD_B;
        let rowStartsOnB = false;
        for (let x = area.x; roundForComparison(x) < roundForComparison(area.x + area.width); x += CHECKER_WIDTH) {
            let isCheckered = rowStartsOnB;
            for (let y = area.y; roundForComparison(y) < roundForComparison(area.y + area.height); y += CHECKER_HEIGHT) {
                if (isCheckered) {
                    this.context.rect(x, y, CHECKER_WIDTH, CHECKER_HEIGHT);
                }
                isCheckered = !isCheckered;
            }
            rowStartsOnB = !rowStartsOnB;
        }
        this.context.fill();
    }
    
    
    // -------------------------------------------------------------- Zoom/View related methods

    // Builds the zoom boundaries and zooms out all the way
    buildBoundaries() {
        this._minZoom = this._zoomLevelForFit() / ZOOM_MARGIN;
        this.zoomTo(this._minZoom); // Have to zoom to minimum so we can record what the boundaries are
        this._boundaries = this.currentViewRect();
    }

    // Returns a Rect of the current view window
    currentViewRect() {
        const topLeft = this.pointAtExternalXY(0, 0);
        const bottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);
        return new Rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }

    // This method allows you to perform operations on the full area of the canvas
    usingFullArea(callback) {
        // Temporarily transform to original context -> make a Rect with canvas boundaries -> transform back afterwards
        const currentTransform = this.context.getTransform();
        this.context.setTransform(this.originalTransform);
        callback(new Rect(0, 0, this.outerWidth, this.outerHeight));
        this.context.setTransform(currentTransform);
    }

    pointAtExternalXY(x, y) {
        const absTransform = this._absoluteTransform();
        return {
            x: (x - absTransform.e) / absTransform.a,
            y: (y - absTransform.f) / absTransform.d
        };
    }

    cellAtExternalXY(x, y) {
        const point = this.pointAtExternalXY(x, y);
        return new Cell(Math.floor(point.y / CELL_HEIGHT), Math.floor(point.x / CELL_WIDTH))
    }

    zoomTo(level) {
        // Reset scale
        this.context.setTransform(this.originalTransform);

        // Center around absolute midpoint of drawableArea
        const drawableArea = CellArea.drawableArea();
        const target = {
            x: this.outerWidth / 2 - drawableArea.width * level / 2,
            y: this.outerHeight / 2 - drawableArea.height * level / 2
        }
        this.context.translate(target.x, target.y);

        // Scale to desired level
        this.context.scale(level, level);
    }

    zoomToFit() {
        this.zoomTo(this._zoomLevelForFit());
    }

    zoomDelta(delta, target) {
        const currentZoom = this._currentZoom();
        let newZoom = currentZoom * delta;

        if (newZoom < ZOOM_BOUNDARIES[0]) { newZoom = ZOOM_BOUNDARIES[0]; delta = newZoom / currentZoom; }
        if (newZoom > ZOOM_BOUNDARIES[1]) { newZoom = ZOOM_BOUNDARIES[1]; delta = newZoom / currentZoom; }
        if (newZoom < this._minZoom) { newZoom = this._minZoom; delta = newZoom / currentZoom; }
        if (roundForComparison(newZoom) === roundForComparison(currentZoom)) { return; }

        // Zoom to the mouse target, using a process described here: https://stackoverflow.com/a/5526721
        this.context.translate(target.x, target.y)
        this.context.scale(delta, delta);
        this.context.translate(-target.x, -target.y)

        this._applyBoundaries();
    }

    // Moves zoom window to be centered around target
    translateToTarget(target) {
        const currentZoom = this._currentZoom();
        const viewRect = this.currentViewRect();

        this.context.setTransform(this.originalTransform);
        this.context.translate(
            -target.x * currentZoom + viewRect.width * currentZoom / 2,
            -target.y * currentZoom + viewRect.height * currentZoom / 2
        )
        this.context.scale(currentZoom, currentZoom);

        this._applyBoundaries();
    }

    translateAmount(x, y) {
        this.context.translate(x, y);
        this._applyBoundaries();
    }

    _currentZoom() {
        return this._absoluteTransform().a;
    }

    _zoomLevelForFit() {
        const drawableArea = CellArea.drawableArea();

        // We want origin to be [0, 0]. I.e. this.outerWidth / this._zoom = drawableArea.width;
        const xZoom = this.outerWidth / drawableArea.width;
        const yZoom = this.outerHeight / drawableArea.height;

        // Use whichever axis needs to be zoomed out more
        return Math.min(xZoom, yZoom);
    }

    // Lock zoom-out to a set of boundaries
    _applyBoundaries() {
        if (this._boundaries) {
            const topLeft = this.pointAtExternalXY(0, 0);
            const bottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);

            if (topLeft.x < this._boundaries.x) {
                this.context.translate(topLeft.x - this._boundaries.x, 0);
            }
            if (topLeft.y < this._boundaries.y) {
                this.context.translate(0, topLeft.y - this._boundaries.y);
            }
            const farRightBoundary = this._boundaries.x + this._boundaries.width;
            if (bottomRight.x > farRightBoundary) {
                this.context.translate(bottomRight.x - farRightBoundary, 0);
            }
            const forBottomBoundary = this._boundaries.y + this._boundaries.height;
            if (bottomRight.y > forBottomBoundary) {
                this.context.translate(0, bottomRight.y - forBottomBoundary);
            }
        }
    }

    // When you call getTransform(), it contains values relative to our originalTransform (which could be a scale of 2).
    // If you want the absolute transform, have to divide by the starting point (originalTransform)
    _absoluteTransform() {
        const current = this.context.getTransform();
        current.a /= this.originalTransform.a;
        current.d /= this.originalTransform.d;
        current.e /= this.originalTransform.a;
        current.f /= this.originalTransform.d;
        return current;
    }

}






class Rect {
    constructor(x, y, width, height) {
        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;
    }
    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get width() {
        return this._width;
    }
    get height() {
        return this._height;
    }

    // Allows x/y values to be easily passed to other methods using javascript spread syntax (...)
    get xy() {
        return [this.x, this.y];
    }

    // Allows x/y/width/height values to be easily passed to other methods using javascript spread syntax (...)
    get xywh() {
        return [this.x, this.y, this.width, this.height];
    }

}

/**
 * A Cell is a particular row/column pair of the drawable area. It is useful so we can deal with rows/columns instead
 * of raw x/y values.
 */
export class Cell extends Rect {
    constructor(row, col) {
        super();
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
            if (this._row > state.numRows() - 1) { this._row = state.numRows() - 1; }
        }
    }

    get col() {
        return this._col;
    }

    set col(newValue) {
        this._col = newValue;
        if (this._boundToDrawableArea) {
            if (this._col < 0) { this._col = 0; }
            if (this._col > state.numCols() - 1) { this._col = state.numCols() - 1; }
        }
    }

    get x() {
        return this.col * CELL_WIDTH;
    }
    get y() {
        return this.row * CELL_HEIGHT;
    }
    get width() {
        return CELL_WIDTH;
    }
    get height() {
        return CELL_HEIGHT;
    }
}

/**
 * A CellArea is a rectangle of Cells between a topLeft Cell and a bottomRight Cell.
 */
export class CellArea extends Rect {
    constructor(topLeft, bottomRight) {
        super();
        this.topLeft = topLeft; // Cell
        this.bottomRight = bottomRight; // Cell
    }

    static drawableArea() {
        return new CellArea(new Cell(0, 0), new Cell(state.numRows() - 1, state.numCols() - 1));
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
}