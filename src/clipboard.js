import $ from "jquery";
import * as selection from "./selection.js";
import {cells} from "./index.js";

let cutTopLeft = null;
let copiedLayout = null;

$(document).keydown(function(e) {
    const code = e.which // Keycodes https://keycode.info/ e.g. 37 38
    const char = e.key; // The resulting character: e.g. a A 1 ? Control Alt Shift Meta Enter

    // Commands
    if (e.metaKey || e.ctrlKey) {
        switch (char) {
            case 'x':
                cutTopLeft = selection.getLayoutCorners().topLeft;
                copiedLayout = selection.getSelectionLayout((cell, r, c) => cell.html());
                break;
            case 'c':
                copiedLayout = selection.getSelectionLayout((cell, r, c) => cell.html());
                break;
            case 'v':
                // Need a copied layout and a current selection (so it knows where to paste)
                if (copiedLayout && selection.hasSelection()) {
                    selection.applyLayoutAtPoint(copiedLayout, selection.getLayoutCorners().topLeft, (value, r, c) => {
                        if (value !== null) { cells[r][c].html(value); }
                    });

                    // If cut was used, remove old cut
                    if (cutTopLeft) {
                        selection.applyLayoutAtPoint(copiedLayout, cutTopLeft, (value, r, c) => {
                            if (value !== null) { cells[r][c].html(''); }
                        });
                        cutTopLeft = null;
                    }
                }
                break;
            default:
                return;
        }

        e.preventDefault(); // One of the index.js commands was used, prevent default
        return;
    }

    // e.preventDefault();
    // repaint();
});
