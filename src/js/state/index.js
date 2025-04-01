import * as config from './config.js';
import * as history from './history.js';
import * as metadata from './metadata.js';
import * as palette from './palette.js';
import * as timeline from './timeline/index.js';

import {calculateFontRatio} from "../canvas/font.js";
import {recalculateBGColors} from "../canvas/background.js";
import {resetState, saveState} from "../storage/local_storage.js";
import {toggleStandard} from "../io/keyboard.js";
import {isPickerCanceledError, saveCorruptedState} from "../storage/file_system.js";

export { numRows, numCols, setConfig, getConfig, fontFamily, DEFAULT_STATE as DEFAULT_CONFIG } from './config.js'
export { getName, isMinimized, setMetadata, getMetadata } from './metadata.js'
export {
    // layers
    layers, layerIndex, currentLayer, createLayer, deleteLayer, updateLayer,
    reorderLayer, toggleLayerVisibility,

    // frames
    frames, frameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame, previousFrame, createFrame,
    duplicateFrames, deleteFrames, reorderFrames,

    // cels
    hasCharContent, iterateCelsForCurrentLayer, iterateCels, iterateCellsForCel,
    getCurrentCelGlyph, setCurrentCelGlyph, setCelGlyph, charInBounds, layeredGlyphs, translateCel,
    colorTable, colorStr, vacuumColorTable, colorIndex, primaryColorIndex,
    resize
} from './timeline/index.js'
export {
    sortedPalette, isNewColor, addColor, deleteColor, changePaletteSortBy, getPaletteSortBy, COLOR_FORMAT,
} from './palette.js'
export {
    hasChanges, pushStateToHistory, endHistoryModification, modifyHistory
} from './history.js'


export function init() {
    history.setupActions();
}

export function loadBlankState(overrides) {
    try {
        load($.extend(true, {
            timeline: timeline.newBlankState()
        }, overrides));

        return true;
    } catch (error) {
        console.error("Failed to load blank state:", error);
        onLoadError({});
        return false;
    }
}

function load(data) {
    history.reset();

    config.load(data.config);
    timeline.load(data.timeline);
    palette.load(data.palette);
    metadata.load(data.metadata);

    timeline.validate();
    timeline.vacuumColorTable();
    calculateFontRatio();
    recalculateBGColors();
    history.pushStateToHistory(); // Note: Does not need requiresResize:true since there is no previous history state
    saveState();
}

export function replaceState(newState) {
    config.replaceState(newState.config);
    timeline.replaceState(newState.timeline);
    palette.replaceState(newState.palette);
    metadata.replaceState(newState.metadata);
}

export function stateForLocalStorage() {
    return {
        version: CURRENT_VERSION,
        config: config.getState(),
        timeline: timeline.getState(),
        palette: palette.getState(),
        metadata: metadata.getState(),
    }
}
export function loadFromLocalStorage(localStorageState) {
    const originalState = structuredClone(localStorageState);

    try {
        migrateState(localStorageState, 'localStorage');

        load(localStorageState);

        return true;
    } catch (error) {
        console.error("Failed to load from local storage:", error);
        onLoadError(originalState);
        return false;
    }
}

/**
 * Compresses the chars & colors arrays of every cel to minimize file size.
 *
 * Storing the chars/colors 2d arrays as-is is quite inefficient in JSON (the array is converted to a string, where every
 * comma and/or quotation mark uses 1 byte). Instead, we use pako to store these 2d arrays as compressed Base64 strings.
 *
 * @returns {Object}
 */
export function stateForDiskStorage() {
    return {
        version: CURRENT_VERSION,
        config: config.getState(),
        metadata: metadata.getState(),
        palette: palette.getState(),
        timeline: timeline.encodeState()
    }
}

/**
 * Reads the disk file, converting each cel's compressed chars/colors back into arrays.
 *
 * Also handles migrating older files to the current format, in case the webapp's code has changed since the file was saved.
 *
 * @returns {Object}
 */
export function loadFromDisk(diskState, fileName) {
    const originalState = structuredClone(diskState);

    try {
        migrateState(diskState, 'disk');

        // Decode timeline
        diskState.timeline = timeline.decodeState(diskState.timeline, diskState?.config?.dimensions?.[0])

        // Always prefer the file's name over the name property stored in the json.
        if (!diskState.metadata) diskState.metadata = {};
        diskState.metadata.name = fileName;

        load(diskState);
        return true;
    } catch (error) {
        console.error("Failed to load file from disk:", error);
        onLoadError(originalState);
        return false;
    }
}



// --------------------------------------------------------------------------------

// When making breaking state changes, increment this version and provide migrations so that files loaded from local
// storage or disk still work.
const CURRENT_VERSION = 4;

/**
 * Migrates a state object to the latest version. A state object might be out-of-date if it was saved from an earlier
 * version of the app.
 * @param {object} state The state object to migrate
 * @param {string} source Whether the state was saved to 'disk' or 'localStorage' (might be useful if a migration
 *   only affects one or the other).
 */
function migrateState(state, source) {
    // State migrations (list will grow longer as more migrations are added):
    if (!state.version || state.version === 1) migrateToV2(state)
    if (state.version === 2) migrateToV3(state);
    if (state.version === 3) migrateToV4(state);
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

    diskState.version = 2;
}

function migrateToV3(diskState) {
    diskState.cels = {
        cels: diskState.cels,
        colorTable: diskState.colorTable
    }

    delete diskState.colorTable;
    diskState.frames = { frames: diskState.frames };
    diskState.layers = { layers: diskState.layers };

    diskState.metadata = {};
    const deleteKeys = ['frameIndex', 'frameRangeSelection', 'layerIndex'];
    const keepAsConfigKeys = ['background', 'font', 'cursorPosition', 'dimensions'];
    Object.keys(diskState.config).forEach(key => {
        if (deleteKeys.includes(key)) {
            delete diskState.config[key];
        }
        else if (!keepAsConfigKeys.includes(key)) {
            diskState.metadata[key] = diskState.config[key];
            delete diskState.config[key];
        }
    })

    diskState.version = 3;
}

function migrateToV4(diskState) {
    diskState.timeline = {
        layers: diskState.layers,
        frames: diskState.frames,
        cels: diskState.cels
    }

    delete diskState.layers;
    delete diskState.frames;
    delete diskState.cels;

    diskState.version = 4;
}




// -------------------------------------------------------------------------------- Error handling
const $loadError = $('#load-error');
let valid = true;

function onLoadError(attemptedData) {
    console.log('attemptedData:');
    console.log(attemptedData);

    valid = false;

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
    return !!valid;
}
