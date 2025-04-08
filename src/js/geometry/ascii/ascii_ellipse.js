import AsciiPolygon from "./ascii_polygon.js";
import Cell from "../cell.js";
import {create2dArray} from "../../utils/arrays.js";
import CellArea from "../cell_area.js";

/**
 * Handles drawing an ellipse out of ASCII characters.
 */
export default class AsciiEllipse extends AsciiPolygon {
    recalculate() {
        const topLeft = new Cell(Math.min(this.start.row, this.end.row), Math.min(this.start.col, this.end.col));
        const bottomRight = new Cell(Math.max(this.start.row, this.end.row), Math.max(this.start.col, this.end.col));
        const area = new CellArea(topLeft, bottomRight);

        this._glyphs = {
            chars: create2dArray(area.numRows, area.numCols),
            colors: create2dArray(area.numRows, area.numCols)
        }
        this._origin = topLeft;

        const drawGlyph = (row, col) => {
            this._glyphs.chars[row][col] = this.options.pickedChar;
            this._glyphs.colors[row][col] = this.options.colorIndex;
        }

        if (area.numRows <= 2 || area.numCols <= 2) {
            // Ellipse cannot have a hole; just fill entire rectangle
            for (let row = 0; row < area.numRows; row++) {
                for (let col = 0; col < area.numCols; col++) {
                    drawGlyph(row, col);
                }
            }
            return;
        }

        switch (this.options.drawType) {
            case 'current-char-outline':
                drawEllipseSymmetric(area, { filled: false }, drawGlyph)
                break;
            case 'current-char-filled':
                drawEllipseSymmetric(area, { filled: true }, drawGlyph)
                break;
            case 'ascii-outline':
            case 'ascii-filled':
                console.warn('not implemented')
                break;
            default:
                console.warn(`unknown drawType: ${this.options.drawType}`);
        }

        // drawEllipseFuzzy(area, { thickness: 2, filled: false }, drawGlyph)
        // drawEllipseSymmetric(area, { filled: true }, drawGlyph)
    }
}

function getEllipseAttributes(area) {
    const top = 0, left = 0, bottom = area.numRows - 1, right = area.numCols - 1;
    const rx = (right - left) / 2;
    const ry = (bottom - top) / 2;
    const cx = left + rx;
    const cy = top + ry;

    return { top, left, bottom, right, rx, ry, cx, cy };
}

/**
 * Draws an approximate ellipse using a distance-based formula.
 *
 * For each cell in the bounding box, it evaluates the normalized ellipse equation:
 *
 *   ((x - cx) / rx)² + ((y - cy) / ry)² = 1        where cx/cy = x/y coord of the ellipse center,
 *                                                        rx/ry = horizontal/vertical ellipse radius
 *
 * and fills in any point where the result is close enough to 1.0, using a given epsilon.
 *
 * Note: even if the provided thickness option is 1, this may result in outlines that are 0–2 cells thick depending on
 * grid resolution and epsilon.
 *
 * @param {CellArea} area - CellArea representing the bounding box of the ellipse
 * @param {Object} options - Draw options
 * @param {number} [options.thickness=1] - How thick the outline should be
 * @param {boolean} [options.filled=false] - If true, ellipse is filled. If false, only outline is shown.
 * @param {(row: number, col: number) => void} callback - Callback ran for each cell in the ellipse shape
 */
function drawEllipseFuzzy(area, options, callback) {
    const { top, left, bottom, right, rx, ry, cx, cy } = getEllipseAttributes(area);

    const rx2 = rx * rx;
    const ry2 = ry * ry;

    const thickness = options.thickness || 1
    const epsilon = thickness / Math.max(rx, ry); // thinner with bigger ellipses

    for (let row = top; row <= bottom; row++) {
        const dy = row - cy; // Vertical distance from ellipse center; (y - cy) in above formula
        const dy2 = dy * dy; // Vertical distance squared; (y - cy)^2 in above formula
        for (let col = left; col <= right; col++) {
            const dx = col - cx; // Horizontal distance from ellipse center; (x - cx) in above formula
            const dx2 = dx * dx; // Horizontal distance squared; (x - cx)^2 in above formula
            const distance = dx2 / rx2 + dy2 / ry2; // Normalized squared distance from center to point

            if (options.filled) {
                if (distance > (1 + epsilon)) continue;
            }
            else {
                if (Math.abs(distance - 1) > epsilon) continue;
                if (row === cy && col === cx) continue; // Special handler for 3x3 grid; do not fill center
            }

            callback(row, col);
        }
    }
}


/**
 * Draws a precise, 1-cell-thick ellipse outline using the Midpoint Ellipse Algorithm.
 *
 * This method uses symmetry and decision parameters to efficiently plot points around the ellipse without gaps or
 * variation in thickness.
 *
 * See: https://medium.com/@trey.tomes/the-midpoint-ellipse-algorithm-d3c7442866da
 *
 * @param {CellArea} area - CellArea representing the bounding box of the ellipse
 * @param {Object} options - Draw options
 * @param {boolean} [options.filled=false] - If true, ellipse is filled. If false, only outline is shown.
 * @param {(row: number, col: number) => void} callback - Callback ran for each cell in the ellipse shape
 */
function drawEllipseSymmetric(area, options, callback) {
    let { rx, ry, cx, cy } = getEllipseAttributes(area);

    // If the ellipse has an even number of rows/cols, then ry/rx will be a fraction (e.g. 3.5) instead of a whole
    // number. Since we are plotting on discrete 2d array, we need everything to be whole numbers. As a solution, I am
    // flooring the ry/rx and then manually padding the ellipse with an extra row/col to make up the lost halves.
    let xPad = 0, yPad = 0;
    if (!Number.isInteger(rx)) {
        xPad = 1;
        rx = Math.floor(rx);
        cx = Math.floor(cx);
    }
    if (!Number.isInteger(ry)) {
        yPad = 1;
        ry = Math.floor(ry);
        cy = Math.floor(cy);
    }

    // Draw points based on 4-way symmetry.
    // Any x/y padding is added in the positive direction only.
    const drawQuadrants = (x, y) => {
        if (options.filled) {
            for (let xx = cx - x; xx <= cx + x + xPad; xx++) {
                callback(cy + y + yPad, xx);
                callback(cy - y, xx);
            }
        } else {
            callback(cy + y + yPad, cx + x + xPad);
            callback(cy + y + yPad, cx - x       );
            callback(cy - y       , cx + x + xPad);
            callback(cy - y       , cx - x       );
        }
    };
    
    // Cache these values since they will be referred to often
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const two_rx2 = 2 * rx2;
    const two_ry2 = 2 * ry2;

    let x = 0;
    let y = ry;

    // ----- Region 1
    // Region 1 is where the ellipse slope (dy/dx) is > -1 (mostly horizontal movement)

    // Initial decision parameter of region 1
    let p1 = ry2 - (rx2 * ry) + (0.25 * rx2);
    let px = two_ry2 * x;
    let py = two_rx2 * y;

    // Plotting points of region 1
    while (px < py) {
        drawQuadrants(x, y);

        if (p1 < 0) {
            // Midpoint is inside ellipse - move right and stay in same row
            x++;
            px += two_ry2;
            p1 += px + ry2;
        } else {
            // Midpoint is outside ellipse - move right and move down
            x++;
            y--;
            px += two_ry2;
            py -= two_rx2;
            p1 += px - py + ry2;
        }
    }

    // ----- Region 2
    // Region 2 is where slope is < -1 (mostly vertical movement)

    // Initial decision parameter of region 2
    let p2 = (ry2 * ((x + 0.5) * (x + 0.5))) + (rx2 * ((y - 1) * (y - 1))) - (rx2 * ry2);

    // Plotting points of region 2
    while (y >= 0) {
        drawQuadrants(x, y);

        // Checking and updating parameter value based on algorithm
        if (p2 > 0) {
            // Midpoint is outside ellipse - move down and stay in same column
            y--;
            py -= two_rx2;
            p2 += rx2 - py;
        } else {
            // Midpoint is inside ellipse - move down and move right
            y--;
            x++;
            px += two_ry2;
            py -= two_rx2;
            p2 += px - py + rx2;
        }
    }
}
