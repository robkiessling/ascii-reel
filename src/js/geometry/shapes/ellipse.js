import {
    CHAR_PROP,
    COLOR_PROP,
    FILL_OPTIONS,
    FILL_PROP, HANDLES,
    SHAPE_TYPES,
    STROKE_PROPS, TEXT_ALIGN_H_OPTS, TEXT_ALIGN_H_PROP, TEXT_ALIGN_V_OPTS,
    TEXT_ALIGN_V_PROP,
    TEXT_PROP
} from "./constants.js";
import Cell from "../cell.js";
import CellArea from "../cell_area.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import TextLayout from "./text_layout.js";
import BoxShape from "./box_shape.js";

export default class Ellipse extends BoxShape {

    static beginEllipse(startCell, options) {
        const props = {
            topLeft: startCell,
            numRows: 1,
            numCols: 1,
            [STROKE_PROPS[SHAPE_TYPES.ELLIPSE]]: options.drawPreset,
            [FILL_PROP]: options.fill || FILL_OPTIONS.EMPTY,
            [CHAR_PROP]: options.char,
            [COLOR_PROP]: options.colorIndex,
            // [TEXT_PROP]: " Hello World\nI am Merlin, lord of magicke, and I shall rule these lands",
            // [TEXT_ALIGN_V_PROP]: TEXT_ALIGN_V_OPTS.TOP,
            // [TEXT_ALIGN_H_PROP]: TEXT_ALIGN_H_OPTS.LEFT,
            // textPadding: 0
        };

        return new Ellipse(undefined, SHAPE_TYPES.ELLIPSE, props);
    }

    _cacheGeometry() {
        const state = this.props;

        const boundingArea = CellArea.fromOriginAndDimensions(state.topLeft, state.numRows, state.numCols);
        const glyphs = this._initGlyphs(boundingArea);

        const strokeChar = this.props[CHAR_PROP];
        const fillChar = this._fillChar();
        const color = this.props[COLOR_PROP];

        this._setupEllipseRecord();
        if (boundingArea.numRows <= 2 || boundingArea.numCols <= 2) {
            // Avoid drawing an ellipse with a hole; just fill entire rectangle
            boundingArea.iterateRelative((row, col) => this._markOutline(row, col));
        } else {
            this._plotSymmetric(boundingArea);
            // this._plotFuzzy(boundingArea, 1);
        }
        const { outlineCells, fillCells, outlineHitbox, fillHitbox } = this._processEllipseRecord()
        outlineCells.forEach(cell => this._setGlyph(glyphs, cell, strokeChar, color))
        fillCells.forEach(cell => this._setGlyph(glyphs, cell, fillChar, color))

        // const textLayout = this._applyTextLayout(glyphs, boundingArea);

        const emptyBackground = fillChar === EMPTY_CHAR;
        const hitbox = cell => {
            // if (textLayout && textLayout.doesCellOverlap(cell)) return true;
            if (outlineHitbox(cell)) return true
            if (!emptyBackground && fillHitbox(cell)) return true;
            return false;
        };

        this._cache = {
            boundingArea,
            origin: state.topLeft,
            glyphs,
            hitbox,
            // textLayout
        }
    }

    /**
     * Draws a precise, 1-cell-thick ellipse outline using the Midpoint Ellipse Algorithm.
     *
     * This method uses symmetry and decision parameters to efficiently plot points around the ellipse without gaps or
     * variation in thickness.
     *
     * See: https://medium.com/@trey.tomes/the-midpoint-ellipse-algorithm-d3c7442866da
     *  and https://www.gpp7.org.in/wp-content/uploads/sites/22/2020/04/file_5e95c769ba7ed.pdf
     *
     * @param {CellArea} area - CellArea representing the bounding box of the ellipse
     */
    _plotSymmetric(area) {
        let { rx, ry, cx, cy } = this._ellipseAttributes(area);

        // If the ellipse has an even number of rows/cols, then ry & rx will be fractions (e.g. 3.5) instead of whole
        // numbers. Since we are plotting on discrete 2d array, we need everything to be whole numbers. As a solution, I am
        // flooring the ry & rx and then manually padding the ellipse with an extra row/col to make up the lost halves.
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
            for (let xx = cx - x; xx <= cx + x + xPad; xx++) {
                this._markFill(cy + y + yPad, xx);
                this._markFill(cy - y, xx);
            }
            this._markOutline(cy + y + yPad, cx + x + xPad);
            this._markOutline(cy + y + yPad, cx - x);
            this._markOutline(cy - y, cx + x + xPad);
            this._markOutline(cy - y, cx - x);
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

    /**
     * Draws an approximate ellipse using a distance-based formula.
     *
     * For each cell in the bounding box, it evaluates the normalized ellipse equation:
     *
     *   ((x - cx) / rx)² + ((y - cy) / ry)² = 1        where cx/cy = x/y coord of the ellipse center,
     *                                                        rx/ry = horizontal/vertical ellipse radius
     *
     * and fills in any point where the result is close enough to 1.0 using a given epsilon.
     *
     * Note: using a thickness option of 1 does not guarantee the line will be one cell thick all the way around; there
     *       will likely be parts that are 0 or 2 cells thick depending on the grid resolution and ellipse size.
     *
     * @param {CellArea} area - CellArea representing the bounding box of the ellipse
     * @param {number} [thickness=1] - How thick the outline should be
     */
    _plotFuzzy(area, thickness = 1) {
        const { top, left, bottom, right, rx, ry, cx, cy } = this._ellipseAttributes(area);

        const rx2 = rx * rx;
        const ry2 = ry * ry;

        const epsilon = thickness / Math.max(rx, ry); // thinner with bigger ellipses

        for (let row = top; row <= bottom; row++) {
            const dy = row - cy; // Vertical distance from ellipse center; (y - cy) in above formula
            const dy2 = dy * dy; // Vertical distance squared; (y - cy)^2 in above formula
            for (let col = left; col <= right; col++) {
                const dx = col - cx; // Horizontal distance from ellipse center; (x - cx) in above formula
                const dx2 = dx * dx; // Horizontal distance squared; (x - cx)^2 in above formula
                const distance = dx2 / rx2 + dy2 / ry2; // Normalized squared distance from center to point
                const is3x3Center = row === cy && col === cx; // Special handler for 3x3 grid; do not consider center part of outline

                if (distance <= (1 + epsilon)) this._markFill(row, col);
                if (Math.abs(distance - 1) <= epsilon && !is3x3Center) this._markOutline(row, col);
            }
        }
    }


    // ------------------------------------------------------ Ellipse helpers
    
    _ellipseAttributes(area) {
        const top = 0, left = 0, bottom = area.numRows - 1, right = area.numCols - 1;
        const rx = (right - left) / 2;
        const ry = (bottom - top) / 2;
        const cx = left + rx;
        const cy = top + ry;

        return { top, left, bottom, right, rx, ry, cx, cy };
    }

    // We mark the ellipse outline & fill areas separately so we can tell if a cell is on the outline or inner area
    _setupEllipseRecord() {
        this._ellipse = {}
        this._ellipse.outline = new Set();
        this._ellipse.fill = new Set();
    }
    _markOutline(row, col) {
        this._ellipse.outline.add(`${row},${col}`);
    }
    _markFill(row, col) {
        this._ellipse.fill.add(`${row},${col}`);
    }
    _processEllipseRecord() {
        // If there is a point in fill that is also in outline, remove it (outline has priority)
        this._ellipse.fill = new Set([...this._ellipse.fill].filter(x => !this._ellipse.outline.has(x)));

        const pathToCellArray = (path) => {
            return [...path].map(str => {
                const [row, col] = str.split(',').map(Number);
                return { row, col };
            })
        }

        const checkHitbox = (cellSet, absoluteCell) => {
            const relativeCell = absoluteCell.relativeTo(this.props.topLeft);
            return cellSet.has(`${relativeCell.row},${relativeCell.col}`)
        }

        return {
            outlineCells: pathToCellArray(this._ellipse.outline),
            fillCells: pathToCellArray(this._ellipse.fill),
            outlineHitbox: cell => checkHitbox(this._ellipse.outline, cell),
            fillHitbox: cell => checkHitbox(this._ellipse.fill, cell),
        }
    }

    // ------------------------------------------------------ Text

    // _applyTextLayout(glyphs, cellArea) {
    //     if (!this.props[TEXT_PROP]) return null;
    //     if (cellArea.numCols < 3 || cellArea.numRows < 3) return null;
    //
    //     const textLayout = new TextLayout(
    //         this.props[TEXT_PROP],
    //         cellArea,
    //         {
    //             alignH: this.props[TEXT_ALIGN_H_PROP],
    //             alignV: this.props[TEXT_ALIGN_V_PROP],
    //             paddingH: this.props.textPadding + 1, // Add 1 for rect's natural outline
    //             paddingV: this.props.textPadding + 1,
    //         }
    //     )
    //
    //     textLayout.grid.forEach((row, rowIndex) => {
    //         row.forEach((char, colIndex) => {
    //             if (char !== EMPTY_CHAR) {
    //                 this._setGlyph(glyphs, { row: rowIndex, col: colIndex }, char, this.props[COLOR_PROP])
    //             }
    //         })
    //     })
    //
    //     return textLayout;
    // }


}