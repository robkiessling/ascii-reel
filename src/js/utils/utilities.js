import Stats from 'stats.js';

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
 * @param {function} callback - The function to call every interval
 * @param {number} delay - Time in milliseconds between intervals
 * @param {boolean} [evaluateImmediately=false] - If true, callback immediately fires instead of waiting for first
 *   interval to pass.
 * @param {boolean} [benchmark=false] - If true, the interval will be benchmarked by a stats.js panel [DEV ONLY].
 * @returns {{stop: function}} - `stop` is a function that can be called to clear the interval
 */
export function setIntervalUsingRAF(callback, delay, evaluateImmediately = false, benchmark = false) {
    let now = performance.now();
    let then = performance.now();
    let progress = evaluateImmediately ? delay : 0;
    let stop = false;

    // let stats;
    // if (benchmark) {
    //     stats = new Stats();
    //     stats.showPanel(0);
    //     document.body.appendChild(stats.dom);
    // }

    function loop() {
        if (stop) {
            // if (stats) stats.dom.remove();
            return;
        }

        // if (stats) stats.begin();

        now = performance.now();
        progress += (now - then);
        then = now;

        if (progress >= delay) {
            try {
                callback();
            } catch (err) {
                console.error(`setIntervalUsingRAF encountered an error: ${err}`);
                stop = true;
            }
            progress = progress % delay;
        }

        // if (stats) stats.end();

        window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);

    return {
        stop: () => { stop = true; }
    }
}

/**
 * Callbacks that handle when a mouse is clicked on a target, and then released after some dragging.
 * Dragging can go off the target and the onDragEnd callback will still be called.
 * @param $element - jQuery element to bind to.
 * @param {Function} onDragStart - Function to call on mousedown.
 * @param {Function} onDragEnd - Function to call on mouseup.
 * @returns {Function} - Call this to unbind the mousedown listener.
 */
export function onMouseDrag($element, onDragStart, onDragEnd) {
    function handleMouseUp() {
        $(document).off('mouseup', handleMouseUp);
        onDragEnd();
    }

    function handleMouseDown() {
        $(document).on('mouseup', handleMouseUp);
        onDragStart();
    }

    $element.on('mousedown', handleMouseDown);

    // Return a teardown function to remove all bound handlers
    return function teardown() {
        $element.off('mousedown', handleMouseDown);
        $(document).off('mouseup', handleMouseUp);
    };
}