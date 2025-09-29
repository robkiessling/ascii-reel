import {setIntervalUsingRAF} from "../utils/utilities.js";
import {numCols, numRows, fontFamily, colorStr} from "../state/index.js";
import {fontHeight, fontWidth} from "../config/font.js";
import PixelRect from "../geometry/pixel_rect.js";
import Cell from "../geometry/cell.js";
import CellArea from "../geometry/cell_area.js";
import {roundForComparison} from "../utils/numbers.js";
import {hoverColor, HOVER_CELL_OPACITY, PRIMARY_COLOR, SELECTION_COLOR, checkerboardColors} from "../config/colors.js";
import {EMPTY_CHAR, WHITESPACE_CHAR, isMonospaceUnsafeChar} from "../config/chars.js";
import Point from "../geometry/point.js";

const WINDOW_BORDER_COLOR = PRIMARY_COLOR;
const WINDOW_BORDER_WIDTH = 3;

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

const ZOOM_DEFAULT = 2; // What to set zoom to during initial load

// Static threshold value limiting how far you can zoom in
const ZOOM_IN_THRESHOLD_VALUE = 30;

// Threshold value limiting how far you can zoom out (actual value depends on length of largest axis)
// E.g. ratio of 1.25 means show 125% more than the largest axis
const ZOOM_OUT_THRESHOLD_RATIO = 1.5;

// Base zoom multiplier per scroll step (e.g., 1.1 = 10% zoom change per unit)
const ZOOM_SCROLL_FACTOR = 1.3;

const ZOOM_BOOST_FACTOR = 3; // How aggressively small zoom values are boosted
const ZOOM_BOOST_THRESHOLD = 10; // Maximum delta where boosting applies


/**
 * Handles all the setup around a <canvas> element, drawing to the canvas, and zooming/translating the canvas view.
 */
export default class Canvas {
    constructor($canvas, options = {}) {
        this.$canvas = $canvas;
        this.options = options;

        this.canvasElement = this.$canvas.get(0);
        this.context = this.canvasElement.getContext("2d", {
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
        // Reset any width/height attributes that may have been set previously
        this.canvasElement.removeAttribute('width');
        this.canvasElement.removeAttribute('height');
        this.canvasElement.style.width = "100%";
        this.canvasElement.style.height = "100%";

        // Fix canvas PPI https://stackoverflow.com/a/65124939
        this._dpr = window.devicePixelRatio;
        this.canvasElement.width = this.outerWidth * this._dpr;
        this.canvasElement.height = this.outerHeight * this._dpr;
        this.canvasElement.style.width = this.outerWidth + "px";
        this.canvasElement.style.height = this.outerHeight + "px";

        if (resetZoom || !this.initialized) {
            this._resetCamera();
            this._buildZoomPanBoundaries(true);
            // Don't need to apply zoom/pan boundaries; assume a camera that has been reset is within bounds
        }
        else {
            this._applyCamera(); // Apply camera with new canvas dimensions
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
            this._withTemporaryContext(() => {
                this.context.fillStyle = color;
                this.context.fillRect(...CellArea.drawableArea().xywh);
            })
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
        this._withTemporaryContext(() => {
            // Note: selection canvas overall opacity is set in css, that way I don't have to care about overlapping opacities
            this.context.fillStyle = SELECTION_COLOR;
            polygons.forEach(polygon => polygon.draw(this.context));
        });
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

    // Draws a caret inside the current cell, a few pixels offset from the left edge. TODO choose this or the next version
    // _toggleCaretIBeam(show, cell, caretColor) {
    //     this._withTemporaryContext(() => {
    //         if (show) {
    //             this.context.strokeStyle = caretColor;
    //             this.context.lineWidth = CARET_I_BEAM_WIDTH;
    //
    //             this.context.beginPath();
    //             cell = cell.clone();
    //             this.context.moveTo(cell.x + OUTLINE_WIDTH + CARET_I_BEAM_WIDTH, cell.y + OUTLINE_WIDTH);
    //             cell.translate(1, 0);
    //             this.context.lineTo(cell.x + OUTLINE_WIDTH + CARET_I_BEAM_WIDTH, cell.y - OUTLINE_WIDTH);
    //             this.context.stroke();
    //         } else {
    //             // Reduce rect size by half an outline width
    //             const innerRect = new PixelRect(cell.x + OUTLINE_WIDTH / 2, cell.y + OUTLINE_WIDTH / 2, cell.width - OUTLINE_WIDTH, cell.height - OUTLINE_WIDTH);
    //             this.context.clearRect(...innerRect.xywh);
    //         }
    //     });
    // }

    // Draws a caret right on the border between the two cells. TODO choose this or the previous version
    _toggleCaretIBeam(show, cell, caretColor) {
        this._withTemporaryContext(() => {
            if (show) {
                this.context.strokeStyle = caretColor;
                this.context.lineWidth = CARET_I_BEAM_WIDTH;

                this.context.beginPath();
                this.context.moveTo(cell.x, cell.y + OUTLINE_WIDTH);
                this.context.lineTo(cell.x, cell.y + cell.height - OUTLINE_WIDTH);
                this.context.stroke();
            } else {
                const epsilon = 1; // Erase a tiny bit more than expected, due to what I assume are tiny floating pt errors
                const innerRect = new PixelRect(
                    cell.x - CARET_I_BEAM_WIDTH / 2 - epsilon,
                    cell.y + OUTLINE_WIDTH - epsilon,
                    CARET_I_BEAM_WIDTH + 2 * epsilon,
                    cell.height - OUTLINE_WIDTH * 2 + 2 * epsilon
                );

                this.context.clearRect(...innerRect.xywh);
            }
        });
    }

    _toggleCaretBlock(show, cell) {
        this._withTemporaryContext(() => {
            if (show) {
                this.context.strokeStyle = CARET_BLOCK_COLOR;
                this.context.fillStyle = CARET_BLOCK_COLOR;
                this.context.lineWidth = CARET_BLOCK_LINE_WIDTH;

                this.context.fillRect(...cell.xywh);
            } else {
                // Clearing a rect that is a little larger than the cell -- for some reason there are sometimes stray pixels
                // right along the cell edge at certain zoom levels
                const outerRect = new PixelRect(cell.x - OUTLINE_WIDTH / 2, cell.y - OUTLINE_WIDTH / 2, cell.width + OUTLINE_WIDTH, cell.height + OUTLINE_WIDTH);
                this.context.clearRect(...outerRect.xywh);
            }
        });
    }

    highlightCell(cell) {
        this._withTemporaryContext(() => {
            this.context.fillStyle = hoverColor;
            this.context.globalAlpha = HOVER_CELL_OPACITY;
            this.context.fillRect(...cell.xywh);
        });
    }

    outlinePolygon(polygon, isDashed) {
        this._withTemporaryContext(() => {
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
        });
    }

    _drawDashedOutline(polygon) {
        this._withTemporaryContext(() => {
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
        });
    }

    drawWindow(rect) {
        this._withTemporaryContext(() => {
            this.context.strokeStyle = WINDOW_BORDER_COLOR;
            const scaledBorder = WINDOW_BORDER_WIDTH / this._camera.zoom;
            this.context.lineWidth = scaledBorder;
            this.context.strokeRect(
                rect.x - scaledBorder / 2, // Need to move the whole window outwards by 50% of the border width
                rect.y - scaledBorder / 2,
                rect.width + scaledBorder,
                rect.height + scaledBorder
            )
        });
    }

    drawGrid(width, spacing, color) {
        if (!spacing) return;

        this._withTemporaryContext(() => {
            this.context.strokeStyle = color;
            this.context.lineWidth = width / this._camera.zoom;

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
        });
    }

    _fillCheckerboard() {
        this._withTemporaryContext(() => {
            // First, draw a checkerboard over full area (checkerboard does not change depending on zoom; this way we have
            // a static number of checkers and performance is consistent).
            this._usingFullArea(fullArea => this._drawCheckerboard(fullArea));

            // Clear the 4 edges between the drawable area and the full area
            const drawableArea = CellArea.drawableArea();
            const topLeft = this.screenToWorld(0, 0);
            const bottomRight = this.screenToWorld(this.outerWidth, this.outerHeight);
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
        });
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


    // Just used for debugging freeform path->char conversions
    drawShapePaths(shapes) {
        shapes.forEach(shape => {
            if (shape.type !== 'freeform') return;

            this._withTemporaryContext(() => {
                const { path } = shape.props;

                if (path.length > 0) {
                    const [first, ...rest] = path;

                    this.context.strokeStyle = 'red';
                    this.context.beginPath();
                    this.context.moveTo(first.x, first.y);
                    for (const point of rest) this.context.lineTo(point.x, point.y);
                    this.context.stroke();

                    this.context.fillStyle = 'red';
                    const RADIUS = 1.5;
                    for (const point of path) {
                        this.context.beginPath();
                        this.context.arc(point.x, point.y, RADIUS, 0, Math.PI * 2);
                        this.context.fill();
                    }
                }
            });
        })
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

    // Runs a callback in a "temporary" context transaction; any context updates will be rolled back upon completion.
    _withTemporaryContext(callback) {
        this.context.save();
        try {
            callback();
        } finally {
            this.context.restore();
        }
    }

    // -------------------------------------------------------------- Camera helpers
    /**
     * Cache camera state (zoom, panX, panY) instead of relying on context.getTransform(). This decouples the camera
     * logic from the canvas context, allowing world/screen conversions (e.g., screenToWorld, worldToScreen) regardless
     * of the current transform.
     *
     * For example, in `inScreenSpace`, we can temporarily reset to the identity transform to draw UI elements while
     * still using the cached camera state for coordinate conversions.
     */

    /**
     * Pans the camera by a given delta. Similar to a call to context.translate(x, y), except:
     * - the translation won't be visible until _applyCamera() is called
     * - since we are panning the camera (not the content), x/y values are inverted from typical context.translate calls
     */
    _panCamera(x, y, ignoreZoom = false) {
        if (ignoreZoom) {
            this._camera.panX += x;
            this._camera.panY += y;
        } else {
            this._camera.panX += x * this._camera.zoom;
            this._camera.panY += y * this._camera.zoom;
        }
    }

    // Similar to context.scale(amount), except scale won't be visible until _applyCamera() is called
    _scaleCamera(amount) {
        this._camera.zoom *= amount;
    }

    // Applies the current camera transform to the canvas context, including zoom and pan, adjusted for devicePixelRatio
    _applyCamera() {
        this.context.setTransform(
            this._camera.zoom * this._dpr,
            0,
            0,
            this._camera.zoom * this._dpr,
            -this._camera.panX * this._dpr,
            -this._camera.panY * this._dpr
        );
    }

    // Resets the camera to default (no pan/zoom) and applies it to the context
    _resetCamera() {
        this._camera = { zoom: 1, panX: 0, panY: 0 };
        this._applyCamera();
    }

    // Returns a PixelRect of the current view window
    currentViewRect() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.outerWidth, this.outerHeight);
        return new PixelRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }

    /**
     * Performs a callback that affects the entire canvas (entire <canvas> element; includes those margins that appear
     * when zoomed all the way out)
     * @param {function(PixelRect)} callback - Callback is passed the full area PixelRect as its parameter
     */
    _usingFullArea(callback) {
        this._withTemporaryCamera(() => {
            this._resetCamera();
            callback(new PixelRect(0, 0, this.outerWidth, this.outerHeight));
        })
    }

    /**
     * Runs the provided callback and then resets the camera/transform to its pre-callback state.
     * @param callback
     * @private
     */
    _withTemporaryCamera(callback) {
        const originalCamera = structuredClone(this._camera);

        callback();

        this._camera = originalCamera;
        this._applyCamera();
    }

    /**
     * Runs the provided callback with the canvas context reset to the identity transform, allowing you to draw in
     * screen space (e.g., fixed-pixel overlays like bounding boxes or anchors that should not scale with zoom).
     *
     * Note: While the transform is reset, the camera state remains unchanged, so you can still use worldToScreen and
     * screenToWorld to convert coordinates based on the current zoom and pan.
     */
    inScreenSpace(callback) {
        this.context.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        callback();
        this._applyCamera();
    }

    /**
     * Converts a point from screen space (pixels) to world space (logical coordinates of the drawing) using the
     * current camera's pan and zoom.
     *
     * This is used to translate mouse input or screen-based positions into world coordinates.
     *
     * @param {number} screenX - The X coordinate in screen pixels
     * @param {number} screenY - The Y coordinate in screen pixels
     * @returns {Point} The corresponding point in world space
     */
    screenToWorld(screenX, screenY) {
        return new Point(
            (screenX + this._camera.panX) / this._camera.zoom,
            (screenY + this._camera.panY) / this._camera.zoom
        )
    }

    /**
     * Converts a point from world space (logical coordinates of the drawing) to screen space (pixels) using the
     * current camera's pan and zoom.
     *
     * This is used to map content positions onto the canvas for rendering or UI overlay alignment.
     *
     * @param {number} worldX - The X coordinate in world space
     * @param {number} worldY - The Y coordinate in world space
     * @returns {Point} The corresponding point in screen space (pixels)
     */
    worldToScreen(worldX, worldY) {
        return new Point(
            worldX * this._camera.zoom - this._camera.panX,
            worldY * this._camera.zoom - this._camera.panY
        )
    }

    /**
     * Returns an {x, y} coordinate of a given pixel relative to the top-left corner of the cell it's in.
     * @param {number} x - The x value of the target pixel
     * @param {number} y - The y value of the target pixel
     * @param {Boolean} [asFraction=true] - If true, the returned x/y coordinates will be a percentage of the cell width/height,
     *   respectively. E.g. if the pixel was in the center of the cell, the returned value would be { x: 0.5, y: 0.5 }.
     * @returns {{x: number, y: number}} - Coordinate of cell pixel
     */
    cellPixelAtScreenXY(x, y, asFraction = true) {
        const point = this.screenToWorld(x, y);

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
            this._withTemporaryCamera(() => {
                this.zoomOutToMax();
                this._panBoundaries = this.currentViewRect();
            })
        }
    }

    // Zooms to a particular zoom level centered around the midpoint of the canvas
    zoomTo(level) {
        // Reset scale
        this._resetCamera();

        // Center around absolute midpoint of drawableArea
        const drawableArea = CellArea.drawableArea();
        const target = {
            x: this.outerWidth / 2 - drawableArea.width * level / 2,
            y: this.outerHeight / 2 - drawableArea.height * level / 2
        }
        this._panCamera(-target.x, -target.y);

        // Scale to desired level
        this._scaleCamera(level);

        this._applyCamera();
    }

    // Zooms out just far enough so that the entire canvas is visible. If the canvas dimensions do not result in a
    // perfect square the smaller dimension will have visible margins.
    zoomToFit() {
        this.zoomTo(this._zoomLevelForFit());
    }

    zoomToDefault() {
        this.zoomTo(ZOOM_DEFAULT);
    }

    // Zooms out as far as possible. Both dimensions will have visible margins (assuming ZOOM_OUT_THRESHOLD_RATIO > 1)
    zoomOutToMax() {
        this.zoomTo(this._zoomOutThreshold);
    }

    canZoomIn() {
        return roundForComparison(this._camera.zoom) < roundForComparison(this._zoomInThreshold)
    }
    canZoomOut() {
        return roundForComparison(this._camera.zoom) > roundForComparison(this._zoomOutThreshold)
    }

    /**
     * Zooms the canvas in or out focused at a particular target
     * @param {number} delta - Controls the magnitude of the zoom. A value > 1 will zoom in, a value < 1 will zoom out.
     * @param {{x: number, y: number}} [target] - Point to zoom towards. If undefined, will zoom in/out relative to
     *   center of the current view.
     */
    zoomDelta(delta, target) {
        let newZoom = this._camera.zoom * delta;

        if (newZoom < this._zoomOutThreshold) { newZoom = this._zoomOutThreshold; delta = newZoom / this._camera.zoom; }
        if (newZoom > this._zoomInThreshold) { newZoom = this._zoomInThreshold; delta = newZoom / this._camera.zoom; }
        if (roundForComparison(newZoom) === roundForComparison(this._camera.zoom)) return;

        // If no target use canvas center
        if (!target) target = this.screenToWorld(this.outerWidth / 2, this.outerHeight / 2);

        // Calculate target screen point (so we have both world and screen coords)
        const { x: screenX, y: screenY } = this.worldToScreen(target.x, target.y);

        // Apply zoom
        this._scaleCamera(delta);

        // Figure out what pan is needed to keep that world point at the same screen point
        this._camera.panX = target.x * this._camera.zoom - screenX;
        this._camera.panY = target.y * this._camera.zoom - screenY;
        this._applyCamera();

        this._applyPanBoundaries();
    }

    // Ensures current zoom level is within boundaries
    _applyZoomBoundaries() {
        this.zoomDelta(1);
    }

    // Moves zoom window to be centered around target
    panToTarget(target) {
        const currentZoom = this._camera.zoom;
        const viewRect = this.currentViewRect();

        this._resetCamera();
        this._panCamera(
            target.x * currentZoom - viewRect.width * currentZoom / 2,
            target.y * currentZoom - viewRect.height * currentZoom / 2
        );
        this._scaleCamera(currentZoom);
        this._applyCamera();

        this._applyPanBoundaries();
    }

    panBy(x, y, ignoreZoom = false) {
        this._panCamera(x, y, ignoreZoom);
        this._applyCamera();

        this._applyPanBoundaries();
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
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.outerWidth, this.outerHeight);

        const rightBoundary = this._panBoundaries.x + this._panBoundaries.width;
        const bottomBoundary = this._panBoundaries.y + this._panBoundaries.height;

        let dx = 0, dy = 0;

        if (topLeft.x < this._panBoundaries.x) dx = this._panBoundaries.x - topLeft.x;
        if (topLeft.y < this._panBoundaries.y) dy = this._panBoundaries.y - topLeft.y;
        if (bottomRight.x > rightBoundary) dx = rightBoundary - bottomRight.x;
        if (bottomRight.y > bottomBoundary) dy = bottomBoundary - bottomRight.y;

        if (dx !== 0 || dy !== 0) {
            this._panCamera(dx, dy);
            this._applyCamera();
        }
    }


    // -------------------------------------------------------------- Event handlers

    _setupMouseEvents() {
        // The following variables are included in mousedown/mousemove/mouseup events:
        let isDragging; // Will be true if mousedown started in the canvas, turns false once mouseup event occurs
        let originalPoint; // Point at mousedown event
        let mouseDownButton; // The mouse button pressed for the mousedown event (1=left, 2=middle, 3=right)

        const runCallback = (callback, evt, includeMouseDownArgs = false) => {
            if (!this.initialized) return;

            // offsetX/offsetY only report correct values when the event target is the canvas. If the mouse is dragging
            // outside the canvas, compute canvas-relative coordinates manually using clientX/clientY and the canvas's
            // bounding rect. The is stored under `mouseCoords` for outside handlers to use.
            const rect = this.canvasElement.getBoundingClientRect();
            const mouseCoords = { 
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };

            // const inCanvas = evt.clientX >= rect.left && evt.clientX <= rect.right &&
            //     evt.clientY >= rect.top && evt.clientY <= rect.bottom;

            const cell = this.screenToWorld(mouseCoords.x, mouseCoords.y).cell;
            const currentPoint = this.screenToWorld(mouseCoords.x, mouseCoords.y);

            const callbackArgs = {evt, cell, currentPoint, mouseCoords/*, inCanvas*/};
            if (includeMouseDownArgs) $.extend(callbackArgs, {isDragging, originalPoint, mouseDownButton})
            callback(callbackArgs);
        }

        if (this.options.onMouseDown || this.options.onMouseMove || this.options.onMouseUp) {
            this.$canvas.on('mousedown', evt => {
                if (isDragging) return; // Ignore multiple mouse buttons being pressed at the same time

                isDragging = true;
                originalPoint = this.screenToWorld(evt.offsetX, evt.offsetY);
                mouseDownButton = evt.button;

                if (this.options.onMouseDown) runCallback(this.options.onMouseDown, evt, true)
            })

            if (this.options.onMouseMove) {
                // Attaching mousemove to document so handlers continue to work even if mouse drags off of the canvas.
                // Most (but not all) handlers will ignore the event unless isDragging is true (i.e. mousedown originated
                // on the canvas and hasn't been released yet).
                $(document).on('mousemove', evt => runCallback(this.options.onMouseMove, evt, true))
            }

            // Attaching mouseup to document so handlers continue to work even if mouse drags off of the canvas.
            // This event will only fire if the mousedown occurred on the canvas due to mouseDownButton comparison
            $(document).on('mouseup', evt => {
                // Ignore multiple mouse buttons being pressed at the same time, and ensure mousedown occurred on canvas.
                if (evt.button !== mouseDownButton) return;

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
                const target = this.screenToWorld(evt.offsetX, evt.offsetY);

                // Adjust pan distance based on the current zoom level. Without this, panning while zoomed in moves too
                // quickly (each screen pixel covers less world space)
                // TODO This no longer seems necessary?
                // const zoom = this._camera.zoom;
                // const panX = deltaX / zoom;
                // const panY = deltaY / zoom;
                const panX = deltaX;
                const panY = deltaY;

                // Convert linear delta amount to a multiplicative zoom factor
                const zoomX = this._zoomFactor(deltaX);
                const zoomY = this._zoomFactor(deltaY);

                this.options.onWheel({ panX, panY, zoomX, zoomY, target, evt })
            });
        }
    }
}
