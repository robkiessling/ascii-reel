import {roundForComparison} from "./utilities.js";
import * as state from "./state.js";
import bresenham from "bresenham";

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

const DASH_OUTLINE_LENGTH = 5;
const DASH_OUTLINE_WIDTH = 0.5;
const DASH_OUTLINE_SPEED = 10; // updates per second

const HIGHLIGHT_CELL_COLOR = '#fff';
const HIGHLIGHT_CELL_OPACITY = 0.15;

const CHECKERBOARD_A = '#4c4c4c';
const CHECKERBOARD_B = '#555';
const CANVAS_BACKGROUND = false; // false => transparent
const CHECKER_SIZE = 10;

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

        this.initialized = true;
    }

    get outerWidth() {
        return this.$canvas.outerWidth();
    }
    get outerHeight() {
        return this.$canvas.outerHeight();
    }

    clear() {
        // Clear any animation intervals
        if (this._outlineInterval) { window.clearInterval(this._outlineInterval); }

        // Clear entire canvas
        this.usingFullArea((fullArea) => {
            this.context.clearRect(...fullArea.xywh);
        });
    }

    drawBackground() {
        if (CANVAS_BACKGROUND === false) {
            this._fillCheckerboard();
        }
        else {
            this.context.fillStyle = CANVAS_BACKGROUND;
            this.context.fillRect(...CellArea.drawableArea().xywh);
        }
    }

    drawChars(chars) {
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
        });

        if (GRID) {
            this._drawGrid();
        }
    }

    drawOnion(chars) {
        this.context.save();
        this.context.globalAlpha = ONION_OPACITY;
        this.drawChars(chars);
        this.context.restore();
    }

    highlightPolygons(polygons) {
        this.context.fillStyle = SELECTION_COLOR;
        polygons.forEach(polygon => polygon.draw(this.context));
    }

    highlightCell(cell) {
        this.context.fillStyle = HIGHLIGHT_CELL_COLOR;
        this.context.globalAlpha = HIGHLIGHT_CELL_OPACITY;
        this.context.fillRect(...cell.xywh);
    }

    outlinePolygon(polygon, isDashed) {
        this.context.lineWidth = DASH_OUTLINE_WIDTH;

        if (isDashed) {
            if (this._outlineOffset === undefined) { this._outlineOffset = 0; }
            this._drawDashedOutline(polygon);
            this._outlineInterval = window.setInterval(() => {
                this._outlineOffset += 1;
                if (this._outlineOffset >= DASH_OUTLINE_LENGTH * 2) { this._outlineOffset = 0; }
                this._drawDashedOutline(polygon);
            }, 1000 / DASH_OUTLINE_SPEED);
        }
        else {
            this.context.setLineDash([]);
            this.context.strokeStyle = SELECTION_COLOR;
            polygon.stroke(this.context);
        }
    }

    _drawDashedOutline(polygon) {
        this.context.lineDashOffset = this._outlineOffset;
        this.context.setLineDash([DASH_OUTLINE_LENGTH, DASH_OUTLINE_LENGTH]);
        this.context.strokeStyle = 'white';
        polygon.stroke(this.context);

        this.context.lineDashOffset = this._outlineOffset + DASH_OUTLINE_LENGTH;
        this.context.setLineDash([DASH_OUTLINE_LENGTH, DASH_OUTLINE_LENGTH]);
        this.context.strokeStyle = 'black';
        polygon.stroke(this.context);
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

    cellAtExternalXY(x, y) {
        const point = this.pointAtExternalXY(x, y);
        const row = Math.floor(point.y / CELL_HEIGHT);
        const col = Math.floor(point.x / CELL_WIDTH);
        return new Cell(row, col);
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

    // Note: Diagonal is considered adjacent
    isAdjacentTo(cell) {
        return (cell.row !== this.row || cell.col !== this.col) && // Has to be a different cell
            cell.row <= (this.row + 1) && cell.row >= (this.row - 1) &&
            cell.col <= (this.col + 1) && cell.col >= (this.col - 1);
    }

    // Returns an array of Cells from this Cell's position to a target Cell's position
    // Using Bresenham line approximation https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
    lineTo(cell, inclusive = true) {
        const cells = bresenham(this.col, this.row, cell.col, cell.row).map(coord => {
            return new Cell(coord.y, coord.x);
        });

        if (inclusive) {
            return cells;
        }
        else {
            // Remove endpoints. Note: If line is only 1 or 2 Cells long, an empty array will be returned
            cells.shift();
            cells.pop();
            return cells;
        }
    }

    isInBounds() {
        return state.charInBounds(this.row, this.col);
    }

    get row() {
        return this._row;
    }

    set row(newValue) {
        this._row = newValue;
    }

    get col() {
        return this._col;
    }

    set col(newValue) {
        this._col = newValue;
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

    bindToDrawableArea() {
        if (this.topLeft.row < 0) { this.topLeft.row = 0; }
        if (this.topLeft.col < 0) { this.topLeft.col = 0; }
        if (this.topLeft.row > state.numRows() - 1) { this.topLeft.row = state.numRows(); } // Allow 1 space negative
        if (this.topLeft.col > state.numCols() - 1) { this.topLeft.col = state.numCols(); } // Allow 1 space negative

        if (this.bottomRight.row < 0) { this.bottomRight.row = -1; } // Allow 1 space negative
        if (this.bottomRight.col < 0) { this.bottomRight.col = -1; } // Allow 1 space negative
        if (this.bottomRight.row > state.numRows() - 1) { this.bottomRight.row = state.numRows() - 1; }
        if (this.bottomRight.col > state.numCols() - 1) { this.bottomRight.col = state.numCols() - 1; }

        return this;
    }

    iterate(callback) {
        for (let r = this.topLeft.row; r <= this.bottomRight.row; r++) {
            for (let c = this.topLeft.col; c <= this.bottomRight.col; c++) {
                callback(r, c);
            }
        }
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