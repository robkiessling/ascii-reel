/**
 * The following handles saving "files" to localstorage. It is an alternative to saving/loading .ascii files to disk.
 * It is easier to use than disk files, but it is risky because if the browser cache is emptied then the files are gone.
 *
 * I am currently supporting storing ONE file to localstorage. Perhaps in the future I'll add the ability
 * to save more (would require a UI for choosing the desired file, deleting files, etc.)
 */
import * as state from "./state.js";

const STATE_KEY = 'ascii-art-maker';
const AUTO_SAVE_INTERVAL = 5000;

export function loadState() {
    try {
        const serializedState = localStorage.getItem(STATE_KEY);
        if (serializedState === null) {
            return undefined;
        }
        return JSON.parse(serializedState);
    } catch (err) {
        return undefined;
    }
}

export function saveState(serializedState) {
    try {
        localStorage.setItem(STATE_KEY, serializedState);
    } catch (err) {
        console.error('Error saving state: ', err);
    }
}

export function resetState() {
    try {
        localStorage.removeItem(STATE_KEY);
    } catch (err) {
        console.error('Error resetting state: ', err);
    }
}

export function setupAutoSave() {
    window.setInterval(() => {
        saveState(state.stringify());
    }, AUTO_SAVE_INTERVAL);
}