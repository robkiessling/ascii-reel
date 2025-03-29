import * as selection from "../canvas/selection.js";
import {triggerRefresh, triggerResize} from "../index.js";
import * as actions from "../io/actions.js";
import * as palette from "../components/palette.js";
import * as editor from "../components/editor.js";
import Color from "@sphinxxxx/color-conversion";
import {calculateFontRatio} from "../canvas/font.js";
import {resetState, saveState} from "./local_storage.js";
import ArrayRange, {create2dArray, split1DArrayInto2D, translateGlyphs} from "../utils/arrays.js";
import {DEFAULT_COLOR} from "../components/palette.js";
import Cell from "../geometry/cell.js";
import {moveCursorTo} from "../canvas/selection.js";
import {mod} from "../utils/numbers.js";
import {getFormattedDateTime} from "../utils/strings.js";
import {isPickerCanceledError, saveCorruptedState} from "./file_system.js";
import {recalculateBGColors} from "../canvas/background.js";
import {toggleStandard} from "../io/keyboard.js";
import pako from 'pako';
import {transformValues} from "../utils/objects.js";

// Note: If you want a CONFIG key to be saved to history (for undo/redo purposes), you need to include it
// in the CONFIG_KEYS_FOR_HISTORY constant below
export const CONFIG_DEFAULTS = {
    name: '',
    createdAt: undefined,
    dimensions: [30, 15], // [numCols, numRows]
    font: 'monospace',
    background: false,
    fps: 6,
    grid: {
        show: true,
        minorGridEnabled: true,
        minorGridSpacing: 1,
        majorGridEnabled: true,
        majorGridSpacing: 5,
    },
    whitespace: false,
    onion: false,
    lockLayerVisibility: true,
    layerIndex: 0,
    frameIndex: 0,
    frameOrientation: 'left',
    frameRangeSelection: null, // A value of null means the range will match the currently selected frameIndex
    minimizedComponents: {
        layers: true
    },
    tool: 'draw-freeform-ascii',
    primaryColor: DEFAULT_COLOR,
    brush: {
        shape: 'square',
        size: 1
    },
    drawRect: {
        type: 'printable-ascii-1'
    },
    drawLine: {
        type: 'basic'
    },
    lastExportOptions: {},
    cursorPosition: {},
}

// By default, config keys are not saved to the history because most config settings should not be altered when the
// user does undo/redo. However, some config settings need to be able to be undone; those are whitelisted here:
// TODO Maybe split config into config/tools or something
const CONFIG_KEYS_FOR_HISTORY = new Set([
    'font', 'dimensions', 'background', 'frameIndex', 'layerIndex', 'frameRangeSelection', 'cursorPosition'
])


const LAYER_DEFAULTS = {
    name: 'Layer',
    visible: true
}
const FRAME_DEFAULTS = {}
const CELL_DEFAULTS = {
    chars: [[]],
    colors: [[]]
}
const CREATE_SEQUENCES_FOR = ['layers', 'frames'];

export const COLOR_FORMAT = 'hex'; // vanilla-picker format we ues to store colors

const MAX_HISTORY = 30; // Max number of states to remember in the history. Increasing this value will use more memory.



export function init() {
    actions.registerAction('state.undo', {
        callback: () => undo(),
        enabled: () => canUndo(),
    });

    actions.registerAction('state.redo', {
        callback: () => redo(),
        enabled: () => canRedo(),
    });
}


// -------------------------------------------------------------------------------- Loading

let state = {};
let sequences = {};

export function newState(overrides) {
    return load($.extend(true, {
        layers: [{ id: 1, name: 'Layer 1' }],
        frames: [{ id: 1 }],
        cels: { [getCelId(1, 1)]: {} }
    }, overrides));
}

/**
 * Loads the given data. If data cannot be loaded will show an error message to user
 *
 * @param {Object} data State data to load
 * @returns {boolean} Returns true if the load was successful, false if not
 */
export function load(data) {
    try {
        resetHistory();

        state = {
            config: $.extend(true, {}, CONFIG_DEFAULTS, { createdAt: new Date().toISOString() }, data.config),
            layers: (data.layers || []).map(layer => $.extend(true, {}, LAYER_DEFAULTS, layer)),
            frames: (data.frames || []).map(frame => $.extend(true, {}, FRAME_DEFAULTS, frame)),
            colorTable: data.colorTable ? [...data.colorTable] : []
        };

        // This has to be done after building the state object above because normalizeCel depends on state.config.dimensions
        state.cels = transformValues(data.cels || {}, (celId, cel) => normalizeCel(cel));

        validateCelState();
        initSequences();
        ensureRequiredState();

        importPalette(data.palette ? data.palette : { colors: palette.DEFAULT_PALETTE }, true);
        vacuumColorTable();

        calculateFontRatio();
        recalculateBGColors();
        triggerResize({ clearSelection: true, resetZoom: true });
        pushStateToHistory(); // Note: Does not need requiresResize:true since there is no previous history state
        saveState();
        
        return true;
    } catch (error) {
        console.error("Failed to load state:", error.message);
        console.error("Stack trace:\n", error.stack);
        onLoadError(data);
        return false;
    }
}

// Ensures all the cels referenced by frames/layers exist, and prunes any unused cels.
// This should only be needed if the file was manually modified outside the app.
function validateCelState() {
    const usedCelIds = new Set();
    state.frames.forEach(frame => {
        state.layers.forEach(layer => {
            const celId = getCelId(layer.id, frame.id);
            if (cel(layer, frame)) {
                usedCelIds.add(celId)
            } else {
                console.warn(`No cel found for (${celId}) -- inserting blank cel`)
                createCel(layer, frame);
            }
        })
    })
    for (const [celId, cel] of Object.entries(state.cels)) {
        if (!usedCelIds.has(celId)) {
            console.warn(`Cel (${celId}) is unused in frames/layers -- deleting cel`)
            delete state.cels[celId];
        }
    }
}

// Init sequences according to the highest current id
function initSequences() {
    sequences = CREATE_SEQUENCES_FOR.reduce((obj, stateKey) => {
        obj[stateKey] = Math.max(...state[stateKey].map(e => e.id), 0);
        return obj;
    }, {})
}

// Ensure at least 1 frame and 1 layer
function ensureRequiredState() {
    if (state.layers.length === 0) createLayer(0);
    if (state.frames.length === 0) createFrame(0);
}


// -------------------------------------------------------------------------------- Serialization Support

// LocalStorage does not currently need any modifications, it will just stringify the entire state
export function stateForLocalStorage() {
    return state;
}
export function replaceState(newState) {
    state = newState;
}

const CURRENT_DISK_VERSION = 2;

/**
 * Compresses the chars & colors arrays of every cel to minimize file size.
 *
 * Storing the chars/colors 2d arrays as-is is quite inefficient in JSON (the array is converted to a string, where every
 * comma and/or quotation mark uses 1 byte). Instead, we use pako to store these 2d arrays as compressed Base64 strings.
 *
 * @returns {Object}
 */
export function stateForDiskStorage() {
    const diskState = {
        version: CURRENT_DISK_VERSION
    };

    vacuumColorTable();
    const req16BitColors = state.colorTable.length > 0xFF;

    for (const [stateKey, stateValue] of Object.entries(state)) {
        switch (stateKey) {
            case 'cels':
                diskState[stateKey] = transformValues(stateValue, (celId, cel) => {
                    return {
                        chars: encodeChars(cel.chars),
                        colors: encodeColors(cel.colors, req16BitColors),
                    }
                })
                break;
            default:
                diskState[stateKey] = stateValue; // shallow copy
        }
    }

    return diskState;
}

/**
 * Reads the disk file, converting each cel's compressed chars/colors back into arrays.
 * 
 * Also handles migrating older files to the current format, in case the webapp's code has changed since the file was saved.
 * 
 * @returns {Object}
 */
export function loadFromDisk(diskState, fileName) {
    const newState = {};

    // State migrations (list will grow longer as more migrations are added):
    if (diskState.version === 1) migrateToV2(diskState)

    const celRowLength = diskState.config.dimensions[0];
    const req16BitColors = diskState.colorTable.length > 0xFF;

    for (const [stateKey, stateValue] of Object.entries(diskState)) {
        switch (stateKey) {
            case 'cels':
                newState[stateKey] = transformValues(stateValue, (celId, cel) => {
                    return {
                        chars: decodeChars(cel.chars, celRowLength),
                        colors: decodeColors(cel.colors, celRowLength, req16BitColors),
                    }
                })
                break;
            default:
                newState[stateKey] = stateValue; // shallow copy
        }
    }

    // Always prefer the file's name over the name property stored in the json.
    diskState.config.name = fileName;

    return load(newState);
}


function migrateToV2(diskState) {
    // version 1 stored cel ids as `f-1,l-2`, version 2 stores them as `F-1,L-2`
    diskState.cels = Object.fromEntries(
        Object.entries(diskState.cels).map(([k, v]) => {
            const match = k.match(/f-(\d+),l-(\d+)/)
            const frameId = parseInt(match[1])
            const layerId = parseInt(match[2])
            return [`F-${frameId},L-${layerId}`, v]
        })
    )
}

/**
 * Encode a 2d chars array into a compressed Base64 string.
 * @param {Array} chars 2d array of chars. The empty string "" is a valid char.
 * @returns {string} Base 64 string representing the compressed 2d array
 */
function encodeChars(chars) {
    const flatStr = chars.flat().map(char => char === "" ? "\0" : char).join(''); // convert to flat string
    const compressed = pako.deflate(flatStr); // convert to compressed Uint8Array
    return window.btoa(String.fromCharCode(...compressed)); // convert to Base64 string

    // todo does spread operator cap out at 10000 elements? maybe use TextDecoder? https://github.com/nodeca/pako/issues/206#issuecomment-1835315482
    //      or https://stackoverflow.com/a/66046176/4904996
}

/**
 * Decodes a compressed Base64 string into a 2d chars array
 * @param base64String Base 64 string representing the compressed 2d array (from encodeChars function)
 * @param {Number} rowLength How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @returns {Array} 2d array of chars
 */
function decodeChars(base64String, rowLength) {
    const compressed = Uint8Array.from(window.atob(base64String), c => c.charCodeAt(0)); // convert to compressed Uint8Array
    const flatStr = pako.inflate(compressed, {to: 'string'}) // convert to uncompressed flat string
    return split1DArrayInto2D(flatStr.split('').map(char => char === "\0" ? "" : char), rowLength) // convert to 2d chars array
}

/**
 * Encode a 2d colors array into a compressed Base64 string.
 * @param {Array} colors 2d array of color integers
 * @param {Boolean} has16BitNumbers If your colors array contains integers greater than 255 you must set this param
 *   to be true, otherwise they won't be encoded correctly
 * @returns {string} Base 64 string representing the compressed 2d array
 */
function encodeColors(colors, has16BitNumbers) {
    let uncompressed;
    const flatColors = colors.flat();

    // Convert to Uint8Array typed array for compression
    if (has16BitNumbers) {
        // pako only supports Uint8Array, so if there are 16-bit numbers we need to split each 16-bit number into 2 bytes
        uncompressed = new Uint8Array(flatColors.length * 2);
        for (let i = 0; i < flatColors.length; i++) {
            uncompressed[i * 2] = (flatColors[i] >> 8) & 0xFF; // Most significant byte
            uncompressed[i * 2 + 1] = flatColors[i] & 0xFF;    // Least significant byte
        }
    }
    else {
        uncompressed = new Uint8Array(flatColors)
    }

    const compressed = pako.deflate(uncompressed); // convert to compressed Uint8Array
    return btoa(String.fromCharCode(...compressed)); // Convert to Base64 string for json
}

/**
 * Decodes a compressed Base64 string into a 2d colors array
 * @param base64String Base 64 string representing the compressed 2d array (from encodeColors function)
 * @param {Number} rowLength How many columns are in a row (this is needed to convert the decoded flat array into a 2d array)
 * @param {Boolean} has16BitNumbers If the encoded colors array contains integers greater than 255, you must set this param
 *   to be true, otherwise they won't be decoded correctly
 * @returns {Array} 2d array of color integers
 */
function decodeColors(base64String, rowLength, has16BitNumbers) {
    const compressed = Uint8Array.from(atob(base64String), c => c.charCodeAt(0)); // Base64 string -> compressed Uint8Array
    const uncompressed = pako.inflate(compressed); // convert to uncompressed Uint8Array

    let flatColors;
    if (has16BitNumbers) {
        // Convert pairs of two consecutive bytes back into one 16-bit number
        flatColors = [];
        for (let i = 0; i < uncompressed.length; i += 2) {
            flatColors.push((uncompressed[i] << 8) | uncompressed[i + 1]);
        }
    }
    else {
        flatColors = Array.from(uncompressed); // Convert to array of 8-bit numbers
    }

    return split1DArrayInto2D(flatColors, rowLength)
}



// -------------------------------------------------------------------------------- General Config

export function numRows() {
    return state.config.dimensions[1];
}
export function numCols() {
    return state.config.dimensions[0];
}

export function config(key, newValue) {
    if (newValue !== undefined) { state.config[key] = newValue; }
    return state.config && state.config[key];
}

export function getName(includeDefaultTimestamp = true) {
    if (config('name')) return config('name');

    if (includeDefaultTimestamp) {
        let name = 'Untitled';
        let createdAt = new Date(config('createdAt'));
        if (isNaN(createdAt.getTime())) createdAt = new Date();
        name += `-${getFormattedDateTime(createdAt)}`;
        return name;
    }
    else {
        return 'Untitled Animation'
    }
}

// TODO would be better if this was smarter - what I really want is a way to detect if there are changes that require saving
export function hasCharContent() {
    return Object.values(state.cels).some(cel => {
        return cel.chars.some(row => row.some(char => char !== '' && char !== ' '));
    })
}


// -------------------------------------------------------------------------------- Layers

export function layers() {
    return state.layers;
}

export function layerIndex(newIndex) {
    return config('layerIndex', newIndex);
}

export function currentLayer() {
    return state.layers[layerIndex()];
}

export function createLayer(index, data) {
    const layer = $.extend({}, LAYER_DEFAULTS, {
        id: ++sequences.layers,
        name: `Layer ${state.layers.length + 1}`
    }, data);

    state.layers.splice(index, 0, layer);

    // create blank cels for all frames
    state.frames.forEach(frame => createCel(layer, frame));
}

export function deleteLayer(index) {
    const layer = state.layers[index];
    celIdsForLayer(layer).forEach(celId => delete state.cels[celId]);
    state.layers.splice(index, 1);
}

export function updateLayer(layer, updates) {
    $.extend(layer, updates);
}

export function reorderLayer(oldIndex, newIndex) {
    state.layers.splice(newIndex, 0, state.layers.splice(oldIndex, 1)[0]);
}

export function toggleLayerVisibility(layer) {
    layer.visible = !layer.visible;
}

function celIdsForLayer(layer) {
    return state.frames.map(frame => getCelId(layer.id, frame.id));
}

export function isMinimized(componentKey) {
    return !!(config('minimizedComponents') || {})[componentKey];
}

// -------------------------------------------------------------------------------- Frames

export function frames() {
    return state.frames;
}

export function frameIndex(newIndex) {
    return config('frameIndex', newIndex);
}

/**
 * Gets and/or sets the frameRangeSelection.
 * @param {ArrayRange|null} [newRange] A value of null means the frameRangeSelection will match the currently selected frameIndex().
 * @returns {ArrayRange}
 */
export function frameRangeSelection(newRange) {
    if (newRange !== undefined) {
        config('frameRangeSelection', newRange ? newRange.serialize() : null)
    }

    const serializedRange = config('frameRangeSelection');
    return serializedRange ? ArrayRange.deserialize(serializedRange) : ArrayRange.fromSingleIndex(frameIndex());
}

export function extendFrameRangeSelection(index) {
    frameRangeSelection(frameRangeSelection().extendTo(index));
}

export function currentFrame() {
    return state.frames[frameIndex()];
}

export function previousFrame() {
    let index = frameIndex();
    index -= 1;
    if (index < 0) { index = frames().length - 1; }
    return state.frames[index];
}

export function createFrame(index, data) {
    const frame = $.extend({}, FRAME_DEFAULTS, {
        id: ++sequences.frames
    }, data);

    state.frames.splice(index, 0, frame);

    // create blank cels for all layers
    state.layers.forEach(layer => createCel(layer, frame));
}

export function duplicateFrame(index) {
    const originalFrame = state.frames[index];
    const newFrame = $.extend({}, originalFrame, {
        id: ++sequences.frames
    });

    state.frames.splice(index, 0, newFrame);

    state.layers.forEach(layer => {
        const originalCel = cel(layer, originalFrame);
        createCel(layer, newFrame, originalCel);
    });
}

export function duplicateFrames(range) {
    const newFrames = [];
    range.iterate(frameIndex => {
        const originalFrame = state.frames[frameIndex];
        const newFrame = $.extend({}, originalFrame, {
            id: ++sequences.frames
        });
        newFrames.push(newFrame);
        state.layers.forEach(layer => {
            const originalCel = cel(layer, originalFrame);
            createCel(layer, newFrame, originalCel);
        });
    });
    state.frames.splice(range.startIndex, 0, ...newFrames);
}

export function deleteFrames(range) {
    range.iterate(frameIndex => {
        celIdsForFrame(state.frames[frameIndex]).forEach(celId => delete state.cels[celId]);
    });
    state.frames.splice(range.startIndex, range.length);
}

export function reorderFrames(oldRange, newIndex) {
    state.frames.splice(newIndex, 0, ...state.frames.splice(oldRange.startIndex, oldRange.length));
}

function celIdsForFrame(frame) {
    return state.layers.map(layer => getCelId(layer.id, frame.id));
}


// -------------------------------------------------------------------------------- Cels
// The term "cel" is short for "celluloid" https://en.wikipedia.org/wiki/Cel
// In this app, it represents one image in a specific frame and layer
// Note: This is different from a "Cell" (in this app, a "cell" refers to a row/column pair in the canvas)

function createCel(layer, frame, data = {}) {
    const celId = getCelId(layer.id, frame.id);
    state.cels[celId] = normalizeCel(data);
}

function normalizeCel(cel) {
    let normalizedCel = $.extend({}, CELL_DEFAULTS);

    // Copy over everything except for chars/colors
    Object.keys(cel).filter(key => key !== 'chars' && key !== 'colors').forEach(key => normalizedCel[key] = cel[key]);

    // Build chars/colors arrays, making sure every row/col has a value, and boundaries are followed
    normalizedCel.chars = [];
    normalizedCel.colors = [];

    let row, col, char, color, rowLength = numRows(), colLength = numCols();
    for (row = 0; row < rowLength; row++) {
        normalizedCel.chars[row] = [];
        normalizedCel.colors[row] = [];

        for (col = 0; col < colLength; col++) {
            char = undefined;
            color = undefined;

            if (cel.chars && cel.chars[row] && cel.chars[row][col] !== undefined) {
                char = cel.chars[row][col];
            }
            if (cel.colors && cel.colors[row] && cel.colors[row][col] !== undefined) {
                color = cel.colors[row][col];
            }
            if (char === undefined) { char = ''; }
            if (color === undefined) { color = 0; }

            normalizedCel.chars[row][col] = char;
            normalizedCel.colors[row][col] = color;
        }
    }

    return normalizedCel;
}

export function currentCel() {
    return cel(currentLayer(), currentFrame());
}

export function previousCel() {
    return cel(currentLayer(), previousFrame());
}

export function cel(layer, frame) {
    return state.cels[getCelId(layer.id, frame.id)];
}

function getCelId(layerId, frameId) {
    return `F-${frameId},L-${layerId}`;
}


export function iterateAllCels(callback) {
    for (const cel of Object.values(state.cels)) {
        callback(cel);
    }
}

export function iterateCelsForCurrentLayer(callback) {
    celIdsForLayer(currentLayer()).forEach(celId => {
        callback(state.cels[celId]);
    });
}

export function iterateCelsForCurrentFrame(callback) {
    celIdsForFrame(currentFrame()).forEach(celId => {
        callback(state.cels[celId]);
    });
}

/**
 * Iterates through cels. Which cels are iterated over depends on the allLayers and allFrames params.
 * @param {Boolean} allLayers If true, will include cels across all layers. If false, just includes cels for current layer.
 * @param {Boolean} allFrames If true, will include cels across all frames. If false, just includes cels for current frame.
 * @param {function(cel)} celCallback Callback called for each cel being iterated over
 */
export function iterateCels(allLayers, allFrames, celCallback) {
    if (allLayers && allFrames) {
        // Apply to all cels
        iterateAllCels(celCallback);
    }
    else if (!allLayers && allFrames) {
        // Apply to all frames of a single layer
        iterateCelsForCurrentLayer(celCallback);
    }
    else if (allLayers && !allFrames) {
        // Apply to all layers (of a single frame)
        iterateCelsForCurrentFrame(celCallback);
    }
    else {
        // Apply to current cel
        celCallback(currentCel());
    }
}


export function iterateCellsForCel(cel, callback) {
    let row, col, rowLength = numRows(), colLength = numCols();
    for (row = 0; row < rowLength; row++) {
        for (col = 0; col < colLength; col++) {
            callback(row, col, cel.chars[row][col], cel.colors[row][col]);
        }
    }
}


// -------------------------------------------------------------------------------- Glyphs
// In this app, "glyph" is the term I'm using for the combination of a char and a color

// This function returns the glyph as a 2d array: [char, color]
export function getCurrentCelGlyph(row, col) {
    return charInBounds(row, col) ? [currentCel().chars[row][col], currentCel().colors[row][col]] : [];
}

// If the char or color parameter is undefined, that parameter will not be overridden
export function setCurrentCelGlyph(row, col, char, color) {
    setCelGlyph(currentCel(), row, col, char, color);
}

export function setCelGlyph(cel, row, col, char, color) {
    if (charInBounds(row, col)) {
        if (char !== undefined) { cel.chars[row][col] = char; }
        if (color !== undefined) { cel.colors[row][col] = color; }
    }
}

export function charInBounds(row, col) {
    return row >= 0 && row < numRows() && col >= 0 && col < numCols();
}

// Aggregates all visible layers for a frame
export function layeredGlyphs(frame, options = {}) {
    let chars = create2dArray(numRows(), numCols(), '');
    let colors = create2dArray(numRows(), numCols(), 0);

    let l, layer, isCurrentLayer, celChars, celColors, celR, celC, r, c;

    for (l = 0; l < state.layers.length; l++) {
        layer = state.layers[l];
        isCurrentLayer = l === layerIndex();

        if (options.showAllLayers || (state.config.lockLayerVisibility ? isCurrentLayer : layer.visible)) {
            celChars = cel(layer, frame).chars;
            celColors = cel(layer, frame).colors;
            const offset = options.showOffsetContent && editor.moveAllOffset;
            
            for (celR = 0; celR < celChars.length; celR++) {
                for (celC = 0; celC < celChars[celR].length; celC++) {
                    if (celChars[celR][celC] === '') continue;

                    r = celR;
                    c = celC;

                    if (offset && (editor.moveAllModifiers.allLayers || isCurrentLayer)) {
                        ({ r, c } = getOffsetPosition(celR, celC, offset[0], offset[1], editor.moveAllModifiers.wrap));
                        if (!charInBounds(r, c)) continue;
                    }

                    chars[r][c] = celChars[celR][celC];
                    colors[r][c] = celColors[celR][celC];
                }
            }
        }

        // If there is movableContent, show it on top of the rest of the layer
        if (options.showMovingContent && isCurrentLayer && selection.movableContent) {
            translateGlyphs(selection.movableContent, selection.getSelectedCellArea().topLeft, (r, c, char, color) => {
                if (char !== undefined && charInBounds(r, c)) {
                    chars[r][c] = char;
                    colors[r][c] = color;
                }
            });
        }

        // If there is drawingContent (e.g. drawing a line out of chars), show it on top of the rest of the layer
        if (options.showDrawingContent && isCurrentLayer && editor.drawingContent) {
            translateGlyphs(editor.drawingContent.glyphs, editor.drawingContent.origin, (r, c, char, color) => {
                if (char !== undefined && charInBounds(r, c)) {
                    chars[r][c] = char;
                    colors[r][c] = color;
                }
            });
        }

        if (options.convertEmptyStrToSpace) {
            for (r = 0; r < chars.length; r++) {
                for (c = 0; c < chars[r].length; c++) {
                    if (chars[r][c] === '') {
                        chars[r][c] = ' ';
                        // colors[r][c] will be left at default (0)
                    }
                }
            }
        }
    }

    return {
        chars: chars,
        colors: colors
    };
}

/**
 * Shifts all the contents (chars/colors) of a cel.
 * @param cel The cel to affect
 * @param {Number} rowOffset How many rows to shift (can be negative)
 * @param {Number} colOffset How many columns to shift content (can be negative)
 * @param {Boolean} wrap If true, shifting content past the cel boundaries will wrap it around to the other side
 */
export function translateCel(cel, rowOffset, colOffset, wrap = false) {
    let chars = create2dArray(numRows(), numCols(), '');
    let colors = create2dArray(numRows(), numCols(), 0);

    let celR, celC, r, c;
    for (celR = 0; celR < cel.chars.length; celR++) {
        for (celC = 0; celC < cel.chars[celR].length; celC++) {
            ({ r, c } = getOffsetPosition(celR, celC, rowOffset, colOffset, wrap));

            if (charInBounds(r, c)) {
                chars[r][c] = cel.chars[celR][celC];
                colors[r][c] = cel.colors[celR][celC];
            }
        }
    }

    cel.chars = chars;
    cel.colors = colors;
}

function getOffsetPosition(r, c, rowOffset, colOffset, wrap) {
    r += rowOffset;
    c += colOffset;

    if (wrap) {
        r = mod(r, numRows());
        c = mod(c, numCols());
    }

    return { r, c }
}


// Returns the stored font as a string that can be entered as a CSS font-family attribute (including fallbacks)
export function fontFamily() {
    return `'${config('font')}', monospace`
}


// -------------------------------------------------------------------------------- Colors / Palettes
// - colorTable includes all colors used in rendering
// - palette.colors includes only colors that have been saved to the palette

export function colorTable() {
    return state.colorTable.slice(0); // Returning a dup; colorTable should only be modified by colorIndex/vacuum
}
export function colorStr(colorIndex) {
    return state.colorTable[colorIndex] === undefined ? palette.DEFAULT_COLOR : state.colorTable[colorIndex];
}

// Cleans out any unused colors from colorTable (adjusting cel color indices appropriately). Colors can become unused
// if, for example, some text was drawn with that color but then re-painted with a new color.
// This method also ensures all cel colors actually exist in the colorTable.
export function vacuumColorTable() {
    // Ensure colorTable has at least one entry so we can use index 0 as a fallback
    if (!state.colorTable[0]) state.colorTable[0] = DEFAULT_COLOR;

    let newIndex = 0;
    const vacuumMap = new Map(); // maps original colorIndexes to their new vacuumed colorIndex
    const dupUpdateMap = getDupColorUpdateMap(); // keeps track of any duplicate colorTable values
    
    iterateAllCels(cel => {
        iterateCellsForCel(cel, (r, c, char, colorIndex) => {
            // If colorTable does not have a value for the current colorIndex, we set the colorIndex to 0
            if (!state.colorTable[colorIndex]) colorIndex = 0;
            
            // If the color value of a colorIndex is duplicated by an earlier colorIndex, we use that earlier colorIndex
            if (dupUpdateMap.has(colorIndex)) colorIndex = dupUpdateMap.get(colorIndex);

            // Add any new color indexes to the vacuum map
            if (!vacuumMap.has(colorIndex)) vacuumMap.set(colorIndex, newIndex++)
            
            // Update the cel color to use the vacuumed index
            cel.colors[r][c] = vacuumMap.get(colorIndex);
        })
    })

    const vacuumedColorTable = [];
    for (const [oldIndex, newIndex] of vacuumMap.entries()) {
        vacuumedColorTable[newIndex] = state.colorTable[oldIndex];
    }
    state.colorTable = vacuumedColorTable;
}

// Returns a map of any duplicate colorTable values, where the key is the dup index and the value is the original index.
// E.g. if colorTable is ['#000000', '#ff0000', '#00ff00', '#ff0000'], index 3 (the second '#ff0000') is a duplicate,
// so the returned map would be { 3 => 1 }, since any cel that uses colorIndex 3 can be replaced with colorIndex 1.
function getDupColorUpdateMap() {
    const updateMap = new Map();
    const colorStrToIndexMap = new Map();
    state.colorTable.forEach((colorStr, colorIndex) => {
        if (colorStrToIndexMap.has(colorStr)) {
            // It is a duplicate
            updateMap.set(colorIndex, colorStrToIndexMap.get(colorStr))
        }
        else {
            // It is an original
            colorStrToIndexMap.set(colorStr, colorIndex);
        }
    })
    return updateMap;
}

export function colorIndex(colorStr) {
    let index = state.colorTable.indexOf(colorStr);

    if (index === -1) {
        state.colorTable.push(colorStr);
        index = state.colorTable.length - 1;
    }

    return index;
}

export function primaryColorIndex() {
    return colorIndex(config('primaryColor'));
}

export function sortedPalette() {
    return state.palette.sortedColors || [];
}

export function isNewColor(colorStr) {
    return !state.palette.colors.includes(colorStr);
}

export function addColor(colorStr) {
    if (isNewColor(colorStr)) {
        state.palette.colors.push(colorStr);
        recalculateSortedPalette();
    }
}

export function deleteColor(colorStr) {
    state.palette.colors = state.palette.colors.filter(paletteColorStr => paletteColorStr !== colorStr);
    recalculateSortedPalette();
}

export function changePaletteSortBy(newSortBy) {
    state.palette.sortBy = newSortBy;
    recalculateSortedPalette();
}

export function getPaletteSortBy() {
    return state.palette ? state.palette.sortBy : null;
}

function importPalette(newPalette, replace) {
    if (!state.palette) { state.palette = {}; }

    const currentColors = state.palette && state.palette.colors ? state.palette.colors : []
    const newColors = newPalette.colors ? newPalette.colors.map(colorStr => new Color(colorStr)[COLOR_FORMAT]) : [];
    state.palette.colors = replace ? newColors : [...currentColors, ...newColors]

    state.palette.sortBy = newPalette.sortBy || state.palette.sortBy;
    if (!Object.values(palette.SORT_BY).includes(state.palette.sortBy)) {
        state.palette.sortBy = palette.SORT_BY.DATE_ADDED;
    }

    recalculateSortedPalette();
}

function recalculateSortedPalette() {
    state.palette.sortedColors = palette.sortPalette(state.palette.colors, state.palette.sortBy);
}


// -------------------------------------------------------------------------------- Resizing Canvas

/**
 * Resizes the canvas dimensions. If the canvas shrinks, all content outside of the new dimensions will be truncated.
 * @param newDimensions Array [num columns, num rows] of the new dimensions
 * @param rowOffset Integer or 'top'/'middle'/'bottom' - If an integer is provided, it will determine the starting row
 *                  for the content in the new dimensions. Alternatively, a string 'top'/'middle'/'bottom' can be given
 *                  to anchor the content to the top, middle, or bottom row in the new dimensions.
 * @param colOffset Same as rowOffset, but for the column.
 */
export function resize(newDimensions, rowOffset, colOffset) {
    switch(rowOffset) {
        case 'top':
            rowOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            rowOffset = newDimensions[1] > numRows() ?
                Math.ceil((numRows() - newDimensions[1]) / 2) :
                Math.floor((numRows() - newDimensions[1]) / 2)
            break;
        case 'bottom':
            rowOffset = numRows() - newDimensions[1];
            break;
    }

    switch(colOffset) {
        case 'left':
            colOffset = 0;
            break;
        case 'middle':
            // Use ceil when growing and floor when shrinking, so content stays in the same place if you do one after the other
            colOffset = newDimensions[0] > numCols() ?
                Math.ceil((numCols() - newDimensions[0]) / 2) :
                Math.floor((numCols() - newDimensions[0]) / 2)
            break;
        case 'right':
            colOffset = numCols() - newDimensions[0];
            break;
    }

    Object.values(state.cels).forEach(cel => {
        let resizedChars = [];
        let resizedColors = [];

        for (let r = 0; r < newDimensions[1]; r++) {
            for (let c = 0; c < newDimensions[0]; c++) {
                if (resizedChars[r] === undefined) { resizedChars[r] = []; }
                if (resizedColors[r] === undefined) { resizedColors[r] = []; }

                let oldRow = r + rowOffset;
                let oldCol = c + colOffset;

                resizedChars[r][c] = cel.chars[oldRow] && cel.chars[oldRow][oldCol] ? cel.chars[oldRow][oldCol] : '';
                resizedColors[r][c] = cel.colors[oldRow] && cel.colors[oldRow][oldCol] ? cel.colors[oldRow][oldCol] : 0;
            }
        }

        cel.chars = resizedChars;
        cel.colors = resizedColors;
    });

    state.config.dimensions = newDimensions;

    triggerResize({ clearSelection: true, resetZoom: true });
    pushStateToHistory({ requiresResize: true });
}


// -------------------------------------------------------------------------------- History (undo / redo)
// Implementing undo/redo using the memento pattern https://en.wikipedia.org/wiki/Memento_pattern

let history;
let historyIndex;

function resetHistory() {
    history = [];
    historyIndex = undefined;
}

export function hasChanges() {
    return history.length > 1;
}

// TODO Implement a way to just store changes to a single frame, since usually only one frame is changing and it would
//      save a lot of memory
export function pushFrameToHistory() {

}

/**
 * Adds the current state of the app as a new slice of the history.
 * @param options.modifiable (optional String) If a string is given, further calls to pushStateToHistory with the same
 *                           modifiable string will update the current history slice instead of adding a new slice.
 *                           This is used for things like typing, where we don't want each new character to be a new slice.
 *                           Once the modifiable string changes / is undefined (or endHistoryModification is called) that
 *                           history slice will not be updated anymore; a new slice will be made on the next push.
 * @param options.requiresResize (optional Boolean) If true, undoing/redoing to this state will force the canvas to be
 *                               resized.
 * @param options.requiresCalculateFontRatio (optional Boolean) If true, undoing/redoing to this state will force the
 *                               canvas fontRatio to be recalculated (only needed if font is changed)
 */
export function pushStateToHistory(options = {}) {
    // console.log('pushStateToHistory', historyIndex, options);

    // Remove anything in the future (all "redo" states are removed)
    if (historyIndex !== undefined) {
        history.splice(historyIndex + 1, history.length);
    }

    // The snapshot to be saved in the history
    const snapshot = buildHistorySnapshot(options);

    // If modifiable option is a match, we just update the current slice and return
    if (history.length && options.modifiable && options.modifiable === history[historyIndex].options.modifiable) {
        history[historyIndex] = snapshot;
        return;
    }

    endHistoryModification();
    
    history.push(snapshot);
    historyIndex = historyIndex === undefined ? 0 : historyIndex + 1;

    // Limit history length
    if (history.length > MAX_HISTORY) {
        history.shift();
        historyIndex -= 1;
    }
}

// We only want to save a subset of the config state to history: certain things like what tool is selected, or whether
// the grid is showing, should not be part of the "undo" sequence.
// TODO do a shallow clone (using spread syntax) and just override some values while cloning?
function buildHistorySnapshot(options) {
    const historyState = $.extend(true, {}, state);

    for (const key of Object.keys(historyState.config)) {
        if (!CONFIG_KEYS_FOR_HISTORY.has(key)) {
            delete historyState.config[key];
        }
    }

    return {
        state: historyState,
        options: options,
    }
}

// We are deep merging the config into our current state config, and replacing everything else.
// That way certain settings (e.g. what tool is selected) is inherited from the current state
function loadHistorySnapshot(snapshot) {
    const historyState = $.extend(true, {}, snapshot.state);
    historyState.config = $.extend(true, {}, state.config, snapshot.state.config)
    state = historyState;
}

function loadStateFromHistory(newIndex, oldIndex) {
    // console.log('loadStateFromHistory', newIndex, oldIndex);

    const newState = history[newIndex];
    const oldState = history[oldIndex];

    loadHistorySnapshot(newState);

    const cursorCell = Cell.deserialize(config('cursorPosition'));
    if (config('tool') === 'text-editor' && cursorCell) {
        moveCursorTo(cursorCell, false)
    }

    if (newState.options.requiresCalculateFontRatio || oldState.options.requiresCalculateFontRatio) {
        calculateFontRatio();
    }

    if (newState.options.requiresResize || oldState.options.requiresResize) {
        triggerResize({ clearSelection: true, resetZoom: true });
    }
    else {
        triggerRefresh();
    }
}

function canUndo() {
    return historyIndex > 0;
}

function undo() {
    if (canUndo()) {
        endHistoryModification();
        loadStateFromHistory(historyIndex - 1, historyIndex);
        historyIndex -= 1;
    }
}

function canRedo() {
    return historyIndex < history.length - 1;
}

function redo() {
    if (canRedo()) {
        loadStateFromHistory(historyIndex + 1, historyIndex);
        historyIndex += 1;
    }
}

// Ends further modifications to the current history slice. See pushStateToHistory for more info.
export function endHistoryModification() {
    if (history.length) {
        history[historyIndex].options.modifiable = undefined;
    }
}

// Modifies the current history slice
export function modifyHistory(callback) {
    if (history.length) {
        callback(history[historyIndex])
    }
}


// -------------------------------------------------------------------------------- Error handling
const $loadError = $('#load-error');

function onLoadError(attemptedData) {
    // Clear out state since it is invalid; that way isValid() returns false
    state = {};

    // Remove all document event listeners since the document is dead
    $(document).off('mousedown').off('mouseup').off('click');

    $loadError.show();
    toggleStandard('load-error', true);

    $loadError.find('.download').off('click').on('click', e => {
        saveCorruptedState(attemptedData)
            .catch(err => {
                if (!isPickerCanceledError(err)) {
                    console.error(err);
                    alert(`Failed to download state: ${err.message}`);
                }
            })
    });

    $loadError.find('.reset').off('click').on('click', e => {
        resetState();
        location.reload();
    });
}

export function isValid() {
    return state && Object.keys(state).length > 0;
}
