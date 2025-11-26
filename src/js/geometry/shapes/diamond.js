import {
    AXES,
    CHAR_PROP,
    COLOR_PROP, LINE_PATHING_BUFFER,
    SHAPE_TYPES, STROKE_STYLE_OPTIONS,
    STROKE_STYLE_PROPS
} from "../../config/shapes.js";
import CellArea from "../cell_area.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import BoxShape from "./box_shape.js";
import {registerShape} from "./registry.js";
import Cell from "../cell.js";
import CellCache from "../cell_cache.js";
import {straightAsciiLine} from "./algorithms/traverse_straight.js";

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

        const fillChar = this._fillChar;
        const color = this.props[COLOR_PROP];
        const hasEmptyBackground = fillChar === EMPTY_CHAR;

        const centerRow = Math.floor((boundingArea.bottomRight.row + boundingArea.topLeft.row) / 2)
        const centerCol = Math.floor((boundingArea.bottomRight.col + boundingArea.topLeft.col) / 2)
        const longerAxis = boundingArea.numRows > boundingArea.numCols ? AXES.VERTICAL : AXES.HORIZONTAL;

        const drawOptions = {
            boundingArea, glyphs, strokeHitbox, fillHitbox, fillChar, color, hasEmptyBackground,
            centerRow, centerCol, longerAxis
        };

        this._applyStrokeAndFill(drawOptions);

        const handles = this._buildHandleCollection(boundingArea, cell => {
            // if (textLayout && textLayout.includesCell(cell)) return true;
            return strokeHitbox.has(cell) || fillHitbox.has(cell);
        })

        const bufferArea = boundingArea.outerArea(LINE_PATHING_BUFFER);

        this._cache = {
            boundingArea,
            origin: this.props.topLeft,
            glyphs,
            // textLayout
            handles,
            bufferArea
        }
    }

    _applyStrokeAndFill(drawOptions) {
        const { boundingArea, centerRow, centerCol } = drawOptions;

        // The four vertices of the diamond
        const topCenter = new Cell(boundingArea.topLeft.row, centerCol);
        const centerRight = new Cell(centerRow, boundingArea.bottomRight.col);
        const bottomCenter = new Cell(boundingArea.bottomRight.row, centerCol);
        const centerLeft = new Cell(centerRow, boundingArea.topLeft.col);

        // Draw lines between each of the vertex pairs. The lines are drawn symmetrically (always center to left/right)
        [
            [bottomCenter, centerLeft],
            [bottomCenter, centerRight],
            [topCenter, centerLeft],
            [topCenter, centerRight],
        ].forEach(([fromCell, toCell]) => {
            switch(this._strokeStyle) {
                case STROKE_STYLE_OPTIONS[SHAPE_TYPES.DIAMOND].OUTLINE_ASCII_1:
                    straightAsciiLine(fromCell, toCell, (cell, char) => this._strokeThenFillInward(cell, char, '+', drawOptions))
                    break;
                case STROKE_STYLE_OPTIONS[SHAPE_TYPES.DIAMOND].OUTLINE_MONOCHAR:
                    fromCell.lineTo(toCell, cell => this._strokeThenFillInward(cell, this.props[CHAR_PROP], undefined, drawOptions))
                    break;
            }
        })
    }

    // Applies the stroke char to the given outline cell, then fills inward from that cell to the center line
    _strokeThenFillInward(absCell, char, overlapChar, drawOptions) {
        const {
            boundingArea, glyphs, strokeHitbox, color, hasEmptyBackground, longerAxis, centerRow, centerCol
        } = drawOptions;

        // Apply stroke:
        const relativeCell = absCell.relativeTo(boundingArea.topLeft);
        if (strokeHitbox.has(absCell)) {
            if (overlapChar !== undefined) this._setGlyph(glyphs, relativeCell, overlapChar, color)
        } else {
            this._setGlyph(glyphs, relativeCell, char, color)
            strokeHitbox.add(absCell);
        }

        // Apply fill from stroke to center line:
        if (!hasEmptyBackground) {
            const targetCell = longerAxis === AXES.HORIZONTAL
                ? absCell.clone().translateTo(centerRow, undefined) // Fill vertically towards center row
                : absCell.clone().translateTo(undefined, centerCol); // Fill horizontally towards center col
            this._fillInward(absCell, targetCell, drawOptions);
        }
    }

    _fillInward(fromAbsCell, toAbsCell, drawOptions) {
        const { boundingArea, glyphs, strokeHitbox, color, fillChar, fillHitbox } = drawOptions;

        fromAbsCell.lineTo(toAbsCell, absCell => {
            if (strokeHitbox.has(absCell)) return;
            const relativeCell = absCell.relativeTo(boundingArea.topLeft);
            this._setGlyph(glyphs, relativeCell, fillChar, color)
            fillHitbox.add(absCell);
        }, {
            inclusiveStart: false // can skip start; it is already handled by stroke
        })
    }
}

registerShape(SHAPE_TYPES.DIAMOND, Diamond); // Note: File also has to be manually imported in index.js