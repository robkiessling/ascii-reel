import {roundForComparison} from "./utilities.js";
import * as state from "./state.js";

const MONOSPACE_RATIO = 3/5;
const CELL_HEIGHT = 16;
const CELL_WIDTH = CELL_HEIGHT * MONOSPACE_RATIO;

const GRID = false;
const GRID_WIDTH = 0.25;
const GRID_COLOR = '#fff';

const WINDOW_BORDER_COLOR = '#fff';
// const WINDOW_BORDER_COLOR = '#4c8bf5'; // TODO Get this from scss?
const WINDOW_BORDER_WIDTH = 4;

const SELECTION_COLOR = '#4c8bf5'; // Note: Opacity is set in css... this is so I don't have to deal with overlapping rectangles
const ONION_OPACITY = 0.25;

const CHECKERBOARD_A = '#4c4c4c';
const CHECKERBOARD_B = '#555';
const CANVAS_BACKGROUND = false; // false => transparent
const CHECKER_SIZE = 20;

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
        this.context.textAlign = 'left';
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
    drawChars(chars, clearCanvas = true) {
        if (clearCanvas) {
            this.clear();

            if (CANVAS_BACKGROUND === false) {
                this._fillCheckerboard();
            }
            else {
                this.context.fillStyle = CANVAS_BACKGROUND;
                this.context.fillRect(...CellArea.drawableArea().xywh);
            }
        }

        // Convert individual chars into lines of text (of matching color), so we can call fillText as few times as possible
        let lines = [];
        for (let row = 0; row < chars.length; row++) {
            let line, colorIndex;
            for (let col = 0; col < chars[row].length; col++) {
                colorIndex = chars[row][col][1];
                if (line && colorIndex !== line.colorIndex) {
                    // Have to make new line
                    lines.push(line);
                    line = null;
                }

                if (!line) {
                    // Increase row by 0.5 so it is centered in cell
                    line = { x: Cell.x(col), y: Cell.y(row + 0.5), colorIndex: colorIndex, text: '' }
                }
                line.text += (chars[row][col][0] === '' ? ' ' : chars[row][col][0]);
            }
            if (line) { lines.push(line); }
        }
        lines.forEach(line => {
            this.context.fillStyle = state.colorStr(line.colorIndex);
            this.context.fillText(line.text, line.x, line.y);
        })

        if (GRID) {
            this._drawGrid();
        }
    }

    drawOnion(chars) {
        this.context.save();
        this.context.globalAlpha = ONION_OPACITY;
        this.drawChars(chars, false);
        this.context.restore();
    }

    // Note: This conflicts with drawChars. We use different canvases for chars/selections stacked on top of each other.
    highlightAreas(areas) {
        this.clear();

        // Draw all selection rectangles
        this.context.fillStyle = SELECTION_COLOR;
        areas.forEach(area => {
            this.context.fillRect(...area.xywh);
        });
    }

    drawWindow(rect) {
        this.context.strokeStyle = WINDOW_BORDER_COLOR;
        const scaledBorder = WINDOW_BORDER_WIDTH / this._currentZoom();
        this.context.lineWidth = scaledBorder;
        this.context.strokeRect(
            rect.x - scaledBorder / 2, // Need to move the whole window outwards by 50% of the border width
            rect.y - scaledBorder / 2,
            rect.width + scaledBorder,
            rect.height + scaledBorder
        )
    }

    _drawGrid() {
        this.context.strokeStyle = GRID_COLOR;
        this.context.lineWidth = GRID_WIDTH;

        for (let r = 0; r < state.numRows() + 1; r++) {
            this.context.beginPath();
            this.context.moveTo(Cell.x(0), Cell.y(r));
            this.context.lineTo(Cell.x(state.numCols()), Cell.y(r));
            this.context.stroke();
        }

        for (let c = 0; c < state.numCols() + 1; c++) {
            this.context.beginPath();
            this.context.moveTo(Cell.x(c), Cell.y(0));
            this.context.lineTo(Cell.x(c), Cell.y(state.numRows()));
            this.context.stroke();
        }
    }

    _fillCheckerboard() {
        // First, draw a checkerboard over full area (checkerboard does not change depending on zoom; this way we have
        // a static number of checkers and performance is consistent).
        this.usingFullArea((fullArea) => {
            this.context.beginPath();
            this.context.fillStyle = CHECKERBOARD_A;
            this.context.rect(...fullArea.xywh);
            this.context.fill();

            this.context.beginPath();
            this.context.fillStyle = CHECKERBOARD_B;
            let rowStartsOnB = false;
            let x, y;
            let maxX = roundForComparison(fullArea.x + fullArea.width);
            let maxY = roundForComparison(fullArea.y + fullArea.height);

            for (x = fullArea.x; roundForComparison(x) < maxX; x += CHECKER_SIZE) {
                let isCheckered = rowStartsOnB;
                for (y = fullArea.y; roundForComparison(y) < maxY; y += CHECKER_SIZE) {
                    if (isCheckered) {
                        this.context.rect(x, y, CHECKER_SIZE, CHECKER_SIZE);
                    }
                    isCheckered = !isCheckered;
                }
                rowStartsOnB = !rowStartsOnB;
            }
            this.context.fill();
        });

        // Clear the 4 edges between the drawable area and the full area
        const drawableArea = CellArea.drawableArea();
        const topLeft = this.pointAtExternalXY(0, 0);
        const bottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);
        this.context.clearRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, drawableArea.y - topLeft.y);
        this.context.clearRect(topLeft.x, topLeft.y, drawableArea.x - topLeft.x, bottomRight.y - topLeft.y);
        this.context.clearRect(
            drawableArea.x + drawableArea.width, topLeft.y,
            bottomRight.x - (drawableArea.x + drawableArea.width), bottomRight.y - topLeft.y
        );
        this.context.clearRect(
            topLeft.x, drawableArea.y + drawableArea.height,
            bottomRight.x - topLeft.x, bottomRight.y - (drawableArea.y + drawableArea.height)
        );

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

    cellAtExternalXY(x, y, checkBoundaries = false) {
        const point = this.pointAtExternalXY(x, y);
        const row = Math.floor(point.y / CELL_HEIGHT);
        const col = Math.floor(point.x / CELL_WIDTH);
        return !checkBoundaries || state.charInBounds(row, col) ? new Cell(row, col) : null;
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

    // Since x and y are based purely on col/row value, we have these static methods so you can calculate x/y without
    // having to instantiate a new Cell() -- helps with performance
    static x(col) {
        return col * CELL_WIDTH;
    }
    static y(row) {
        return row * CELL_HEIGHT;
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