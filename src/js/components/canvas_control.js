import {setIntervalUsingRAF} from "../utils/utilities.js";
import {numCols, numRows, fontFamily, colorStr} from "../state/index.js";
import {fontHeight, fontWidth} from "../config/font.js";
import Rect from "../geometry/rect.js";
import Cell from "../geometry/cell.js";
import CellArea from "../geometry/cell_area.js";
import {roundForComparison} from "../utils/numbers.js";
import {hoverColor, HOVER_CELL_OPACITY, PRIMARY_COLOR, SELECTION_COLOR, checkerboardColors} from "../config/colors.js";
import {EMPTY_CHAR, WHITESPACE_CHAR, isMonospaceUnsafeChar} from "../config/chars.js";

const WINDOW_BORDER_COLOR = PRIMARY_COLOR;
const WINDOW_BORDER_WIDTH = 4;

const VISIBLE_WHITESPACE_CHAR = '·';
const VISIBLE_WHITESPACE_COLOR = 'rgba(192,192,192,0.5)'
const VISIBLE_WHITESPACE_COLOR_INDEX = -1;

const OUTLINE_WIDTH = 0.5;

const CARET_BLOCK_COLOR = SELECTION_COLOR;
const CARET_BLOCK_LINE_WIDTH = 0.5;
const CARET_I_BEAM_WIDTH = 1;
const CARET_BLINK_CYCLE_DURATION = 800;

const DASH_OUTLINE_LENGTH = 5;
const DASH_OUTLINE_FPS = 60;

const CHECKER_SIZE = 10;
const USE_CHECKERBOARD = true;

// Static threshold value limiting how far you can zoom in
const ZOOM_IN_THRESHOLD_VALUE = 30;

// Threshold value limiting how far you can zoom out (actual value depends on length of largest axis)
// E.g. ratio of 1.25 means show 125% more than the largest axis
const ZOOM_OUT_THRESHOLD_RATIO = 1.25;

// Base zoom multiplier per scroll step (e.g., 1.1 = 10% zoom change per unit)
const ZOOM_SCROLL_FACTOR = 1.3;

const ZOOM_BOOST_FACTOR = 3; // How aggressively small zoom values are boosted
const ZOOM_BOOST_THRESHOLD = 10; // Maximum delta where boosting applies


/**
 * Handles all the setup around a <canvas> element, drawing to the canvas, and zooming/translating the canvas view.
 */
export default class CanvasControl {
    constructor($canvas, options = {}) {
        this.$canvas = $canvas;
        this.options = options;

        this.canvas = this.$canvas.get(0);
        this.context = this.canvas.getContext("2d", {
            willReadFrequently: options.willReadFrequently
        });

        this._setupMouseEvents();
        this._setupWheelEvents();
    }

    /**
     * Resizes the canvas control according to its container boundaries.
     * @param {boolean} [resetZoom=false] - If true, will zoom all the way out. If false, will maintain the zoom/pan
     *   from before the resize (provided there is previous zoom/pan data).
     */
    resize(resetZoom = false) {
        let previousTransform = this.context.getTransform();

        // Reset any width/height attributes that may have been set previously
        this.canvas.removeAttribute('width');
        this.canvas.removeAttribute('height');
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";

        // Fix canvas PPI https://stackoverflow.com/a/65124939
        let ratio = window.devicePixelRatio;
        this.canvas.width = this.outerWidth * ratio;
        this.canvas.height = this.outerHeight * ratio;
        this.canvas.style.width = this.outerWidth + "px";
        this.canvas.style.height = this.outerHeight + "px";

        if (resetZoom || !this.initialized) {
            // Final part of fixing canvas PPI
            this.context.scale(ratio, ratio);

            // Store the base transformation (after fixing PPI). Deltas have to be calculated according to
            // this originalTransform (not the identity matrix)
            this.originalTransform = this.context.getTransform();

            this._buildZoomPanBoundaries(true);
        }
        else {
            // Maintain transform from before
            this.context.setTransform(previousTransform);
            this._buildZoomPanBoundaries(false);
            this._applyZoomBoundaries();
            this._applyPanBoundaries();
        }

        // Set up font
        this.context.font = `${fontHeight}px ${fontFamily()}`;
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';

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
        if (this._caretInterval) { this._caretInterval.stop(); }

        // Clear entire canvas
        this._usingFullArea((fullArea) => {
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

    /**
     * Draws the glyphs content onto the canvas
     * @param {{chars: string[][], colors: number[][]}} glyphs - Content to draw
     * @param {Object} options - Draw options
     * @param {number} [options.opacity] - Opacity level to draw the content at
     * @param {(row: number, col: number) => boolean} [options.mask] - Masking function. If provided, will be called
     *   for every drawn cell. If the function returns false, the cell will not be drawn.
     * @param {boolean} [options.showWhitespace] - If true, WHITESPACE_CHARs will be depicted as VISIBLE_WHITESPACE_CHARs
     */
    drawGlyphs(glyphs, options = {}) {
        if (!glyphs) return; // Glyphs can be null if, for example, all layers are hidden

        let needsRestore = false;
        if (options.opacity !== undefined) {
            this.context.save();
            this.context.globalAlpha = options.opacity;
            needsRestore = true;
        }

        // Group consecutive glyphs with identical styles into text runs, minimizing the number of fillText calls
        const runs = [];
        const rowLength = glyphs.chars.length;
        const colLength = glyphs.chars[0].length;

        for (let row = 0; row < rowLength; row++) {
            let run = null;

            for (let col = 0; col < colLength; col++) {
                let char = glyphs.chars[row][col];
                let colorIndex = glyphs.colors[row][col];
                const prevChar = col === 0 ? undefined : glyphs.chars[row][col - 1];

                if (options.mask && !options.mask(row, col)) char = EMPTY_CHAR;
                if (options.showWhitespace && glyphs.chars[row][col] === WHITESPACE_CHAR) {
                    char = VISIBLE_WHITESPACE_CHAR;
                    colorIndex = VISIBLE_WHITESPACE_COLOR_INDEX;
                }
                if (char === EMPTY_CHAR) char = WHITESPACE_CHAR; // Ensure all chars take up space

                // Under some circumstances, we need to start a new run in the same row:
                // - if the new char has a different color (and it's not just whitespace)
                // - if the previous char has longer width than a normal monospaced char
                if (run && (
                    (colorIndex !== run.colorIndex && char !== WHITESPACE_CHAR) ||
                    (prevChar && isMonospaceUnsafeChar(prevChar))
                )) {
                    runs.push(run);
                    run = null;
                }

                if (!run) run = { row, col, colorIndex: colorIndex, text: '' }

                run.text += char;
            }

            if (run) runs.push(run);
        }
        runs.forEach(run => {
            this.context.fillStyle = run.colorIndex === VISIBLE_WHITESPACE_COLOR_INDEX ?
                VISIBLE_WHITESPACE_COLOR :
                colorStr(run.colorIndex)

            // For y value, increase row by 0.5 so it is centered in cell
            this.context.fillText(run.text, Cell.x(run.col), Cell.y(run.row + 0.5));
        });

        if (needsRestore) this.context.restore();
    }

    highlightPolygons(polygons) {
        // Note: selection canvas overall opacity is set in css, that way I don't have to care about overlapping opacities
        this.context.fillStyle = SELECTION_COLOR;
        polygons.forEach(polygon => polygon.draw(this.context));
    }

    /**
     * Draws a blinking caret at the given cell
     * @param {Cell} cell - Cell to draw caret in
     * @param {string} caretStyle - Either I-beam or block mode. I-beam renders the caret as a skinny blinking I-shaped bar.
     *   block renders the caret as a blinking block the size of the cell.
     * @param {() => string} getCaretColor - Function that returns the color to use for the I-beam caret. The block caret
     *   color is not affected.
     */
    startCaretAnimation(cell, caretStyle, getCaretColor) {
        this._caretInterval = setIntervalUsingRAF(() => {
            this._drawCaret(cell, caretStyle, getCaretColor());
        }, 50, true);
    }

    _drawCaret(cell, caretStyle, caretColor) {
        const now = new Date();

        // If a new cell is being targeted, we want to immediately show the caret
        if (this._caretCell === undefined || !this._caretCell.equals(cell)) {
            this._caretCell = cell;
            this._caretCellStart = now;
        }

        const elapsed = now - this._caretCellStart;
        const showCaret = elapsed % CARET_BLINK_CYCLE_DURATION < CARET_BLINK_CYCLE_DURATION / 2;

        if (caretStyle === 'I-beam') {
            this._toggleCaretIBeam(showCaret, cell, caretColor);
        } else {
            this._toggleCaretBlock(showCaret, cell);
        }
    }

    _toggleCaretIBeam(show, cell, caretColor) {
        if (show) {
            this.context.strokeStyle = caretColor;
            this.context.lineWidth = CARET_I_BEAM_WIDTH;

            this.context.beginPath();
            cell = cell.clone();
            this.context.moveTo(cell.x + OUTLINE_WIDTH + CARET_I_BEAM_WIDTH, cell.y + OUTLINE_WIDTH);
            cell.translate(1, 0);
            this.context.lineTo(cell.x + OUTLINE_WIDTH + CARET_I_BEAM_WIDTH, cell.y - OUTLINE_WIDTH);
            this.context.stroke();
        } else {
            // Reduce rect size by half an outline width
            const innerRect = new Rect(cell.x + OUTLINE_WIDTH / 2, cell.y + OUTLINE_WIDTH / 2, cell.width - OUTLINE_WIDTH, cell.height - OUTLINE_WIDTH);
            this.context.clearRect(...innerRect.xywh);
        }
    }

    _toggleCaretBlock(show, cell) {
        if (show) {
            this.context.strokeStyle = CARET_BLOCK_COLOR;
            this.context.fillStyle = CARET_BLOCK_COLOR;
            this.context.lineWidth = CARET_BLOCK_LINE_WIDTH;

            this.context.fillRect(...cell.xywh);
        } else {
            // Clearing a rect that is a little larger than the cell -- for some reason there are sometimes stray pixels
            // right along the cell edge at certain zoom levels
            const outerRect = new Rect(cell.x - OUTLINE_WIDTH / 2, cell.y - OUTLINE_WIDTH / 2, cell.width + OUTLINE_WIDTH, cell.height + OUTLINE_WIDTH);
            this.context.clearRect(...outerRect.xywh);
        }
    }

    highlightCell(cell) {
        this.context.fillStyle = hoverColor;
        this.context.globalAlpha = HOVER_CELL_OPACITY;
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
        if (!spacing) return;

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
        this._usingFullArea(fullArea => this._drawCheckerboard(fullArea));

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

    _drawCheckerboard(area) {
        const [colorA, colorB] = checkerboardColors();

        // First, fill entire area with checkerboard-A color
        this.context.beginPath();
        this.context.fillStyle = colorA;
        this.context.rect(...area.xywh);
        this.context.fill();

        if (!USE_CHECKERBOARD) return;

        // Then draw many little squares for checkerboard-B color
        this.context.beginPath();
        this.context.fillStyle = colorB;
        let x, y;
        let maxX = roundForComparison(area.x + area.width);
        let maxY = roundForComparison(area.y + area.height);
        let colStartsOnB = false;

        for (x = area.x; roundForComparison(x) < maxX; x += CHECKER_SIZE) {
            let isCheckered = colStartsOnB;
            for (y = area.y; roundForComparison(y) < maxY; y += CHECKER_SIZE) {
                if (isCheckered) this.context.rect(x, y, CHECKER_SIZE, CHECKER_SIZE);
                isCheckered = !isCheckered;
            }
            colStartsOnB = !colStartsOnB;
        }
        this.context.fill();
    }

    // -------------------------------------------------------------- Helpers

    // Can be used to help debug: only logs lines for one canvas control (use this.log instead of console.log)
    log(...args) {
        // ignore all but one canvas:
        if (this.$canvas.attr('id') === 'char-canvas') {
            console.log(...args);
        }

        // alternative: just ignore frame canvases
        // if (this.$canvas.attr('id') !== undefined) {
        //     console.log(this.$canvas.attr('id'), ...args);
        // }
    }


    // -------------------------------------------------------------- Zoom/Pan related methods

    /**
     * Calculates the zoom/pan boundaries.  
     * @param {boolean} zoomOutToMax - If true, canvas will be zoomed all the way out. If false, canvas's current zoom
     *   will be maintained. This option is to increase performance: we have to zoom all the way out anyway to calculate
     *   the boundaries, so if that is the desired zoom state we have an option to leave it zoomed out. 
     */
    _buildZoomPanBoundaries(zoomOutToMax) {
        this._zoomOutThreshold = this._zoomLevelForFit() / ZOOM_OUT_THRESHOLD_RATIO;
        this._zoomInThreshold = ZOOM_IN_THRESHOLD_VALUE;

        // We need to calculate the zoom boundaries by zooming out all the way and snapshotting the view rect.
        // If param zoomOutToMax is false, we don't want the zoom changes to persist so we do it in a temporary context.
        if (zoomOutToMax) {
            this.zoomOutToMax();
            this._panBoundaries = this.currentViewRect();
        }
        else {
            this._inTemporaryContext(() => {
                this.zoomOutToMax();
                this._panBoundaries = this.currentViewRect();
            })
        }
    }

    // Returns a Rect of the current view window
    currentViewRect() {
        const topLeft = this.pointAtExternalXY(0, 0);
        const bottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);
        return new Rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }

    /**
     * Performs a callback that affects the entire canvas (entire <canvas> element; includes those margins that appear
     * when zoomed all the way out)
     * @param {function(Rect)} callback - Callback is passed the full area Rect as its parameter
     */
    _usingFullArea(callback) {
        this._inTemporaryContext(() => {
            // Temporarily transform to original context -> make a Rect with <canvas> boundaries -> transform back
            this.context.setTransform(this.originalTransform);
            callback(new Rect(0, 0, this.outerWidth, this.outerHeight));
        })
    }

    // Performs a callback in a temporary context; any transformations will be undone after callback is finished.
    _inTemporaryContext(callback) {
        const currentTransform = this.context.getTransform();
        callback();
        this.context.setTransform(currentTransform);
    }

    /**
     * Returns the transformed coordinates of an external XY coordinate. "External" means the unmodified x y coordinates
     * of your mouse over the canvas. E.g. hovering over the top left of the canvas would be an external x y of 0 0.
     * The returned value is the transformed x y coordinate, accounting for zoom, pan, etc.
     */
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

    // Getting the caret positioning is slightly different than just getting the corresponding cell; we round the x
    // position up or down, depending on where the user clicks in the cell. This is how real text editors work - if you
    // click on the right half of a character, it will round up to the next character
    caretAtExternalXY(x, y) {
        const point = this.pointAtExternalXY(x, y);
        const row = Math.floor(point.y / fontHeight);
        const col = Math.round(point.x / fontWidth);
        return new Cell(row, col);
    }

    /**
     * Returns an {x, y} coordinate of a given pixel relative to the top-left corner of the cell it's in.
     * @param {number} x - The x value of the target pixel
     * @param {number} y - The y value of the target pixel
     * @param {Boolean} [asFraction=true] - If true, the returned x/y coordinates will be a percentage of the cell width/height,
     *   respectively. E.g. if the pixel was in the center of the cell, the returned value would be { x: 0.5, y: 0.5 }.
     * @returns {{x: number, y: number}} - Coordinate of cell pixel
     */
    cellPixelAtExternalXY(x, y, asFraction = true) {
        const point = this.pointAtExternalXY(x, y);

        const rowY = Math.floor(point.y / fontHeight) * fontHeight;
        const colX = Math.floor(point.x / fontWidth) * fontWidth;

        let relativeX = point.x - colX;
        let relativeY = point.y - rowY;

        if (asFraction) {
            relativeX /= fontWidth;
            relativeY /= fontHeight;
        }

        return { x: relativeX, y: relativeY };
    }

    // Zooms to a particular zoom level centered around the midpoint of the canvas
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

    // Zooms out just far enough so that the entire canvas is visible. If the canvas dimensions do not result in a
    // perfect square the smaller dimension will have visible margins.
    zoomToFit() {
        this.zoomTo(this._zoomLevelForFit());
    }

    // Zooms out as far as possible. Both dimensions will have visible margins (assuming ZOOM_OUT_THRESHOLD_RATIO > 1)
    zoomOutToMax() {
        this.zoomTo(this._zoomOutThreshold);
    }

    canZoomIn() {
        return roundForComparison(this._currentZoom()) < roundForComparison(this._zoomInThreshold)
    }
    canZoomOut() {
        return roundForComparison(this._currentZoom()) > roundForComparison(this._zoomOutThreshold)
    }

    /**
     * Zooms the canvas in or out focused at a particular target
     * @param {number} delta - Controls the magnitude of the zoom. A value > 1 will zoom in, a value < 1 will zoom out.
     * @param {{x: number, y: number}} [target] - Point to zoom towards. If undefined, will zoom in/out relative to
     *   center of the current view.
     */
    zoomDelta(delta, target) {
        const currentZoom = this._currentZoom();
        let newZoom = currentZoom * delta;

        if (newZoom < this._zoomOutThreshold) { newZoom = this._zoomOutThreshold; delta = newZoom / currentZoom; }
        if (newZoom > this._zoomInThreshold) { newZoom = this._zoomInThreshold; delta = newZoom / currentZoom; }
        if (roundForComparison(newZoom) === roundForComparison(currentZoom)) return;

        // If no target use canvas center
        if (!target) target = this.pointAtExternalXY(this.outerWidth / 2, this.outerHeight / 2);

        // Zoom to the mouse target, using a process described here: https://stackoverflow.com/a/5526721
        this.context.translate(target.x, target.y)
        this.context.scale(delta, delta);
        this.context.translate(-target.x, -target.y)

        this._applyPanBoundaries();
    }

    // Ensures current zoom level is within boundaries
    _applyZoomBoundaries() {
        this.zoomDelta(1);
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

        this._applyPanBoundaries();
    }

    translateAmount(x, y) {
        this.context.translate(x, y);
        this._applyPanBoundaries();
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

    // Converts a linear delta value into a multiplicative zoom factor
    _zoomFactor(delta) {
        const abs = Math.abs(delta);
        const sign = Math.sign(delta);

        // Boosts small scroll delta values (typically from trackpads) to make zoom feel responsive.
        // Ensures small deltas are boosted smoothly without exceeding larger deltas.
        if (abs < ZOOM_BOOST_THRESHOLD) {
            // Smooth nonlinear boost curve: stronger near 0, fades out as abs approaches threshold
            delta = sign * (abs + ZOOM_BOOST_FACTOR * Math.pow(1 - abs / ZOOM_BOOST_THRESHOLD, 2));
        }

        // Compute zoom multiplier using exponential scaling for smooth, consistent zoom steps
        return Math.pow(ZOOM_SCROLL_FACTOR, -1 * delta / 100);
    }

    // Lock zoom-out to a set of boundaries
    _applyPanBoundaries() {
        if (this._panBoundaries) {
            const topLeft = this.pointAtExternalXY(0, 0);
            const bottomRight = this.pointAtExternalXY(this.outerWidth, this.outerHeight);

            const rightBoundary = this._panBoundaries.x + this._panBoundaries.width;
            const bottomBoundary = this._panBoundaries.y + this._panBoundaries.height;

            if (topLeft.x < this._panBoundaries.x) this.context.translate(topLeft.x - this._panBoundaries.x, 0);
            if (topLeft.y < this._panBoundaries.y) this.context.translate(0, topLeft.y - this._panBoundaries.y);
            if (bottomRight.x > rightBoundary) this.context.translate(bottomRight.x - rightBoundary, 0);
            if (bottomRight.y > bottomBoundary) this.context.translate(0, bottomRight.y - bottomBoundary);
        }
    }

    // When you call getTransform(), it contains values relative to our originalTransform (which is not necessarily 1,
    // e.g. on a Mac retina screen it is 2). If you want the absolute transform, have to divide by the originalTransform
    _absoluteTransform() {
        const current = this.context.getTransform();
        current.a /= this.originalTransform.a;
        current.d /= this.originalTransform.d;
        current.e /= this.originalTransform.a;
        current.f /= this.originalTransform.d;
        return current;
    }


    // -------------------------------------------------------------- Event handlers

    _setupMouseEvents() {
        // The following variables are included in mousedown/mousemove/mouseup events:
        let isDragging; // Will be true if mousedown started in the canvas, turns false once mouseup event occurs
        let originalPoint; // Point at mousedown event
        let mouseDownButton; // The mouse button pressed for the mousedown event (1=left, 2=middle, 3=right)

        const runCallback = (callback, evt, includeMouseDownArgs = false) => {
            if (!this.initialized) return;
            const cell = this.cellAtExternalXY(evt.offsetX, evt.offsetY);
            const currentPoint = this.pointAtExternalXY(evt.offsetX, evt.offsetY);

            const callbackArgs = {evt, cell, currentPoint};
            if (includeMouseDownArgs) $.extend(callbackArgs, {isDragging, originalPoint, mouseDownButton})
            callback(callbackArgs);
        }

        if (this.options.onMouseDown || this.options.onMouseMove || this.options.onMouseUp) {
            this.$canvas.on('mousedown', evt => {
                if (isDragging) return; // Ignore multiple mouse buttons being pressed at the same time

                isDragging = true;
                originalPoint = this.pointAtExternalXY(evt.offsetX, evt.offsetY);
                mouseDownButton = evt.which;

                if (this.options.onMouseDown) runCallback(this.options.onMouseDown, evt, true)
            })

            if (this.options.onMouseMove) {
                this.$canvas.on('mousemove', evt => runCallback(this.options.onMouseMove, evt, true))
            }

            $(document).on('mouseup', evt => {
                if (evt.which !== mouseDownButton) return; // Ignore multiple mouse buttons being pressed at the same time

                if (this.options.onMouseUp) runCallback(this.options.onMouseUp, evt, true)

                // Clearing mouse variables AFTER callback runs, so callback can tell if mouse was dragging, etc.
                isDragging = false;
                originalPoint = undefined;
                mouseDownButton = undefined;
            })
        }

        if (this.options.onDblClick) this.$canvas.on('dblclick', evt => runCallback(this.options.onDblClick, evt))
        if (this.options.onMouseEnter) this.$canvas.on('mouseenter', evt => runCallback(this.options.onMouseEnter, evt))
        if (this.options.onMouseLeave) this.$canvas.on('mouseleave', evt => runCallback(this.options.onMouseEnter, evt))

        // Prevent standard right click
        this.$canvas.off('contextmenu.canvas').on('contextmenu.canvas', () => false);
    }

    _setupWheelEvents() {
        if (this.options.onWheel) {
            this.$canvas.off('wheel.zoom').on('wheel.zoom', evt => {
                evt.preventDefault();

                let deltaX = evt.originalEvent.deltaX;
                let deltaY = evt.originalEvent.deltaY;
                if (deltaX === 0 && deltaY === 0) return;
                const target = this.pointAtExternalXY(evt.offsetX, evt.offsetY);

                // Adjust pan distance based on the current zoom level. Without this, panning while zoomed in moves too
                // quickly (each screen pixel covers less world space)
                const zoom = this._currentZoom();
                const panX = deltaX / zoom;
                const panY = deltaY / zoom;

                // Convert linear delta amount to a multiplicative zoom factor
                const zoomX = this._zoomFactor(deltaX);
                const zoomY = this._zoomFactor(deltaY);

                this.options.onWheel({ panX, panY, zoomX, zoomY, target, evt })
            });
        }
    }

}

