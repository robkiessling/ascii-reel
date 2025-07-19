import * as config from './config.js';
import * as history from './history.js';
import * as palette from './palette.js';
import * as unicode from './unicode.js';
import * as timeline from './timeline/index.js';
import * as selection from './selection/index.js';

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
    getCurrentCelGlyph, setCurrentCelGlyph, setCelGlyph,
    getCurrentCelShape, addCurrentCelShape, updateCurrentCelShape, deleteCurrentCelShape,
    reorderCurrentCelShapes, canReorderCurrentCelShapes,
    checkCurrentCelHitbox, checkCurrentCelMarquee,
    charInBounds, layeredGlyphs, translateCel,
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
export {
    selectedShapeIds, setSelectedShapeIds, numSelectedShapes, hasSelectedShapes, isShapeSelected,
    selectShape, deselectShape, deselectAllShapes,
    selectedShapes, updateSelectedShapes, deleteSelectedShapes, reorderSelectedShapes, canReorderSelectedShapes
} from './selection/index.js'

export function init() {
    history.setupActions();
}

export function loadNewState(projectType, dimensions, colorMode, background) {
    let primaryColor, paletteState;
    if (background !== undefined) {
        primaryColor = palette.defaultContrastColor(background);
        paletteState = { colors: [primaryColor] }
    }

    try {
        deserialize({
            config: {
                projectType: projectType,
                colorMode: colorMode,
                dimensions: dimensions,
                background: background,
                primaryColor: primaryColor,
                tool: 'draw-rect' // todo remove this
            },
            // timeline: timeline.newRasterCelTimeline(),
            timeline: timeline.newVectorCelTimeline(),
            palette: paletteState
        })
    } catch (error) {
        console.error("Failed to load new state:", error);
        onLoadError({ projectType, dimensions, colorMode, background });
    }
}

export function deserialize(data = {}, options = {}) {
    if (options.replace) {
        config.deserialize(data.config, options);
        timeline.deserialize(data.timeline, options);
        palette.deserialize(data.palette, options);
        unicode.deserialize(data.unicode, options);
        selection.deserialize(data.selection, options);
        return;
    }

    valid = false; // State is considered invalid until it is fully loaded

    history.reset();

    config.deserialize(data.config, options); // Load config first so dimensions are available to loaders
    timeline.deserialize(data.timeline, options);
    palette.deserialize(data.palette, options);
    unicode.deserialize(data.unicode, options);
    selection.deserialize(data.selection, options);

    validateProjectType();
    validateColorMode();

    valid = true; // State is now fully loaded

    history.pushHistory(); // Note: Does not need requiresResize:true since there is no previous history state
    saveToLocalStorage();

    eventBus.emit(EVENTS.STATE.LOADED);
}

export function serialize(options = {}) {
    return {
        version: CURRENT_VERSION,
        config: config.serialize(options),
        timeline: timeline.serialize(options),
        palette: palette.serialize(options),
        unicode: unicode.serialize(options),
        selection: selection.serialize(options),
    }
}

export function loadFromStorage(storedState, fileName) {
    const originalState = structuredClone(storedState);

    try {
        migrateState(storedState);

        // Always prefer the file's name over the name property stored in the json.
        if (fileName !== undefined) {
            if (!storedState.config) storedState.config = {};
            storedState.config.name = fileName;
        }

        deserialize(storedState, { decompress: true });
    } catch (error) {
        console.error("Failed to load from storage:", error);
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

        deserialize({
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
 */
function migrateState(state) {
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

// --------------------------------------------------------------------------------

export function changeFrameIndex(newIndex) {
    if (timeline.frameIndex() !== newIndex) {
        if (timeline.currentLayerType() === 'vector') selection.deselectAllShapes();

        timeline.changeFrameIndex(newIndex);
    }
}

export function changeLayerIndex(newIndex) {
    if (timeline.layerIndex() !== newIndex) {
        if (timeline.currentLayerType() === 'vector') selection.deselectAllShapes();

        timeline.changeLayerIndex(newIndex);
    }
}




// -------------------------------------------------------------------------------- Error handling
const $loadError = $('#load-error');
let valid = false;

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
