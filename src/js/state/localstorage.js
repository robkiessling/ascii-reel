/**
 * The following handles saving "files" to localstorage. It is an alternative to saving/loading .asciireel files to disk.
 * It is easier to use than disk files, but it is risky because if the browser cache is emptied then the files are gone.
 *
 * I am currently supporting storing ONE file to localstorage. Perhaps in the future I'll add the ability
 * to save more (would require a UI for choosing the desired file, deleting files, etc.)
 */

import {getState, replaceState} from "./state.js";
import {triggerRefresh} from "../index.js";

const STORAGE_KEY = 'ascii-reel';
const AUTO_SAVE_INTERVAL = 5000;

export function loadState() {
    try {
        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) {
            return undefined;
        }
        return JSON.parse(serializedState);
    } catch (err) {
        return undefined;
    }
}

export function saveState(stateObj) {
    if (!isLeader) return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateObj));
        channel.postMessage({ type: "update", state: stateObj })
    } catch (err) {
        console.error('Error saving state: ', err);
    }
}

export function resetState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.error('Error resetting state: ', err);
    }
}

export function setupAutoSave() {
    window.setInterval(() => {
        saveState(getState());
    }, AUTO_SAVE_INTERVAL);
}

// ------------------------------------------------------------------------- BroadcastChannel / Leader Election
// Using BroadcastChannel to ensure all tabs are editing the same localstorage file

const CHANNEL_KEY = 'ascii-reel-channel';
const channel = new BroadcastChannel(CHANNEL_KEY);
let isLeader = false;

// Listen for messages from other tabs
channel.onmessage = (event) => {
    switch(event.data.type) {
        case "leader": // another tab is now the leader
            isLeader = false;
            break;
        case "update": // received a state update from another tab
            replaceState(event.data.state);
            triggerRefresh();
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
        channel.postMessage({ type: "leader" });
    } else {
        // If current tab used to be the leader and is no longer the leader, save its final state to localstorage
        if (isLeader) saveState(getState());
        isLeader = false;
    }
}