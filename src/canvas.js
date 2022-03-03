import $ from "jquery";
import * as selection from "./selection.js";
import {iterate2dArray} from "./utilities.js";
import {updatePreview} from "./preview.js";

const CELL_HEIGHT = 16;
const CELL_WIDTH = 16 * 3/5; // Standard monospace ratio is 3/5

const GRID = true;
const GRID_WIDTH = 0.25;
const GRID_COLOR = '#fff';

const SELECTION_COLOR = '#0066ccaa';
const TEXT_COLOR = '#fff'; // TODO This will be configurable

const $canvasContainer = $('#canvas-container');
const charCanvas = document.getElementById('char-canvas');
const selectionCanvas = document.getElementById('selection-canvas');
selection.bindCanvas($canvasContainer.find('canvas').last()); // Using last element since it is on "top"

let chars;
let zoomHandler;

export function initialize() {
    chars = [[]];
    setupCanvas(charCanvas);
    setupCanvas(selectionCanvas);
    zoomHandler = new ZoomHandler([charCanvas, selectionCanvas]);
}

export function getChar(row, col) {
    return chars[row][col];
}
export function updateChar(row, col, value) {
    chars[row][col] = value;
}

export function loadChars(newChars) {
    chars = newChars;
    zoomHandler.zoom(1);
    refresh();
}

export function refresh(specificCanvas) {
    if (specificCanvas) {
        switch(specificCanvas) {
            case 'chars':
                refreshChars();
                break;
            case 'selection':
                refreshSelection();
                break;
            default:
                console.warn(`refresh("${specificCanvas}") is not a valid canvas`);
        }
    }
    else {
        refreshChars();
        refreshSelection();
    }

    updatePreview(charCanvas);
}

export function setBackgroundColor(color) {
    // Using first element since it is on "bottom"
    $canvasContainer.find('canvas').first().css('background', color);
}

function refreshChars() {
    const context = charCanvas.getContext("2d");

    clearCanvas(charCanvas);

    // Draw all chars using fillText
    iterate2dArray(chars, (value, coord) => {
        context.fillStyle = TEXT_COLOR;
        coord.translate(0.5, 0.5); // Move coord by 50% of a cell, so we can draw char in center of cell
        context.fillText(value, ...coord.xy());
    });

    if (GRID) {
        drawGrid(charCanvas);
    }
}

function refreshSelection() {
    const context = selectionCanvas.getContext("2d");

    clearCanvas(selectionCanvas);

    // Draw all selection rectangles
    selection.getSelectedCoords().forEach(coord => {
        context.fillStyle = SELECTION_COLOR;
        context.fillRect(...coord.xywh());
    });
}

/**
 * Translates a 2d array as if it was positioned at a Coord. The callback value will be null for parts of the array
 * that go out of the frame.
 *
 * @param layout        2d array
 * @param coord         Position to move the top-left Coord of the layout to
 * @param callback      function(value, row, col), where row and col are the coordinates if the layout was moved
 */
export function translate(layout, coord, callback) {
    layout.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            const row = rowIndex + coord.row;
            const col = colIndex + coord.col;
            const inBounds = row >= 0 && row < numRows() && col >= 0 && col < numCols();
            callback(inBounds ? value : null, row, col);
        });
    });
}


function setupCanvas(canvas) {
    const context = canvas.getContext("2d");

    // Fix canvas PPI https://stackoverflow.com/a/65124939/4904996
    let ratio = window.devicePixelRatio;
    canvas.width = outerWidth() * ratio;
    canvas.height = outerHeight() * ratio;
    canvas.style.width = outerWidth() + "px";
    canvas.style.height = outerHeight() + "px";
    context.scale(ratio, ratio);

    // Set up font
    context.font = '1rem monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
}

function clearCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(...Rect.fillScreen().xywh());
}

function drawGrid(canvas) {
    const context = canvas.getContext("2d");
    context.strokeStyle = GRID_COLOR;
    context.lineWidth = GRID_WIDTH;

    iterate2dArray(chars, (value, coord) => {
        // Drawing a box around the cell. Only draw left/top borders for first cells in the row/col
        context.beginPath();
        context.moveTo(...coord.xy());
        coord.col === 0 ? context.lineTo(...coord.translate(1, 0).xy()) : context.moveTo(...coord.translate(1, 0).xy());
        context.lineTo(...coord.translate(0, 1).xy());
        context.lineTo(...coord.translate(-1, 0).xy());
        coord.row === 0 ? context.lineTo(...coord.translate(0, -1).xy()) : context.moveTo(...coord.translate(0, -1).xy())
        context.stroke();
    });
}

function outerWidth() {
    return $canvasContainer.outerWidth();
}
function outerHeight() {
    return $canvasContainer.outerHeight();
}

function numRows() {
    return chars.length;
}
function numCols() {
    return chars[0].length;
}


/**
 *
 */
class ZoomHandler {
    constructor(canvases) {
        this.canvases = canvases;
        this.zoom(1);
    }

    zoom(newValue) {
        if (newValue !== undefined) {
            this._zoom = newValue;
        }

        // Set context scale: Have to factor in device PPI like we did when we built the canvas
        const contextScale = window.devicePixelRatio * this._zoom;
        this.canvases.forEach(canvas => {
            canvas.getContext("2d").setTransform(1, 0, 0, 1, 0, 0); // reset scale
            canvas.getContext("2d").scale(contextScale, contextScale); // scaled to desired amount
        })

        this.origin = new XYCoord(
            this.scale(outerWidth()) / 2 - (numCols() * CELL_WIDTH) / 2,
            this.scale(outerHeight()) / 2 - (numRows() * CELL_HEIGHT) / 2
        );
    }

    scale(value) {
        return value / this._zoom;
    }
}

export class XYCoord {
    constructor(absoluteX, absoluteY) {
        this.absoluteX = absoluteX;
        this.absoluteY = absoluteY;
    }

    static fromExternal(x, y) {
        return new XYCoord(zoomHandler.scale(x), zoomHandler.scale(y));
    }

    get relativeX() {
        return this.absoluteX - zoomHandler.origin.absoluteX;
    }
    get relativeY() {
        return this.absoluteY - zoomHandler.origin.absoluteY;
    }

    toCoord() {
        return new Coord(Math.floor(this.relativeY / CELL_HEIGHT), Math.floor(this.relativeX / CELL_WIDTH))
    }
}

// A class so we can deal with rows/columns, and it handles x/y positioning for us
export class Coord {
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }

    clone() {
        return new Coord(this.row, this.col);
    }

    translate(rowDelta, colDelta) {
        this.row += rowDelta;
        this.col += colDelta;
        return this;
    }

    x() {
        return this.col * CELL_WIDTH + zoomHandler.origin.absoluteX;
    }

    y() {
        return this.row * CELL_HEIGHT + zoomHandler.origin.absoluteY;
    }

    // Used to spread (...) into functions that take (x, y) parameters
    xy() {
        return [this.x(), this.y()];
    }

    // Used to spread (...) into functions that take (x, y, width, height) parameters
    xywh() {
        return [this.x(), this.y(), CELL_WIDTH, CELL_HEIGHT];
    }
}

export class Rect {
    constructor(topLeft, bottomRight) {
        this.topLeft = topLeft; // Coord
        this.bottomRight = bottomRight; // Coord
    }

    static fillScreen() {
        return new Rect(new Coord(0, 0), new Coord(numRows() - 1, numCols() - 1));
    }

    xywh() {
        return [this.topLeft.x(), this.topLeft.y(), this.width() * CELL_WIDTH, this.height() * CELL_HEIGHT];
    }

    clone() {
        return new Rect(this.topLeft.clone(), this.bottomRight.clone());
    }

    height() {
        return this.bottomRight.row - this.topLeft.row + 1;
    }

    width() {
        return this.bottomRight.col - this.topLeft.col + 1;
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
 * A partial is like a Rect, but instead of having topLeft and bottomRight Coords, it has start and end Coords.
 * The start Coord may be to the bottom-right of the end Coord, depending on how the user draws the rectangle.
 * You can still call the helper methods topLeft / bottomRight if you need the absolute end points.
 *
 * Partials have a reference to the frame they are in, allowing them to calculate if they are in bounds
 * TODO Should we remove the reference to frame, and pass it in as an argument?
 */

export class Partial {
    constructor(start, end) {
        this.start = start; // Coord
        this.end = end; // Coord
    }

    static fillScreen() {
        return new Partial(new Coord(0, 0), new Coord(numRows() - 1, numCols() - 1));
    }

    set start(coord) {
        this._start = this._boundCoord(coord);
    }
    get start() {
        return this._start;
    }
    set end(coord) {
        this._end = this._boundCoord(coord);
    }
    get end() {
        return this._end;
    }
    _boundCoord(coord) {
        if (coord.row < 0) { coord.row = 0; }
        if (coord.row > numRows() - 1) { coord.row = numRows() - 1; }
        if (coord.col < 0) { coord.col = 0; }
        if (coord.col > numCols() - 1) { coord.col = numCols() - 1; }
        return coord;
    }

    get topLeft() {
        return new Coord(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
    }

    get bottomRight() {
        return new Coord(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col))
    }

    toRect() {
        return new Rect(this.topLeft, this.bottomRight);
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
