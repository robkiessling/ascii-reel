import {setIntervalUsingRAF} from "../utils/utilities.js";
import {colorStr, numCols, numRows, config} from "../state/state.js";
import {fontHeight, fontWidth} from "./font.js";
import Rect from "../geometry/rect.js";
import Cell from "../geometry/cell.js";
import CellArea from "../geometry/cell_area.js";
import {roundForComparison} from "../utils/numbers.js";

const WINDOW_BORDER_COLOR = '#31e39d';
const WINDOW_BORDER_WIDTH = 4;

const SELECTION_COLOR = '#4c8bf5'; // Note: Opacity is set in css... this is so I don't have to deal with overlapping rectangles
const ONION_OPACITY = 0.25;

const OUTLINE_WIDTH = 0.5;

const CURSOR_CELL_COLOR = '#31e39d';
const CURSOR_WIDTH = 0.35;

const DASH_OUTLINE_LENGTH = 5;
const DASH_OUTLINE_FPS = 60;

const HIGHLIGHT_CELL_COLOR = '#fff';
const HIGHLIGHT_CELL_OPACITY = 0.15;

const CHECKERBOARD_A = '#4c4c4c';
const CHECKERBOARD_B = '#555';
const CHECKER_SIZE = 10;

const ZOOM_BOUNDARIES = [0.25, 30];
const ZOOM_MARGIN = 1.2;

export default class CanvasControl {
    constructor($canvas, config = {}) {
        this.$canvas = $canvas;
        this.canvas = this.$canvas.get(0);
        this.context = this.canvas.getContext("2d");
        this.config = config;
    }

    // TODO Currently it will always zoom all the way out after a resize event, due to _buildBoundaries
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
        this.context.font = `${fontHeight}px ${config('font')}`;
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';

        this._buildBoundaries();

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
        if (this._outlineInterval) { this._outlineInterval.stop(); }
        if (this._cursorInterval) { this._cursorInterval.stop(); }

        // Clear entire canvas
        this.usingFullArea((fullArea) => {
            this.context.clearRect(...fullArea.xywh);
        });
    }

    drawBackground(color) {
        if (color === false) {
            this._fillCheckerboard();
        }
        else {
            this.context.fillStyle = color;
            this.context.fillRect(...CellArea.drawableArea().xywh);
        }
    }

    drawGlyphs(glyphs) {
        // Convert individual glyphs into lines of text (of matching color), so we can call fillText as few times as possible
        let lines = [];
        let row, col, rowLength = glyphs.chars.length, colLength = glyphs.chars[0].length;

        for (row = 0; row < rowLength; row++) {
            let line, colorIndex;
            for (col = 0; col < colLength; col++) {
                colorIndex = glyphs.colors[row][col];
                if (line && colorIndex !== line.colorIndex) {
                    // Have to make new line
                    lines.push(line);
                    line = null;
                }

                if (!line) {
                    // Increase row by 0.5 so it is centered in cell
                    line = { x: Cell.x(col), y: Cell.y(row + 0.5), colorIndex: colorIndex, text: '' }
                }
                line.text += (glyphs.chars[row][col] === '' ? ' ' : glyphs.chars[row][col]);
            }
            if (line) { lines.push(line); }
        }
        lines.forEach(line => {
            this.context.fillStyle = colorStr(line.colorIndex);
            this.context.fillText(line.text, line.x, line.y);
        });
    }

    drawOnion(glyphs) {
        this.context.save();
        this.context.globalAlpha = ONION_OPACITY;
        this.drawGlyphs(glyphs);
        this.context.restore();
    }

    highlightPolygons(polygons) {
        this.context.fillStyle = SELECTION_COLOR;
        polygons.forEach(polygon => polygon.draw(this.context));
    }

    drawCursorCell(cell) {
        this.context.strokeStyle = CURSOR_CELL_COLOR; // TODO Maybe color should be whatever color is selected?
        this.context.lineWidth = OUTLINE_WIDTH;

        // Clear out targeted cell and surround it with a border
        this.context.clearRect(...cell.xywh);
        // this.context.strokeRect(...cell.xywh);

        this._cursorInterval = setIntervalUsingRAF(() => {
            this._drawCursor(cell);
        }, 1000 / 5, true);
    }

    preventStandardRightClick() {
        this.$canvas.off('contextmenu.canvas').on('contextmenu.canvas', evt => {
            return false;
        });
    }

    _drawCursor(cell) {
        const now = new Date().getMilliseconds();

        // If a new cell is being targeted, we want to immediately show the cursor
        if (this._textCursorCell === undefined || !this._textCursorCell.equals(cell)) {
            this._textCursorCell = cell;
            this._textCursorCellTime = now;
        }

        const elapsed = (now >= this._textCursorCellTime ? now : now + 1000) - this._textCursorCellTime;

        // Alternate cursor every 500ms
        if (elapsed <= 500) {
            this.context.strokeStyle = CURSOR_CELL_COLOR;
            this.context.lineWidth = CURSOR_WIDTH;

            this.context.beginPath();
            cell = cell.clone();
            this.context.moveTo(cell.x + OUTLINE_WIDTH + CURSOR_WIDTH, cell.y + OUTLINE_WIDTH + CURSOR_WIDTH);
            cell.translate(1, 0);
            this.context.lineTo(cell.x + OUTLINE_WIDTH + CURSOR_WIDTH, cell.y - OUTLINE_WIDTH - CURSOR_WIDTH);
            this.context.stroke();
        }
        else {
            // Reduce rect size by half an outline width
            const innerRect = new Rect(cell.x + OUTLINE_WIDTH / 2, cell.y + OUTLINE_WIDTH / 2, cell.width - OUTLINE_WIDTH, cell.height - OUTLINE_WIDTH);
            this.context.clearRect(...innerRect.xywh);
        }
    }

    highlightCell(cell) {
        this.context.fillStyle = HIGHLIGHT_CELL_COLOR;
        this.context.globalAlpha = HIGHLIGHT_CELL_OPACITY;
        this.context.fillRect(...cell.xywh);
    }

    outlinePolygon(polygon, isDashed) {
        this.context.lineWidth = OUTLINE_WIDTH;

        if (isDashed) {
            this._outlineInterval = setIntervalUsingRAF(() => {
                this._drawDashedOutline(polygon);
            }, 1000 / DASH_OUTLINE_FPS, true);
        }
        else {
            this.context.setLineDash([]);
            this.context.strokeStyle = SELECTION_COLOR;
            polygon.stroke(this.context);
        }
    }

    _drawDashedOutline(polygon) {
        const now = new Date();
        const offset = (now.getMilliseconds() / 1000.0) * DASH_OUTLINE_LENGTH * 2;

        this.context.lineDashOffset = offset;
        this.context.setLineDash([DASH_OUTLINE_LENGTH, DASH_OUTLINE_LENGTH]);
        this.context.strokeStyle = 'white';
        polygon.stroke(this.context);

        this.context.lineDashOffset = offset + DASH_OUTLINE_LENGTH;
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

    drawGrid(width, spacing, color) {
        this.context.strokeStyle = color;
        this.context.lineWidth = width / this._currentZoom();

        for (let r = 0; r < numRows() + 1; r += spacing) {
            this.context.beginPath();
            this.context.moveTo(Cell.x(0), Cell.y(r));
            this.context.lineTo(Cell.x(numCols()), Cell.y(r));
            this.context.stroke();
        }

        for (let c = 0; c < numCols() + 1; c += spacing) {
            this.context.beginPath();
            this.context.moveTo(Cell.x(c), Cell.y(0));
            this.context.lineTo(Cell.x(c), Cell.y(numRows()));
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
    _buildBoundaries() {
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
        const row = Math.floor(point.y / fontHeight);
        const col = Math.floor(point.x / fontWidth);
        return new Cell(row, col);
    }

    // Getting the "cursor" positioning is slightly different than just getting the corresponding cell; we round the x
    // position up or down, depending on where the user clicks in the cell. This is how real text editors work - if you
    // click on the right half of a character, it will round up to the next character
    cursorAtExternalXY(x, y) {
        const point = this.pointAtExternalXY(x, y);
        const row = Math.floor(point.y / fontHeight);
        const col = Math.round(point.x / fontWidth);
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

    /**
     * Zooms the canvas in or out focused at a particular target
     * @param delta Float controlling the magnitude of the zoom. A value > 1 will zoom in, a value < 1 will zoom out.
     * @param target Point to zoom towards. If undefined, will zoom in/out relative to center of canvas.
     */
    zoomDelta(delta, target) {
        const currentZoom = this._currentZoom();
        let newZoom = currentZoom * delta;

        if (newZoom < ZOOM_BOUNDARIES[0]) { newZoom = ZOOM_BOUNDARIES[0]; delta = newZoom / currentZoom; }
        if (newZoom > ZOOM_BOUNDARIES[1]) { newZoom = ZOOM_BOUNDARIES[1]; delta = newZoom / currentZoom; }
        if (newZoom < this._minZoom) { newZoom = this._minZoom; delta = newZoom / currentZoom; }
        if (roundForComparison(newZoom) === roundForComparison(currentZoom)) { return; }

        if (!target) {
            target = this.pointAtExternalXY(this.outerWidth / 2, this.outerHeight / 2)
        }

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

