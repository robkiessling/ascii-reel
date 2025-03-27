
export function isFunction(value) {
    return typeof value === 'function';
}

export function debounce(callback, delay = 500) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => callback.apply(this, args), delay);
    };
}

// Defers execution to the next event loop cycle, allowing the browser to process pending tasks, update the DOM, etc.
export function defer(callback, delay = 1) {
    window.setTimeout(callback, delay);
}

/**
 * Similar to window.setInterval, but built on top of requestAnimationFrame. This is better for animations
 * and can pause when the tab is inactive. Do not use if the callback needs to run at an extremely precise interval.
 *
 * @param callback The function to call every interval
 * @param delay Time in milliseconds between intervals
 * @param evaluateImmediately If true, callback immediately fires instead of waiting for first interval to pass
 * @returns {{stop: function}} `stop` is a function that can be called to clear the interval
 */
export function setIntervalUsingRAF(callback, delay, evaluateImmediately = false) {
    let now = performance.now();
    let then = performance.now();
    let progress = evaluateImmediately ? delay : 0;
    let stop = false;

    function loop() {
        if (stop) return;

        now = performance.now();
        progress += (now - then);
        then = now;

        if (progress >= delay) {
            try {
                callback();
            } catch (exception) {
                console.error(`setIntervalUsingRAF encountered an error: ${exception}`);
                stop = true;
            }
            progress = progress % delay;
        }

        window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);

    return {
        stop: () => { stop = true; }
    }
}
