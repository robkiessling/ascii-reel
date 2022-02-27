import $ from "jquery";
import * as selection from "./selection.js";
import {frame, translate} from "./index.js";
import {refresh} from "./canvas.js";

let cutCoordinate = null;
let copiedSelection = null;

$(document).keydown(function(e) {
    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter

    // Commands
    if (e.metaKey || e.ctrlKey) {
        switch (char) {
            case 'x':
                cutCoordinate = selection.getSelectionCorners().topLeft;
                copiedSelection = selection.getSelection();
                break;
            case 'c':
                copiedSelection = selection.getSelection();
                break;
            case 'v':
                // Need a copied layout and a current selection (so it knows where to paste)
                if (copiedSelection && selection.hasSelection()) {
                    translate(copiedSelection, selection.getSelectionCorners().topLeft, (value, r, c) => {
                        if (value !== null) { frame[r][c] = value; }
                    })

                    // If cut was used, remove old cut
                    if (cutCoordinate) {
                        translate(copiedSelection, cutCoordinate, (value, r, c) => {
                            if (value !== null) { frame[r][c] = ''; }
                        })
                        cutCoordinate = null;
                    }
                }
                break;
            default:
                return;
        }

        e.preventDefault(); // One of the index.js commands was used, prevent default
        refresh();
        return;
    }

    // Standard keys
    // e.preventDefault();
    // refresh();
});
