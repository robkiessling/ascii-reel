import * as actions from "../../io/actions.js";
import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js"
import * as tools from "../tool_controller.js";
import CellCache from "../../geometry/cell_cache.js";
import {MOUSE} from "../../io/mouse.js";
import SelectionRect from "../../geometry/selection/rect.js";
import {shouldModifyAction} from "../../io/actions.js";
import SelectionLine from "../../geometry/selection/line.js";
import SelectionLasso from "../../geometry/selection/lasso.js";
import SelectionWand from "../../geometry/selection/wand.js";
import SelectionText from "../../geometry/selection/text.js";
import Cell from "../../geometry/cell.js";
import {EMPTY_CHAR, WHITESPACE_CHAR} from "../../config/chars.js";
import {translateGlyphs} from "../../utils/arrays.js";

/**
 * Raster selection controller.
 *
 * - Re-exports all raster selection state methods so they are available here.
 * - Adds orchestration (history, events, extra logic) by overriding specific methods.
 * - Other controllers and UI code should always use this controller, not call raster state directly.
 */

export function init() {
    setupEventBus();
    clearCaches();
}

export function selectionShapes() { return state.selection.raster.selectionShapes(); }
export function addSelectionShape(shape) { return state.selection.raster.addSelectionShape(shape); }
export function hasSelection() { return state.selection.raster.hasSelection(); }
export function hasTarget() { return state.selection.raster.hasTarget(); }
function firstSelectionShape() { return selectionShapes().at(0) }
function lastSelectionShape() { return selectionShapes().at(-1) }

export function clear(saveHistory = true) {
    let hasChanges = false;

    if (movableContent()) {
        finishMovingContent();
        hasChanges = true;
    }

    if (hasTarget()) {
        state.selection.clearSelection();
        hasChanges = true;
    }

    if (hasChanges) {
        eventBus.emit(EVENTS.SELECTION.CHANGED);
        if (saveHistory) saveSelectionHistory();
    }
}

export function empty() { return state.selection.raster.empty(); }
export function canSelectAll() { return state.selection.raster.canSelectAll(); }

export function selectAll() {
    if (!canSelectAll()) return;

    // selectAll is only used with a few tools; switch to selection-rect if not using one of those tools already
    if (!['text-editor', 'selection-rect'].includes(state.getConfig('tool'))) {
        tools.changeTool('text-editor', false);
    }

    state.selection.raster.selectAll();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
    saveSelectionHistory();
}

// -------------------------------------------------------------------------------- Selection Results

export function getSelectedValues() { return state.selection.raster.getSelectedValues(); }
export function getSelectedCellArea() { return state.selection.raster.getSelectedCellArea(); }
export function getSelectedRect() { return state.selection.raster.getSelectedRect(); }
export function getSelectedCells() { return state.selection.raster.getSelectedCells(); }
export function getConnectedCells(cell, options) { return state.selection.raster.getConnectedCells(cell, options); }


// -------------------------------------------------------------------------------- Moving Content

export function movableContent() { return state.selection.raster.movableContent(); }

export function toggleMovingContent() {
    movableContent() ? finishMovingContent() : startMovingContent();
}

export function startMovingContent() {
    state.selection.raster.startMovingContent();
    eventBus.emit(EVENTS.REFRESH.ALL);
    saveDistinctHistory();
}

export function finishMovingContent() {
    state.selection.raster.finishMovingContent();

    eventBus.emit(EVENTS.REFRESH.ALL);
    saveDistinctHistory();
}

export function updateMovableContent(char, color) { state.selection.raster.updateMovableContent(char, color); }

// -------------------------------------------------------------------------------- Caret

export function caretCell() { return state.selection.raster.caretCell(); }

export function moveCaretTo(cell, updateOrigin = true, saveHistory = true) {
    if (state.getConfig('tool') !== 'text-editor') {
        console.warn('Can only call moveCaretTo if tool is text-editor')
        return;
    }

    if (movableContent()) { finishMovingContent(); } // Cannot move content and show caret at the same time

    state.selection.raster.moveCaretTo(cell);

    if (updateOrigin) state.selection.raster.updateCaretOrigin(cell);

    eventBus.emit(EVENTS.SELECTION.CHANGED);
    if (saveHistory) saveSelectionHistory();
}


// -------------------------------------------------------------------------------- Translating shapes

function moveDelta(rowDelta, colDelta) {
    if (!hasSelection()) {
        return;
    }

    state.selection.raster.moveDelta(rowDelta, colDelta);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    saveSelectionHistory();
}

/**
 * Shifts the cursor cell and all content to the right of it one space right.
 * @param {boolean} [reverse=false] If true, content will be shifted left
 */
function shiftContent(reverse = false) {
    if (!caretCell()) throw new Error('shiftContent call requires caretCell');

    const row = caretCell().row;
    const colStart = reverse ? caretCell().col - 1 : caretCell().col;
    const colEnd = state.numCols() - 1;

    if (reverse) {
        // Shift all content left
        for (let col = colStart; col <= colEnd; col++) {
            const glyphToRight = col === colEnd ? [EMPTY_CHAR, 0] : state.getCurrentCelGlyph(row, col + 1);
            state.setCurrentCelGlyph(row, col, glyphToRight[0], glyphToRight[1]);
        }

        // Move cursor left
        moveInDirection('left', {
            wrapCaretPosition: false,
            saveHistory: false
        });
    } else {
        // Shift all content right
        for (let col = colEnd; col >= colStart; col--) {
            const glyphToLeft = col === colStart ? [EMPTY_CHAR, 0] : state.getCurrentCelGlyph(row, col - 1);
            state.setCurrentCelGlyph(row, col, glyphToLeft[0], glyphToLeft[1])
        }

        // Move cursor right
        moveInDirection('right', {
            wrapCaretPosition: false,
            saveHistory: false
        });
    }

    eventBus.emit(EVENTS.SELECTION.CHANGED);
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveSelectionTextHistory();
}

/**
 * Move all selection polygons in a particular direction
 * @param {string} direction - Direction to move selection ('left'/'up'/'right'/'down')
 * @param {Object} [options] - move options
 * @param {number} [options.amount=1] - Number of cells to move the selection
 * @param {boolean} [options.updateCaretOrigin=true] - Whether to update the caretOrigin (where carriage return takes you)
 * @param {boolean} [options.wrapCaretPosition=true] - Whether to wrap the caret if it goes out of bounds
 * @param {boolean} [options.saveHistory=true] - Whether to save this selection move to history.
 */
export function moveInDirection(direction, options = {}) {
    const amount = options.amount === undefined ? 1 : options.amount;

    const updateCaretOrigin = options.updateCaretOrigin === undefined ? true : options.updateCaretOrigin;
    const wrapCaretPosition = options.wrapCaretPosition === undefined ? true : options.wrapCaretPosition;
    const saveHistory = options.saveHistory === undefined ? true : options.saveHistory;

    if (!hasTarget()) return;

    if (caretCell()) {
        moveCaretTo(nextCaretPosition(caretCell(), direction, amount, wrapCaretPosition), updateCaretOrigin, saveHistory);
        return;
    }

    state.selection.raster.moveInDirection(direction, amount);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    if (saveHistory) saveSelectionHistory();
}

export function extendInDirection(direction, amount = 1) {
    if (!hasTarget()) return;
    if (movableContent()) return; // Cannot extend while moving content

    state.selection.raster.extendInDirection(direction, amount);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    saveSelectionHistory();
}

function nextCaretPosition(currentPosition, direction, amount, wrapCaretPosition = true) {
    let col = currentPosition.col, row = currentPosition.row;

    switch (direction) {
        case 'left':
            col -= amount;
            break;
        case 'up':
            row -= amount;
            break;
        case 'right':
            col += amount;
            break;
        case 'down':
            row += amount;
            break;
        default:
            console.warn(`Invalid direction: ${direction}`);
    }

    if (wrapCaretPosition) {
        // Wrap around canvas
        if (col >= state.numCols()) {
            col = 0
            row += 1
        }
        if (row >= state.numRows()) {
            row = 0
        }
        if (col < 0) {
            col = state.numCols() - 1
            row -= 1
        }
        if (row < 0) {
            row = state.numRows() - 1
        }
    }
    else {
        if (col >= state.numCols()) col = state.numCols() - 1
        if (row >= state.numRows()) row = state.numRows() - 1
        if (col < 0) col = 0
        if (row < 0) row = 0;
    }

    return new Cell(row, col);
}

export function flipVertically(mirrorChars) {
    state.selection.raster.flipSelection(false, true, mirrorChars);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    saveDistinctHistory();
}
export function flipHorizontally(mirrorChars) {
    state.selection.raster.flipSelection(true, false, mirrorChars);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    saveDistinctHistory();
}



// -------------------------------------------------------------------------------- Keyboard


/**
 * Handles the escape key being pressed.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEscapeKey() {
    if (!hasTarget()) return false;

    clear();
    return true;
}


/**
 * Handles an arrow key being pressed.
 * @param {'left'|'right'|'up'|'down'} direction - Direction of arrow key
 * @param {boolean} shiftKey - Whether the shift key was also down
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleArrowKey(direction, shiftKey) {
    if (!hasTarget()) return false;

    // If holding shift, arrow keys extend the current selection
    if (shiftKey) {
        extendInDirection(direction, 1)
        return true;
    }

    // If in text-editor and there is a selection, jump caret to start/end of the selection area
    if (state.getConfig('tool') === 'text-editor' && !caretCell() && !movableContent()) {
        switch(direction) {
            case 'left':
                moveCaretTo(firstSelectionShape().topLeft);
                break;
            case 'up':
                moveCaretTo(nextCaretPosition(firstSelectionShape().topLeft, 'up', 1, false));
                break;
            case 'right':
                moveCaretTo(nextCaretPosition(firstSelectionShape().bottomRight, 'right', 1, false));
                break;
            case 'down':
                moveCaretTo(nextCaretPosition(firstSelectionShape().bottomLeft, 'down', 1, false));
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
        return true;
    }

    moveInDirection(direction);
    return true;
}

/**
 * Handles the tab key being pressed.
 * @param {boolean} [shiftKey=false] - Whether the shift key is pressed
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleTabKey(shiftKey = false) {
    if (caretCell()) {
        shiftContent(shiftKey);
        return true;
    }

    // TODO if there is a normal area selection, we could shift its contents?
    //      What would the analogous be in vertical direction tho, Enter? But Enter is also used to finalize movableContent.

    return false;
}

/**
 * Handles the enter key being pressed.
 * @param {boolean} [shiftKey=false] - Whether the shift key is pressed
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleEnterKey(shiftKey) {
    if (movableContent()) {
        finishMovingContent();
        return true;
    }
    else if (caretCell()) {
            // 'Enter' key differs from 'ArrowDown' in that the caret will go to the start of the next line (like Excel)
            let col = state.selection.raster.getCaretOriginCol(),
                row = caretCell().row + 1;
            if (row >= state.numRows()) row = 0
            moveCaretTo(new Cell(row, col), true, false);

            // Store a new history snapshot at the start of the new line. This way the caret jumps from end of line ->
            // start of line -> end of prev line -> start of prev line -> etc. In other words, there are 2 jump
            // positions per line.
            saveDistinctHistory();

            return true;
    } else if (hasSelection()) {
        if (shiftKey) {
            // If shift key is pressed, we move in opposite direction
            moveInDirection('up')
        } else {
            moveInDirection('down')
        }
        return true;
    }

    return false;
}

function canHandleCharInput() {
    return movableContent() || caretCell() || hasSelection();
}

/**
 * Handles a keyboard key being pressed.
 * @param {string} char - The char of the pressed keyboard key
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCharKey(char) {
    if (!canHandleCharInput()) return false;

    applyGlyph(char, state.primaryColorIndex());

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveSelectionTextHistory();
    return true;
}

/**
 * Handles the start of a text composition sequence.
 * @param {boolean} rollbackPrevChar - Whether the character typed just before the composition should be rolled back and
 *   included in the composition buffer.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionStart(rollbackPrevChar) {
    if (!canHandleCharInput()) return false;

    if (rollbackPrevChar) {
        moveInDirection('left', { updateCaretOrigin: false, saveHistory: false })
    }

    // Insert a whitespace char. Further handleCompositionUpdate calls will update this char
    // since it updates to the LEFT of cursor
    applyGlyph(WHITESPACE_CHAR, state.primaryColorIndex())

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveSelectionTextHistory();
    return true;
}

/**
 * Handles updates during an active text composition sequence.
 *
 * TODO Making IME compositions will not work. Dead char compositions work because I'm just adding a whitespace char
 *      and then having the updates affect the previous char. But this only works for compositions that are 1 char long.
 *      We should make this work more like the vector version.
 *
 * @param {string} str - The current composition string. Often a single character such as "´" or "é", but can be
 *   longer if the sequence is invalid (e.g. "´x") or if IME composition is used.
 * @param {string} char - The last char of the composition string (useful if logic only supports a single character).
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionUpdate(str, char) {
    if (!canHandleCharInput()) return false;

    if (caretCell()) {
        // Update cell to the left of caret. Do not move caret.
        state.setCurrentCelGlyph(caretCell().row, caretCell().col - 1, char, state.primaryColorIndex());

        // For most cases, this will replace the previous cell's text without moving the caret. However, if `str` contains
        // multiple characters, this will replace the previous and subsequent cells, then move the caret to the end of the
        // inserted text.
        for (let i = 0; i < str.length; i++) {
            state.setCurrentCelGlyph(caretCell().row, caretCell().col - 1 + i, str[i], state.primaryColorIndex());
            if (i > 0) moveInDirection('right', { updateCaretOrigin: false, saveHistory: false })
        }
    } else {
        applyGlyph(char, state.primaryColorIndex())
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveSelectionTextHistory();
    return true;
}

/**
 * Handles the end of a text composition sequence.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleCompositionEnd() {
    return canHandleCharInput();
}

/**
 * Updates the selected area (or caret cell if using the text-editor tool) to be the provided glyph.
 * Does not push history or emit events; it is up to outside function to handle that.
 * @param {string} char - Char of glyph
 * @param {number} color - Color index of glyph
 */
function applyGlyph(char, color) {
    if (movableContent()) {
        // Update entire movable content
        updateMovableContent(char, color);
    } else if (caretCell()) {
        // Update caret cell and then move to next cell
        state.setCurrentCelGlyph(caretCell().row, caretCell().col, char, color);
        moveInDirection('right', { updateCaretOrigin: false, saveHistory: false })
    } else if (hasSelection()) {
        // Update entire selection
        getSelectedCells().forEach(cell => {
            state.setCurrentCelGlyph(cell.row, cell.col, char, color);
        });
    } else {
        throw new Error(`Invalid state: canHandleCharInput() should have prevented this.`)
    }
}

/**
 * Handles the backspace or delete keyboard key being pressed.
 * @param {boolean} [isDelete=false] - True if it was a Delete keypress, false if it was a Backspace keypress.
 * @returns {boolean} - Whether the keyboard event is considered consumed or not
 */
export function handleBackspaceKey(isDelete = false) {
    if (!canHandleCharInput()) return false;

    if (movableContent()) {
        updateMovableContent(EMPTY_CHAR, 0);
    } else if (caretCell()) {
        // Update caret cell and then move to next cell
        if (isDelete) {
            state.setCurrentCelGlyph(caretCell().row, caretCell().col, EMPTY_CHAR, 0);
            moveInDirection('right', { updateCaretOrigin: false, saveHistory: false });
        }
        else {
            moveInDirection('left', { updateCaretOrigin: false, saveHistory: false });
            state.setCurrentCelGlyph(caretCell().row, caretCell().col, EMPTY_CHAR, 0);
        }
    } else if (hasSelection()){
        // Empty entire selection
        empty();
    } else {
        throw new Error(`Invalid state: canHandleCharInput() should have prevented this.`)
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveSelectionTextHistory();
    return true;
}


// --------------------------------------------------------------------------------

// Returns true if the given Cell is part of the selection
export function isSelectedCell(cell) {
    if (caches.selectedCells === undefined) {
        caches.selectedCells = new CellCache();
        getSelectedCells().map(cell => caches.selectedCells.add(cell));
    }

    return caches.selectedCells.has(cell);
}

export function allowMovement(tool, mouseEvent) {
    if (isDrawing) return false;

    // In text-editor tool, holding shift and clicking will modify the polygon instead of move it
    if (tool === 'text-editor' && mouseEvent.shiftKey) return false;

    return true;
}

/**
 * Inserts the glyph content into the canvas.
 * - If the glyph content is a single character, repeat that character across current selection.
 * - Otherwise, paste content relative to topLeft of current selection.
 *
 * @param {{chars: string[][], colors: number[][]}} glyphs - Content to paste
 * @param {boolean} [limitToSelection=false] - If true, pasted text will only be pasted within the current selection bounds
 */
export function insertGlyphs(glyphs, limitToSelection = false) {
    // If there is no selection area, that means there is simply a caret to paste at (this only happens when using the
    // text-editor tool).
    const pasteAtCaret = !hasSelection();

    if (glyphs.chars.length === 1 && glyphs.chars[0].length === 1) {
        // Special case: only one char of text was copied. Apply that char to entire selection
        const char = glyphs.chars[0][0];
        const color = glyphs.colors[0][0];
        const targetCells = pasteAtCaret ? [caretCell()] : getSelectedCells();

        targetCells.forEach(cell => state.setCurrentCelGlyph(cell.row, cell.col, char, color));
    }
    else {
        // Paste glyphs at topLeft of selected area
        const topLeft = pasteAtCaret ? caretCell() : getSelectedCellArea().topLeft;
        translateGlyphs(glyphs, topLeft, (r, c, char, color) => {
            // Copied empty cells do not override existing cells (if you want to override existing cells to make them
            // blank, original copy should have spaces not empty cells)
            if (char === EMPTY_CHAR) return;

            if (!limitToSelection || isSelectedCell({row: r, col: c})) {
                state.setCurrentCelGlyph(r, c, char, color);
            }
        });
    }

    if (caretCell()) {
        moveInDirection('down', {
            amount: glyphs.chars.length - 1,
            updateCaretOrigin: false,
            wrapCaretPosition: false,
            saveHistory: false // History will be saved at the end of this function
        });
        moveInDirection('right', {
            amount: glyphs.chars.at(-1).length,
            updateCaretOrigin: false,
            wrapCaretPosition: false,
            saveHistory: false // History will be saved at the end of this function
        });
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    saveDistinctHistory();
}

// -------------------------------------------------------------------------------- Events

export let isDrawing = false; // Only true when mouse is down and polygon is being drawn
export let isMoving = false; // Only true when mouse is down and polygon is being moved
let caches;

function clearCaches() {
    caches = {};
}

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED], () => {
        clearCaches()
    }, 1) // Higher than default priority because this must happen before other callbacks

    // If we're in the middle of moving content and the user presses undo, it can be jarring. So we always finish the
    // current move and then undo it.
    eventBus.on(EVENTS.HISTORY.BEFORE_CHANGE, () => {
        // if (movableContent()) finishMovingContent()
    })

    let hasMoved;
    let prevCell; // Used to keep track of whether the mousemove is entering a new cell

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvas }) => {
        if (mouseEvent.button !== MOUSE.LEFT) return;

        const tool = state.getConfig('tool')

        switch(tool) {
            case 'selection-rect':
            case 'selection-line':
            case 'selection-lasso':
            case 'selection-wand':
            case 'text-editor':
                break;
            default:
                return; // Ignore all other tools
        }

        prevCell = cell;

        // If user clicks on the selection, we begin the 'moving' process (moving the selection area).
        if (isSelectedCell(cell) && allowMovement(tool, mouseEvent)) {
            isMoving = true;
            hasMoved = false;

            if (mouseEvent.metaKey && !movableContent()) {
                startMovingContent();
                return;
            }

            eventBus.emit(EVENTS.SELECTION.CHANGED);
            saveSelectionHistory();
            return;
        }

        // If user clicks anywhere on the canvas (without the multiple-select key down) we want to clear everything
        // and start a new polygon
        if (!shouldModifyAction('tools.standard.selection.multiple', mouseEvent)) clear();

        if (state.isCellInBounds(cell)) {
            isDrawing = true;

            switch(tool) {
                case 'selection-rect':
                    addSelectionShape(new SelectionRect(cell, undefined, {
                        outline: shouldModifyAction('tools.standard.selection-rect.outline', mouseEvent)
                    }))
                    break;
                case 'selection-line':
                    addSelectionShape(new SelectionLine(cell));
                    break;
                case 'selection-lasso':
                    addSelectionShape(new SelectionLasso(cell));
                    break;
                case 'selection-wand':
                    const wand = new SelectionWand(cell, undefined, {
                        diagonal: shouldModifyAction('tools.standard.selection-wand.diagonal', mouseEvent),
                        charblind: true,
                        colorblind: shouldModifyAction('tools.standard.selection-wand.colorblind', mouseEvent)
                    });
                    wand.complete();
                    addSelectionShape(wand);
                    break;
                case 'text-editor':
                    if (state.getConfig('caretStyle') === 'I-beam') {
                        cell = canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell;
                    }

                    if (!hasTarget()) {
                        moveCaretTo(cell)
                    }
                    else {
                        // This case only happens if there is already a selection and the user holds shift and clicks on a
                        // new cell. We extend the current selection to that cell since that is how editors usually work.
                        firstSelectionShape().end = cell;
                    }
                    break;
            }

            eventBus.emit(EVENTS.SELECTION.CHANGED);
            saveSelectionHistory();
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvas }) => {
        // Special text-editor cell rounding to better mirror a real text editor -- see Cell.caretCell
        if (isDrawing && state.getConfig('tool') === 'text-editor' && state.getConfig('caretStyle') === 'I-beam') {
            cell = canvas.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell;
        }

        const isNewCell = !prevCell || !prevCell.equals(cell);
        if (!isNewCell) return;

        if (isDrawing) {
            lastSelectionShape().end = cell;
            eventBus.emit(EVENTS.SELECTION.CHANGED);
            saveSelectionHistory();
        }
        else if (isMoving) {
            moveDelta(cell.row - prevCell.row, cell.col - prevCell.col);

            // Keep track of whether we've moved to a new cell. Note: moving to a new cell and then moving back
            // will still count as movement (hasMoved:true).
            hasMoved = true;
        }

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ cell }) => {
        const tool = state.getConfig('tool')

        if (isDrawing) {
            lastSelectionShape().complete();
            isDrawing = false;
            eventBus.emit(EVENTS.SELECTION.CHANGED);
            saveSelectionHistory();
        }
        else if (isMoving) {
            isMoving = false;

            // For text-editor, if you click somewhere in the selected area (and we're not trying to move the underlying
            // content or the selected area) it will immediately place the caret into that spot, removing the selection.
            if (tool === 'text-editor' && !movableContent() && !hasMoved) {
                clear();
                moveCaretTo(cell);
            }
            else {
                eventBus.emit(EVENTS.SELECTION.CHANGED)
                if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
                saveSelectionHistory();
            }
        }
    });
}

// -------------------------------------------------------------------------------- Cloning

export function cloneToAllFrames() {
    translateGlyphs(getSelectedValues(), getSelectedCellArea().topLeft, (r, c, char, color) => {
        state.iterateCelsForCurrentLayer(cel => {
            state.setCelGlyph(cel, r, c, char, color);
        })
    });

    eventBus.emit(EVENTS.REFRESH.ALL);
    saveDistinctHistory();
}


// -------------------------------------------------------------------------------- History Management

/**
 * Saves a selection move/resize into history with a modifiable flag. Subsequent movements update this same
 * snapshot instead of creating new ones, so only the final selection position is stored in history.
 */
function saveSelectionHistory() {
    state.pushHistory({ modifiable: 'rasterSelection' });
}

/**
 * Saves a selection change where both movement and text edits are involved. Uses a separate modifiable key so
 * text edits are tracked independently of pure selection movements.
 */
function saveSelectionTextHistory() {
    state.pushHistory({ modifiable: 'rasterSelectionText' });
}

/**
 * Saves an immutable history snapshot of the current selection state. No modifiable flag means it always
 * creates a new slice in time. This is useful for editor states that must remain distinct, e.g. caret
 * position when starting a new line needs to be its own distinct space.
 *
 * Note: This type of history saving is common throughout the app - it is just less common in this raster
 * selection file so I'm giving it its own function.
 */
function saveDistinctHistory() {
    state.pushHistory();
}