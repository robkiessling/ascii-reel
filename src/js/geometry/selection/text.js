import Cell from "../cell.js";
import RectSelection from "./rect.js";
import {SELECTION_SHAPE_TYPES} from "./constants.js";

/**
 * TextSelection is similar to RectSelection, but it can occupy 0 width. Similar to selecting text in a text editor,
 * when you first mousedown your caret appears as a single line between two characters (no chars are selected yet).
 * As you drag in a particular direction, you will highlight 0 or more characters. To achieve this effect, we can simply
 * subtract 1 from the end column once the user highlights more than 1 cell.
 */
export default class TextSelection extends RectSelection {
    static type = SELECTION_SHAPE_TYPES.TEXT;

    get bottomRight() {
        let maxRow = Math.max(this.start.row, this.end.row);
        let maxCol = Math.max(this.start.col, this.end.col);

        if (this._truncateLastCol()) {
            maxCol -= 1;
        }

        return new Cell(maxRow, maxCol);
    }

    get hasArea() {
        return this.topLeft.col !== this.bottomRight.col + 1;
    }

    // As mentioned in the class definition, the easiest way to allow the user to select between 0 and some number of
    // columns is to truncate the final column of a rect. The only time we don't do this is when highlighting a
    // rect that is more than 1 row tall and only 1 column wide; we don't want it to look like there is a rect with
    // zero width spanning multiple columns.
    _truncateLastCol() {
        return this.start.row === this.end.row || this.start.col !== this.end.col;
    }

    flipHorizontally(flipCol) {
        if (this._truncateLastCol()) {
            // If we truncated the final column, have to add 1 for the flip to work correctly
            this.start.col = flipCol(this.start.col) + 1;
            this.end.col = flipCol(this.end.col) + 1;
        }
        else {
            super.flipHorizontally(flipCol);
        }
    }
}