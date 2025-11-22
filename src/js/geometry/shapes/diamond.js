import {
    AXES,
    CHAR_PROP,
    COLOR_PROP,
    SHAPE_TYPES,
    STROKE_STYLE_PROPS
} from "./constants.js";
import CellArea from "../cell_area.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import BoxShape from "./box_shape.js";
import {registerShape} from "./registry.js";
import Cell from "../cell.js";
import CellCache from "../cell_cache.js";

export default class Diamond extends BoxShape {
    static propDefinitions = [
        ...super.propDefinitions,
        { prop: STROKE_STYLE_PROPS[SHAPE_TYPES.DIAMOND] },
    ];

    _cacheGeometry() {
        const boundingArea = CellArea.fromOriginAndDimensions(this.props.topLeft, this.props.numRows, this.props.numCols);
        const glyphs = this._initGlyphs(boundingArea);
        const strokeHitbox = new CellCache();
        const fillHitbox = new CellCache();

        const strokeChar = this.props[CHAR_PROP];
        const fillChar = this._fillChar;
        const color = this.props[COLOR_PROP];
        const hasEmptyBackground = fillChar === EMPTY_CHAR;

        const centerRow = Math.floor((boundingArea.bottomRight.row + boundingArea.topLeft.row) / 2)
        const centerCol = Math.floor((boundingArea.bottomRight.col + boundingArea.topLeft.col) / 2)
        const longerAxis = boundingArea.numRows > boundingArea.numCols ? AXES.VERTICAL : AXES.HORIZONTAL;

        const topCenter = new Cell(boundingArea.topLeft.row, centerCol);
        const centerRight = new Cell(centerRow, boundingArea.bottomRight.col);
        const bottomCenter = new Cell(boundingArea.bottomRight.row, centerCol);
        const centerLeft = new Cell(centerRow, boundingArea.topLeft.col);

        const strokeThenFillInward = absCell => {
            // Apply stroke:
            const relativeCell = absCell.relativeTo(boundingArea.topLeft);
            this._setGlyph(glyphs, relativeCell, strokeChar, color)
            strokeHitbox.add(absCell);

            // Apply fill from stroke to center line:
            if (!hasEmptyBackground) {
                if (longerAxis === AXES.HORIZONTAL) {
                    // Fill vertically towards center row (either up or down from stroke cell depending on fillDirections)
                    fillInward(absCell, absCell.clone().translateTo(centerRow, undefined))
                } else {
                    // Fill horizontally towards center col (either left or right from stroke cell depending on fillDirections)
                    fillInward(absCell, absCell.clone().translateTo(undefined, centerCol))
                }
            }
        }

        const fillInward = (fromAbsCell, toAbsCell) => {
            const line = fromAbsCell.lineTo(toAbsCell)
            line.shift(); // skip first cell - it is the stroke
            line.forEach(absCell => {
                if (strokeHitbox.has(absCell)) return;
                const relativeCell = absCell.relativeTo(boundingArea.topLeft);
                this._setGlyph(glyphs, relativeCell, fillChar, color)
                fillHitbox.add(absCell);
            })
        }

        topCenter.lineTo(centerLeft).forEach(cell => strokeThenFillInward(cell))
        topCenter.lineTo(centerRight).forEach(cell => strokeThenFillInward(cell))
        bottomCenter.lineTo(centerLeft).forEach(cell => strokeThenFillInward(cell))
        bottomCenter.lineTo(centerRight).forEach(cell => strokeThenFillInward(cell))

        const handles = this._buildHandleCollection(boundingArea, cell => {
            // if (textLayout && textLayout.includesCell(cell)) return true;
            return strokeHitbox.has(cell) || fillHitbox.has(cell);
        })


        this._cache = {
            boundingArea,
            origin: this.props.topLeft,
            glyphs,
            // textLayout
            handles,
        }
    }
}

registerShape(SHAPE_TYPES.DIAMOND, Diamond); // Note: File also has to be manually imported in index.js