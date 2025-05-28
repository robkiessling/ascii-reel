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
    numRows, numCols, setConfig, getConfig, fontFamily, getName, updateDrawType,
    isAnimationProject, isMultiColored, MULTICOLOR_TOOLS, DEFAULT_STATE as DEFAULT_CONFIG
} from './config.js'
export {
    // layers
    layers, layerIndex, currentLayer, createLayer, deleteLayer, updateLayer,
    reorderLayer, toggleLayerVisibility,

    // frames
    frames, frameIndex, frameRangeSelection, extendFrameRangeSelection, currentFrame, previousFrame, createFrame,
    duplicateFrames, deleteFrames, reorderFrames, reverseFrames, updateFrame, expandedFrames,
    TICKS_OPTIONS,

    // cels
    iterateCelsForCurrentLayer, iterateCels,
    getCurrentCelGlyph, setCurrentCelGlyph, setCelGlyph, charInBounds, layeredGlyphs, translateCel,
    colorTable, colorStr, vacuumColorTable, colorIndex, primaryColorIndex,
    resize, colorSwap, hasCharContent
} from './timeline/index.js'
export {
    sortedPalette, isNewColor, addColor, deleteColor, changePaletteSortBy, getPaletteSortBy,
    importPalette, COLOR_FORMAT, BLACK, WHITE, SORT_BY_OPTIONS as PALETTE_SORT_BY_OPTIONS
} from './palette.js'
export {
    sortedChars, importChars, setUnicodeSetting, getUnicodeSetting
} from './unicode.js'
export {
    pushHistory, endHistoryModification, modifyHistory, isDirty, markClean
} from './history.js'


export function init() {
    history.setupActions();
}

export function loadBlankState() {
    try {
        load({
            timeline: timeline.newRasterCelTimeline()
            // timeline: timeline.newVectorCelTimeline()
        });
    } catch (error) {
        console.error("Failed to load blank state:", error);
        onLoadError({});
    }
}

export function loadNewState(projectType, dimensions, colorMode, background) {
    let primaryColor, paletteState;
    if (background !== undefined) {
        primaryColor = palette.defaultContrastColor(background);
        paletteState = { colors: [primaryColor] }
    }

    try {
        load({
            config: {
                projectType: projectType,
                colorMode: colorMode,
                dimensions: dimensions,
                background: background,
                primaryColor: primaryColor,
            },
            timeline: timeline.newRasterCelTimeline(),
            palette: paletteState
        })
    } catch (error) {
        console.error("Failed to load new state:", error);
        onLoadError({ projectType, dimensions, colorMode, background });
    }
}

function load(data) {
    valid = false; // State is considered invalid until it is fully loaded

    history.reset();

    config.load(data.config); // Load this first so dimensions and other config data is available to loaders
    timeline.load(data.timeline);
    palette.load(data.palette);
    unicode.load(data.unicode);

    timeline.validate();
    timeline.vacuumColorTable();
    validateProjectType();
    validateColorMode();

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
        diskState.timeline = timeline.decodeState(diskState.timeline, diskState?.config?.dimensions?.[1])

        // Always prefer the file's name over the name property stored in the json.
        if (!diskState.config) diskState.config = {};
        diskState.config.name = fileName;

        load(diskState);
    } catch (error) {
        console.error("Failed to load file from disk:", error);
        onLoadError(originalState);
    }
}

export function loadFromTxt(txtContent, fileName) {
    try {
        const chars = txtContent.split(/\r?\n/).map(row => row.split(''));
        let cel = {}, dimensions;

        if (chars.some(row => row.length > 0)) {
            cel = { chars: chars }
            dimensions = [chars.length, Math.max(...chars.map(row => row.length))]
        }

        load({
            config: {
                colorMode: 'monochrome',
                dimensions: dimensions,
                name: fileName
            },
            timeline: timeline.newRasterCelTimeline(cel),
        })
    } catch (error) {
        console.error("Failed to load txt file from disk:", error);
        onLoadError(txtContent);
    }
}


// --------------------------------------------------------------------------------

// When making breaking state changes, increment this version and provide migrations so that files loaded from local
// storage or disk still work.
const CURRENT_VERSION = 7;

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
    if (state.version === 5) migrateToV6(state);
    if (state.version === 6) migrateToV7(state);

    if (state.version !== CURRENT_VERSION) console.error("Version error in state migration: ", state.version);
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

function migrateToV6(state) {
    Object.keys(state.timeline).forEach(key => {
        switch(key) {
            case 'layers':
                state.timeline.layerController = state.timeline.layers;
                break;
            case 'frames':
                state.timeline.frameController = state.timeline.frames;
                break;
            case 'cels':
                state.timeline.celController = state.timeline.cels;
                break;
        }
    })

    delete state.timeline.layers
    delete state.timeline.frames
    delete state.timeline.cels

    state.version = 6;
}

function migrateToV7(state) {
    if (state.config && state.config.dimensions) {
        state.config.dimensions = [state.config.dimensions[1], state.config.dimensions[0]]
    }

    state.version = 7
}



// --------------------------------------------------------------------------------

export function validateColorMode() {
    if (config.getConfig('colorMode') === 'monochrome') {
        const charColor = config.getConfig('background') === palette.BLACK ? palette.WHITE : palette.BLACK;

        timeline.convertToMonochrome(charColor);
        palette.convertToMonochrome(charColor);
        if (config.MULTICOLOR_TOOLS.has(config.getConfig('tool'))) {
            config.setConfig('tool', 'text-editor'); // ensure tool is not one of the color-related ones
        }
        config.setConfig('primaryColor', charColor)
    }
    else {
        // Ensure primaryColor does not clash with background
        if (config.getConfig('primaryColor') === config.getConfig('background')) {
            config.setConfig('primaryColor', config.getConfig('background') === palette.BLACK ? palette.WHITE : palette.BLACK);
        }
    }
}

export function invertInvisibleChars() {
    let oldColor, newColor;

    if (config.getConfig('background') === palette.BLACK) {
        // convert all black text to white
        oldColor = palette.BLACK;
        newColor = palette.WHITE;
    }
    else if (config.getConfig('background') === palette.WHITE) {
        // convert all white text to black
        oldColor = palette.WHITE;
        newColor = palette.BLACK;
    }

    if (oldColor && newColor) {
        timeline.colorSwap(timeline.colorIndex(oldColor), timeline.colorIndex(newColor), {
            allLayers: true, allFrames: true
        })
    }
}

export function validateProjectType() {
    if (config.getConfig('projectType') === 'drawing') {
        timeline.convertToDrawing();
        config.setConfig('playPreview', false);
        config.setConfig('showOnion', false);
        config.setConfig('showTicks', false);
    }
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
