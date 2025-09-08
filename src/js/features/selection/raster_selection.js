import * as actions from "../../io/actions.js";
import {eventBus, EVENTS} from "../../events/events.js";
import * as state from "../../state/index.js"
import * as tools from "../tools.js";
import CellCache from "../../geometry/shapes/cell_cache.js";
import {MOUSE} from "../../io/mouse.js";
import SelectionRect from "../../geometry/selection/rect.js";
import {shouldModifyAction} from "../../io/actions.js";
import SelectionLine from "../../geometry/selection/line.js";
import SelectionLasso from "../../geometry/selection/lasso.js";
import SelectionWand from "../../geometry/selection/wand.js";
import SelectionText from "../../geometry/selection/text.js";
import Cell from "../../geometry/cell.js";
import {EMPTY_CHAR} from "../../config/chars.js";
import {translateGlyphs} from "../../utils/arrays.js";


let _isDrawing = false; // Only true when mouse is down and polygon is being drawn
let _isMoving = false; // Only true when mouse is down and polygon is being moved
let caches;

function clearCaches() {
    caches = {};
}

export function isDrawing() {
    return _isDrawing;
}
export function isMoving() {
    return _isMoving;
}

export function init() {
    actions.registerAction('selection.select-all', () => selectAll());

    setupEventBus();

    clearCaches();
}

export function movableContent() {
    return state.getMovableRasterContent();
}
export function selectionShapes() {
    return state.rasterSelectionShapes();
}
function addSelectionShape(shape) {
    state.addRasterSelectionShape(shape);
}
function firstSelectionShape() {
    return state.rasterSelectionShapes().at(0);
}
function lastSelectionShape() {
    return state.rasterSelectionShapes().at(-1);
}
export function hasSelection() {
    return state.hasRasterSelection();
}
export function hasTarget() {
    return state.hasRasterTarget();
}

export function clear(refresh = true) {
    if (movableContent()) { finishMovingContent(); }
    state.clearSelection();
    if (refresh) eventBus.emit(EVENTS.SELECTION.CHANGED);
}

export function empty() {
    state.emptyRasterSelection();
}

export function selectAll() {
    // selectAll is only used with a few tools; switch to selection-rect if not using one of those tools already
    if (!['text-editor', 'selection-rect'].includes(state.getConfig('tool'))) {
        tools.changeTool('text-editor');
    }

    state.selectAllRaster();
    eventBus.emit(EVENTS.SELECTION.CHANGED);
}

// Returns true if the given Cell is part of the selection
export function isSelectedCell(cell) {
    if (caches.selectedCells === undefined) {
        caches.selectedCells = new CellCache();
        getSelectedCells().map(cell => caches.selectedCells.add(cell));
    }

    return caches.selectedCells.has(cell);
}

export function allowMovement(tool, mouseEvent) {
    if (_isDrawing) return false;

    // In text-editor tool, holding shift and clicking will modify the polygon instead of move it
    if (tool === 'text-editor' && mouseEvent.shiftKey) return false;

    return true;
}

export function setSelectionToSingleChar(char, color, moveCaret = true) {
    if (movableContent()) {
        // Update entire movable content
        updateMovableContent(char, color);
    }
    else if (caretCell()) {
        // Update caret cell and then move to next cell
        state.setCurrentCelGlyph(caretCell().row, caretCell().col, char, color);
        if (moveCaret) moveInDirection('right', { updateCaretOrigin: false });
    }
    else if (hasSelection()) {
        // Update entire selection
        getSelectedCells().forEach(cell => {
            state.setCurrentCelGlyph(cell.row, cell.col, char, color);
        });
    }
    else {
        return; // No modifications were made: do not trigger refresh
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'producesText' })
}

// --------------------------------------------------------------------------------

export function getSelectedValues() {
    return state.getSelectedRasterValues();
}

export function getSelectedCellArea() {
    return state.getSelectedRasterCellArea();
}

export function getSelectedRect() {
    return state.getSelectedRasterRect();
}

export function getSelectedCells() {
    return state.getSelectedRasterCells();
}

export function getConnectedCells(cell, options) {
    return state.getConnectedRasterCells(cell, options)
}

// -------------------------------------------------------------------------------- Events

function setupEventBus() {
    eventBus.on([EVENTS.REFRESH.ALL, EVENTS.SELECTION.CHANGED], () => {
        clearCaches()
    }, 1) // Higher than default priority because this must happen before other callbacks

    // If we're in the middle of moving content and the user presses undo, it can be jarring. So we always finish the
    // current move and then undo it.
    eventBus.on(EVENTS.HISTORY.BEFORE_CHANGE, () => {
        if (movableContent()) finishMovingContent()
    })

    let moveStep, hasMoved;
    let prevCell; // Used to keep track of whether the mousemove is entering a new cell

    eventBus.on(EVENTS.CANVAS.MOUSEDOWN, ({ mouseEvent, cell, canvasControl }) => {
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

        // prevCell = undefined;
        prevCell = cell;

        state.endHistoryModification();

        // If user clicks on the selection, we begin the 'moving' process (moving the selection area).
        if (isSelectedCell(cell) && allowMovement(tool, mouseEvent)) {
            _isMoving = true;
            // moveStep = cell;
            hasMoved = false;

            if (mouseEvent.metaKey && !movableContent()) {
                startMovingContent();
                return;
            }

            eventBus.emit(EVENTS.SELECTION.CHANGED);
            return;
        }

        // If user clicks anywhere on the canvas (without the multiple-select key down) we want to clear everything and start a new polygon
        if (!shouldModifyAction('tools.standard.selection.multiple', mouseEvent)) {
            clear();
        }

        if (cell.isInBounds()) {
            _isDrawing = true;

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
                        cell = canvasControl.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell;
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
        }
    });

    eventBus.on(EVENTS.CANVAS.MOUSEMOVE, ({ mouseEvent, cell, canvasControl }) => {
        // TODO This could be more efficient, could just trigger refreshes if cell is different than last?
        const isNewCell = !prevCell || !prevCell.equals(cell);
        if (!isNewCell) return;

        if (_isDrawing) {
            if (state.getConfig('tool') === 'text-editor' && state.getConfig('caretStyle') === 'I-beam') {
                cell = canvasControl.screenToWorld(mouseEvent.offsetX, mouseEvent.offsetY).caretCell;
            }
            lastSelectionShape().end = cell;
            eventBus.emit(EVENTS.SELECTION.CHANGED);
        }
        else if (_isMoving) {
            // moveDelta(cell.row - moveStep.row, cell.col - moveStep.col);
            moveDelta(cell.row - prevCell.row, cell.col - prevCell.col);

            // Keep track of whether we've moved to a new cell. Note: moving to a new cell and then moving back
            // will still count as movement (hasMoved:true).
            // if (!moveStep.equals(cell)) hasMoved = true;
            hasMoved = true;

            // moveStep = cell;
        }

        prevCell = cell;
    });

    eventBus.on(EVENTS.CANVAS.MOUSEUP, ({ cell }) => {
        const tool = state.getConfig('tool')

        if (_isDrawing) {
            lastSelectionShape().complete();
            _isDrawing = false;
            eventBus.emit(EVENTS.SELECTION.CHANGED);
        }
        else if (_isMoving) {
            _isMoving = false;

            // For text-editor, if you click somewhere in the selected area (and we're not trying to move the underlying
            // content or the selected area) it will immediately place the caret into that spot, removing the selection.
            if (tool === 'text-editor' && !movableContent() && !hasMoved) {
                clear();
                moveCaretTo(cell);
            }
            else {
                eventBus.emit(EVENTS.SELECTION.CHANGED)
                if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
            }
        }
    });
}

// --------------------------------------------------------------------------------

export function toggleMovingContent() {
    movableContent() ? finishMovingContent() : startMovingContent();
}

export function startMovingContent() {
    state.startMovingRasterContent();
    eventBus.emit(EVENTS.REFRESH.ALL);
}

export function finishMovingContent() {
    state.finishMovingRasterContent();

    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}

export function updateMovableContent(char, color) {
    state.updateMovableRasterContent(char, color);
}

// --------------------------------------------------------------------------------
let caretOrigin; // Where to move from on return key

export function caretCell() {
    return state.caretCell();
}

export function moveCaretTo(cell, updateOrigin = true) {
    if (state.getConfig('tool') !== 'text-editor') {
        console.warn('Can only call moveCaretTo if tool is text-editor')
        return;
    }

    if (movableContent()) { finishMovingContent(); } // Cannot move content and show caret at the same time

    state.moveCaretTo(cell);

    if (updateOrigin) {
        caretOrigin = cell;

        // Update the current history slice so that if you undo to the slice, the caret will be at the most recent position
        // TODO Figure this out
        // state.modifyHistory(historySlice => historySlice.selection = state.serialize({ history: true }).selection)
    }

    eventBus.emit(EVENTS.SELECTION.CHANGED);
}

export function syncTextEditorCaretPosition() {
    if (state.getConfig('tool') !== 'text-editor') return;

    const cell = state.getCaretPosition();
    console.log(`sync: ${cell}`)
    if (cell) moveCaretTo(cell, false);
}


// -------------------------------------------------------------------------------- Keyboard

export function handleArrowKey(direction, shiftKey) {
    // If holding shift, arrow keys extend the current selection
    if (shiftKey) {
        extendInDirection(direction, 1)
        return;
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
                const right = nextCaretPosition(firstSelectionShape().bottomRight, 'right', 1, false);
                moveCaretTo(nextCaretPosition(right, 'down', 1, false));
                break;
            default:
                console.warn(`Invalid direction: ${direction}`);
        }
        return;
    }

    moveInDirection(direction);
}

export function handleBackspaceKey(isDelete) {
    if (movableContent()) {
        updateMovableContent(EMPTY_CHAR, 0);
    }
    else if (caretCell()) {
        if (isDelete) {
            state.setCurrentCelGlyph(caretCell().row, caretCell().col, EMPTY_CHAR, 0);
            moveInDirection('right', { updateCaretOrigin: false });
        }
        else {
            moveInDirection('left', { updateCaretOrigin: false });
            state.setCurrentCelGlyph(caretCell().row, caretCell().col, EMPTY_CHAR, 0);
        }
    }
    else {
        empty();
    }

    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME);
    state.pushHistory({ modifiable: 'producesText' });
}

export function handleTabKey(shiftKey) {
    if (shiftKey) {
        // If shift key is pressed, we move in opposite direction
        moveInDirection('left', { updateCaretOrigin: false });
    } else {
        moveInDirection('right', { updateCaretOrigin: false })
    }
}

export function handleEnterKey(shiftKey) {
    if (movableContent()) {
        finishMovingContent();
    }
    else {
        if (caretCell()) {
            // Push a state to the history where the caret is at the end of the current line -- that way when
            // you undo, the first undo just jumps back to the previous line with caret at end.
            state.pushHistory();

            // 'Enter' key differs from 'ArrowDown' in that the caret will go to the start of the next line (like Excel)
            let col = caretOrigin.col,
                row = caretCell().row + 1;
            if (row >= state.numRows()) row = 0
            moveCaretTo(new Cell(row, col));
            return;
        }

        if (shiftKey) {
            // If shift key is pressed, we move in opposite direction
            moveInDirection('up')
        } else {
            moveInDirection('down')
        }
    }
}


// -------------------------------------------------------------------------------- Translating/Modifying Polygons

function moveDelta(rowDelta, colDelta) {
    if (!hasSelection()) {
        return;
    }

    state.moveRasterDelta(rowDelta, colDelta);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
}

/**
 * Move all selection polygons in a particular direction
 * @param {string} direction - Direction to move selection ('left'/'up'/'right'/'down')
 * @param {Object} [options={}] - move options
 * @param {number} [options.amount=1] - Number of cells to move the selection
 * @param {boolean} [options.updateCaretOrigin=true] - Whether to update the caretOrigin (where carriage return takes you)
 * @param {boolean} [options.wrapCaretPosition=true] - Whether to wrap the caret if it goes out of bounds
 */
export function moveInDirection(direction, options = {}) {
    const amount = options.amount === undefined ? 1 : options.amount;

    const updateCaretOrigin = options.updateCaretOrigin === undefined ? true : options.updateCaretOrigin;
    const wrapCaretPosition = options.wrapCaretPosition === undefined ? true : options.wrapCaretPosition;

    if (!hasTarget()) return;

    if (caretCell()) {
        moveCaretTo(nextCaretPosition(caretCell(), direction, amount, wrapCaretPosition), updateCaretOrigin);
        return;
    }

    state.moveRasterInDirection(direction, amount);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
}

export function extendInDirection(direction, amount = 1) {
    if (!hasTarget()) return;
    if (movableContent()) return; // Cannot extend while moving content

    state.extendRasterInDirection(direction, amount);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    if (movableContent()) eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
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
    state.flipRasterSelection(false, true, mirrorChars);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    state.pushHistory();
}
export function flipHorizontally(mirrorChars) {
    state.flipRasterSelection(true, false, mirrorChars);

    eventBus.emit(EVENTS.SELECTION.CHANGED)
    eventBus.emit(EVENTS.REFRESH.CURRENT_FRAME)
    state.pushHistory();
}

// -------------------------------------------------------------------------------- Cloning

export function cloneToAllFrames() {
    translateGlyphs(getSelectedValues(), getSelectedCellArea().topLeft, (r, c, char, color) => {
        state.iterateCelsForCurrentLayer(cel => {
            state.setCelGlyph(cel, r, c, char, color);
        })
    });

    eventBus.emit(EVENTS.REFRESH.ALL);
    state.pushHistory();
}
