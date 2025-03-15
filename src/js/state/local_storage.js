/**
 * The following handles saving "files" to localstorage. It is an alternative to saving/loading .asciireel files to disk.
 * It is easier to use than disk files, but it is risky because if the browser cache is emptied then the files are gone.
 *
 * I am currently supporting storing ONE file to localstorage. Perhaps in the future I'll add the ability
 * to save more (would require a UI for choosing the desired file, deleting files, etc.)
 */

import {getState, isValid, replaceState} from "./state.js";
import {triggerRefresh} from "../index.js";
import {refresh as refreshTheme} from "../config/theme.js"




// ------------------------------------------------------------------------- Local Storage Helpers

function getLocalStorage(storageKey) {
    try {
        const serializedItem = localStorage.getItem(storageKey);
        if (serializedItem === null) return undefined;
        return JSON.parse(serializedItem);
    } catch (err) {
        console.error('Error getting localstorage: ', err);
        return undefined;
    }
}

function setLocalStorage(storageKey, value, msgData = {}) {
    if (!isLeader) return;

    try {
        localStorage.setItem(storageKey, JSON.stringify(value));
        channel.postMessage({ type: UPDATE_MSG, storageKey, msgData });
    } catch (err) {
        console.error('Error setting localstorage: ', err);
    }
}


// ------------------------------------------------------------------------- Storing State
const STATE_KEY = 'ascii-reel-state';
const AUTO_SAVE_INTERVAL = 10000;

export function readState() {
    return getLocalStorage(STATE_KEY);
}

export function saveState() {
    if (!isValid()) {
        // There was a problem loading the state during initialization; do not persist this state to localstorage
        // console.warn("Could not save state to localstorage");
        return;
    }

    const stateObj = getState();
    setLocalStorage(STATE_KEY, stateObj, { state: stateObj })
}

export function resetState() {
    try {
        localStorage.removeItem(STATE_KEY);
    } catch (err) {
        console.error('Error resetting state: ', err);
    }
}

export function setupAutoSave() {
    window.setInterval(() => saveState(), AUTO_SAVE_INTERVAL);
}

function onAnotherTabStateUpdate(msgData) {
    replaceState(msgData.state);
    triggerRefresh();
}

// ------------------------------------------------------------------------- Storing Global Settings
const GLOBAL_SETTINGS_KEY = 'ascii-reel-global';

export function readGlobalSetting(key) {
    const settings = getLocalStorage(GLOBAL_SETTINGS_KEY) || {};
    return settings[key];
}

export function saveGlobalSetting(key, value) {
    const settings = getLocalStorage(GLOBAL_SETTINGS_KEY) || {};
    settings[key] = value;

    setLocalStorage(GLOBAL_SETTINGS_KEY, settings, { setting: key });
}

function onAnotherTabGlobalSettingsUpdate(msgData) {
    switch(msgData.setting) {
        case 'theme':
            refreshTheme(true);
            break;
    }
}


// ------------------------------------------------------------------------- BroadcastChannel / Leader Election
// Using BroadcastChannel to ensure all tabs are editing the same localstorage file

const CHANNEL_KEY = "ascii-reel-channel";
const LEADER_MSG = "leader-updated";
const UPDATE_MSG = "local-storage-updated"

const channel = new BroadcastChannel(CHANNEL_KEY);
let isLeader = false;

// Listen for messages from other tabs
channel.onmessage = (event) => {
    switch(event.data.type) {
        case LEADER_MSG:
            // Another tab is now the leader
            isLeader = false;
            break;
        case UPDATE_MSG:
            // Another tab stored something to localstorage
            switch (event.data.storageKey) {
                case STATE_KEY:
                    onAnotherTabStateUpdate(event.data.msgData)
                    break;
                case GLOBAL_SETTINGS_KEY:
                    onAnotherTabGlobalSettingsUpdate(event.data.msgData)
                    break;
                default:
                    console.warn(`Unknown UPDATE_MSG storageKey: ${event.data.storageKey}`);
            }
            break;
        default:
            console.warn(`Unknown BroadcastChannel message: ${event.data.type}`);
    }
};

// Detect tab visibility changes
document.addEventListener("visibilitychange", electLeader);

// Initial leader
electLeader();

function electLeader() {
    if (document.hidden) {
        // User is leaving the tab. If the current tab used to be the leader, save its latest state to localstorage
        if (isLeader) saveState();

        isLeader = false;
    } else {
        // Tab is now active; it is now the leader
        isLeader = true;
        channel.postMessage({ type: LEADER_MSG });
    }
}