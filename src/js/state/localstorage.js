/**
 * The following handles saving "files" to localstorage. It is an alternative to saving/loading .asciireel files to disk.
 * It is easier to use than disk files, but it is risky because if the browser cache is emptied then the files are gone.
 *
 * I am currently supporting storing ONE file to localstorage. Perhaps in the future I'll add the ability
 * to save more (would require a UI for choosing the desired file, deleting files, etc.)
 */

import {getState, replaceState} from "./state.js";
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

function setLocalStorage(storageKey, value, postMessage) {
    if (!isLeader) return;

    try {
        localStorage.setItem(storageKey, JSON.stringify(value));
        channel.postMessage(postMessage)
    } catch (err) {
        console.error('Error setting localstorage: ', err);
    }
}


// ------------------------------------------------------------------------- Storing State
const STATE_KEY = 'ascii-reel-state';
const STATE_MSG = "update-state";
const AUTO_SAVE_INTERVAL = 5000;

export function readState() {
    return getLocalStorage(STATE_KEY);
}

export function saveState() {
    const stateObj = getState();
    setLocalStorage(STATE_KEY, stateObj, { type: STATE_MSG, state: stateObj });
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

function onAnotherTabStateUpdate(otherTabState) {
    replaceState(otherTabState);
    triggerRefresh();
}

// ------------------------------------------------------------------------- Global Settings
const GLOBAL_SETTINGS_KEY = 'ascii-reel-global';
const GLOBAL_SETTINGS_MSG = 'update-global-settings';

export function readGlobalSetting(key) {
    const settings = getLocalStorage(GLOBAL_SETTINGS_KEY) || {};
    return settings[key];
}

export function saveGlobalSetting(key, value) {
    const settings = getLocalStorage(GLOBAL_SETTINGS_KEY) || {};
    settings[key] = value;
    setLocalStorage(GLOBAL_SETTINGS_KEY, settings, { type: GLOBAL_SETTINGS_MSG, setting: key });
}

function onAnotherTabGlobalSettingsUpdate(key) {
    switch(key) {
        case 'theme':
            refreshTheme(true);
            break;
    }
}


// ------------------------------------------------------------------------- BroadcastChannel / Leader Election
// Using BroadcastChannel to ensure all tabs are editing the same localstorage file

const CHANNEL_KEY = 'ascii-reel-channel';
const LEADER_MSG = "update-leader";

const channel = new BroadcastChannel(CHANNEL_KEY);
let isLeader = false;

// Listen for messages from other tabs
channel.onmessage = (event) => {
    switch(event.data.type) {
        case LEADER_MSG:
            // Another tab is now the leader
            isLeader = false;
            break;
        case STATE_MSG:
            onAnotherTabStateUpdate(event.data.state);
            break;
        case GLOBAL_SETTINGS_MSG:
            onAnotherTabGlobalSettingsUpdate(event.data.setting);
            break;
        default:
            console.warn(`Unknown BroadcastChannel message: ${event.data.type}`);
    }
};

// Detect tab visibility changes
document.addEventListener("visibilitychange", electLeader);

// Initial leader
electLeader();

// Function to elect a leader (active tab)
function electLeader() {
    if (document.visibilityState === "visible") {
        // Current tab is now the leader
        isLeader = true;
        channel.postMessage({ type: LEADER_MSG });
    } else {
        // If current tab used to be the leader and is no longer the leader, save its final state to localstorage
        if (isLeader) saveState();
        isLeader = false;
    }
}