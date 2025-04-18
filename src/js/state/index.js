import * as config from './config.js';
import * as history from './history.js';
import * as palette from './palette.js';
import * as unicode from './unicode.js';
import * as timeline from './timeline/index.js';

import {resetState as resetLocalStorage, saveState as saveToLocalStorage} from "../storage/local_storage.js";
import {toggleStandard} from "../io/keyboard.js";
import {isPickerCanceledError, saveCorruptedState} from "../storage/file_system.js";
import {eventBus, EVENTS} from "../events/events.js";

export {
    numRows, numCols, setConfig, getConfig, fontFamily, getName, isMinimized, updateDrawType,
    DEFAULT_STATE as DEFAULT_CONFIG
} from './config.js'
export {
    // layers
    layers, layerIndex, currentLayer, createLayer, deleteLayer, updateLayer,
    reorderLayer, toggleLayerVisibility,

    // frames
    frames, frameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame, previousFrame, createFrame,
    duplicateFrames, deleteFrames, reorderFrames, reverseFrames,

    // cels
    hasCharContent, iterateCelsForCurrentLayer, iterateCels, iterateCellsForCel,
    getCurrentCelGlyph, setCurrentCelGlyph, setCelGlyph, charInBounds, layeredGlyphs, translateCel,
    colorTable, colorStr, vacuumColorTable, colorIndex, primaryColorIndex,
    resize
} from './timeline/index.js'
export {
    sortedPalette, isNewColor, addColor, deleteColor, changePaletteSortBy, getPaletteSortBy, defaultContrastColor,
    importPalette, COLOR_FORMAT, SORT_BY_OPTIONS as PALETTE_SORT_BY_OPTIONS
} from './palette.js'
export {
    sortedChars, importChars, setUnicodeSetting, getUnicodeSetting
} from './unicode.js'
export {
    hasHistory, pushHistory, endHistoryModification, modifyHistory
} from './history.js'


export function init() {
    history.setupActions();
}

export function loadBlankState(overrides) {
    try {
        load($.extend(true, {
            timeline: timeline.newBlankState()
        }, overrides));
    } catch (error) {
        console.error("Failed to load blank state:", error);
        onLoadError({});
    }
}

function load(data) {
    valid = false; // State is considered invalid until it is fully loaded

    history.reset();

    config.load(data.config);
    timeline.load(data.timeline);
    palette.load(data.palette);
    unicode.load(data.unicode);

    timeline.validate();
    timeline.vacuumColorTable();

    valid = true; // State is now fully loaded

    history.pushHistory(); // Note: Does not need requiresResize:true since there is no previous history state
    saveToLocalStorage();

    eventBus.emit(EVENTS.STATE.LOADED);
}

export function replaceState(newState) {
    config.replaceState(newState.config);
    timeline.replaceState(newState.timeline);
    palette.replaceState(newState.palette);
    unicode.replaceState(newState.unicode);
}

export function stateForLocalStorage() {
    return {
        version: CURRENT_VERSION,
        config: config.getState(),
        timeline: timeline.getState(),
        palette: palette.getState(),
        unicode: unicode.getState(),
    }
}
export function loadFromLocalStorage(localStorageState) {
    const originalState = structuredClone(localStorageState);

    try {
        migrateState(localStorageState, 'localStorage');

        load(localStorageState);
    } catch (error) {
        console.error("Failed to load from local storage:", error);
        onLoadError(originalState);
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
        palette: palette.getState(),
        unicode: unicode.getState(),
        timeline: timeline.encodeState()
    }
}

/**
 * Reads the disk file, converting each cel's compressed chars/colors back into arrays.
 *
 * Also handles migrating older files to the current format, in case the webapp's code has changed since the file was saved.
 */
export function loadFromDisk(diskState, fileName) {
    const originalState = structuredClone(diskState);

    try {
        migrateState(diskState, 'disk');

        // Decode timeline
        diskState.timeline = timeline.decodeState(diskState.timeline, diskState?.config?.dimensions?.[0])

        // Always prefer the file's name over the name property stored in the json.
        if (!diskState.config) diskState.config = {};
        diskState.config.name = fileName;

        load(diskState);
    } catch (error) {
        console.error("Failed to load file from disk:", error);
        onLoadError(originalState);
    }
}



// --------------------------------------------------------------------------------

// When making breaking state changes, increment this version and provide migrations so that files loaded from local
// storage or disk still work.
const CURRENT_VERSION = 5;

/**
 * Migrates a state object to the latest version. A state object might be out-of-date if it was saved from an earlier
 * version of the app.
 * @param {Object} state - The state object to migrate
 * @param {'disk'|'localStorage'} source - Where the state is being loaded from. Might be useful if a migration only
 *    affects certain save types.
 */
function migrateState(state, source) {
    // State migrations (list will grow longer as more migrations are added):
    if (!state.version || state.version === 1) migrateToV2(state)
    if (state.version === 2) migrateToV3(state);
    if (state.version === 3) migrateToV4(state);
    if (state.version === 4) migrateToV5(state);
}

function migrateToV2(state) {
    // version 1 stored cel ids as `f-1,l-2`, version 2 stores them as `F-1,L-2`
    state.cels = Object.fromEntries(
        Object.entries(state.cels).map(([k, v]) => {
            const match = k.match(/f-(\d+),l-(\d+)/)
            const frameId = parseInt(match[1])
            const layerId = parseInt(match[2])
            return [`F-${frameId},L-${layerId}`, v]
        })
    )

    state.version = 2;
}

function migrateToV3(state) {
    state.cels = {
        cels: state.cels,
        colorTable: state.colorTable
    }

    delete state.colorTable;
    state.frames = { frames: state.frames };
    state.layers = { layers: state.layers };

    state.metadata = {};
    const deleteKeys = ['frameIndex', 'frameRangeSelection', 'layerIndex'];
    const keepAsConfigKeys = ['background', 'font', 'cursorPosition', 'dimensions'];
    Object.keys(state.config).forEach(key => {
        if (deleteKeys.includes(key)) {
            delete state.config[key];
        }
        else if (!keepAsConfigKeys.includes(key)) {
            state.metadata[key] = state.config[key];
            delete state.config[key];
        }
    })

    state.version = 3;
}

function migrateToV4(state) {
    state.timeline = {
        layers: state.layers,
        frames: state.frames,
        cels: state.cels
    }

    delete state.layers;
    delete state.frames;
    delete state.cels;

    state.version = 4;
}

function migrateToV5(state) {
    Object.keys(state.metadata).forEach(key => {
        state.config[key] = state.metadata[key];
    })

    delete state.metadata;

    state.version = 5;
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
        resetLocalStorage();
        location.reload();
    });
}

export function isValid() {
    return !!valid;
}
