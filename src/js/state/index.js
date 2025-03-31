import * as cels from './cels.js';
import * as config from './config.js';
import * as frames from './frames.js';
import * as history from './history.js';
import * as layers from './layers.js';
import * as metadata from './metadata.js';
import * as palette from './palette.js';

import {calculateFontRatio} from "../canvas/font.js";
import {recalculateBGColors} from "../canvas/background.js";
import {triggerResize} from "../index.js";
import {resetState, saveState} from "../storage/local_storage.js";
import {toggleStandard} from "../io/keyboard.js";
import {isPickerCanceledError, saveCorruptedState} from "../storage/file_system.js";

export { numRows, numCols, setConfig, getConfig, fontFamily, DEFAULT_STATE as DEFAULT_CONFIG } from './config.js'
export { getName, isMinimized, setMetadata, getMetadata } from './metadata.js'
export {
    hasCharContent, currentCel, previousCel, cel,
    iterateAllCels, iterateCelsForCurrentLayer, iterateCelsForCurrentFrame, iterateCels, iterateCellsForCel,
    getCurrentCelGlyph, setCurrentCelGlyph, setCelGlyph, charInBounds, layeredGlyphs, translateCel,
    colorTable, colorStr, vacuumColorTable, colorIndex, primaryColorIndex,
    resize
} from './cels.js'
export {
    layers as layers, layerIndex, currentLayer, createLayer, deleteLayer, updateLayer,
    reorderLayer, toggleLayerVisibility
} from './layers.js'
export {
    frames as frames, frameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame, previousFrame, createFrame,
    duplicateFrames, deleteFrames, reorderFrames
} from './frames.js'
export {
    sortedPalette, isNewColor, addColor, deleteColor, changePaletteSortBy, getPaletteSortBy, COLOR_FORMAT,
} from './palette.js'
export {
    hasChanges, pushStateToHistory, endHistoryModification, modifyHistory
} from './history.js'


export function init() {
    history.setupActions();
}

export function newState(overrides) {
    return load($.extend(true, {
        // TODO A warning shows up when starting new file
        // layers: {
        //     layers: [{ id: 1, name: 'Layer X' }]
        // },
        // frames: {
        //     frames: [{ id: 1 }]
        // },
    }, overrides));
}

export function load(data) {
    try {
        history.reset();

        config.load(data.config);
        layers.load(data.layers);
        frames.load(data.frames);
        cels.load(data.cels); // must come after config load, since it depends on dimensions
        palette.load(data.palette);
        metadata.load(data.metadata);

        cels.validate();
        layers.validate();
        frames.validate();

        cels.vacuumColorTable();
        calculateFontRatio();
        recalculateBGColors();
        triggerResize({ clearSelection: true, resetZoom: true });
        history.pushStateToHistory(); // Note: Does not need requiresResize:true since there is no previous history state
        saveState();

        return true;
    } catch (error) {
        console.error("Failed to load state:", error);
        onLoadError(data);
        return false;
    }
}


// --------------------------------------------------------------------------------

export function stateForLocalStorage() {
    return {
        cels: cels.getState(),
        config: config.getState(),
        frames: frames.getState(),
        layers: layers.getState(),
        palette: palette.getState(),
        metadata: metadata.getState(),
    }
}
export function loadFromLocalStorage(lsState) {
    // todo migrations
    return load(lsState);
}

export function replaceState(newState) {
    cels.replaceState(newState.cels);
    config.replaceState(newState.config);
    frames.replaceState(newState.frames);
    layers.replaceState(newState.layers);
    palette.replaceState(newState.palette);
    metadata.replaceState(newState.metadata);
}

// --------------------------------------------------------------------------------

const CURRENT_VERSION = 3;

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
        frames: frames.getState(),
        layers: layers.getState(),
        cels: cels.encodeState()
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
    // State migrations (list will grow longer as more migrations are added):
    if (!diskState.version || diskState.version === 1) migrateToV2(diskState)
    if (diskState.version === 2) migrateToV3(diskState);

    // Decode cels
    diskState.cels = cels.decodeState(diskState.cels, diskState?.config?.dimensions?.[0])

    // Always prefer the file's name over the name property stored in the json.
    if (!diskState.metadata) diskState.metadata = {};
    diskState.metadata.name = fileName;

    return load(diskState);
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




// -------------------------------------------------------------------------------- Error handling
const $loadError = $('#load-error');
let valid = true;

function onLoadError(attemptedData) {
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
