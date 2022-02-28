import * as selection from "./selection.js";
import * as canvas from "./canvas.js";
import {frame, translate} from "./index.js";

let cutCoord = null;
let copiedSelection = null;

export function cut() {
    cutCoord = selection.getSelectionRect().topLeft;
    copiedSelection = selection.getSelection();
}

export function copy() {
    copiedSelection = selection.getSelection();
}

export function paste() {
    // Need a copied selection and a current selection (so it knows where to paste)
    if (copiedSelection && selection.hasSelection()) {
        translate(copiedSelection, selection.getSelectionRect().topLeft, (value, r, c) => {
            if (value !== null) { frame[r][c] = value; }
        });

        // If cut was used, remove old cut
        if (cutCoord) {
            translate(copiedSelection, cutCoord, (value, r, c) => {
                if (value !== null) { frame[r][c] = ''; }
            })
            cutCoord = null;
        }

        canvas.refresh();
    }
}
